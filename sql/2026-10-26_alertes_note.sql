-- Alertes : lien vers la note qui les a déclenchées.
-- Supprimer une note supprime aussi les alertes et points à surveiller qu'elle a créés,
-- pour que l'analyse des notes suivantes ne s'appuie pas sur un fait retiré.
alter table public.alertes add column if not exists note_id uuid references public.notes(id) on delete cascade;
create index if not exists alertes_note on public.alertes (note_id);
