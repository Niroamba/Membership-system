-- ============================================================================
-- Membership Management System — Supabase schema
-- Run this once in Supabase → SQL Editor → New Query → paste all → Run.
-- Safe to re-run: uses "if not exists" / "or replace" where possible.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------

create table if not exists public.members (
  id            bigserial primary key,
  member_code   text unique not null,
  name          text not null,
  phone_number  text,
  address       text,
  remarks       text,
  joined_date   date,
  created_at    timestamptz not null default now()
);

create table if not exists public.categories (
  name            text primary key,
  default_amount  numeric
);
insert into public.categories (name, default_amount)
  values ('Membership Fee', null)
  on conflict (name) do nothing;

create table if not exists public.category_year_amounts (
  name    text references public.categories(name) on delete cascade,
  year    int not null,
  amount  numeric not null,
  primary key (name, year)
);

create table if not exists public.charges (
  id            bigserial primary key,
  member_id     bigint not null references public.members(id) on delete cascade,
  description   text not null,
  year          int,
  total_amount  numeric not null,
  created_at    timestamptz not null default now()
);

create table if not exists public.payments (
  id                bigserial primary key,
  charge_id         bigint not null references public.charges(id) on delete cascade,
  installment_no    int not null,
  amount            numeric not null,
  paid_date         date not null,
  receipt_book_no   text,
  receipt_no        text,
  created_at        timestamptz not null default now()
);

create table if not exists public.news (
  id          bigserial primary key,
  title       text not null,
  content     text not null,
  posted_by   text,
  posted_on   timestamptz not null default now()
);

create table if not exists public.removed_members (
  id             bigserial primary key,
  member_code    text,
  name           text,
  phone_number   text,
  reason         text,
  removed_on     timestamptz not null default now(),
  removed_by     text
);

create table if not exists public.app_settings (
  key    text primary key,
  value  text
);
insert into public.app_settings (key, value) values ('society_name', 'My Society')
  on conflict (key) do nothing;

-- profiles: one row per Supabase Auth user, linking them to a role and
-- (for members) to a row in public.members.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null check (role in ('admin', 'viewer', 'member')),
  member_id   bigint references public.members(id) on delete set null,
  username    text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helper functions (used inside RLS policies below)
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_admin_or_viewer()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role in ('admin', 'viewer')
  );
$$;

create or replace function public.is_viewer()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'viewer'
  );
$$;

create or replace function public.my_member_id()
returns bigint language sql stable security definer as $$
  select member_id from public.profiles where id = auth.uid();
$$;

-- Auto-create a profile row whenever someone signs up.
-- The very first person ever to sign up becomes the first admin;
-- everyone after that defaults to 'member' (admins promote them later
-- from Settings, or the row is claimed as a member portal account by an
-- edge function).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, role)
  values (
    new.id,
    case when (select count(*) from public.profiles) = 0 then 'admin' else 'member' end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.members enable row level security;
alter table public.categories enable row level security;
alter table public.category_year_amounts enable row level security;
alter table public.charges enable row level security;
alter table public.payments enable row level security;
alter table public.news enable row level security;
alter table public.removed_members enable row level security;
alter table public.app_settings enable row level security;
alter table public.profiles enable row level security;

-- members: admin full access; viewer can read everything but not write;
-- a member can read only their own row
drop policy if exists "members_admin_all" on public.members;
create policy "members_admin_all" on public.members
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "members_viewer_select" on public.members;
create policy "members_viewer_select" on public.members
  for select using (public.is_admin_or_viewer());

drop policy if exists "members_self_select" on public.members;
create policy "members_self_select" on public.members
  for select using (id = public.my_member_id());

-- categories / category_year_amounts: admin writes; admin+viewer can read
drop policy if exists "categories_admin_all" on public.categories;
create policy "categories_admin_all" on public.categories
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "categories_viewer_select" on public.categories;
create policy "categories_viewer_select" on public.categories
  for select using (public.is_admin_or_viewer());

drop policy if exists "category_years_admin_all" on public.category_year_amounts;
create policy "category_years_admin_all" on public.category_year_amounts
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "category_years_viewer_select" on public.category_year_amounts;
create policy "category_years_viewer_select" on public.category_year_amounts
  for select using (public.is_admin_or_viewer());

-- charges: admin full access; viewer read-only; member can read only their own
drop policy if exists "charges_admin_all" on public.charges;
create policy "charges_admin_all" on public.charges
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "charges_viewer_select" on public.charges;
create policy "charges_viewer_select" on public.charges
  for select using (public.is_admin_or_viewer());

drop policy if exists "charges_self_select" on public.charges;
create policy "charges_self_select" on public.charges
  for select using (member_id = public.my_member_id());

-- payments: admin full access; viewer read-only; member reads only their own
drop policy if exists "payments_admin_all" on public.payments;
create policy "payments_admin_all" on public.payments
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "payments_viewer_select" on public.payments;
create policy "payments_viewer_select" on public.payments
  for select using (public.is_admin_or_viewer());

drop policy if exists "payments_self_select" on public.payments;
create policy "payments_self_select" on public.payments
  for select using (
    charge_id in (select id from public.charges where member_id = public.my_member_id())
  );

-- news: admin full access; any signed-in user (admin, viewer, or member) can read
drop policy if exists "news_admin_all" on public.news;
create policy "news_admin_all" on public.news
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "news_authenticated_select" on public.news;
create policy "news_authenticated_select" on public.news
  for select using (auth.role() = 'authenticated');

-- removed_members: admin full access; viewer read-only
drop policy if exists "removed_admin_all" on public.removed_members;
create policy "removed_admin_all" on public.removed_members
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "removed_viewer_select" on public.removed_members;
create policy "removed_viewer_select" on public.removed_members
  for select using (public.is_admin_or_viewer());

-- app_settings: admin can write; anyone (even signed-out, for the login
-- page's branding) can read
drop policy if exists "settings_admin_write" on public.app_settings;
create policy "settings_admin_write" on public.app_settings
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "settings_public_select" on public.app_settings;
create policy "settings_public_select" on public.app_settings
  for select using (true);

-- profiles: everyone can read their own profile; admins can read + update
-- everyone's (needed to view the admin/viewer list); viewers can read the
-- list too (view-only) but never update it
drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select" on public.profiles
  for select using (id = auth.uid());

drop policy if exists "profiles_admin_select" on public.profiles;
create policy "profiles_admin_select" on public.profiles
  for select using (public.is_admin_or_viewer());

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Done. Next steps (see README.md):
--   1. Create a Storage bucket named "branding" (public) for the logo.
--   2. Sign up your first user from login.html — they become the first admin.
--   3. (Optional, later) Deploy the two Edge Functions for member portal
--      account creation and SMS messaging.
-- ---------------------------------------------------------------------------
