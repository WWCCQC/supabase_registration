-- Run once in the Registration Supabase project.
create table public.admin_tol (
  uuid uuid primary key default gen_random_uuid(),
  province text,
  depot_code text,
  sub_name text,
  staff_code text,
  staff_name text,
  email text,
  phone_no text,
  image text,
  new_image text,
  region text,
  admin_status text,
  admin_grade text,
  sub_status text,
  remark text,
  last_update text,
  om_name text,
  inspection_issue_remark text,
  status_zsmart text,
  function_provider text,
  function_admin text,
  admin_install text,
  admin_repair text,
  staff_name_eng text,
  training_date text,
  training_attendance_count text,
  refresh_attendance_count text,
  note text,
  start_date text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.set_admin_tol_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_admin_tol_updated_at
before update on public.admin_tol
for each row
execute function public.set_admin_tol_updated_at();

revoke all on public.admin_tol from anon, authenticated;
grant select on public.admin_tol to authenticated;
grant all on public.admin_tol to service_role;
revoke execute on function public.set_admin_tol_updated_at() from public, anon, authenticated;

alter table public.admin_tol enable row level security;

create policy "Signed-in users can read admin_tol"
on public.admin_tol
for select
to authenticated
using (
  (select auth.uid()) is not null
  and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
);

-- For a future full refresh, remove rows only; the table and columns remain.
-- Run this separately before re-importing a CSV:
-- truncate table public.admin_tol;
