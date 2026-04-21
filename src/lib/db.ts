// ============================================================
//  lib/db.ts — MySQL2 database connection pool for Next.js
//  Install: npm install mysql2
// ============================================================

import mysql from 'mysql2/promise';

// Database configuration — set via environment variables in .env.local
const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || '3306'),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit:    25,   // ← increased from 10
  queueLimit:         0,
  connectTimeout:     30000, // ← 30s connect timeout
  charset:            'utf8mb4',
});

export default pool;

// ── Shared normalisation helper ───────────────────────────────
export function normaliseDate(d: string | null | undefined): string | null {
  if (!d) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1]}-${m[2]}`;
  // Handle ISO timestamp format e.g. 1993-07-07T00:00:00.000Z
  if (d.includes('T')) return d.split('T')[0];
  return null;
}

// ── Self-healing schema migration ─────────────────────────────
// Run once on cold start to ensure all columns exist.
export async function ensureSchema() {
  const conn = await pool.getConnection();
  try {
    const leaveRequired: Record<string, string> = {
      sort_order:      'sort_order      INT           NOT NULL DEFAULT 0',
      so:              'so              VARCHAR(100)  DEFAULT NULL',
      prd:             'prd             VARCHAR(100)  DEFAULT NULL',
      from_date:       'from_date       DATE          DEFAULT NULL',
      to_date:         'to_date         DATE          DEFAULT NULL',
      spec:            'spec            VARCHAR(200)  DEFAULT NULL',
      action:          'action          VARCHAR(255)  DEFAULT NULL',
      force_amount:    'force_amount    DECIMAL(10,3) NOT NULL DEFAULT 0',
      setA_earned:     'setA_earned     DECIMAL(10,3) NOT NULL DEFAULT 0',
      setA_abs_wp:     'setA_abs_wp     DECIMAL(10,3) NOT NULL DEFAULT 0',
      setA_balance:    'setA_balance    DECIMAL(10,3) NOT NULL DEFAULT 0',
      setA_wop:        'setA_wop        DECIMAL(10,3) NOT NULL DEFAULT 0',
      setB_earned:     'setB_earned     DECIMAL(10,3) NOT NULL DEFAULT 0',
      setB_abs_wp:     'setB_abs_wp     DECIMAL(10,3) NOT NULL DEFAULT 0',
      setB_balance:    'setB_balance    DECIMAL(10,3) NOT NULL DEFAULT 0',
      setB_wop:        'setB_wop        DECIMAL(10,3) NOT NULL DEFAULT 0',
      is_conversion:   'is_conversion   TINYINT(1)    NOT NULL DEFAULT 0',
      from_status:     'from_status     VARCHAR(50)   DEFAULT NULL',
      to_status:       'to_status       VARCHAR(50)   DEFAULT NULL',
      conversion_date: 'conversion_date DATE          DEFAULT NULL',
    };
    const personnelRequired: Record<string, string> = {
      account_status: "account_status  ENUM('active','inactive') NOT NULL DEFAULT 'active'",
    };

    // Add missing columns to leave_records
    const [lrCols] = await conn.query('SHOW COLUMNS FROM `leave_records`') as [Array<{Field: string}>, unknown];
    const lrExisting = lrCols.map(c => c.Field.toLowerCase());
    for (const [col, def] of Object.entries(leaveRequired)) {
      if (!lrExisting.includes(col.toLowerCase())) {
        await conn.query(`ALTER TABLE \`leave_records\` ADD COLUMN ${def}`);
      }
    }
    // Drop legacy tr_v / tr_s if they still exist
    for (const drop of ['tr_v', 'tr_s']) {
      if (lrExisting.includes(drop)) {
        await conn.query(`ALTER TABLE \`leave_records\` DROP COLUMN \`${drop}\``);
      }
    }

    // Add missing columns to personnel
    const [pCols] = await conn.query('SHOW COLUMNS FROM `personnel`') as [Array<{Field: string}>, unknown];
    const pExisting = pCols.map(c => c.Field.toLowerCase());
    for (const [col, def] of Object.entries(personnelRequired)) {
      if (!pExisting.includes(col.toLowerCase())) {
        await conn.query(`ALTER TABLE \`personnel\` ADD COLUMN ${def}`);
      }
    }
  } finally {
    conn.release();
  }
}

// Run schema migration at module load (server-side only)
if (typeof window === 'undefined') {
  ensureSchema().catch(console.error);
}
