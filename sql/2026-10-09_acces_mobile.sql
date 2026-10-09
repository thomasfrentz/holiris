-- Borne sur téléphone : un intervenant sans compte laisse ses notes depuis son téléphone.
-- Le jeton est partagé par toutes les fiches d'un même numéro (un salarié suivi chez plusieurs seniors) ;
-- il ne disparaît pas à la création d'un compte, contrairement à invite_token.

alter table intervenants add column jeton_mobile text;

create index intervenants_jeton_mobile on intervenants (jeton_mobile) where jeton_mobile is not null;
