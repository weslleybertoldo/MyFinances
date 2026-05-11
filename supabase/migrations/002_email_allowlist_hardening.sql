-- ============================================
-- MyFinances - Hardening 2026-05-11
-- Server-side email allowlist em todas as policies + REVOKE anon
-- ============================================

-- Helper: e o usuario allowed?
create or replace function public.is_allowed_user()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (auth.jwt() ->> 'email') = 'weslleybertoldo18@gmail.com',
    false
  );
$$;

-- Recriar policies aplicando o email check em conjunto com user_id
do $$
declare
  tbl text;
  pol record;
  -- Lista todas tabelas com RLS user-owned no schema public
  tables text[] := array[
    'categories', 'accounts', 'transactions',
    'future_launches', 'credit_cards', 'card_invoice_payments',
    'projects', 'project_items', 'category_rules'
  ];
begin
  foreach tbl in array tables
  loop
    if exists (select 1 from pg_class where relname = tbl and relnamespace = 'public'::regnamespace) then
      -- drop policies existentes
      for pol in
        select policyname from pg_policies where schemaname = 'public' and tablename = tbl
      loop
        execute format('drop policy if exists %I on public.%I', pol.policyname, tbl);
      end loop;

      -- recriar com user_id + email allowlist
      execute format(
        'create policy %I on public.%I for all to authenticated using (auth.uid() = user_id and public.is_allowed_user()) with check (auth.uid() = user_id and public.is_allowed_user())',
        tbl || '_owner_allowed',
        tbl
      );

      -- enable RLS (idempotente)
      execute format('alter table public.%I enable row level security', tbl);

      -- REVOKE anon (defesa em camadas)
      execute format('revoke all on public.%I from anon', tbl);
    end if;
  end loop;
end$$;

-- UNIQUE constraints para evitar duplicatas em race (sync Pluggy + recorrentes)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'accounts' and column_name = 'pluggy_account_id'
  ) and not exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'accounts_user_pluggy_account_unique'
  ) then
    create unique index accounts_user_pluggy_account_unique
      on public.accounts (user_id, pluggy_account_id)
      where pluggy_account_id is not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'transactions' and column_name = 'pluggy_transaction_id'
  ) and not exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'transactions_user_pluggy_tx_unique'
  ) then
    create unique index transactions_user_pluggy_tx_unique
      on public.transactions (user_id, pluggy_transaction_id)
      where pluggy_transaction_id is not null;
  end if;
end$$;

-- Comentario diagnostico
comment on function public.is_allowed_user() is
  'Restringe acesso ao email allowlist server-side. Defesa em camadas: RLS + REVOKE anon.';
