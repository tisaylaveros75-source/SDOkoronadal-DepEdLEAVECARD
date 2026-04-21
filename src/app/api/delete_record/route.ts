import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

export async function POST(req: Request) {
  try {
    const { record_id, employee_id } = await req.json();
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT is_conversion FROM leave_records WHERE record_id=? AND employee_id=?', [record_id, employee_id]
    );
    const row = (rows as RowDataPacket[])[0];
    if (!row) return NextResponse.json({ ok: false, error: 'Record not found.' }, { status: 404 });
    if (row.is_conversion) return NextResponse.json({ ok: false, error: 'Cannot delete conversion markers directly.' }, { status: 400 });
    await pool.query('DELETE FROM leave_records WHERE record_id=?', [record_id]);
    await pool.query('UPDATE personnel SET last_edited_at=? WHERE employee_id=?',
      [new Date().toISOString().slice(0,19).replace('T',' '), employee_id]);
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ ok: false, error: String(e) }, { status: 500 }); }
}
