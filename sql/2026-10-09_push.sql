-- Notifications sur téléphone (web push) : un abonnement par navigateur ou application installée.
-- Rattaché à un compte (user_id) ou, pour un intervenant sans compte, au lien de sa borne sur téléphone (jeton_mobile).

create table if not exists public.push_abonnements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  jeton_mobile text,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  check (user_id is not null or jeton_mobile is not null)
);

create index if not exists push_abonnements_user on public.push_abonnements (user_id) where user_id is not null;
create index if not exists push_abonnements_jeton on public.push_abonnements (jeton_mobile) where jeton_mobile is not null;

-- Aucun accès depuis le navigateur : seul le serveur lit et écrit
alter table public.push_abonnements enable row level security;
grant all on public.push_abonnements to service_role;

notify pgrst, 'reload schema';
