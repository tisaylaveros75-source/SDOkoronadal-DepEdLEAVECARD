import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { rowToRecord } from '@/lib/recordToRow';
import type { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const empId = req.nextUrl.searchParams.get('employee_id');
    if (!empId) return NextResponse.json({ ok: false, error: 'employee_id required' }, { status: 400 });
    const [rows] = await pool.query<RowDataPacket[]>(
  'SELECT * FROM leave_records WHERE employee_id=? ORDER BY sort_order ASC, record_id ASC', [empId]
);
  
    const records = (rows as RowDataPacket[]).map(r => rowToRecord(r as Record<string, unknown>));
    return NextResponse.json({ ok: true, records });
  } catch (e) { return NextResponse.json({ ok: false, error: String(e) }, { status: 500 }); }
}
