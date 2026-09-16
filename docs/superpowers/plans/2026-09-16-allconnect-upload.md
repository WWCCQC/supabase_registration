# Allconnect Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-only, progress-reporting upload workflow that validates the monthly Allconnect CSV and atomically replaces `public.allconnect` without risking a partial dataset.

**Architecture:** The browser parses the 41 MB CSV with Papa Parse in a worker and sends validated rows to an admin-only Next.js API in bounded batches. The API stages rows as JSONB in Supabase; a locked `SECURITY INVOKER` function validates the staged batch and replaces the live table in one transaction.

**Tech Stack:** Next.js 14 Route Handlers, React 18, TypeScript, Papa Parse, Supabase JS 2, PostgreSQL 17, Node test runner, Playwright browser verification.

**Spec:** `docs/superpowers/specs/2026-09-16-allconnect-upload-design.md`

## Global Constraints

- Only application JWT role `admin` can see or call the upload workflow; `manager` remains read-only on the dashboard.
- Accept `.txt` and `.csv` files up to 200 MB, encoded as UTF-8 CSV with the exact ordered 103 source headers.
- Preserve every source value as text and preserve the existing spelling and case of all column names.
- Never expose the Supabase service-role key to the browser.
- Keep the existing `public.allconnect` schema, RLS policy, and dashboard read path intact.
- Replace live rows only after all batches are staged and validated; any failure must leave the old snapshot intact.
- Generate `uuid`, `created_at`, and `updated_at` in PostgreSQL for the new snapshot.
- Preserve the uncommitted metric-card changes already present in `AllconnectCompareDashboard.tsx`, its CSS module, `lib/allconnectCompare.ts`, and `tests/allconnectCompare.test.mjs`.

---

### Task 1: Canonical CSV Contract and Validation

**Files:**
- Create: `lib/allconnectUpload.ts`
- Create: `tests/allconnectUpload.test.mjs`

**Interfaces:**
- Produces: `ALLCONNECT_HEADERS: readonly string[]`
- Produces: `validateAllconnectHeaders(headers: string[]): { ok: true } | { ok: false; message: string }`
- Produces: `normalizeAllconnectRow(row: Record<string, unknown>): Record<string, string>`
- Produces: `validateUploadFile(file: Pick<File, 'name' | 'size'>): void`
- Produces: `calculateUploadPercent(cursor: number, fileSize: number): number`
- Produces: `MAX_ALLCONNECT_FILE_SIZE = 200 * 1024 * 1024` and `ALLCONNECT_BATCH_SIZE = 200`

- [ ] **Step 1: Write failing contract tests**

Create `tests/allconnectUpload.test.mjs` with literal expectations that catch missing, extra, duplicated, and reordered headers, BOM handling, non-text normalization, file limits, and progress boundaries:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ALLCONNECT_HEADERS,
  MAX_ALLCONNECT_FILE_SIZE,
  calculateUploadPercent,
  normalizeAllconnectRow,
  validateAllconnectHeaders,
  validateUploadFile,
} from '../lib/allconnectUpload.ts';

test('canonical Allconnect contract contains the 103 ordered source headers', () => {
  assert.equal(ALLCONNECT_HEADERS.length, 103);
  assert.deepEqual(ALLCONNECT_HEADERS.slice(0, 4), ['SECTION', 'SGMD', 'GMD', 'RNSO']);
  assert.deepEqual(ALLCONNECT_HEADERS.slice(-4), ['TDS_PROVINCE', 'L2_PORT', 'FUSION_SPLICE']);
});

test('header validation accepts a BOM and rejects structural differences', () => {
  assert.deepEqual(validateAllconnectHeaders(['\uFEFFSECTION', ...ALLCONNECT_HEADERS.slice(1)]), { ok: true });
  assert.equal(validateAllconnectHeaders(ALLCONNECT_HEADERS.slice(0, -1)).ok, false);
  assert.equal(validateAllconnectHeaders([...ALLCONNECT_HEADERS, 'EXTRA']).ok, false);
  assert.equal(validateAllconnectHeaders([ALLCONNECT_HEADERS[1], ALLCONNECT_HEADERS[0], ...ALLCONNECT_HEADERS.slice(2)]).ok, false);
  assert.equal(validateAllconnectHeaders([ALLCONNECT_HEADERS[0], ALLCONNECT_HEADERS[0], ...ALLCONNECT_HEADERS.slice(2)]).ok, false);
});

test('row normalization emits every canonical field as text and no unknown fields', () => {
  const row = normalizeAllconnectRow({ SECTION: 'BMA', SGMD: 1, UNKNOWN: 'drop' });
  assert.deepEqual(Object.keys(row), [...ALLCONNECT_HEADERS]);
  assert.equal(row.SECTION, 'BMA');
  assert.equal(row.SGMD, '1');
  assert.equal(row.GMD, '');
  assert.equal('UNKNOWN' in row, false);
});

test('file validation permits txt and csv within 200 MB', () => {
  assert.doesNotThrow(() => validateUploadFile({ name: 'allconnect.txt', size: 41_013_417 }));
  assert.doesNotThrow(() => validateUploadFile({ name: 'allconnect.csv', size: MAX_ALLCONNECT_FILE_SIZE }));
  assert.throws(() => validateUploadFile({ name: 'allconnect.xlsx', size: 1 }), /txt.*csv/i);
  assert.throws(() => validateUploadFile({ name: 'allconnect.csv', size: MAX_ALLCONNECT_FILE_SIZE + 1 }), /200 MB/);
  assert.throws(() => validateUploadFile({ name: 'allconnect.csv', size: 0 }), /empty/i);
});

test('progress reserves the final five percent for database replacement', () => {
  assert.equal(calculateUploadPercent(0, 1000), 0);
  assert.equal(calculateUploadPercent(500, 1000), 48);
  assert.equal(calculateUploadPercent(1000, 1000), 95);
  assert.equal(calculateUploadPercent(2000, 1000), 95);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
node --test --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tests/allconnectUpload.test.mjs
```

Expected: FAIL because `lib/allconnectUpload.ts` does not exist.

- [ ] **Step 3: Implement the canonical contract**

Create `lib/allconnectUpload.ts`. Define the headers from this exact string, trimming the BOM only during validation:

```ts
const HEADER_LINE = 'SECTION,SGMD,GMD,RNSO,ROM,HOZ,RGM,HOP,SUB_ID,SUB_NAME,HANDLER,PROVINCE,DISTRICT,SUBDISTRICT,GROUP_PROVINCE,PRODUCT,CIRCUIT_PHY,CIRCUIT,VOICE_ASSET,PACKAGE,SPEED,STATUS,CREATE_DATE,APPOINT_DATE,APPOINT_TIME,CLOSED_DATE,ORDER_STAT,ORDER_ITEM_STAT,SALE_ID,SALE_NAME,GROUP_SALE,NEW_CHANNEL,INDEX_SALE,GROUP_CHANNEL,CHANNEL,DEALER,ENTRY_FEE,MOBILE_STATUS,REASONCODE,GROUP_PROBLEM,FLAG_CALLVER,CALL_VERIFY,CALL_VER_ACTIVITY,CALL_VER_DATE,CALL_REASON,CALL_SUB_REASON,DISPATCH_RULE_TYPE,DISPATCH_RULE_DESC,DROP_WIRE_STRT,DROP_WIRE_END,DROP_WIRE_TYPE,FLAG_INSTALL,OLD_ACCESS,WO_CREATE_TIME,EVENT,VERIFY,ACTION,ORDERCURRENTSTATUS,ORDER_NO,ACCEPT_DATETIME,HANDLE_DATETIME,VENDOR,BLDG_ID,BLDG_NBR,BLDG_NM,BLDG_NM_TH,SCAB_CODE,OLT_NAME,SPLITTER_L2,GROUP_CUSTOMER,DROP_WIRE_LENGTH,GROUP_DROP_WIRE_LENGTH,HANDLER_ID,ON_TIME,SALESMAN_TEL,TOL_CHANNEL_TYPE,TDS_Province_PIS,GROUP_SUB,CONFIRM_BEGIN_TIME,CONFRIM_COMPLETE_TIME,DISTANCE,ONTIME_REMARK,MDU_SDU,MDU_MODEL,STB_AMOUNT,INSTALL_PERIOD,GROUP_MDU_SDU,CLOSED_TIME,ADD_MESH,GROUP_TECH,Shop_code,CM_GROUP,MESH_AMOUNT,CPE_GROUP,TVS_PROMOTION,CPE_SN,PREFER_DATE,TDS_GROUP_CHANNEL,TDS_SPECIAL_CHANNEL,TDS_REGION,TDS_PROVINCE,L2_PORT,FUSION_SPLICE';

export const ALLCONNECT_HEADERS = Object.freeze(HEADER_LINE.split(','));
export const MAX_ALLCONNECT_FILE_SIZE = 200 * 1024 * 1024;
export const ALLCONNECT_BATCH_SIZE = 200;

export function validateAllconnectHeaders(headers: string[]) {
  const normalized = headers.map((header, index) => index === 0 ? header.replace(/^\uFEFF/, '') : header);
  const mismatch = normalized.findIndex((header, index) => header !== ALLCONNECT_HEADERS[index]);
  if (normalized.length !== ALLCONNECT_HEADERS.length || mismatch !== -1) {
    return { ok: false as const, message: 'หัวคอลัมน์ไฟล์ไม่ตรงกับรูปแบบ Allconnect 103 คอลัมน์' };
  }
  return { ok: true as const };
}

export function normalizeAllconnectRow(row: Record<string, unknown>) {
  return Object.fromEntries(ALLCONNECT_HEADERS.map(header => [header, row[header] == null ? '' : String(row[header])]));
}

export function validateUploadFile(file: Pick<File, 'name' | 'size'>) {
  if (file.size === 0) throw new Error('File is empty');
  if (file.size > MAX_ALLCONNECT_FILE_SIZE) throw new Error('File exceeds 200 MB');
  if (!/\.(txt|csv)$/i.test(file.name)) throw new Error('File must be .txt or .csv');
}

export function calculateUploadPercent(cursor: number, fileSize: number) {
  if (fileSize <= 0) return 0;
  return Math.min(95, Math.round(Math.max(0, cursor) * 95 / fileSize));
}
```

- [ ] **Step 4: Run the test and verify GREEN**

Run the Task 1 test command. Expected: all Task 1 tests PASS.

- [ ] **Step 5: Commit the contract**

```bash
git add lib/allconnectUpload.ts tests/allconnectUpload.test.mjs
git commit -m "Add Allconnect upload validation contract"
```

---

### Task 2: Atomic Supabase Staging and Replacement

**Files:**
- Create: `create-allconnect-upload.sql`
- Create: `tests/allconnect-upload.sql`

**Interfaces:**
- Produces table: `public.allconnect_import_rows(batch_id uuid, row_number integer, payload jsonb, created_at timestamptz)`
- Produces RPC: `public.replace_allconnect_import(p_batch_id uuid, p_expected_snapshot timestamptz)` returning `(inserted_count integer, imported_at timestamptz)`

- [ ] **Step 1: Write the failing database regression**

Create `tests/allconnect-upload.sql` as one transaction. Capture the current snapshot, stage two complete payloads built from the current row type, call the RPC, assert two rows and generated audit fields, then stage a malformed payload and assert that the live count remains two after the expected exception. Finish with `ROLLBACK` so production data is restored:

```sql
BEGIN;

DO $test$
DECLARE
  snapshot timestamptz;
  batch uuid := gen_random_uuid();
  malformed_batch uuid := gen_random_uuid();
  stale_batch uuid := gen_random_uuid();
  base_payload jsonb;
  result record;
BEGIN
  SELECT max(updated_at) INTO snapshot FROM public.allconnect;
  SELECT to_jsonb(a) - ARRAY['uuid', 'created_at', 'updated_at']
    INTO base_payload FROM public.allconnect a LIMIT 1;

  INSERT INTO public.allconnect_import_rows(batch_id, row_number, payload) VALUES
    (batch, 1, base_payload || '{"HANDLER_ID":"TEST-001"}'::jsonb),
    (batch, 2, base_payload || '{"HANDLER_ID":"TEST-002"}'::jsonb);

  SELECT * INTO result FROM public.replace_allconnect_import(batch, snapshot);
  IF result.inserted_count <> 2 OR (SELECT count(*) FROM public.allconnect) <> 2 THEN
    RAISE EXCEPTION 'Atomic replacement row count is incorrect';
  END IF;
  IF EXISTS (SELECT 1 FROM public.allconnect WHERE uuid IS NULL OR created_at IS NULL OR updated_at IS NULL) THEN
    RAISE EXCEPTION 'Generated audit fields are missing';
  END IF;

  INSERT INTO public.allconnect_import_rows(batch_id, row_number, payload)
  VALUES (malformed_batch, 1, '{"HANDLER_ID":"MISSING-OTHER-FIELDS"}'::jsonb);
  BEGIN
    PERFORM public.replace_allconnect_import(malformed_batch, result.imported_at);
    RAISE EXCEPTION 'Malformed payload should fail';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  IF (SELECT count(*) FROM public.allconnect) <> 2 THEN
    RAISE EXCEPTION 'Failed replacement changed live data';
  END IF;

  INSERT INTO public.allconnect_import_rows(batch_id, row_number, payload)
  VALUES (stale_batch, 1, base_payload || '{"HANDLER_ID":"STALE"}'::jsonb);
  BEGIN
    PERFORM public.replace_allconnect_import(stale_batch, snapshot);
    RAISE EXCEPTION 'Stale snapshot should fail';
  EXCEPTION WHEN serialization_failure THEN NULL;
  END;
  IF (SELECT count(*) FROM public.allconnect) <> 2 THEN
    RAISE EXCEPTION 'Stale replacement changed live data';
  END IF;
END
$test$;

SELECT 'PASS: atomic Allconnect replacement and rollback' AS result;
ROLLBACK;
```

- [ ] **Step 2: Run the SQL test and verify RED**

Execute the whole file with Supabase MCP `execute_sql` on project `sggunyytungtyhezchft`.

Expected: FAIL because `public.allconnect_import_rows` and `public.replace_allconnect_import` do not exist.

- [ ] **Step 3: Implement staging, RLS, validation, and atomic replacement**

Create `create-allconnect-upload.sql` with:

```sql
CREATE TABLE public.allconnect_import_rows (
  batch_id uuid NOT NULL,
  row_number integer NOT NULL CHECK (row_number > 0),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  PRIMARY KEY (batch_id, row_number)
);

ALTER TABLE public.allconnect_import_rows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.allconnect_import_rows FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.allconnect_import_rows TO service_role;

CREATE OR REPLACE FUNCTION public.replace_allconnect_import(
  p_batch_id uuid,
  p_expected_snapshot timestamptz
)
RETURNS TABLE(inserted_count integer, imported_at timestamptz)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_count integer;
  v_min_row integer;
  v_max_row integer;
  v_current_snapshot timestamptz;
  v_imported_at timestamptz := statement_timestamp();
  v_expected_keys text[];
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('public.allconnect replacement', 0));

  SELECT max(a.updated_at) INTO v_current_snapshot FROM public.allconnect a;
  IF v_current_snapshot IS DISTINCT FROM p_expected_snapshot THEN
    RAISE EXCEPTION 'Allconnect snapshot changed during upload' USING ERRCODE = '40001';
  END IF;

  SELECT count(*), min(row_number), max(row_number)
    INTO v_count, v_min_row, v_max_row
  FROM public.allconnect_import_rows WHERE batch_id = p_batch_id;
  IF v_count = 0 OR v_min_row <> 1 OR v_max_row <> v_count THEN
    RAISE EXCEPTION 'Staged rows are missing or non-contiguous' USING ERRCODE = '23514';
  END IF;

  SELECT array_agg(a.attname ORDER BY a.attname) INTO v_expected_keys
  FROM pg_catalog.pg_attribute a
  WHERE a.attrelid = 'public.allconnect'::regclass AND a.attnum > 0 AND NOT a.attisdropped
    AND a.attname NOT IN ('uuid', 'created_at', 'updated_at');

  IF EXISTS (
    SELECT 1 FROM public.allconnect_import_rows s
    WHERE s.batch_id = p_batch_id
      AND (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(s.payload) k) IS DISTINCT FROM v_expected_keys
  ) THEN
    RAISE EXCEPTION 'Staged payload columns do not match allconnect' USING ERRCODE = '23514';
  END IF;

  DELETE FROM public.allconnect;
  INSERT INTO public.allconnect
  SELECT (jsonb_populate_record(
    NULL::public.allconnect,
    s.payload || jsonb_build_object('uuid', gen_random_uuid(), 'created_at', v_imported_at, 'updated_at', v_imported_at)
  )).* FROM public.allconnect_import_rows s
  WHERE s.batch_id = p_batch_id ORDER BY s.row_number;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  DELETE FROM public.allconnect_import_rows WHERE batch_id = p_batch_id;
  RETURN QUERY SELECT v_count, v_imported_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.replace_allconnect_import(uuid, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_allconnect_import(uuid, timestamptz)
  TO service_role;
```

- [ ] **Step 4: Apply the SQL through Supabase MCP**

Apply `create-allconnect-upload.sql` as migration name `add_atomic_allconnect_upload` to project `sggunyytungtyhezchft`.

- [ ] **Step 5: Re-run the SQL regression and verify GREEN**

Expected result: `PASS: atomic Allconnect replacement and rollback`; afterwards verify the production row count remains 26,780 because the test transaction rolled back.

- [ ] **Step 6: Run security and performance advisors**

Run Supabase advisors. Confirm neither the staging table nor replacement function adds a public/RLS/search-path finding. Record unrelated pre-existing findings without changing unrelated schemas.

- [ ] **Step 7: Commit the database contract**

```bash
git add create-allconnect-upload.sql tests/allconnect-upload.sql
git commit -m "Add atomic Allconnect import staging"
```

---

### Task 3: Admin-Only Upload API

**Files:**
- Create: `app/api/allconnect-upload/route.ts`
- Modify: `lib/allconnectUpload.ts`
- Modify: `tests/allconnectUpload.test.mjs`

**Interfaces:**
- Consumes: `ALLCONNECT_HEADERS`, `ALLCONNECT_BATCH_SIZE`, and `normalizeAllconnectRow`
- Produces: `parseUploadAction(value: unknown): 'start' | 'chunk' | 'commit' | 'abort'`
- Produces HTTP: `POST /api/allconnect-upload` with bodies for the four actions

- [ ] **Step 1: Add failing request-contract tests**

Append tests that require exact action names, UUID batch IDs, maximum 200-row chunks, contiguous positive row numbers, and exact row keys:

```js
import { validateChunkPayload } from '../lib/allconnectUpload.ts';

test('chunk validation accepts canonical rows with contiguous row numbers', () => {
  const row = Object.fromEntries(ALLCONNECT_HEADERS.map(header => [header, '']));
  const result = validateChunkPayload({ batchId: '11111111-1111-4111-8111-111111111111', startRow: 1, rows: [row, row] });
  assert.equal(result.startRow, 1);
  assert.equal(result.rows.length, 2);
});

test('chunk validation rejects oversized, malformed and non-canonical payloads', () => {
  const row = Object.fromEntries(ALLCONNECT_HEADERS.map(header => [header, '']));
  assert.throws(() => validateChunkPayload({ batchId: 'bad', startRow: 1, rows: [row] }));
  assert.throws(() => validateChunkPayload({ batchId: crypto.randomUUID(), startRow: 0, rows: [row] }));
  assert.throws(() => validateChunkPayload({ batchId: crypto.randomUUID(), startRow: 1, rows: Array(201).fill(row) }));
  assert.throws(() => validateChunkPayload({ batchId: crypto.randomUUID(), startRow: 1, rows: [{ HANDLER_ID: '1' }] }));
});
```

- [ ] **Step 2: Run and verify RED**

Run the Task 1 test command. Expected: FAIL because `validateChunkPayload` is not exported.

- [ ] **Step 3: Implement request validation**

Add strict UUID, integer, array-length, and exact-key validation to `lib/allconnectUpload.ts`. Return normalized rows only after every row passes:

```ts
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateChunkPayload(value: unknown) {
  if (!value || typeof value !== 'object') throw new Error('Invalid upload payload');
  const input = value as { batchId?: unknown; startRow?: unknown; rows?: unknown };
  if (typeof input.batchId !== 'string' || !UUID_PATTERN.test(input.batchId)) throw new Error('Invalid batch ID');
  if (!Number.isSafeInteger(input.startRow) || Number(input.startRow) < 1) throw new Error('Invalid start row');
  if (!Array.isArray(input.rows) || input.rows.length < 1 || input.rows.length > ALLCONNECT_BATCH_SIZE) throw new Error('Invalid batch size');
  const expectedKeys = [...ALLCONNECT_HEADERS];
  const rows = input.rows.map(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid row');
    const keys = Object.keys(value as Record<string, unknown>);
    if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) throw new Error('Invalid row columns');
    return normalizeAllconnectRow(value as Record<string, unknown>);
  });
  return { batchId: input.batchId, startRow: Number(input.startRow), rows };
}
```

- [ ] **Step 4: Run and verify GREEN**

Run `tests/allconnectUpload.test.mjs`. Expected: PASS.

- [ ] **Step 5: Implement the Route Handler**

Create `app/api/allconnect-upload/route.ts` with `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`, and one `POST` handler. Verify the `auth-token` with `jose` and require `payload.role === 'admin'`. Implement:

```ts
type UploadBody =
  | { action: 'start' }
  | { action: 'chunk'; batchId: string; startRow: number; rows: Record<string, unknown>[] }
  | { action: 'commit'; batchId: string; expectedSnapshot: string | null }
  | { action: 'abort'; batchId: string };
```

For `start`, delete staging rows older than 24 hours, read the latest `allconnect.updated_at`, and return `{ batchId: crypto.randomUUID(), expectedSnapshot }`. For `chunk`, map rows to `{ batch_id, row_number, payload }` and insert with `supabaseAdmin()`. For `commit`, call `replace_allconnect_import` and return `{ insertedCount, importedAt }`. For `abort`, delete only the requested batch.

Map missing/invalid login to 401, non-admin to 403, malformed requests to 400, stale snapshot conflict to 409, and unexpected database failures to 500. Include `Cache-Control: private, no-store, max-age=0` on every response.

- [ ] **Step 6: Verify authorization with real signed JWTs**

Use a local Node script with `jsonwebtoken` to call the running route with no cookie, a manager JWT, and an admin JWT. Expected statuses: 401, 403, and 200 for `start`. Call `abort` for the admin batch and expect 200.

- [ ] **Step 7: Commit the API**

```bash
git add app/api/allconnect-upload/route.ts lib/allconnectUpload.ts tests/allconnectUpload.test.mjs
git commit -m "Add admin-only Allconnect upload API"
```

---

### Task 4: Streaming Upload Control and Progress UI

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `components/allconnect/AllconnectUpload.tsx`
- Create: `components/allconnect/AllconnectUpload.module.css`
- Modify: `components/allconnect/AllconnectCompareDashboard.tsx`

**Interfaces:**
- Consumes: `/api/allconnect-upload`, `ALLCONNECT_BATCH_SIZE`, validation helpers, and `useAuth().isAdmin()`
- Produces component: `<AllconnectUpload onComplete={(result) => void} />`

- [ ] **Step 1: Install pinned parser dependencies**

Run:

```bash
npm install --save-exact papaparse@5.7.0
npm install --save-dev --save-exact @types/papaparse@5.5.2
```

- [ ] **Step 2: Create the upload component**

Implement `AllconnectUpload.tsx` as an admin-only control using `useAuth`. Render nothing for non-admin users. Render a hidden file input and a button with Lucide `Upload`; place `accept=".txt,.csv,text/csv,text/plain"` on the input.

Wrap Papa Parse in a Promise and configure:

```ts
Papa.parse<Record<string, string>>(file, {
  header: true,
  worker: true,
  dynamicTyping: false,
  skipEmptyLines: 'greedy',
  chunkSize: 512 * 1024,
  transformHeader: (header, index) => index === 0 ? header.replace(/^\uFEFF/, '') : header,
  chunk(results, parser) {
    parser.pause();
    void persistParsedChunk(results).then(() => parser.resume()).catch(rejectUpload);
  },
  complete: resolveUpload,
  error: rejectUpload,
});
```

On the first chunk, validate `results.meta.fields`. Reject any `results.errors`. Normalize rows and send groups of 200 sequentially with increasing `startRow`. Update progress only after a chunk API response succeeds. After parser completion set progress to 95, call `commit`, set progress to 100, and call `onComplete` with the returned count and timestamp. On failure, call `abort` best-effort and preserve the Thai error message.

- [ ] **Step 3: Add the compact progress presentation**

Create styles for an unframed toolbar above the RBM selector: upload button, selected filename, native `<progress max={100}>`, visible percentage, accepted-row count, and success/error text. Use the existing green action color and 5px control radius. Ensure the file name wraps and controls stack below 600px:

```css
.uploadPanel { padding: 16px 0; border-top: 1px solid #e3e7ed; display: grid; gap: 10px; }
.uploadRow { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.uploadButton { display: inline-flex; align-items: center; gap: 8px; min-height: 38px; padding: 8px 14px; border: 1px solid #159574; border-radius: 5px; background: #159574; color: #fff; }
.fileName { color: #596575; overflow-wrap: anywhere; }
.progressRow { display: grid; grid-template-columns: minmax(160px, 1fr) auto; gap: 10px; align-items: center; max-width: 620px; }
.progressRow progress { width: 100%; accent-color: #159574; }
.status { color: #657386; font-size: 12px; line-height: 1.6; }
.error { color: #a83143; }
.success { color: #128166; }
@media (max-width: 600px) { .uploadRow { flex-direction: column; align-items: stretch; } .progressRow { grid-template-columns: 1fr; } }
```

- [ ] **Step 4: Integrate above the RBM selector**

In `AllconnectCompareDashboard.tsx`, render:

```tsx
<AllconnectUpload onComplete={() => setRevision(value => value + 1)} />
<div className={styles.scopeBar}>...</div>
```

The existing metric-card modifications in this file must remain unchanged.

- [ ] **Step 5: Run static verification**

Run:

```bash
npx tsc --noEmit --incremental false
node --test --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tests/allconnectUpload.test.mjs tests/allconnectCompare.test.mjs tests/technicianSearch.test.mjs tests/technicianTableColumns.test.mjs
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit the UI**

```bash
git add package.json package-lock.json components/allconnect/AllconnectUpload.tsx components/allconnect/AllconnectUpload.module.css components/allconnect/AllconnectCompareDashboard.tsx
git commit -m "Add Allconnect upload progress UI"
```

---

### Task 5: End-to-End Import Verification

**Files:**
- Create outside repository: `/tmp/registration-browser-qa/verify-allconnect-upload.cjs`
- Modify only if verification exposes a defect: files from Tasks 1-4

**Interfaces:**
- Consumes the attached reference file `/Users/pathom/Downloads/allconnect.txt`
- Verifies the full browser → API → staging → transaction → dashboard path

- [ ] **Step 1: Record the live baseline**

Query `count(*)`, `max(updated_at)`, and count of rows missing `HANDLER_ID` from `public.allconnect`. Expected baseline row count: 26,780.

- [ ] **Step 2: Verify role visibility and server authorization**

In Playwright, sign JWTs with the local `JWT_SECRET`. Confirm the upload button is absent for manager and visible for admin. Call the API directly with manager credentials and confirm 403.

- [ ] **Step 3: Upload the full reference file in the browser**

Use `setInputFiles('/Users/pathom/Downloads/allconnect.txt')`. Observe progress values and assert they never decrease, the button stays disabled until completion, the final value is 100%, and the success message reports 26,780 rows.

- [ ] **Step 4: Verify the resulting database and dashboard**

Query Supabase and assert:

- `public.allconnect` contains exactly 26,780 rows.
- Every row has non-null `uuid`, `created_at`, and `updated_at`.
- All rows share the completed import timestamp.
- `public.allconnect_import_rows` contains no rows for the completed batch.
- `/api/allconnect-compare` returns `dataset.totalRows = 26780` and the dashboard shows `Allconnect 26,780 รายการ`.

- [ ] **Step 5: Verify failure preservation**

Generate a small temporary CSV with one missing header, upload it, and assert the UI reports a header error while the live row count and `max(updated_at)` remain unchanged.

- [ ] **Step 6: Inspect desktop and mobile screenshots**

Capture 1440×900 and 390×844 screenshots. Confirm the upload control is above the RBM selector, percentage text does not overlap, long filenames wrap, and existing metric cards remain correctly ordered.

- [ ] **Step 7: Run final fresh verification**

Run all Node tests, the SQL regression, TypeScript, `git diff --check`, Supabase security/performance advisors, and the Playwright end-to-end script. Read every exit code before reporting completion.

- [ ] **Step 8: Commit any verification fixes**

If verification required code fixes, commit only those fixes with:

```bash
git add app/api/allconnect-upload/route.ts components/allconnect/AllconnectUpload.tsx components/allconnect/AllconnectUpload.module.css components/allconnect/AllconnectCompareDashboard.tsx lib/allconnectUpload.ts tests/allconnectUpload.test.mjs create-allconnect-upload.sql tests/allconnect-upload.sql package.json package-lock.json
git commit -m "Fix Allconnect upload verification issues"
```

Do not stage or revert unrelated user changes.
