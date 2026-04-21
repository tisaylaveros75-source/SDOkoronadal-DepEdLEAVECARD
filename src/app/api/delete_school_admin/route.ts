import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { ResultSetHeader } from 'mysql2';

export async function POST(req: Request) {
  try {
    const { sa_id } = await req.json();
    const [result] = await pool.query<ResultSetHeader>(
      "DELETE FROM admin_config WHERE id=? AND role='school_admin'", [sa_id]
    );
    if (result.affectedRows === 0)
      return NextResponse.json({ ok: false, error: 'School Admin account not found.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ ok: false, error: String(e) }, { status: 500 }); }
}
