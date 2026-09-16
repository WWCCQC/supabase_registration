// setup/cleanup emit migrations for Supabase MCP; run calls the rollback-only probe.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';

const probe = 'test_allconnect_upload_rollback';
const mode = process.argv[2];
if (mode === 'setup') {
  const sql = readFileSync(new URL('./allconnect-upload.sql', import.meta.url), 'utf8');
  const block = sql.match(/DO \$test\$\n([\s\S]*?)\n\$test\$;/)?.[1];
  assert.ok(block, 'Expected the complete SQL regression block');
  // The outer exception is unconditional: even a passing probe cannot commit data.
  console.log(`CREATE OR REPLACE FUNCTION public.${probe}()
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $probe$
BEGIN
${block};
RAISE EXCEPTION USING ERRCODE = 'PT409',
  MESSAGE = 'PASS: Allconnect API regression rolled back',
  DETAIL = jsonb_build_object(
    'metrics', current_setting('allconnect_test.metrics')::jsonb,
    'session_user', session_user, 'current_user', current_user,
    'statement_timeout', current_setting('statement_timeout'),
    'safeupdate', current_setting('safeupdate.enabled', true)
  )::text;
END;
$probe$;
REVOKE ALL ON FUNCTION public.${probe}() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.${probe}() TO service_role;
NOTIFY pgrst, 'reload schema';`);
} else if (mode === 'cleanup') {
  console.log(`DROP FUNCTION public.${probe}();\nNOTIFY pgrst, 'reload schema';`);
} else if (mode === 'run') {
  assert.ok(process.argv[3], 'Supply the server env file path; keys are never printed');
  const env = parse(readFileSync(process.argv[3]));
  const url = new URL(`/rest/v1/rpc/${probe}`, env.NEXT_PUBLIC_SUPABASE_URL);
  assert.equal(url.hostname, 'sggunyytungtyhezchft.supabase.co');
  assert.ok(env.SUPABASE_SERVICE_ROLE_KEY);
  const started = performance.now();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
    signal: AbortSignal.timeout(30_000),
  });
  const body = await response.json();
  console.log(JSON.stringify({ status: response.status, elapsed_ms: performance.now() - started, ...body }));
  assert.equal(response.status, 409);
  assert.equal(body.code, 'PT409');
  assert.equal(body.message, 'PASS: Allconnect API regression rolled back');
  const details = JSON.parse(body.details);
  assert.equal(details.session_user, 'authenticator');
  assert.equal(details.current_user, 'service_role');
  assert.equal(details.safeupdate, 'on');
  assert.equal(details.statement_timeout, '8s');
  assert.ok(details.metrics.rows > 0);
  assert.ok(details.metrics.replacement_ms < 1000);
} else {
  throw new Error('Usage: node tests/allconnect-upload-api.mjs setup|cleanup|run [server-env-path]');
}
