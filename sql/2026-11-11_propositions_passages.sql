-- Passages réguliers : un intervenant qui laisse des notes chez un senior à jours et heures réguliers,
-- sans passage à l'agenda, reçoit de Holiris un message privé lui proposant de créer ces passages.
-- La proposition est acceptée ou refusée en un clic dans la messagerie. Écritures par le serveur uniquement.
create table if not exists public.propositions_passages (
  id uuid primary key default gen_random_uuid(),
  intervenant_id uuid not null references public.intervenants(id) on delete cascade,
  senior_id uuid not null references public.seniors(id) on delete cascade,
  jours text not null,                       -- jours de la semaine, ex. '2,4' (0 = dimanche, comme l'agenda)
  heure text not null,                       -- 'HH:MM', heure de Paris
  statut text not null default 'proposee',   -- 'proposee' | 'acceptee' | 'refusee'
  passages_crees integer,
  created_at timestamptz not null default now(),
  repondu_at timestamptz
);
create index if not exists propositions_passages_fiche on public.propositions_passages (intervenant_id, senior_id, created_at desc);
alter table public.propositions_passages enable row level security;
grant all on public.propositions_passages to service_role;

-- Message de Holiris qui porte la proposition (bouton « Ajouter à l'agenda » dans la messagerie)
alter table public.messages add column if not exists proposition_id uuid references public.propositions_passages(id) on delete set null;
