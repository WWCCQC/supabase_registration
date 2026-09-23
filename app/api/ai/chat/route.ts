export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '@/lib/supabase-admin';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a data assistant for a technician management system. Answer questions about the technicians database in the same language the user uses (Thai or English).

Database table: technicians
Key columns:
- national_id: Thai national ID (unique identifier)
- tech_id: Technician ID code
- full_name: Full name
- gender: Gender
- degree: Education level
- provider: Company/provider name (e.g. "WW-Provider", "True Tech", "เถ้าแก่เทค")
- area: Service area
- RBM: Regional branch manager area
- CBM: Central branch manager area
- depot_code: Depot code
- depot_name: Depot name
- province: Province (จังหวัด)
- work_type: Work type (e.g. "ติดตั้ง", "ซ่อม")
- workgroup_status: Workgroup status
- status: Status
- team_type: Team type

Training columns — value "Pass" means certified, null/other means not certified:
svc_install, svc_repair, svc_solar, svc_fttr, svc_2g, svc_cctv, svc_cyod,
svc_dongle, svc_iot, svc_gigatex, svc_wifi, svc_smarthome, svc_nonstandard,
svc_corporate, svc_true_id, svc_true_inno, svc_l3, course_g, course_ec, course_h,
power_authority (การไฟฟ้า card)

Always call query_technicians before answering. Use aggregate "count" for "how many" questions, "group_count" for breakdowns, "list" for showing specific technicians.`;

const QUERY_TOOL: Anthropic.Tool = {
  name: 'query_technicians',
  description: 'Query the technicians database to answer user questions.',
  input_schema: {
    type: 'object' as const,
    properties: {
      aggregate: {
        type: 'string',
        enum: ['count', 'list', 'group_count'],
        description: 'count=total number, list=fetch rows, group_count=count grouped by a column',
      },
      filters: {
        type: 'array',
        description: 'Filter conditions',
        items: {
          type: 'object',
          properties: {
            column: { type: 'string' },
            operator: {
              type: 'string',
              enum: ['eq', 'ilike', 'neq', 'not_null'],
              description: 'eq=exact, ilike=contains (case-insensitive), neq=not equal, not_null=has a value',
            },
            value: { type: 'string', description: 'Comparison value (omit for not_null)' },
          },
          required: ['column', 'operator'],
        },
      },
      group_by: { type: 'string', description: 'Column to group by (for group_count)' },
      select: {
        type: 'array',
        items: { type: 'string' },
        description: 'Columns to return for list aggregate',
      },
      limit: { type: 'number', description: 'Max rows for list (default 20, max 50)' },
    },
    required: ['aggregate'],
  },
};

function applyFilters(q: any, filters: any[] = []) {
  for (const f of filters) {
    const { column, operator, value } = f;
    if (operator === 'eq') q = q.eq(column, value);
    else if (operator === 'ilike') q = q.ilike(column, `%${value}%`);
    else if (operator === 'neq') q = q.neq(column, value);
    else if (operator === 'not_null') q = q.not(column, 'is', null);
  }
  return q;
}

async function runQuery(input: any): Promise<any> {
  const supabase = supabaseAdmin();
  const { aggregate, filters = [], group_by, select, limit = 20 } = input;

  if (aggregate === 'count') {
    let q = supabase.from('technicians').select('national_id', { count: 'exact', head: true });
    q = applyFilters(q, filters);
    const { count, error } = await q;
    if (error) throw new Error(error.message);
    return { count };
  }

  if (aggregate === 'group_count') {
    if (!group_by) return { error: 'group_by is required for group_count' };
    const pageSize = 1000;
    let from = 0;
    const groups: Record<string, Set<string>> = {};

    for (;;) {
      let q: any = supabase
        .from('technicians')
        .select(`${group_by}, national_id`)
        .range(from, from + pageSize - 1);
      q = applyFilters(q, filters);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      for (const row of data ?? []) {
        const key = String(row[group_by] ?? '').trim();
        if (!key || key === 'null') continue;
        if (!groups[key]) groups[key] = new Set();
        if (row.national_id) groups[key].add(row.national_id);
      }
      if (!data || data.length < pageSize) break;
      from += pageSize;
    }

    const rows = Object.entries(groups)
      .map(([key, set]) => ({ [group_by]: key, count: set.size }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30);
    return { rows };
  }

  // list
  const cols = select?.length
    ? select.join(', ')
    : 'national_id, tech_id, full_name, provider, area, depot_code, province';
  let q: any = supabase
    .from('technicians')
    .select(cols)
    .limit(Math.min(limit, 50));
  q = applyFilters(q, filters);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return { rows: data ?? [], count: data?.length ?? 0 };
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json() as { messages: Anthropic.MessageParam[] };

    if (!messages?.length) {
      return NextResponse.json({ error: 'messages required' }, { status: 400 });
    }

    const msgs: Anthropic.MessageParam[] = [...messages];

    for (let i = 0; i < 5; i++) {
      const response = await client.messages.create({
        model: 'claude-opus-5',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        tools: [QUERY_TOOL],
        messages: msgs,
      });

      if (response.stop_reason === 'end_turn') {
        const text = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
        return NextResponse.json({ reply: text?.text ?? '' });
      }

      if (response.stop_reason === 'tool_use') {
        msgs.push({ role: 'assistant', content: response.content });
        const results: Anthropic.ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (block.type !== 'tool_use') continue;
          try {
            const result = await runQuery(block.input);
            results.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
          } catch (err: any) {
            results.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ error: err.message }), is_error: true });
          }
        }

        msgs.push({ role: 'user', content: results });
        continue;
      }

      break;
    }

    return NextResponse.json({ error: 'No response generated' }, { status: 500 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 500 });
  }
}
