# Technician License Plate Column Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display `car_license_plate` as the always-visible last column of the main technician table and preserve working sort behavior.

**Architecture:** Move the main table column order into a small pure TypeScript module so its last-column contract can be tested without rendering the large client component. Extend the existing technicians API response and sort allowlist, then keep the current generic table renderer unchanged.

**Tech Stack:** Next.js 14, React 18, TypeScript 5.5, Supabase JS 2/PostgREST, Node.js built-in test runner.

## Global Constraints

- Place `car_license_plate` last in the main technician table.
- Show the column at all times with a stable width of 140px.
- Use the existing Thai label `ทะเบียนรถ`.
- Preserve search, debounce, dedicated filters, pagination, authorization, masking, charts, KPIs, details, and all existing columns.
- Do not alter the `technicians` table schema.

---

### Task 1: Stable Main Table Column Order

**Files:**
- Create: `lib/technicianTableColumns.ts`
- Create: `tests/technicianTableColumns.test.mjs`
- Modify: `components/TechBrowser.tsx:172-209`

**Interfaces:**
- Produces: `TECHNICIAN_TABLE_COLUMNS`, a readonly tuple consumed by `TechBrowser`.
- Consumes: the existing generic header and row rendering loops in `TechBrowser`.

- [ ] **Step 1: Write the failing column-order test**

Create `tests/technicianTableColumns.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";

import { TECHNICIAN_TABLE_COLUMNS } from "../lib/technicianTableColumns.ts";

test("places vehicle license plate last in the main technician table", () => {
  assert.equal(
    TECHNICIAN_TABLE_COLUMNS[TECHNICIAN_TABLE_COLUMNS.length - 1],
    "car_license_plate",
  );
  assert.equal(
    TECHNICIAN_TABLE_COLUMNS.filter(
      (column) => column === "car_license_plate",
    ).length,
    1,
  );
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
node --test --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tests/technicianTableColumns.test.mjs
```

Expected: FAIL because `lib/technicianTableColumns.ts` does not exist.

- [ ] **Step 3: Add the shared column tuple**

Create `lib/technicianTableColumns.ts` with the current `COLS` entries in their
existing order and append `"car_license_plate"` as the final item:

```ts
export const TECHNICIAN_TABLE_COLUMNS = [
  "national_id",
  "tech_id",
  "card_expire_date",
  "full_name",
  "doc_tech_card_url",
  "workgroup_status",
  "work_type",
  "provider",
  "area",
  "rsm",
  "ctm",
  "depot_code",
  "depot_name",
  "province",
  "power_authority",
  "car_license_plate",
] as const;
```

Import this tuple into `components/TechBrowser.tsx`, replace local `COLS`
references with `TECHNICIAN_TABLE_COLUMNS`, and add:

```ts
car_license_plate: 140,
```

to the existing width map.

- [ ] **Step 4: Run the column test and verify GREEN**

Run:

```bash
node --test --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tests/technicianTableColumns.test.mjs
```

Expected: 1 test PASS.

- [ ] **Step 5: Commit the table-column change**

```bash
git add lib/technicianTableColumns.ts tests/technicianTableColumns.test.mjs components/TechBrowser.tsx
git commit -m "feat: add license plate table column"
```

### Task 2: API Response and Sorting

**Files:**
- Create: `tests/technicianLicensePlateApi.test.mjs`
- Modify: `app/api/technicians/route.ts:45-68`
- Modify: `app/api/technicians/route.ts:160-198`

**Interfaces:**
- Consumes: `technicians.car_license_plate`.
- Produces: `rows[].car_license_plate: string | null`.
- Produces: working `sort=car_license_plate&dir=asc|desc`.

- [ ] **Step 1: Write the failing API behavior test**

Create `tests/technicianLicensePlateApi.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";

async function search(dir) {
  const url = new URL("http://localhost:3001/api/technicians");
  url.searchParams.set("q", "5676");
  url.searchParams.set("pageSize", "50");
  url.searchParams.set("sort", "car_license_plate");
  url.searchParams.set("dir", dir);

  const response = await fetch(url);
  const body = await response.json();
  assert.equal(response.status, 200, body.error);
  return body.rows;
}

test("returns searched license plates and sorts them in both directions", async () => {
  const ascending = await search("asc");
  const descending = await search("desc");

  assert.ok(ascending.length > 0);
  assert.ok(
    ascending.every(
      (row) =>
        Object.hasOwn(row, "car_license_plate") &&
        String(row.car_license_plate).includes("5676"),
    ),
  );

  const plates = ascending.map((row) => row.car_license_plate);
  assert.deepEqual(descending.map((row) => row.car_license_plate), [...plates].reverse());
});
```

- [ ] **Step 2: Run the API test and verify RED**

Keep the existing local development server running on port 3001, then run:

```bash
node --test tests/technicianLicensePlateApi.test.mjs
```

Expected: FAIL because returned rows do not contain `car_license_plate`.

- [ ] **Step 3: Extend the existing API mapping**

In `app/api/technicians/route.ts`, append `"car_license_plate"` to the existing
`cols` sort allowlist and add this property to the mapped row object:

```ts
car_license_plate: r.car_license_plate ?? null,
```

Do not change the Supabase select, because the route already selects `*`.

- [ ] **Step 4: Run API and full search tests**

Run:

```bash
node --test tests/technicianLicensePlateApi.test.mjs
node --test --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tests/technicianSearch.test.mjs tests/technicianTableColumns.test.mjs
```

Expected: API test and all existing search tests PASS.

- [ ] **Step 5: Run build and visual verification**

Run:

```bash
npm run build
```

Then open `http://localhost:3001`, search for `5676`, and confirm the last
header is `ทะเบียนรถ` and both returned rows display their matching license
plates. Confirm the pagination counter and existing columns remain unchanged.

- [ ] **Step 6: Commit API integration**

```bash
git add app/api/technicians/route.ts tests/technicianLicensePlateApi.test.mjs
git commit -m "feat: expose license plates in technician results"
```

- [ ] **Step 7: Final verification**

Run:

```bash
node --test tests/technicianLicensePlateApi.test.mjs
node --test --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tests/technicianSearch.test.mjs tests/technicianTableColumns.test.mjs
npm run build
git status --short
```

Expected: all tests and build pass; only the pre-existing `.claude/` entry
remains untracked.
