import app from "./app";
import { logger } from "./lib/logger";
import { db, trackedChannels } from "@workspace/db";
import { sql } from "drizzle-orm";

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
});
