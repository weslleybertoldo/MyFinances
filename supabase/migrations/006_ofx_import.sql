-- 006_ofx_import.sql — Importacao de extrato OFX (Banco Inter)
-- Idempotente. Aplicada em public (prod) e staging.
--
-- CONTEXTO DA CHAVE DE DEDUPE:
-- O FITID do Inter NAO e um id estavel do banco: e `DTPOSTED || '077' || indice-no-dia`
-- (ex.: 202609010771 = 20260901 + 077 + 1). Ou seja, e a POSICAO da transacao dentro do
-- dia. Se o banco inserir/reordenar uma transacao no mesmo dia, os indices deslocam e o
-- mesmo FITID passa a apontar pra outra transacao — reimportar duplicaria e sobrescreveria
-- errado. Por isso a chave de dedupe (`import_key`) e composta por
-- data + valor + memo + numero da ocorrencia entre transacoes IDENTICAS,
-- que e estavel sob reordenacao. O FITID fica guardado apenas como referencia.

-- ============================================================ PUBLIC (prod)

-- 1) Historico de importacoes, por fonte (a UI mostra a ultima de cada)
create table if not exists public.bank_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete set null,
  source text not null,
  file_name text,
  period_start date,
  period_end date,
  tx_total integer not null default 0,
  tx_imported integer not null default 0,
  tx_skipped integer not null default 0,
  balance numeric,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bank_imports_source_check'
  ) then
    alter table public.bank_imports
      add constraint bank_imports_source_check check (source in ('manual', 'email'));
  end if;
end $$;

create index if not exists bank_imports_user_source_created_idx
  on public.bank_imports (user_id, source, created_at desc);

alter table public.bank_imports enable row level security;

drop policy if exists bank_imports_owner_allowed on public.bank_imports;
create policy bank_imports_owner_allowed on public.bank_imports
  for all
  using ((auth.uid() = user_id) and public.is_allowed_user())
  with check ((auth.uid() = user_id) and public.is_allowed_user());

revoke all on public.bank_imports from anon;

-- 2) accounts: identidade OFX (BANKID + ACCTID do <BANKACCTFROM>)
alter table public.accounts add column if not exists ofx_bank_id text;
alter table public.accounts add column if not exists ofx_acct_id text;

create unique index if not exists accounts_user_ofx_unique
  on public.accounts (user_id, ofx_bank_id, ofx_acct_id)
  where ofx_acct_id is not null;

-- 3) transactions: origem e chave de dedupe
alter table public.transactions add column if not exists import_key text;
alter table public.transactions add column if not exists import_source text;
alter table public.transactions add column if not exists import_memo text;
alter table public.transactions add column if not exists ofx_fitid text;
alter table public.transactions add column if not exists bank_import_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'transactions_bank_import_fk'
  ) then
    alter table public.transactions
      add constraint transactions_bank_import_fk
      foreign key (bank_import_id) references public.bank_imports (id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'transactions_import_source_check'
  ) then
    alter table public.transactions
      add constraint transactions_import_source_check
      check (import_source is null or import_source in ('manual', 'email'));
  end if;
end $$;

-- Dedupe: uma transacao importada por (user, import_key).
-- ATENCAO: o indice e NAO-PARCIAL de proposito. Indice unico parcial (`where ... is not null`)
-- NAO pode ser alvo de `ON CONFLICT (col)` no Postgres — a inferencia do arbitro so aceita
-- indice parcial se o proprio INSERT tiver um WHERE que implique o predicado, e o PostgREST
-- nao expoe isso. Com indice cheio o upsert funciona, e lancamento manual (import_key NULL)
-- continua livre porque NULL != NULL na comparacao de unicidade.
drop index if exists public.transactions_user_import_key_unique;
create unique index if not exists transactions_user_import_key_unique
  on public.transactions (user_id, import_key);

-- ============================================================ STAGING (espelho)

create table if not exists staging.bank_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid references staging.accounts (id) on delete set null,
  source text not null,
  file_name text,
  period_start date,
  period_end date,
  tx_total integer not null default 0,
  tx_imported integer not null default 0,
  tx_skipped integer not null default 0,
  balance numeric,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bank_imports_source_check_staging'
  ) then
    alter table staging.bank_imports
      add constraint bank_imports_source_check_staging check (source in ('manual', 'email'));
  end if;
end $$;

create index if not exists bank_imports_user_source_created_idx_staging
  on staging.bank_imports (user_id, source, created_at desc);

alter table staging.bank_imports enable row level security;

drop policy if exists bank_imports_owner_allowed on staging.bank_imports;
create policy bank_imports_owner_allowed on staging.bank_imports
  for all
  using ((auth.uid() = user_id) and staging.is_allowed_user())
  with check ((auth.uid() = user_id) and staging.is_allowed_user());

revoke all on staging.bank_imports from anon;

alter table staging.accounts add column if not exists ofx_bank_id text;
alter table staging.accounts add column if not exists ofx_acct_id text;

create unique index if not exists accounts_user_ofx_unique_staging
  on staging.accounts (user_id, ofx_bank_id, ofx_acct_id)
  where ofx_acct_id is not null;

alter table staging.transactions add column if not exists import_key text;
alter table staging.transactions add column if not exists import_source text;
alter table staging.transactions add column if not exists import_memo text;
alter table staging.transactions add column if not exists ofx_fitid text;
alter table staging.transactions add column if not exists bank_import_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'transactions_bank_import_fk_staging'
  ) then
    alter table staging.transactions
      add constraint transactions_bank_import_fk_staging
      foreign key (bank_import_id) references staging.bank_imports (id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'transactions_import_source_check_staging'
  ) then
    alter table staging.transactions
      add constraint transactions_import_source_check_staging
      check (import_source is null or import_source in ('manual', 'email'));
  end if;
end $$;

-- Nao-parcial pelo mesmo motivo do public (ver comentario la em cima).
drop index if exists staging.transactions_user_import_key_unique_staging;
create unique index if not exists transactions_user_import_key_unique_staging
  on staging.transactions (user_id, import_key);
