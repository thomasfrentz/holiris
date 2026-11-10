-- Passages venant de l'import du planning d'une structure (« Ma structure » → Importer depuis votre logiciel).
-- Un nouvel import du planning met à jour ou supprime ces passages-là uniquement :
-- ceux saisis à la main dans l'agenda d'un dossier ne sont jamais touchés.
alter table public.events add column if not exists importe boolean not null default false;
create index if not exists events_importe_idx on public.events (senior_id, scheduled_at) where importe;
