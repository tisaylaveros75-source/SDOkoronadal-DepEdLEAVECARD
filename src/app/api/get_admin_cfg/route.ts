import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role') || 'admin';

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, name, login_id, password, role FROM admin_config WHERE role=? ORDER BY id ASC',
      [role]
    );

    return new NextResponse(
      JSON.stringify({ ok: true, accounts: rows }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
