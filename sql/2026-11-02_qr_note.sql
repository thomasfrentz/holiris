-- QR code Holiris (le même partout) : ouvre sur n'importe quel téléphone une page qui permet seulement
-- de laisser une note, sans compte. La personne y tape le code du senior, affiché à côté du QR code chez lui.
-- Le changer rend l'ancien code inutilisable.
alter table seniors add column if not exists code_note text;
create unique index if not exists seniors_code_note on seniors (code_note) where code_note is not null;
