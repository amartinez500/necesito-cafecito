-- necesito cafecito — Supabase schema
-- Run this in the Supabase Dashboard: SQL Editor -> New query -> Run.
-- Safe to re-run: policies are dropped and recreated if they already exist.

-- =========================================================
-- shop_status
-- Already exists (id, created_at, is_open). This just adds
-- the access policy: everyone can read it, only a logged-in
-- staff user (Supabase Auth) can flip it.
-- =========================================================

alter table shop_status enable row level security;

drop policy if exists "Anyone can view shop status" on shop_status;
create policy "Anyone can view shop status"
  on shop_status for select
  to anon, authenticated
  using (true);

drop policy if exists "Only staff can update shop status" on shop_status;
create policy "Only staff can update shop status"
  on shop_status for update
  to authenticated
  using (true)
  with check (true);

-- =========================================================
-- menu_items / menu_item_sizes / menu_item_addons
-- Mirrors the shape of the MENU array in app/page.js:
-- an item has many sizes and many add-ons. Splitting them
-- into their own tables (rather than one big items table)
-- means she can add/remove a size or add-on later without
-- touching every item's row.
-- =========================================================

create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists menu_item_sizes (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references menu_items(id) on delete cascade,
  label text not null,        -- e.g. "16oz"
  price numeric(10,2) not null,
  sort_order int not null default 0
);

create table if not exists menu_item_addons (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references menu_items(id) on delete cascade,
  name text not null,         -- e.g. "Vanilla cold foam"
  price numeric(10,2) not null,
  sort_order int not null default 0
);

alter table menu_items enable row level security;
alter table menu_item_sizes enable row level security;
alter table menu_item_addons enable row level security;

drop policy if exists "Anyone can view menu items" on menu_items;
create policy "Anyone can view menu items"
  on menu_items for select to anon, authenticated using (true);

drop policy if exists "Only staff can modify menu items" on menu_items;
create policy "Only staff can modify menu items"
  on menu_items for all to authenticated using (true) with check (true);

drop policy if exists "Anyone can view sizes" on menu_item_sizes;
create policy "Anyone can view sizes"
  on menu_item_sizes for select to anon, authenticated using (true);

drop policy if exists "Only staff can modify sizes" on menu_item_sizes;
create policy "Only staff can modify sizes"
  on menu_item_sizes for all to authenticated using (true) with check (true);

drop policy if exists "Anyone can view addons" on menu_item_addons;
create policy "Anyone can view addons"
  on menu_item_addons for select to anon, authenticated using (true);

drop policy if exists "Only staff can modify addons" on menu_item_addons;
create policy "Only staff can modify addons"
  on menu_item_addons for all to authenticated using (true) with check (true);

-- =========================================================
-- orders / order_items
-- One order = one checkout. One order_item = one cup (matches
-- the per-cup cart in app/page.js: each cup has its own size
-- and add-on choice).
--
-- item_name, size_label, addon_name, and price are copied onto
-- order_items at order time (not just referenced via menu_item_id).
-- That way, if she later renames or deletes a menu item, old
-- orders still show what was actually ordered and charged.
-- =========================================================

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_email text,
  pickup_time timestamptz not null,
  payment_method text not null check (payment_method in ('online', 'counter')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid')),
  status text not null default 'new'
    check (status in ('awaiting_payment', 'new', 'brewing', 'ready', 'completed')),
  total numeric(10,2) not null,
  created_at timestamptz not null default now()
);

-- Table already existed before customer_email was added — this is a
-- no-op on a fresh database, and adds the column on an existing one.
alter table orders add column if not exists customer_email text;

-- 'awaiting_payment': an online order gets created in this state before the
-- customer finishes paying on Stripe. If they abandon the payment page, the
-- order just stays here forever, invisible to the staff board's ['new',
-- 'brewing', 'ready'] filter — no ghost/unpaid orders cluttering the queue.
-- The Stripe webhook flips it to 'new' only once payment is confirmed.
alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check
  check (status in ('awaiting_payment', 'new', 'brewing', 'ready', 'completed'));

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  menu_item_id uuid references menu_items(id) on delete set null,
  item_name text not null,
  size_label text not null,
  addon_name text,
  price numeric(10,2) not null
);

alter table orders enable row level security;
alter table order_items enable row level security;

-- Customers place orders anonymously (no login), so INSERT is open.
-- But SELECT is staff-only: a customer should never be able to read
-- back the list of orders and see other people's names/pickup times.
drop policy if exists "Anyone can place an order" on orders;
create policy "Anyone can place an order"
  on orders for insert to anon, authenticated with check (true);

drop policy if exists "Only staff can view orders" on orders;
create policy "Only staff can view orders"
  on orders for select to authenticated using (true);

drop policy if exists "Only staff can update orders" on orders;
create policy "Only staff can update orders"
  on orders for update to authenticated using (true) with check (true);

drop policy if exists "Anyone can add items to an order" on order_items;
create policy "Anyone can add items to an order"
  on order_items for insert to anon, authenticated with check (true);

drop policy if exists "Only staff can view order items" on order_items;
create policy "Only staff can view order items"
  on order_items for select to authenticated using (true);

-- =========================================================
-- Realtime
-- Lets the browser subscribe to live changes instead of polling:
-- the customer page listens for shop_status flipping open/closed,
-- and the staff dashboard listens for new/updated orders so it
-- refreshes itself instead of requiring a manual page reload.
-- =========================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table orders;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shop_status'
  ) then
    alter publication supabase_realtime add table shop_status;
  end if;
end $$;
