'use client';
import type { LeaveRecord } from '@/types';

interface StatBoxProps {
  icon: string;
  iconClass?: string;
  iconStyle?: React.CSSProperties;
  value: number | string;
  label: string;
  onClick?: () => void;
  valueStyle?: React.CSSProperties;
  style?: React.CSSProperties;
}
export function StatBox({
  icon, iconClass, iconStyle, value, label, onClick, valueStyle, style,
}: StatBoxProps) {
  return (
    <div
      className="stat-box"
      style={{ ...(onClick ? { cursor: 'pointer' } : {}), ...style }}
      onClick={onClick}
    >
      <div className={`stat-icon${iconClass ? ' ' + iconClass : ''}`} style={iconStyle}>
        {icon}
      </div>
      <div>
        <div className="stat-val" style={valueStyle}>{value}</div>
        <div className="stat-lbl">{label}</div>
      </div>
    </div>
  );
}

export function currentMonthLabel(): string {
  return new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

// ── Internal date parser ──────────────────────────────────────
// Parses ISO (YYYY-MM-DD), MM/DD/YYYY, or natural-language strings
// (e.g. "April 2025"). Returns a Date or null if unparseable.
function parseDateForCheck(dateStr: string): Date | null {
  if (!dateStr) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr))
    return new Date(dateStr + 'T00:00:00');

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [mm, , yyyy] = dateStr.split('/');
    return new Date(`${yyyy}-${mm.padStart(2, '0')}-01T00:00:00`);
  }

  const yearMatch  = dateStr.match(/\b(19\d{2}|20\d{2})\b/);
  const monthNames = [
    'january','february','march','april','may','june',
    'july','august','september','october','november','december',
  ];
  const lower    = dateStr.toLowerCase();
  const monthIdx = monthNames.findIndex(m => lower.includes(m));

  if (yearMatch && monthIdx !== -1)
    return new Date(parseInt(yearMatch[1]), monthIdx, 1);

  return null;
}

/**
 * isCardUpdatedThisMonth
 * ──────────────────────
 * Determines whether an employee's leave card has been properly updated
 * for the current month. Rules:
 *
 * Teaching:
 *   → true  when at least one non-conversion entry has a from/to/prd
 *            date that falls in the current month & year.
 *   → false for zero records or no current-month entry.
 *
 * Non-Teaching / Teaching-Related:
 *   → true  ONLY when a "Monthly Accrual" (or "Service Credit") entry
 *            exists whose date falls in the current month & year.
 *            Any other entry (vacation, sick, profile edit, etc.) does
 *            NOT count as "updated" for NT/TR employees.
 *   → false if the monthly accrual has not been posted yet.
 */
export function isCardUpdatedThisMonth(
  records: LeaveRecord[],
  empStatus: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  lastEditedAt?: string | null,
): boolean {
  const now      = new Date();
  const thisYear = now.getFullYear();
  const thisMon  = now.getMonth(); // 0-indexed

  if (!records || records.length === 0) return false;

  const category = (empStatus ?? '').toLowerCase();

  // ── Teaching ─────────────────────────────────────────────
  // Updated = any real leave entry dated this month
  // (from / to / prd — whichever the encoder filled in)
  if (category === 'teaching') {
    return records.some(r => {
      if (r._conversion) return false;
      const dateStr = r.from || r.to || r.prd || '';
      if (!dateStr) return false;
      const d = parseDateForCheck(dateStr);
      return !!d && d.getFullYear() === thisYear && d.getMonth() === thisMon;
    });
  }

  // ── Non-Teaching / Teaching-Related ──────────────────────
  // Updated = Monthly Accrual (or Service Credit) posted this month.
  // Vacation leave, sick leave, profile saves, etc. do NOT satisfy this.
  return records.some(r => {
    if (r._conversion) return false;
    const action = (r.action ?? '').toLowerCase();
    if (!action.includes('accrual') && !action.includes('service credit')) return false;
    const dateStr = r.from || r.to || r.prd || '';
    if (!dateStr) return false;
    const d = parseDateForCheck(dateStr);
    return !!d && d.getFullYear() === thisYear && d.getMonth() === thisMon;
  });
}

/** @deprecated Use isCardUpdatedThisMonth(records, empStatus) directly. */
export function isUpdatedThisMonth(lastEditedAt: string | null | undefined): boolean {
  void lastEditedAt;
  return false;
}
