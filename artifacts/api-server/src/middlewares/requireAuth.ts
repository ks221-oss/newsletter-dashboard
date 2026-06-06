import { getAuth, clerkClient } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";

const ALLOWED_DOMAIN = "together.fund";

interface CacheEntry {
  allowed: boolean;
  email: string;
  expiresAt: number;
}

const domainCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = getAuth(req);
  const userId = auth?.userId;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const cached = domainCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    if (!cached.allowed) {
      res.status(403).json({
        error: "Access restricted to @together.fund accounts",
        email: cached.email,
      });
      return;
    }
    next();
    return;
  }

  try {
    const user = await clerkClient.users.getUser(userId);
    const email =
      user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
        ?.emailAddress ?? "";
    const allowed = email.endsWith(`@${ALLOWED_DOMAIN}`);

    domainCache.set(userId, {
      allowed,
      email,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    if (!allowed) {
      res.status(403).json({
        error: "Access restricted to @together.fund accounts",
        email,
      });
      return;
    }

    next();
  } catch {
    res.status(401).json({ error: "Failed to verify user identity" });
  }
}
