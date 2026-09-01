-- 011 — Sync automatico de extrato por e-mail (api/ofx-email-sync)
--
-- `gmail_message_id` marca de qual mensagem do Gmail veio a importacao: o job
-- pula mensagens ja processadas (dedupe NO NIVEL DO E-MAIL; o dedupe de
-- transacao continua sendo o import_key). Indice unico CHEIO, nao parcial —
-- indice parcial nao serve de arbitro de ON CONFLICT via PostgREST (licao da
-- migration 010) e NULLs (imports manuais) nao conflitam entre si.

-- ============================================================ PUBLIC (prod)
alter table public.bank_imports
  add column if not exists gmail_message_id text;
create unique index if not exists bank_imports_user_gmail_unique
  on public.bank_imports (user_id, gmail_message_id);

-- ============================================================ STAGING
alter table staging.bank_imports
  add column if not exists gmail_message_id text;
create unique index if not exists bank_imports_user_gmail_unique_staging
  on staging.bank_imports (user_id, gmail_message_id);
