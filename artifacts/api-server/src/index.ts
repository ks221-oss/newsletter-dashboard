import app from "./app";
import { logger } from "./lib/logger";
import { db, trackedChannels } from "@workspace/db";
import { sql, isNull, or } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const SEED_CHANNELS = [
  { displayName: "AI Engineer",       youtubeHandle: "@aiDotEngineer" },
  { displayName: "BG2 Pod",           youtubeHandle: "@Bg2Pod" },
  { displayName: "Dwarkesh Patel",    youtubeHandle: "@DwarkeshPatel" },
  { displayName: "Uncapped Pod",      youtubeHandle: "@uncappedpod" },
  { displayName: "ILTB Podcast",      youtubeHandle: "@ILTB_Podcast" },
  { displayName: "Sequoia Capital",   youtubeHandle: "@sequoiacapital" },
  { displayName: "Redpoint AI",       youtubeHandle: "@RedpointAI" },
  { displayName: "20VC",              youtubeHandle: "@20VC" },
  { displayName: "SemiDoped",         youtubeHandle: "@SemiDoped" },
  { displayName: "All In",            youtubeHandle: "@allin" },
  { displayName: "Acquired FM",       youtubeHandle: "@AcquiredFM" },
  { displayName: "Latent Space Pod",  youtubeHandle: "@LatentSpacePod" },
  { displayName: "No Priors Podcast", youtubeHandle: "@NoPriorsPodcast" },
  { displayName: "Sourcery VC",       youtubeHandle: "@SourceryVC" },
  { displayName: "Y Combinator",      youtubeHandle: "@ycombinator" },
  { displayName: "a16z",              youtubeHandle: "@a16z" },
];

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

/**
 * One-time backfill: for every channel missing channelId / avatarUrl / description,
 * fetch the YouTube page and fill them in. Idempotent — skips channels that already
 * have all three fields set.
 */
async function backfillChannelMetadata() {
  try {
    const toFill = await db
      .select()
      .from(trackedChannels)
      .where(or(isNull(trackedChannels.channelId), isNull(trackedChannels.avatarUrl)));

    if (toFill.length === 0) {
      logger.info("backfillChannelMetadata: nothing to do");
      return;
    }

    logger.info({ count: toFill.length }, "backfillChannelMetadata: starting");

    const BATCH = 4;
    let updated = 0;
    let failed = 0;

    for (let i = 0; i < toFill.length; i += BATCH) {
      const batch = toFill.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async (ch) => {
          try {
            const handle = ch.youtubeHandle.startsWith("@")
              ? ch.youtubeHandle
              : `@${ch.youtubeHandle}`;
            const pageRes = await fetch(`https://www.youtube.com/${handle}`, {
              headers: YT_HEADERS,
              signal: AbortSignal.timeout(10_000),
            });
            if (!pageRes.ok) { failed++; return; }
            const html = await pageRes.text();

            const idMatch =
              html.match(/"channelId":"(UC[\w-]{22})"/) ||
              html.match(/"externalChannelId":"(UC[\w-]{22})"/) ||
              html.match(/\/channel\/(UC[\w-]{22})/) ||
              html.match(/"ucid":"(UC[\w-]{22})"/);
            const avatarMatch = html.match(/<meta property="og:image"\s+content="([^"]+)"/);
            const descMatch = html.match(/<meta property="og:description"\s+content="([^"]+)"/);

            await db
              .update(trackedChannels)
              .set({
                channelId:   idMatch     ? idMatch[1]                        : ch.channelId,
                avatarUrl:   avatarMatch ? avatarMatch[1]                    : ch.avatarUrl,
                description: descMatch   ? decodeHtmlEntities(descMatch[1])  : ch.description,
              })
              .where(sql`id = ${ch.id}`);
            updated++;
          } catch (err) {
            logger.warn({ err, handle: ch.youtubeHandle }, "backfill: failed for channel");
            failed++;
          }
        }),
      );
    }

    logger.info({ updated, failed }, "backfillChannelMetadata: done");
  } catch (err) {
    logger.error({ err }, "backfillChannelMetadata: unexpected error");
  }
}

async function seedChannelsIfEmpty() {
  try {
    const [{ count }] = await db
      .select({ count: sql<string>`count(*)` })
      .from(trackedChannels);
    if (Number(count) === 0) {
      await db
        .insert(trackedChannels)
        .values(SEED_CHANNELS.map((ch) => ({ ...ch, scraperName: null })))
        .onConflictDoNothing();
      logger.info({ count: SEED_CHANNELS.length }, "Seeded tracked channels");
    }
  } catch (err) {
    logger.error({ err }, "Failed to seed tracked channels");
  }
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  seedChannelsIfEmpty();
  backfillChannelMetadata();
});
