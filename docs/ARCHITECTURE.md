# Architecture

## Layering

The source tree follows the layering suggested by spec section 24, with a Dexie-specific
`infrastructure` layer added for storage/backup concerns:

```text
src/
  app/            React app shell: router, layout, providers (Household, Toast), PWA update prompt
  components/     Presentational UI kit (buttons, fields, dialogs, charts) — no business logic
  domain/
    entities/     TypeScript types for every logical entity in spec section 13.2
    rules/        Pure functions: allocation math, settlement math, duplicate detection
    services/     Orchestration: validation + Dexie transactions + audit logging
  features/       Screens, grouped by spec section 15 (dashboard, expenses, settlements, settings, onboarding)
  infrastructure/
    db/           Dexie schema, storage-quota monitor
    backup/       Export/import, checksum, optional password encryption
    logging/      Masked technical logger (spec section 19)
  shared/         Config, currency/date/money formatting, cross-cutting types, hooks
  tests/          Vitest suite, mirrors the domain/infrastructure layout
```

**Dependency direction:** `features` → `domain/services` → `domain/rules` + `infrastructure`.
`domain/rules` never imports Dexie or React — every allocation/settlement/duplicate rule is a
pure, independently testable function. `domain/services` is the only layer allowed to open a
Dexie transaction, so every multi-table write goes through one reviewable choke point.

## Offline-first data flow

```text
User → React component → domain/services/* → db.transaction(...) → IndexedDB (Dexie)
                                                      ↓
                                          dexie-react-hooks useLiveQuery
                                                      ↓
                                          React re-renders automatically
```

There is no separate client-side cache or global store for domain data: Dexie *is* the store.
`useLiveQuery` (via `HouseholdProvider` and individual screens) subscribes directly to IndexedDB
changes, so a write in one place (e.g. adding an expense) is reflected everywhere else in the UI
without manual invalidation. This satisfies NFR-004 (Dashboard reconciles with Detail) by
construction — both read from the same queries over the same tables.

## Transactional writes (NFR-003)

Every write that must be atomic (expense + allocations + audit log + sync-queue entry; backup
restore across seven tables) runs inside a single `db.transaction('rw', [...tables], async () => {...})`
block. Dexie aborts and rolls back the entire transaction if any step throws — see
`createExpense` in `src/domain/services/expenseService.ts` and `importBackup` in
`src/infrastructure/backup/backupService.ts`. This is verified by
`src/tests/domain/expenseService.test.ts` ("rolls back the whole transaction when allocation is
unbalanced").

## Service worker strategy (spec 14.2)

Configured in `vite.config.ts` via `vite-plugin-pwa`:

| Resource | Strategy | Why |
|---|---|---|
| App shell (build output) | Precache, Cache First | Instant offline load after first visit (NFR-002) |
| Runtime static assets (fonts/images) | Stale While Revalidate | Fast repeat loads, still self-heals |
| All domain data | Never touches the Service Worker cache — IndexedDB only | The SW never intercepts app data; Dexie is the single source of truth |

`registerType: 'prompt'` means a new app version never force-reloads a user mid-entry — the
`UpdatePrompt` component surfaces "มีเวอร์ชันใหม่ของแอป" (new version available) and only updates on
explicit tap, addressing the "Offline Cache เก่า" risk in spec section 27.

## Idempotency and duplicate protection

- **Idempotency (BR-009, VAL-012):** every expense-create call carries a client-generated
  `idempotencyKey` (a UUID minted once per form-submission attempt). `createExpense` checks for
  an existing row with that key *inside* the transaction before inserting — a retried tap (e.g.
  after a slow write) returns the already-created record instead of duplicating it.
- **Duplicate warning (spec section 17):** `findDuplicateCandidates` looks for other active
  expenses with the same household, date, amount, payer, and category, with a "close enough"
  description. This is a *soft* warning shown via `ConfirmDialog` before save — it never blocks
  automatically, per spec.

## Rounding and money (BR-011)

All allocation math is done in integer minor units (e.g. satang, cents) via
`toMinorUnits`/`fromMinorUnits` (`src/shared/formatting/money.ts`), which are currency-decimal
aware (JPY = 0 decimals, THB/USD/EUR/SGD = 2). Equal and percentage splits distribute the
rounding remainder deterministically so the allocated total always equals the expense amount
exactly — see `src/domain/rules/allocation.ts` and its tests.

## Backup format and safety (FR-010, section 23)

A backup file is JSON with `schemaVersion`, `exportTimestamp`, a SHA-256 `checksum` of its
content, and either a plaintext `data` object or (if a password was supplied) an AES-GCM
`cipher` payload. Import always:

1. Parses and validates shape, schema version, and checksum *before* touching the database
   (`parseAndValidateBackup`).
2. Snapshots the current data into a one-slot `restorePoints` table before a `replace` or `merge`
   write, so a bad restore can be manually recovered from.
3. Runs the actual write inside one Dexie transaction, so a failure partway through never leaves
   a half-restored household.

See [`DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md) for the exact table list included in a backup.

## Configuration over hardcoding

Every open item from spec section 7 ("To Be Confirmed") is a named field in
`src/shared/constants/config.ts`, sourced from `import.meta.env.VITE_*` with an MVP-safe
default and a comment pointing back to the spec item. No API endpoint, credential, or
production setting is hardcoded anywhere in the source tree.
