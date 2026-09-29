-- Le rôle admin (famille.is_admin) ne peut être attribué ou retiré que par le serveur Holiris
-- (clé service_role) ou depuis l'éditeur SQL. Les requêtes faites avec la clé publique du site
-- ne peuvent plus le modifier.

create or replace function proteger_is_admin() returns trigger
language plpgsql as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    if tg_op = 'INSERT' and coalesce(new.is_admin, false) then
      raise exception 'is_admin ne peut être attribué que par le serveur';
    end if;
    if tg_op = 'UPDATE' and new.is_admin is distinct from old.is_admin then
      raise exception 'is_admin ne peut être modifié que par le serveur';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists proteger_is_admin on famille;
create trigger proteger_is_admin
  before insert or update on famille
  for each row execute function proteger_is_admin();
