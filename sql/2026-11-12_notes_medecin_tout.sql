-- Les médecins d'un dossier lisent toutes ses notes, quel que soit le corps de métier de l'auteur
-- (comme dans le compte rendu de la veille de consultation). Les autres intervenants restent cloisonnés.
create or replace function public.peut_lire_note(sid uuid, m text) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    m is null
    or public.est_admin()
    or exists (select 1 from famille where user_id = auth.uid() and senior_id = sid and archived_at is null)
    or exists (select 1 from intervenants where user_id = auth.uid() and senior_id = sid and archived_at is null
               and (public.corps_de_metier(role) = m or public.corps_de_metier(role) = 'medecin'))
  )
$$;
