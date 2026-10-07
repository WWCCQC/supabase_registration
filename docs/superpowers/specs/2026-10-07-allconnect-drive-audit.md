# Allconnect automatic import — source audit and proposed design

Status: historical audit. The user subsequently confirmed complete dates and explicitly chose APPEND-ONLY BY DATE: never alter an existing date. The reconciliation proposal below is superseded by `docs/allconnect-auto-import.md`; it must not be used as implementation instructions.

## Authorized objective

Read daily CSV exports from Google Drive folder `1hWjOpGX2tfW-dCwUMsqXeA7mRMH2LkMR`, start processing at 15:00 Asia/Bangkok, merge into Supabase `public.allconnect`, preserve older months, and reuse the existing batch import approach. User authorized inspection and development on 2026-10-07.

## Verified evidence

- Folder: `upload_allconnect`.
- File: `rawdata_install_repair_techcenter_202609_to_202610.csv`, ID `1UPeknUib2lQuRl5d7ub3oczeKSC7DQr2`.
- Size: 71,862,004 bytes. UTF-8, pipe-delimited despite the `.csv` suffix.
- 23 source headers match the current application format. 134,441 data rows; no field-count errors in the Python CSV audit.
- Actual coverage is 2026-09-06 through 2026-10-06: 108,997 September rows and 25,444 October rows. Do not infer coverage from the filename or assume whole calendar months.
- 43,782 distinct STAFF_ID/PERFORMANCE_DATE pairs. Adding MasterTech_team_code does not increase uniqueness. A pair can have up to 16 rows.
- Even all 21 non-job columns do not uniquely identify rows: 118,839 combinations, with 12,403 repeated combinations.
- 6,857 groups of entirely identical source rows, accounting for 7,742 additional occurrences. Do not silently deduplicate: repeated rows may contribute legitimate counts.
- 10 rows have an empty STAFF_ID. Do not silently discard them or invent an identity.
- Live database `sggunyytungtyhezchft` has 151,834 rows at inspection. Its 23 source fields match the current uploader.
- Database dates outside the new file: August 29–31 and September 1–5, totaling 36,261 rows. Preserve these dates.
- New dates absent from the current database: September 30 and October 4–6, totaling 17,425 source rows.
- September 25 decreases from 3,721 to 3,720 rows; September 26 decreases from 3,769 to 3,767. Append-only import cannot represent every correction.
- If the file is authoritative for all dates it contains, replacing only those dates would produce 170,702 total rows while preserving all dates outside the file. This is a conditional count projection, not an applied import or a claim that corrections are approved.

## Existing implementation

- `components/allconnect/AllconnectUpload.tsx`: browser orchestrates batches of 200 rows.
- `components/allconnect/allconnectUpload.worker.ts`: reads the entire file as text before parsing chunks; automatic runner should use genuine streaming instead.
- `lib/allconnectUpload.ts`: 23-column validation, 200 MiB size cap, batch validation.
- `app/api/allconnect-upload/route.ts`: admin-cookie authorization; start/chunk/commit/abort actions; staging in `allconnect_import_rows`.
- `update-allconnect-techcenter.sql`: commit deletes all current rows and inserts the snapshot transactionally. This must not remain the routine path after historical retention is enabled.
- `scripts/import-allconnect-techcenter.mjs`: existing command-line uploader also replaces all rows and reads the whole file into memory; do not run it on this source.
- Dashboard already has month filtering and historical displays. Verify these against the retained history rather than adding a duplicate filter.
- `vercel.json` specifies a 30-second API duration. Do not put a complete 140 MB download/import into one existing web request.
- Local Supabase server configuration exists. The inspected Google application credential variables are absent. Connected Drive access in this chat does not provide a deployed runner with unattended credentials.

## Recommended reconciliation, subject to source completeness confirmation

Use the file as a snapshot of the exact dates it contains, not a full-table or full-month replacement. Preserve dates not present, including holes inside the range. Preserve duplicate multiplicity.

Stage a complete file under a batch ID with an expected row count and explicit date manifest. Validate headers, UTF-8, calendar dates, Month/date agreement, job counts, and downloaded byte count/checksum before touching active data. Reject malformed or partial files; log missing staff IDs rather than dropping rows.

For each covered date, compare full source payloads as multisets (payload plus occurrence count). Keep unchanged occurrences and their UUIDs. Add excess incoming occurrences and remove excess old occurrences only within confirmed authoritative dates, all in one transaction. Without a source record ID, do not claim a deleted/inserted pair is a definitively matched row update. Log inserted/removed/unchanged rows and changed dates honestly.

Protect manual and automated commits with the same lock and a persisted dataset revision. Record file ID, version/checksum, source ordering, batch state, row counts, and successful commit together. Reject a file that changed during download, duplicate commits, stale batches and out-of-order snapshots. Use durable run state so lost responses can be retried safely.

Process unseen rolling snapshots chronologically; selecting only the latest global file can skip dates after an outage longer than the source window. A changed revision of an older file must not overwrite newer accepted data without an explicit correction policy.

## Runtime and scheduling

Use a streaming Node.js runner reusing Papa Parse and the current source-column contract. It downloads from the private Drive folder, stages bounded batches, and calls the database commit function. The scheduling target is 15:00 Asia/Bangkok, not an import-completion guarantee.

Select and provision a durable execution host after inspecting available deployment access. Configure unattended Drive authentication with minimal read access and keep Supabase server credentials in the runtime's secret store. Do not expose the folder publicly or embed secrets in the repository. No paid resource or production schedule has been provisioned during this audit.

## Required validation before activation

Test repeated identical rows, missing STAFF_ID, changed job counts, shrinking day snapshots, absent historical dates, empty/truncated files, month rollover, invalid dates, replay, out-of-order revisions, lost commit responses and manual/automatic concurrency. Run a read-only preview against this exact file, then verify totals and dashboard results after the initial authorized import. Verify the scheduler and runtime credentials separately; code completion alone does not mean daily automation is active.

## Open contract question

Does every date present in each export include all rows for that date? If not, date-authoritative reconciliation is unsafe; obtain a stable source record key or a clear partition identity before implementing deletion/update behavior. A timer or upload chunk size cannot resolve that ambiguity.
