# Development Setup

## Prerequisites

- Node.js 20+ (developed and verified against Node 24)
- npm 10+

## Install

```bash
npm install
```

## Configure (optional)

Copy `.env.example` to `.env.local` and adjust any `TO_CONFIRM` value (app name, default
currency, member limit, etc.) — see `src/shared/constants/config.ts` for how each variable is
consumed. All settings have safe MVP defaults, so this step can be skipped for local
development.

## Run

```bash
npm run dev
```

Opens on `http://localhost:5173`. The dev server does not register the service worker
(`devOptions.enabled: false` in `vite.config.ts`) so edits hot-reload normally; test the actual
offline/PWA behavior against a production build instead (see `docs/BUILD.md`).

## Project structure

See `docs/ARCHITECTURE.md` for the full layer breakdown. In short:

- Add a new screen under `src/features/<feature>/`.
- Add new business rules (pure functions) under `src/domain/rules/`.
- Add new persistence/orchestration under `src/domain/services/` — this is the only layer that
  should call `db.transaction(...)`.
- Add new Dexie tables/fields in `src/infrastructure/db/db.ts` following the migration pattern
  documented in `docs/DATABASE_SCHEMA.md`.

## Editor setup

Any editor with TypeScript language server support works. Recommended: enable "Format on Save"
with the repository's own formatting (no Prettier config is included — keep consistent with
surrounding code). ESLint (`npm run lint`) is the source of truth for style/correctness lint
rules.

## Common tasks

| Task | Command |
|---|---|
| Type-check + build | `npm run build` |
| Lint | `npm run lint` |
| Run tests once | `npm run test` |
| Run tests in watch mode | `npm run test:watch` |
| Preview a production build | `npm run build && npm run preview` |

## Resetting local data while developing

The app's IndexedDB database is named `FamilyExpensePWA`. To reset it during development, open
DevTools → Application → IndexedDB → delete the database, then reload. There is no CLI reset
script — this is a deliberate reflection of the app being local-first and per-browser-profile.
