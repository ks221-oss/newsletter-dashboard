import { ImapFlow } from "imapflow";
import { logger } from "./logger";

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  ts: number;
  found: boolean | null;
}

const cache = new Map<string, CacheEntry>();

export function isGmailConfigured(): boolean {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_PASS);
}

export async function checkGmail(dateStr: string): Promise<boolean | null> {
  const cached = cache.get(dateStr);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.found;
  }

  if (!isGmailConfigured()) {
    return null;
  }

  const dt = new Date(dateStr + "T00:00:00Z");
  const day = dt.getUTCDate().toString().padStart(2, "0");
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const imapDate = `${day}-${monthNames[dt.getUTCMonth()]}-${dt.getUTCFullYear()}`;

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER!,
      pass: process.env.GMAIL_PASS!,
    },
    logger: false,
  });

  try {
    await client.connect();

    let found = false;
    const folders = ["INBOX", "[Gmail]/Spam"];

    for (const folder of folders) {
      try {
        const lock = await client.getMailboxLock(folder);
        try {
          const msgs = await client.search({
            on: new Date(dateStr),
            subject: "AI Podcast Digest",
          });
          if (msgs && Array.isArray(msgs) && msgs.length > 0) {
            found = true;
          }
        } finally {
          lock.release();
        }
        if (found) break;
      } catch (err) {
        logger.warn({ err, folder }, "Gmail folder search failed");
      }
    }

    await client.logout();
    const result = found;
    cache.set(dateStr, { ts: Date.now(), found: result });
    return result;
  } catch (err) {
    logger.warn({ err, dateStr }, "Gmail IMAP check failed");
    cache.set(dateStr, { ts: Date.now(), found: null });
    return null;
  }
}
