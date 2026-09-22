import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { parseUploadAction, validateBatchId } from '@/lib/allconnectUpload';

import { validateTechnicianRows } from '@/lib/allconnectTechniciansUpload';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'private, no-store, max-age=0' };
const errors = {
  UNAUTHORIZED: [401, 'กรุณาเข้าสู่ระบบใหม่'],
  FORBIDDEN: [403, 'เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถอัปโหลดได้'],
  INVALID_REQUEST: [400, 'ข้อมูลอัปโหลดไม่ถูกต้อง กรุณาตรวจสอบไฟล์และลองอีกครั้ง'],
  STALE_SNAPSHOT: [409, 'ข้อมูลช่างเปลี่ยนแปลงแล้ว กรุณาเริ่มอัปโหลดใหม่'],
  UPLOAD_FAILED: [500, 'อัปโหลดข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง'],
} as const;

function errorResponse(code: keyof typeof errors) {
  const [status, error] = errors[code];
  return NextResponse.json({ error, code }, { status, headers });
}

function parseBody(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid payload');
  const input = value as Record<string, unknown>;
  const action = parseUploadAction(input.action);
  const expectedKeys = {
    start: ['action'],
    chunk: ['action', 'batchId', 'startRow', 'rows'],
    commit: ['action', 'batchId', 'expectedSnapshot', 'expectedCount'],
    abort: ['action', 'batchId'],
  }[action];
  const keys = Object.keys(input);
  if (keys.length !== expectedKeys.length || keys.some(key => !expectedKeys.includes(key))) {
    throw new Error('Invalid payload fields');
  }
  if (action === 'start') return { action };
  if (action === 'chunk') {
    const batchId = validateBatchId(input.batchId);
    const rows = validateTechnicianRows(input.rows);
    if (typeof input.startRow !== 'number' || !Number.isSafeInteger(input.startRow) || input.startRow < 1 || input.startRow + rows.length - 1 > 2147483647) throw new Error('Invalid start row');
    return { action, batchId, rows, startRow: input.startRow };
  }
  const batchId = validateBatchId(input.batchId);
  if (action === 'abort') return { action, batchId };
  const expectedSnapshot = input.expectedSnapshot;
  if (expectedSnapshot !== null) {
    if (typeof expectedSnapshot !== 'string' || expectedSnapshot.trim() !== expectedSnapshot ||
        !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(expectedSnapshot) ||
        !Number.isFinite(Date.parse(expectedSnapshot)) ||
        new Date(`${expectedSnapshot.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) !== expectedSnapshot.slice(0, 10)) {
      throw new Error('Invalid expected snapshot');
    }
  }
  if (typeof input.expectedCount !== 'number' || !Number.isSafeInteger(input.expectedCount) || input.expectedCount < 1 || input.expectedCount > 2147483647) throw new Error('Invalid row count');
  return { action, batchId, expectedSnapshot, expectedCount: input.expectedCount };
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value;
  if (!token) return errorResponse('UNAUTHORIZED');
  const secret = process.env.JWT_SECRET;
  if (!secret) return errorResponse('UPLOAD_FAILED');
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'] });
    if (payload.role !== 'admin') return errorResponse('FORBIDDEN');
  } catch {
    return errorResponse('UNAUTHORIZED');
  }

  let body;
  try {
    body = parseBody(await request.json());
  } catch {
    return errorResponse('INVALID_REQUEST');
  }

  try {
    const db = supabaseAdmin();
    if (body.action === 'start') {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { error: cleanupError } = await db.from('allconnect_technicians_import_rows').delete().lt('created_at', cutoff);
      if (cleanupError) throw cleanupError;
      const { data, error } = await db.from('allconnect_technicians').select('update_at')
        .order('update_at', { ascending: false, nullsFirst: false }).limit(1);
      if (error) throw error;
      return NextResponse.json({ batchId: randomUUID(), expectedSnapshot: data?.[0]?.update_at ?? null }, { headers });
    }
    if (body.action === 'chunk') {
      const { error } = await db.from('allconnect_technicians_import_rows').insert(body.rows.map((payload, index) => ({
        batch_id: body.batchId,
        row_number: body.startRow + index,
        payload,
      })));
      if (error) throw error;
      return NextResponse.json({ acceptedCount: body.rows.length }, { headers });
    }
    if (body.action === 'commit') {
      const { data, error } = await db.rpc('replace_allconnect_technicians_import', {
        p_batch_id: body.batchId,
        p_expected_snapshot: body.expectedSnapshot,
        p_expected_count: body.expectedCount,
      });
      if (error) throw error;
      if (!data?.[0]) throw new Error('Missing import result');
      return NextResponse.json({ insertedCount: data[0].inserted_count, importedAt: data[0].imported_at }, { headers });
    }
    const { error } = await db.from('allconnect_technicians_import_rows').delete().eq('batch_id', body.batchId);
    if (error) throw error;
    return NextResponse.json({ success: true }, { headers });
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
    if (body.action === 'commit' && code === 'PT409') return errorResponse('STALE_SNAPSHOT');
    if ((body.action === 'chunk' || body.action === 'commit') && (code === '23505' || code === '23514')) {
      return errorResponse('INVALID_REQUEST');
    }
    return errorResponse('UPLOAD_FAILED');
  }
}
