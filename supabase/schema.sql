-- APA SHIELD: notification accounts and settings.
-- Run this once in the Supabase SQL editor.

create table if not exists public.monitored_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('email', 'domain')),
  value text not null check (char_length(value) between 3 and 255),
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, kind, value)
);

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  enabled boolean not null default true,
  email_alerts boolean not null default true,
  threat_alerts boolean not null default true,
  scan_complete boolean not null default true,
  security_updates boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.monitored_targets enable row level security;
alter table public.notification_preferences enable row level security;

create policy "Users manage their own monitored targets"
  on public.monitored_targets
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own notification preferences"
  on public.notification_preferences
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Only the server (service role) may mark an address as verified.
-- Users cannot set verified = true from the browser: the policy above allows
-- inserts, so this trigger forces new rows to start unverified.
create or replace function public.force_unverified()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.verified := false;
  end if;
  if tg_op = 'UPDATE' and auth.role() <> 'service_role' then
    new.verified := old.verified;
  end if;
  return new;
end;
$$;

drop trigger if exists monitored_targets_force_unverified on public.monitored_targets;
create trigger monitored_targets_force_unverified
  before insert or update on public.monitored_targets
  for each row execute function public.force_unverified();
