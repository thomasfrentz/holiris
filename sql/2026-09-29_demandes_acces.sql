-- Demandes d'accès à Holiris : une nouvelle famille demande un accès, l'admin valide

create table demandes_acces (
  id uuid primary key default gen_random_uuid(),
  prenom text not null,
  nom text not null,
  email text not null,
  telephone text,
  senior_nom text,                          -- proche concerné
  senior_ville text,
  lien text,                                -- lien avec le proche (fils, fille…)
  message text,
  statut text not null default 'en_attente', -- en_attente | validee | refusee | inscrite
  jeton text unique,                        -- lien d'inscription envoyé après validation
  user_id uuid,                             -- compte créé avec ce lien
  created_at timestamptz not null default now(),
  traitee_at timestamptz
);

-- Accessible uniquement par le serveur (clé service_role)
alter table demandes_acces enable row level security;
