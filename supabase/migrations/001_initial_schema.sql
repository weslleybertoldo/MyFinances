-- ============================================
-- MyFinances - Schema Inicial
-- Execute este SQL no Supabase Dashboard → SQL Editor
-- ============================================

-- 1. Categorias
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  color text not null default '#6B7280',
  type text not null check (type in ('income', 'expense', 'both')) default 'both',
  created_at timestamptz default now()
);

-- 2. Contas bancárias
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  bank text not null,
  balance numeric(12,2) not null default 0,
  color text not null default '#8B5CF6',
  connected boolean not null default false,
  pluggy_item_id text,
  pluggy_account_id text,
  last_sync_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Transações
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  account_id uuid references public.accounts(id) on delete cascade not null,
  category_id uuid references public.categories(id) on delete set null,
  description text not null,
  amount numeric(12,2) not null,
  type text not null check (type in ('income', 'expense')),
  date date not null default current_date,
  pluggy_transaction_id text,
  created_at timestamptz default now()
);

-- 4. Lançamentos futuros
create table public.future_launches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  category_id uuid references public.categories(id) on delete set null,
  description text not null,
  amount numeric(12,2) not null,
  type text not null check (type in ('income', 'expense')),
  due_date date not null,
  recurring boolean not null default false,
  paid boolean not null default false,
  created_at timestamptz default now()
);

-- 5. Regras de categorização automática (descrição → categoria)
create table public.category_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  pattern text not null,
  category_id uuid references public.categories(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(user_id, pattern)
);

-- ============================================
-- Índices
-- ============================================
create index idx_transactions_user_date on public.transactions(user_id, date desc);
create index idx_transactions_account on public.transactions(account_id);
create index idx_transactions_category on public.transactions(category_id);
create index idx_transactions_pluggy on public.transactions(pluggy_transaction_id);
create index idx_future_launches_user on public.future_launches(user_id, due_date);
create index idx_accounts_user on public.accounts(user_id);
create index idx_accounts_pluggy on public.accounts(pluggy_item_id);
create index idx_category_rules_user on public.category_rules(user_id);

-- ============================================
-- RLS (Row Level Security)
-- ============================================
alter table public.categories enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.future_launches enable row level security;
alter table public.category_rules enable row level security;

-- Policies: cada usuário só vê/edita seus próprios dados
create policy "Users manage own categories" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own accounts" on public.accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own transactions" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own future_launches" on public.future_launches
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own category_rules" on public.category_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================
-- Função: atualizar updated_at automaticamente
-- ============================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_account_update
  before update on public.accounts
  for each row execute function public.handle_updated_at();

-- ============================================
-- Função: categorizar transação automaticamente
-- ============================================
create or replace function public.auto_categorize()
returns trigger as $$
declare
  rule_cat_id uuid;
begin
  if new.category_id is null then
    select cr.category_id into rule_cat_id
    from public.category_rules cr
    where cr.user_id = new.user_id
      and lower(new.description) like '%' || lower(cr.pattern) || '%'
    limit 1;

    if rule_cat_id is not null then
      new.category_id = rule_cat_id;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger on_transaction_insert
  before insert on public.transactions
  for each row execute function public.auto_categorize();
