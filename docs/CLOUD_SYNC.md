# Cloud Sync (Supabase) — Optional Phase 3-lite

By request, the app supports **live, cross-device sync** for a household on top of Supabase's
free tier — no cost, no credit card. This is layered on top of the original Phase 1 local-first
design, not a replacement for it: the app still works fully offline and still stores everything
in IndexedDB; Supabase is a sync target, not the only place data lives.

This is **optional**. With no Supabase project configured, the app behaves exactly like the
original local-only build (`APP_CONFIG.authMode` falls back to `'local_device_owner'`, no login
screen, no network calls beyond the app shell).

## Access model: admin-created accounts only, no public sign-up

Because the deployed site is public (GitHub Pages), and the intended audience is a small, known
household rather than an open user base, there is **no sign-up screen at all**. Every account is
created by an admin directly in the Supabase Dashboard (**Authentication → Users → Add user**) —
never through the app. Two settings in **Authentication → Providers → Email** must both be off:

- **"Allow new users to sign up"** — the real access control. With this off, nobody can create an
  account by any means (not through the app, and not by calling Supabase's signup API directly
  with the public anon key), no matter what UI does or doesn't exist client-side.
- **"Confirm email"** — must be off because login is username-based (see below), so there is no
  real inbox to receive a confirmation link.

Once an admin-created account exists, it either:

- **Creates** the household (the very first account ever), or
- **Joins** an existing household by invite code (any account created after that) — see "Adding
  a household member" below.

Either way, the app's existing Member concept (e.g. "พ่อ"/"แม่") still separately handles "who
paid for this expense" and is unrelated to login identity — you can share one login between two
people, or give each person their own, and the expense data model doesn't care either way.

## Why username, not email

Supabase Auth's API requires an email-shaped identifier, but this app only ever asks for a
username and password. A username like `dad` is turned into a syntactically-valid address like
`dad@users.<your-domain>` purely to satisfy the API shape
(`src/features/auth/syntheticEmail.ts`); that domain is never actually sent mail, and the exact
username typed at login only has to produce the same synthetic address as whatever the admin used
when creating the account in the Dashboard — it isn't validated against a specific person.
Override the domain via `VITE_AUTH_USERNAME_DOMAIN` if you redeploy this under a different domain.

## How sync works

```text
Device A                                          Device B
  |                                                   |
  | createExpense() -> Dexie (always, offline-safe)   |
  |        |                                          |
  |        +--> pushExpense() --> Supabase Postgres <--+ (RLS scoped to household_members)
  |                                      |
  |                              Realtime broadcast
  |                                      |
  |                                      v
  |                              subscribed clients --> upsert into Dexie --> useLiveQuery
  |                                                      re-renders automatically
```

- Every write still goes to Dexie first — the app is offline-first regardless of whether sync is
  configured (NFR-001 is unaffected).
- `src/infrastructure/sync/syncEngine.ts` pushes each write to Supabase in the background
  (best-effort; failures are logged and silently retried later via `catchUpPendingPushes`, never
  surfaced to the user as a save failure — the local write already succeeded).
- Supabase Realtime pushes other devices' changes back down into the *same* local Dexie tables
  the UI already reads via `dexie-react-hooks`' `useLiveQuery` — so no screen needed to change to
  support live updates.
- Conflict handling is last-write-wins by `version`/timestamp (same approach as backup **merge**
  mode) — adequate for a small trusted household, not a general-purpose CRDT.

## One-time setup

1. Create a free Supabase project (supabase.com — no card required).
2. Run `supabase/schema.sql` once in the Supabase SQL Editor. It creates the tables, Row Level
   Security policies, and two RPCs (`create_household_with_owner`, `join_household_by_invite_code`)
   used by the first-login setup screen.
3. Copy **Project Settings → API → Project URL** and the **anon / public** key (never the
   `service_role` key) into `.env.local`:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
4. In **Authentication → Providers → Email**, turn **off** both "Confirm email" and "Allow new
   users to sign up" (see "Access model" above).
5. In **Authentication → Users → Add user**, create the first account: email
   `<username>@<your VITE_AUTH_USERNAME_DOMAIN>` (e.g. `family@users.sixsalaxjer-tech.github.io`),
   a password of your choice, and tick **Auto Confirm User**.
6. `VITE_SYNC_ENABLED` defaults to `true` automatically once `VITE_SUPABASE_URL` is set — no need
   to set it explicitly.

For the deployed GitHub Pages build, add the same two variables as **repository secrets** and
reference them in `.github/workflows/deploy-pages.yml`'s build step (`env:` on the `npm run
build` step), since Vite inlines `VITE_*` variables at build time.

## First login

The very first account ever to log in sees `HouseholdSetupScreen` and picks "สร้างครอบครัวใหม่"
(create) — this calls `create_household_with_owner`, seeds the default categories, and mints a
6-character invite code (shown afterward in **Settings → ครอบครัว**). Once an account is linked to
a household (created or joined), every future login from any device goes straight to the app, and
whatever anyone enters appears on every other logged-in device automatically while online; while
offline, entries queue locally (`syncStatus`) and push once reconnected.

## Adding a household member

To give someone their own login that sees the same household's data:

1. Admin creates a new account for them in **Authentication → Users → Add user** (same as the
   first one — a synthetic email, a password, **Auto Confirm User** ticked).
2. Get the invite code from **Settings → ครอบครัว** (visible to anyone already logged into the
   household) and share it with that person by any channel — it's a join code, not a secret
   credential, since account creation is already locked down at the platform level.
3. They log in with the account the admin just created, see `HouseholdSetupScreen` (since their
   account isn't linked to a household yet), pick "เข้าร่วมด้วยรหัสเชิญ" (join), and enter the code.
   This calls `join_household_by_invite_code`, which links their account and pulls all existing
   data down before showing the rest of the app.

No further admin/SQL involvement is needed after step 1 — steps 2–3 are self-service once the
account exists.

## Security notes

- The **anon** key is safe to ship in frontend code — Row Level Security (`supabase/schema.sql`)
  is what actually enforces "you can only see this household's data," not the key itself.
- The **service_role** key must never be used in client code — it bypasses RLS entirely. Nothing
  in this app uses it.
- `create_household_with_owner` and `join_household_by_invite_code` are `SECURITY DEFINER`
  functions — the only place elevated privilege is used, and only to solve the chicken-and-egg
  problem of granting a brand-new account its first household membership.
- Real access control is "Allow new users to sign up" being off at the Supabase project level,
  not anything client-side — the app has no sign-up UI, but that alone would not stop someone
  from calling Supabase's signup API directly with the public anon key.

## Limits of this design (by choice, given the small-household scope)

- No audit trail inside the app for *which login* made a change — only the app's existing Member
  concept (payer attribution, e.g. "พ่อ"/"แม่") distinguishes people, which was already true before
  cloud sync existed and is independent of how many logins exist.
- Conflict resolution is last-write-wins, not field-level merge — acceptable because simultaneous
  edits to the *same* record are rare in practice for a small household, not because the
  underlying problem is solved in general (see spec FR-012 for the fuller design this stops short
  of).
- Attachments, audit-log viewing, and closed periods are not synced (same Phase 1/2 scope
  boundary as the rest of the app).
- To change a password, remove someone's access, or rotate the invite code, use the Supabase
  Dashboard directly — there is no in-app admin UI for account/membership management.
