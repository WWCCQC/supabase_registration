# Allconnect daily import

Current scheduling status: Google Apps Script project created and its daily trigger activated on 2026-10-07 after the owner completed Google's OAuth authorization. The old Codex automation remains PAUSED. The append-only database functions and imported data remain in place.

## Google Apps Script project

- Project: [allconnect_import](https://script.google.com/home/projects/1fu7AkHfdZwVu7_vGyYwXuDpUSVvyYGffY1n82O5l1kUORQhYG2aoFUwj/edit), in Drive folder `1OWjJm2wJWwpSVernJOPo5YEQw3T5q7Q_`.
- Source file kept in this repository: `scripts/google-apps-script/allconnect_import/Code.gs`. Do not put credentials in source control.
- `SUPABASE_SERVICE_ROLE_KEY` is stored in the Google project's Script Properties. Current Google Drive metadata shows only `tqc.dev@gmail.com` as owner. Anyone given edit rights to this project can potentially read the key through code execution, so keep access private.
- The script selects the newest CSV in source folder `1hWjOpGX2tfW-dCwUMsqXeA7mRMH2LkMR`, downloads byte ranges, checkpoints progress, stages only rows whose `PERFORMANCE_DATE` does not already exist, and calls the append-only RPC. It does not open the whole 70–140 MB file at once. Retries upsert staging rows by `(batch_id,row_number)`; the final database receipt is idempotent.
- `installAllconnectTrigger` ran successfully. The Triggers page shows exactly one daily time-based `runAllconnectImport` trigger in the 15:00–16:00 Bangkok window. Google time triggers are approximate (roughly ±15 minutes around the requested 15:00), not exact to the minute.
- The script handles a Google Drive partial-download quirk seen on the real UTF-8-BOM CSV: a byte range starting at zero returns three fewer body bytes while its Content-Range still covers the BOM. Other short responses remain errors. It decodes once per 1 MB range, preserving split Thai UTF-8 characters.
- Live test at 15:50–15:53 Bangkok on 2026-10-07: processed all 71,862,004 bytes and 134,441 rows; no unseen dates, so inserted 0 rows. Supabase remained at 169,259 live rows with 0 staging rows; one zero-row receipt was recorded. A repeated run returned `Already imported` immediately. This proves scanning, Supabase date lookup, empty append commit, and replay. The Apps Script staging of an actual new date will be exercised when the next new-date CSV arrives; the database append RPC was separately exercised by the earlier 17,425-row import.

## Current contract (confirmed 2026-10-07)

Import **only complete dates not already present** in `public.allconnect`, using `PERFORMANCE_DATE` (DD/MM/YYYY). Membership is checked against every existing date, not merely MAX(date). Any existing date is skipped in its entirety: no corrections, deletions, updates, UUID changes, or timestamp changes. All occurrences in a new date are retained, including identical rows and missing STAFF_ID. The user confirmed each date in the file is complete.

Folder: `https://drive.google.com/drive/folders/1hWjOpGX2tfW-dCwUMsqXeA7mRMH2LkMR` (`upload_allconnect`). Files are CSV exports, currently pipe-delimited UTF-8 with the canonical 23 columns. Actual date coverage comes from rows, not filenames. Keep the folder private.

## Previous local runner (paused)

The initial scheduler was a Codex chat automation at **15:00 Asia/Bangkok**, using the connected Google Drive plugin and this local Node.js runner. It is PAUSED. It required the computer to be awake and the desktop app running. The active Google Apps Script above replaces that scheduler.

Use Node 22.6+ with `--experimental-strip-types` (the current installed Node supports it). The project already has Papa Parse, dotenv and the Supabase client. No new package dependency is needed. `.env.local` supplies server credentials; never print it or copy secrets into this file, a prompt, or the browser.

Preview:

```sh
node --experimental-strip-types scripts/import-allconnect-new-dates.mjs /absolute/path/source.csv --preview drive:FILE_ID:MODIFIED_TIME
```

Import after validating the download:

```sh
node --experimental-strip-types scripts/import-allconnect-new-dates.mjs /absolute/path/source.csv --commit drive:FILE_ID:MODIFIED_TIME
```

`sourceId` permits letters, digits, underscore, hyphen, dot and colon. Use the observed Drive file ID and ISO modified time, not an arbitrary filename. Quote shell arguments properly. A source key combines this ID with a SHA-256 of the file. The default CLI mode is read-only.

## Previous Codex automation procedure (currently paused)

1. Read this runbook. Use the connected Google Drive plugin to list only direct, non-trashed CSV children of the specified folder. Folder fetch currently works; a legacy search returned an empty result despite the file being accessible, so do not treat an empty search alone as an empty folder. If listing is capped or incomplete, obtain a complete listing using supported pagination; if unavailable, report the limitation rather than silently treating the listing as complete.
2. Read successful source keys from Supabase `allconnect_import_runs` in project `sggunyytungtyhezchft`. Only skip a file when its exact file ID + modification time prefix has a successful receipt. Paginate history reads if necessary. Process unseen CSV versions newest-modified first so the latest export supplies missing days; older unseen files can fill dates absent from the newest rolling window. Break modification-time ties deterministically by file ID.
3. Read Drive metadata (ID, MIME type, size, modified time and checksum if available). Fetch original bytes with `download_raw_file=true, include_base64=false`. Materialize the authenticated returned file reference into a private temporary directory, retaining `.csv`. Never log bearer download URLs, base64, CSV rows or secrets. Do not alter Drive files or sharing.
4. Verify the local byte count equals Drive metadata. Read metadata again and require size/version/modified time to be unchanged; verify provider checksum when supplied. Reject an incomplete or changing download. A missing or unverified size is a failure, not permission to import.
5. Run the preview CLI from `/Users/pathom/web/registration`, using the absolute Node path `/Users/pathom/.hermes/node/bin/node` when PATH lacks a suitable Node. Then run `--commit` on the same local file with the same source ID. The user has authorized this append-only import. Do not reimplement it using SQL inserts or run historical replacement scripts.
6. Check command exit status and `phase`. `complete` reports newly inserted dates/rows; `already_imported` is a replay, not another insertion. Confirm receipt and date row counts through a read-only database query. After a lost response, retry the same immutable file/source; the database receipt prevents another insertion. Never delete live rows as compensation.
7. Remove only this run's temporary downloaded CSV after verification. Leave original Drive files and all existing database rows untouched. Failed staging is never active data; old staging is cleaned by the existing upload lifecycle. Do not record a failed file as processed.
8. Stay quiet on unchanged/no-new-date runs. Notify in this chat only when rows were added, a run failed, or user action is needed. Include file name, new dates, inserted count and any failure, but no source personal data. If no file is available or a download fails, keep current data unchanged. Do not send external messages.

## Database and browser compatibility

`create-allconnect-append.sql` creates the date parser, existing-date reader, append RPC and a server-only receipts table with RLS. It must be applied after the current 23-column schema and staging table. The append RPC locks both date selection and insertion, checks row count/contiguity/columns/date validity, and commits complete new days and its receipt in one transaction. No live source DELETE/UPDATE appears in this function.

The legacy `replace_allconnect_import` RPC name now delegates to append behavior, so the already-deployed browser cannot wipe history. New browser code passes an independent accepted-row count to the append RPC. Legacy clients still infer the count from staging; retain this compatibility only for the rollout, then retire the legacy path after deployment. Do not use the old replacement assertions/SQL fixtures as post-migration tests: they expect intentionally retired destructive behavior.

The new runner scans the entire file twice with bounded chunks and fatal UTF-8 validation, checks matching SHA-256 values, and sends only missing dates in batches of at most 200 rows. It does not open the entire 140 MB file as one string. The commit rechecks dates under a lock, protecting against a manual upload finishing during staging.

`allconnect_import_runs.skipped_count` counts rows skipped **within the staged subset** due to date overlap at commit. CLI `skipRows` also includes source rows filtered before staging. These are deliberately different measures.

## Verification

- `node --no-warnings --experimental-strip-types --test tests/*.test.mjs` (start `npm run dev` on port 3001 first for the existing technician API integration test).
- `npx tsc --noEmit --incremental false`.
- `tests/allconnect-append.sql`: runs in a transaction and rolls back fixtures; verifies unchanged old rows including audit fields, repeated source rows, empty staff, replay, invalid calendar dates and missing rows.
- Initial dry run: 134,441 source rows; 117,016 on existing dates; 17,425 new rows on 2026-09-30 and 2026-10-04/05/06.
- Baseline before import: 151,834 rows, full-row fingerprint `61a9a6a4db69d54b17a1d4255193472b`. Initial expected total: 169,259. Old rows must retain that fingerprint after excluding the four new dates.

The SQL security advisor reports no new executable-public-function issue for this import. RLS without client policies on staging/receipts is intentional (server only). Unrelated pre-existing advisor findings were not modified.

## Activation record

- Applied append-only database functions on 2026-10-07.
- First import committed at 15:13:58 Asia/Bangkok: 17,425 rows on four dates. Total 169,259.
- Preserved 151,834 original rows; full-row fingerprint (including UUID and timestamps) matched the baseline exactly.
- Re-running the same file returned `already_imported` with zero new dates.
- Verified actual new-date row counts: Sep 30 = 4,779; Oct 4 = 4,217; Oct 5 = 4,240; Oct 6 = 4,189.
- Codex automation ID `allconnect` was created for daily 15:00, then PAUSED after the user requested reconsidering Google Apps Script. No unattended scheduled run has occurred.
- 89 JavaScript tests passed with the existing development server available. TypeScript no-emit check passed. SQL rollback regression passed.
- Updated browser copy and independent expected-count submission are local project changes; no web deployment was performed. The deployed legacy RPC has already been changed to append-only, so existing web clients preserve history.
