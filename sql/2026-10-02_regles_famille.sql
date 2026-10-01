-- Fiches famille et intervenants : règles d'accès resserrées.
--
-- 1. Modifier ou supprimer la fiche d'un proche : réservé à l'admin, aux gestionnaires de la structure
--    du senior et à sa personne de confiance (chacun peut toujours modifier sa propre fiche : profil,
--    dossier actif). Avant, tout proche du senior pouvait le faire en passant directement par la base.
-- 2. Le rattachement d'une fiche (senior suivi, compte associé) ne peut plus être changé depuis le site :
--    seul le serveur Holiris (clé service_role) ou l'éditeur SQL le peut. Avant, un utilisateur pouvait
--    rattacher sa propre fiche à un autre senior et accéder à son dossier.

create or replace function public.peut_modifier_famille(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    public.est_admin()
    or exists (select 1 from structure_membres m join seniors s on s.structure_id = m.structure_id
               where m.user_id = auth.uid() and s.id = sid)
    or exists (select 1 from seniors s join famille f on f.id = s.personne_confiance_id
               where s.id = sid and f.user_id = auth.uid() and f.archived_at is null)
  )
$$;

drop policy if exists "Famille : modification" on famille;
create policy "Famille : modification" on famille for update to authenticated
  using (user_id = auth.uid() or public.peut_modifier_famille(senior_id))
  with check (user_id = auth.uid() or public.peut_modifier_famille(senior_id));

drop policy if exists "Famille : suppression" on famille;
create policy "Famille : suppression" on famille for delete to authenticated
  using (public.peut_modifier_famille(senior_id));

create or replace function proteger_rattachement() returns trigger
language plpgsql as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin')
     and (new.senior_id is distinct from old.senior_id or new.user_id is distinct from old.user_id) then
    raise exception 'Le rattachement d''une fiche ne peut être modifié que par le serveur';
  end if;
  return new;
end $$;

drop trigger if exists proteger_rattachement on famille;
create trigger proteger_rattachement
  before update on famille
  for each row execute function proteger_rattachement();

drop trigger if exists proteger_rattachement on intervenants;
create trigger proteger_rattachement
  before update on intervenants
  for each row execute function proteger_rattachement();
