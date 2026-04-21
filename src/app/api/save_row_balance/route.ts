import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req: Request) {
  try {
    const b = await req.json();
    await pool.query(`
      UPDATE leave_records SET
        setA_earned=?, setA_abs_wp=?, setA_balance=?, setA_wop=?,
        setB_earned=?, setB_abs_wp=?, setB_balance=?, setB_wop=?
      WHERE record_id=?`,
      [b.setA_earned, b.setA_abs_wp, b.setA_balance, b.setA_wop,
       b.setB_earned, b.setB_abs_wp, b.setB_balance, b.setB_wop,
       b.record_id]);
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ ok: false, error: String(e) }, { status: 500 }); }
}
