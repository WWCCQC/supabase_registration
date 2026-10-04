-- Run once in the Registration Supabase project.
create table public.admin_sale (
  uuid uuid primary key default gen_random_uuid(),
  "timestamp" text,
  national_id text,
  full_name text,
  depot_code text,
  store_code_100xxx text,
  code_39xxx text,
  dealer_name text,
  phone_no text,
  image text,
  store_email text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.set_admin_sale_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_admin_sale_updated_at
before update on public.admin_sale
for each row
execute function public.set_admin_sale_updated_at();

revoke all on public.admin_sale from anon, authenticated;
grant select on public.admin_sale to authenticated;
grant all on public.admin_sale to service_role;
revoke execute on function public.set_admin_sale_updated_at() from public, anon, authenticated;

alter table public.admin_sale enable row level security;

create policy "Signed-in users can read admin_sale"
on public.admin_sale
for select
to authenticated
using (
  (select auth.uid()) is not null
  and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
);

-- For a future full refresh, remove only rows; the table and columns remain.
-- Run separately before re-importing a CSV:
-- truncate table public.admin_sale;
