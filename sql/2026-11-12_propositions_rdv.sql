-- Rendez-vous mentionnés dans une note ou un message (« RDV chez le dentiste jeudi à 14 h ») :
-- Holiris propose de les ajouter à l'agenda, en un clic, à ceux qui peuvent lire la note ou le message.
-- Écritures et lectures par le serveur uniquement.
create table if not exists public.propositions_rdv (
  id uuid primary key default gen_random_uuid(),
  senior_id uuid not null references public.seniors(id) on delete cascade,
  note_id uuid references public.notes(id) on delete cascade,
  message_id uuid references public.messages(id) on delete cascade,
  libelle text not null,
  type text not null default 'care',          -- type de l'agenda : 'medical' | 'kine' | 'pharmacy' | 'care'
  date date not null,                         -- jour du rendez-vous (Paris)
  heure text,                                 -- 'HH:MM' (Paris), null si le texte ne la donne pas
  statut text not null default 'proposee',    -- 'proposee' | 'ajoutee' | 'ignoree'
  event_id uuid references public.events(id) on delete set null,
  repondu_par uuid,
  repondu_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists propositions_rdv_senior on public.propositions_rdv (senior_id, date);
alter table public.propositions_rdv enable row level security;
grant all on public.propositions_rdv to service_role;
