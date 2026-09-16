# Allconnect Upload Design

## Goal

Add an admin-only upload workflow to the All connect compare tech dashboard. The workflow accepts the monthly Allconnect CSV export, reports upload progress, validates all source columns, and atomically replaces the rows in `public.allconnect` without changing its schema.

The reference file is a UTF-8 CSV named `allconnect.txt`. It is about 41 MB and contains 103 source columns, one header row, and 26,780 data rows. The uploader also accepts `.csv` files with the same structure.

## User Experience

The `Upload All connect` button appears above the RBM area selector and is visible only to users whose application JWT role is `admin`.

Selecting a file starts these visible states:

1. Validate the file extension, size, CSV structure, and exact 103-column header.
2. Show a progress bar from 0% to 100% while parsing and uploading batches.
3. Show the number of rows accepted, for example `12,500 / 26,780 rows` when the total is known.
4. Show a final database replacement state after all batches have arrived.
5. On success, show the imported row count and import time, clear the file input, and refresh the dashboard data.

The upload controls remain disabled while an upload is active. Errors appear next to the progress area with a specific cause and a retry action. Existing dashboard filters and data remain usable after a failed upload.

## Client Processing

The browser uses Papa Parse in worker mode so the 41 MB file is not loaded into one large array on the main UI thread. Parsing keeps every source value as text, supports quoted commas and quoted line breaks, strips a UTF-8 BOM from the first header, and ignores completely empty trailing rows.

The client validates the ordered header list against the canonical 103 headers before sending rows. Missing, extra, duplicated, or reordered headers stop the upload. The file limit is 200 MB.

Parsed rows are sent sequentially in batches small enough to keep each API request comfortably below common request-size limits. The parser pauses while each batch is persisted, so progress never advances beyond data that the server has accepted. Parsing and batch upload occupy 0-95% of the progress bar; the atomic database replacement occupies 95-100%.

## Server API

A new Next.js route handles four actions: `start`, `chunk`, `commit`, and `abort`. Every action validates the `auth-token` JWT and requires the role to equal `admin`. The browser never receives the Supabase service-role key.

- `start` creates a random batch ID and records the current Allconnect snapshot timestamp.
- `chunk` validates the batch ID, row shape, canonical field names, and batch size, then inserts staged JSON rows with stable row numbers.
- `commit` invokes the transactional replacement function and returns the inserted row count and import timestamp.
- `abort` deletes staged rows for that batch. The client calls it after parsing or upload failures when possible.

All API responses use `Cache-Control: private, no-store`. Request errors return a safe Thai message and a machine-readable error code for the UI.

## Database Design

Create `public.allconnect_import_rows` with these fields:

- `batch_id uuid`
- `row_number integer`
- `payload jsonb`
- `created_at timestamptz`
- Primary key `(batch_id, row_number)`

RLS is enabled. `PUBLIC`, `anon`, and `authenticated` receive no access. Only `service_role` can read and write staged rows.

Create a `SECURITY INVOKER` function callable only by `service_role`. The function obtains a transaction-level advisory lock, confirms the current Allconnect snapshot still matches the timestamp captured by `start`, and requires at least one staged row. In one transaction it:

1. Deletes the existing rows from `public.allconnect` while preserving the table and all 103 columns.
2. Converts staged JSON payloads into the `public.allconnect` composite type.
3. Generates new `uuid`, `created_at`, and `updated_at` values for every imported row.
4. Inserts rows in source order.
5. Deletes the completed staging batch.
6. Returns the inserted row count and import timestamp.

Any exception rolls back the complete transaction, including deletion of the old rows. The snapshot comparison prevents a later concurrent upload from silently overwriting a newer completed import. Staged rows older than 24 hours are removed when a new upload begins.

## Data Integrity

The table schema is never dropped or recreated during upload. Only data rows are replaced. Source headers map exactly and case-sensitively to the existing columns, including `Shop_code`, `TDS_Province_PIS`, and `CONFRIM_COMPLETE_TIME` with their current spellings.

The generated audit columns are excluded from uploaded payloads. Empty CSV cells become empty text values, matching the existing all-text source schema. A malformed CSV row, inconsistent field count, duplicate row number, unknown property, or missing property fails before replacement.

## Testing

Automated tests cover:

- Canonical header validation, including BOM handling and missing, extra, reordered, and duplicated columns.
- File-size and batch-size limits.
- Admin authorization and rejection of manager, regular user, expired, and missing sessions.
- Chunk normalization and stable row numbering.
- Abort cleanup.
- Atomic replacement success, row counts, generated audit fields, stale-snapshot rejection, and rollback on malformed staged data.
- UI progress, disabled controls, error recovery, successful dashboard refresh, and responsive placement above the RBM selector.

The reference file is used for a final browser test. The verification records the current row count first and confirms the completed import contains 26,780 rows. Database tests use isolated test batches and transactions so a failed test cannot leave the production snapshot empty or partially replaced.

## Security and Operations

Authorization is enforced on the server for every action; hiding the button is only a UI convenience. The API limits file and batch sizes, validates all payload keys, and does not expose raw database errors. The staging table is inaccessible through anonymous or authenticated Data API roles. Database advisors are run after the schema change, and the upload function explicitly revokes default `PUBLIC` execution.
