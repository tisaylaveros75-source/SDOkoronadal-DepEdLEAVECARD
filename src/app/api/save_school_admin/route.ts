import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function POST(req: Request) {
  try {
    const p = await req.json();
    const saId    = Number(p.sa_id ?? 0);
    const name    = String(p.name     ?? '').trim();
    const loginId = String(p.login_id ?? '').toLowerCase().trim();
    const pw      = p.password ?? '';

    if (!name)    return NextResponse.json({ ok: false, error: 'Display name is required.' }, { status: 400 });
    if (!loginId) return NextResponse.json({ ok: false, error: 'Login email is required.' }, { status: 400 });
    if (!loginId.endsWith('@deped.gov.ph'))
      return NextResponse.json({ ok: false, error: 'Login ID must use @deped.gov.ph domain.' }, { status: 400 });

    // Duplicate check
    const [dup] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM admin_config WHERE LOWER(login_id)=? AND id!=?', [loginId, saId]
    );
    if ((dup as RowDataPacket[]).length > 0)
      return NextResponse.json({ ok: false, error: 'That email is already in use by another account.' }, { status: 400 });

    let finalId = saId;
    if (saId > 0) {
      const [existing] = await pool.query<RowDataPacket[]>(
        "SELECT * FROM admin_config WHERE id=? AND role='school_admin'", [saId]
      );
      const row = (existing as RowDataPacket[])[0];
      if (!row) return NextResponse.json({ ok: false, error: 'School Admin account not found.' }, { status: 404 });
      const finalPw = pw !== '' ? pw : row.password;
      await pool.query('UPDATE admin_config SET name=?, login_id=?, password=? WHERE id=?', [name, loginId, finalPw, saId]);
    } else {
      if (!pw) return NextResponse.json({ ok: false, error: 'Password is required for new accounts.' }, { status: 400 });
      const [result] = await pool.query<ResultSetHeader>(
        "INSERT INTO admin_config (login_id, password, name, role) VALUES (?,?,?,'school_admin')", [loginId, pw, name]
      );
      finalId = result.insertId;
    }
    return NextResponse.json({ ok: true, sa_id: finalId });
  } catch (e) { return NextResponse.json({ ok: false, error: String(e) }, { status: 500 }); }
}
