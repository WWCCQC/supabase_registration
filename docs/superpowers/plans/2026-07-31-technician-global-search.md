# Technician Global Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the main technician search return paginated rows matching values across every current `technicians` column while preserving the existing filters and automatic 400 ms refresh.

**Architecture:** Extract search-expression construction into a small pure TypeScript module. The existing `/api/technicians` route will apply the same expression to its count and data queries, while `TechBrowser` keeps its current debounce, pagination, table, and filter behavior unchanged.

**Tech Stack:** Next.js 14 route handlers, TypeScript 5.5, Supabase JS 2/PostgREST filters, React 18, Node.js 22 built-in test runner.

## Global Constraints

- Keep the existing 400 ms input debounce and server-side pagination.
- Preserve the dedicated `national_id`, `tech_id`, RBM, and `depot_code` filters.
- Preserve sorting, authorization, masking, detail views, charts, KPIs, and exports.
- Do not alter the `technicians` table schema or add database objects.
- Do not introduce a client-side full-table fallback.

---

### Task 1: Search Expression Builder

**Files:**
- Create: `lib/technicianSearch.ts`
- Create: `tests/technicianSearch.test.mjs`

**Interfaces:**
- Consumes: a raw general-search string from the `q` URL parameter.
- Produces: `buildTechnicianSearchExpression(rawTerm: string | null | undefined): string | null`.
- Produces: `TECHNICIAN_SEARCHABLE_COLUMNS`, the explicit list of current text-compatible `technicians` columns.

- [ ] **Step 1: Write the failing tests**

Create `tests/technicianSearch.test.mjs` using `node:test` and
`node:assert/strict`. Import `buildTechnicianSearchExpression` and assert:

```js
test("searches representative values from every technician data group", () => {
  const expression = buildTechnicianSearchExpression("Bangkok");

  for (const column of [
    "provider_group_type",
    "job_accept_type",
    "tech_first_name_en",
    "card_register_date",
    "car_license_plate",
    "power_card_expire_date",
    "doc_driver_license_url",
    "address",
    "course_h",
  ]) {
    assert.match(expression, new RegExp(`${column}\\.ilike\\.`));
  }
});

test("adds the qualification condition without dropping general matches", () => {
  const expression = buildTechnicianSearchExpression("iot");
  assert.match(expression, /svc_iot\.eq\.Pass/);
  assert.match(expression, /full_name\.ilike\./);
});

test("quotes PostgREST reserved characters in a search value", () => {
  const expression = buildTechnicianSearchExpression("Doe, Jane");
  assert.match(expression, /full_name\.ilike\."\*Doe, Jane\*"/);
});

test("adds a timestamp range only for a complete ISO date", () => {
  const expression = buildTechnicianSearchExpression("2026-07-31");
  assert.match(expression, /and\(updated_at\.gte\.2026-07-31T00:00:00\.000Z,updated_at\.lt\.2026-08-01T00:00:00\.000Z\)/);
});

test("returns null for an empty search", () => {
  assert.equal(buildTechnicianSearchExpression("   "), null);
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
node --test --experimental-strip-types tests/technicianSearch.test.mjs
```

Expected: FAIL because `lib/technicianSearch.ts` does not exist.

- [ ] **Step 3: Implement the minimal expression builder**

Create `lib/technicianSearch.ts` with:

```ts
export const TECHNICIAN_SEARCHABLE_COLUMNS = [
  "area",
  "provider",
  "HRBM",
  "CBM",
  "RBM",
  "provider_group_type",
  "work_type",
  "job_accept_type",
  "group_name",
  "province",
  "depot_name",
  "depot_code",
  "wma",
  "team_name",
  "team_type",
  "workgroup_status",
  "tech_first_name",
  "tech_last_name",
  "tech_first_name_en",
  "tech_last_name_en",
  "tech_id",
  "card_register_date",
  "card_expire_date",
  "card_expire_date_alt",
  "card_days_to_expire",
  "training_round",
  "phone",
  "email",
  "status",
  "gender",
  "full_name",
  "national_id",
  "birth_date",
  "age",
  "degree",
  "car_brand_code",
  "car_model",
  "car_color",
  "car_license_plate",
  "car_reg_province",
  "car_type",
  "equip_carryboy",
  "power_authority",
  "power_card_start_date",
  "power_card_expire_date",
  "sso_number",
  "safety_officer_executive",
  "safety_officer_supervisor",
  "safety_officer_technical",
  "is_blacklisted",
  "svc_install",
  "svc_repair",
  "svc_ojt",
  "svc_safety",
  "svc_softskill",
  "svc_5p",
  "svc_nonstandard",
  "svc_corporate",
  "svc_solar",
  "svc_fttr",
  "svc_2g",
  "svc_cctv",
  "svc_cyod",
  "svc_dongle",
  "svc_iot",
  "svc_gigatex",
  "svc_wifi",
  "svc_smarthome",
  "svc_catv_settop_box",
  "svc_true_id",
  "svc_true_inno",
  "svc_l3",
  "doc_tech_card_url",
  "doc_id_card_url",
  "doc_driver_license_url",
  "doc_education_certificate_url",
  "doc_criminal_record_url",
  "doc_medical_certificate_url",
  "doc_power_authority_card_url",
  "doc_safety_officer_executive_url",
  "doc_safety_officer_supervisor_url",
  "doc_safety_officer_technical_url",
  "address",
  "current_address",
  "course_g",
  "course_ec",
  "course_h",
] as const;
```

Also define the supported qualification aliases, quote `"` and `\` in raw
PostgREST values, surround partial-match values with `"*...*"`, and append an
`updated_at` UTC-day range only when the normalized term matches
`YYYY-MM-DD`.

- [ ] **Step 4: Run the tests and verify GREEN**

Run:

```bash
node --test --experimental-strip-types tests/technicianSearch.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 5: Commit the isolated builder**

```bash
git add lib/technicianSearch.ts tests/technicianSearch.test.mjs
git commit -m "feat: build technician global search filters"
```

### Task 2: Apply Search Consistently in the API

**Files:**
- Modify: `app/api/technicians/route.ts`
- Modify: `tests/technicianSearch.test.mjs`

**Interfaces:**
- Consumes: `buildTechnicianSearchExpression(q)` from Task 1.
- Produces: identical `.or(expression)` behavior for the count query and data query.

- [ ] **Step 1: Add a failing route-boundary source test**

Add a test for the exported `applyTechnicianGeneralSearch` helper boundary:
call it with a recording query object and assert the generated expression is
passed to `.or()`.
The recording object implements only:

```ts
type OrQuery<T> = {
  or(expression: string): T;
};
```

The test must assert that an empty term returns the original query without an
`.or()` call and that a non-empty term applies exactly one `.or()` call.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
node --test --experimental-strip-types tests/technicianSearch.test.mjs
```

Expected: FAIL because `applyTechnicianGeneralSearch` is not yet exported from
`lib/technicianSearch.ts`.

- [ ] **Step 3: Replace duplicated route search logic**

In `app/api/technicians/route.ts`:

```ts
import {
  applyTechnicianGeneralSearch,
} from "@/lib/technicianSearch";
```

Delete the route-local `sanitizeQ`, reduced `cols`-based general search, and
duplicated service-column matching blocks. Keep the existing dedicated filters.
Apply:

```ts
countQuery = applyTechnicianGeneralSearch(countQuery, q);
dataQuery = applyTechnicianGeneralSearch(dataQuery, q);
```

Do not change pagination, sorting, response mapping, cache headers, or error
handling.

- [ ] **Step 4: Run focused tests and TypeScript/build verification**

Run:

```bash
node --test --experimental-strip-types tests/technicianSearch.test.mjs
npm run build
```

Expected: tests PASS and Next.js build exits 0.

- [ ] **Step 5: Commit the API integration**

```bash
git add app/api/technicians/route.ts lib/technicianSearch.ts tests/technicianSearch.test.mjs
git commit -m "feat: search all technician fields"
```

### Task 3: Data and Browser Verification

**Files:**
- Verify only; no planned production file changes.

**Interfaces:**
- Consumes: `/api/technicians?q=<term>&page=1&pageSize=10`.
- Produces: evidence that representative terms match real rows and pagination remains correct.

- [ ] **Step 1: Start the local development server**

Run:

```bash
npm run dev
```

Expected: Next.js listens on `http://localhost:3001`.

- [ ] **Step 2: Verify representative API searches**

Query terms taken from non-empty real values in at least these columns:
`full_name`, `provider_group_type`, `car_license_plate`, `address`,
`doc_driver_license_url`, and `course_h`. For each request, assert HTTP 200,
`rows.length <= pageSize`, `total >= rows.length`, and every returned row is
from `technicians`.

Also query `q=iot` and assert returned rows satisfy the existing service
qualification behavior.

- [ ] **Step 3: Verify pagination and combined filters**

Request page 1 and page 2 for a broad matching term and confirm rows differ
while `total` and `totalPages` are stable. Combine `q` with one dedicated
filter and confirm every result satisfies both.

- [ ] **Step 4: Verify the main page in the in-app browser**

Open `http://localhost:3001`, sign in using the existing browser session, type
a representative general-search value, and confirm the table refreshes after
the debounce without pressing the search button. Confirm the result counter,
pagination, clear-filter button, and dedicated filters still work and the
layout has not changed.

- [ ] **Step 5: Run final verification**

Run:

```bash
node --test --experimental-strip-types tests/technicianSearch.test.mjs
npm run build
git status --short
```

Expected: tests and build pass; only intentional files and the pre-existing
`.claude/` entry appear in status.
