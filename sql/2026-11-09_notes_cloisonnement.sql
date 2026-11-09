-- Notes cloisonnées par corps de métier.
-- Le texte d'une note écrite par un intervenant n'est lisible que par les intervenants du même corps de métier,
-- par la famille et par l'admin Holiris. Les autres voient la note (auteur, date) sans son texte.
-- Les notes de la famille (ou d'un auteur sans métier reconnu) restent lisibles par tous.
-- Le serveur (synthèses, résumés, alertes, assistant) lit toujours toutes les notes.

-- 1. Corps de métier d'un rôle saisi librement (« Kiné », « Infirmier·ère », « Cardiologue »…) ; null si non reconnu
create or replace function public.corps_de_metier(role text) returns text
language sql immutable set search_path = public as $$
  select case
    when r ~ '(infirm|soignant)' then 'soins'
    when r ~ '(aide a domicile|aide-menag|aide menag|auxiliaire|aide de vie)' then 'aide'
    when r ~ '(kine|physio)' then 'kine'
    when r ~ '(medecin|docteur|cardio|generaliste|specialiste|geriatre|neuro|pneumo|dermato|rhumato|diabeto|endocrin|psychiatre|ophtalmo|oncolog|urolog|nephro|gastro|chirurgien)' then 'medecin'
    when r ~ 'pharma' then 'pharmacie'
  end
  from (select translate(lower(coalesce(role, '')), 'éèêëàâäîïôöûüç', 'eeeeaaaiioouuc') as r) x
$$;

-- 2. Corps de métier de l'auteur, posé sur la note à son enregistrement (null : note de la famille)
alter table public.notes add column if not exists metier text;
alter table public.notes_supprimees add column if not exists metier text;

create or replace function public.notes_metier() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Toujours calculé ici : l'application ne peut pas choisir qui lira la note
  new.metier := case when new.source = 'famille' then null else public.corps_de_metier(coalesce(
    (select role from intervenants where id = new.intervenant_id),
    nullif(split_part(new.intervenant_name, ' · ', 2), '')
  )) end;
  return new;
end $$;

drop trigger if exists notes_metier on public.notes;
create trigger notes_metier before insert on public.notes for each row execute function public.notes_metier();

-- Notes déjà enregistrées
update public.notes n set metier = case when n.source = 'famille' then null else public.corps_de_metier(coalesce(
  (select role from public.intervenants i where i.id = n.intervenant_id),
  nullif(split_part(n.intervenant_name, ' · ', 2), '')
)) end;
update public.notes_supprimees n set metier = case when n.source = 'famille' then null else public.corps_de_metier(coalesce(
  (select role from public.intervenants i where i.id = n.intervenant_id),
  nullif(split_part(n.intervenant_name, ' · ', 2), '')
)) end;

-- 3. L'utilisateur connecté peut-il lire le texte d'une note de ce corps de métier, sur ce dossier ?
create or replace function public.peut_lire_note(sid uuid, m text) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    m is null
    or public.est_admin()
    or exists (select 1 from famille where user_id = auth.uid() and senior_id = sid and archived_at is null)
    or exists (select 1 from intervenants where user_id = auth.uid() and senior_id = sid and archived_at is null
               and public.corps_de_metier(role) = m)
  )
$$;

-- 4. Table des notes : on ne lit directement que les notes dont on peut lire le texte
drop policy if exists "Notes : lecture" on public.notes;
create policy "Notes : lecture" on public.notes for select to authenticated
  using (acces_senior(senior_id) and peut_lire_note(senior_id, metier));

-- 5. Toutes les notes du dossier, texte et audio masqués quand ils sont réservés à un autre corps de métier
create or replace view public.notes_dossier as
select n.id, n.senior_id, n.intervenant_id, n.intervenant_name, n.source, n.created_at,
       n.modifiee_at, n.modifiee_par_nom, n.langue_originale, n.metier, l.lisible,
       case when l.lisible then n.content end as content,
       case when l.lisible then n.audio_url end as audio_url
from public.notes n
cross join lateral (select public.peut_lire_note(n.senior_id, n.metier) as lisible) l
where public.acces_senior(n.senior_id);

revoke all on public.notes_dossier from public, anon;
grant select on public.notes_dossier to authenticated;
