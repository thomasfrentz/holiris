-- Messages adressés à une personne : le message reste dans le fil commun (visible par tous),
-- seul le destinataire est notifié ; s'il s'agit d'un intervenant, la borne l'annonce le jour de son rendez-vous.

alter table messages add column destinataire_type text;      -- 'famille' | 'intervenant' (null = tout le monde)
alter table messages add column destinataire_id uuid;        -- fiche famille ou intervenant
alter table messages add column destinataire_nom text;
alter table messages add column lu_borne_at timestamptz;     -- « Lu » touché sur la borne

create index messages_destinataire on messages (destinataire_id) where destinataire_id is not null;
