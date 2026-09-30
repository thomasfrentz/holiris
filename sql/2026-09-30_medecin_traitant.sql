-- Médecin traitant : désigné sur le dossier du senior (un intervenant), et suivi de l'envoi
-- du compte rendu la veille de chaque consultation (rendez-vous « Médical » de l'agenda).

alter table seniors add column medecin_traitant_id uuid references intervenants(id) on delete set null;
alter table events add column compte_rendu_envoye_at timestamptz;
