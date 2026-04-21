import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { recordToRow } from '@/lib/recordToRow';
import type { RowDataPacket } from 'mysql2';
import type { LeaveRecord } from '@/types';

export async function POST(req: Request) {
  try {
    const { employee_id, record_id, record } = await req.json();
    const [sortRow] = await pool.query<RowDataPacket[]>(
      'SELECT sort_order FROM leave_records WHERE record_id=?', [record_id]
    );
    const sortOrder = Number((sortRow as RowDataPacket[])[0]?.sort_order ?? 0);
    const row = recordToRow(record as LeaveRecord, employee_id, sortOrder);
    delete (row as Record<string, unknown>).employee_id;
    const sets = Object.keys(row).map(k => `\`${k}\`=?`).join(',');
    await pool.query(`UPDATE leave_records SET ${sets} WHERE record_id=?`, [...Object.values(row), record_id]);
    await pool.query('UPDATE personnel SET last_edited_at=? WHERE employee_id=?',
      [new Date().toISOString().slice(0,19).replace('T',' '), employee_id]);
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ ok: false, error: String(e) }, { status: 500 }); }
}
