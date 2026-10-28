-- Notes : rattachement à la fiche de l'intervenant qui les a laissées.
-- Le « dernier passage » du tableau de bord se calcule aussi à partir de ces notes : le planning devient facultatif.
-- Les nouvelles notes sont rattachées à l'enregistrement ; ce script rattache les anciennes,
-- quand le nom de l'auteur (« Nadia Benali · Aide à domicile ») correspond à un intervenant du même dossier.
update public.notes n
set intervenant_id = i.id
from public.intervenants i
where n.intervenant_id is null
  and i.senior_id = n.senior_id
  and i.name = split_part(n.intervenant_name, ' · ', 1);

create index if not exists notes_intervenant on public.notes (senior_id, created_at desc) where intervenant_id is not null;
