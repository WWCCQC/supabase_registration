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
