import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

export async function POST(req: Request) {
  try {
    const { id, password } = await req.json();
    if (!id || !password) return NextResponse.json({ ok: false, error: 'Please enter your email and password.' }, { status: 401 });

    const loginId = id.toLowerCase().trim();

    // Admin / Encoder / School Admin login
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM admin_config WHERE LOWER(login_id)=?', [loginId]
    );
    const row = rows[0];
    if (row && row.password === password) {
      return NextResponse.json({ ok: true, role: row.role, name: row.name, login_id: row.login_id, db_id: row.id });
    }

    // Employee login
    const [empRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM personnel WHERE LOWER(email)=?', [loginId]
    );
    const emp = empRows[0];
    if (emp && emp.password === password) {
      if ((emp.account_status ?? 'active') === 'inactive') {
        return NextResponse.json({ ok: false, error: 'Your account is inactive. Please contact the administrator.' }, { status: 403 });
      }
      return NextResponse.json({
        ok: true, role: 'employee',
        employee_id: emp.employee_id,
        name: `${emp.given} ${emp.surname}`.trim(),
        status: emp.status,
        account_status: emp.account_status ?? 'active',
      });
    }

    return NextResponse.json({ ok: false, error: 'Incorrect email or password. Please try again.' }, { status: 401 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
