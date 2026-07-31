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
    "card_expire_date_alt",
    "doc_driver_license_url",
    "address",
    "course_h",
  ]) {
    assert.match(expression, new RegExp(`${column}\\.ilike\\.`));
  }
});

test("preserves exact qualification-name search behavior", () => {
  const expression = buildTechnicianSearchExpression("iot");

  assert.equal(expression, "svc_iot.eq.Pass");
});

test("quotes PostgREST reserved characters in a search value", () => {
  const expression = buildTechnicianSearchExpression("Doe, Jane");

  assert.ok(expression);
  assert.match(expression, /full_name\.ilike\."\*Doe, Jane\*"/);
});

test("adds a timestamp range only for a complete ISO date", () => {
  const expression = buildTechnicianSearchExpression("2026-07-31");

  assert.ok(expression);
  for (const column of [
    "birth_date",
    "power_card_start_date",
    "power_card_expire_date",
  ]) {
    assert.match(expression, new RegExp(`${column}\\.eq\\.2026-07-31`));
    assert.doesNotMatch(expression, new RegExp(`${column}\\.ilike\\.`));
  }
  assert.match(
    expression,
    /and\(updated_at\.gte\.2026-07-31T00:00:00\.000Z,updated_at\.lt\.2026-08-01T00:00:00\.000Z\)/,
  );
});

test("searches typed date columns by year or month without ILIKE", () => {
  const yearExpression = buildTechnicianSearchExpression("2026");
  const monthExpression = buildTechnicianSearchExpression("2026-07");

  assert.ok(yearExpression);
  assert.ok(monthExpression);
  assert.match(
    yearExpression,
    /and\(birth_date\.gte\.2026-01-01,birth_date\.lt\.2027-01-01\)/,
  );
  assert.match(
    monthExpression,
    /and\(power_card_expire_date\.gte\.2026-07-01,power_card_expire_date\.lt\.2026-08-01\)/,
  );
  assert.doesNotMatch(yearExpression, /birth_date\.ilike\./);
  assert.doesNotMatch(monthExpression, /power_card_expire_date\.ilike\./);
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
