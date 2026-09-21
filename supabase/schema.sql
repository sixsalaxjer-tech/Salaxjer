-- Family Expense PWA — Supabase schema for online multi-user sync (Phase 3-lite).
-- Run this once in the Supabase Dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run: every statement is idempotent (create-if-not-exists / drop-if-exists).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_currency text not null,
  month_start_day int not null default 1,
  invite_code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1
);

-- Maps an auth.users account to the household(s) it can see. RLS on every other
-- table is expressed in terms of this table, so a user only ever sees their own
-- household's data.
create table if not exists household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- "members" here means the app's family-member labels (e.g. "พ่อ", "แม่"), which
-- may or may not correspond 1:1 with an auth.users login.
create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  display_name text not null,
  role text not null default 'member',
  color text not null default '#0f766e',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  icon text not null default '📦',
  color text not null default '#64748b',
  is_default boolean not null default false,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  expense_date date not null,
  amount numeric(14, 2) not null,
  currency text not null,
  category_id uuid not null references categories(id),
  paid_by_member_id uuid not null references members(id),
  expense_type text not null,
  description text not null default '',
  tags text[] not null default '{}',
  status text not null default 'active',
  client_updated_at timestamptz not null default now(),
  version int not null default 1,
  deleted_at timestamptz,
  idempotency_key text not null unique,
  adjustment_reason text
);

create table if not exists expense_allocations (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references expenses(id) on delete cascade,
  member_id uuid not null references members(id),
  allocation_type text not null,
  percentage numeric(6, 2),
  allocated_amount numeric(14, 2) not null
);

create table if not exists settlements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  from_member_id uuid not null references members(id),
  to_member_id uuid not null references members(id),
  amount numeric(14, 2) not null,
  settlement_date date not null,
  status text not null default 'confirmed',
  proof_attachment_id uuid,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per household+week the household has marked as cleared/settled from the weekly
-- text-share card — a lightweight reconciliation flag, distinct from the per-member debt
-- transfers in `settlements`. Never hard-deleted; a mistaken clear is undone by setting
-- status = 'voided' (see week_settlement_id usage in weekSettlementService.ts).
create table if not exists week_settlements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  total numeric(14, 2) not null,
  status text not null default 'cleared',
  cleared_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  actor_member_id uuid,
  timestamp timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- Row Level Security — a user may only touch rows belonging to a household
-- they are a member of (via household_members).
-- ---------------------------------------------------------------------------

-- A policy ON household_members cannot query household_members again in its own
-- USING clause — Postgres re-applies that same policy to the subquery, which re-runs
-- the subquery, forever ("infinite recursion detected in policy for relation
-- household_members"). A SECURITY DEFINER function breaks the loop: it runs with the
-- function owner's privilege, so its internal lookup bypasses RLS instead of re-entering it.
create or replace function is_household_member(p_household_id uuid) returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from household_members
    where household_id = p_household_id and user_id = auth.uid()
  );
$$;

alter table households enable row level security;
alter table household_members enable row level security;
alter table members enable row level security;
alter table categories enable row level security;
alter table expenses enable row level security;
alter table expense_allocations enable row level security;
alter table settlements enable row level security;
alter table week_settlements enable row level security;
alter table audit_logs enable row level security;

drop policy if exists household_select on households;
create policy household_select on households for select
  using (id in (select household_id from household_members where user_id = auth.uid()));

drop policy if exists household_update on households;
create policy household_update on households for update
  using (id in (select household_id from household_members where user_id = auth.uid()));

-- The client updates a household via `.upsert()`, which Postgres implements as
-- INSERT ... ON CONFLICT DO UPDATE. That statement needs INSERT privilege to even attempt the
-- insert half, even though every real-world call is actually just updating a row the caller
-- already owns (creating a brand-new household still only ever happens through the
-- create_household_with_owner RPC, which bypasses RLS entirely) - so this policy only allows
-- the insert branch when a household_members row for that id already exists, never a genuinely
-- new household id.
drop policy if exists household_insert on households;
create policy household_insert on households for insert
  with check (id in (select household_id from household_members where user_id = auth.uid()));

drop policy if exists household_members_select on household_members;
create policy household_members_select on household_members for select
  using (is_household_member(household_id));

drop policy if exists members_all on members;
create policy members_all on members for all
  using (household_id in (select household_id from household_members where user_id = auth.uid()))
  with check (household_id in (select household_id from household_members where user_id = auth.uid()));

drop policy if exists categories_all on categories;
create policy categories_all on categories for all
  using (household_id in (select household_id from household_members where user_id = auth.uid()))
  with check (household_id in (select household_id from household_members where user_id = auth.uid()));

drop policy if exists expenses_all on expenses;
create policy expenses_all on expenses for all
  using (household_id in (select household_id from household_members where user_id = auth.uid()))
  with check (household_id in (select household_id from household_members where user_id = auth.uid()));

drop policy if exists expense_allocations_all on expense_allocations;
create policy expense_allocations_all on expense_allocations for all
  using (expense_id in (
    select id from expenses where household_id in (
      select household_id from household_members where user_id = auth.uid()
    )
  ))
  with check (expense_id in (
    select id from expenses where household_id in (
      select household_id from household_members where user_id = auth.uid()
    )
  ));

drop policy if exists settlements_all on settlements;
create policy settlements_all on settlements for all
  using (household_id in (select household_id from household_members where user_id = auth.uid()))
  with check (household_id in (select household_id from household_members where user_id = auth.uid()));

drop policy if exists week_settlements_all on week_settlements;
create policy week_settlements_all on week_settlements for all
  using (household_id in (select household_id from household_members where user_id = auth.uid()))
  with check (household_id in (select household_id from household_members where user_id = auth.uid()));

drop policy if exists audit_logs_all on audit_logs;
create policy audit_logs_all on audit_logs for all
  using (household_id in (select household_id from household_members where user_id = auth.uid()))
  with check (household_id in (select household_id from household_members where user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- RPC functions — these run with the definer's elevated privilege so a brand
-- new user can create or join a household without an RLS chicken-and-egg
-- problem (you can't be a household_member yet, so a plain insert would be
-- blocked by the policies above).
-- ---------------------------------------------------------------------------

create or replace function create_household_with_owner(
  p_name text,
  p_base_currency text,
  p_month_start_day int
) returns households
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household households;
  v_code text;
begin
  v_code := upper(substr(md5(gen_random_uuid()::text), 1, 6));
  insert into households (name, base_currency, month_start_day, invite_code)
  values (p_name, p_base_currency, p_month_start_day, v_code)
  returning * into v_household;

  insert into household_members (household_id, user_id, role)
  values (v_household.id, auth.uid(), 'owner');

  return v_household;
end;
$$;

create or replace function join_household_by_invite_code(
  p_invite_code text
) returns households
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household households;
begin
  select * into v_household from households where invite_code = upper(p_invite_code);
  if v_household.id is null then
    raise exception 'INVALID_INVITE_CODE';
  end if;

  insert into household_members (household_id, user_id, role)
  values (v_household.id, auth.uid(), 'member')
  on conflict (household_id, user_id) do nothing;

  return v_household;
end;
$$;

-- ---------------------------------------------------------------------------
-- Realtime — broadcast row changes to subscribed clients so a second device
-- sees new/updated data live. Wrapped so re-running this script never errors
-- with "relation is already member of publication".
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['households', 'members', 'categories', 'expenses', 'expense_allocations', 'settlements', 'week_settlements']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end;
$$;
