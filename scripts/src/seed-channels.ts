import { db, trackedChannels } from "@workspace/db";
import { sql } from "drizzle-orm";

const CHANNELS = [
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

let inserted = 0;
let skipped = 0;

for (const ch of CHANNELS) {
  try {
    await db
      .insert(trackedChannels)
      .values(ch)
      .onConflictDoNothing({ target: trackedChannels.youtubeHandle });

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(trackedChannels)
      .where(sql`youtube_handle = ${ch.youtubeHandle} AND created_at > now() - interval '5 seconds'`);

    if (Number(count) > 0) {
      console.log(`  + inserted  ${ch.youtubeHandle}`);
      inserted++;
    } else {
      console.log(`  ~ skipped   ${ch.youtubeHandle}  (already exists)`);
      skipped++;
    }
  } catch (err) {
    console.error(`  ✗ error     ${ch.youtubeHandle}:`, err);
  }
}

console.log(`\nDone: ${inserted} inserted, ${skipped} skipped.`);
process.exit(0);
