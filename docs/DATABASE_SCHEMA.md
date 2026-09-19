# Local Database Schema

Implemented with [Dexie.js](https://dexie.org/) in `src/infrastructure/db/db.ts`. Dexie's
`.stores()` index-definition strings list only the **indexed** fields — every table also stores
all other fields declared on its TypeScript type (`src/domain/entities/types.ts`); Dexie is
schemaless beyond its indexes.

`SCHEMA_VERSION` (currently `1`) must match the highest `db.version(n)` block. See "Adding a
migration" below.

## Tables

### `households`
Primary key `householdId`. One row assumed per installed app instance (see spec section 6
assumption; the UI always uses the first/only household).

| Field | Type | Notes |
|---|---|---|
| householdId | string (UUID) | PK |
| name | string | |
| baseCurrency | string | One of `SUPPORTED_CURRENCIES` (`src/shared/constants/currency.ts`) |
| monthStartDay | number | 1–28, drives Dashboard/Settlement period boundaries |
| createdAt / updatedAt | ISO datetime | |
| version | number | Optimistic-concurrency counter, used by backup **merge** mode |

### `members`
Indexes: `memberId` (PK), `householdId`, `[householdId+status]`, `displayName`.

| Field | Type | Notes |
|---|---|---|
| memberId | string (UUID) | PK |
| householdId | string | |
| displayName | string | Unique per household, case-insensitive (enforced in `memberService`) |
| role | `'admin' \| 'member' \| 'viewer'` | |
| color | string (hex) | UI color chip |
| status | `'active' \| 'inactive'` | Never hard-deleted (FR-002) — deactivate only |
| createdAt / updatedAt | ISO datetime | |

### `categories`
Indexes: `categoryId` (PK), `householdId`, `[householdId+status]`, `name`.

Same soft-deactivation rule as `members`. Seeded with 8 Thai default categories on household
creation (`DEFAULT_CATEGORIES` in `categoryService.ts`) — fully editable afterwards.

### `expenses`
Indexes: `expenseId` (PK), `householdId`, `[householdId+expenseDate]`, `[householdId+status]`,
`categoryId`, `paidByMemberId`, `expenseType`, `status`, `syncStatus`, `idempotencyKey`,
`deletedAt`.

| Field | Type | Notes |
|---|---|---|
| expenseId | string (UUID) | PK, client-generated (BR-001) |
| householdId, expenseDate, amount, currency, categoryId, paidByMemberId | | |
| expenseType | `'personal' \| 'shared' \| 'advance' \| 'household' \| 'income' \| 'adjustment'` | Extends spec section 9's type list; `'transfer/settlement'` is modeled as its own `settlements` table instead |
| description, tags | string, string[] | `tags` searched via FR-009 |
| status | `'draft' \| 'active' \| 'voided'` | Voided = soft delete (BR-006); Dashboard/Settlement ignore non-`'active'` (BR-010) |
| syncStatus | `SyncStatus` | Always `'local_only'` while `APP_CONFIG.syncEnabled` is false (Phase 1) |
| clientUpdatedAt, serverUpdatedAt?, version | | `version` increments on every update (used by backup merge) |
| idempotencyKey | string (UUID) | One per create attempt — see ARCHITECTURE.md "Idempotency" |
| adjustmentReason? | string | Required when `expenseType === 'adjustment'` (BR-002) |

### `expenseAllocations`
Indexes: `allocationId` (PK), `expenseId`, `memberId`. **No `householdId` field** — scoped
through its parent `expenseId` (see backup's `collectData`, which joins through `expenses`).

| Field | Type | Notes |
|---|---|---|
| allocationId | string (UUID) | PK |
| expenseId, memberId | | |
| allocationType | `'equal' \| 'exact' \| 'percentage'` | |
| percentage? | number | Only set for `'percentage'` |
| allocatedAmount | number | Always reconciles to the expense's `amount` (BR-003) |

### `attachments`
Indexes: `attachmentId` (PK), `expenseId`. **Table exists in the schema for forward
compatibility but has no read/write UI in Phase 1** — attachments are scoped to Phase 2 per
spec section 28 and the Phase 1 implementation list.

### `settlements`
Indexes: `settlementId` (PK), `householdId`, `fromMemberId`, `toMemberId`, `settlementDate`,
`status`. Represents a confirmed repayment between two members (FR-007); never derived from
`expenses`.

### `auditLogs`
Indexes: `auditLogId` (PK), `householdId`, `entityType`, `entityId`, `timestamp`. Append-only;
written by every domain service call that creates/mutates a record (spec section 19). No UI
reads this table in Phase 1 beyond backup export — it exists so the trail is captured from day
one.

### `syncQueue`
Indexes: `queueId` (PK), `entityType`, `entityId`, `status`, `idempotencyKey`. Populated only
when `APP_CONFIG.syncEnabled` is `true` (never in Phase 1 — no backend exists yet). Structure
matches spec section 13.2 so Phase 3 can consume it without a schema change.

### `appMeta`
Simple key/value table (`key` PK), reserved for small app-level flags. Not yet used by any
feature — included so future settings don't need a schema migration.

### `restorePoints`
Indexes: `restorePointId` (PK), `createdAt`. Holds at most one JSON snapshot, written
automatically immediately before a backup **replace** or **merge** import (NFR-008).

## Backup scope

`exportBackup` / `importBackup` (`src/infrastructure/backup/backupService.ts`) cover:
`households`, `members`, `categories`, `expenses`, `expenseAllocations`, `settlements`,
`auditLogs`. `attachments` and `syncQueue` are intentionally excluded — the former has no data
in Phase 1, the latter is transient runtime state, not user data.

## Adding a migration

1. Add a new `this.version(N).stores({ ...all tables, changed or new ones })` block in
   `AppDatabase`'s constructor, **after** the existing version blocks (never edit an existing
   `version()` block once it has shipped).
2. If existing rows need transforming, chain `.upgrade(tx => { ... })` on that version block.
3. Bump `SCHEMA_VERSION` to `N`.
4. If old backup files should remain importable, keep `MIN_SUPPORTED_SCHEMA_VERSION` in
   `backupService.ts` unchanged (or raise it deliberately, documenting why old backups are no
   longer accepted).

Dexie only replays `.upgrade()` for versions newer than what's already on the user's device, so
existing local data survives a version bump automatically (NFR-008).
