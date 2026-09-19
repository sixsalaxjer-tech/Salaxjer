# Family Expense PWA

Offline-first Progressive Web App for tracking family expenses, built from
[`family-expense-pwa-offline-spec.md`](./family-expense-pwa-offline-spec.md). This repository
implements **Phase 1 — Local Offline MVP** (spec section 28): everything works fully offline,
with no backend required.

Thai is the default UI language; code, identifiers, and documentation are in English.

## Feature scope (Phase 1)

- Household setup (name, base currency, month-start day) — FR-001
- Member management with soft-deactivation — FR-002
- Expense categories with soft-deactivation
- Personal, Shared, Advance, Household, Income, and Adjustment expenses — FR-003
- Equal / Exact-amount / Percentage allocation with automatic rounding reconciliation — FR-004, BR-003, BR-011
- Dashboard: monthly total, month-over-month delta, category/member breakdown, recent activity — FR-006
- Transaction history with search, filter, edit, duplicate, and void — FR-009
- Settlement: net balances, minimized suggested transfers, recorded repayments — FR-007
- Backup & restore: JSON export/import, optional password encryption, Validate/Replace/Merge modes — FR-010
- Offline indicator and per-record sync status badges — NFR-001, NFR-010
- Local IndexedDB schema with a documented migration path — see [`docs/DATABASE_SCHEMA.md`](./docs/DATABASE_SCHEMA.md)

Attachments, closed periods, audit-log UI, multi-device sync, and OCR are intentionally out of
scope here — they belong to Phases 2–4 of the spec (section 28) and to the `TO_CONFIRM` items in
section 7, which are represented as explicit configuration in [`src/shared/constants/config.ts`](./src/shared/constants/config.ts)
rather than guessed at.

## Tech stack

| Layer | Choice |
|---|---|
| UI | React 18 + TypeScript, React Router |
| Build | Vite |
| Local database | IndexedDB via [Dexie.js](https://dexie.org/) (+ `dexie-react-hooks` for live queries) |
| PWA / offline | `vite-plugin-pwa` (Workbox) — app-shell caching + install manifest |
| Validation | Hand-written domain rules (`src/domain/rules`) — no schema library needed for the small surface area involved |
| Testing | Vitest + Testing Library + `fake-indexeddb` |

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the layer breakdown and rationale.

## Getting started

```bash
npm install
cp .env.example .env.local   # optional — see "Configuration" below
npm run dev
```

Full instructions: [`docs/DEVELOPMENT.md`](./docs/DEVELOPMENT.md).

## Configuration

Every open decision from spec section 7 ("To Be Confirmed") is wired through environment
variables with an MVP-safe default — see `.env.example` and `src/shared/constants/config.ts`.
Nothing is hardcoded: there are no secrets, API keys, or production endpoints in this repository.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check (`tsc -b`) then production build (`vite build`) |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint |
| `npm run test` | Run the test suite once (Vitest) |
| `npm run test:watch` | Run tests in watch mode |

Build: [`docs/BUILD.md`](./docs/BUILD.md) · Tests: [`docs/TEST.md`](./docs/TEST.md) · Deployment: [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)

## Documentation index

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — layers, data flow, offline strategy
- [`docs/DATABASE_SCHEMA.md`](./docs/DATABASE_SCHEMA.md) — Dexie tables, indexes, migration process
- [`docs/DEVELOPMENT.md`](./docs/DEVELOPMENT.md) — local setup
- [`docs/BUILD.md`](./docs/BUILD.md) — production build
- [`docs/TEST.md`](./docs/TEST.md) — running and extending the test suite
- [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) — hosting a static PWA build
