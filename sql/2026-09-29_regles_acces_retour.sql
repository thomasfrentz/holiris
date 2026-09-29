-- RETOUR ARRIÈRE de sql/2026-09-29_regles_acces.sql, à n'utiliser qu'en cas de problème.
-- Rétablit l'accès ouvert d'avant (tout le monde peut lire et modifier avec la clé publique),
-- le temps de corriger. La protection de is_admin (trigger) reste en place.

do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies
           where schemaname = 'public'
             and tablename in ('seniors', 'famille', 'intervenants', 'notes', 'events', 'alertes', 'ordonnances', 'bornes', 'relances')
  loop
    execute format('drop policy %I on %I', p.policyname, p.tablename);
  end loop;
end $$;

create policy "Ouvert (temporaire)" on seniors for all to public using (true) with check (true);
create policy "Ouvert (temporaire)" on famille for all to public using (true) with check (true);
create policy "Ouvert (temporaire)" on intervenants for all to public using (true) with check (true);
create policy "Ouvert (temporaire)" on notes for all to public using (true) with check (true);
create policy "Ouvert (temporaire)" on events for all to public using (true) with check (true);
create policy "Ouvert (temporaire)" on alertes for all to public using (true) with check (true);
create policy "Ouvert (temporaire)" on ordonnances for all to public using (true) with check (true);
create policy "Ouvert (temporaire)" on bornes for all to public using (true) with check (true);
