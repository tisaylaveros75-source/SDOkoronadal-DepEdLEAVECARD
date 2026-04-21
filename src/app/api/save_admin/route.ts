import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

export async function POST(req: Request) {
  try {
    const p = await req.json();
    const role       = String(p.role ?? 'admin');          // 'admin' | 'encoder'
    const accountId  = Number(p.account_id ?? 0);          // 0 = new
    const isDelete   = !!p._delete;

    // ── Delete ────────────────────────────────────────────────
    if (isDelete) {
      if (!accountId) return NextResponse.json({ ok: false, error: 'account_id required for delete.' }, { status: 400 });
      await pool.query('DELETE FROM admin_config WHERE id=? AND role=?', [accountId, role]);
      return NextResponse.json({ ok: true });
    }

    // ── Create / Update ───────────────────────────────────────
    const name    = String(p.name     ?? '').trim();
    const loginId = String(p.login_id ?? '').trim().toLowerCase();
    const pw      = p.password ?? '';

    if (!name || !loginId)
      return NextResponse.json({ ok: false, error: 'Name and login ID are required.' }, { status: 400 });
    if (!loginId.endsWith('@deped.gov.ph'))
      return NextResponse.json({ ok: false, error: 'Login ID must use @deped.gov.ph domain.' }, { status: 400 });

    if (accountId > 0) {
      // ── Update existing ──────────────────────────────────────
      const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM admin_config WHERE id=? AND role=? LIMIT 1',
        [accountId, role]
      );
      const row = (rows as RowDataPacket[])[0];
      if (!row) return NextResponse.json({ ok: false, error: 'Account not found.' }, { status: 404 });

      const finalPw = pw !== '' ? pw : row.password;
      await pool.query(
        'UPDATE admin_config SET name=?, login_id=?, password=? WHERE id=?',
        [name, loginId, finalPw, accountId]
      );
    } else {
      // ── Create new ───────────────────────────────────────────
      if (!pw)
        return NextResponse.json({ ok: false, error: 'Password is required for new accounts.' }, { status: 400 });
      await pool.query(
        'INSERT INTO admin_config (login_id, password, name, role) VALUES (?, ?, ?, ?)',
        [loginId, pw, name, role]
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
