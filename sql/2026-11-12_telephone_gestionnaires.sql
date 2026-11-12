-- Téléphone des gestionnaires de structure : saisi par l'admin Holiris (onglet Structures)
-- ou par le gestionnaire lui-même (« Ma structure » → Gestionnaires). Écritures par le serveur.
alter table public.structure_membres add column if not exists telephone text;
