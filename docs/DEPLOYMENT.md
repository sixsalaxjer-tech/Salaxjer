# Deployment Instructions

Phase 1 has **no backend** (`APP_CONFIG.syncEnabled = false`, `apiBaseUrl` empty by default —
see spec section 7 "Backend และ Hosting Platform", still TO_CONFIRM). The build output of
`npm run build` is a fully static site (`dist/`) that can be hosted on any static file host or
CDN that serves HTTPS with correct MIME types for `.webmanifest` and service worker files.

This document intentionally does not name a specific hosting provider — that choice is one of
the open `TO_CONFIRM` items in the spec (section 7) and should be made by the team, not assumed.
Whatever host is chosen, the requirements below are non-negotiable for a PWA.

## Requirements for any static host

1. **HTTPS is mandatory.** Service workers only register on secure origins (or `localhost`).
   Spec section 18 requires HTTPS for all network communication.
2. **Correct MIME types:**
   - `dist/manifest.webmanifest` → `application/manifest+json` (most hosts infer this from the
     `.webmanifest` extension; verify if using a custom server)
   - `dist/sw.js` → `application/javascript` / `text/javascript`
3. **`sw.js` must be served from the site root** (or whatever `scope`/`start_url` is configured
   in `vite.config.ts`'s `VitePWA({ manifest: { scope, start_url } })`) — do not put it behind a
   path-rewriting rule that changes its response headers or caching.
4. **Do not aggressively cache `index.html` or `sw.js` at the CDN edge.** The service worker's
   own versioning (via Workbox precache manifests) handles cache-busting for everything else;
   `index.html` and `sw.js` should be revalidated frequently (e.g. `Cache-Control: no-cache`) so
   users pick up new deployments in a reasonable time.
5. **SPA fallback routing:** all paths (e.g. `/transactions`, `/settlement`) must serve
   `index.html` (client-side routing via `react-router-dom`). `vite-plugin-pwa`'s
   `navigateFallback: '/index.html'` handles this for the service worker's own routing once
   installed, but the *first, uncached* load of a deep link still depends on the host's rewrite
   rules doing the same.

## Deployment steps (generic)

```bash
npm ci
npm run build
# upload the contents of dist/ to your static host, preserving the flat structure
```

If your host needs an explicit SPA rewrite rule, add one that serves `dist/index.html` for any
path that doesn't match a real file in `dist/`.

## Environment configuration at deploy time

Set any `VITE_*` variables from `.env.example` in the CI/build environment before running
`npm run build` — Vite inlines them at build time, so they must be present during the build
step, not just at runtime. See `docs/BUILD.md`.

## Rollback

Because the app is fully static and offline-first, "rollback" means redeploying the previous
`dist/` build artifact to the host. Because clients hold a service-worker-cached previous
version until they explicitly accept an update (`registerType: 'prompt'`), a bad deploy does not
immediately break already-installed users — they will see the "มีเวอร์ชันใหม่ของแอป" prompt for the
*new* (bad) version only after it is live, and will not be forced onto it. Roll back the hosted
`dist/` promptly if a deployed version is broken, and consider bumping the app's cache-busting
(a fresh `vite build` naturally fingerprints filenames) once the fix is ready.

## Data migration on deploy

Local data lives entirely in each user's browser (IndexedDB) — a deployment never touches user
data directly. If a release includes a Dexie schema migration (see
`docs/DATABASE_SCHEMA.md#adding-a-migration`), it runs automatically, client-side, the next time
each user opens the updated app. There is nothing to run server-side.
