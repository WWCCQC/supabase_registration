create table public.contract_c (
  partner_name text,
  depot_code text,
  active_status text,
  contract_status text,
  contract_start_date text,
  contract_end_date text,
  contract_no text,
  rbm text,
  total_contract_guarantee_amount text,
  contract_technician_team_count text,
  bg_status text,
  installation_status text,
  email text,
  company_registration_no text primary key,
  uuid text not null unique default gen_random_uuid()::text,
  create_at text not null default to_char(statement_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
  update_at text not null default to_char(statement_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
);

create function public.contract_c_set_update_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.update_at := to_char(statement_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
  return new;
end;
$$;

revoke all on function public.contract_c_set_update_at() from public, anon, authenticated;

create trigger contract_c_update_timestamp
before update on public.contract_c
for each row execute function public.contract_c_set_update_at();

alter table public.contract_c enable row level security;
revoke all on table public.contract_c from public, anon, authenticated;
grant select on table public.contract_c to authenticated;
grant all on table public.contract_c to service_role;

create policy contract_c_read on public.contract_c
for select to authenticated using (true);

