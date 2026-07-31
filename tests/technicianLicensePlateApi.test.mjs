import assert from "node:assert/strict";
import test from "node:test";

async function search(dir) {
  const baseUrl = process.env.TEST_BASE_URL || "http://localhost:3001";
  const url = new URL("/api/technicians", baseUrl);
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
    ascending.every((row) => Object.hasOwn(row, "car_license_plate")),
  );
  assert.ok(
    ascending.some((row) =>
      String(row.car_license_plate).includes("5676"),
    ),
  );

  const plates = ascending.map((row) => row.car_license_plate);
  assert.deepEqual(
    descending.map((row) => row.car_license_plate),
    [...plates].reverse(),
  );
});
