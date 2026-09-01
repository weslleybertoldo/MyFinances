-- 009 — Ordem estavel dentro do dia
--
-- O extrato do Inter nao traz hora (DTPOSTED = so a data), mas o FITID carrega a
-- SEQUENCIA da transacao dentro do dia (DTPOSTED + '077' + indice: 1 = primeira do dia).
-- Sem isso, transacoes do mesmo dia apareciam em ordem aleatoria e ainda trocavam de
-- posicao depois de qualquer UPDATE (o Postgres realoca a tupla).
--
-- `statement_seq` = esse indice, gravado na importacao. Transacao manual fica NULL.

alter table public.transactions add column if not exists statement_seq integer;
alter table staging.transactions add column if not exists statement_seq integer;
