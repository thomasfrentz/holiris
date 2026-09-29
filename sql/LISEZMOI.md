# Scripts SQL de la base Holiris (Supabase)

## Recréer une base neuve
Dans l'éditeur SQL de Supabase, exécuter dans cet ordre :
1. `0000_schema_complet.sql` : les 16 tables et leurs colonnes
2. `0001_regles_et_contraintes.sql` : clés étrangères, contraintes, index, fonctions, triggers
3. `2026-09-29_regles_acces.sql` : règles d'accès sécurisées (remplacent les anciennes règles ouvertes)

## Historique
Les autres scripts datés sont l'historique des changements, dans l'ordre où ils ont été appliqués
à la base de production. Ils sont déjà inclus dans les fichiers 0000 et 0001 : inutile de les
relancer sur une base neuve.

- `2026-09-28_personne_confiance.sql` : personne de confiance, signalements médicaux
- `2026-09-29_demandes_acces.sql` : demandes d'accès validées par l'admin
- `2026-09-29_protection_admin.sql` : is_admin modifiable uniquement par le serveur
- `2026-09-29_notes_en_attente.sql` : validation des notes WhatsApp par leur auteur
- `2026-09-29_structures.sql` : comptes structure (SAAD, CCAS…)
- `2026-09-29_regles_acces.sql` : règles d'accès sécurisées
- `2026-09-29_regles_acces_retour.sql` : retour arrière des règles d'accès (en cas de problème uniquement)

## Garder ces fichiers
Ils ne servent pas au fonctionnement de l'application, mais permettent de recréer la base
(nouveau projet, environnement de test, migration vers un hébergeur HDS) et documentent son évolution.
