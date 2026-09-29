-- Notes WhatsApp en attente de validation par leur auteur, comme l'écran de relecture de la borne.
-- Le texte stocké a déjà été filtré : aucune information médicale n'y figure.
-- Une note non validée sous 24 h est supprimée (WhatsApp ne permet plus de répondre librement ensuite).

create table notes_en_attente (
  id uuid primary key default gen_random_uuid(),
  senior_id uuid not null references seniors(id) on delete cascade,
  numero text not null,                       -- numéro WhatsApp de l'auteur, format 33612345678
  auteur jsonb not null,                      -- { type, id, nom, role, telephone, email }
  source text not null,                       -- 'whatsapp_text' | 'whatsapp_audio'
  texte text not null,
  medical boolean not null default false,     -- une information médicale a été retirée
  statut text not null default 'a_valider',   -- a_valider | a_corriger | enregistrement
  created_at timestamptz not null default now()
);

create index notes_en_attente_numero on notes_en_attente (numero, created_at desc);

-- Accessible uniquement par le serveur (clé service_role)
alter table notes_en_attente enable row level security;
