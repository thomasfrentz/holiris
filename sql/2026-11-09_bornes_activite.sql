-- Bornes : signe de vie envoyé par la tablette toutes les 2 minutes quand elle est sur l'accueil.
-- L'espace admin montre d'un coup d'œil si la borne est allumée, connectée et à jour.
alter table public.bornes add column if not exists vue_at timestamptz;
alter table public.bornes add column if not exists version_vue text; -- version de l'application chargée sur la tablette
