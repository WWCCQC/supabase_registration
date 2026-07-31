# Technician License Plate Column Design

## Goal

Show the vehicle license plate for every technician row so partial license-plate
search results can be understood directly from the main table.

## Scope

- Add `car_license_plate` to each row returned by `/api/technicians`.
- Add `car_license_plate` to the API sort allowlist.
- Display the existing Thai label `ทะเบียนรถ`.
- Place the column last in the main technician table.
- Show the column at all times with a stable width of 140px.
- Preserve search, debounce, dedicated filters, pagination, authorization,
  masking, charts, KPIs, details, and all existing columns.
- Do not alter the `technicians` table schema.

## Data Flow

1. `/api/technicians` reads the existing `car_license_plate` value from the
   selected `technicians` row.
2. The route includes `car_license_plate` in its mapped response object.
3. `TechBrowser` includes the field as the last item in `COLS`.
4. The table header uses the existing `getFieldLabel` mapping and each row
   renders the returned value.
5. Clicking the header sends `sort=car_license_plate`; the API accepts that
   field and applies the existing ascending or descending ordering.

## Error Handling

Missing license plates render as an empty cell, matching the behavior of other
plain-text columns. Existing API and page-level error handling remains
unchanged.

## Testing

- Add a failing test that proves a searched API row exposes
  `car_license_plate`.
- Add a focused assertion that the field is accepted for sorting.
- Verify the table places `car_license_plate` after every existing column.
- Run the search test suite and production build.
- Query the live local API with a partial license plate and confirm returned
  rows include their plate values.
- Verify the column visually in the main table after login.

## Acceptance Criteria

- A partial license-plate search returns matching rows whose plate is visible in
  the last table column.
- The license-plate column is always present.
- License-plate sorting works in both directions through the existing sort
  behavior.
- No unrelated layout or behavior changes are introduced.
