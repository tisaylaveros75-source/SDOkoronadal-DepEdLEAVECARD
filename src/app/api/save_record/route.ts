import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { recordToRow } from '@/lib/recordToRow';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import type { LeaveRecord } from '@/types';

export async function POST(req: Request) {
  try {
    const { employee_id, record } = await req.json();

    // ── Guard: fetch employee to check status before saving ──────────────
    const [empRows] = await pool.query<RowDataPacket[]>(
      'SELECT account_status, status FROM personnel WHERE employee_id=?',
      [employee_id]
    );
    const emp = (empRows as RowDataPacket[])[0];
    if (!emp) {
      return NextResponse.json({ ok: false, error: 'Employee not found.' }, { status: 404 });
    }

    // Block 1.25 accrual for inactive Non-Teaching / Teaching-Related employees
    const action     = ((record as LeaveRecord).action ?? '').toLowerCase();
    const isAccrual  = action.includes('accrual') || action.includes('service credit');
    const empCat     = (emp.status ?? '').toLowerCase();
    const isNTorTR   = empCat === 'non-teaching' || empCat === 'teaching related';
    const isInactive = emp.account_status === 'inactive';

    if (isAccrual && isNTorTR && isInactive) {
      return NextResponse.json({
        ok:      false,
        skipped: true,   // caller can check this flag to silently skip vs hard-fail
        error:   `Skipped: employee ${employee_id} is inactive and cannot receive accrual.`,
      }, { status: 200 }); // 200 so a bulk loop can continue past this employee
    }

    // ── Insert the leave record ───────────────────────────────────────────
    const [maxRow] = await pool.query<RowDataPacket[]>(
      'SELECT COALESCE(MAX(sort_order),0) AS m FROM leave_records WHERE employee_id=?',
      [employee_id]
    );
    const sortOrder = Number((maxRow as RowDataPacket[])[0].m) + 1;

    const row  = recordToRow(record as LeaveRecord, employee_id, sortOrder);
    const cols = Object.keys(row).map(k => `\`${k}\``).join(',');
    const phs  = Object.keys(row).map(() => '?').join(',');

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO leave_records (${cols}) VALUES (${phs})`,
      Object.values(row)
    );

    // Update last_edited_at on the personnel row
    await pool.query(
      'UPDATE personnel SET last_edited_at=? WHERE employee_id=?',
      [new Date().toISOString().slice(0, 19).replace('T', ' '), employee_id]
    );

    return NextResponse.json({ ok: true, record_id: result.insertId });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
