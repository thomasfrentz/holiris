-- Schéma complet de la base Holiris, reconstitué le 2026-09-29 depuis l API Supabase.
-- Permet de recréer la base (nouveau projet, environnement de test, migration HDS).
--
-- Limite : NOT NULL n est indiqué que pour les colonnes obligatoires sans valeur par défaut.
-- Les tables sont créées sans clés étrangères (dépendances circulaires entre seniors et famille) :
-- elles sont ajoutées par 0001_regles_et_contraintes.sql.

create table if not exists seniors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  age integer,
  city text,
  status text default 'stable',
  created_at timestamp with time zone default now(),
  invite_code text,
  ordonnance_expiration date,
  date_naissance date,
  personne_confiance_id uuid,
  structure_id uuid
);

create table if not exists famille (
  id uuid primary key default gen_random_uuid(),
  senior_id uuid,
  name text not null,
  email text,
  phone text,
  role text,
  created_at timestamp with time zone default now(),
  user_id uuid,
  whatsapp text,
  is_admin boolean default false,
  selected_senior_id uuid,
  code_acces text,
  archived_at timestamp with time zone,
  invite_token text
);

create table if not exists intervenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null,
  phone text,
  whatsapp text,
  senior_id uuid,
  created_at timestamp with time zone default now(),
  email text,
  user_id uuid,
  selected_senior_id uuid,
  code_acces text,
  archived_at timestamp with time zone,
  invite_token text,
  salarie_id uuid
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  senior_id uuid,
  intervenant_id uuid,
  label text not null,
  scheduled_at timestamp with time zone not null,
  type text not null,
  status text default 'a_venir',
  created_at timestamp with time zone default now(),
  recurrence text,
  recurrence_days text
);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  senior_id uuid,
  intervenant_id uuid,
  content text not null,
  source text default 'manual',
  audio_url text,
  created_at timestamp with time zone default now(),
  intervenant_name text
);

create table if not exists alertes (
  id uuid primary key default gen_random_uuid(),
  senior_id uuid,
  type text not null,
  message text not null,
  niveau text default 'warning',
  lu boolean default false,
  created_at timestamp with time zone default now()
);

create table if not exists ordonnances (
  id uuid primary key default gen_random_uuid(),
  senior_id uuid,
  type_ordonnance text not null,
  date_renouvellement date not null,
  notes text,
  created_at timestamp with time zone default now()
);

create table if not exists relances (
  id uuid primary key default gen_random_uuid(),
  event_id uuid,
  sent_at timestamp with time zone default now(),
  channel text not null,
  status text default 'sent'
);

create table if not exists bornes (
  id uuid primary key default gen_random_uuid(),
  senior_id uuid,
  code text not null,
  created_at timestamp with time zone default now()
);

create table if not exists desinscriptions (
  email text primary key,
  created_at timestamp with time zone default now() not null
);

create table if not exists demandes_acces (
  id uuid primary key default gen_random_uuid(),
  prenom text not null,
  nom text not null,
  email text not null,
  telephone text,
  senior_nom text,
  senior_ville text,
  lien text,
  message text,
  statut text default 'en_attente' not null,
  jeton text,
  user_id uuid,
  created_at timestamp with time zone default now() not null,
  traitee_at timestamp with time zone
);

create table if not exists signalements_medicaux (
  id uuid primary key default gen_random_uuid(),
  senior_id uuid not null,
  auteur_type text not null,
  auteur_id uuid,
  auteur_nom text not null,
  auteur_role text,
  auteur_telephone text,
  auteur_email text,
  source text not null,
  statut text default 'a_confirmer' not null,
  destinataire_famille_id uuid,
  created_at timestamp with time zone default now() not null,
  repondu_at timestamp with time zone,
  contacte_at timestamp with time zone
);

create table if not exists notes_en_attente (
  id uuid primary key default gen_random_uuid(),
  senior_id uuid not null,
  numero text not null,
  auteur jsonb not null,
  source text not null,
  texte text not null,
  medical boolean default false not null,
  statut text default 'a_valider' not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists structures (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists structure_membres (
  id uuid primary key default gen_random_uuid(),
  structure_id uuid not null,
  email text not null,
  nom text,
  user_id uuid,
  invite_token text,
  selected_senior_id uuid,
  created_at timestamp with time zone default now() not null
);

create table if not exists salaries (
  id uuid primary key default gen_random_uuid(),
  structure_id uuid not null,
  prenom text not null,
  nom text not null,
  role text,
  telephone text,
  email text not null,
  archived_at timestamp with time zone,
  created_at timestamp with time zone default now() not null
);

-- Les clés étrangères, contraintes « unique », index, fonctions et triggers exacts sont dans
-- 0001_regles_et_contraintes.sql.
