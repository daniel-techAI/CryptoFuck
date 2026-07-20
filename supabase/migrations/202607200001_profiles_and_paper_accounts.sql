-- NOCTURNE cloud profiles and paper accounts.
-- Email addresses remain in auth.users and are never copied into public tables.

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text,
  display_name text not null default 'NOCTURNE trader',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_handle_format check (
    handle is null or (handle = lower(handle) and handle ~ '^[a-z0-9_]{3,24}$')
  ),
  constraint profiles_display_name_length check (char_length(display_name) between 1 and 60)
);

create unique index profiles_handle_lower_idx on public.profiles (lower(handle)) where handle is not null;

create table public.paper_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  starting_equity numeric(18, 2) not null default 100000,
  cash numeric(18, 2) not null default 100000,
  realized_pnl numeric(18, 2) not null default 0,
  daily_start_equity numeric(18, 2) not null default 100000,
  daily_date date not null default (now() at time zone 'utc')::date,
  kill_switch boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint paper_accounts_positive_equity check (starting_equity > 0 and daily_start_equity > 0)
);

create table public.paper_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pair text not null,
  side text not null,
  entry numeric(24, 10) not null,
  stop_loss numeric(24, 10) not null,
  take_profit numeric(24, 10),
  size_usd numeric(18, 2) not null,
  signal_score smallint,
  quantity numeric(30, 14) not null,
  risk_usd numeric(18, 2) not null,
  status text not null default 'OPEN',
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  close_price numeric(24, 10),
  realized_pnl numeric(18, 2),
  constraint paper_orders_pair_length check (char_length(pair) between 3 and 30),
  constraint paper_orders_side check (side in ('LONG', 'SHORT')),
  constraint paper_orders_status check (status in ('OPEN', 'CLOSED')),
  constraint paper_orders_positive_values check (entry > 0 and stop_loss > 0 and size_usd > 0 and quantity > 0 and risk_usd >= 0),
  constraint paper_orders_signal_score check (signal_score is null or signal_score between -100 and 100)
);

create index paper_orders_user_opened_idx on public.paper_orders (user_id, opened_at desc);
create index paper_orders_user_open_idx on public.paper_orders (user_id, opened_at desc) where status = 'OPEN';

create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  auto_scan boolean not null default false,
  signal_alerts boolean not null default false,
  alert_threshold smallint not null default 75,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_preferences_alert_threshold check (alert_threshold between 55 and 95)
);

alter table public.profiles enable row level security;
alter table public.paper_accounts enable row level security;
alter table public.paper_orders enable row level security;
alter table public.user_preferences enable row level security;

create policy profiles_read_authenticated on public.profiles
  for select to authenticated using (true);
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy paper_accounts_read_own on public.paper_accounts
  for select to authenticated using ((select auth.uid()) = user_id);

create policy paper_orders_read_own on public.paper_orders
  for select to authenticated using ((select auth.uid()) = user_id);

create policy user_preferences_read_own on public.user_preferences
  for select to authenticated using ((select auth.uid()) = user_id);
create policy user_preferences_update_own on public.user_preferences
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.profiles, public.paper_accounts, public.paper_orders, public.user_preferences from anon, authenticated;
grant select on public.profiles, public.paper_accounts, public.paper_orders, public.user_preferences to authenticated;
grant update (handle, display_name) on public.profiles to authenticated;
grant update (auto_scan, signal_alerts, alert_threshold) on public.user_preferences to authenticated;

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_row_updated_at();
create trigger paper_accounts_set_updated_at before update on public.paper_accounts
for each row execute function public.set_row_updated_at();
create trigger user_preferences_set_updated_at before update on public.user_preferences
for each row execute function public.set_row_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), 'NOCTURNE trader'), 60),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;

  insert into public.paper_accounts (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.user_preferences (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles (id, display_name, avatar_url)
select id,
  left(coalesce(nullif(raw_user_meta_data ->> 'full_name', ''), 'NOCTURNE trader'), 60),
  nullif(raw_user_meta_data ->> 'avatar_url', '')
from auth.users
on conflict (id) do nothing;
insert into public.paper_accounts (user_id) select id from auth.users on conflict (user_id) do nothing;
insert into public.user_preferences (user_id) select id from auth.users on conflict (user_id) do nothing;

create or replace function public.paper_portfolio_summary()
returns table (
  equity numeric,
  cash numeric,
  realized_pnl numeric,
  daily_pnl numeric,
  daily_drawdown_percent numeric,
  open_risk_usd numeric,
  open_risk_percent numeric,
  kill_switch boolean,
  open_orders bigint
)
language sql
stable
set search_path = ''
as $$
  select
    account.cash as equity,
    account.cash,
    account.realized_pnl,
    account.cash - account.daily_start_equity as daily_pnl,
    greatest(0, -(account.cash - account.daily_start_equity) / nullif(account.daily_start_equity, 0) * 100) as daily_drawdown_percent,
    coalesce(orders.open_risk_usd, 0) as open_risk_usd,
    coalesce(orders.open_risk_usd, 0) / nullif(account.cash, 0) * 100 as open_risk_percent,
    account.kill_switch,
    coalesce(orders.open_orders, 0) as open_orders
  from public.paper_accounts account
  left join lateral (
    select coalesce(sum(risk_usd), 0) as open_risk_usd, count(*) as open_orders
    from public.paper_orders
    where user_id = account.user_id and status = 'OPEN'
  ) orders on true
  where account.user_id = (select auth.uid());
$$;

create or replace function public.place_paper_order(
  p_pair text,
  p_side text,
  p_entry numeric,
  p_stop_loss numeric,
  p_take_profit numeric,
  p_size_usd numeric,
  p_signal_score smallint default null
)
returns public.paper_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_account public.paper_accounts%rowtype;
  v_order public.paper_orders%rowtype;
  v_quantity numeric;
  v_risk_usd numeric;
  v_open_risk numeric;
  v_daily_drawdown numeric;
begin
  if v_user_id is null then raise exception 'Authentication required.'; end if;
  if p_side not in ('LONG', 'SHORT') then raise exception 'Direction must be LONG or SHORT.'; end if;
  if p_entry <= 0 or p_stop_loss <= 0 or p_size_usd <= 0 then raise exception 'Entry, stop, and size must be positive.'; end if;
  if p_side = 'LONG' and p_stop_loss >= p_entry then raise exception 'Long stop must be below entry.'; end if;
  if p_side = 'SHORT' and p_stop_loss <= p_entry then raise exception 'Short stop must be above entry.'; end if;
  if p_take_profit is not null and p_side = 'LONG' and p_take_profit <= p_entry then raise exception 'Long target must be above entry.'; end if;
  if p_take_profit is not null and p_side = 'SHORT' and p_take_profit >= p_entry then raise exception 'Short target must be below entry.'; end if;

  select * into v_account from public.paper_accounts where user_id = v_user_id for update;
  if not found then raise exception 'Paper account not found.'; end if;
  if v_account.daily_date <> (now() at time zone 'utc')::date then
    update public.paper_accounts set daily_date = (now() at time zone 'utc')::date, daily_start_equity = cash where user_id = v_user_id returning * into v_account;
  end if;
  if v_account.kill_switch then raise exception 'Kill switch is active; new orders are blocked.'; end if;

  v_daily_drawdown := greatest(0, -(v_account.cash - v_account.daily_start_equity) / nullif(v_account.daily_start_equity, 0));
  if v_daily_drawdown >= 0.03 then raise exception 'Daily drawdown limit reached; trading is locked until the next UTC day.'; end if;
  if p_size_usd > v_account.cash * 0.20 then raise exception 'Position value exceeds 20%% equity cap.'; end if;

  v_quantity := p_size_usd / p_entry;
  v_risk_usd := abs(p_entry - p_stop_loss) * v_quantity;
  if v_risk_usd > v_account.cash * 0.01 then raise exception 'Trade risk exceeds 1%% equity cap.'; end if;
  select coalesce(sum(risk_usd), 0) into v_open_risk from public.paper_orders where user_id = v_user_id and status = 'OPEN';
  if v_open_risk + v_risk_usd > v_account.cash * 0.03 then raise exception 'Portfolio open risk exceeds 3%% equity cap.'; end if;

  insert into public.paper_orders (user_id, pair, side, entry, stop_loss, take_profit, size_usd, signal_score, quantity, risk_usd)
  values (v_user_id, p_pair, p_side, p_entry, p_stop_loss, p_take_profit, p_size_usd, p_signal_score, v_quantity, v_risk_usd)
  returning * into v_order;
  return v_order;
end;
$$;

create or replace function public.set_paper_kill_switch(p_enabled boolean)
returns public.paper_accounts
language plpgsql
security definer
set search_path = ''
as $$
declare v_account public.paper_accounts%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  update public.paper_accounts set kill_switch = p_enabled where user_id = auth.uid() returning * into v_account;
  if not found then raise exception 'Paper account not found.'; end if;
  return v_account;
end;
$$;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication required.'; end if;
  delete from auth.users where id = v_user_id;
end;
$$;

revoke all on function public.paper_portfolio_summary() from public, anon;
revoke all on function public.place_paper_order(text, text, numeric, numeric, numeric, numeric, smallint) from public, anon;
revoke all on function public.set_paper_kill_switch(boolean) from public, anon;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.paper_portfolio_summary() to authenticated;
grant execute on function public.place_paper_order(text, text, numeric, numeric, numeric, numeric, smallint) to authenticated;
grant execute on function public.set_paper_kill_switch(boolean) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
