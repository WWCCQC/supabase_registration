import assert from "node:assert/strict";
import test from "node:test";

import {
  applyTechnicianGeneralSearch,
  buildTechnicianSearchExpression,
} from "../lib/technicianSearch.ts";

test("searches representative values from every technician data group", () => {
  const expression = buildTechnicianSearchExpression("Bangkok");

  assert.ok(expression);
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

  assert.ok(expression);
  assert.match(expression, /svc_iot\.eq\.Pass/);
  assert.match(expression, /full_name\.ilike\./);
});

test("quotes PostgREST reserved characters in a search value", () => {
  const expression = buildTechnicianSearchExpression("Doe, Jane");

  assert.ok(expression);
  assert.match(expression, /full_name\.ilike\."\*Doe, Jane\*"/);
});

test("adds a timestamp range only for a complete ISO date", () => {
  const expression = buildTechnicianSearchExpression("2026-07-31");

  assert.ok(expression);
  assert.match(
    expression,
    /and\(updated_at\.gte\.2026-07-31T00:00:00\.000Z,updated_at\.lt\.2026-08-01T00:00:00\.000Z\)/,
  );
});

test("returns null for an empty search", () => {
  assert.equal(buildTechnicianSearchExpression("   "), null);
});

test("applies one OR expression for a non-empty search", () => {
  const calls = [];
  const query = {
    or(expression) {
      calls.push(expression);
      return this;
    },
  };

  const result = applyTechnicianGeneralSearch(query, "Bangkok");

  assert.equal(result, query);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /full_name\.ilike\."\*Bangkok\*"/);
});

test("leaves the query unchanged for an empty search", () => {
  let callCount = 0;
  const query = {
    or() {
      callCount += 1;
      return this;
    },
  };

  const result = applyTechnicianGeneralSearch(query, " ");

  assert.equal(result, query);
  assert.equal(callCount, 0);
});
