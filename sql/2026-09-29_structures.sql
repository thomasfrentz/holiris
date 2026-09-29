-- Comptes « structure » (SAAD, CCAS…) : leurs gestionnaires ont les droits d'admin,
-- mais uniquement sur les seniors de la structure. Les salariés intervenants ont une fiche
-- unique, affectée à un ou plusieurs seniors.

create table structures (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  created_at timestamptz not null default now()
);

-- Gestionnaires (coordinateurs) d'une structure
create table structure_membres (
  id uuid primary key default gen_random_uuid(),
  structure_id uuid not null references structures(id) on delete cascade,
  email text not null,
  nom text,
  user_id uuid,                     -- rempli à la création du compte
  invite_token text unique,         -- lien d'invitation, effacé une fois utilisé
  selected_senior_id uuid,          -- dernier dossier consulté
  created_at timestamptz not null default now(),
  unique (structure_id, email)
);

-- Salariés intervenants d'une structure (une fiche, plusieurs seniors)
create table salaries (
  id uuid primary key default gen_random_uuid(),
  structure_id uuid not null references structures(id) on delete cascade,
  prenom text not null,
  nom text not null,
  role text,
  telephone text,
  email text not null,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

alter table seniors add column structure_id uuid references structures(id) on delete set null;
alter table intervenants add column salarie_id uuid references salaries(id) on delete set null;

alter table structures enable row level security;
alter table structure_membres enable row level security;
alter table salaries enable row level security;

-- Un gestionnaire connecté lit (et met à jour son dossier actif) sur sa propre fiche,
-- et lit le nom de sa structure. Tout le reste passe par le serveur.
create policy "Gestionnaire : sa fiche" on structure_membres
  for select to authenticated using (user_id = auth.uid());
create policy "Gestionnaire : son dossier actif" on structure_membres
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Gestionnaire : sa structure" on structures
  for select to authenticated using (id in (select structure_id from structure_membres where user_id = auth.uid()));
