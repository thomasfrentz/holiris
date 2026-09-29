-- Adresses : adresse et adresse de facturation de la structure, adresse personnelle des proches

alter table structures add column adresse text;
alter table structures add column adresse_facturation text;

alter table famille add column adresse text;
