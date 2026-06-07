import { Router, type IRouter } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { TranscribeVideoBody, SummariseTranscriptBody, PushToNotionBody } from "@workspace/api-zod";

const SUMMARY_SYSTEM_PROMPT =
  "You are a research assistant. Summarise this podcast transcript in 4–6 concise paragraphs covering the main topics, key insights, and any notable quotes. Be factual and avoid filler.";

// Structured metadata prompt — mirrors the daily pipeline's summarize_video() prompt
const STRUCTURED_META_PROMPT = `You are an analyst for an AI-focused venture capital fund. Analyze this podcast transcript and return a JSON object.

Return ONLY valid JSON with this exact structure (no markdown, no prose):
{
  "key_topics": ["<topic 1>", "<topic 2>", ...],
  "guests": ["<First Last (Title, Company)>", ...],
  "data_points": ["<specific number or stat mentioned>", ...],
  "depth_score": <1-10 integer>
}

Rules:
- key_topics: 3-6 concise topics
- guests: list of interview guests (NOT the host). Format: "First Last (Title, Company)". Leave [] if solo monologue or hosts-only. Max 5.
- data_points: only real numbers/stats from the transcript (e.g. "$28B valuation", "40% YoY growth", "1T parameter model")
- depth_score: 9-10 means the nuance/energy/conviction is truly irreplaceable; 1-3 means reading summary = fully informed`;

const router: IRouter = Router();

const NOTION_DB_ID = "3778d67d1a80806cbfd7d7cec90b08cb";

// VPS proxy endpoint — uses youtube-transcript-api + Webshare residential proxy
const VPS_TRANSCRIBE_URL = "http://168.144.159.14:8080/transcribe";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── In-memory caches ─────────────────────────────────────────────────────────

interface TranscriptCacheEntry {
  data: { videoId: string; title: string; channelTitle: string | null; thumbnailUrl: string | null; lines: Array<{ offset: number; text: string }> };
  cachedAt: number;
}

interface SummaryCacheEntry {
  data: { summary: string };
  cachedAt: number;
}

interface StructuredMeta {
  key_topics: string[];
  guests: string[];
  data_points: string[];
  depth_score: number;
}

const transcriptCache = new Map<string, TranscriptCacheEntry>();
const summaryCache = new Map<string, SummaryCacheEntry>();

function getCachedTranscript(videoId: string): TranscriptCacheEntry["data"] | null {
  const entry = transcriptCache.get(videoId);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) { transcriptCache.delete(videoId); return null; }
  return entry.data;
}

function getCachedSummary(videoId: string): SummaryCacheEntry["data"] | null {
  const entry = summaryCache.get(videoId);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) { summaryCache.delete(videoId); return null; }
  return entry.data;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0] || null;
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
  } catch { /* not a valid URL */ }
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
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

// ─── POST /transcriber/transcript ────────────────────────────────────────────

router.post("/transcriber/transcript", async (req, res): Promise<void> => {
  const body = TranscribeVideoBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const videoId = extractVideoId(body.data.youtubeUrl);
  if (!videoId) { res.status(400).json({ error: "Could not extract a video ID from the provided URL" }); return; }

  const cached = getCachedTranscript(videoId);
  if (cached) { req.log.info({ videoId }, "Transcript cache hit"); res.json(cached); return; }

  let vpsData: TranscriptCacheEntry["data"];
  try {
    const vpsRes = await fetch(`${VPS_TRANSCRIBE_URL}?video_id=${encodeURIComponent(videoId)}`, {
      signal: AbortSignal.timeout(60000),
    });
    if (!vpsRes.ok) {
      let errMsg = "No captions available for this video";
      try { const e = (await vpsRes.json()) as { error?: string }; if (e.error) errMsg = e.error; } catch { /* ignore */ }
      res.status(vpsRes.status === 404 ? 404 : 502).json({ error: errMsg });
      return;
    }
    vpsData = (await vpsRes.json()) as TranscriptCacheEntry["data"];
  } catch (err) {
    req.log.error({ err }, "Failed to reach VPS transcription endpoint");
    res.status(502).json({ error: "Transcription service unreachable — please try again" });
    return;
  }

  transcriptCache.set(videoId, { data: vpsData, cachedAt: Date.now() });
  res.json(vpsData);
});

// ─── POST /transcriber/summary ────────────────────────────────────────────────

router.post("/transcriber/summary", async (req, res): Promise<void> => {
  const body = SummariseTranscriptBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const { videoId } = body.data;
  if (videoId) {
    const cached = getCachedSummary(videoId);
    if (cached) { req.log.info({ videoId }, "Summary cache hit"); res.json(cached); return; }
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) { res.status(502).json({ error: "AI service not configured — set ANTHROPIC_API_KEY" }); return; }

  const plainText = body.data.lines.map((l) => `[${formatOffset(l.offset)}] ${l.text}`).join("\n");
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
    if (videoId) summaryCache.set(videoId, { data: result, cachedAt: Date.now() });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "AI summary error");
    res.status(502).json({ error: "AI service unavailable" });
  }
});

// ─── POST /transcriber/notion ─────────────────────────────────────────────────

router.post("/transcriber/notion", async (req, res): Promise<void> => {
  const body = PushToNotionBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) { res.status(502).json({ error: "Notion not configured (missing NOTION_API_KEY)" }); return; }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const { title, youtubeUrl, thumbnailUrl, summary, lines } = body.data;
  const videoId = body.data.videoId ?? extractVideoId(youtubeUrl) ?? "";

  // ── Step 1: Extract structured metadata via Claude (mirrors daily pipeline) ──
  let meta: StructuredMeta = { key_topics: [], guests: [], data_points: [], depth_score: 5 };
  if (anthropicKey) {
    try {
      const client = new Anthropic({ apiKey: anthropicKey });
      // Use first ~400 lines to stay within token budget
      const plainText = lines.slice(0, 400).map((l) => `[${formatOffset(l.offset)}] ${l.text}`).join("\n");
      const msg = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: `Title: ${title}\n\nTranscript:\n${plainText}\n\n${STRUCTURED_META_PROMPT}`,
        }],
      });
      const raw = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
      meta = JSON.parse(cleaned) as StructuredMeta;
    } catch (err) {
      req.log.warn({ err }, "Structured metadata extraction failed — using defaults");
    }
  }

  // ── Step 2: Build Notion page content ────────────────────────────────────────
  const summaryParas = summary.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const summaryBlocks = summaryParas.map((para) => ({
    object: "block", type: "paragraph",
    paragraph: { rich_text: [{ type: "text", text: { content: para.slice(0, 2000) } }] },
  }));

  const transcriptText = lines.map((l) => `[${formatOffset(l.offset)}] ${l.text}`).join("\n");
  const CHUNK = 1990;
  const transcriptBlocks = [];
  for (let i = 0; i < transcriptText.length; i += CHUNK) {
    transcriptBlocks.push({
      object: "block", type: "code",
      code: { rich_text: [{ type: "text", text: { content: transcriptText.slice(i, i + CHUNK) } }], language: "plain text" },
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  const BATCH_SIZE = 90;
  const firstTranscriptBatch = transcriptBlocks.slice(0, BATCH_SIZE);
  const remainingTranscriptBlocks = transcriptBlocks.slice(BATCH_SIZE);

  // ── Step 3: Fetch DB schema ───────────────────────────────────────────────────
  let dbProperties: Record<string, { type: string }> = {};
  try {
    const dbRes = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB_ID}`, {
      headers: { Authorization: `Bearer ${notionKey}`, "Notion-Version": "2022-06-28" },
      signal: AbortSignal.timeout(10000),
    });
    if (dbRes.ok) {
      const dbData = (await dbRes.json()) as { properties: Record<string, { type: string }> };
      dbProperties = dbData.properties ?? {};
    }
  } catch { /* best-effort */ }

  // ── Step 4: Build properties — all columns, matching daily pipeline output ────
  const properties: Record<string, unknown> = {};

  // Helper to find property name by type or exact/case-insensitive key
  const findProp = (type: string, ...keys: string[]) =>
    Object.keys(dbProperties).find((k) =>
      dbProperties[k].type === type && (keys.length === 0 || keys.some((kk) => k.toLowerCase() === kk.toLowerCase()))
    ) ?? Object.keys(dbProperties).find((k) => keys.some((kk) => k.toLowerCase() === kk.toLowerCase()));

  // Title (required)
  const titleProp = findProp("title") ?? "Name";
  properties[titleProp] = { title: [{ type: "text", text: { content: title } }] };

  // URL
  const urlProp = findProp("url", "url");
  if (urlProp && dbProperties[urlProp]?.type === "url") {
    properties[urlProp] = { url: youtubeUrl };
  }

  // Date
  const dateProp = findProp("date", "date");
  if (dateProp && dbProperties[dateProp]?.type === "date") {
    properties[dateProp] = { date: { start: today } };
  }

  // Tags / key_topics (multi_select)
  const tagsProp = findProp("multi_select", "tags", "key topics", "topics");
  if (tagsProp && dbProperties[tagsProp]?.type === "multi_select" && meta.key_topics.length > 0) {
    properties[tagsProp] = { multi_select: meta.key_topics.slice(0, 10).map((t) => ({ name: t.slice(0, 100) })) };
  }

  // Key Guests (rich_text)
  const guestsProp = findProp("rich_text", "key guests", "guests");
  if (guestsProp && dbProperties[guestsProp]?.type === "rich_text" && meta.guests.length > 0) {
    properties[guestsProp] = { rich_text: [{ type: "text", text: { content: meta.guests.join(", ").slice(0, 2000) } }] };
  }

  // Depth Score (number)
  const depthProp = findProp("number", "depth score", "depth_score");
  if (depthProp && dbProperties[depthProp]?.type === "number") {
    properties[depthProp] = { number: meta.depth_score };
  }

  // Data Points (rich_text)
  const dataProp = findProp("rich_text", "data points", "data_points");
  if (dataProp && dbProperties[dataProp]?.type === "rich_text" && meta.data_points.length > 0) {
    properties[dataProp] = { rich_text: [{ type: "text", text: { content: meta.data_points.join(" • ").slice(0, 2000) } }] };
  }

  // Transcript Available (checkbox)
  const transcriptAvailProp = findProp("checkbox", "transcript available", "transcript");
  if (transcriptAvailProp && dbProperties[transcriptAvailProp]?.type === "checkbox") {
    properties[transcriptAvailProp] = { checkbox: true };
  }

  // Must Listen (checkbox) — default false for one-off (no ranking done)
  const mustListenProp = findProp("checkbox", "must listen");
  if (mustListenProp && dbProperties[mustListenProp]?.type === "checkbox") {
    properties[mustListenProp] = { checkbox: false };
  }

  // ── Step 5: Create Notion page ────────────────────────────────────────────────
  const payload = {
    parent: { database_id: NOTION_DB_ID },
    cover: thumbnailUrl ? { type: "external", external: { url: thumbnailUrl } } : undefined,
    properties,
    children: [
      { object: "block", type: "heading_2", heading_2: { rich_text: [{ type: "text", text: { content: "Summary" } }] } },
      ...summaryBlocks,
      { object: "block", type: "heading_2", heading_2: { rich_text: [{ type: "text", text: { content: "Transcript" } }] } },
      ...firstTranscriptBatch,
    ],
  };

  async function appendNotionBlocks(pageId: string, blocks: unknown[]): Promise<void> {
    const APPEND_BATCH = 100;
    for (let i = 0; i < blocks.length; i += APPEND_BATCH) {
      const appendRes = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${notionKey}`, "Content-Type": "application/json", "Notion-Version": "2022-06-28" },
        body: JSON.stringify({ children: blocks.slice(i, i + APPEND_BATCH) }),
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
      headers: { Authorization: `Bearer ${notionKey}`, "Content-Type": "application/json", "Notion-Version": "2022-06-28" },
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

    req.log.info({ videoId, depth_score: meta.depth_score, guests: meta.guests.length, topics: meta.key_topics.length }, "Notion page created");
    res.json({ notionPageUrl });
  } catch (err) {
    req.log.error({ err }, "Failed to reach Notion API");
    res.status(502).json({ error: `Could not push to Notion: ${err instanceof Error ? err.message : String(err)}` });
  }
});

export default router;
