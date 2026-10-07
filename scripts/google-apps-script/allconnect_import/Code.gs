/**
 * Allconnect daily import. Set SUPABASE_SERVICE_ROLE_KEY in Project Settings >
 * Script properties, then run installAllconnectTrigger once as the file owner.
 * Keep this project private: anyone who can edit it can run code that reads
 * its script properties.
 */
const AC = Object.freeze({
  folderId: '1hWjOpGX2tfW-dCwUMsqXeA7mRMH2LkMR',
  url: 'https://sggunyytungtyhezchft.supabase.co/rest/v1',
  headers: 'Month,PERFORMANCE_DATE,Primary_Team_RBM,Primary_Team_CBM,Primary_Team_Province,Primary_Team_District,DEPOT,SUB_NAME,STAFF_ID,STAFF_NAME,RBM,CBM,PROVINCE,District,SubDistrict,Group_Tech_Up,MasterTech_team_code,MasterTech_tech_team_type,MasterTech_group_of_work_assign,Job_Install,Job_Repair,Status_Tech,Team_Fucntion'.split(','),
  chunkBytes: 1024 * 1024,
  maxRunMs: 4 * 60 * 1000,
  stateKey: 'ALLCONNECT_IMPORT_STATE'
});

function installAllconnectTrigger() {
  // Time-driven triggers run in an approximate window around 15:00 Bangkok.
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'runAllconnectImport')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('runAllconnectImport').timeBased().atHour(15).nearMinute(0)
    .everyDays(1).inTimezone('Asia/Bangkok').create();
}

function runAllconnectImport() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try { runAllconnectImportLocked_(); }
  finally { lock.releaseLock(); }
}

function runAllconnectImportLocked_() {
  const started = Date.now();
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SUPABASE_SERVICE_ROLE_KEY')) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY script property');
  const latest = latestCsv_();
  if (!latest) throw new Error('No CSV in source folder');
  let state = JSON.parse(props.getProperty(AC.stateKey) || 'null');
  if (state && (state.fileId !== latest.id || state.size !== latest.size || state.modified !== latest.modified)) {
    // A new version supersedes the unfinished one; only staging rows are removed.
    request_('DELETE', '/allconnect_import_rows?batch_id=eq.' + encodeURIComponent(state.batchId), null);
    state = null;
    props.deleteProperty(AC.stateKey);
  }
  if (!state) {
    const sourceKey = latest.id + ':' + latest.modified + ':' + latest.size;
    const receipt = request_('GET', '/allconnect_import_runs?source_key=eq.' + encodeURIComponent(sourceKey) + '&select=batch_id&limit=1', null);
    if (receipt.length) { Logger.log('Already imported: ' + sourceKey); return; }
    state = { fileId: latest.id, size: latest.size, modified: latest.modified,
      sourceKey: sourceKey, batchId: Utilities.getUuid(), position: 0,
      parser: { mode: 0, field: '', row: [], skipLF: false, utf8Carry: [] }, headerDone: false,
      fileRows: 0, staged: 0, phase: 'read' };
  }
  if (state.phase === 'commit') return commit_(state, props);
  const existing = existingDates_();
  let pending = [];
  const flush = () => {
    if (!pending.length) return;
    request_('POST', '/allconnect_import_rows?on_conflict=batch_id,row_number', pending,
      { Prefer: 'resolution=merge-duplicates,return=minimal' });
    pending = [];
  };
  const accept = fields => {
    if (!state.headerDone) {
      if (fields.length !== AC.headers.length || fields.some((v, i) => (i ? v : v.replace(/^\uFEFF/, '')) !== AC.headers[i]))
        throw new Error('Invalid Allconnect header');
      state.headerDone = true;
      return;
    }
    if (fields.length === 1 && fields[0] === '') return;
    if (fields.length !== AC.headers.length) throw new Error('Invalid CSV column count at row ' + (state.fileRows + 2));
    state.fileRows++;
    const date = workDate_(fields[1]);
    if (fields[0].trim() !== date.slice(0, 7)) throw new Error('Month mismatch at row ' + (state.fileRows + 1));
    if (existing[date]) return;
    const payload = {};
    AC.headers.forEach((name, i) => { payload[name] = fields[i]; });
    pending.push({ batch_id: state.batchId, row_number: ++state.staged, payload: payload });
    if (pending.length === 200) flush();
  };
  while (state.position < state.size && Date.now() - started < AC.maxRunMs) {
    const end = Math.min(state.position + AC.chunkBytes, state.size) - 1;
    const bytes = driveRange_(state.fileId, state.position, end);
    parseBytes_(state.parser, bytes, accept);
    flush();
    state.position = end + 1;
    saveState_(props, state);
  }
  if (state.position === state.size) {
    finishParser_(state.parser, accept);
    flush();
    if (!state.headerDone || !state.fileRows) throw new Error('CSV has no data rows');
    const unchanged = DriveApp.getFileById(state.fileId);
    if (unchanged.getSize() !== state.size || unchanged.getLastUpdated().toISOString() !== state.modified)
      throw new Error('CSV changed while reading');
    state.phase = 'commit';
    saveState_(props, state);
    commit_(state, props);
  } else {
    scheduleResume_();
    Logger.log('Read ' + state.position + '/' + state.size + ' bytes; staged ' + state.staged);
  }
}

function commit_(state, props) {
  const result = request_('POST', '/rpc/append_allconnect_new_dates', {
    p_batch_id: state.batchId, p_expected_count: state.staged, p_source_key: state.sourceKey
  });
  if (!result || !result[0]) throw new Error('Missing commit receipt; inspect import runs before retry');
  Logger.log(JSON.stringify({ source: state.sourceKey, rows: state.fileRows, receipt: result[0] }));
  props.deleteProperty(AC.stateKey);
  clearResume_();
}

function latestCsv_() {
  const files = DriveApp.getFolderById(AC.folderId).getFiles();
  let latest = null;
  while (files.hasNext()) {
    const file = files.next();
    if (!/\.csv$/i.test(file.getName())) continue;
    const candidate = { id: file.getId(), size: file.getSize(), modified: file.getLastUpdated().toISOString() };
    if (!candidate.size || candidate.size > 200 * 1024 * 1024) continue;
    if (!latest || candidate.modified > latest.modified ||
      (candidate.modified === latest.modified && candidate.id > latest.id)) latest = candidate;
  }
  return latest;
}

function driveRange_(id, start, end) {
  const response = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id) + '?alt=media', {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), Range: 'bytes=' + start + '-' + end },
    muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 206) throw new Error('Drive range download failed: HTTP ' + response.getResponseCode());
  const bytes = response.getContent();
  const expected = end - start + 1;
  // Drive strips this CSV's three-byte UTF-8 BOM from a range beginning at
  // zero, although Content-Range still includes those three bytes.
  const strippedBom = start === 0 && bytes.length === expected - 3 &&
    bytes[0] === 77 && bytes[1] === 111 && bytes[2] === 110 && bytes[3] === 116 && bytes[4] === 104;
  if (bytes.length !== expected && !strippedBom) {
    const h = response.getHeaders();
    throw new Error('Incomplete Drive range: requested=' + start + '-' + end +
      ', returned=' + bytes.length + ', contentRange=' + (h['Content-Range'] || h['content-range'] || 'none') +
      ', contentEncoding=' + (h['Content-Encoding'] || h['content-encoding'] || 'none'));
  }
  return bytes;
}

// Decode once per range. Keep up to three trailing bytes when a UTF-8 code
// point straddles ranges, then parse quoted CSV text incrementally.
function parseBytes_(parser, bytes, accept) {
  const raw = parser.utf8Carry.concat(bytes.map(v => (v + 256) % 256));
  let cut = raw.length;
  let continuation = 0;
  while (continuation < 3 && cut - continuation - 1 >= 0 &&
    (raw[cut - continuation - 1] & 0xC0) === 0x80) continuation++;
  const leadAt = cut - continuation - 1;
  if (leadAt < 0) throw new Error('Invalid UTF-8 boundary');
  const lead = raw[leadAt];
  const width = lead < 0x80 ? 1 : lead >= 0xC2 && lead <= 0xDF ? 2 :
    lead >= 0xE0 && lead <= 0xEF ? 3 : lead >= 0xF0 && lead <= 0xF4 ? 4 : 0;
  if (!width) throw new Error('Invalid UTF-8 lead byte');
  if (width > continuation + 1) cut = leadAt;
  parser.utf8Carry = raw.slice(cut);
  const text = Utilities.newBlob(raw.slice(0, cut)).getDataAsString('UTF-8');
  if (text.includes('\uFFFD')) throw new Error('Invalid UTF-8 in CSV');
  const field = () => { parser.row.push(parser.field); parser.field = ''; parser.mode = 0; };
  const record = () => { field(); accept(parser.row); parser.row = []; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (parser.skipLF) { parser.skipLF = false; if (ch === '\n') continue; }
    if (parser.mode === 2) { // quoted field
      if (ch === '"') parser.mode = 3;
      else parser.field += ch;
    } else if (parser.mode === 3) { // closing quote or escaped quote
      if (ch === '"') { parser.field += '"'; parser.mode = 2; }
      else if (ch === '|') field();
      else if (ch === '\n' || ch === '\r') { record(); if (ch === '\r') parser.skipLF = true; }
      else throw new Error('Unexpected byte after CSV quote');
    } else if (ch === '"' && parser.mode === 0) parser.mode = 2;
    else if (ch === '|') field();
    else if (ch === '\n' || ch === '\r') { record(); if (ch === '\r') parser.skipLF = true; }
    else { if (ch === '"') throw new Error('Unexpected CSV quote'); parser.field += ch; parser.mode = 1; }
  }
}

function finishParser_(parser, accept) {
  if (parser.utf8Carry.length) throw new Error('Incomplete UTF-8 at end of CSV');
  if (parser.mode === 2) throw new Error('Unterminated quoted field');
  if (parser.field.length || parser.row.length || parser.mode === 3) {
    parser.row.push(parser.field);
    accept(parser.row);
  }
}

function workDate_(value) {
  const text = String(value).trim();
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(text)) throw new Error('Invalid PERFORMANCE_DATE: ' + text);
  const iso = text.slice(6) + '-' + text.slice(3, 5) + '-' + text.slice(0, 2);
  const date = new Date(iso + 'T00:00:00Z');
  if (isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) throw new Error('Invalid calendar date: ' + text);
  return iso;
}

function existingDates_() {
  const dates = {};
  for (let offset = 0; ; offset += 1000) {
    const page = request_('GET', '/rpc/allconnect_existing_dates', null,
      { Range: offset + '-' + (offset + 999) });
    page.forEach(row => { dates[row.work_date] = true; });
    if (page.length < 1000) return dates;
  }
}

function request_(method, path, body, extraHeaders) {
  const key = PropertiesService.getScriptProperties().getProperty('SUPABASE_SERVICE_ROLE_KEY');
  const headers = Object.assign({ apikey: key, Authorization: 'Bearer ' + key,
    'Content-Type': 'application/json', Accept: 'application/json' }, extraHeaders || {});
  const options = { method: method, headers: headers, muteHttpExceptions: true };
  if (body !== null) options.payload = JSON.stringify(body);
  const response = UrlFetchApp.fetch(AC.url + path, options);
  const status = response.getResponseCode();
  if (status < 200 || status >= 300) throw new Error('Supabase HTTP ' + status + ': ' + response.getContentText().slice(0, 500));
  return response.getContentText() ? JSON.parse(response.getContentText()) : null;
}

function saveState_(props, state) {
  const serialized = JSON.stringify(state);
  if (serialized.length > 8500) throw new Error('CSV record too large to checkpoint');
  props.setProperty(AC.stateKey, serialized);
}

function clearResume_() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'resumeAllconnectImport')
    .forEach(t => ScriptApp.deleteTrigger(t));
}

function scheduleResume_() {
  clearResume_();
  ScriptApp.newTrigger('resumeAllconnectImport').timeBased().after(60 * 1000).create();
}

function resumeAllconnectImport() {
  clearResume_();
  runAllconnectImport();
}
