// The test RPC always raises: rollback never depends on the production cleanup.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';

const probe = 'test_allconnect_upload_volume_probe';
const fault = 'test_allconnect_upload_skip_cleanup';
const canonicalUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const signature = 'text, timestamptz, integer, text, boolean';
const mode = process.argv[2];
if (mode === 'setup') {
  console.log(`CREATE FUNCTION public.${probe}(
  p_batch_text text, p_snapshot timestamptz, p_count integer, p_fingerprint text,
  p_skip_cleanup boolean DEFAULT false
)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' SET statement_timeout = '30s'
AS $probe$
DECLARE
  batch uuid;
  result record;
  live_count integer;
  remaining_staged_rows integer;
  fingerprint text;
  evidence text;
BEGIN
  IF p_batch_text IS NULL OR p_batch_text !~ '${canonicalUuid.source}' THEN
    RAISE EXCEPTION 'Expected a canonical UUID' USING ERRCODE = '22023';
  END IF;
  batch := p_batch_text::uuid;
  IF p_count IS NULL OR p_count < 200 OR p_fingerprint IS NULL OR p_fingerprint !~ '^[0-9a-f]{32}$' THEN
    RAISE EXCEPTION 'Invalid volume fixture' USING ERRCODE = '22023';
  END IF;
  PERFORM set_config('allconnect_test.batch', batch::text, true);
  PERFORM set_config('allconnect_test.skip_cleanup', coalesce(p_skip_cleanup, false)::text, true);
  SELECT * INTO STRICT result FROM public.replace_allconnect_import(batch, p_snapshot);
  SELECT count(*), md5(string_agg(md5((to_jsonb(a) - ARRAY['uuid', 'created_at', 'updated_at'])::text), ''
    ORDER BY md5((to_jsonb(a) - ARRAY['uuid', 'created_at', 'updated_at'])::text)))
    INTO live_count, fingerprint FROM public.allconnect a;
  IF result.inserted_count IS DISTINCT FROM p_count OR live_count IS DISTINCT FROM p_count
    OR fingerprint IS DISTINCT FROM p_fingerprint THEN
    RAISE EXCEPTION 'API full-volume row count or source fingerprint is incorrect';
  END IF;
  IF result.imported_at IS NULL OR EXISTS (SELECT 1 FROM public.allconnect
    WHERE uuid IS NULL OR created_at IS DISTINCT FROM result.imported_at
      OR updated_at IS DISTINCT FROM result.imported_at) THEN
    RAISE EXCEPTION 'API full-volume audit fields are incorrect';
  END IF;
  SELECT count(*) INTO remaining_staged_rows FROM public.allconnect_import_rows WHERE batch_id = batch;
  evidence := jsonb_build_object('rows', live_count, 'source_fingerprint', fingerprint,
    'remaining_staged_rows', remaining_staged_rows,
    'statement_timeout', current_setting('statement_timeout'),
    'session_user', session_user, 'current_user', current_user,
    'safeupdate', current_setting('safeupdate.enabled', true))::text;
  IF remaining_staged_rows <> 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'PT412',
      MESSAGE = 'FAIL: staging cleanup did not run; replacement rolled back', DETAIL = evidence;
  END IF;
  -- No normal return or exception handler: success must abort the whole RPC too.
  RAISE EXCEPTION USING ERRCODE = 'PT409',
    MESSAGE = 'PASS: full-volume API replacement rolled back', DETAIL = evidence;
END;
$probe$;
REVOKE ALL ON FUNCTION public.${probe}(${signature}) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.${probe}(${signature}) TO service_role;

-- Fault injection only. Rollback safety does not depend on this trigger existing.
CREATE FUNCTION public.${fault}()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $fault$
BEGIN
  IF current_setting('allconnect_test.skip_cleanup', true) = 'true'
    AND OLD.batch_id = nullif(current_setting('allconnect_test.batch', true), '')::uuid THEN
    RETURN NULL;
  END IF;
  RETURN OLD;
END;
$fault$;
REVOKE ALL ON FUNCTION public.${fault}() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.${fault}() TO service_role;
CREATE TRIGGER ${fault} BEFORE DELETE ON public.allconnect_import_rows
FOR EACH ROW EXECUTE FUNCTION public.${fault}();
NOTIFY pgrst, 'reload schema';`);
} else if (mode === 'stage') {
  const sql = readFileSync(new URL('./allconnect-upload-volume.sql', import.meta.url), 'utf8');
  const setup = sql.split('$stage$;')[0];
  assert.ok(setup.includes('DO $stage$'));
  // Only fixture staging persists here; neither the live table nor RPC is modified.
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
  const fixture = JSON.parse(process.argv[4]);
  assert.match(fixture.batch ?? '', canonicalUuid, 'Expected a canonical UUID');
  assert.match(fixture.fingerprint ?? '', /^[0-9a-f]{32}$/);
  assert.ok(Number.isSafeInteger(fixture.count) && fixture.count >= 200);
  assert.equal(typeof fixture.snapshot, 'string');
  assert.ok(Number.isFinite(Date.parse(fixture.snapshot)));
  assert.ok(process.argv[5] === undefined || process.argv[5] === '--skip-cleanup');
  const skipCleanup = process.argv[5] === '--skip-cleanup';
  const env = parse(readFileSync(process.argv[3]));
  const base = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
  assert.equal(base.hostname, 'sggunyytungtyhezchft.supabase.co');
  assert.ok(env.SUPABASE_SERVICE_ROLE_KEY);
  const started = performance.now();
  // Never call the production RPC directly: missing test setup is a harmless 404.
  const response = await fetch(new URL('/rest/v1/rpc/' + probe, base), {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_batch_text: fixture.batch, p_snapshot: fixture.snapshot, p_count: fixture.count,
      p_fingerprint: fixture.fingerprint, p_skip_cleanup: skipCleanup,
    }),
    signal: AbortSignal.timeout(45_000),
  });
  const body = await response.json();
  console.log(JSON.stringify({ status: response.status, elapsed_ms: performance.now() - started, ...body }));
  assert.equal(response.status, skipCleanup ? 412 : 409);
  assert.equal(body.code, skipCleanup ? 'PT412' : 'PT409');
  assert.equal(body.message, skipCleanup
    ? 'FAIL: staging cleanup did not run; replacement rolled back'
    : 'PASS: full-volume API replacement rolled back');
  const details = JSON.parse(body.details);
  assert.equal(details.rows, fixture.count);
  assert.equal(details.source_fingerprint, fixture.fingerprint);
  assert.equal(details.remaining_staged_rows, skipCleanup ? fixture.count : 0);
  assert.equal(details.statement_timeout, '30s');
  assert.equal(details.session_user, 'authenticator');
  assert.equal(details.current_user, 'service_role');
  assert.equal(details.safeupdate, 'on');
} else if (mode === 'cleanup-batch') {
  const batch = process.argv[3];
  assert.match(batch ?? '', canonicalUuid, 'Expected a canonical UUID');
  console.log(`DELETE FROM public.allconnect_import_rows WHERE batch_id = '${batch}'::uuid;`);
} else if (mode === 'cleanup') {
  console.log(`DROP TRIGGER ${fault} ON public.allconnect_import_rows;
DROP FUNCTION public.${fault}();
DROP FUNCTION public.${probe}(${signature});
NOTIFY pgrst, 'reload schema';`);
} else {
  throw new Error('Usage: setup|stage|run <env-path> <fixture-json> [--skip-cleanup]|cleanup-batch <uuid>|cleanup');
}
