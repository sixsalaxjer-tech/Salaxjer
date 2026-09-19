# Build Instructions

## Production build

```bash
npm run build
```

This runs `tsc -b` (type-check, no emit) followed by `vite build`. Output goes to `dist/`:

- `dist/index.html`, `dist/assets/*` — the app shell and bundled JS/CSS
- `dist/manifest.webmanifest` — PWA manifest (generated from `vite.config.ts`)
- `dist/sw.js`, `dist/workbox-*.js` — the generated service worker and its Workbox runtime

The build fails the whole command if type-checking fails — there is no "build with type errors"
escape hatch, by design.

## Preview the production build locally

```bash
npm run build
npm run preview
```

`vite preview` serves `dist/` on `http://localhost:4173` with the service worker active, so this
is the right way to manually verify offline behavior (see `docs/TEST.md` for the manual offline
checklist) — the dev server intentionally does not register a service worker.

## Environment variables at build time

Vite inlines `VITE_*` environment variables at build time. If you need a build with non-default
configuration (e.g. a different default currency for a specific deployment), create a
`.env.production.local` (or pass the variables through your CI environment) before running
`npm run build` — see `.env.example` for the full list.

## Icons

The PWA icons under `public/icons/*.svg` are placeholder vector icons (a simple ฿ mark on a
teal background). Replace them with real artwork before a public release — `vite-plugin-pwa`
will pick up new files automatically as long as the paths/sizes in `vite.config.ts`'s
`manifest.icons` stay in sync.

## Source maps

`build.sourcemap: true` is set in `vite.config.ts` so production stack traces are debuggable.
Source maps are emitted alongside the JS/CSS in `dist/assets/` — strip them from your deployment
target if you don't want them publicly served.
