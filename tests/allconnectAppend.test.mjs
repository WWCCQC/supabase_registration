import test from 'node:test';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Papa from 'papaparse';
import { ALLCONNECT_HEADERS } from '../lib/allconnectUpload.ts';
const api=await import('../lib/allconnectAppend.mjs').catch(()=>({}));
const row=(date='06/10/2026',job='1')=>Object.fromEntries(ALLCONNECT_HEADERS.map(k=>[k,k==='PERFORMANCE_DATE'?date:k==='Month'?`${date.slice(6)}-${date.slice(3,5)}`:k==='Job_Install'?job:k==='STAFF_NAME'?'ช่างทดสอบ':'']));
async function file(t,contents){const dir=await mkdtemp(join(tmpdir(),'allconnect-test-'));t.after(()=>rm(dir,{recursive:true,force:true}));const p=join(dir,'input.csv');await writeFile(p,contents);return p;}
const csv=(rows,delimiter='|')=>Papa.unparse(rows,{columns:ALLCONNECT_HEADERS,delimiter});
test('calendar date identity rejects invalid dates and preserves leap days',()=>{
 assert.equal(typeof api.workDate,'function');
 assert.equal(api.workDate(' 29/02/2024 '),'2024-02-29');
 for(const v of ['29/02/2026','31/04/2026','6/10/2026','','2026-10-06'])assert.throws(()=>api.workDate(v));
});
test('stream parser preserves identical rows, quoted delimiters, newlines and blank staff',async t=>{
 assert.equal(typeof api.scanCsv,'function');
 const a={...row(),STAFF_NAME:'ชื่อ|ทดสอบ\nบรรทัดสอง'};
 const path=await file(t,'\uFEFF'+csv([a,a,row('07/10/2026')])+'\r\n');
 const batches=[];const result=await api.scanCsv(path,{batchSize:2,onBatch:async rows=>{await new Promise(r=>setTimeout(r,1));batches.push(...rows)}});
 assert.equal(result.rows,3);assert.equal(result.dates['2026-10-06'],2);assert.equal(result.dates['2026-10-07'],1);
 assert.deepEqual(batches,[a,a,row('07/10/2026')]);assert.match(result.sha256,/^[a-f0-9]{64}$/);
});
test('invalid UTF8, malformed CSV, wrong headers, invalid day and empty files fail before commit',async t=>{
 assert.equal(typeof api.scanCsv,'function');
 const good=csv([row()]);
 for(const body of ['',ALLCONNECT_HEADERS.join('|'),good.replace('06/10/2026','31/02/2026'),good.replace('STAFF_ID','BAD_ID'),good+'|extra',ALLCONNECT_HEADERS.join('|')+'\n"unterminated',Buffer.concat([Buffer.from(good),Buffer.from([0xff])])]){
  await assert.rejects(api.scanCsv(await file(t,body)));
 }
});
test('missing date selection uses membership, including gaps before the latest day',()=>{
 assert.equal(typeof api.planNewDates,'function');
 assert.deepEqual(api.planNewDates({'2026-09-30':4,'2026-10-01':8,'2026-10-06':2},['2026-10-01','2026-10-05']),{newDates:['2026-09-30','2026-10-06'],insertRows:6,skipRows:8});
});
test('preview validates a real file without any staging or commit requests',async t=>{
 assert.equal(typeof api.importFile,'function');
 const path=await file(t,csv([row('06/10/2026'),row('07/10/2026'),row('07/10/2026')]));
 const {createClient}=await import('@supabase/supabase-js');
 const calls=[];
 const db=createClient('https://append.test','test-key',{auth:{persistSession:false},global:{fetch:async(url,options)=>{
  calls.push([new URL(url).pathname,options.method]);
  return new Response(JSON.stringify([{work_date:'2026-10-06'}]),{status:200,headers:{'Content-Type':'application/json'}});
 }}});
 const result=await api.importFile({db,filePath:path,sourceId:'fixture',commit:false});
 assert.equal(result.insertRows,2);assert.equal(result.skipRows,1);assert.deepEqual(result.newDates,['2026-10-07']);
 assert.deepEqual(calls,[['/rest/v1/rpc/allconnect_existing_dates','GET']]);
});
test('commit sends only missing dates, preserving repeated rows and stable sequence',async t=>{
 const path=await file(t,csv([row('06/10/2026','99'),row('07/10/2026'),row('07/10/2026')]));
 const {createClient}=await import('@supabase/supabase-js');const writes=[];
 const db=createClient('https://append.test','test-key',{auth:{persistSession:false},global:{fetch:async(url,options)=>{
  const pathname=new URL(url).pathname;
  const body=options.body?JSON.parse(options.body):null;
  let result;
  if(pathname.endsWith('allconnect_existing_dates'))result=[{work_date:'2026-10-06'}];
  else if(pathname.endsWith('allconnect_import_runs'))result=null;
  else if(pathname.endsWith('allconnect_import_rows')){writes.push(body);result=null;}
  else if(pathname.endsWith('append_allconnect_new_dates')){
   assert.equal(body.p_expected_count,2);result=[{inserted_count:2,skipped_count:0,new_dates:['2026-10-07']}];
  }else assert.fail(pathname);
  return new Response(JSON.stringify(result),{status:200,headers:{'Content-Type':'application/json'}});
 }}});
 const result=await api.importFile({db,filePath:path,sourceId:'fixture',commit:true});
 assert.equal(result.receipt.inserted_count,2);assert.equal(writes.flat().length,2);
 assert.deepEqual(writes.flat().map(r=>r.row_number),[1,2]);
 assert.ok(writes.flat().every(r=>r.payload.PERFORMANCE_DATE==='07/10/2026'));
});
test('file changes between passes abort staging and never call commit',async t=>{
 const path=await file(t,csv([row('06/10/2026')]));
 const {createClient}=await import('@supabase/supabase-js');const calls=[];
 const db=createClient('https://append.test','test-key',{auth:{persistSession:false},global:{fetch:async(url,options)=>{
  const pathname=new URL(url).pathname;calls.push([pathname,options.method]);
  const result=pathname.endsWith('allconnect_existing_dates')?[]:null;
  return new Response(JSON.stringify(result),{status:200,headers:{'Content-Type':'application/json'}});
 }}});
 await assert.rejects(api.importFile({db,filePath:path,sourceId:'fixture',commit:true,onProgress:event=>{
  if(event.phase==='validated'){
   // sync mutation is intentional: mimic a replaced local download before pass two.
   const {writeFileSync}=createRequire(import.meta.url)('node:fs');writeFileSync(path,csv([row('06/10/2026','2')]));
  }
 }}),/changed between/);
 assert.ok(!calls.some(([p])=>p.endsWith('append_allconnect_new_dates')));
 assert.ok(calls.some(([p,m])=>p.endsWith('allconnect_import_rows')&&m==='DELETE'));
});
