-- Passages réguliers par corps de métier : des intervenants qui se relaient (deux infirmières en alternance)
-- ou qui n'ont pas de compte ne reçoivent pas la proposition. Holiris regroupe alors leurs notes par métier
-- et propose aux proches qui ont un compte d'ajouter ces passages à l'agenda.
-- intervenant_id reste rempli pour une proposition faite à l'intervenant lui-même, null pour un groupe.
alter table public.propositions_passages alter column intervenant_id drop not null;
alter table public.propositions_passages add column if not exists metier text;                              -- corps de métier (notes.metier) pour un groupe
alter table public.propositions_passages add column if not exists intervenant_ids uuid[] not null default '{}'; -- fiches du groupe, intervenants des passages créés
create index if not exists propositions_passages_metier on public.propositions_passages (senior_id, metier, created_at desc);
