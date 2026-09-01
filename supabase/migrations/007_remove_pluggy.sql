-- 007_remove_pluggy.sql — Remove o Pluggy do schema
--
-- Decisao do Weslley em 01/09/2026: o Pluggy nao aprovou o acesso, entao a entrada de
-- extrato passa a ser 100% importacao de arquivo OFX (ver 006_ofx_import.sql).
--
-- SEGURANCA DA REMOCAO: verificado antes de aplicar que nenhuma linha usava as colunas —
--   public:  0 contas, 0 transacoes
--   staging: 1 conta e 174 transacoes, todas com pluggy_* NULL (vieram do OFX)
-- Os indices unicos parciais dessas colunas caem junto com elas.
--
-- `connected` tambem sai: existia so pra sinalizar "conexao bancaria viva" do Pluggy.
-- Importacao de arquivo nao e conexao, e nenhuma tela le mais esse campo.

-- ============================================================ PUBLIC (prod)

alter table public.accounts drop column if exists pluggy_item_id;
alter table public.accounts drop column if exists pluggy_account_id;
alter table public.accounts drop column if exists connected;

alter table public.transactions drop column if exists pluggy_transaction_id;

-- ============================================================ STAGING (espelho)

alter table staging.accounts drop column if exists pluggy_item_id;
alter table staging.accounts drop column if exists pluggy_account_id;
alter table staging.accounts drop column if exists connected;

alter table staging.transactions drop column if exists pluggy_transaction_id;
