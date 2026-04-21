// ── archive/route.ts ──────────────────────────────────────────
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
export async function POST(req: Request) {
  try {
    const { employee_id } = await req.json();
    await pool.query("UPDATE personnel SET account_status='inactive' WHERE employee_id=?", [employee_id]);
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ ok: false, error: String(e) }, { status: 500 }); }
}
