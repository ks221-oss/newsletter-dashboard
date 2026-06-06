import { Router, type IRouter } from "express";
import { db, trackedChannels } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateChannelBody, DeleteChannelParams, UpdateChannelBody } from "@workspace/api-zod";

const router: IRouter = Router();

// ─── YouTube helpers ──────────────────────────────────────────────────────────

const CHANNEL_ID_RE = /^UC[\w-]{22}$/;

const YT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

/** Fetch a YouTube page and extract the UC channel ID using several known patterns. */
async function resolveHandleToChannelId(ytHandle: string): Promise<{
  channelId: string | null;
  avatarUrl: string | null;
  description: string | null;
}> {
  const handle = ytHandle.startsWith("@") ? ytHandle : `@${ytHandle}`;
  const pageRes = await fetch(`https://www.youtube.com/${handle}`, {
    headers: YT_HEADERS,
    signal: AbortSignal.timeout(8000),
  });
  if (!pageRes.ok) return { channelId: null, avatarUrl: null, description: null };
  const html = await pageRes.text();

  const idMatch =
    html.match(/"channelId":"(UC[\w-]{22})"/) ||
    html.match(/"externalChannelId":"(UC[\w-]{22})"/) ||
    html.match(/\/channel\/(UC[\w-]{22})/) ||
    html.match(/"ucid":"(UC[\w-]{22})"/);

  const avatarMatch = html.match(/<meta property="og:image"\s+content="([^"]+)"/);
  const descMatch = html.match(/<meta property="og:description"\s+content="([^"]+)"/);

  return {
    channelId: idMatch ? idMatch[1] : null,
    avatarUrl: avatarMatch ? avatarMatch[1] : null,
    description: descMatch ? decodeHtmlEntities(descMatch[1]) : null,
  };
}

/** Fetch a YouTube channel page by UC ID and extract the @handle. */
async function resolveChannelIdToHandle(channelId: string): Promise<string | null> {
  const pageRes = await fetch(`https://www.youtube.com/channel/${channelId}`, {
    headers: YT_HEADERS,
    signal: AbortSignal.timeout(8000),
  });
  if (!pageRes.ok) return null;
  const html = await pageRes.text();
  // YouTube embeds the @handle in double-quoted strings in the page JSON
  const matches = html.match(/"(@[A-Za-z0-9_-]{3,30})"/g);
  if (!matches) return null;
  // Filter out generic YouTube handles and pick the first real one
  const skip = new Set(['"@youtube"', '"@YouTube"', '"@YouTubeIndia"']);
  const found = matches.find((m) => !skip.has(m));
  return found ? found.slice(1, -1) : null; // strip surrounding quotes
}

function parseYouTubeRss(xml: string): {
  channelName: string | null;
  entries: Array<{ title: string; url: string; publishedAt: string }>;
} {
  const feedSection = xml.includes("<entry>") ? xml.slice(0, xml.indexOf("<entry>")) : xml;
  const titleMatch = /<title>([^<]+)<\/title>/.exec(feedSection);
  const channelName = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : null;

  const entries: Array<{ title: string; url: string; publishedAt: string }> = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let m: RegExpExecArray | null;
  while ((m = entryRegex.exec(xml)) !== null) {
    const entry = m[1];
    const entryTitle = /<title>([^<]+)<\/title>/.exec(entry)?.[1];
    const videoId = /<yt:videoId>([^<]+)<\/yt:videoId>/.exec(entry)?.[1];
    const publishedAt = /<published>([^<]+)<\/published>/.exec(entry)?.[1];
    if (entryTitle && videoId && publishedAt) {
      entries.push({
        title: decodeHtmlEntities(entryTitle.trim()),
        url: `https://www.youtube.com/watch?v=${videoId}`,
        publishedAt,
      });
    }
  }
  return { channelName, entries };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get("/channels", async (req, res): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(trackedChannels)
      .orderBy(trackedChannels.createdAt);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch tracked channels");
    res.status(500).json({ error: "Failed to fetch channels" });
  }
});

router.get("/channels/validate", async (req, res): Promise<void> => {
  const handle = typeof req.query.handle === "string" ? req.query.handle.trim() : null;
  if (!handle) {
    res.status(400).json({ error: "handle query parameter is required" });
    return;
  }

  // Step 1: resolve to a channel ID
  let channelId: string;
  let channelAvatarUrl: string | null = null;
  let channelDescription: string | null = null;

  if (CHANNEL_ID_RE.test(handle)) {
    channelId = handle;
  } else {
    try {
      const resolved = await resolveHandleToChannelId(handle);
      if (!resolved.channelId) {
        res.status(404).json({ error: "Could not resolve channel ID from this handle" });
        return;
      }
      channelId = resolved.channelId;
      channelAvatarUrl = resolved.avatarUrl;
      channelDescription = resolved.description;
    } catch (err) {
      req.log.error({ err }, "Failed to resolve YouTube handle");
      res.status(502).json({ error: "Failed to reach YouTube" });
      return;
    }
  }

  // Step 2: fetch YouTube RSS feed for this channel
  let rssXml: string;
  try {
    const rssRes = await fetch(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!rssRes.ok) {
      res.status(404).json({ error: "No RSS feed found for this channel" });
      return;
    }
    rssXml = await rssRes.text();
  } catch (err) {
    req.log.error({ err }, "Failed to fetch YouTube RSS feed");
    res.status(502).json({ error: "Failed to reach YouTube RSS feed" });
    return;
  }

  // Step 3: parse & filter by date
  const { channelName, entries } = parseYouTubeRss(rssXml);

  const now = Date.now();
  const MS_PER_DAY = 86_400_000;
  const cutoff14 = now - 14 * MS_PER_DAY;
  const cutoff90 = now - 90 * MS_PER_DAY;

  const videos14 = entries.filter((e) => new Date(e.publishedAt).getTime() >= cutoff14);

  let videos: typeof entries;
  let lookbackDays: number;

  if (videos14.length >= 1) {
    videos = videos14;
    lookbackDays = 14;
  } else {
    const videos90 = entries.filter((e) => new Date(e.publishedAt).getTime() >= cutoff90);
    if (videos90.length >= 1) {
      videos = videos90;
      lookbackDays = 90;
    } else {
      res.status(404).json({ error: "No recent videos found in the last 90 days" });
      return;
    }
  }

  res.json({
    channelName,
    youtubeHandle: channelId,
    avatarUrl: channelAvatarUrl,
    description: channelDescription,
    lookbackDays,
    videos,
  });
});

/**
 * Generate the VPS channels.json content.
 * Resolves missing channel IDs for @handle channels and caches them in the DB.
 * For channels stored as UC IDs, resolves the @handle from YouTube.
 */
router.get("/channels/channels-json", async (req, res): Promise<void> => {
  try {
    const channels = await db
      .select()
      .from(trackedChannels)
      .orderBy(trackedChannels.createdAt);

    // Resolve missing info in parallel (batched to avoid YouTube rate limits)
    const BATCH = 5;
    const needsResolution = channels.filter((ch) => !ch.channelId);

    for (let i = 0; i < needsResolution.length; i += BATCH) {
      const batch = needsResolution.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async (ch) => {
          try {
            if (ch.youtubeHandle.startsWith("@") || !CHANNEL_ID_RE.test(ch.youtubeHandle)) {
              // Resolve @handle → UC ID
              const resolved = await resolveHandleToChannelId(ch.youtubeHandle);
              if (resolved.channelId) {
                await db
                  .update(trackedChannels)
                  .set({ channelId: resolved.channelId })
                  .where(eq(trackedChannels.id, ch.id));
                ch.channelId = resolved.channelId;
              }
            } else {
              // youtubeHandle IS a UC ID — set channelId = youtubeHandle
              await db
                .update(trackedChannels)
                .set({ channelId: ch.youtubeHandle })
                .where(eq(trackedChannels.id, ch.id));
              ch.channelId = ch.youtubeHandle;
            }
          } catch {
            // best-effort, leave channelId null
          }
        }),
      );
    }

    // Build channels.json: { "@handle": "UCxxxxxx" }
    const json: Record<string, string> = {};
    for (const ch of channels) {
      let handle = ch.youtubeHandle;
      let ucId = ch.channelId ?? ch.youtubeHandle;

      // If youtubeHandle is a UC ID, try to derive @handle
      if (CHANNEL_ID_RE.test(handle)) {
        const resolved = await resolveChannelIdToHandle(handle).catch(() => null);
        handle = resolved ?? `@${ch.displayName.replace(/[^A-Za-z0-9_]/g, "")}`;
        ucId = ch.youtubeHandle;
      }

      if (!handle.startsWith("@")) handle = `@${handle}`;
      json[handle] = ucId;
    }

    res.json(json);
  } catch (err) {
    req.log.error({ err }, "Failed to generate channels.json");
    res.status(500).json({ error: "Failed to generate channels.json" });
  }
});

router.post("/channels", async (req, res): Promise<void> => {
  const body = CreateChannelBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  try {
    const [created] = await db
      .insert(trackedChannels)
      .values({
        displayName: body.data.displayName,
        youtubeHandle: body.data.youtubeHandle,
        channelId: body.data.channelId ?? null,
        scraperName: body.data.scraperName ?? null,
        avatarUrl: body.data.avatarUrl ?? null,
        description: body.data.description ?? null,
      })
      .returning();
    res.status(201).json(created);
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr?.code === "23505") {
      res.status(409).json({ error: "Channel with this handle already exists" });
      return;
    }
    req.log.error({ err }, "Failed to create channel");
    res.status(500).json({ error: "Failed to create channel" });
  }
});

router.patch("/channels/:id", async (req, res): Promise<void> => {
  const params = DeleteChannelParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid channel id" });
    return;
  }

  const body = UpdateChannelBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  try {
    const [updated] = await db
      .update(trackedChannels)
      .set({ scraperName: body.data.scraperName ?? null })
      .where(eq(trackedChannels.id, params.data.id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update channel");
    res.status(500).json({ error: "Failed to update channel" });
  }
});

router.delete("/channels/:id", async (req, res): Promise<void> => {
  const params = DeleteChannelParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid channel id" });
    return;
  }

  try {
    const [deleted] = await db
      .delete(trackedChannels)
      .where(eq(trackedChannels.id, params.data.id))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }
    res.json(deleted);
  } catch (err) {
    req.log.error({ err }, "Failed to delete channel");
    res.status(500).json({ error: "Failed to delete channel" });
  }
});

export default router;
