-- Notes cloisonnées (2026-11-09_notes_cloisonnement.sql) : le gestionnaire de la structure du senior
-- lit aussi le texte de toutes les notes. Dans le carnet, il peut n'afficher que les notes de ses salariés
-- (choix gardé sur sa fiche jusqu'à ce qu'il le désactive).
create or replace function public.peut_lire_note(sid uuid, m text) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    m is null
    or public.est_admin()
    or exists (select 1 from famille where user_id = auth.uid() and senior_id = sid and archived_at is null)
    or exists (select 1 from structure_membres sm join seniors s on s.structure_id = sm.structure_id
               where sm.user_id = auth.uid() and s.id = sid)
    or exists (select 1 from intervenants where user_id = auth.uid() and senior_id = sid and archived_at is null
               and public.corps_de_metier(role) = m)
  )
$$;

-- Modifiable par le gestionnaire sur sa propre fiche (règle « Gestionnaire : son dossier actif »)
alter table public.structure_membres add column if not exists carnet_mes_salaries boolean not null default false;
