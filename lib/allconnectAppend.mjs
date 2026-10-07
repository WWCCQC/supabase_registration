import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Transform } from 'node:stream';
import Papa from 'papaparse';
import { validateUploadFile, validateAllconnectHeaders, normalizeAllconnectRow } from './allconnectUpload.ts';

export function workDate(value) {
  const text = String(value ?? '').trim();
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(text)) throw new Error('Invalid PERFORMANCE_DATE');
  const iso = `${text.slice(6)}-${text.slice(3, 5)}-${text.slice(0, 2)}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso || iso < '0001-01-01') {
    throw new Error('Invalid calendar date');
  }
  return iso;
}

export function planNewDates(dates, existingDates) {
  const existing = new Set(existingDates);
  const newDates = Object.keys(dates).filter(date => !existing.has(date)).sort();
  const insertRows = newDates.reduce((count, date) => count + dates[date], 0);
  return { newDates, insertRows, skipRows: Object.values(dates).reduce((a, b) => a + b, 0) - insertRows };
}

// Both passes validate the complete file. Only bounded parser chunks live in memory.
export async function scanCsv(path, { onBatch, batchSize = 200 } = {}) {
  const before = await stat(path);
  validateUploadFile({ name: path, size: before.size });
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 200) throw new Error('Invalid batch size');
  const hash = createHash('sha256');
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0, rows = 0, headersChecked = false;
  const dates = Object.create(null);
  const input = createReadStream(path, { highWaterMark: 256 * 1024 });
  const decoded = new Transform({
    transform(chunk, encoding, callback) {
      try { bytes += chunk.length; hash.update(chunk); callback(null, decoder.decode(chunk, { stream: true })); }
      catch { callback(new Error('CSV must contain valid UTF-8')); }
    },
    flush(callback) {
      try { callback(null, decoder.decode()); } catch { callback(new Error('Incomplete UTF-8 at end of file')); }
    },
  });
  decoded.setEncoding('utf8');
  await new Promise((resolve, reject) => {
    let failed = false;
    const fail = error => {
      if (failed) return;
      failed = true; input.destroy(); decoded.destroy(); reject(error);
    };
    input.on('error', fail); decoded.on('error', fail);
    Papa.parse(decoded, {
      header: true, dynamicTyping: false, skipEmptyLines: 'greedy', delimitersToGuess: ['|', ',', '\t', ';'],
      transformHeader: (header, index) => index === 0 ? header.replace(/^\uFEFF/, '') : header,
      chunk(result, parser) {
        parser.pause();
        (async () => {
          if (!headersChecked) {
            const validation = validateAllconnectHeaders(result.meta.fields ?? []);
            if (!validation.ok) throw new Error(validation.message);
            headersChecked = true;
          }
          if (result.errors.length) throw new Error('Malformed CSV: invalid quoting or field count');
          const normalized = result.data.map(raw => {
            const row = normalizeAllconnectRow(raw);
            const date = workDate(row.PERFORMANCE_DATE);
            if (row.Month.trim() !== date.slice(0, 7)) throw new Error('Month does not match PERFORMANCE_DATE');
            dates[date] = (dates[date] ?? 0) + 1; rows++;
            return row;
          });
          if (onBatch) for (let offset = 0; offset < normalized.length; offset += batchSize) {
            await onBatch(normalized.slice(offset, offset + batchSize));
          }
          if (!failed) parser.resume();
        })().catch(fail);
      },
      complete() { if (!failed) resolve(); },
      error: fail,
    });
    input.pipe(decoded);
  });
  const after = await stat(path);
  if (!headersChecked || rows === 0) throw new Error('CSV has no data rows');
  if (bytes !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs) {
    throw new Error('CSV changed while reading');
  }
  return { rows, bytes, dates, sha256: hash.digest('hex') };
}

async function checked(request) {
  const { data, error } = await request;
  if (error) throw new Error(`Database request failed (${error.code || 'transport'})`);
  return data;
}

export async function importFile({ db, filePath, sourceId, commit = false, onProgress = () => {} }) {
  if (!/^[a-zA-Z0-9_.:-]{1,180}$/.test(sourceId ?? '')) throw new Error('Invalid source ID');
  const manifest = await scanCsv(filePath);
  const existing = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await checked(db.rpc('allconnect_existing_dates', {}, { get: true }).range(offset, offset + 999));
    existing.push(...page.map(row => row.work_date));
    if (page.length < 1000) break;
  }
  const plan = planNewDates(manifest.dates, existing);
  const summary = { fileRows: manifest.rows, bytes: manifest.bytes, sha256: manifest.sha256, ...plan };
  onProgress({ phase: 'validated', ...summary });
  if (!commit) return summary;
  const sourceKey = `${sourceId}:${manifest.sha256}`;
  const receipt = await checked(db.from('allconnect_import_runs').select('*').eq('source_key', sourceKey).maybeSingle());
  if (receipt) return { ...summary, phase: 'already_imported', receipt };
  const { randomUUID } = await import('node:crypto');
  const batchId = randomUUID();
  const wanted = new Set(plan.newDates);
  let staged = 0, commitStarted = false;
  try {
    const verified = await scanCsv(filePath, { onBatch: async rows => {
      const selected = rows.filter(row => wanted.has(workDate(row.PERFORMANCE_DATE)));
      if (!selected.length) return;
      await checked(db.from('allconnect_import_rows').insert(selected.map((payload, index) => ({
        batch_id: batchId, row_number: staged + index + 1, payload,
      }))));
      staged += selected.length;
      onProgress({ phase: 'staging', staged, expected: plan.insertRows });
    } });
    if (verified.sha256 !== manifest.sha256 || verified.rows !== manifest.rows || staged !== plan.insertRows) {
      throw new Error('File changed between validation and staging');
    }
    commitStarted = true;
    const data = await checked(db.rpc('append_allconnect_new_dates', {
      p_batch_id: batchId, p_expected_count: staged, p_source_key: sourceKey,
    }));
    if (!data?.[0]) throw new Error('Missing commit receipt; check import history before retry');
    return { ...summary, phase: 'complete', batchId, receipt: data[0] };
  } catch (error) {
    // Once commit is sent it may have succeeded despite a lost response. Preserve
    // staging and let a retry find the atomic receipt; never compensate live rows.
    if (!commitStarted) await db.from('allconnect_import_rows').delete().eq('batch_id', batchId);
    throw error;
  }
}
