import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { employee_id, record_ids } = await req.json();
    for (let i = 0; i < record_ids.length; i++) {
      await pool.query('UPDATE leave_records SET sort_order=? WHERE record_id=? AND employee_id=?',
        [i, record_ids[i], employee_id]);
    }
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ ok: false, error: String(e) }, { status: 500 }); }
}
