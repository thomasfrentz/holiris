-- Messages privés : un message adressé à une personne (destinataire_id renseigné) n'est lisible
-- que par son auteur et par le compte de la fiche destinataire. Les messages « à tout le monde » restent
-- lisibles par tous ceux qui suivent le senior. S'applique aussi à l'affichage en direct (Realtime).

-- La fiche destinataire (famille ou intervenant) appartient-elle au compte connecté ?
create or replace function public.message_pour_moi(dest uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from famille where id = dest and user_id = auth.uid())
      or exists (select 1 from intervenants where id = dest and user_id = auth.uid())
$$;

drop policy if exists "Messages : lecture" on messages;
create policy "Messages : lecture" on messages for select to authenticated using (
  acces_senior(senior_id) and (
    destinataire_id is null
    or auteur_user_id = auth.uid()
    or message_pour_moi(destinataire_id)
  )
);
