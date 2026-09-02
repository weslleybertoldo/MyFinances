-- 012 — Investimentos (aba Investimentos: Dashboard + Meus ativos)
--
-- 4 tabelas novas, espelhadas em public (prod) e staging:
--   investment_assets         ativos da carteira (ticker B3 ou titulo do Tesouro) + nota p/ % ideal
--   investment_transactions   lancamentos: compra / venda / provento (manual ou automatico)
--   investment_quotes         cache de cotacao por ticker (B3 preco atual, Yahoo historico mensal +
--                             dividendos, Tesouro Transparente PU). Escrita SO pela function
--                             api/quotes (service_role); o app apenas le.
--   investment_class_targets  meta de alocacao por classe (padrao 25% cada)
--
-- Idempotente (if not exists / drop policy if exists). Mesmo padrao das demais:
-- RLS + policy (auth.uid() = user_id AND is_allowed_user()) + REVOKE anon.

-- ============================================================ PUBLIC (prod)
create table if not exists public.investment_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  name text,
  asset_class text not null check (asset_class in ('acao','fii','etf','tesouro')),
  score integer not null default 10 check (score between 0 and 10),
  tesouro_tipo text,
  tesouro_vencimento date,
  created_at timestamptz default now(),
  unique (user_id, ticker)
);

create table if not exists public.investment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_id uuid not null references public.investment_assets(id) on delete cascade,
  kind text not null check (kind in ('buy','sell','dividend')),
  date date not null,
  quantity numeric(18,8) not null default 0,
  unit_price numeric(14,4) not null default 0,
  total numeric(14,2) not null,
  notes text,
  source text not null default 'manual' check (source in ('manual','auto')),
  external_key text,
  ignored boolean not null default false,
  created_at timestamptz default now()
);
-- Indice unico CHEIO (nao parcial): arbitro de ON CONFLICT via PostgREST (licao da 010).
-- NULLs (lancamentos manuais) nao conflitam entre si.
create unique index if not exists investment_transactions_user_external_unique
  on public.investment_transactions (user_id, external_key);
create index if not exists idx_investment_transactions_asset
  on public.investment_transactions (asset_id, date);
create index if not exists idx_investment_assets_user
  on public.investment_assets (user_id);

create table if not exists public.investment_quotes (
  ticker text primary key,
  asset_class text,
  name text,
  price numeric(14,4),
  price_at timestamptz,
  change_pct numeric(8,4),
  source text,
  history jsonb not null default '[]'::jsonb,
  dividends jsonb not null default '[]'::jsonb,
  error text,
  updated_at timestamptz default now()
);

create table if not exists public.investment_class_targets (
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_class text not null check (asset_class in ('acao','fii','etf','tesouro')),
  target_pct numeric(5,2) not null default 25,
  primary key (user_id, asset_class)
);

alter table public.investment_assets enable row level security;
alter table public.investment_transactions enable row level security;
alter table public.investment_quotes enable row level security;
alter table public.investment_class_targets enable row level security;

drop policy if exists investment_assets_owner_allowed on public.investment_assets;
create policy investment_assets_owner_allowed on public.investment_assets
  for all to authenticated
  using (auth.uid() = user_id and public.is_allowed_user())
  with check (auth.uid() = user_id and public.is_allowed_user());

drop policy if exists investment_transactions_owner_allowed on public.investment_transactions;
create policy investment_transactions_owner_allowed on public.investment_transactions
  for all to authenticated
  using (auth.uid() = user_id and public.is_allowed_user())
  with check (auth.uid() = user_id and public.is_allowed_user());

-- Cotacao: leitura pro usuario permitido; escrita so service_role (function), sem policy de insert/update.
drop policy if exists investment_quotes_read_allowed on public.investment_quotes;
create policy investment_quotes_read_allowed on public.investment_quotes
  for select to authenticated
  using (public.is_allowed_user());

drop policy if exists investment_class_targets_owner_allowed on public.investment_class_targets;
create policy investment_class_targets_owner_allowed on public.investment_class_targets
  for all to authenticated
  using (auth.uid() = user_id and public.is_allowed_user())
  with check (auth.uid() = user_id and public.is_allowed_user());

revoke all on public.investment_assets from anon;
revoke all on public.investment_transactions from anon;
revoke all on public.investment_quotes from anon;
revoke all on public.investment_class_targets from anon;

-- ============================================================ STAGING
create table if not exists staging.investment_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  name text,
  asset_class text not null check (asset_class in ('acao','fii','etf','tesouro')),
  score integer not null default 10 check (score between 0 and 10),
  tesouro_tipo text,
  tesouro_vencimento date,
  created_at timestamptz default now(),
  unique (user_id, ticker)
);

create table if not exists staging.investment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_id uuid not null references staging.investment_assets(id) on delete cascade,
  kind text not null check (kind in ('buy','sell','dividend')),
  date date not null,
  quantity numeric(18,8) not null default 0,
  unit_price numeric(14,4) not null default 0,
  total numeric(14,2) not null,
  notes text,
  source text not null default 'manual' check (source in ('manual','auto')),
  external_key text,
  ignored boolean not null default false,
  created_at timestamptz default now()
);
create unique index if not exists investment_transactions_user_external_unique_staging
  on staging.investment_transactions (user_id, external_key);
create index if not exists idx_investment_transactions_asset_staging
  on staging.investment_transactions (asset_id, date);
create index if not exists idx_investment_assets_user_staging
  on staging.investment_assets (user_id);

create table if not exists staging.investment_quotes (
  ticker text primary key,
  asset_class text,
  name text,
  price numeric(14,4),
  price_at timestamptz,
  change_pct numeric(8,4),
  source text,
  history jsonb not null default '[]'::jsonb,
  dividends jsonb not null default '[]'::jsonb,
  error text,
  updated_at timestamptz default now()
);

create table if not exists staging.investment_class_targets (
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_class text not null check (asset_class in ('acao','fii','etf','tesouro')),
  target_pct numeric(5,2) not null default 25,
  primary key (user_id, asset_class)
);

alter table staging.investment_assets enable row level security;
alter table staging.investment_transactions enable row level security;
alter table staging.investment_quotes enable row level security;
alter table staging.investment_class_targets enable row level security;

drop policy if exists investment_assets_owner_allowed on staging.investment_assets;
create policy investment_assets_owner_allowed on staging.investment_assets
  for all to authenticated
  using (auth.uid() = user_id and staging.is_allowed_user())
  with check (auth.uid() = user_id and staging.is_allowed_user());

drop policy if exists investment_transactions_owner_allowed on staging.investment_transactions;
create policy investment_transactions_owner_allowed on staging.investment_transactions
  for all to authenticated
  using (auth.uid() = user_id and staging.is_allowed_user())
  with check (auth.uid() = user_id and staging.is_allowed_user());

drop policy if exists investment_quotes_read_allowed on staging.investment_quotes;
create policy investment_quotes_read_allowed on staging.investment_quotes
  for select to authenticated
  using (staging.is_allowed_user());

drop policy if exists investment_class_targets_owner_allowed on staging.investment_class_targets;
create policy investment_class_targets_owner_allowed on staging.investment_class_targets
  for all to authenticated
  using (auth.uid() = user_id and staging.is_allowed_user())
  with check (auth.uid() = user_id and staging.is_allowed_user());

revoke all on staging.investment_assets from anon;
revoke all on staging.investment_transactions from anon;
revoke all on staging.investment_quotes from anon;
revoke all on staging.investment_class_targets from anon;
