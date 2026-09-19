# Test Instructions

## Automated tests

```bash
npm run test          # run once (CI mode)
npm run test:watch    # watch mode for local development
```

Runs on [Vitest](https://vitest.dev/) with a `jsdom` environment and
[`fake-indexeddb`](https://github.com/dumbmatter/fakeIndexedDB) providing a real IndexedDB
implementation in Node, so Dexie code under test behaves exactly as it would in a browser — no
mocking of the database layer.

### Suite layout (`src/tests/`)

| File | Covers |
|---|---|
| `domain/allocation.test.ts` | Equal/Exact/Percentage allocation math, rounding reconciliation (BR-003, BR-011), imbalance rejection (VAL-005/006) |
| `domain/settlement.test.ts` | Net balance calculation, BR-010 (drafts/voided excluded), settlement reduces balance, suggested-transfer minimization |
| `domain/duplicate.test.ts` | Duplicate-candidate detection rules from spec section 17 |
| `domain/expenseService.test.ts` | Transactional create, idempotency (VAL-012/BR-009), rollback-on-imbalance (NFR-003), BR-002 positive-amount rule |
| `infrastructure/backup.test.ts` | Export/import round-trip, checksum tamper detection (VAL-011), malformed-JSON safety, schema-version rejection, replace-mode restore + restore-point creation, password encryption |

Each Dexie-backed test file clears all tables in a `beforeEach` since the database is a
module-level singleton shared across tests in the same file.

### Writing a new test

- Pure business rules (anything in `src/domain/rules/`) should be tested with plain function
  calls — no Dexie needed.
- Anything touching `src/domain/services/` or `src/infrastructure/backup/` needs the `db`
  singleton from `src/infrastructure/db/db.ts`; clear tables in `beforeEach` and seed only the
  rows your test needs.
- Assert on user-facing behavior (`AppError.userMessage` / `.code`), not incidental
  implementation details.

## Manual test checklist (offline / PWA)

Automated tests cover calculation and persistence logic; the following require a real browser
and are not automated (per the instructions, this is stated explicitly rather than claimed as
covered):

1. `npm run build && npm run preview`, open in Chrome.
2. Confirm the app installs (address-bar install icon / "Add to Home Screen").
3. In DevTools → Network, set "Offline", then reload — the app shell must still load (UAT-001).
4. While offline: create a household (first run only), add a member, add a Shared expense,
   confirm the Dashboard and Settlement screens update (UAT-002/003).
5. While offline: export a backup, clear site data, reopen, restore the backup, confirm data and
   relationships return intact (UAT-010).
6. Import a corrupted/edited JSON file and confirm the app rejects it without altering existing
   data (UAT-011).
7. Force-quit the browser tab mid-save (e.g. close immediately after tapping "บันทึก") and reopen
   — there should be no half-created expense (NFR-003).

## Type-checking as a test gate

`npm run build` runs `tsc -b` before bundling — treat a type error as a failing test. CI should
run `npm run test`, `npm run lint`, and `npm run build` as three independent required checks.
