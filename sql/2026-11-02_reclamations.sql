-- Réclamations et mécontentements relevés dans les notes, pour les gestionnaires de la structure du senior.
-- Lues et modifiées seulement par le serveur (aucune règle d'accès : ni la famille ni les intervenants ne les voient).
-- La réclamation reste si la note est supprimée : son résumé suffit au suivi.
create table if not exists public.reclamations (
  id uuid primary key default gen_random_uuid(),
  senior_id uuid not null references public.seniors(id) on delete cascade,
  note_id uuid references public.notes(id) on delete set null,
  auteur text,
  resume text not null,
  created_at timestamptz not null default now(),
  traitee_at timestamptz,
  traitee_par uuid
);
create index if not exists reclamations_senior on public.reclamations (senior_id, created_at desc);
alter table public.reclamations enable row level security;
