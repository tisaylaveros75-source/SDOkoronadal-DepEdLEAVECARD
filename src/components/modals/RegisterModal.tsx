'use client';
import { useState, useEffect, useRef } from 'react';
import { validateDepedEmail, fmtDateInput } from '@/lib/api';
import { useAppStore } from '@/hooks/useAppStore';
import type { Personnel } from '@/types';

interface Props {
  employee: Personnel | null;
  onClose: () => void;
  onSaved: (emp: Personnel, isNew: boolean) => void;
}

type F = Record<string, string>;

const EMPTY: F = {
  id:'',email:'',password:'',surname:'',given:'',suffix:'',maternal:'',sex:'',civil:'',
  dob:'',pob:'',addr:'',spouse:'',edu:'',elig:'',rating:'',tin:'',pexam:'',dexam:'',
  appt:'',status:'Teaching',account_status:'active',pos:'',school:'',
};

// ─────────────────────────────────────────────────────────────────────────────
// ✏️  SCHOOL / OFFICE LIST — Edit this array to add, remove, or rename entries.
//     Each string becomes one option in the dropdown.
// ─────────────────────────────────────────────────────────────────────────────
const SCHOOL_OPTIONS: string[] = [
  'Bacongco NHS',
  'Concepcion NHS',
  'Marbel 5 NHS (Esperanza NHS – Annex, San Jose Campus)',
  'Esperanza NHS',
  'Gov. Sergio B. Morales NHS',
  'Koronadal NCHS',
  'Marbel 7 NHS',
  'Rotonda NHS',
  'Saravia NHS',
  'Bacongco (San Isidro) ES',
  'Caloocan ES',
  'Carpenter Hill ES',
  'Chua ES',
  'Crossing Diaz ES',
  'Dungan Lahek ES',
  'El Gawel ES',
  'Engkong ES',
  'Esimos Cataluña ES',
  'Esperanza ES',
  'Flaviano T. Deocampo, Sr. ES',
  'Guadalupe ES',
  'Imba Primary School',
  'Kakub ES',
  'Koronadal Central I ES',
  'Koronadal Central II ES',
  'Lasang ES',
  'Mabini ES',
  'Magsaysay ES',
  'Mama Mapambukol PS',
  'Mambucal ES',
  'Mangga ES',
  'Manuel Dondiego ES',
  'Marbel 1 CES',
  'Marbel 3 ES',
  'Marbel 4 ES',
  'Marbel 5 CES',
  'Marbel 6 ES',
  'Marbel 7 CES',
  'Marbel 8 ES',
  'Mariano Villegas ES',
  'Matulas ES',
  'Morales ES',
  'Namnama ES',
  'Nelmida ES',
  'Olu-mlao ES',
  'Osita CES',
  'Rotonda ES',
  'Sabino ES',
  'Salkan ES',
  'San Roque ES',
  'Siodina ES',
  'Siok ES',
  'Sto. Nino ES',
  'Supon ES',
];

// ── Strip ISO timestamp suffix, leaving only the date portion ────────────────
function cleanDate(val: string | undefined | null): string {
  if (!val) return '';
  if (val.includes('T')) return val.split('T')[0];
  return val;
}

// Convert "yyyy-mm-dd" to "mm/dd/yyyy" for display in the masked input
function isoToMmDdYyyy(val: string): string {
  const clean = cleanDate(val);
  if (!clean) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) return clean;
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [yyyy, mm, dd] = clean.split('-');
    return `${mm}/${dd}/${yyyy}`;
  }
  return clean;
}

// Convert "mm/dd/yyyy" → "yyyy-mm-dd" for the native date input's value
function mmDdYyyyToIso(val: string): string {
  if (!val) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
    const [mm, dd, yyyy] = val.split('/');
    return `${yyyy}-${mm}-${dd}`;
  }
  return '';
}

// ─────────────────────────────────────────────────────────────────────────────
//  DatePickerField — text mask + calendar button combo
// ─────────────────────────────────────────────────────────────────────────────
interface DatePickerFieldProps {
  label: string;
  value: string;           // always mm/dd/yyyy
  onChange: (v: string) => void;
  required?: boolean;
  span?: number;
}

function DatePickerField({ label, value, onChange, required, span }: DatePickerFieldProps) {
  const dateInputRef = useRef<HTMLInputElement>(null);

  // When the native date picker changes → convert to mm/dd/yyyy
  function handlePickerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const iso = e.target.value; // yyyy-mm-dd
    if (!iso) { onChange(''); return; }
    const [yyyy, mm, dd] = iso.split('-');
    onChange(`${mm}/${dd}/${yyyy}`);
  }

  // When text changes → apply the mask
  function handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(fmtDateInput(e.target.value));
  }

  return (
    <div className="f" style={span ? { gridColumn: `span ${span}` } : {}}>
      <label>
        {label}
        {required && <span style={{ color: '#e53e3e', fontSize: 10 }}> *</span>}
      </label>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', position: 'relative' }}>
        {/* Visible masked text input */}
        <input
          type="text"
          value={value}
          onChange={handleTextChange}
          placeholder="mm/dd/yyyy"
          maxLength={10}
          style={{
            flex: 1,
            height: 'var(--H)',
            padding: '0 12px',
            border: '1.5px solid var(--br)',
            borderRadius: 7,
            fontSize: 12,
            background: 'white',
            color: 'var(--cha)',
            fontFamily: 'Inter,sans-serif',
            minWidth: 0,
          }}
        />

        {/* Calendar icon button — clicks the hidden date input */}
        <button
          type="button"
          title="Pick a date"
          onClick={() => dateInputRef.current?.showPicker?.()}
          style={{
            flexShrink: 0,
            width: 32,
            height: 'var(--H)',
            border: '1.5px solid var(--br)',
            borderRadius: 7,
            background: 'var(--g1, #1a5c42)',
            color: 'white',
            cursor: 'pointer',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            transition: 'opacity .15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          📅
        </button>

        {/* Hidden native date picker — visually invisible, positioned under the button */}
        <input
          ref={dateInputRef}
          type="date"
          value={mmDdYyyyToIso(value)}
          onChange={handlePickerChange}
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            width: 32,
            height: 'var(--H)',
            opacity: 0,
            pointerEvents: 'none', // triggered programmatically via showPicker()
            border: 'none',
          }}
          tabIndex={-1}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  RegisterModal
// ─────────────────────────────────────────────────────────────────────────────
export default function RegisterModal({ employee, onClose, onSaved }: Props) {
  const { state } = useAppStore();
  const [f, setF]           = useState<F>(EMPTY);
  const [showPw, setShowPw] = useState(false);
  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);
  const isNew = !employee;

  useEffect(() => {
    if (employee) {
      setF({
        id:             employee.id             ?? '',
        email:          employee.email          ?? '',
        password:       employee.password       ?? '',
        surname:        employee.surname        ?? '',
        given:          employee.given          ?? '',
        suffix:         employee.suffix         ?? '',
        maternal:       employee.maternal       ?? '',
        sex:            employee.sex            ?? '',
        civil:          employee.civil          ?? '',
        dob:            isoToMmDdYyyy(employee.dob),
        pob:            employee.pob            ?? '',
        addr:           employee.addr           ?? '',
        spouse:         employee.spouse         ?? '',
        edu:            employee.edu            ?? '',
        elig:           employee.elig           ?? '',
        rating:         employee.rating         ?? '',
        tin:            employee.tin            ?? '',
        pexam:          employee.pexam          ?? '',
        dexam:          isoToMmDdYyyy(employee.dexam),
        appt:           isoToMmDdYyyy(employee.appt),
        status:         employee.status         ?? 'Teaching',
        account_status: employee.account_status ?? 'active',
        pos:            employee.pos            ?? '',
        school:         employee.school         ?? '',
      });
    } else {
      setF({
        id:'', email:'', password:'', surname:'', given:'', suffix:'', maternal:'',
        sex:'', civil:'', dob:'', pob:'', addr:'', spouse:'', edu:'', elig:'',
        rating:'', tin:'', pexam:'', dexam:'', appt:'',
        status:'Teaching', account_status:'active', pos:'', school:'',
      });
    }
    setError('');
    setShowPw(false);
  }, [employee]);

  function set(k: string, v: string) { setF(prev => ({ ...prev, [k]: v })); }

  const DATE_KEYS = ['dob', 'dexam', 'appt'];

  async function handleSave() {
    setError('');

    const idErr = !/^\d{7}$/.test(f.id.trim())
      ? 'Invalid Employee No. — must be exactly 7 numbers.'
      : null;
    if (idErr) { setError(idErr); return; }

    const emailErr = validateDepedEmail(f.email.toLowerCase().trim());
    if (emailErr) { setError(emailErr); return; }

    const required: [string, string][] = [
      ['surname', 'Surname'], ['given', 'Given name'], ['sex', 'Sex'],
      ['status', 'Category'], ['dob', 'Date of Birth'], ['addr', 'Present Address'],
      ['pos', 'Position / Designation'], ['school', 'School / Office Assignment'],
    ];
    for (const [field, label] of required) {
      if (!f[field]?.trim()) { setError(`${label} is required.`); return; }
    }
    if (isNew && !f.password.trim()) { setError('Password is required for new employees.'); return; }

    if (isNew && state.db.find(e => e.id === f.id)) {
      setError(`Employee ID "${f.id}" is already in use.`); return;
    }
    if (!isNew && f.id !== employee?.id && state.db.find(e => e.id === f.id)) {
      setError(`Employee ID "${f.id}" is already in use by another employee.`); return;
    }
    const originalId = employee?.id ?? f.id;
    const dupEmail = state.db.find(
      e => e.email?.toLowerCase() === f.email.toLowerCase().trim() && e.id !== originalId
    );
    if (dupEmail) { setError(`Email "${f.email}" is already registered to another employee.`); return; }

    const statusChanged = !isNew && employee && employee.status !== f.status;

    const payload = {
      id:             f.id.trim(),
      originalId:     isNew ? null : employee?.id,
      email:          f.email.toLowerCase().trim(),
      password:       f.password,
      surname:        f.surname.trim(),
      given:          f.given.trim(),
      suffix:         f.suffix.trim(),
      maternal:       f.maternal.trim(),
      sex:            f.sex.trim(),
      civil:          f.civil.trim(),
      dob:            f.dob.trim(),
      pob:            f.pob.trim(),
      addr:           f.addr.trim(),
      spouse:         f.spouse.trim(),
      edu:            f.edu.trim(),
      elig:           f.elig.trim(),
      rating:         f.rating.trim(),
      tin:            f.tin.trim(),
      pexam:          f.pexam.trim(),
      dexam:          f.dexam.trim(),
      appt:           f.appt.trim(),
      status:         f.status,
      account_status: f.account_status,
      pos:            f.pos.trim(),
      school:         f.school.trim(),
      records:        [],
      conversionLog:  employee?.conversionLog ?? [],
    };

    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/save_employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let errMsg = `Server error: ${res.status} ${res.statusText}`;
        try {
          const errJson = await res.json();
          if (errJson?.error) errMsg = errJson.error;
        } catch { /* response wasn't JSON */ }
        setError(errMsg);
        setSaving(false);
        return;
      }

      const data = await res.json();
      if (!data.ok) {
        setError(data.error || 'Save failed. Please try again.');
        setSaving(false);
        return;
      }

      if (statusChanged && employee) {
        let fwdBV = 0;
        let fwdBS = 0;
        try {
          const recRes = await fetch(
            `/api/get_records?employee_id=${encodeURIComponent(originalId)}`
          );
          const recData = await recRes.json();
          if (recData.ok && Array.isArray(recData.records)) {
            const freshRecs: Array<{
              _conversion?: boolean;
              setA_balance?: number;
              setB_balance?: number;
            }> = recData.records;
            const lastFresh = [...freshRecs].reverse().find(r => !r._conversion);
            if (lastFresh) {
              fwdBV = lastFresh.setA_balance ?? 0;
              fwdBS = lastFresh.setB_balance ?? 0;
            }
          }
        } catch {
          const lastRec = [...(employee.records ?? [])]
            .reverse()
            .find(r => !r._conversion);
          fwdBV = lastRec?.setA_balance ?? 0;
          fwdBS = lastRec?.setB_balance ?? 0;
        }

        const conversionRecord = {
          so:'', prd:'', from:'', to:'', spec:'', action:'',
          earned:0, forceAmount:0, monV:0, monS:0, monDV:0, monDS:0,
          monAmount:0, monDisAmt:0, trV:0, trS:0,
          _conversion: true,
          fromStatus:  employee.status,
          toStatus:    f.status,
          date:        new Date().toISOString().slice(0, 10),
          fwdBV,
          fwdBS,
        };

        await fetch('/api/save_record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employee_id: f.id.trim(), record: conversionRecord }),
        });
      }

      const saved: Personnel = {
        ...(employee ?? ({} as Personnel)),
        id:             f.id.trim(),
        email:          f.email.toLowerCase().trim(),
        password:       f.password,
        surname:        f.surname.trim(),
        given:          f.given.trim(),
        suffix:         f.suffix.trim(),
        maternal:       f.maternal.trim(),
        sex:            f.sex.trim(),
        civil:          f.civil.trim(),
        dob:            f.dob.trim(),
        pob:            f.pob.trim(),
        addr:           f.addr.trim(),
        spouse:         f.spouse.trim(),
        edu:            f.edu.trim(),
        elig:           f.elig.trim(),
        rating:         f.rating.trim(),
        tin:            f.tin.trim(),
        pexam:          f.pexam.trim(),
        dexam:          f.dexam.trim(),
        appt:           f.appt.trim(),
        status:         f.status as 'Teaching' | 'Non-Teaching' | 'Teaching Related',
        account_status: f.account_status as 'active' | 'inactive',
        pos:            f.pos.trim(),
        school:         f.school.trim(),
        lastEditedAt:   new Date().toISOString(),
        records:        employee?.records      ?? [],
        conversionLog:  employee?.conversionLog ?? [],
      };

      onSaved(saved, isNew);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('networkerror')) {
        setError('Network error: Could not reach the server. Please check your connection and try again.');
      } else {
        setError(`Unexpected error: ${msg}`);
      }
    } finally {
      setSaving(false);
    }
  }

  // Regular (non-date) field helper — unchanged from original
  const fi = (label: string, key: string, type = 'text', span?: number, hint?: string) => (
    <div className="f" style={span ? { gridColumn: `span ${span}` } : {}}>
      <label>{label}{hint && <span style={{ color: '#e53e3e', fontSize: 10 }}> {hint}</span>}</label>
      <input
        type={type}
        value={f[key] || ''}
        onChange={e => {
          let v = e.target.value;
          if (key === 'id')    v = v.replace(/\D/g, '').slice(0, 7);
          if (key === 'email') v = v.toLowerCase();
          set(key, v);
        }}
        placeholder={
          key === 'id'    ? 'e.g. 2024001' :
          key === 'email' ? 'juan@deped.gov.ph' : ''
        }
        maxLength={key === 'id' ? 7 : undefined}
      />
      {key === 'email' && f.email && !f.email.endsWith('@deped.gov.ph') && (
        <span style={{ fontSize: 10, color: '#e53e3e' }}>⚠️ Must end with @deped.gov.ph</span>
      )}
    </div>
  );

  return (
    <div className="mo open">
      <div className="mb">
        <div className="mh">
          <h3>{isNew ? 'Register New Personnel' : 'Edit Personnel Details'}</h3>
          <button className="btn b-slt b-sm" onClick={onClose}>✕ Close</button>
        </div>

        <div className="md">
          {/* Account Credentials */}
          <div className="sdiv">Account Credentials</div>
          <div className="ig" style={{ marginBottom: 18 }}>
            {fi('Employee No. (7 digits)', 'id', 'text', undefined, isNew ? '*' : undefined)}
            {fi('Email Address (@deped.gov.ph)', 'email', 'email', undefined, '*')}
            <div className="f">
              <label>
                Password
                {isNew && <span style={{ color: '#e53e3e', fontSize: 10 }}> *</span>}
              </label>
              <div className="ew">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={f.password}
                  onChange={e => set('password', e.target.value)}
                  placeholder={isNew ? 'Enter password' : 'Leave blank to keep current'}
                />
                <button className="eye-btn" type="button" onClick={() => setShowPw(p => !p)}>
                  {showPw ? '🙈' : '👁'}
                </button>
              </div>
            </div>
          </div>

          {/* Personal Information */}
          <div className="sdiv">Personal Information</div>
          <div className="ig" style={{ marginBottom: 18 }}>
            {fi('Surname',          'surname', 'text', undefined, '*')}
            {fi('Given Name',       'given',   'text', undefined, '*')}
            {fi('Suffix (Jr/III)',  'suffix')}
            {fi('Maternal Surname', 'maternal')}
            <div className="f">
              <label>Sex <span style={{ color: '#e53e3e', fontSize: 10 }}>*</span></label>
              <input list="sexList" value={f.sex} onChange={e => set('sex', e.target.value)}
                placeholder="Select or type…"
                style={{ height:'var(--H)',padding:'0 12px',border:'1.5px solid var(--br)',borderRadius:7,fontSize:12,width:'100%',background:'white',color:'var(--cha)',fontFamily:'Inter,sans-serif' }} />
              <datalist id="sexList"><option value="Male"/><option value="Female"/></datalist>
            </div>
            <div className="f">
              <label>Civil Status</label>
              <input list="civList" value={f.civil} onChange={e => set('civil', e.target.value)}
                placeholder="Select or type…"
                style={{ height:'var(--H)',padding:'0 12px',border:'1.5px solid var(--br)',borderRadius:7,fontSize:12,width:'100%',background:'white',color:'var(--cha)',fontFamily:'Inter,sans-serif' }} />
              <datalist id="civList">
                <option value="Single"/><option value="Married"/><option value="Widowed"/>
                <option value="Solo Parent"/><option value="Separated"/><option value="Annulled"/>
              </datalist>
            </div>

            {/* ── Date of Birth — text mask + calendar picker ── */}
            <DatePickerField
              label="Date of Birth"
              value={f.dob}
              onChange={v => set('dob', v)}
              required
            />
            {fi('Place of Birth', 'pob')}
            {fi('Present Address', 'addr', 'text', 2, '*')}
            {fi('Name of Spouse',  'spouse', 'text', 2)}
          </div>

          {/* Educational & Civil Service */}
          <div className="sdiv">Educational &amp; Civil Service</div>
          <div className="ig" style={{ marginBottom: 18 }}>
            {fi('Educational Qualification',       'edu',   'text', 2)}
            {fi('C.S. Eligibility (Kind of Exam)', 'elig',  'text', 2)}
            {fi('Rating',     'rating')}
            {fi('TIN Number', 'tin')}
            {fi('Place of Exam', 'pexam')}

            {/* ── Date of Exam — text mask + calendar picker ── */}
            <DatePickerField
              label="Date of Exam"
              value={f.dexam}
              onChange={v => set('dexam', v)}
            />
            {/* ── Date of Original Appointment — text mask + calendar picker ── */}
            <DatePickerField
              label="Date of Original Appointment"
              value={f.appt}
              onChange={v => set('appt', v)}
            />
          </div>

          {/* Employment Details */}
          <div className="sdiv">Employment Details</div>

          {!isNew && employee && f.status !== employee.status && (
            <div style={{ margin: '0 0 14px', padding: '10px 14px', background: '#fffbeb', border: '1.5px solid #f59e0b', borderRadius: 8 }}>
              <p style={{ color: '#92400e', fontSize: 12, fontWeight: 600, margin: 0 }}>
                ⚠️ Category change detected: <b>{employee.status}</b> → <b>{f.status}</b>
                <br />
                <span style={{ fontWeight: 400 }}>
                  A new leave card era will be created. The current balance will be carried forward as the opening balance of the new era.
                </span>
              </p>
            </div>
          )}

          <div className="ig">
            <div className="f">
              <label>Category <span style={{ color: '#e53e3e', fontSize: 10 }}>*</span></label>
              <input list="statList" value={f.status} onChange={e => set('status', e.target.value)}
                placeholder="Select or type…"
                style={{ height:'var(--H)',padding:'0 12px',border:'1.5px solid var(--br)',borderRadius:7,fontSize:12,width:'100%',background:'white',color:'var(--cha)',fontFamily:'Inter,sans-serif' }} />
              <datalist id="statList">
                <option value="Teaching"/>
                <option value="Non-Teaching"/>
                <option value="Teaching Related"/>
              </datalist>
            </div>
            <div className="f">
              <label>Account Status</label>
              <select value={f.account_status} onChange={e => set('account_status', e.target.value)}
                style={{ height:'var(--H)',padding:'0 12px',border:'1.5px solid var(--br)',borderRadius:7,fontSize:12,width:'100%',background:'white',color:'var(--cha)',fontFamily:'Inter,sans-serif',appearance:'none' }}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {fi('Position / Designation', 'pos', 'text', undefined, '*')}

            <div className="f" style={{ gridColumn: 'span 2' }}>
              <label>School / Office Assignment <span style={{ color: '#e53e3e', fontSize: 10 }}>*</span></label>
              <input
                list="schoolList"
                value={f.school}
                onChange={e => set('school', e.target.value)}
                placeholder="Select or type school/office…"
                style={{ height:'var(--H)',padding:'0 12px',border:'1.5px solid var(--br)',borderRadius:7,fontSize:12,width:'100%',background:'white',color:'var(--cha)',fontFamily:'Inter,sans-serif' }}
              />
              <datalist id="schoolList">
                {SCHOOL_OPTIONS.map(s => <option key={s} value={s} />)}
              </datalist>
            </div>
          </div>

          {error && (
            <div style={{ marginTop: 16, padding: '10px 14px', background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 8 }}>
              <p style={{ color: '#c53030', fontSize: 12, fontWeight: 600, margin: 0 }}>⚠️ {error}</p>
            </div>
          )}
        </div>

        <div className="mf">
          <button className="btn b-slt" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn b-grn" onClick={handleSave} disabled={saving}>
            {saving ? '⏳ Saving…' : '💾 Save Record'}
          </button>
        </div>
      </div>
    </div>
  );
}
