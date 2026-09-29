-- Règles d'accès, contraintes, index, fonctions et triggers de la base Holiris,
-- extraits de Supabase le 2026-09-29 (tables système pg_policies, pg_constraint, pg_indexes…).
-- À exécuter après 0000_schema_complet.sql pour recréer une base neuve.
--
-- ATTENTION : ces règles d'accès sont celles d'AVANT la mise en sécurité (accès ouvert, « using (true) »).
-- Pour une base neuve, exécuter ensuite 2026-09-29_regles_acces.sql, qui les remplace.

alter table alertes enable row level security;

alter table bornes enable row level security;

alter table demandes_acces enable row level security;

alter table desinscriptions enable row level security;

alter table events enable row level security;

alter table intervenants enable row level security;

alter table notes enable row level security;

alter table notes_en_attente enable row level security;

alter table ordonnances enable row level security;

alter table relances enable row level security;

alter table salaries enable row level security;

alter table signalements_medicaux enable row level security;

alter table structure_membres enable row level security;

alter table structures enable row level security;

create policy "Archivage intervenants" on intervenants as PERMISSIVE for UPDATE to public using (true);

create policy "Delete bornes admin" on bornes as PERMISSIVE for DELETE to public using (true);

create policy "Gestionnaire : sa fiche" on structure_membres as PERMISSIVE for SELECT to authenticated using ((user_id = auth.uid()));

create policy "Gestionnaire : sa structure" on structures as PERMISSIVE for SELECT to authenticated using ((id IN ( SELECT structure_membres.structure_id
   FROM structure_membres
  WHERE (structure_membres.user_id = auth.uid()))));

create policy "Gestionnaire : son dossier actif" on structure_membres as PERMISSIVE for UPDATE to authenticated using ((user_id = auth.uid())) with check ((user_id = auth.uid()));

create policy "Insert bornes admin" on bornes as PERMISSIVE for INSERT to public with check (true);

create policy "Insertion alertes" on alertes as PERMISSIVE for INSERT to public with check (true);

create policy "Insertion events" on events as PERMISSIVE for INSERT to public with check (true);

create policy "Insertion famille" on famille as PERMISSIVE for INSERT to public with check (true);

create policy "Insertion intervenants" on intervenants as PERMISSIVE for INSERT to public with check (true);

create policy "Insertion notes" on notes as PERMISSIVE for INSERT to public with check (true);

create policy "Insertion ordonnances" on ordonnances as PERMISSIVE for INSERT to public with check (true);

create policy "Insertion seniors" on seniors as PERMISSIVE for INSERT to public with check (true);

create policy "Intervenants select" on intervenants as PERMISSIVE for SELECT to public using (true);

create policy "Intervenants update own" on intervenants as PERMISSIVE for UPDATE to public using ((auth.uid() = user_id));

create policy "Lecture alertes" on alertes as PERMISSIVE for SELECT to public using (true);

create policy "Lecture bornes publique" on bornes as PERMISSIVE for SELECT to public using (true);

create policy "Lecture code activer famille" on famille as PERMISSIVE for SELECT to public using (true);

create policy "Lecture code activer intervenants" on intervenants as PERMISSIVE for SELECT to public using (true);

create policy "Lecture code famille" on famille as PERMISSIVE for SELECT to public using (true);

create policy "Lecture code intervenants" on intervenants as PERMISSIVE for SELECT to public using (true);

create policy "Lecture famille" on famille as PERMISSIVE for SELECT to public using (true);

create policy "Lecture intervenants" on intervenants as PERMISSIVE for SELECT to public using (true);

create policy "Lecture publique events" on events as PERMISSIVE for SELECT to public using (true);

create policy "Lecture publique famille" on famille as PERMISSIVE for SELECT to public using (true);

create policy "Lecture publique intervenants" on intervenants as PERMISSIVE for SELECT to public using (true);

create policy "Lecture publique notes" on notes as PERMISSIVE for SELECT to public using (true);

create policy "Lecture publique ordonnances" on ordonnances as PERMISSIVE for SELECT to public using (true);

create policy "Lecture publique relances" on relances as PERMISSIVE for SELECT to public using (true);

create policy "Lecture publique seniors" on seniors as PERMISSIVE for SELECT to public using (true);

create policy "Lecture seniors admin" on seniors as PERMISSIVE for SELECT to public using (true);

create policy "Lecture seniors publique" on seniors as PERMISSIVE for SELECT to public using (true);

create policy "Lecture seniors" on seniors as PERMISSIVE for SELECT to public using (true);

create policy "Lecture token famille" on famille as PERMISSIVE for SELECT to public using (true);

create policy "Modification ordonnances" on ordonnances as PERMISSIVE for UPDATE to public using (true);

create policy "Suppression events" on events as PERMISSIVE for DELETE to public using (true);

create policy "Suppression famille" on famille as PERMISSIVE for DELETE to public using (true);

create policy "Suppression intervenants" on intervenants as PERMISSIVE for DELETE to public using (true);

create policy "Suppression ordonnances" on ordonnances as PERMISSIVE for DELETE to public using (true);

create policy "Update alertes" on alertes as PERMISSIVE for UPDATE to public using (true);

create policy "Update famille" on famille as PERMISSIVE for UPDATE to public using (true) with check (true);

create policy "Update intervenants code" on intervenants as PERMISSIVE for UPDATE to public using (true) with check (true);

alter table alertes add constraint alertes_senior_id_fkey FOREIGN KEY (senior_id) REFERENCES seniors(id);

alter table bornes add constraint bornes_code_key UNIQUE (code);

alter table bornes add constraint bornes_senior_id_fkey FOREIGN KEY (senior_id) REFERENCES seniors(id);

alter table demandes_acces add constraint demandes_acces_jeton_key UNIQUE (jeton);

alter table events add constraint events_intervenant_id_fkey FOREIGN KEY (intervenant_id) REFERENCES intervenants(id);

alter table events add constraint events_senior_id_fkey FOREIGN KEY (senior_id) REFERENCES seniors(id);

alter table famille add constraint famille_selected_senior_id_fkey FOREIGN KEY (selected_senior_id) REFERENCES seniors(id);

alter table famille add constraint famille_senior_id_fkey FOREIGN KEY (senior_id) REFERENCES seniors(id);

alter table famille add constraint famille_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

alter table intervenants add constraint intervenants_salarie_id_fkey FOREIGN KEY (salarie_id) REFERENCES salaries(id) ON DELETE SET NULL;

alter table intervenants add constraint intervenants_selected_senior_id_fkey FOREIGN KEY (selected_senior_id) REFERENCES seniors(id);

alter table intervenants add constraint intervenants_senior_id_fkey FOREIGN KEY (senior_id) REFERENCES seniors(id);

alter table intervenants add constraint intervenants_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

alter table notes add constraint notes_intervenant_id_fkey FOREIGN KEY (intervenant_id) REFERENCES intervenants(id);

alter table notes add constraint notes_senior_id_fkey FOREIGN KEY (senior_id) REFERENCES seniors(id);

alter table notes_en_attente add constraint notes_en_attente_senior_id_fkey FOREIGN KEY (senior_id) REFERENCES seniors(id) ON DELETE CASCADE;

alter table ordonnances add constraint ordonnances_senior_id_fkey FOREIGN KEY (senior_id) REFERENCES seniors(id) ON DELETE CASCADE;

alter table relances add constraint relances_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id);

alter table salaries add constraint salaries_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES structures(id) ON DELETE CASCADE;

alter table seniors add constraint seniors_invite_code_key UNIQUE (invite_code);

alter table seniors add constraint seniors_personne_confiance_id_fkey FOREIGN KEY (personne_confiance_id) REFERENCES famille(id) ON DELETE SET NULL;

alter table seniors add constraint seniors_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES structures(id) ON DELETE SET NULL;

alter table signalements_medicaux add constraint signalements_medicaux_destinataire_famille_id_fkey FOREIGN KEY (destinataire_famille_id) REFERENCES famille(id) ON DELETE SET NULL;

alter table signalements_medicaux add constraint signalements_medicaux_senior_id_fkey FOREIGN KEY (senior_id) REFERENCES seniors(id) ON DELETE CASCADE;

alter table structure_membres add constraint structure_membres_invite_token_key UNIQUE (invite_token);

alter table structure_membres add constraint structure_membres_structure_id_email_key UNIQUE (structure_id, email);

alter table structure_membres add constraint structure_membres_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES structures(id) ON DELETE CASCADE;

CREATE INDEX notes_en_attente_numero ON public.notes_en_attente USING btree (numero, created_at DESC);

CREATE OR REPLACE FUNCTION public.proteger_is_admin()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    if tg_op = 'INSERT' and coalesce(new.is_admin, false) then
      raise exception 'is_admin ne peut être attribué que par le serveur';
    end if;
    if tg_op = 'UPDATE' and new.is_admin is distinct from old.is_admin then
      raise exception 'is_admin ne peut être modifié que par le serveur';
    end if;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE TRIGGER proteger_is_admin BEFORE INSERT OR UPDATE ON public.famille FOR EACH ROW EXECUTE FUNCTION proteger_is_admin();
