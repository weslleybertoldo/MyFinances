-- MyFinances — ambiente de STAGING via schema separado (espelha public.*)
-- Idempotente. Sem dados. Padrão seazone-support-hub. Gerado por introspecção 2026-06-18.
-- Enums ficam em public (tipo compartilhado); tabelas staging usam o tipo public.<enum>.

CREATE SCHEMA IF NOT EXISTS staging;

-- ---------- Tabelas (LIKE INCLUDING ALL) ----------
CREATE TABLE IF NOT EXISTS staging.accounts (LIKE public.accounts INCLUDING ALL);
CREATE TABLE IF NOT EXISTS staging.card_invoice_payments (LIKE public.card_invoice_payments INCLUDING ALL);
CREATE TABLE IF NOT EXISTS staging.categories (LIKE public.categories INCLUDING ALL);
CREATE TABLE IF NOT EXISTS staging.category_rules (LIKE public.category_rules INCLUDING ALL);
CREATE TABLE IF NOT EXISTS staging.credit_cards (LIKE public.credit_cards INCLUDING ALL);
CREATE TABLE IF NOT EXISTS staging.future_launches (LIKE public.future_launches INCLUDING ALL);
CREATE TABLE IF NOT EXISTS staging.project_items (LIKE public.project_items INCLUDING ALL);
CREATE TABLE IF NOT EXISTS staging.projects (LIKE public.projects INCLUDING ALL);
CREATE TABLE IF NOT EXISTS staging.transactions (LIKE public.transactions INCLUDING ALL);
CREATE TABLE IF NOT EXISTS staging.wm_items (LIKE public.wm_items INCLUDING ALL);
CREATE TABLE IF NOT EXISTS staging.wm_sections (LIKE public.wm_sections INCLUDING ALL);

-- ---------- Funções (public -> staging; search_path resolve tabelas em staging, tipos/enums em public) ----------
CREATE OR REPLACE FUNCTION staging.is_allowed_user()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO staging, public
AS $function$
  select coalesce(
    (auth.jwt() ->> 'email') = 'weslleybertoldo18@gmail.com',
    false
  );
$function$;

CREATE OR REPLACE FUNCTION staging.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO staging, public
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION staging.auto_categorize()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO staging, public
AS $function$
declare
  rule_cat_id uuid;
begin
  if new.category_id is null then
    select cr.category_id into rule_cat_id
    from staging.category_rules cr
    where cr.user_id = new.user_id
      and lower(new.description) like '%' || lower(cr.pattern) || '%'
    limit 1;

    if rule_cat_id is not null then
      new.category_id = rule_cat_id;
    end if;
  end if;
  return new;
end;
$function$;

-- ---------- FKs (intra-staging; refs a auth.* preservadas) ----------
ALTER TABLE staging.accounts DROP CONSTRAINT IF EXISTS accounts_user_id_fkey;
ALTER TABLE staging.accounts ADD CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE staging.card_invoice_payments DROP CONSTRAINT IF EXISTS card_invoice_payments_card_id_fkey;
ALTER TABLE staging.card_invoice_payments ADD CONSTRAINT card_invoice_payments_card_id_fkey FOREIGN KEY (card_id) REFERENCES staging.credit_cards(id) ON DELETE CASCADE;
ALTER TABLE staging.card_invoice_payments DROP CONSTRAINT IF EXISTS card_invoice_payments_user_id_fkey;
ALTER TABLE staging.card_invoice_payments ADD CONSTRAINT card_invoice_payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE staging.categories DROP CONSTRAINT IF EXISTS categories_user_id_fkey;
ALTER TABLE staging.categories ADD CONSTRAINT categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE staging.category_rules DROP CONSTRAINT IF EXISTS category_rules_category_id_fkey;
ALTER TABLE staging.category_rules ADD CONSTRAINT category_rules_category_id_fkey FOREIGN KEY (category_id) REFERENCES staging.categories(id) ON DELETE CASCADE;
ALTER TABLE staging.category_rules DROP CONSTRAINT IF EXISTS category_rules_user_id_fkey;
ALTER TABLE staging.category_rules ADD CONSTRAINT category_rules_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE staging.credit_cards DROP CONSTRAINT IF EXISTS credit_cards_user_id_fkey;
ALTER TABLE staging.credit_cards ADD CONSTRAINT credit_cards_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE staging.future_launches DROP CONSTRAINT IF EXISTS future_launches_card_id_fkey;
ALTER TABLE staging.future_launches ADD CONSTRAINT future_launches_card_id_fkey FOREIGN KEY (card_id) REFERENCES staging.credit_cards(id) ON DELETE SET NULL;
ALTER TABLE staging.future_launches DROP CONSTRAINT IF EXISTS future_launches_category_id_fkey;
ALTER TABLE staging.future_launches ADD CONSTRAINT future_launches_category_id_fkey FOREIGN KEY (category_id) REFERENCES staging.categories(id) ON DELETE SET NULL;
ALTER TABLE staging.future_launches DROP CONSTRAINT IF EXISTS future_launches_user_id_fkey;
ALTER TABLE staging.future_launches ADD CONSTRAINT future_launches_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE staging.project_items DROP CONSTRAINT IF EXISTS project_items_project_id_fkey;
ALTER TABLE staging.project_items ADD CONSTRAINT project_items_project_id_fkey FOREIGN KEY (project_id) REFERENCES staging.projects(id) ON DELETE CASCADE;
ALTER TABLE staging.project_items DROP CONSTRAINT IF EXISTS project_items_user_id_fkey;
ALTER TABLE staging.project_items ADD CONSTRAINT project_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE staging.projects DROP CONSTRAINT IF EXISTS projects_user_id_fkey;
ALTER TABLE staging.projects ADD CONSTRAINT projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE staging.transactions DROP CONSTRAINT IF EXISTS transactions_account_id_fkey;
ALTER TABLE staging.transactions ADD CONSTRAINT transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES staging.accounts(id) ON DELETE CASCADE;
ALTER TABLE staging.transactions DROP CONSTRAINT IF EXISTS transactions_category_id_fkey;
ALTER TABLE staging.transactions ADD CONSTRAINT transactions_category_id_fkey FOREIGN KEY (category_id) REFERENCES staging.categories(id) ON DELETE SET NULL;
ALTER TABLE staging.transactions DROP CONSTRAINT IF EXISTS transactions_user_id_fkey;
ALTER TABLE staging.transactions ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE staging.wm_items DROP CONSTRAINT IF EXISTS wm_items_section_id_fkey;
ALTER TABLE staging.wm_items ADD CONSTRAINT wm_items_section_id_fkey FOREIGN KEY (section_id) REFERENCES staging.wm_sections(id) ON DELETE CASCADE;
ALTER TABLE staging.wm_items DROP CONSTRAINT IF EXISTS wm_items_user_id_fkey;
ALTER TABLE staging.wm_items ADD CONSTRAINT wm_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE staging.wm_sections DROP CONSTRAINT IF EXISTS wm_sections_user_id_fkey;
ALTER TABLE staging.wm_sections ADD CONSTRAINT wm_sections_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ---------- RLS ----------
ALTER TABLE staging.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging.card_invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging.category_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging.credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging.future_launches ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging.project_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging.wm_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging.wm_sections ENABLE ROW LEVEL SECURITY;

-- ---------- Policies ----------
DROP POLICY IF EXISTS "Users manage own sections" ON staging.wm_sections;
CREATE POLICY "Users manage own sections" ON staging.wm_sections AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users manage own items" ON staging.wm_items;
CREATE POLICY "Users manage own items" ON staging.wm_items AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "categories_owner_allowed" ON staging.categories;
CREATE POLICY "categories_owner_allowed" ON staging.categories AS PERMISSIVE FOR ALL TO authenticated USING (((auth.uid() = user_id) AND staging.is_allowed_user())) WITH CHECK (((auth.uid() = user_id) AND staging.is_allowed_user()));
DROP POLICY IF EXISTS "accounts_owner_allowed" ON staging.accounts;
CREATE POLICY "accounts_owner_allowed" ON staging.accounts AS PERMISSIVE FOR ALL TO authenticated USING (((auth.uid() = user_id) AND staging.is_allowed_user())) WITH CHECK (((auth.uid() = user_id) AND staging.is_allowed_user()));
DROP POLICY IF EXISTS "transactions_owner_allowed" ON staging.transactions;
CREATE POLICY "transactions_owner_allowed" ON staging.transactions AS PERMISSIVE FOR ALL TO authenticated USING (((auth.uid() = user_id) AND staging.is_allowed_user())) WITH CHECK (((auth.uid() = user_id) AND staging.is_allowed_user()));
DROP POLICY IF EXISTS "future_launches_owner_allowed" ON staging.future_launches;
CREATE POLICY "future_launches_owner_allowed" ON staging.future_launches AS PERMISSIVE FOR ALL TO authenticated USING (((auth.uid() = user_id) AND staging.is_allowed_user())) WITH CHECK (((auth.uid() = user_id) AND staging.is_allowed_user()));
DROP POLICY IF EXISTS "credit_cards_owner_allowed" ON staging.credit_cards;
CREATE POLICY "credit_cards_owner_allowed" ON staging.credit_cards AS PERMISSIVE FOR ALL TO authenticated USING (((auth.uid() = user_id) AND staging.is_allowed_user())) WITH CHECK (((auth.uid() = user_id) AND staging.is_allowed_user()));
DROP POLICY IF EXISTS "card_invoice_payments_owner_allowed" ON staging.card_invoice_payments;
CREATE POLICY "card_invoice_payments_owner_allowed" ON staging.card_invoice_payments AS PERMISSIVE FOR ALL TO authenticated USING (((auth.uid() = user_id) AND staging.is_allowed_user())) WITH CHECK (((auth.uid() = user_id) AND staging.is_allowed_user()));
DROP POLICY IF EXISTS "projects_owner_allowed" ON staging.projects;
CREATE POLICY "projects_owner_allowed" ON staging.projects AS PERMISSIVE FOR ALL TO authenticated USING (((auth.uid() = user_id) AND staging.is_allowed_user())) WITH CHECK (((auth.uid() = user_id) AND staging.is_allowed_user()));
DROP POLICY IF EXISTS "project_items_owner_allowed" ON staging.project_items;
CREATE POLICY "project_items_owner_allowed" ON staging.project_items AS PERMISSIVE FOR ALL TO authenticated USING (((auth.uid() = user_id) AND staging.is_allowed_user())) WITH CHECK (((auth.uid() = user_id) AND staging.is_allowed_user()));
DROP POLICY IF EXISTS "category_rules_owner_allowed" ON staging.category_rules;
CREATE POLICY "category_rules_owner_allowed" ON staging.category_rules AS PERMISSIVE FOR ALL TO authenticated USING (((auth.uid() = user_id) AND staging.is_allowed_user())) WITH CHECK (((auth.uid() = user_id) AND staging.is_allowed_user()));

-- ---------- Triggers (em tabelas public -> staging; triggers em auth.* NÃO são replicados) ----------
DROP TRIGGER IF EXISTS on_account_update ON staging.accounts;
CREATE TRIGGER on_account_update BEFORE UPDATE ON staging.accounts FOR EACH ROW EXECUTE FUNCTION staging.handle_updated_at();
DROP TRIGGER IF EXISTS on_transaction_insert ON staging.transactions;
CREATE TRIGGER on_transaction_insert BEFORE INSERT ON staging.transactions FOR EACH ROW EXECUTE FUNCTION staging.auto_categorize();

-- ---------- Grants ----------
GRANT USAGE ON SCHEMA staging TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA staging TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA staging TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA staging TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA staging GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA staging GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA staging GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
