-- Personne de confiance du senior + signalements d'informations médicales
-- Le contenu médical n'est jamais stocké : seulement qui l'a transmis et comment le recontacter.

alter table seniors
  add column personne_confiance_id uuid references famille(id) on delete set null;

create table signalements_medicaux (
  id uuid primary key default gen_random_uuid(),
  senior_id uuid not null references seniors(id) on delete cascade,
  auteur_type text not null,                -- 'intervenant' | 'famille'
  auteur_id uuid,                           -- ligne intervenants ou famille de l'auteur
  auteur_nom text not null,
  auteur_role text,
  auteur_telephone text,
  auteur_email text,
  source text not null,                     -- 'whatsapp' | 'intervenant' | 'famille' | 'borne'
  statut text not null default 'a_confirmer', -- a_confirmer | non_essentiel | a_contacter | contacte
  destinataire_famille_id uuid references famille(id) on delete set null, -- null = admin
  created_at timestamptz not null default now(),
  repondu_at timestamptz,
  contacte_at timestamptz
);

-- Accessible uniquement par le serveur (clé service_role)
alter table signalements_medicaux enable row level security;
