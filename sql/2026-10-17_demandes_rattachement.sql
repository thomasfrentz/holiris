-- Rattachement d'un senior existant à une structure, avec l'accord de sa famille.
-- La structure donne le nom du senior et l'email d'un proche ; si ce proche suit bien ce senior,
-- il reçoit un lien (jeton, conservé haché) pour accepter ou refuser.

create table if not exists public.demandes_rattachement (
  id uuid primary key default gen_random_uuid(),
  structure_id uuid not null references public.structures(id) on delete cascade,
  demandeur_user_id uuid,
  senior_nom text not null,
  email_proche text not null,
  senior_id uuid references public.seniors(id) on delete cascade,
  famille_id uuid references public.famille(id) on delete set null,
  jeton_hash text unique,
  statut text not null default 'en_attente' check (statut in ('en_attente', 'acceptee', 'refusee')),
  created_at timestamptz not null default now(),
  traitee_at timestamptz
);

create index if not exists demandes_rattachement_structure on public.demandes_rattachement (structure_id, created_at desc);

-- Aucun accès depuis le navigateur : seul le serveur lit et écrit
alter table public.demandes_rattachement enable row level security;
grant all on public.demandes_rattachement to service_role;
