-- Visio après un SOS : un lien par proche, utilisable une seule fois, valable 30 minutes après le SOS.
-- Le lien active la caméra et le micro de la borne. Utilisé par le serveur uniquement.

create table visio_sos (
  id uuid primary key default gen_random_uuid(),
  senior_id uuid not null references seniors(id) on delete cascade,
  jeton_hash text not null unique,          -- empreinte du jeton du lien (le jeton lui-même n'est pas conservé)
  destinataire text not null,               -- prénom du proche, affiché sur la borne
  canal text not null unique,               -- canal temps réel de la visio, connu de la borne et du proche seulement
  expire_at timestamptz not null,
  utilise_at timestamptz,                   -- lien consommé (une seule utilisation)
  termine_at timestamptz,                   -- visio arrêtée (borne ou proche)
  created_at timestamptz not null default now()
);

create index visio_sos_senior on visio_sos (senior_id, utilise_at desc);

alter table visio_sos enable row level security;
