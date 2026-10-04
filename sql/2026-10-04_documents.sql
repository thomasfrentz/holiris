-- Documents signés électroniquement par le senior (ou son représentant légal) :
-- conditions d'utilisation, autorisations, personne de confiance. Utilisé par le serveur uniquement.

create table documents_signes (
  id uuid primary key default gen_random_uuid(),
  senior_id uuid not null references seniors(id) on delete cascade,
  type text not null,                      -- 'cgu' | 'autorisations' | 'personne_confiance'
  version text not null,                   -- version du modèle de document
  statut text not null default 'en_attente', -- 'en_attente' | 'signe' | 'annule'
  jeton_hash text unique,                  -- empreinte du lien de signature (usage unique)
  expire_at timestamptz,
  demande_par uuid,                        -- compte qui a préparé la signature
  contenu jsonb,                           -- texte exact présenté et signé
  choix jsonb,                             -- réponses (autorisations accordées ou refusées)
  signataire_nom text,
  signataire_qualite text,                 -- 'personne' ou qualité du représentant (tuteur, curateur…)
  signature text,                          -- tracé de la signature (image PNG en base64)
  empreinte text,                          -- SHA-256 du document signé (preuve d'intégrité)
  ip text,
  appareil text,
  signe_at timestamptz,
  created_at timestamptz not null default now()
);

create index documents_signes_senior on documents_signes (senior_id, type, signe_at desc);

alter table documents_signes enable row level security;
