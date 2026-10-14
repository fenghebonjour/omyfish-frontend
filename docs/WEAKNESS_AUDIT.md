# OMyFish Frontend — Weakness Audit (learning notes)

Ported from `omyfish-dotnet/docs/WEAKNESS_AUDIT.md`'s senior-dev-style review
(2026-09-10) — see that file for the original writeup, and
`omyfish-java`/`omyfish-python-web`/`omyfish-ai`/`omyfish-python`'s own
`docs/WEAKNESS_AUDIT.md` for how this translation was already done four
times for the rest of the family. Tracked for real work in `BACKLOG.md` —
this file is the "why", that file is the "what to do". **Unlike the other
four, this pass is audit-only — nothing below has been fixed yet.**

**Central architecture finding, load-bearing for almost every entry below:**
this repo is a pure Next.js/React SPA with no backend, database, or message
broker of its own — every page under `src/app/` is a client component
(`"use client"`) that calls one of the family's backends over
`NEXT_PUBLIC_API_URL` through the single `src/lib/api.ts` fetch wrapper.
Several of dotnet's original categories (gateway auth *enforcement*, the
outbox pattern, consumer idempotency, schema drift, N+1 queries) don't have
a frontend-shaped equivalent by construction — there's no server process
here to own a DB connection, a queue, or a second auth layer. Those sections
are marked not applicable below rather than stretched to fit.

---

## 1. Security

### §1.1 — Gateway auth enforcement — not applicable

No gateway, no server-side route handlers. Every protected page
(`/admin`, `/account`, `/observations`, `/notifications`) follows the same
client-side pattern — redirect to `/login` if `!isAuthenticated`, then call
the backend with the bearer token — but that's a UX convenience, not
enforcement; the actual access control is 100% the backend's job (already
covered by the other four repos' §1.1 entries). Verified all four pages use
the identical `useAuth()` + `router.push("/login")` guard
(`src/app/{admin,account,observations,notifications}/page.tsx`).

### §1.2 — No rate limiting on the identify upload — not applicable to fix here; one related gap noted

**Not applicable as a fix target:** rate-limiting the paid AI identify
endpoint is inherently a backend concern (already audited per-backend
across the family) — a pure client can't enforce a limit a user's own
browser controls.

**Related gap, not present elsewhere in the family:** unlike
`omyfish-ai`'s Streamlit sibling, which added a per-session cooldown on its
Identify tab specifically because it has no server layer to hang a limiter
on (§1.2 there), `FishUploader.tsx`'s `onDrop` has no client-side throttle
at all — nothing stops a user from immediately re-dropping a new file after
each result. Low-value fix on its own (any real limit still has to live
server-side, and does), but worth the same one-line mitigation for the
common case (accidental rapid re-uploads), consistent with the family
precedent.

### §1.3 — Refresh token in `localStorage` — already fixed; the access token half is not

**Already fixed:** the refresh token itself is an httpOnly cookie now
(`api.auth.refresh()`/`login()`/`logout()` all pass `credentials: "include"`
in `src/lib/api.ts`, and `AuthContext.tsx` never touches a refresh token
directly) — this is the frontend half of the fix dotnet's original §1.3
called for, already landed before this audit pass (see the in-code
references to `BACKLOG.md item F, WEAKNESS_AUDIT.md §1.3` in both files).

**Not fixed:** the short-lived *access* token is still written to
`localStorage` (`persistAuth()` in `AuthContext.tsx:28`), not kept
in-memory only. Dotnet's original fix explicitly called for "not even
`localStorage` — a JS variable/React context is enough, since it's meant to
be short-lived anyway." Today an XSS payload can still read
`omyfish_token` off `localStorage` directly; it just gets a short-lived
token instead of a 30-day one, since the long-lived credential (the refresh
cookie) is now out of JS's reach. Smaller blast radius than the original
bug, same class of exposure.

**Fix:** drop the two `localStorage.setItem`/`getItem` calls for
`omyfish_token` in `AuthContext.tsx` and keep `token` as plain `useState`
only; on a hard reload, rely on the existing `api.auth.refresh()` bootstrap
call (already there for exactly this case) to re-mint an access token from
the httpOnly cookie instead of reading one back from `localStorage`.
`omyfish_userId`/`omyfish_email` are non-sensitive and fine to leave as-is.

### §1.4 — Container runs as root — already fixed

`Dockerfile`'s final stage already creates and switches to a non-root user
(`addgroup --system nodejs && adduser --system nextjs` / `USER nextjs`,
lines 19-23) — matches the fix the other four repos' §1.4 called for.
Nothing to do here.

### Bonus — no security headers configured

`next.config.ts` is a 4-line file with only `output: "standalone"` — no
`headers()` entry for CSP, `X-Frame-Options`, `X-Content-Type-Options`, or
`Referrer-Policy`. Not a regression (nothing here ever set them), just an
open gap shared with every other sibling's "no dependency scanning" style
finding — noted, not fixed in this pass.

---

## 2. Resilience

### §2.1 — No timeout/retry/circuit breaker — present, not fixed

**Problem:** `apiFetch()` (`src/lib/api.ts:200`) calls the raw `fetch()`
with no `AbortController`/timeout and no retry. Unlike a typed `HttpClient`
in the .NET/Java siblings, `fetch()` has no default timeout at all — a
backend that hangs (not down, just slow — e.g. the AI service under load)
leaves the calling page's request pending indefinitely, with only whatever
implicit browser/OS socket timeout eventually fires.

**Why it matters:** this is the same class of bug as dotnet's original
§2.1, just without the "the BCL default is 100s" specifics — here there's
no ceiling at all by default. A slow `identify` or `bite-score` call spins
the loading state forever with no way for the UI to say "something's wrong,
try again."

**Fix:**
```ts
async function apiFetch<T>(path: string, init?: RequestInit, token?: string, isRetry = false): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(`${API_BASE}${path}`, { ...init, headers, signal: controller.signal });
    // ...unchanged...
  } finally {
    clearTimeout(timeout);
  }
}
```
Retry is lower priority than the timeout — most calls here are user-
triggered (a button click, a page load), so a clear failure a user can
retry manually is an acceptable baseline; an automatic retry mainly matters
for the AI-backed calls users are already used to waiting on.

### §2.2 — No global exception handling — present, not fixed

**Problem:** no `error.tsx` anywhere under `src/app/` (checked — none
exist, along with no `not-found.tsx`/`loading.tsx`). A render-time
exception in any page component (a bad API response shape, a `null`
dereference on `result.predictions[0]`-style code, etc.) falls through to
Next.js's own default error UI instead of anything branded or actionable.

**Fix:** add `src/app/error.tsx` (Next.js App Router's built-in error
boundary convention):
```tsx
"use client";
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="text-center py-20">
      <p className="text-gray-500 mb-4">Something went wrong.</p>
      <button onClick={reset} className="underline text-blue-600">Try again</button>
    </div>
  );
}
```

### §2.3 / §2.4 — Outbox pattern / consumer idempotency — not applicable

No message broker, no consumers, no dual-write anywhere in this repo — the
risk these patterns protect against doesn't exist in a pure SPA.

---

## 3. Data layer

Not applicable — this repo owns no database, no migrations, no ORM. All
persistence is the backend's responsibility (already covered per-backend).

---

## 4. Testing & CI

**Problem, two parts:**

1. **Test coverage is nearly all in one file.** `src/lib/api.test.ts` (4
   tests) covers only `apiFetch`'s 401/refresh-retry logic — genuinely
   solid coverage of that one piece of logic, but nothing else in the repo
   has a single test: `AuthContext.tsx`, `ObservationMap.tsx`,
   `FishUploader.tsx`, `biteScore.ts`, `RegsChat.tsx`, and every page under
   `src/app/` are all untested.
2. **CI doesn't run the lint script that already exists.**
   `.github/workflows/publish.yml`'s `test` job runs `npm test` and
   `npx tsc --noEmit`, gating `build-and-push` on both (this is already the
   fix the other repos' §4 called for — image publish is gated on tests
   passing) — but `package.json`'s `lint` script (`next lint`) is never
   invoked anywhere in CI, so a lint violation ships silently.

**Why it matters:** `biteScore.ts` in particular (the bite-window
scoring/aggregation math the whole `/` home page is built around) has real
logic worth locking in with tests — today a refactor there has nothing to
catch a regression except manual inspection.

**Fix (CI, the cheap part):**
```yaml
# .github/workflows/publish.yml — add alongside the existing Test/Type check steps
- name: Lint
  run: npm run lint
```
Test coverage for `biteScore.ts` and `AuthContext.tsx` is the higher-value,
larger lift — left for a follow-up pass rather than attempted here.

**Not present, matching every sibling's same gap:** no dependency/security
scanning (`npm audit` or similar) in CI.

---

## 5. Dead code / cleanup

- **`react-leaflet` is an unused dependency.** `package.json` lists both
  `leaflet` and `react-leaflet`, but `grep -rn "react-leaflet" src` returns
  nothing — `ObservationMap.tsx` (the only map component) uses raw
  `leaflet` via `import("leaflet")`, never the React bindings. Either
  remove the unused dependency or, if the intent was to eventually use the
  React API, that's a larger rewrite — not something to do silently as part
  of a cleanup line item.
- **`FishUploader.tsx` duplicates `api.ts`'s identify call and types, and
  they've already drifted.** `onDrop` (`FishUploader.tsx:66-69`) hand-rolls
  its own `fetch(...)` to `/api/v1/species/identify` instead of calling
  `api.species.identify(...)` from `src/lib/api.ts` — so it also skips
  `apiFetch`'s 401-refresh-retry logic entirely (an expired access token on
  this specific call fails outright instead of silently refreshing, unlike
  every other authenticated call in the app). It also redeclares its own
  local `PredictionDto`/`IdentifyFishResult` interfaces
  (`FishUploader.tsx:9-28`) rather than importing the ones already exported
  from `api.ts` — and they've already diverged: the local copy has five
  extra fields (`habitat`, `diet`, `maxSizeCm`, `description`, `funFact`)
  that `api.ts`'s `PredictionDto` doesn't declare. This is dotnet's "two
  competing sources that silently drift" finding (§3.1 there), just shaped
  as duplicate frontend types instead of duplicate schema sources.
  **Fix:** route `FishUploader.tsx` through `api.species.identify()` and
  import its types from `api.ts`, adding the extra fields to the shared
  `PredictionDto` there instead of a second local copy.
- **Two other call sites bypass `apiFetch` the same way, more narrowly:**
  `api.notifications.markRead` and `api.observations.delete`
  (`src/lib/api.ts:316-320`, `386-390`) use raw `fetch()` directly instead
  of `apiFetch()`, for no apparent reason tied to their behavior (both are
  simple authenticated calls). Same consequence as the `FishUploader` case,
  smaller scope: an expired access token makes "mark as read" or "delete
  observation" fail outright instead of silently refreshing and retrying
  like every other authenticated action in the app.

---

*Companion tracking: see `BACKLOG.md` for the checklist version of this
list.*
