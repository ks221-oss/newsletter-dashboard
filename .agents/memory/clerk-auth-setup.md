---
name: Clerk Auth setup
description: Replit-managed Clerk with Google SSO; domain restriction to @together.fund on both layers.
---

## Rule
Only `@together.fund` email addresses may access the dashboard. Enforced at two layers:
1. **Frontend** — `DomainGuard` component checks `user.primaryEmailAddress.emailAddress.endsWith('@together.fund')` after sign-in; shows `AccessDenied` screen with sign-out button if domain is wrong.
2. **Backend** — `requireAuth` middleware (`artifacts/api-server/src/middlewares/requireAuth.ts`) calls `clerkClient.users.getUser(userId)` and returns 403 for non-`@together.fund` emails; result cached 5 min per userId.

**Why:** User explicitly required no other domain to access the ops dashboard.

**How to apply:** Any new protected API routes should be added after the `requireAuth` line in `routes/index.ts`. Healthz is intentionally public (before requireAuth).

## Clerk wiring
- Keys auto-provisioned by `setupClerkWhitelabelAuth()` — never set manually.
- `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` are set as Replit secrets.
- Clerk proxy middleware is mounted at `/api/__clerk` (production-only passthrough).
- `publishableKeyFromHost` from `@clerk/react/internal` resolves the key — never use raw env var directly.
- `tailwindcss({ optimize: false })` in vite.config.ts is required for Tailwind v4 + Clerk themes to work correctly in prod builds.
- `@layer theme, base, clerk, components, utilities;` must be the first line of index.css.

## Localization
Title/subtitle overridden via `localization` prop on `<ClerkProvider>` to show "MISSION_CONTROL" instead of the provisioned app name.
