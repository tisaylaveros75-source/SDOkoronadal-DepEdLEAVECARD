import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

export async function POST(req: Request) {
  try {
    const { name } = await req.json();
    if (!name) return NextResponse.json({ ok: false, error: 'Name is required.' }, { status: 400 });
    const [rows] = await pool.query<RowDataPacket[]>("SELECT id FROM admin_config WHERE role='encoder' LIMIT 1");
    const row = (rows as RowDataPacket[])[0];
    if (row) await pool.query('UPDATE admin_config SET name=? WHERE id=?', [name, row.id]);
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ ok: false, error: String(e) }, { status: 500 }); }
}
