# Technician Global Search Design

## Goal

Improve the main-page general search field so a viewer can type any term and
immediately see matching rows sourced from the `technicians` table. Existing
pagination and all dedicated filters must continue to work as they do today.

## Scope

- Change only the general-search behavior used by `/api/technicians` and the
  main technician table.
- Keep the existing 400 ms input debounce and server-side pagination.
- Preserve the dedicated `national_id`, `tech_id`, RBM, and `depot_code`
  filters.
- Preserve sorting, authorization, masking, detail views, charts, KPIs, and
  exports.
- Do not alter the `technicians` table schema or add database objects.

## Search Behavior

The API will maintain an explicit list of searchable columns that covers every
column currently present in `technicians`.

- Text-compatible columns use case-insensitive partial matching.
- Numeric, boolean, and date-like columns use type-safe matching when the input
  can be parsed for that type. Invalid typed comparisons are omitted instead of
  failing the request.
- Service and course names such as `iot`, `cctv`, `solar`, `course_g`, and
  `course_ec` retain semantic matching: typing a supported column name returns
  rows whose corresponding qualification field is active or passed.
- Commas and percent characters in user input are sanitized before constructing
  the PostgREST OR expression.
- An empty search term applies no general-search condition.

Dedicated filters remain combined with the general search using AND semantics.
Within the general search, matching any searchable column is sufficient for a
row to be included.

## Data Flow

1. The viewer types in the general search field.
2. The existing debounce waits 400 ms after the last keystroke.
3. `TechBrowser` requests page 1 from `/api/technicians` with the `q` parameter
   and any active dedicated filters.
4. The API applies identical search conditions to the count query and row query.
5. The API returns the requested page, total match count, and total pages.
6. The existing table renders the rows and pagination controls.

## Error Handling

- Search input is normalized and sanitized before it reaches PostgREST filters.
- Typed conditions are added only when parsing succeeds.
- Supabase query errors continue to use the existing API error response and
  existing main-page error display.
- No client-side full-table fallback is introduced.

## Testing

- Add focused tests for search-condition construction before changing
  production behavior.
- Cover partial text matching, service-column terms, typed values, sanitization,
  and empty input.
- Verify count and data queries receive equivalent search behavior.
- Run the project build.
- Query the API with representative terms from different `technicians`
  columns and verify counts and returned rows.
- Open the main page in the in-app browser and verify automatic search,
  pagination, dedicated filters, clearing, and layout.

## Acceptance Criteria

- Typing a term automatically refreshes matching technician rows without
  pressing the search button.
- Values from all supported `technicians` columns can contribute matches.
- Results remain paginated and show the correct total count.
- Existing dedicated filters can be combined with the general search.
- No unrelated page structure, chart, KPI, authorization, or database schema
  changes are introduced.
