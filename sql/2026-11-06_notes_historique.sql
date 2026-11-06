-- Notes : modifications tracées et suppressions conservées.
-- Une note modifiée garde ses textes précédents, avec qui l'a modifiée et quand.
-- Une note supprimée est mise de côté dans notes_supprimees, hors de la table notes :
-- comptes rendus, résumés, alertes et assistant IA ne la lisent plus.
alter table public.notes add column if not exists modifiee_at timestamptz;
alter table public.notes add column if not exists modifiee_par_nom text;

create table if not exists public.notes_modifications (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null, -- sans clé étrangère : l'historique reste lisible après la suppression de la note
  senior_id uuid not null references public.seniors(id) on delete cascade,
  ancien_contenu text not null,
  nouveau_contenu text not null,
  modifiee_par uuid,
  modifiee_par_nom text,
  created_at timestamptz not null default now()
);
create index if not exists notes_modifications_note on public.notes_modifications (note_id, created_at);

create table if not exists public.notes_supprimees (
  id uuid primary key, -- identifiant de la note d'origine
  senior_id uuid not null references public.seniors(id) on delete cascade,
  intervenant_id uuid,
  intervenant_name text,
  content text not null,
  source text,
  audio_url text,
  note_created_at timestamptz not null,
  supprimee_at timestamptz not null default now(),
  supprimee_par uuid,
  supprimee_par_nom text
);
create index if not exists notes_supprimees_senior on public.notes_supprimees (senior_id, supprimee_at desc);

-- Lues et écrites seulement par le serveur (aucune règle d'accès)
alter table public.notes_modifications enable row level security;
alter table public.notes_supprimees enable row level security;

-- Modifier ou supprimer une note passe par le serveur, qui trace l'historique :
-- depuis l'application, on ne peut plus que lire et ajouter des notes
drop policy if exists "Notes : accès" on public.notes;
drop policy if exists "Notes : lecture" on public.notes;
drop policy if exists "Notes : ajout" on public.notes;
create policy "Notes : lecture" on public.notes for select to authenticated using (acces_senior(senior_id));
create policy "Notes : ajout" on public.notes for insert to authenticated with check (acces_senior(senior_id));
