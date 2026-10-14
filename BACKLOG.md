# OMyFish Frontend — Backlog

Deferred ideas and future work. Not committed scope — parking lot for things worth doing.

---

## [ ] A — Weakness audit follow-up (ported from omyfish-dotnet)

**Status:** OPEN (audit added 2026-09-24, nothing fixed yet). `omyfish-dotnet`
went through a senior-dev-style weakness audit and asked for the same
treatment across the rest of the family — already ported and largely
*fixed* in `omyfish-java`, `omyfish-python-web`, `omyfish-ai`, and
`omyfish-python`. This is the fifth and last sibling. Full explanation in
`docs/WEAKNESS_AUDIT.md` — this entry is the checklist version. Unlike the
other four repos' backlog entries, nothing below is done yet — this pass
was audit-only.

**Security:**
- [x] Refresh token in `localStorage` — already fixed before this audit
      (httpOnly cookie, `credentials: "include"`). (§1.3, frontend half)
- [ ] Access token still in `localStorage` instead of memory-only — smaller
      blast radius than the original bug, same exposure class. (§1.3)
- [x] Container runs as root — already fixed (`USER nextjs` in `Dockerfile`). (§1.4)
- [ ] No client-side upload cooldown on the identify flow (real fix is
      server-side rate limiting, already tracked per-backend; this is just
      the same cheap mitigation the `omyfish-ai` Streamlit sibling added). (§1.2)
- [ ] No security headers (CSP, `X-Frame-Options`, etc.) in `next.config.ts`.
- [ ] §1.1 (gateway auth) — not applicable, no gateway in this repo.

**Resilience:**
- [ ] No timeout on `apiFetch`'s `fetch()` calls — a slow backend hangs the
      UI indefinitely. (§2.1)
- [ ] No `error.tsx` — a render-time exception falls through to Next.js's
      default error UI instead of a friendly page. (§2.2)
- [ ] §2.3/§2.4 (outbox/idempotency) — not applicable, no broker/consumers here.

**Testing/CI:**
- [ ] Test coverage is almost entirely in `src/lib/api.test.ts` (401/refresh
      logic only) — `AuthContext`, `biteScore.ts`, and every page/component
      are untested.
- [ ] CI never runs `npm run lint`, despite the script already existing.
- [ ] No dependency/security scanning in CI (same gap as every sibling).

**Cleanup:**
- [ ] `react-leaflet` is an unused dependency (`leaflet` is used directly instead).
- [ ] `FishUploader.tsx` hand-rolls its own identify `fetch()` + duplicate
      `PredictionDto`/`IdentifyFishResult` types instead of using
      `api.ts` — the two type definitions have already drifted (5 extra
      fields on the local copy). Also means this one call skips the
      401-refresh-retry logic every other call gets.
- [ ] `notifications.markRead` and `observations.delete` in `api.ts` use raw
      `fetch()` instead of `apiFetch()`, same 401-retry gap, smaller scope.

**Not applicable, confirmed during the audit (no fix needed):**
- Data layer section (§3) — no DB/migrations/ORM in this repo.
- Outbox pattern / consumer idempotency (§2.3/§2.4) — no broker.
- Gateway auth enforcement (§1.1) — no gateway.
