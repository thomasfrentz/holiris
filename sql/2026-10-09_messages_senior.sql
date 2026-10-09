-- Messages d'un proche au senior, lus (ou écoutés) sur la borne.
-- Privés : seuls l'auteur (sur le site) et le senior (sur la borne) les voient. Tout passe par le serveur.
-- Nom « messages_au_senior » : « messages_senior » est déjà le nom d'un index de la table messages.

create table if not exists public.messages_au_senior (
  id uuid primary key default gen_random_uuid(),
  senior_id uuid not null references public.seniors(id) on delete cascade,
  auteur_user_id uuid not null,
  auteur_famille_id uuid references public.famille(id) on delete set null,
  auteur_nom text not null,
  type text not null check (type in ('texte', 'vocal')),
  contenu text,                 -- message écrit
  audio_path text,              -- message vocal : fichier dans le stockage « messages-vocaux » (supprimé après lecture ou 7 jours)
  audio_type text,
  duree integer,                -- secondes
  created_at timestamptz not null default now(),
  lu_at timestamptz             -- « Lu » touché sur la borne
);

create index if not exists messages_au_senior_borne on public.messages_au_senior (senior_id, created_at) where lu_at is null;
create index if not exists messages_au_senior_auteur on public.messages_au_senior (auteur_user_id, senior_id, created_at);

-- Aucune lecture directe depuis le navigateur : pas de politique, seul le serveur y accède
alter table public.messages_au_senior enable row level security;
grant all on public.messages_au_senior to service_role;

-- Stockage privé des messages vocaux (déjà créé le 9 octobre 2026)
insert into storage.buckets (id, name, public) values ('messages-vocaux', 'messages-vocaux', false)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
