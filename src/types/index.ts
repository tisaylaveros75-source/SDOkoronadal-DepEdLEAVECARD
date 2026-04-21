// ============================================================
//  SDO City of Koronadal — Leave Management System
//  types/index.ts — All shared TypeScript types
// ============================================================
export type UserRole = 'admin' | 'encoder' | 'school_admin' | 'employee';
export interface AdminConfig {
  id: string;
  password: string;
  name: string;
}
export interface SchoolAdminConfig {
  id: string;
  dbId: number;
  name: string;
}
export interface SchoolAdminAccount {
  id: number;
  login_id: string;
  name: string;
}
export interface SessionState {
  role: UserRole | null;
  isAdmin: boolean;
  isEncoder: boolean;
  isSchoolAdmin: boolean;
  curId: string | null;
  page: string;
  adminCfg: AdminConfig;
  encoderCfg: AdminConfig;
  schoolAdminCfg: SchoolAdminConfig;
}
export interface LeaveRecord {
  _record_id?: number;
  _conversion?: boolean;
  sort_order?: number;
  so: string;
  prd: string;
  from: string;
  to: string;
  // AM = morning half-day, PM = afternoon half-day, WD = whole day (default)
  fromPeriod?: 'AM' | 'PM' | 'WD';
  toPeriod?:   'AM' | 'PM' | 'WD';
  spec: string;
  action: string;
  earned: number;
  forceAmount: number;
  monV: number;
  monS: number;
  monDV: number;
  monDS: number;
  monAmount: number;
  monDisAmt: number;
  trV: number;
  trS: number;
  // Computed balance columns (from DB)
  setA_earned?: number;
  setA_abs_wp?: number;
  setA_balance?: number;
  setA_wop?: number;
  setB_earned?: number;
  setB_abs_wp?: number;
  setB_balance?: number;
  setB_wop?: number;
  // Conversion marker fields
  fromStatus?: string;
  toStatus?: string;
  date?: string;
  lastAction?: string;
  fwdBV?: number;
  fwdBS?: number;
}
export interface Personnel {
  id: string;
  email: string;
  password: string;
  surname: string;
  given: string;
  suffix: string;
  maternal: string;
  sex: string;
  civil: string;
  dob: string;
  pob: string;
  addr: string;
  spouse: string;
  edu: string;
  elig: string;
  rating: string;
  tin: string;
  pexam: string;
  dexam: string;
  appt: string;
  status: 'Teaching' | 'Non-Teaching' | 'Teaching Related';
  account_status: 'active' | 'inactive';
  pos: string;
  school: string;
  lastEditedAt: string;
  records: LeaveRecord[];
  conversionLog: ConversionLogEntry[];
  archived?: boolean;
  archiveReason?: string;
}
export interface ConversionLogEntry {
  from: string;
  to: string;
  date: string;
  pos: string;
}
export interface LeaveClassification {
  isAcc: boolean;
  isMon: boolean;
  isMD: boolean;
  isDis: boolean;
  isForceDis: boolean;
  isSick: boolean;
  isForce: boolean;
  isPer: boolean;
  isTransfer: boolean;
  isTerminal: boolean;
  isSetB_noDeduct: boolean;
  isSetA_noDeduct: boolean;
  isVacation: boolean;
}
export interface RowBalanceUpdate {
  [key: string]: unknown;
  record_id: number;
  employee_id: string;
  setA_earned: number;
  setA_abs_wp: number;
  setA_balance: number;
  setA_wop: number;
  setB_earned: number;
  setB_abs_wp: number;
  setB_balance: number;
  setB_wop: number;
}
export interface ApiResponse<T = Record<string, unknown>> {
  ok: boolean;
  error?: string;
  data?: Personnel[];
  records?: LeaveRecord[];
  record_id?: number;
  employee_id?: string;
  role?: UserRole;
  name?: string;
  login_id?: string;
  db_id?: number;
  account_status?: string;
  employee?: Personnel;
  school_admins?: SchoolAdminAccount[];
  sa_id?: number;
  admin?: { login_id: string; name: string };
  encoder?: { login_id: string; name: string };
  // ── Pagination fields (returned by get_personnel) ──────────
  total?: number;
  page?: number;
  limit?: number;
}
// Added 'home' — landing page after login for admin/encoder/school_admin
export type Page = 'home' | 'list' | 'cards' | 'nt' | 't' | 'user' | 'sa';
export interface AccrualRecord {
  key: string;
  count: number;
  date: string;
}
