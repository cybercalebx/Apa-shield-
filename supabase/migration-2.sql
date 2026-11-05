-- APA SHIELD migration 2: alert rules and account deletion.
-- Run this once in the Supabase SQL editor, after schema.sql.

create table if not exists public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  target_id uuid not null references public.monitored_targets (id) on delete cascade,
  rule_type text not null check (rule_type in ('new_breach', 'dns_failure')),
  min_severity text not null default 'any' check (min_severity in ('any', 'high', 'critical')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, target_id, rule_type)
);

alter table public.alert_rules enable row level security;

-- Users can only manage rules for their own accounts, and only for addresses
-- or domains they own.
create policy "Users manage their own alert rules"
  on public.alert_rules
  for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.monitored_targets t
      where t.id = target_id and t.user_id = auth.uid()
    )
  );

-- Lets a signed-in user delete their own account. Deleting the auth user
-- cascades to their monitored addresses, preferences and alert rules.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to delete your account.';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
