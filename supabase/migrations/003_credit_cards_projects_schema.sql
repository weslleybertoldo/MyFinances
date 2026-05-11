-- ============================================
-- MyFinances - Schema versionando o que foi aplicado manualmente
-- (dump conferido contra prod aoyaftmgpaxbbmdihkxn em 2026-05-11)
-- Idempotente: usa IF NOT EXISTS pra nao reaplicar em prod.
-- ============================================

-- Cartoes de credito
create table if not exists public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  closing_day integer not null,
  due_day integer not null,
  color text not null default '#8B5CF6',
  card_limit numeric(12,2) not null default 0,
  created_at timestamptz default now()
);

-- Pagamentos de fatura (chave de liberacao do limite)
create table if not exists public.card_invoice_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.credit_cards(id) on delete cascade,
  month text not null,
  amount numeric(12,2) not null,
  paid_at timestamptz default now(),
  unique (card_id, month)
);

-- Future launches: colunas adicionais que vieram pos-001
alter table public.future_launches
  add column if not exists group_id uuid,
  add column if not exists parcel_number integer,
  add column if not exists total_parcels integer,
  add column if not exists card_id uuid references public.credit_cards(id) on delete set null;

-- Projetos (ex: viagem, reforma)
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists public.project_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  value numeric(12,2) not null,
  date date,
  created_at timestamptz default now()
);

-- Regras de categorizacao automatica
create table if not exists public.category_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pattern text not null,
  category_id uuid not null references public.categories(id) on delete cascade,
  created_at timestamptz default now(),
  unique (user_id, pattern)
);

-- RLS habilitado (002_email_allowlist_hardening.sql cria as policies)
alter table public.credit_cards enable row level security;
alter table public.card_invoice_payments enable row level security;
alter table public.projects enable row level security;
alter table public.project_items enable row level security;
alter table public.category_rules enable row level security;

-- Indices uteis (consultas do app por user_id)
create index if not exists idx_credit_cards_user on public.credit_cards(user_id);
create index if not exists idx_card_invoice_payments_card on public.card_invoice_payments(card_id, month);
create index if not exists idx_projects_user on public.projects(user_id);
create index if not exists idx_project_items_project on public.project_items(project_id);
create index if not exists idx_category_rules_user on public.category_rules(user_id);
create index if not exists idx_future_launches_card on public.future_launches(card_id) where card_id is not null;
create index if not exists idx_future_launches_group on public.future_launches(group_id) where group_id is not null;
