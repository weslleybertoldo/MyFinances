-- ============================================
-- MyFinances - Hardening 2026-05-11
-- Funcoes com search_path = '' (mitiga mutable-search-path warning Supabase Advisor)
-- ============================================

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.auto_categorize()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
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
$$;
