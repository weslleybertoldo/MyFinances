-- ============================================
-- MyFinances - UNIQUE em (group_id, due_date) para idempotencia
-- da extensao de recorrentes em useFutureLaunches.
-- ============================================

-- Dedup defensivo antes de criar o index (caso ja exista duplicata em prod)
with d as (
  select id,
         row_number() over (partition by group_id, due_date order by created_at, id) as rn
  from public.future_launches
  where group_id is not null
)
delete from public.future_launches fl
using d
where fl.id = d.id and d.rn > 1;

create unique index if not exists future_launches_group_due_unique
  on public.future_launches (group_id, due_date)
  where group_id is not null;
