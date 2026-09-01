-- 008 — Duas coisas:
--   (a) conserta a corrida do seedCategories que triplicava as categorias padrao
--   (b) permite editar o nome da transacao e anexar observacao, sem perder o original
--
-- (a) CAUSA RAIZ: `AuthContext.seedCategories` e chamado de 3 lugares (getSession inicial,
-- onAuthStateChange SIGNED_IN e signInWithGoogle). Todos fazem `count === 0` e depois
-- inserem — numa conta nova os 3 leem 0 antes de qualquer insert e cada um insere as 10
-- categorias padrao => 30 categorias. Em producao nunca apareceu porque as categorias ja
-- existiam desde abril; apareceu no schema `staging`, que estava vazio.
-- O indice unico abaixo mata a corrida no banco (o app passa a usar upsert ignoreDuplicates).
--
-- (b) `description` continua sendo o nome ORIGINAL (o que veio do extrato ou o que foi
-- digitado). `custom_name` e o nome escolhido pelo usuario e `notes` a observacao.
-- A tela mostra `custom_name ?? description` e o detalhe mostra os dois.

-- ============================================================ PUBLIC (prod)

-- Dedupe defensivo: mantem a categoria mais antiga de cada nome e repoe as referencias.
-- Em prod nao ha duplicata (13 nomes, 13 linhas), entao isso e no-op aqui.
with ranked as (
  select id, first_value(id) over (partition by user_id, name order by created_at, id) as keep_id
  from public.categories
)
update public.transactions t set category_id = r.keep_id
from ranked r where t.category_id = r.id and r.id <> r.keep_id;

with ranked as (
  select id, first_value(id) over (partition by user_id, name order by created_at, id) as keep_id
  from public.categories
)
update public.future_launches f set category_id = r.keep_id
from ranked r where f.category_id = r.id and r.id <> r.keep_id;

with ranked as (
  select id, first_value(id) over (partition by user_id, name order by created_at, id) as keep_id
  from public.categories
)
update public.category_rules cr set category_id = r.keep_id
from ranked r where cr.category_id = r.id and r.id <> r.keep_id;

with ranked as (
  select id, first_value(id) over (partition by user_id, name order by created_at, id) as keep_id
  from public.categories
)
delete from public.categories c using ranked r where c.id = r.id and r.id <> r.keep_id;

-- Nao-parcial: precisa servir de alvo de ON CONFLICT no upsert do seedCategories.
create unique index if not exists categories_user_name_unique
  on public.categories (user_id, name);

alter table public.transactions add column if not exists custom_name text;
alter table public.transactions add column if not exists notes text;

-- ============================================================ STAGING (espelho)

with ranked as (
  select id, first_value(id) over (partition by user_id, name order by created_at, id) as keep_id
  from staging.categories
)
update staging.transactions t set category_id = r.keep_id
from ranked r where t.category_id = r.id and r.id <> r.keep_id;

with ranked as (
  select id, first_value(id) over (partition by user_id, name order by created_at, id) as keep_id
  from staging.categories
)
update staging.future_launches f set category_id = r.keep_id
from ranked r where f.category_id = r.id and r.id <> r.keep_id;

with ranked as (
  select id, first_value(id) over (partition by user_id, name order by created_at, id) as keep_id
  from staging.categories
)
update staging.category_rules cr set category_id = r.keep_id
from ranked r where cr.category_id = r.id and r.id <> r.keep_id;

with ranked as (
  select id, first_value(id) over (partition by user_id, name order by created_at, id) as keep_id
  from staging.categories
)
delete from staging.categories c using ranked r where c.id = r.id and r.id <> r.keep_id;

create unique index if not exists categories_user_name_unique_staging
  on staging.categories (user_id, name);

alter table staging.transactions add column if not exists custom_name text;
alter table staging.transactions add column if not exists notes text;
