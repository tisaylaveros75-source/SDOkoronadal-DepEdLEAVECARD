import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { personnelRowToJs } from '@/lib/recordToRow';
import type { RowDataPacket } from 'mysql2';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page  = Math.max(1, parseInt(searchParams.get('page')  || '1'));
    const limit = Math.min(200, parseInt(searchParams.get('limit') || '100'));
    const offset = (page - 1) * limit;

    // ── Get total count so the client knows when to stop paginating ───────
    const [[countRow]] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as total FROM personnel'
    );
    const total = (countRow as RowDataPacket).total as number;

    // ── Fetch one page of personnel — no leave records (loaded on-demand) ─
    const [personnelRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM personnel ORDER BY surname, given LIMIT ? OFFSET ?',
      [limit, offset]
    );

    const data = personnelRows.map(r => {
      const emp = personnelRowToJs(r as Record<string, unknown>);
      emp.records = []; // ← always empty here; loaded on-demand per employee
      return emp;
    });

    // ── Return with pagination metadata and no-cache headers ──────────────
    return new NextResponse(
      JSON.stringify({ ok: true, data, total, page, limit }),
      {
        status: 200,
        headers: {
          'Content-Type':  'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma':        'no-cache',
          'Expires':       '0',
        },
      }
    );

  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
