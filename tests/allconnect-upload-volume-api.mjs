// Temporary deferred trigger forces rollback after the real RPC finishes cleanup.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';

const guard = 'test_allconnect_upload_volume_rollback';
const ready = 'test_allconnect_upload_volume_ready';
const mode = process.argv[2];
if (mode === 'setup') {
  console.log(`CREATE OR REPLACE FUNCTION public.${guard}()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $guard$
DECLARE
  headers jsonb := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
  live_count integer;
  fingerprint text;
  imported_at timestamptz;
BEGIN
  IF headers->>'x-allconnect-test-batch' IS DISTINCT FROM OLD.batch_id::text
    OR OLD.row_number <> 1 THEN
    RETURN NULL;
  END IF;
  SELECT count(*), md5(string_agg(md5((to_jsonb(a) - ARRAY['uuid', 'created_at', 'updated_at'])::text), ''
    ORDER BY md5((to_jsonb(a) - ARRAY['uuid', 'created_at', 'updated_at'])::text)))
    , max(updated_at) INTO live_count, fingerprint, imported_at FROM public.allconnect a;
  IF live_count IS DISTINCT FROM (headers->>'x-allconnect-test-count')::integer
    OR fingerprint IS DISTINCT FROM headers->>'x-allconnect-test-fingerprint' THEN
    RAISE EXCEPTION 'API full-volume row count or source fingerprint is incorrect';
  END IF;
  -- Deferred triggers run at COMMIT, whose statement_timestamp differs from the RPC.
  IF imported_at IS NULL OR imported_at <= (headers->>'x-allconnect-test-snapshot')::timestamptz
    OR EXISTS (SELECT 1 FROM public.allconnect
    WHERE uuid IS NULL OR created_at IS DISTINCT FROM imported_at
      OR updated_at IS DISTINCT FROM imported_at)
    OR EXISTS (SELECT 1 FROM public.allconnect_import_rows WHERE batch_id = OLD.batch_id) THEN
    RAISE EXCEPTION 'API full-volume audit fields or staging cleanup are incorrect';
  END IF;
  RAISE EXCEPTION USING ERRCODE = 'PT409',
    MESSAGE = 'PASS: full-volume direct API replacement rolled back',
    DETAIL = jsonb_build_object('rows', live_count, 'source_fingerprint', fingerprint,
      'statement_timeout', current_setting('statement_timeout'),
      'session_user', session_user, 'current_user', current_user,
      'safeupdate', current_setting('safeupdate.enabled', true))::text;
END;
$guard$;
REVOKE ALL ON FUNCTION public.${guard}() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.${guard}() TO service_role;
CREATE CONSTRAINT TRIGGER ${guard}
AFTER DELETE ON public.allconnect_import_rows DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.${guard}();
CREATE FUNCTION public.${ready}()
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $ready$
  SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.allconnect_import_rows'::regclass
      AND tgname = '${guard}' AND tgenabled = 'O' AND tgdeferrable AND tginitdeferred
      AND tgfoid = 'public.${guard}()'::regprocedure);
$ready$;
REVOKE ALL ON FUNCTION public.${ready}() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.${ready}() TO service_role;
NOTIFY pgrst, 'reload schema';`);
} else if (mode === 'stage') {
  const sql = readFileSync(new URL('./allconnect-upload-volume.sql', import.meta.url), 'utf8');
  const setup = sql.split('$stage$;')[0];
  assert.ok(setup.includes('DO $stage$'));
  // Only test staging rows persist here. The live snapshot is never changed.
  console.log(`${setup}$stage$;
SELECT jsonb_build_object(
  'batch', current_setting('allconnect_test.batch'),
  'snapshot', current_setting('allconnect_test.snapshot'),
  'count', current_setting('allconnect_test.count')::integer,
  'fingerprint', current_setting('allconnect_test.fingerprint')
) AS fixture;
COMMIT;`);
} else if (mode === 'run') {
  assert.ok(process.argv[3] && process.argv[4], 'Supply server env path and fixture JSON');
  const env = parse(readFileSync(process.argv[3]));
  const fixture = JSON.parse(process.argv[4]);
  assert.match(fixture.batch, /^[0-9a-f-]{36}$/);
  assert.match(fixture.fingerprint, /^[0-9a-f]{32}$/);
  assert.ok(Number.isSafeInteger(fixture.count) && fixture.count >= 200);
  const base = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
  assert.equal(base.hostname, 'sggunyytungtyhezchft.supabase.co');
  assert.ok(env.SUPABASE_SERVICE_ROLE_KEY);
  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };
  const check = await fetch(new URL(`/rest/v1/rpc/${ready}`, base), {
    method: 'POST', headers, body: '{}', signal: AbortSignal.timeout(15_000),
  });
  assert.equal(check.status, 200, 'Rollback guard readiness endpoint must be installed');
  assert.equal(await check.json(), true, 'Refusing destructive RPC without active rollback guard');
  const started = performance.now();
  const response = await fetch(new URL('/rest/v1/rpc/replace_allconnect_import', base), {
    method: 'POST',
    headers: {
      ...headers,
      'x-allconnect-test-batch': fixture.batch,
      'x-allconnect-test-count': String(fixture.count),
      'x-allconnect-test-fingerprint': fixture.fingerprint,
      'x-allconnect-test-snapshot': fixture.snapshot,
    },
    body: JSON.stringify({ p_batch_id: fixture.batch, p_expected_snapshot: fixture.snapshot }),
    signal: AbortSignal.timeout(45_000),
  });
  const body = await response.json();
  console.log(JSON.stringify({ status: response.status, elapsed_ms: performance.now() - started, ...body }));
  assert.equal(response.status, 409);
  assert.equal(body.code, 'PT409');
  assert.equal(body.message, 'PASS: full-volume direct API replacement rolled back');
  const details = JSON.parse(body.details);
  assert.equal(details.rows, fixture.count);
  assert.equal(details.source_fingerprint, fixture.fingerprint);
  assert.equal(details.statement_timeout, '30s');
  assert.equal(details.session_user, 'authenticator');
  assert.equal(details.current_user, 'service_role');
  assert.equal(details.safeupdate, 'on');
} else if (mode === 'cleanup-batch') {
  const batch = process.argv[3];
  assert.match(batch ?? '', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  console.log(`DELETE FROM public.allconnect_import_rows WHERE batch_id = '${batch}'::uuid;`);
} else if (mode === 'cleanup') {
  console.log(`DROP TRIGGER ${guard} ON public.allconnect_import_rows;
DROP FUNCTION public.${guard}();
DROP FUNCTION public.${ready}();
NOTIFY pgrst, 'reload schema';`);
} else {
  throw new Error('Usage: setup|stage|run <env-path> <fixture-json>|cleanup-batch <uuid>|cleanup');
}
