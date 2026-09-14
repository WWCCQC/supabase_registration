import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const cases = [
  ["UPC", "หัวหน้า", "เชียงใหม่", "OK", true],
  ["UPC", "ลูกน้อง", "เชียงใหม่", "OK", false],
  ["UPC", null, "เชียงใหม่", "OK", false],
  ["BMA", "หัวหน้า", "กรุงเทพมหานคร", "OK", true],
  ["BMA", "ลูกน้อง", "กรุงเทพมหานคร", "OK", true],
  ["BMA", "หัวหน้า", "ปทุมธานี", "OK", true],
  ["BMA", "ลูกน้อง", "ปทุมธานี", "OK", false],
  ["BMA", "อื่นๆ", "กรุงเทพมหานคร", "OK", false],
  ["UPC", "หัวหน้า", "เชียงใหม่", "WW-BM-0093", false],
  ["BMA", "หัวหน้า", "กรุงเทพมหานคร", "WW-BM-0029", false],
  ["BMA", "ลูกน้อง", null, null, true],
];
const fixtures = cases.map(([area, workgroup_status, province, depot_code], index) => ({
  area, workgroup_status, province, depot_code, national_id: `id${index}`,
  tech_id: index, RBM: "R1", HRBM: "H1", provider: "P1",
  power_authority: index % 2 ? "No" : "Yes", course_g: "Pass", course_ec: "Pass",
}));

// Run the actual route with a local Supabase transport, including select projection
// and pagination so missing filter columns or premature pagination termination fail.
function loadRoute(path, records) {
  const supabase = { from() {
    let rows = records;
    let columns;
    let start = 0;
    let end = records.length;
    return {
      select(value) { columns = value.split(",").map((s) => s.trim()); return this; },
      eq(key, value) { rows = rows.filter((r) => r[key] === value); return this; },
      ilike(key, value) { rows = rows.filter((r) => String(r[key] ?? "").toLowerCase() === value); return this; },
      or(expression) { const key = expression.split(".")[0]; rows = rows.filter((r) => r[key] == null || r[key] === ""); return this; },
      order() { return this; },
      range(from, to) { start = from; end = to + 1; return this; },
      then(resolve) { return Promise.resolve({ data: rows.slice(start, end).map((r) => Object.fromEntries(columns.map((c) => [c, r[c]]))), error: null }).then(resolve); },
    };
  } };
  function load(file) {
    const source = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const module = { exports: {} };
    new Function("require", "module", "exports", source)((id) => {
      if (id === "@/lib/supabase-admin") return { supabaseAdmin: () => supabase };
      if (id.startsWith("@/")) return load(`../${id.slice(2)}.ts`);
      return require(id);
    }, module, module.exports);
    return module.exports;
  }
  return load(path).GET;
}

test("Power and EC apply their own eligibility before unique counting", async () => {
  const GET = loadRoute("../app/api/chart/rsm-workgroup/route.ts", [...fixtures, fixtures[0]]);
  const body = await (await GET(new Request("http://localhost/api/chart/rsm-workgroup"))).json();
  assert.equal(body.summary.totalYes, 3);
  assert.equal(body.summary.totalNo, 2);
  assert.equal(body.chartData[0].Yes, 3);
  assert.equal(body.chartData[0].No, 2);
  assert.equal(body.chartData[0].total, 5);
  assert.equal(body.chartData[0].CourseG, 11);
  assert.equal(body.chartData[0].CourseEC, 9);
  assert.equal(body.chartData[0].totalRbm, 11);
});

const ecFixtures = [
  { ...fixtures[1], course_ec: "Pass" }, // UPC subordinate remains eligible for EC.
  { ...fixtures[6], course_ec: null }, // Pathum Thani subordinate also remains eligible.
  { ...fixtures[8], course_ec: "Pass" },
  { ...fixtures[9], course_ec: null },
];

test("EC excludes depots from both pass and not-pass totals without changing G", async () => {
  const GET = loadRoute("../app/api/chart/rsm-workgroup/route.ts", [...ecFixtures, ecFixtures[0]]);
  const body = await (await GET(new Request("http://localhost/api/chart/rsm-workgroup"))).json();
  assert.equal(body.summary.totalCourseEC, 1);
  assert.equal(body.chartData[0].CourseEC, 1);
  assert.equal(body.chartData[0].CourseECNo, 1);
  assert.equal(body.chartData[0].CourseG, 4);
  assert.equal(body.chartData[0].totalRbm, 4);
});

for (const status of ["pass", "notpass"]) {
  test(`EC ${status} details exclude both depots`, async () => {
    const GET = loadRoute("../app/api/chart/course-detail/route.ts", ecFixtures);
    const body = await (await GET(new Request(`http://localhost/api/chart/course-detail?course=ec&status=${status}&rbm=R1`))).json();
    assert.equal(body.total, 1);
    assert.equal(body.rows[0].tech_id, status === "pass" ? 1 : 6);
  });
}

test("G details retain technicians from the excluded EC depots", async () => {
  const GET = loadRoute("../app/api/chart/course-detail/route.ts", ecFixtures);
  const body = await (await GET(new Request("http://localhost/api/chart/course-detail?course=g&status=pass"))).json();
  assert.equal(body.total, 4);
});

test("EC details paginate beyond a full excluded page", async () => {
  const GET = loadRoute("../app/api/chart/course-detail/route.ts", [...Array(1000).fill(ecFixtures[2]), ecFixtures[0]]);
  const body = await (await GET(new Request("http://localhost/api/chart/course-detail?course=ec&status=pass"))).json();
  assert.equal(body.total, 1);
  assert.equal(body.rows[0].tech_id, 1);
});

for (const status of ["Yes", "No"]) {
  test(`Power ${status} details exclude ineligible technicians`, async () => {
    const GET = loadRoute("../app/api/chart/power-authority-detail/route.ts", fixtures);
    const body = await (await GET(new Request(`http://localhost/api/chart/power-authority-detail?power_authority=${status}&rbm=R1`))).json();
    assert.deepEqual(body.rows.map((r) => r.tech_id), status === "Yes" ? [0, 4, 10] : [3, 5]);
    assert.equal(body.total, status === "Yes" ? 3 : 2);
  });
}

test("details continue past a full page of excluded technicians", async () => {
  const records = [...Array.from({ length: 1000 }, () => fixtures[8]), fixtures[0]];
  const GET = loadRoute("../app/api/chart/power-authority-detail/route.ts", records);
  const body = await (await GET(new Request("http://localhost/api/chart/power-authority-detail?power_authority=Yes"))).json();
  assert.equal(body.total, 1);
  assert.equal(body.rows[0].tech_id, 0);
});
