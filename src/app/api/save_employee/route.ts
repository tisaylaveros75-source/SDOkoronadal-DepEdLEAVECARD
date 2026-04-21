import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { normaliseDate } from '@/lib/db';
import { recordToRow } from '@/lib/recordToRow';
import type { RowDataPacket } from 'mysql2';
import type { LeaveRecord } from '@/types';

export async function POST(req: Request) {
  try {
    const p = await req.json();
    const id = String(p.id ?? '').trim();

    // Validate: exactly 7 numeric digits
    if (!/^\d{7}$/.test(id))
      return NextResponse.json({ ok: false, error: 'Invalid Employee No. — must be exactly 7 numbers.' }, { status: 400 });

    const email = String(p.email ?? '').toLowerCase().trim();
    if (!email) return NextResponse.json({ ok: false, error: 'Email address is required.' }, { status: 400 });

    if (!email.endsWith('@deped.gov.ph'))
      return NextResponse.json({ ok: false, error: 'Email must use @deped.gov.ph domain.' }, { status: 400 });

    // Required fields
    const required: Record<string, string> = {
      surname: 'Surname', given: 'Given name', sex: 'Sex',
      status: 'Category', dob: 'Date of Birth', addr: 'Present Address',
      pos: 'Position / Designation', school: 'School / Office Assignment',
    };
    for (const [field, label] of Object.entries(required)) {
      if (!String(p[field] ?? '').trim())
        return NextResponse.json({ ok: false, error: `${label} is required.` }, { status: 400 });
    }

    // FIX: use originalId (the ID the record was loaded with) for all lookups.
    // If the client didn't send it (e.g. legacy call), fall back to the new id.
    const originalId = p.originalId ? String(p.originalId).trim() : id;

    // Duplicate email check — exclude the current record by its ORIGINAL id
    const [dupEmail] = await pool.query<RowDataPacket[]>(
      'SELECT employee_id FROM personnel WHERE LOWER(email)=? AND employee_id!=?',
      [email, originalId]   // FIX: was `id` (new id), now `originalId`
    );
    if ((dupEmail as RowDataPacket[]).length > 0)
      return NextResponse.json({ ok: false, error: `Email "${email}" is already registered to another employee.` }, { status: 400 });

    // Determine new vs existing using ORIGINAL id
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM personnel WHERE employee_id=?',
      [originalId]          // FIX: was `id` (new id), now `originalId`
    );
    const isNew = (existing as RowDataPacket[]).length === 0;

    // Resolve password
    let pw = p.password ?? '';
    if (!isNew && !pw) {
      const [cur] = await pool.query<RowDataPacket[]>(
        'SELECT password FROM personnel WHERE employee_id=?',
        [originalId]        // FIX: look up password by original id
      );
      pw = (cur as RowDataPacket[])[0]?.password ?? '';
    }
    if (isNew && !pw)
      return NextResponse.json({ ok: false, error: 'Password is required for new employees.' }, { status: 400 });

    const data: Record<string, unknown> = {
      employee_id:    id,
      email,
      password:       pw,
      surname:        p.surname   ?? '',
      given:          p.given     ?? '',
      suffix:         p.suffix    ?? '',
      maternal:       p.maternal  ?? '',
      sex:            p.sex       ?? '',
      civil:          p.civil     ?? '',
      dob:            normaliseDate(p.dob   ?? ''),
      pob:            p.pob       ?? '',
      addr:           p.addr      ?? '',
      spouse:         p.spouse    ?? '',
      edu:            p.edu       ?? '',
      elig:           p.elig      ?? '',
      rating:         p.rating    ?? '',
      tin:            p.tin       ?? '',
      pexam:          p.pexam     ?? '',
      dexam:          normaliseDate(p.dexam ?? ''),
      appt:           normaliseDate(p.appt  ?? ''),
      status:         p.status    ?? 'Teaching',
      account_status: ['active','inactive'].includes(p.account_status) ? p.account_status : 'active',
      pos:            p.pos       ?? '',
      school:         p.school    ?? '',
      last_edited_at: new Date().toISOString().slice(0,19).replace('T',' '),
    };

    if (!isNew) {
      // FIX: UPDATE by originalId so the WHERE clause finds the right row,
      // even when the employee_id column itself is being changed to a new value.
      const sets = Object.keys(data).map(k => `\`${k}\`=?`).join(',');
      await pool.query(
        `UPDATE personnel SET ${sets} WHERE employee_id=?`,
        [...Object.values(data), originalId]  // FIX: was `id`, now `originalId`
      );
    } else {
      const cols = Object.keys(data).map(k => `\`${k}\``).join(',');
      const phs  = Object.keys(data).map(() => '?').join(',');
      await pool.query(`INSERT INTO personnel (${cols}) VALUES (${phs})`, Object.values(data));
    }

    // Sync records if provided (conversion case)
   if (isNew && Array.isArray(p.records) && p.records.length > 0) {
  await pool.query('DELETE FROM leave_records WHERE employee_id=?', [originalId]);
  for (let i = 0; i < p.records.length; i++) {
        const row = recordToRow(p.records[i] as LeaveRecord, id, i);
        const cols = Object.keys(row).map(k => `\`${k}\``).join(',');
        const phs  = Object.keys(row).map(() => '?').join(',');
        await pool.query(`INSERT INTO leave_records (${cols}) VALUES (${phs})`, Object.values(row));
      }
    }

    return NextResponse.json({ ok: true, employee_id: id });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
