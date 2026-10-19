-- Relances WhatsApp aux intervenants : l'intervenant relancé et, en cas d'échec, la raison donnée par Meta
alter table public.relances add column if not exists intervenant_id uuid references public.intervenants(id) on delete set null;
alter table public.relances add column if not exists erreur text;
