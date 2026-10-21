-- Messagerie : groupes de discussion nommés, type d'auteur, et accusés de lecture par message.
-- Un message de groupe n'est lisible que par les membres du groupe. Les écritures passent par le serveur.

-- 1. Groupes et membres (comptes connectés)
create table if not exists public.groupes_discussion (
  id uuid primary key default gen_random_uuid(),
  senior_id uuid not null references public.seniors(id) on delete cascade,
  nom text not null,
  cree_par uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists groupes_discussion_senior on public.groupes_discussion (senior_id);

create table if not exists public.groupes_membres (
  groupe_id uuid not null references public.groupes_discussion(id) on delete cascade,
  user_id uuid not null,
  primary key (groupe_id, user_id)
);
create index if not exists groupes_membres_user on public.groupes_membres (user_id);

-- Le compte connecté est-il membre du groupe ? (security definer : évite les règles récursives)
create or replace function public.membre_groupe(g uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from groupes_membres where groupe_id = g and user_id = auth.uid())
$$;

alter table public.groupes_discussion enable row level security;
alter table public.groupes_membres enable row level security;
grant all on public.groupes_discussion, public.groupes_membres to service_role;

drop policy if exists "Groupes : lecture" on public.groupes_discussion;
create policy "Groupes : lecture" on public.groupes_discussion for select to authenticated
  using (acces_senior(senior_id) and membre_groupe(id));

drop policy if exists "Groupes : membres" on public.groupes_membres;
create policy "Groupes : membres" on public.groupes_membres for select to authenticated
  using (membre_groupe(groupe_id));

-- 2. Messages : groupe et type d'auteur ('famille' | 'intervenant' | 'structure')
alter table public.messages add column if not exists groupe_id uuid references public.groupes_discussion(id) on delete cascade;
alter table public.messages add column if not exists auteur_type text;
create index if not exists messages_groupe on public.messages (groupe_id) where groupe_id is not null;

drop policy if exists "Messages : lecture" on public.messages;
create policy "Messages : lecture" on public.messages for select to authenticated using (
  acces_senior(senior_id) and (
    (groupe_id is not null and membre_groupe(groupe_id))
    or (groupe_id is null and (
      destinataire_id is null
      or auteur_user_id = auth.uid()
      or message_pour_moi(destinataire_id)
    ))
  )
);

-- 3. Accusés de lecture : qui a lu chaque message, et quand (la première lecture est conservée)
create table if not exists public.messages_lus (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null,
  lu_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

alter table public.messages_lus enable row level security;
grant all on public.messages_lus to service_role;

-- Chacun voit ses propres lectures, et l'auteur d'un message voit qui l'a lu
drop policy if exists "Lectures : lecture" on public.messages_lus;
create policy "Lectures : lecture" on public.messages_lus for select to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from public.messages m where m.id = message_id and m.auteur_user_id = auth.uid())
);

-- Affichage en direct des accusés de lecture
alter publication supabase_realtime add table public.messages_lus;

notify pgrst, 'reload schema';
