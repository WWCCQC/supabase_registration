CREATE TABLE public.contract_solar (
  uuid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_name text,
  active_status text,
  contract_status text,
  start_contract text,
  end_contract text,
  contract_no text,
  contract_guarantee_amount text,
  rbm text,
  group_status text,
  installation_status text,
  email text,
  corporate_registration_no text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION public.contract_solar_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER contract_solar_updated_at
BEFORE UPDATE ON public.contract_solar
FOR EACH ROW EXECUTE FUNCTION public.contract_solar_set_updated_at();

ALTER TABLE public.contract_solar ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contract_solar FROM anon, authenticated;
GRANT SELECT ON public.contract_solar TO authenticated;
GRANT ALL ON public.contract_solar TO service_role;
CREATE POLICY contract_solar_admin_read ON public.contract_solar
FOR SELECT TO authenticated
USING ((SELECT auth.jwt())->'app_metadata'->>'role' = 'admin');
