import { Router, type IRouter } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { TranscribeVideoBody, SummariseTranscriptBody, PushToNotionBody } from "@workspace/api-zod";

const SUMMARY_SYSTEM_PROMPT =
  "You are a research assistant. Summarise this podcast transcript in 4–6 concise paragraphs covering the main topics, key insights, and any notable quotes. Be factual and avoid filler.";

const router: IRouter = Router();

const YT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

const NOTION_DB_ID = "3778d67d1a80806cbfd7d7cec90b08cb";

function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0] || null;
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
  } catch {
    // not a valid URL
  }
  return null;
}

function formatOffset(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function decodeHtml(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

// ─── POST /transcriber/transcript ────────────────────────────────────────────

router.post("/transcriber/transcript", async (req, res): Promise<void> => {
  const body = TranscribeVideoBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const videoId = extractVideoId(body.data.youtubeUrl);
  if (!videoId) {
    res.status(400).json({ error: "Could not extract a video ID from the provided URL" });
    return;
  }

  // Fetch the watch page
  let html: string;
  try {
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: YT_HEADERS,
      signal: AbortSignal.timeout(12000),
    });
    if (!pageRes.ok) {
      res.status(502).json({ error: "YouTube returned an error fetching the video page" });
      return;
    }
    html = await pageRes.text();
  } catch (err) {
    req.log.error({ err }, "Failed to fetch YouTube watch page");
    res.status(502).json({ error: "Could not reach YouTube" });
    return;
  }

  // Extract title and thumbnail from og tags
  const titleMatch = html.match(/<meta\s+(?:property="og:title"|name="title")\s+content="([^"]+)"/);
  const thumbMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/);
  const title = titleMatch ? decodeHtml(titleMatch[1]) : `YouTube video ${videoId}`;
  const thumbnailUrl = thumbMatch ? thumbMatch[1] : null;

  // Extract captionTracks from ytInitialPlayerResponse
  const captionMatch = html.match(/"captionTracks":(\[.*?\])/s);
  if (!captionMatch) {
    res.status(404).json({ error: "No captions available for this video" });
    return;
  }

  let captionTracks: Array<{ baseUrl: string; languageCode: string; kind?: string }>;
  try {
    captionTracks = JSON.parse(captionMatch[1]);
  } catch {
    res.status(404).json({ error: "Could not parse caption data from YouTube" });
    return;
  }

  if (captionTracks.length === 0) {
    res.status(404).json({ error: "No captions available for this video" });
    return;
  }

  // Prefer English non-ASR, then English ASR, then first available
  const track =
    captionTracks.find((t) => t.languageCode === "en" && t.kind !== "asr") ||
    captionTracks.find((t) => t.languageCode === "en") ||
    captionTracks[0];

  // Fetch timed-text XML
  let xml: string;
  try {
    const timedRes = await fetch(track.baseUrl, {
      headers: YT_HEADERS,
      signal: AbortSignal.timeout(12000),
    });
    if (!timedRes.ok) {
      res.status(502).json({ error: "Failed to fetch caption data from YouTube" });
      return;
    }
    xml = await timedRes.text();
  } catch (err) {
    req.log.error({ err }, "Failed to fetch timed-text XML");
    res.status(502).json({ error: "Could not reach YouTube captions" });
    return;
  }

  // Parse <text start="…" dur="…">…</text>
  const lines: Array<{ offset: number; text: string }> = [];
  const textRe = /<text[^>]+start="([\d.]+)"[^>]*>([^<]*)<\/text>/g;
  let m: RegExpExecArray | null;
  while ((m = textRe.exec(xml)) !== null) {
    const text = decodeHtml(m[2].trim());
    if (text) {
      lines.push({ offset: parseFloat(m[1]), text });
    }
  }

  if (lines.length === 0) {
    res.status(404).json({ error: "Caption track was empty" });
    return;
  }

  res.json({ videoId, title, thumbnailUrl, lines });
});

// ─── POST /transcriber/summary ────────────────────────────────────────────────

router.post("/transcriber/summary", async (req, res): Promise<void> => {
  const body = SummariseTranscriptBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicKey) {
    res.status(502).json({ error: "AI service not configured — set ANTHROPIC_API_KEY" });
    return;
  }

  const plainText = body.data.lines
    .map((l) => `[${formatOffset(l.offset)}] ${l.text}`)
    .join("\n");

  const userContent = `Title: ${body.data.title}\n\nTranscript:\n${plainText}`;

  try {
    const client = new Anthropic({ apiKey: anthropicKey });
    const message = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 8192,
      system: SUMMARY_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });
    const block = message.content[0];
    const summary = block.type === "text" ? block.text : "";

    res.json({ summary });
  } catch (err) {
    req.log.error({ err }, "AI summary error");
    res.status(502).json({ error: "AI service unavailable" });
  }
});

// ─── POST /transcriber/notion ─────────────────────────────────────────────────

router.post("/transcriber/notion", async (req, res): Promise<void> => {
  const body = PushToNotionBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) {
    res.status(502).json({ error: "Notion not configured (missing NOTION_API_KEY)" });
    return;
  }

  const { title, youtubeUrl, thumbnailUrl, summary, lines } = body.data;

  // Build summary paragraph blocks (split on double newlines)
  const summaryParas = summary
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const summaryBlocks = summaryParas.map((para) => ({
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: [{ type: "text", text: { content: para.slice(0, 2000) } }],
    },
  }));

  // Build transcript block — single code block (Notion max 2000 chars per block, chunk it)
  const transcriptText = lines
    .map((l) => `[${formatOffset(l.offset)}] ${l.text}`)
    .join("\n");

  const CHUNK = 1990;
  const transcriptBlocks = [];
  for (let i = 0; i < transcriptText.length; i += CHUNK) {
    transcriptBlocks.push({
      object: "block",
      type: "code",
      code: {
        rich_text: [{ type: "text", text: { content: transcriptText.slice(i, i + CHUNK) } }],
        language: "plain text",
      },
    });
  }

  const today = new Date().toISOString().slice(0, 10);

  // Notion API max 100 children per create request — batch the rest via append
  const BATCH_SIZE = 90; // leave headroom for heading blocks
  const firstTranscriptBatch = transcriptBlocks.slice(0, BATCH_SIZE);
  const remainingTranscriptBlocks = transcriptBlocks.slice(BATCH_SIZE);

  // Fetch DB schema to build only properties that exist, using the actual property names
  let dbProperties: Record<string, { type: string }> = {};
  try {
    const dbRes = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB_ID}`, {
      headers: {
        Authorization: `Bearer ${notionKey}`,
        "Notion-Version": "2022-06-28",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (dbRes.ok) {
      const dbData = (await dbRes.json()) as { properties: Record<string, { type: string }> };
      dbProperties = dbData.properties ?? {};
    }
  } catch {
    // Best-effort — continue with empty dbProperties (only title will be set)
  }

  // Build properties defensively — only include keys that exist in the DB
  type NotionPropertyValue =
    | { title: Array<{ type: string; text: { content: string } }> }
    | { url: string }
    | { date: { start: string } };

  const properties: Record<string, NotionPropertyValue> = {};

  // Find the title property (always required, but may have any name)
  const titlePropName = Object.keys(dbProperties).find(
    (k) => dbProperties[k].type === "title",
  ) ?? "Name";
  properties[titlePropName] = {
    title: [{ type: "text", text: { content: title } }],
  };

  // URL property — only if present and is a url type
  const urlPropName = Object.keys(dbProperties).find(
    (k) => dbProperties[k].type === "url" || k.toLowerCase() === "url",
  );
  if (urlPropName && dbProperties[urlPropName]?.type === "url") {
    properties[urlPropName] = { url: youtubeUrl };
  }

  // Date property — only if present and is a date type
  const datePropName = Object.keys(dbProperties).find(
    (k) => dbProperties[k].type === "date" || k.toLowerCase() === "date",
  );
  if (datePropName && dbProperties[datePropName]?.type === "date") {
    properties[datePropName] = { date: { start: today } };
  }

  const payload = {
    parent: { database_id: NOTION_DB_ID },
    cover: thumbnailUrl
      ? { type: "external", external: { url: thumbnailUrl } }
      : undefined,
    properties,
    children: [
      {
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [{ type: "text", text: { content: "Summary" } }],
        },
      },
      ...summaryBlocks,
      {
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [{ type: "text", text: { content: "Transcript" } }],
        },
      },
      ...firstTranscriptBatch,
    ],
  };

  async function appendNotionBlocks(pageId: string, blocks: unknown[]): Promise<void> {
    const APPEND_BATCH = 100;
    for (let i = 0; i < blocks.length; i += APPEND_BATCH) {
      const batch = blocks.slice(i, i + APPEND_BATCH);
      const appendRes = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${notionKey}`,
          "Content-Type": "application/json",
          "Notion-Version": "2022-06-28",
        },
        body: JSON.stringify({ children: batch }),
        signal: AbortSignal.timeout(20000),
      });
      if (!appendRes.ok) {
        const errText = await appendRes.text();
        throw new Error(`Notion append returned ${appendRes.status}: ${errText.slice(0, 200)}`);
      }
    }
  }

  try {
    const notionRes = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${notionKey}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });

    if (!notionRes.ok) {
      const errText = await notionRes.text();
      req.log.error({ status: notionRes.status, body: errText }, "Notion API error");
      res.status(502).json({ error: `Notion returned ${notionRes.status}: ${errText.slice(0, 200)}` });
      return;
    }

    const page = (await notionRes.json()) as { id: string; url: string };
    const notionPageUrl = page.url ?? `https://www.notion.so/${page.id.replace(/-/g, "")}`;

    // Append remaining transcript blocks in batches (full transcript, no truncation)
    if (remainingTranscriptBlocks.length > 0) {
      await appendNotionBlocks(page.id, remainingTranscriptBlocks);
    }

    res.json({ notionPageUrl });
  } catch (err) {
    req.log.error({ err }, "Failed to reach Notion API");
    res.status(502).json({ error: `Could not push to Notion: ${err instanceof Error ? err.message : String(err)}` });
  }
});

export default router;
