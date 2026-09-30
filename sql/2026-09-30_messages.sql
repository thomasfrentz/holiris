-- Fil de discussion par senior : famille, intervenants et gestionnaires de sa structure.
-- Les messages sont écrits par le serveur (filtre médical, notifications) ; chacun lit le fil
-- des seniors qu'il suit, en direct.

create table messages (
  id uuid primary key default gen_random_uuid(),
  senior_id uuid not null references seniors(id) on delete cascade,
  auteur_user_id uuid not null,
  auteur_nom text not null,
  auteur_role text,
  contenu text not null,
  created_at timestamptz not null default now()
);
create index messages_senior on messages (senior_id, created_at desc);

-- Dernier email « nouveau message » envoyé à une personne pour un senior (un par heure au plus)
create table notifications_messages (
  senior_id uuid not null references seniors(id) on delete cascade,
  email text not null,
  envoye_at timestamptz not null default now(),
  primary key (senior_id, email)
);

alter table messages enable row level security;
alter table notifications_messages enable row level security;

-- Lecture du fil par ceux qui suivent le senior (fonction créée par 2026-09-29_regles_acces.sql)
create policy "Messages : lecture" on messages for select to authenticated using (acces_senior(senior_id));

-- Affichage en direct
alter publication supabase_realtime add table messages;
