-- Messages non lus : jusqu'où chaque personne a lu le fil de chaque senior.
-- Mis à jour à l'ouverture de la page Messages ; utilisé par le serveur uniquement.

create table messages_lectures (
  user_id uuid not null,
  senior_id uuid not null references seniors(id) on delete cascade,
  lu_jusqu_a timestamptz not null default now(),
  primary key (user_id, senior_id)
);

alter table messages_lectures enable row level security;
