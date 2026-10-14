-- Plusieurs intervenants par événement de l'agenda.
-- intervenant_ids : la liste complète ; intervenant_id reste rempli avec le premier, pour les lectures existantes.

alter table public.events add column if not exists intervenant_ids uuid[] not null default '{}';

-- Événements existants : leur intervenant devient le premier de la liste
update public.events set intervenant_ids = array[intervenant_id]
where intervenant_id is not null and intervenant_ids = '{}';

create index if not exists events_intervenant_ids on public.events using gin (intervenant_ids);
