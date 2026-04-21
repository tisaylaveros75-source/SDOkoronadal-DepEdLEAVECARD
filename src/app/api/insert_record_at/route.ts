import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { recordToRow } from '@/lib/recordToRow';
import type { ResultSetHeader } from 'mysql2';
import type { LeaveRecord } from '@/types';

export async function POST(req: Request) {
  try {
    const { employee_id, record, after_sort_order } = await req.json();

    // Shift all rows below the target position up by 1
    await pool.query(
      'UPDATE leave_records SET sort_order = sort_order + 1 WHERE employee_id = ? AND sort_order > ?',
      [employee_id, after_sort_order]
    );

    const newSortOrder = after_sort_order + 1;
    const row  = recordToRow(record as LeaveRecord, employee_id, newSortOrder);
    const cols = Object.keys(row).map(k => `\`${k}\``).join(',');
    const phs  = Object.keys(row).map(() => '?').join(',');
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO leave_records (${cols}) VALUES (${phs})`,
      Object.values(row)
    );

    await pool.query(
      'UPDATE personnel SET last_edited_at = ? WHERE employee_id = ?',
      [new Date().toISOString().slice(0, 19).replace('T', ' '), employee_id]
    );

    return NextResponse.json({ ok: true, record_id: result.insertId, sort_order: newSortOrder });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
