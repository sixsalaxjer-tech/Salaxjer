# Deployment Instructions

Phase 1 has **no backend** (`APP_CONFIG.syncEnabled = false`, `apiBaseUrl` empty by default —
see spec section 7 "Backend และ Hosting Platform", still TO_CONFIRM for a production release).
The build output of `npm run build` is a fully static site (`dist/`) that can be hosted on any
static file host or CDN that serves HTTPS with correct MIME types for `.webmanifest` and service
worker files.

**This repository is currently wired up to deploy to GitHub Pages** (see below) as a convenient
way to get the app in front of the family for real-world testing. This is a pragmatic choice for
a small, free, zero-maintenance static host — it is not necessarily the final production
hosting decision, which remains one of the open `TO_CONFIRM` items in spec section 7 and should
be revisited by the team (e.g. once a Phase 3 backend exists). If you move to a different host,
the generic requirements below still apply; the GitHub-Pages-specific section covers what's
already configured and how to change it.

## GitHub Pages (configured)

The repo deploys automatically via `.github/workflows/deploy-pages.yml`: every push to `main`
runs lint + tests + build, then publishes `dist/` through GitHub's official
`actions/upload-pages-artifact` + `actions/deploy-pages` actions (Settings → Pages → Source:
"GitHub Actions").

Two things are specifically wired for GitHub Pages hosting under a repo subpath
(`https://<owner>.github.io/<repo>/`, not domain root):

1. **Vite `base`** — `vite.config.ts` sets `base` to `/Salaxjer/` (the repo name), so every
   built asset URL, the manifest's `start_url`/`scope`, and the service worker's
   `navigateFallback` are correctly prefixed. Override it for a different host by setting the
   `BASE_PATH` env var at build time (e.g. `BASE_PATH=/ npm run build` for a host serving from
   root), and update `.github/workflows/deploy-pages.yml` / repo settings to match if the repo
   is ever renamed.
2. **`HashRouter` instead of `BrowserRouter`** (`src/App.tsx`) — GitHub Pages is a static file
   host with no server-side rewrite rule, so a hard refresh or shared link on a deep route like
   `/Salaxjer/transactions` would 404 before the service worker ever gets a chance to intercept
   it. Hash-based routes (`/Salaxjer/#/transactions`) never leave the single `index.html` request,
   so they work with zero server configuration. If a future hosting move adds a proper SPA
   rewrite rule (see "Requirements for any static host" below), switching back to `BrowserRouter`
   for cleaner URLs is a one-line change in `src/App.tsx`.

**First-time setup on a new repo:** GitHub Pages must be switched to "Source: GitHub Actions"
once, either in Settings → Pages, or via `gh api -X POST repos/<owner>/<repo>/pages -f build_type=workflow`.
After that, every push to `main` (or a manual `gh workflow run deploy-pages.yml`) redeploys
automatically. The live URL is printed in the Actions run summary and in Settings → Pages.

## Requirements for any static host

The GitHub Pages setup above already satisfies all of these; they're listed here so the same
guarantees are re-checked if the app ever moves to a different host.

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
5. **SPA routing without a server-side rewrite:** a host with no rewrite rule (like GitHub Pages)
   needs client-side routing that never depends on the server resolving arbitrary paths — this
   repo uses `HashRouter` for exactly that reason (see above). A host that *does* support an SPA
   fallback rule (serving `index.html` for any unmatched path) can use `BrowserRouter` instead for
   cleaner URLs; `vite-plugin-pwa`'s `navigateFallback` is already configured to match whichever
   router is in use once the service worker is installed.

## Deployment steps (generic, non-GitHub-Pages hosts)

On GitHub Pages this happens automatically via the Actions workflow — nothing to run by hand.
For any other static host:

```bash
npm ci
BASE_PATH=/ npm run build   # or the subpath your host serves the app from
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
