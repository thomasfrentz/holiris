-- Notes dites ou écrites dans une autre langue, traduites en français.
-- La note publiée est en français ; sa langue d'origine est indiquée sur la note.
-- Le texte d'origine est gardé à part, lisible par le serveur seulement (montré aux gestionnaires du dossier).
-- Il n'est pas conservé quand une information médicale a été retirée de la note : le filtre ne lit que le français.
alter table public.notes add column if not exists langue_originale text;
alter table public.notes_supprimees add column if not exists langue_originale text;

-- Note WhatsApp en attente de validation : langue et texte d'origine (sans information médicale)
alter table public.notes_en_attente add column if not exists langue text;
alter table public.notes_en_attente add column if not exists texte_original text;

create table if not exists public.notes_traductions (
  note_id uuid primary key, -- sans clé étrangère : le texte d'origine reste lisible après la suppression de la note
  senior_id uuid not null references public.seniors(id) on delete cascade,
  langue text not null,
  texte_original text not null,
  created_at timestamptz not null default now()
);

-- Lue et écrite seulement par le serveur (aucune règle d'accès)
alter table public.notes_traductions enable row level security;
