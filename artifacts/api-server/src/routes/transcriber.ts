import { Router, type IRouter } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { TranscribeVideoBody, SummariseTranscriptBody, PushToNotionBody } from "@workspace/api-zod";

const SUMMARY_SYSTEM_PROMPT =
  "You are a research assistant. Summarise this podcast transcript in 4–6 concise paragraphs covering the main topics, key insights, and any notable quotes. Be factual and avoid filler.";

const router: IRouter = Router();

const NOTION_DB_ID = "3778d67d1a80806cbfd7d7cec90b08cb";

// VPS proxy endpoint — uses youtube-transcript-api + Webshare residential proxy
// so YouTube never sees a cloud IP. Direct fetching from Replit is blocked.
const VPS_TRANSCRIBE_URL = "http://168.144.159.14:8080/transcribe";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── In-memory caches ─────────────────────────────────────────────────────────

interface TranscriptCacheEntry {
  data: { videoId: string; title: string; thumbnailUrl: string | null; lines: Array<{ offset: number; text: string }> };
  cachedAt: number;
}

interface SummaryCacheEntry {
  data: { summary: string };
  cachedAt: number;
}

const transcriptCache = new Map<string, TranscriptCacheEntry>();
const summaryCache = new Map<string, SummaryCacheEntry>();

function getCachedTranscript(videoId: string): TranscriptCacheEntry["data"] | null {
  const entry = transcriptCache.get(videoId);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    transcriptCache.delete(videoId);
    return null;
  }
  return entry.data;
}

function getCachedSummary(videoId: string): SummaryCacheEntry["data"] | null {
  const entry = summaryCache.get(videoId);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    summaryCache.delete(videoId);
    return null;
  }
  return entry.data;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
// Routes through the VPS which has youtube-transcript-api + Webshare residential
// proxy configured. Direct fetches from cloud IPs are blocked by YouTube.

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

  // Check cache first
  const cached = getCachedTranscript(videoId);
  if (cached) {
    req.log.info({ videoId }, "Transcript cache hit");
    res.json(cached);
    return;
  }

  // Route through VPS — residential proxy bypasses YouTube's cloud IP block
  let vpsData: TranscriptCacheEntry["data"];
  try {
    const vpsRes = await fetch(`${VPS_TRANSCRIBE_URL}?video_id=${encodeURIComponent(videoId)}`, {
      signal: AbortSignal.timeout(60000), // transcription can take a moment
    });

    if (!vpsRes.ok) {
      let errMsg = "No captions available for this video";
      try {
        const errBody = (await vpsRes.json()) as { error?: string };
        if (errBody.error) errMsg = errBody.error;
      } catch {
        // ignore parse error
      }
      res.status(vpsRes.status === 404 ? 404 : 502).json({ error: errMsg });
      return;
    }

    vpsData = (await vpsRes.json()) as TranscriptCacheEntry["data"];
  } catch (err) {
    req.log.error({ err }, "Failed to reach VPS transcription endpoint");
    res.status(502).json({ error: "Transcription service unreachable — please try again" });
    return;
  }

  // Store in cache
  transcriptCache.set(videoId, { data: vpsData, cachedAt: Date.now() });

  res.json(vpsData);
});

// ─── POST /transcriber/summary ────────────────────────────────────────────────

router.post("/transcriber/summary", async (req, res): Promise<void> => {
  const body = SummariseTranscriptBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { videoId } = body.data;
  if (videoId) {
    const cached = getCachedSummary(videoId);
    if (cached) {
      req.log.info({ videoId }, "Summary cache hit");
      res.json(cached);
      return;
    }
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

    const result = { summary };
    if (videoId) {
      summaryCache.set(videoId, { data: result, cachedAt: Date.now() });
    }

    res.json(result);
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
  const BATCH_SIZE = 90;
  const firstTranscriptBatch = transcriptBlocks.slice(0, BATCH_SIZE);
  const remainingTranscriptBlocks = transcriptBlocks.slice(BATCH_SIZE);

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
    // Best-effort
  }

  type NotionPropertyValue =
    | { title: Array<{ type: string; text: { content: string } }> }
    | { url: string }
    | { date: { start: string } };

  const properties: Record<string, NotionPropertyValue> = {};

  const titlePropName = Object.keys(dbProperties).find(
    (k) => dbProperties[k].type === "title",
  ) ?? "Name";
  properties[titlePropName] = {
    title: [{ type: "text", text: { content: title } }],
  };

  const urlPropName = Object.keys(dbProperties).find(
    (k) => dbProperties[k].type === "url" || k.toLowerCase() === "url",
  );
  if (urlPropName && dbProperties[urlPropName]?.type === "url") {
    properties[urlPropName] = { url: youtubeUrl };
  }

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
        heading_2: { rich_text: [{ type: "text", text: { content: "Summary" } }] },
      },
      ...summaryBlocks,
      {
        object: "block",
        type: "heading_2",
        heading_2: { rich_text: [{ type: "text", text: { content: "Transcript" } }] },
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
