-- Permit the read-only Allconnect report role in the existing users.role column.
ALTER TABLE public.users DROP CONSTRAINT users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role::text = ANY (ARRAY['admin', 'user', 'manager', 'allconnect_viewer']::text[]));
