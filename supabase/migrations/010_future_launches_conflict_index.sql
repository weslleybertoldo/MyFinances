-- 010 — Destrava o upsert de recorrentes (bug silencioso desde a migration 005)
--
-- `extendRecurringLaunches` faz upsert com `on_conflict=group_id,due_date`, mas o indice
-- unico criado na 005 era PARCIAL (`where group_id is not null`) — e indice parcial nao
-- pode ser arbitro de ON CONFLICT via PostgREST (erro 42P10, "no unique or exclusion
-- constraint matching"). Resultado: a extensao automatica de lancamentos recorrentes
-- falhava em silencio (o catch so logava) em PRODUCAO desde maio.
--
-- Mesmo fix do indice de import_key: indice cheio. Lancamento manual (group_id NULL)
-- continua livre porque NULL != NULL na comparacao de unicidade.

-- Havia DOIS indices parciais duplicados em cada schema (005 + um anterior). Caem todos.
drop index if exists public.future_launches_group_due_unique;
drop index if exists public.idx_future_launches_group_date;
create unique index if not exists future_launches_group_due_unique
  on public.future_launches (group_id, due_date);

drop index if exists staging.future_launches_group_id_due_date_idx;
drop index if exists staging.future_launches_group_id_due_date_idx1;
create unique index if not exists future_launches_group_due_unique_staging
  on staging.future_launches (group_id, due_date);
