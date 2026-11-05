-- APA SHIELD migration 3: email verification.
-- Run once in the Supabase SQL editor, after migration-2.sql.

create table if not exists public.verification_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  target_id uuid not null references public.monitored_targets (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- Locked down: no policies, so only the Edge Functions (service role) can use it.
alter table public.verification_tokens enable row level security;
