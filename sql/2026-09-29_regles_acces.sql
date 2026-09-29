-- Règles d'accès (RLS) : chacun ne voit et ne modifie que les dossiers des seniors qu'il suit.
--
-- Avant : les tables seniors et famille n'étaient pas protégées, et les autres avaient des règles
-- « true » (tout le monde, même sans connexion, pouvait tout lire et tout modifier avec la clé
-- publique du site).
-- Après : il faut être connecté ET suivre le senior : proche, intervenant, gestionnaire de sa
-- structure, ou admin Holiris. Les traitements serveur (clé service_role) ne sont pas concernés.
--
-- Retour arrière en cas de problème : sql/2026-09-29_regles_acces_retour.sql

-- 1. Fonctions d'accès. « security definer » : elles lisent les tables sans être soumises aux
--    règles, ce qui évite qu'une règle sur famille dépende d'elle-même.
create or replace function public.est_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from famille where user_id = auth.uid() and is_admin and archived_at is null)
$$;

create or replace function public.acces_senior(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    public.est_admin()
    or exists (select 1 from famille where user_id = auth.uid() and senior_id = sid and archived_at is null)
    or exists (select 1 from intervenants where user_id = auth.uid() and senior_id = sid and archived_at is null)
    or exists (select 1 from structure_membres m join seniors s on s.structure_id = m.structure_id
               where m.user_id = auth.uid() and s.id = sid)
  )
$$;

-- 2. Suppression des anciennes règles ouvertes
do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies
           where schemaname = 'public'
             and tablename in ('seniors', 'famille', 'intervenants', 'notes', 'events', 'alertes', 'ordonnances', 'bornes', 'relances')
  loop
    execute format('drop policy %I on %I', p.policyname, p.tablename);
  end loop;
end $$;

-- 3. Protection activée sur toutes ces tables (relances : serveur uniquement, aucune règle)
alter table seniors enable row level security;
alter table famille enable row level security;
alter table intervenants enable row level security;
alter table notes enable row level security;
alter table events enable row level security;
alter table alertes enable row level security;
alter table ordonnances enable row level security;
alter table bornes enable row level security;
alter table relances enable row level security;

-- 4. Nouvelles règles, pour les utilisateurs connectés uniquement
-- Seniors : visibles et modifiables par ceux qui les suivent ; création et suppression par l'admin
-- (les familles et les structures créent leurs dossiers par le serveur)
create policy "Seniors : lecture" on seniors for select to authenticated using (acces_senior(id));
create policy "Seniors : modification" on seniors for update to authenticated using (acces_senior(id)) with check (acces_senior(id));
create policy "Seniors : création admin" on seniors for insert to authenticated with check (est_admin());
create policy "Seniors : suppression admin" on seniors for delete to authenticated using (est_admin());

-- Famille et intervenants : sa propre fiche, et les fiches des seniors que l'on suit
create policy "Famille : lecture" on famille for select to authenticated using (user_id = auth.uid() or acces_senior(senior_id));
create policy "Famille : ajout" on famille for insert to authenticated with check (acces_senior(senior_id));
create policy "Famille : modification" on famille for update to authenticated
  using (user_id = auth.uid() or acces_senior(senior_id)) with check (user_id = auth.uid() or acces_senior(senior_id));
create policy "Famille : suppression" on famille for delete to authenticated using (acces_senior(senior_id));

create policy "Intervenants : lecture" on intervenants for select to authenticated using (user_id = auth.uid() or acces_senior(senior_id));
create policy "Intervenants : ajout" on intervenants for insert to authenticated with check (acces_senior(senior_id));
create policy "Intervenants : modification" on intervenants for update to authenticated
  using (user_id = auth.uid() or acces_senior(senior_id)) with check (user_id = auth.uid() or acces_senior(senior_id));
create policy "Intervenants : suppression" on intervenants for delete to authenticated using (acces_senior(senior_id));

-- Notes, agenda, alertes, ordonnances, bornes : tout ce qui concerne un senior que l'on suit
create policy "Notes : accès" on notes for all to authenticated using (acces_senior(senior_id)) with check (acces_senior(senior_id));
create policy "Agenda : accès" on events for all to authenticated using (acces_senior(senior_id)) with check (acces_senior(senior_id));
create policy "Alertes : accès" on alertes for all to authenticated using (acces_senior(senior_id)) with check (acces_senior(senior_id));
create policy "Ordonnances : accès" on ordonnances for all to authenticated using (acces_senior(senior_id)) with check (acces_senior(senior_id));
create policy "Bornes : accès" on bornes for all to authenticated using (acces_senior(senior_id)) with check (acces_senior(senior_id));
