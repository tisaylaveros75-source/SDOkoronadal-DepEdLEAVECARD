/* ============================================================
   SDO Koronadal City — Leave Card System
   app.js — Vanilla JS SPA (Laravel Port)
   ============================================================ */

'use strict';

// ── API Base & CSRF ───────────────────────────────────────────
const API = window.API_BASE || '/api';
const getCSRF = () => window.CSRF_TOKEN || document.querySelector('meta[name="csrf-token"]')?.content || '';

async function apiCall(action, body = {}, method = 'POST') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    let url = `${API}/${action}`;
    const opts = { headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getCSRF() }, signal: controller.signal };
    if (method === 'GET') {
      const params = new URLSearchParams(body);
      url += `?${params}`;
      opts.method = 'GET';
    } else {
      opts.method = 'POST';
      opts.body = JSON.stringify(body);
    }
    const r = await fetch(url, opts);
    return await r.json();
  } catch (e) {
    if (e.name === 'AbortError') return { ok: false, error: 'Request timed out.' };
    return { ok: false, error: e.message };
  } finally { clearTimeout(timer); }
}

// ── Leave Logic ───────────────────────────────────────────────
function classifyLeave(act) {
  const a = (act || '').toLowerCase();
  const isForceDis = (a.includes('force') || a.includes('mandatory')) && a.includes('disapproved');
  return {
    isAcc:           a.includes('accrual') || a.includes('service credit'),
    isMon:           a.includes('monetization') && !a.includes('disapproved'),
    isMD:            a.includes('monetization') && a.includes('disapproved'),
    isForceDis,
    isDis:           a.includes('(disapproved)') && !(a.includes('monetization') && a.includes('disapproved')) && !isForceDis,
    isSick:          a.includes('sick'),
    isForce:         (a.includes('force') || a.includes('mandatory')) && !a.includes('disapproved'),
    isPer:           a.includes('personal'),
    isTransfer:      a.includes('credit entry') || a.includes('from denr'),
    isTerminal:      a.includes('terminal'),
    isSetB_noDeduct: a.includes('maternity') || a.includes('paternity'),
    isSetA_noDeduct: a.includes('solo parent') || a.includes('wellness') || a.includes('special privilege') ||
                     a.includes('spl') || a.includes('rehabilitation') || a.includes('study') ||
                     a.includes('magna carta') || a.includes('vawc') || a.includes('cto') || a.includes('compensatory'),
    isVacation:      a.includes('vacation') && !a.includes('(disapproved)'),
  };
}

function calcDays(r) {
  const a = (r.action || '').toLowerCase();
  const isForceAction = (a.includes('force') || a.includes('mandatory')) && !a.includes('disapproved');
  const isForceDis    = (a.includes('force') || a.includes('mandatory')) &&  a.includes('disapproved');
  if ((isForceAction || isForceDis) && +r.forceAmount > 0) return +r.forceAmount;
  if (r.from && r.to) {
    const startHalf = r.fromPeriod === 'AM' || r.fromPeriod === 'PM';
    const endHalf   = r.toPeriod   === 'AM' || r.toPeriod   === 'PM';
    if (r.from === r.to && startHalf) {
      const d = new Date(r.from + 'T00:00:00'); return (d.getDay() !== 0 && d.getDay() !== 6) ? 0.5 : 0;
    }
    let count = 0;
    const start = new Date(r.from + 'T00:00:00'), end = new Date(r.to + 'T00:00:00');
    if (end < start) return 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = d.getDay(); if (day !== 0 && day !== 6) count++;
    }
    if (startHalf) count -= 0.5;
    if (endHalf)   count -= 0.5;
    return Math.max(0, count);
  }
  return 0;
}

function fmtD(ds) {
  if (!ds) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(ds)) return ds;
  const d = new Date(ds + (ds.includes('T') ? '' : 'T00:00:00'));
  if (isNaN(d.getTime())) return ds;
  return String(d.getMonth()+1).padStart(2,'0') + '/' + String(d.getDate()).padStart(2,'0') + '/' + d.getFullYear();
}

function toISODate(s) {
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const [mm,dd,yyyy] = s.split('/');
  return `${yyyy}-${(mm||'').padStart(2,'0')}-${(dd||'').padStart(2,'0')}`;
}

function hz(n) { return (!n || n === 0) ? '' : (+n || 0).toString(); }
function h3(n) { const v = +n; return (v === 0) ? '' : v.toFixed(3).replace(/\.?0+$/, ''); }

function fmtDateInput(v) {
  let digits = v.replace(/\D/g,'');
  if (digits.length > 8) digits = digits.slice(0,8);
  if (digits.length >= 5) return digits.slice(0,2)+'/'+digits.slice(2,4)+'/'+digits.slice(4);
  if (digits.length >= 3) return digits.slice(0,2)+'/'+digits.slice(2);
  return digits;
}

function computeRowBalanceUpdates(records, empId, empStatus) {
  const segments = [];
  let currentStatus = empStatus;
  const firstConv = records.find(r => r._conversion);
  if (firstConv) currentStatus = firstConv.fromStatus || empStatus;
  let seg = { eraStatus: currentStatus, recs: [] };
  for (const r of records) {
    if (!r) continue;
    if (r._conversion) { segments.push(seg); seg = { eraStatus: r.toStatus || empStatus, recs: [] }; }
    else seg.recs.push(r);
  }
  segments.push(seg);
  const updates = [];
  for (const seg of segments) {
    if (seg.eraStatus === 'Teaching') {
      let bal = 0;
      for (const r of seg.recs) {
        if (!r._record_id) continue;
        const C = classifyLeave(r.action || '');
        let rAE=0,rAA=0,rAW=0,rBA=0,rBW=0;
        if (C.isTransfer)           { rAE=+(r.trV||0); bal+=rAE; }
        else if (+r.earned>0&&!C.isMon&&!C.isPer) { rAE=+r.earned; bal+=rAE; }
        else if (C.isMD)            { bal+=+(r.monDisAmt||0); rAA=+(r.monDisAmt||0); }
        else if (C.isForceDis)      { const d=calcDays(r); rAA=d; bal+=d; }
        else if (C.isMon)           { const m=+(r.monAmount||0); if(bal>=m){rAA=m;bal-=m;}else{rAA=bal;rAW=m-bal;bal=0;} }
        else if (!C.isDis) {
          const days=calcDays(r);
          if (days>0) {
            if (C.isSick)               { if(bal>=days){rBA=days;bal-=days;}else{rBA=bal;rBW=days-bal;bal=0;} }
            else if (C.isPer)           { rAW=days; }
            else if (C.isVacation)      { if(bal>=days){rAA=days;bal-=days;}else{rAA=bal;rAW=days-bal;bal=0;} }
            else if (C.isForce)         { if(bal>=days){rAA=days;bal-=days;}else{rAA=bal;rAW=days-bal;bal=0;} }
            else if (C.isTerminal)      { if(bal>=days){rBA=days;bal-=days;}else{rBA=bal;rBW=days-bal;bal=0;} }
            else if (C.isSetB_noDeduct) { rBA=days; }
            else                        { rAA=days; }
          }
        }
        const isE=+r.earned>0;
        const showB=(C.isSick||C.isSetB_noDeduct||C.isTerminal)&&!isE&&!C.isDis&&!C.isForceDis&&!C.isMon&&!C.isMD;
        updates.push({ record_id:r._record_id, employee_id:empId,
          setA_earned:+rAE.toFixed(3), setA_abs_wp:+rAA.toFixed(3),
          setA_balance:showB?0:+bal.toFixed(3), setA_wop:+rAW.toFixed(3),
          setB_earned:0, setB_abs_wp:+rBA.toFixed(3),
          setB_balance:showB?+bal.toFixed(3):0, setB_wop:+rBW.toFixed(3) });
      }
    } else {
      let bV=0, bS=0;
      for (const r of seg.recs) {
        if (!r._record_id) continue;
        const C = classifyLeave(r.action||'');
        let rAE=0,rAA=0,rAW=0,rBE=0,rBA=0,rBW=0;
        if (C.isTransfer) { rAE=+(r.trV||0); rBE=+(r.trS||0); bV+=rAE; bS+=rBE; }
        else if (C.isAcc) { const v=(+r.earned===0&&!(r.action||'').toLowerCase().includes('service'))?1.25:+r.earned; rAE=v;rBE=v;bV+=v;bS+=v; }
        else if (+r.earned>0) { rAE=+r.earned;rBE=+r.earned;bV+=rAE;bS+=rBE; }
        else if (C.isMD) { bV+=+(r.monDV||0);bS+=+(r.monDS||0);rAA=+(r.monDV||0);rBA=+(r.monDS||0); }
        else if (C.isForceDis) { const d=calcDays(r); rAA=d; bV+=d; }
        else if (C.isMon) {
          const mV=+(r.monV||0),mS=+(r.monS||0);
          if(bV>=mV){rAA=mV;bV-=mV;}else{rAA=bV;rAW=mV-bV;bV=0;}
          if(bS>=mS){rBA=mS;bS-=mS;}else{rBA=bS;rBW=mS-bS;bS=0;}
        }
        else if (C.isDis)      { /* no change */ }
        else if (C.isPer)      { const d=calcDays(r);if(d>0)rAW=d; }
        else if (C.isVacation) { const d=calcDays(r);if(d>0){if(bV>=d){rAA=d;bV-=d;}else{rAA=bV;rAW=d-bV;bV=0;}} }
        else if (C.isSick)     { const d=calcDays(r);if(d>0){if(bS>=d){rBA=d;bS-=d;}else{rBA=bS;rBW=d-bS;bS=0;}} }
        else if (C.isForce)    { const d=calcDays(r);if(d>0){if(bV>=d){rAA=d;bV-=d;}else{rAA=bV;rAW=d-bV;bV=0;}} }
        else if (C.isTerminal) { const d=calcDays(r);if(d>0){if(bV>=d){rAA=d;bV-=d;}else{rAA=bV;rAW=d-bV;bV=0;} if(bS>=d){rBA=d;bS-=d;}else{rBA=bS;rBW=d-bS;bS=0;}} }
        else if (C.isSetB_noDeduct) { const d=calcDays(r);if(d>0)rBA=d; }
        else if (C.isSetA_noDeduct) { const d=calcDays(r);if(d>0)rAA=d; }
        else { const d=calcDays(r);if(d>0)rAA=d; }
        updates.push({ record_id:r._record_id, employee_id:empId,
          setA_earned:+rAE.toFixed(3), setA_abs_wp:+rAA.toFixed(3),
          setA_balance:+bV.toFixed(3), setA_wop:+rAW.toFixed(3),
          setB_earned:+rBE.toFixed(3), setB_abs_wp:+rBA.toFixed(3),
          setB_balance:+bS.toFixed(3), setB_wop:+rBW.toFixed(3) });
      }
    }
  }
  return updates;
}

function isCardUpdatedThisMonth(records, status, lastEditedAt) {
  if (!records || records.length === 0) return false;
  const now = new Date();
  const thisYear = now.getFullYear(), thisMon = now.getMonth() + 1;
  const lc = (status || '').toLowerCase();
  const isNTorTR = lc === 'non-teaching' || lc === 'teaching related';
  if (isNTorTR) {
    if (!lastEditedAt) return false;
    const d = new Date(lastEditedAt);
    return d.getFullYear() === thisYear && (d.getMonth()+1) === thisMon;
  }
  const thisMonStr = `${thisYear}-${String(thisMon).padStart(2,'0')}`;
  return records.some(r => {
    if (r._conversion) return false;
    const dateStr = r.from || r.to || '';
    if (!dateStr) return false;
    const d = new Date(dateStr + 'T00:00:00');
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    return key === thisMonStr;
  });
}

function currentMonthLabel() {
  return new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

// ── State ─────────────────────────────────────────────────────
const state = {
  db: [], role: null, isAdmin: false, isEncoder: false, isSchoolAdmin: false,
  curId: null, page: 'home',
  adminCfg: { id: '', password: '', name: 'Administrator' },
  encoderCfg: { id: '', password: '', name: 'Encoder' },
  schoolAdminCfg: { id: '', dbId: 0, name: 'School Admin' },
  loading: false,
};

// ── Pagination state ──────────────────────────────────────────
const pag = { page: 1, limit: 100, total: 0, loading: false };

// ── Router ────────────────────────────────────────────────────
function setPage(p) {
  state.page = p;
  document.querySelectorAll('.page').forEach(el => el.classList.remove('on'));
  const el = document.getElementById('pg-' + p);
  if (el) el.classList.add('on');
  document.querySelectorAll('.sb-item[data-page]').forEach(i => {
    i.classList.toggle('active', i.dataset.page === p);
  });
  closeSidebar();
  if (p === 'home')  renderHome();
  if (p === 'list')  renderPersonnelList();
  if (p === 'cards') renderLeaveCards();
  if (p === 'nt')    renderNTPage();
  if (p === 't')     renderTPage();
  if (p === 'sa')    renderSchoolAdminPage();
  if (p === 'user')  renderUserPage();
}

// ── Data loading ──────────────────────────────────────────────
async function loadAllPersonnel() {
  pag.page = 1; pag.total = 0; state.db = [];
  await loadPersonnelPage();
}

async function loadPersonnelPage() {
  if (pag.loading) return;
  pag.loading = true;
  const res = await apiCall('get_personnel', { page: pag.page, limit: pag.limit }, 'GET');
  pag.loading = false;
  if (!res.ok) return;
  const incoming = res.data || [];
  if (pag.page === 1) state.db = incoming;
  else state.db = [...state.db, ...incoming];
  pag.total = res.total || state.db.length;
  if (state.db.length < pag.total) { pag.page++; await loadPersonnelPage(); }
}

async function ensureRecords(empId) {
  const emp = state.db.find(e => e.id === empId);
  if (!emp) return null;
  if (emp.records && emp.records.length > 0) return emp;
  const res = await apiCall('get_records', { employee_id: empId }, 'GET');
  if (res.ok) {
    emp.records = res.records || [];
  }
  return emp;
}

async function saveRowBalances(records, empId, status) {
  const updates = computeRowBalanceUpdates(records, empId, status);
  for (const u of updates) {
    await apiCall('save_row_balance', u);
  }
}

// ────────────────────────────────────────────────────────────────────────
//  RENDER: LOGIN
// ────────────────────────────────────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('s-' + name)?.classList.add('active');
}

function initLogin() {
  const form = document.getElementById('loginForm');
  const err  = document.getElementById('loginErr');
  const eyeBtn = document.getElementById('eyeBtn');
  const pwInput = document.getElementById('lpw');

  eyeBtn?.addEventListener('click', () => {
    pwInput.type = pwInput.type === 'password' ? 'text' : 'password';
    eyeBtn.textContent = pwInput.type === 'password' ? '👁' : '🙈';
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.style.display = 'none';
    const btn = form.querySelector('button[type=submit]');
    btn.textContent = 'Signing in…'; btn.disabled = true;
    const id = document.getElementById('lid').value.trim();
    const password = pwInput.value;
    const res = await apiCall('login', { id, password });
    btn.textContent = 'Sign In'; btn.disabled = false;
    if (!res.ok) { err.textContent = res.error || 'Login failed.'; err.style.display = 'block'; return; }
    await doLogin(res);
  });
}

async function doLogin(res) {
  if (res.role === 'admin' || res.role === 'encoder') {
    const isEnc = res.role === 'encoder';
    state.isAdmin = true; state.isEncoder = isEnc; state.isSchoolAdmin = false;
    state.role = res.role;
    if (!isEnc) state.adminCfg = { ...state.adminCfg, id: res.login_id, name: res.name };
    else state.encoderCfg = { id: res.login_id, name: res.name };
  } else if (res.role === 'school_admin') {
    state.isSchoolAdmin = true; state.isAdmin = false; state.isEncoder = false;
    state.role = 'school_admin';
    state.schoolAdminCfg = { id: res.login_id, dbId: res.db_id, name: res.name };
  } else {
    state.role = 'employee'; state.curId = res.employee_id;
    state.isAdmin = state.isEncoder = state.isSchoolAdmin = false;
  }
  showScreen('app');
  renderTopbar();
  renderSidebar();
  await loadAllPersonnel();
  if (state.role === 'employee') setPage('user');
  else setPage('home');
}

// ────────────────────────────────────────────────────────────────────────
//  RENDER: TOPBAR
// ────────────────────────────────────────────────────────────────────────
function renderTopbar() {
  const tb = document.getElementById('topbar');
  const roleName = state.role === 'admin' ? state.adminCfg.name
    : state.role === 'encoder' ? state.encoderCfg.name
    : state.role === 'school_admin' ? state.schoolAdminCfg.name
    : 'Employee';
  tb.innerHTML = `
    <div class="tb-in">
      <div class="tb-brand">
        <button class="sb-toggle" id="sbToggle" title="Menu">☰</button>
        <img class="tb-logo" src="https://upload.wikimedia.org/wikipedia/en/a/a8/DepEd_Koronadal.png" alt="DepEd" onerror="this.style.display='none'"/>
        <div class="tb-divider"></div>
        <div>
          <div class="tb-title">SDO Koronadal City</div>
          <div class="tb-sub">Leave Card Management System</div>
        </div>
      </div>
      <div class="tb-nav">
        <span style="font-size:11px;color:var(--mu);margin-right:8px;">Logged in as <strong>${escHtml(roleName)}</strong></span>
        <button class="nb out" id="logoutBtn">🚪 Logout</button>
      </div>
    </div>`;
  document.getElementById('sbToggle')?.addEventListener('click', openSidebar);
  document.getElementById('logoutBtn')?.addEventListener('click', () => showLogoutModal());
}

// ────────────────────────────────────────────────────────────────────────
//  RENDER: SIDEBAR
// ────────────────────────────────────────────────────────────────────────
function renderSidebar() {
  const sb = document.getElementById('sidebar');
  const canAdmin = state.isAdmin && !state.isEncoder;
  const canEncode = state.isAdmin || state.isEncoder;
  const roleName = state.role === 'admin' ? state.adminCfg.name
    : state.role === 'encoder' ? state.encoderCfg.name
    : state.role === 'school_admin' ? state.schoolAdminCfg.name
    : 'Employee';
  const roleLabel = state.role === 'admin' ? 'System Administrator'
    : state.role === 'encoder' ? 'Leave Encoder'
    : state.role === 'school_admin' ? 'School Administrator'
    : 'Employee';

  let navItems = '';
  if (state.role === 'employee') {
    navItems = `<div class="sb-item" data-page="user"><span class="sb-icon">🪪</span>My Leave Card</div>`;
  } else {
    navItems = `<div class="sb-item" data-page="home"><span class="sb-icon">🏠</span>Dashboard</div>`;
    if (canEncode) {
      navItems += `
        <div class="sb-item" data-page="list"><span class="sb-icon">👥</span>Personnel List</div>
        <div class="sb-item" data-page="cards"><span class="sb-icon">📋</span>Leave Cards</div>
        <div class="sb-item" data-page="nt"><span class="sb-icon">📊</span>Non-Teaching Cards</div>
        <div class="sb-item" data-page="t"><span class="sb-icon">🏫</span>Teaching Cards</div>`;
    }
    if (canAdmin) {
      navItems += `
        <div class="sb-divider"></div>
        <div class="sb-item" data-page="sa"><span class="sb-icon">🏢</span>School Admins</div>`;
    }
    if (state.isSchoolAdmin) {
      navItems = `
        <div class="sb-item" data-page="home"><span class="sb-icon">🏠</span>Dashboard</div>
        <div class="sb-item" data-page="cards"><span class="sb-icon">📋</span>Leave Cards</div>`;
    }
  }

  sb.innerHTML = `
    <div class="sb-head">
      <img class="sb-logo" src="https://upload.wikimedia.org/wikipedia/en/a/a8/DepEd_Koronadal.png" alt="" onerror="this.style.display='none'"/>
      <div class="sb-brand">
        <div class="sb-brand-title">SDO Koronadal City</div>
        <div class="sb-brand-sub">Leave Card System</div>
      </div>
      <button class="sb-close" id="sbClose">✕</button>
    </div>
    <div class="sb-user" id="sbUser">
      <div class="sb-av">${escHtml(roleName.charAt(0).toUpperCase())}</div>
      <div><div class="sb-uname">${escHtml(roleName)}</div><div class="sb-urole">${escHtml(roleLabel)}</div></div>
    </div>
    <nav class="sb-nav">${navItems}
      <div class="sb-divider"></div>
      <div class="sb-item danger" id="sbLogout"><span class="sb-icon">🚪</span>Logout</div>
    </nav>`;

  document.getElementById('sbClose')?.addEventListener('click', closeSidebar);
  document.getElementById('sbLogout')?.addEventListener('click', () => showLogoutModal());
  sb.querySelectorAll('.sb-item[data-page]').forEach(item => {
    item.addEventListener('click', () => setPage(item.dataset.page));
  });
  document.getElementById('sbUser')?.addEventListener('click', () => {
    closeSidebar();
    if (state.role === 'admin') showAdminProfileModal();
    else if (state.role === 'encoder') showEncoderProfileModal();
    else if (state.role === 'school_admin') showSAProfileModal();
  });
}

function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sbOverlay').classList.add('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sbOverlay').classList.remove('open');
}

// ────────────────────────────────────────────────────────────────────────
//  RENDER: HOME / DASHBOARD
// ────────────────────────────────────────────────────────────────────────
function renderHome() {
  const el = document.getElementById('pg-home');
  const all = state.db;
  const active = all.filter(e => e.account_status !== 'inactive');
  const teaching = all.filter(e => (e.status||'').toLowerCase() === 'teaching').length;
  const nonTeaching = all.filter(e => (e.status||'').toLowerCase() === 'non-teaching').length;
  const teachingRel = all.filter(e => (e.status||'').toLowerCase() === 'teaching related').length;
  const month = currentMonthLabel();

  // Updated/pending lists
  const updatedList = [], pendingList = [];
  for (const e of active) {
    if (isCardUpdatedThisMonth(e.records||[], e.status||'', e.lastEditedAt)) updatedList.push(e);
    else pendingList.push(e);
  }
  const sortByName = arr => [...arr].sort((a,b)=>(a.surname||'').localeCompare(b.surname||''));
  const updated = sortByName(updatedList), pending = sortByName(pendingList);
  const roleName = state.role === 'admin' ? state.adminCfg.name
    : state.role === 'encoder' ? state.encoderCfg.name
    : state.role === 'school_admin' ? state.schoolAdminCfg.name : 'User';

  el.innerHTML = `
    <div style="background:linear-gradient(120deg,var(--g0),var(--g1));border-radius:14px;padding:28px 32px;margin-bottom:20px;color:white;position:relative;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.22);">
      <div style="position:absolute;inset:0;background:url(https://depedkoronadalcity.wordpress.com/wp-content/uploads/2012/09/city-division-office1.jpg) center/cover no-repeat;opacity:.1;z-index:0;"></div>
      <div style="position:relative;z-index:1;">
        <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--au);font-weight:700;margin-bottom:6px;">Welcome Back</div>
        <h2 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.9rem;font-weight:700;margin-bottom:4px;">${escHtml(roleName)}</h2>
        <p style="font-size:.85rem;opacity:.7;">${month} — Leave Card Management System</p>
      </div>
    </div>

    <div class="stats-row">
      <div class="stat-box"><div class="stat-icon si-g">👥</div><div><div class="stat-val">${all.length}</div><div class="stat-lbl">Total Personnel</div></div></div>
      <div class="stat-box"><div class="stat-icon si-b">🏫</div><div><div class="stat-val">${teaching}</div><div class="stat-lbl">Teaching</div></div></div>
      <div class="stat-box"><div class="stat-icon si-a">📊</div><div><div class="stat-val">${nonTeaching}</div><div class="stat-lbl">Non-Teaching</div></div></div>
      <div class="stat-box"><div class="stat-icon si-g">🔗</div><div><div class="stat-val">${teachingRel}</div><div class="stat-lbl">Teaching Related</div></div></div>
      <div class="stat-box" style="cursor:pointer;" id="hUpdBtn"><div class="stat-icon" style="background:#d1fae5;">✅</div><div><div class="stat-val" style="color:#065f46;">${updated.length}</div><div class="stat-lbl">Updated (${month})</div></div></div>
      <div class="stat-box" style="cursor:pointer;" id="hPenBtn"><div class="stat-icon" style="background:#fee2e2;">⏳</div><div><div class="stat-val" style="color:var(--rd);">${pending.length}</div><div class="stat-lbl">Pending Update</div></div></div>
    </div>

    <div id="hUpdPanel" style="display:none;margin-bottom:16px;">
      <div class="card"><div class="ch grn">✅ Updated this month — ${updated.length} employees</div>
      <div class="cb" style="max-height:300px;overflow-y:auto;">
        ${updated.length === 0 ? '<p style="color:var(--mu);font-size:12px;">No employees updated yet.</p>' :
          updated.map(e=>`<div style="padding:6px 0;border-bottom:1px solid var(--dv);font-size:12px;display:flex;justify-content:space-between;">
            <span><strong>${escHtml(e.surname)}, ${escHtml(e.given)}</strong></span>
            <span style="color:var(--mu);">${escHtml(e.school||'')}</span>
          </div>`).join('')}
      </div></div>
    </div>

    <div id="hPenPanel" style="display:none;margin-bottom:16px;">
      <div class="card"><div class="ch amber">⏳ Pending update — ${pending.length} employees</div>
      <div class="cb" style="max-height:300px;overflow-y:auto;">
        ${pending.length === 0 ? '<p style="color:var(--mu);font-size:12px;">All up to date!</p>' :
          pending.map(e=>`<div style="padding:6px 0;border-bottom:1px solid var(--dv);font-size:12px;display:flex;justify-content:space-between;cursor:pointer;" data-empid="${escHtml(e.id)}">
            <span><strong>${escHtml(e.surname)}, ${escHtml(e.given)}</strong></span>
            <span style="color:var(--mu);">${escHtml(e.school||'')}</span>
          </div>`).join('')}
      </div></div>
    </div>

    <!-- Developers Section -->
    <div class="dev-section">
      <div class="dev-section-title">👩‍💻 About the Developers</div>
      <div class="dev-section-sub">🩷 Built with love for SDO Koronadal City</div>
      <div class="dev-cards">
        <div class="dev-card left">
          <img class="dev-avatar" src="/img/jeoan.jpg" onerror="this.src='https://ui-avatars.com/api/?name=Jeoan&background=ffd6e8&color=8b1a4a&size=110'" alt="Jeoan"/>
          <div class="dev-name">Jenly Orberte</div>
          <div class="dev-role">Lead Developer</div>
          <div class="dev-bio">Designed & developed the leave tracking system architecture, database schema, and backend logic.</div>
          <div class="dev-badge">💻 Full Stack</div>
          <div class="dev-hearts">🩷🩷🩷</div>
        </div>
        <div class="dev-card right">
          <img class="dev-avatar" src="/img/janice.jpg" onerror="this.src='https://ui-avatars.com/api/?name=Janice&background=f0d6ff&color=6b1040&size=110'" alt="Janice"/>
          <div class="dev-name">Janice</div>
          <div class="dev-role">UI/UX Developer</div>
          <div class="dev-bio">Crafted the user interface, leave card tables, and the beautiful Red Armour design theme.</div>
          <div class="dev-badge">🎨 Frontend</div>
          <div class="dev-hearts">💜💜💜</div>
        </div>
      </div>
    </div>`;

  document.getElementById('hUpdBtn')?.addEventListener('click', () => {
    const p = document.getElementById('hUpdPanel');
    p.style.display = p.style.display === 'none' ? 'block' : 'none';
  });
  document.getElementById('hPenBtn')?.addEventListener('click', () => {
    const p = document.getElementById('hPenPanel');
    p.style.display = p.style.display === 'none' ? 'block' : 'none';
  });
  el.querySelectorAll('[data-empid]').forEach(row => {
    row.addEventListener('click', () => {
      state.curId = row.dataset.empid;
      setPage('cards');
    });
  });
}

// ────────────────────────────────────────────────────────────────────────
//  RENDER: PERSONNEL LIST PAGE
// ────────────────────────────────────────────────────────────────────────
function renderPersonnelList() {
  const el = document.getElementById('pg-list');
  const canAdmin = state.isAdmin && !state.isEncoder;
  el.innerHTML = `
    <div class="card">
      <div class="ch grn">👥 Personnel List</div>
      <div class="toolbar">
        <div class="toolbar-left">
          ${canAdmin ? `<button class="btn b-pri" id="addEmpBtn">➕ Add Employee</button>` : ''}
        </div>
        <div class="toolbar-filters">
          <select class="tb-filter" id="statusFilter"><option value="">All Status</option><option value="Teaching">Teaching</option><option value="Non-Teaching">Non-Teaching</option><option value="Teaching Related">Teaching Related</option></select>
          <select class="tb-filter" id="accFilter"><option value="">All Accounts</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
          <div class="srch"><span class="sri">🔍</span><input id="listSearch" type="text" placeholder="Search name, ID, school…"/></div>
        </div>
      </div>
      <div class="tw"><table id="personnelTable">
        <thead><tr>
          <th>No.</th><th>Employee ID</th><th>Name</th><th>Category</th><th>Position</th><th>School / Office</th><th>Status</th><th class="no-print">Actions</th>
        </tr></thead>
        <tbody id="personnelBody"></tbody>
      </table></div>
    </div>`;

  document.getElementById('addEmpBtn')?.addEventListener('click', () => showRegisterModal(null));
  document.getElementById('listSearch').addEventListener('input', filterPersonnelTable);
  document.getElementById('statusFilter').addEventListener('change', filterPersonnelTable);
  document.getElementById('accFilter').addEventListener('change', filterPersonnelTable);
  filterPersonnelTable();
}

function filterPersonnelTable() {
  const q = (document.getElementById('listSearch')?.value || '').toLowerCase();
  const sf = document.getElementById('statusFilter')?.value || '';
  const af = document.getElementById('accFilter')?.value || '';
  const body = document.getElementById('personnelBody');
  if (!body) return;
  const canAdmin = state.isAdmin && !state.isEncoder;
  const filtered = state.db.filter(e => {
    if (sf && e.status !== sf) return false;
    if (af && (e.account_status||'active') !== af) return false;
    if (!q) return true;
    return [e.id, e.surname, e.given, e.school, e.pos].some(v => (v||'').toLowerCase().includes(q));
  });
  body.innerHTML = filtered.map((e, i) => `
    <tr>
      <td>${i+1}</td>
      <td><strong>${escHtml(e.id)}</strong></td>
      <td style="text-align:left;"><strong>${escHtml(e.surname)}</strong>, ${escHtml(e.given)} ${escHtml(e.suffix||'')}</td>
      <td><span class="badge ${e.status === 'Teaching' ? 'bt' : 'bnt'}">${escHtml(e.status||'')}</span></td>
      <td style="text-align:left;">${escHtml(e.pos||'')}</td>
      <td style="text-align:left;">${escHtml(e.school||'')}</td>
      <td><span style="color:${(e.account_status||'active')==='active'?'#065f46':'var(--rd)'};">${(e.account_status||'active')==='active'?'✓ Active':'✗ Inactive'}</span></td>
      <td class="no-print">
        <button class="btn b-pri b-sm" data-view="${escHtml(e.id)}">📋 Card</button>
        ${canAdmin?`<button class="btn b-slt b-sm" data-edit="${escHtml(e.id)}">✏️ Edit</button>
        <button class="btn b-sm" style="background:#e0e7ef;color:var(--sl);" data-arch="${escHtml(e.id)}" data-inactive="${(e.account_status||'active')==='inactive'}">${(e.account_status||'active')==='inactive'?'♻️ Restore':'🗄️ Archive'}</button>`:''}
      </td>
    </tr>`).join('');

  body.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => { state.curId = btn.dataset.view; setPage('cards'); });
  });
  body.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const emp = state.db.find(e => e.id === btn.dataset.edit);
      showRegisterModal(emp);
    });
  });
  body.querySelectorAll('[data-arch]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.arch;
      const isInactive = btn.dataset.inactive === 'true';
      if (!confirm(isInactive ? `Restore ${id}?` : `Archive ${id}?`)) return;
      const action = isInactive ? 'unarchive' : 'archive';
      const res = await apiCall(action, { employee_id: id });
      if (!res.ok) { alert(res.error); return; }
      const emp = state.db.find(e => e.id === id);
      if (emp) emp.account_status = isInactive ? 'active' : 'inactive';
      filterPersonnelTable();
    });
  });
}

// ────────────────────────────────────────────────────────────────────────
//  RENDER: LEAVE CARDS PAGE
// ────────────────────────────────────────────────────────────────────────
function renderLeaveCards() {
  const el = document.getElementById('pg-cards');
  el.innerHTML = `
    <div class="card">
      <div class="ch grn">📋 Leave Cards</div>
      <div class="toolbar">
        <div class="toolbar-left">
          <div class="srch"><span class="sri">🔍</span><input id="cardSearch" type="text" placeholder="Search employee…"/></div>
        </div>
        <div class="toolbar-filters">
          <select class="tb-filter" id="cardStatusFilter"><option value="">All Status</option><option value="Teaching">Teaching</option><option value="Non-Teaching">Non-Teaching</option><option value="Teaching Related">Teaching Related</option></select>
          <button class="btn b-sm" id="clearCardFilter" style="background:#e0e7ef;color:var(--sl);">✕ Clear</button>
        </div>
      </div>
      <div class="tw"><table>
        <thead><tr><th>No.</th><th>Employee ID</th><th>Name</th><th>Category</th><th>School / Office</th><th>Last Updated</th><th class="no-print">Actions</th></tr></thead>
        <tbody id="cardListBody"></tbody>
      </table></div>
    </div>
    <div id="leaveCardView"></div>`;

  document.getElementById('cardSearch').addEventListener('input', filterCardList);
  document.getElementById('cardStatusFilter').addEventListener('change', filterCardList);
  document.getElementById('clearCardFilter')?.addEventListener('click', () => {
    document.getElementById('cardSearch').value = '';
    document.getElementById('cardStatusFilter').value = '';
    filterCardList();
  });
  filterCardList();

  if (state.curId) {
    const emp = state.db.find(e => e.id === state.curId);
    if (emp) openLeaveCard(emp);
  }
}

function filterCardList() {
  const q = (document.getElementById('cardSearch')?.value || '').toLowerCase();
  const sf = document.getElementById('cardStatusFilter')?.value || '';
  const body = document.getElementById('cardListBody');
  if (!body) return;
  const active = state.db.filter(e => e.account_status !== 'inactive');
  const filtered = active.filter(e => {
    if (sf && e.status !== sf) return false;
    if (!q) return true;
    return [e.id, e.surname, e.given, e.school].some(v => (v||'').toLowerCase().includes(q));
  });
  body.innerHTML = filtered.map((e,i) => `
    <tr>
      <td>${i+1}</td>
      <td><strong>${escHtml(e.id)}</strong></td>
      <td style="text-align:left;"><strong>${escHtml(e.surname)}</strong>, ${escHtml(e.given)}</td>
      <td><span class="badge ${e.status==='Teaching'?'bt':'bnt'}">${escHtml(e.status||'')}</span></td>
      <td style="text-align:left;">${escHtml(e.school||'')}</td>
      <td style="font-size:10.5px;color:var(--mu);">${e.lastEditedAt ? new Date(e.lastEditedAt).toLocaleDateString() : '—'}</td>
      <td class="no-print"><button class="btn b-pri b-sm" data-opencard="${escHtml(e.id)}">📋 Open Card</button></td>
    </tr>`).join('');
  body.querySelectorAll('[data-opencard]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const emp = await ensureRecords(btn.dataset.opencard);
      if (emp) openLeaveCard(emp);
    });
  });
}

// ────────────────────────────────────────────────────────────────────────
//  LEAVE CARD VIEW
// ────────────────────────────────────────────────────────────────────────
async function openLeaveCard(emp) {
  state.curId = emp.id;
  if (!emp.records || emp.records.length === 0) {
    const res = await apiCall('get_records', { employee_id: emp.id }, 'GET');
    if (res.ok) emp.records = res.records || [];
  }
  const container = document.getElementById('leaveCardView');
  if (!container) return;

  const isT  = (emp.status||'').toLowerCase() === 'teaching';
  const isNT = !isT;
  const canEdit = state.isAdmin || state.isEncoder;
  const records = emp.records || [];

  // Build header profile
  const profileHtml = `
    <div class="cb">
      <div class="pg">
        ${profileField('Employee No.', emp.id)}
        ${profileField('Full Name', `${emp.surname}, ${emp.given} ${emp.suffix||''}`.trim())}
        ${profileField('Position', emp.pos||'')}
        ${profileField('School / Office', emp.school||'')}
        ${profileField('Category', emp.status||'')}
        ${profileField('Date of Birth', fmtD(emp.dob||''))}
        ${profileField('Date of Appointment', fmtD(emp.appt||''))}
        ${profileField('Civil Status', emp.civil||'')}
        ${profileField('Eligibility', emp.elig||'')}
        ${profileField('Education', emp.edu||'')}
        ${profileField('Email', emp.email||'')}
        ${profileField('Last Updated', emp.lastEditedAt ? new Date(emp.lastEditedAt).toLocaleString() : '—')}
      </div>
    </div>`;

  container.innerHTML = `
    <div class="card" style="margin-top:20px;">
      <div class="ch grn" style="justify-content:space-between;">
        <span>📋 Leave Card — ${escHtml(emp.surname)}, ${escHtml(emp.given)}</span>
        <div style="display:flex;gap:8px;" class="no-print">
          ${canEdit ? `<button class="btn b-sm" style="background:rgba(255,255,255,.15);color:white;border:1px solid rgba(255,255,255,.3);" id="addRecBtn">➕ Add Record</button>
          <button class="btn b-sm" style="background:rgba(255,255,255,.15);color:white;border:1px solid rgba(255,255,255,.3);" id="addEraBtn">🔄 Add Conversion Era</button>` : ''}
          <button class="btn b-sm" style="background:rgba(255,255,255,.15);color:white;border:1px solid rgba(255,255,255,.3);" onclick="window.print()">🖨️ Print</button>
        </div>
      </div>
      ${profileHtml}
      <div id="lcTableWrap"></div>
    </div>`;

  renderLeaveCardTable(emp);
  if (canEdit) {
    document.getElementById('addRecBtn')?.addEventListener('click', () => showLeaveEntryModal(emp, null, -1));
    document.getElementById('addEraBtn')?.addEventListener('click', () => showEraModal(emp));
  }
}

function profileField(label, value) {
  return `<div class="pi"><label>${escHtml(label)}</label><span>${escHtml(value||'—')}</span></div>`;
}

function renderLeaveCardTable(emp) {
  const wrap = document.getElementById('lcTableWrap');
  if (!wrap) return;
  const records = emp.records || [];
  const isT  = (emp.status||'').toLowerCase() === 'teaching';
  const isNT = !isT;
  const canEdit = state.isAdmin || state.isEncoder;

  // Split into segments by conversion markers
  const segments = [];
  let cur = { conv: null, recs: [] };
  for (const r of records) {
    if (r._conversion) { segments.push(cur); cur = { conv: r, recs: [] }; }
    else cur.recs.push(r);
  }
  segments.push(cur);

  let html = '';
  segments.forEach((seg, si) => {
    const isFirst = si === 0;
    const eraLabel = seg.conv ? `🔄 Era: ${seg.conv.fromStatus||''} → ${seg.conv.toStatus||''}` : '';
    const eraStatus = seg.conv ? seg.conv.toStatus : (isFirst ? emp.status : '');
    const segIsT = (eraStatus||'').toLowerCase() === 'teaching';

    if (seg.conv) {
      html += `<div style="padding:10px 20px;background:var(--au2);border-top:2px solid var(--au);border-bottom:2px solid var(--au);display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:11.5px;font-weight:700;color:var(--au);">${escHtml(eraLabel)}</span>
        ${canEdit?`<button class="btn b-sm" style="background:#fee2e2;color:var(--rd);" data-delera="${escHtml(emp.id)}" data-eraid="${seg.conv._record_id}">🗑️ Remove Era</button>`:''}
      </div>`;
    }

    html += buildTableForSegment(seg.recs, segIsT, emp, canEdit, si, isFirst, seg.conv);
  });

  wrap.innerHTML = html;

  // Bind delete era buttons
  wrap.querySelectorAll('[data-delera]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Remove this conversion era marker?')) return;
      const res = await apiCall('delete_era', { record_id: +btn.dataset.eraid, employee_id: btn.dataset.delera });
      if (!res.ok) { alert(res.error); return; }
      emp.records = emp.records.filter(r => r._record_id !== +btn.dataset.eraid);
      renderLeaveCardTable(emp);
    });
  });

  // Bind row action menus
  wrap.querySelectorAll('.row-menu-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAllMenus();
      const dd = btn.nextElementSibling;
      dd.classList.toggle('open');
      const rect = btn.getBoundingClientRect();
      dd.style.top = (rect.bottom + window.scrollY + 4) + 'px';
      dd.style.left = (rect.left + window.scrollX - 120) + 'px';
    });
  });
  document.addEventListener('click', closeAllMenus, { once: false });
}

function closeAllMenus() {
  document.querySelectorAll('.row-menu-dd.open').forEach(m => m.classList.remove('open'));
}

function buildTableForSegment(recs, isT, emp, canEdit, segIdx, isFirst, conv) {
  const isNT = !isT;
  const fwdRow = conv ? `
    <tr class="era-fwd-row">
      <td colspan="4" style="text-align:left;padding-left:8px;font-style:italic;">↪ Forward Balance from ${escHtml(conv.fromStatus||'previous era')}</td>
      <td></td><td></td><td></td><td></td>
      <td class="bc">${h3(conv.fwdBV||0)}</td>
      ${isNT ? `<td class="bc">${h3(conv.fwdBS||0)}</td>` : ''}
      <td></td><td></td>
      ${isNT ? '<td></td><td></td>' : ''}
      ${canEdit ? '<td></td>' : ''}
    </tr>` : '';

  const colsA = isT
    ? `<th class="tha" colspan="4">SET A — Vacation Leave</th>`
    : `<th class="tha" colspan="4">SET A — Vacation Leave</th><th class="thb" colspan="4">SET B — Sick Leave</th>`;

  const subColsA = isT
    ? `<th class="ths tha">Earned</th><th class="ths tha">Abs w/ Pay</th><th class="ths tha">Balance</th><th class="ths tha">W/O Pay</th>`
    : `<th class="ths tha">Earned</th><th class="ths tha">Abs w/ Pay</th><th class="ths tha">Balance</th><th class="ths tha">W/O Pay</th>
       <th class="ths thb">Earned</th><th class="ths thb">Abs w/ Pay</th><th class="ths thb">Balance</th><th class="ths thb">W/O Pay</th>`;

  return `<div class="tw"><table>
    <thead>
      <tr>
        <th rowspan="2">No.</th>
        <th rowspan="2">S.O. No.</th>
        <th rowspan="2">Period</th>
        <th rowspan="2">From</th>
        <th rowspan="2">To</th>
        <th rowspan="2">Spec.</th>
        <th rowspan="2">Action</th>
        ${colsA}
        ${canEdit ? '<th rowspan="2" class="no-print">Act</th>' : ''}
      </tr>
      <tr>${subColsA}</tr>
    </thead>
    <tbody>
      ${fwdRow}
      ${recs.map((r, i) => buildLeaveRow(r, i, isNT, emp, canEdit)).join('')}
    </tbody>
  </table></div>`;
}

function buildLeaveRow(r, idx, isNT, emp, canEdit) {
  const days = calcDays(r);
  const aText = r.action || '';
  const C = classifyLeave(aText);

  let setAE = h3(r.setA_earned||0), setAA = h3(r.setA_abs_wp||0), setAB = h3(r.setA_balance||0), setAW = h3(r.setA_wop||0);
  let setBE = h3(r.setB_earned||0), setBA = h3(r.setB_abs_wp||0), setBB = h3(r.setB_balance||0), setBW = h3(r.setB_wop||0);

  const menuId = `menu_${r._record_id||idx}`;
  const menuHtml = canEdit ? `<td class="no-print">
    <div class="row-menu-wrap">
      <button class="row-menu-btn">⋮</button>
      <div class="row-menu-dd" id="${menuId}">
        <button data-edit-rec="${r._record_id}" data-empid="${escHtml(emp.id)}">✏️ Edit</button>
        <button data-insert-after="${r.sort_order}" data-empid="${escHtml(emp.id)}">➕ Insert Below</button>
        <div class="menu-div"></div>
        <button class="danger" data-del-rec="${r._record_id}" data-empid="${escHtml(emp.id)}">🗑️ Delete</button>
      </div>
    </div>
  </td>` : '';

  const ntCols = isNT ? `<td class="nc">${setBE}</td><td class="nc">${setBA}</td><td class="bc">${setBB}</td><td class="nc ${setBW?'rdc':''}">${setBW}</td>` : '';

  return `<tr>
    <td>${idx+1}</td>
    <td class="nc">${escHtml(r.so||'')}</td>
    <td class="period-cell">${escHtml(r.prd||'')}</td>
    <td class="nc">${fmtD(r.from||'')}</td>
    <td class="nc">${fmtD(r.to||'')}</td>
    <td class="nc">${escHtml(r.spec||'')}</td>
    <td class="remarks-cell">${escHtml(aText)}</td>
    <td class="nc">${setAE}</td><td class="nc">${setAA}</td><td class="bc">${setAB}</td><td class="nc ${setAW?'rdc':''}">${setAW}</td>
    ${ntCols}
    ${menuHtml}
  </tr>`;
}

// ────────────────────────────────────────────────────────────────────────
//  LEAVE ENTRY MODAL
// ────────────────────────────────────────────────────────────────────────
function showLeaveEntryModal(emp, record, editIdx) {
  const isEdit = record !== null && editIdx >= 0;
  const r = record || {};
  const html = `
    <div class="mo open" id="leaveEntryMo">
      <div class="mb sm">
        <div class="mh"><h3>${isEdit ? '✏️ Edit Leave Record' : '➕ Add Leave Record'}</h3><button onclick="closeMo('leaveEntryMo')" style="background:none;border:none;color:white;font-size:18px;cursor:pointer;">✕</button></div>
        <div class="md">
          <div class="ig">
            <div class="f"><label>S.O. No.</label><input id="le_so" value="${escHtml(r.so||'')}"/></div>
            <div class="f"><label>Period</label><input id="le_prd" value="${escHtml(r.prd||'')}"/></div>
            <div class="f"><label>From Date</label>
              <div class="date-wrap"><input id="le_from" class="date-text" type="text" placeholder="MM/DD/YYYY" value="${fmtD(r.from||'')}"/><button class="date-cal-btn" tabindex="-1">📅</button><input class="date-pick-hidden" type="date" tabindex="-1"/></div>
            </div>
            <div class="f"><label>From Period</label><select id="le_fp"><option value="WD">Whole Day</option><option value="AM">AM</option><option value="PM">PM</option></select></div>
            <div class="f"><label>To Date</label>
              <div class="date-wrap"><input id="le_to" class="date-text" type="text" placeholder="MM/DD/YYYY" value="${fmtD(r.to||'')}"/><button class="date-cal-btn" tabindex="-1">📅</button><input class="date-pick-hidden" type="date" tabindex="-1"/></div>
            </div>
            <div class="f"><label>To Period</label><select id="le_tp"><option value="WD">Whole Day</option><option value="AM">AM</option><option value="PM">PM</option></select></div>
            <div class="f" style="grid-column:1/-1;"><label>Action / Leave Type</label><input id="le_action" value="${escHtml(r.action||'')}"/></div>
            <div class="f"><label>Spec.</label><input id="le_spec" value="${escHtml(r.spec||'')}"/></div>
            <div class="f"><label>Earned (days)</label><input id="le_earned" type="number" step="any" value="${r.earned||0}"/></div>
            <div class="f"><label>Force Amount</label><input id="le_force" type="number" step="any" value="${r.forceAmount||0}"/></div>
          </div>
          <div id="le_err" style="color:var(--rd);font-size:11px;margin-top:8px;"></div>
        </div>
        <div class="mf">
          <button class="btn" style="background:#e0e7ef;color:var(--sl);" onclick="closeMo('leaveEntryMo')">Cancel</button>
          <button class="btn b-pri" id="leaveEntrySave">💾 Save</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  const mo = document.getElementById('leaveEntryMo');

  // Set select values
  mo.querySelector('#le_fp').value = r.fromPeriod || 'WD';
  mo.querySelector('#le_tp').value = r.toPeriod || 'WD';

  // Date pickers
  mo.querySelectorAll('.date-wrap').forEach(wrap => {
    const txt = wrap.querySelector('.date-text');
    const picker = wrap.querySelector('.date-pick-hidden');
    txt.addEventListener('input', () => { txt.value = fmtDateInput(txt.value); });
    picker.addEventListener('change', () => {
      if (picker.value) txt.value = fmtD(picker.value);
    });
  });

  document.getElementById('leaveEntrySave').addEventListener('click', async () => {
    const rec = {
      so: mo.querySelector('#le_so').value.trim(),
      prd: mo.querySelector('#le_prd').value.trim(),
      from: toISODate(mo.querySelector('#le_from').value.trim()),
      to: toISODate(mo.querySelector('#le_to').value.trim()),
      fromPeriod: mo.querySelector('#le_fp').value,
      toPeriod: mo.querySelector('#le_tp').value,
      spec: mo.querySelector('#le_spec').value.trim(),
      action: mo.querySelector('#le_action').value.trim(),
      earned: +mo.querySelector('#le_earned').value || 0,
      forceAmount: +mo.querySelector('#le_force').value || 0,
      monAmount:0, monDisAmt:0, monV:0, monS:0, monDV:0, monDS:0, trV:0, trS:0,
    };
    const errEl = document.getElementById('le_err');
    if (!rec.action) { errEl.textContent = 'Action / Leave Type is required.'; return; }

    let apiRes;
    if (isEdit) {
      apiRes = await apiCall('update_record', { employee_id: emp.id, record_id: record._record_id, record: rec });
    } else {
      apiRes = await apiCall('save_record', { employee_id: emp.id, record: rec });
    }
    if (!apiRes.ok) { errEl.textContent = apiRes.error; return; }

    closeMo('leaveEntryMo');
    const updated = await ensureRecords(emp.id);
    const res2 = await apiCall('get_records', { employee_id: emp.id }, 'GET');
    if (res2.ok) { emp.records = res2.records || []; }
    await saveRowBalances(emp.records, emp.id, emp.status);
    const res3 = await apiCall('get_records', { employee_id: emp.id }, 'GET');
    if (res3.ok) emp.records = res3.records || [];
    renderLeaveCardTable(emp);
  });

  // Wire row menu edit/delete/insert after render
  mo.querySelector('#leaveEntryMo') && wireRowMenus(emp);
}

function wireRowMenus(emp) {
  const wrap = document.getElementById('lcTableWrap');
  if (!wrap) return;
  wrap.querySelectorAll('[data-edit-rec]').forEach(btn => {
    btn.addEventListener('click', async () => {
      closeAllMenus();
      const rid = +btn.dataset.editRec;
      const rec = emp.records.find(r => r._record_id === rid);
      if (rec) showLeaveEntryModal(emp, rec, emp.records.indexOf(rec));
    });
  });
  wrap.querySelectorAll('[data-del-rec]').forEach(btn => {
    btn.addEventListener('click', async () => {
      closeAllMenus();
      if (!confirm('Delete this leave record?')) return;
      const rid = +btn.dataset.delRec;
      const res = await apiCall('delete_record', { record_id: rid, employee_id: emp.id });
      if (!res.ok) { alert(res.error); return; }
      emp.records = emp.records.filter(r => r._record_id !== rid);
      await saveRowBalances(emp.records, emp.id, emp.status);
      const res2 = await apiCall('get_records', { employee_id: emp.id }, 'GET');
      if (res2.ok) emp.records = res2.records || [];
      renderLeaveCardTable(emp);
    });
  });
  wrap.querySelectorAll('[data-insert-after]').forEach(btn => {
    btn.addEventListener('click', async () => {
      closeAllMenus();
      const afterSort = +btn.dataset.insertAfter;
      const blankRec = { so:'', prd:'', from:'', to:'', fromPeriod:'WD', toPeriod:'WD', spec:'', action:'', earned:0, forceAmount:0, monAmount:0, monDisAmt:0, monV:0, monS:0, monDV:0, monDS:0, trV:0, trS:0 };
      showLeaveEntryModal(emp, null, -1);
      // Override save to use insert_record_at
      const saveBtn = document.getElementById('leaveEntrySave');
      if (saveBtn) {
        const oldClick = saveBtn.onclick;
        saveBtn.onclick = null;
        saveBtn.addEventListener('click', async () => {
          const mo = document.getElementById('leaveEntryMo');
          const rec = {
            so: mo.querySelector('#le_so').value.trim(),
            prd: mo.querySelector('#le_prd').value.trim(),
            from: toISODate(mo.querySelector('#le_from').value.trim()),
            to: toISODate(mo.querySelector('#le_to').value.trim()),
            fromPeriod: mo.querySelector('#le_fp').value,
            toPeriod: mo.querySelector('#le_tp').value,
            spec: mo.querySelector('#le_spec').value.trim(),
            action: mo.querySelector('#le_action').value.trim(),
            earned: +mo.querySelector('#le_earned').value || 0,
            forceAmount: +mo.querySelector('#le_force').value || 0,
            monAmount:0, monDisAmt:0, monV:0, monS:0, monDV:0, monDS:0, trV:0, trS:0,
          };
          if (!rec.action) { document.getElementById('le_err').textContent = 'Action is required.'; return; }
          const res = await apiCall('insert_record_at', { employee_id: emp.id, record: rec, after_sort_order: afterSort });
          if (!res.ok) { document.getElementById('le_err').textContent = res.error; return; }
          closeMo('leaveEntryMo');
          const res2 = await apiCall('get_records', { employee_id: emp.id }, 'GET');
          if (res2.ok) emp.records = res2.records || [];
          await saveRowBalances(emp.records, emp.id, emp.status);
          const res3 = await apiCall('get_records', { employee_id: emp.id }, 'GET');
          if (res3.ok) emp.records = res3.records || [];
          renderLeaveCardTable(emp);
        }, { once: true });
      }
    });
  });
}

// ────────────────────────────────────────────────────────────────────────
//  ERA MODAL
// ────────────────────────────────────────────────────────────────────────
function showEraModal(emp) {
  const html = `
    <div class="mo open" id="eraMo">
      <div class="mb xsm">
        <div class="mh"><h3>🔄 Add Conversion Era</h3><button onclick="closeMo('eraMo')" style="background:none;border:none;color:white;font-size:18px;cursor:pointer;">✕</button></div>
        <div class="md">
          <div class="f" style="margin-bottom:12px;"><label>From Status</label><select id="era_from"><option value="Teaching">Teaching</option><option value="Non-Teaching">Non-Teaching</option><option value="Teaching Related">Teaching Related</option></select></div>
          <div class="f" style="margin-bottom:12px;"><label>To Status</label><select id="era_to"><option value="Non-Teaching">Non-Teaching</option><option value="Teaching">Teaching</option><option value="Teaching Related">Teaching Related</option></select></div>
          <div class="f" style="margin-bottom:12px;"><label>Conversion Date</label><input id="era_date" type="date"/></div>
          <div class="f"><label>Forward VL Balance</label><input id="era_bv" type="number" step="any" value="0"/></div>
          <div class="f"><label>Forward SL Balance</label><input id="era_bs" type="number" step="any" value="0"/></div>
          <div id="era_err" style="color:var(--rd);font-size:11px;margin-top:8px;"></div>
        </div>
        <div class="mf">
          <button class="btn" style="background:#e0e7ef;color:var(--sl);" onclick="closeMo('eraMo')">Cancel</button>
          <button class="btn b-pri" id="eraModSave">💾 Add Era</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  document.getElementById('eraModSave').addEventListener('click', async () => {
    const fromS = document.getElementById('era_from').value;
    const toS = document.getElementById('era_to').value;
    const date = document.getElementById('era_date').value;
    const bv = +document.getElementById('era_bv').value || 0;
    const bs = +document.getElementById('era_bs').value || 0;
    const rec = { _conversion: true, fromStatus: fromS, toStatus: toS, date, fwdBV: bv, fwdBS: bs, so:'', prd:'', from:'', to:'', spec:'', action:'Conversion', earned:0, forceAmount:0, monAmount:0, monDisAmt:0, monV:0, monS:0, monDV:0, monDS:0, trV:0, trS:0 };
    const res = await apiCall('save_record', { employee_id: emp.id, record: rec });
    if (!res.ok) { document.getElementById('era_err').textContent = res.error; return; }
    closeMo('eraMo');
    const res2 = await apiCall('get_records', { employee_id: emp.id }, 'GET');
    if (res2.ok) emp.records = res2.records || [];
    renderLeaveCardTable(emp);
  });
}

// ────────────────────────────────────────────────────────────────────────
//  NT / T CARD PAGES
// ────────────────────────────────────────────────────────────────────────
function renderNTPage() {
  renderCategoryPage('nt', 'Non-Teaching', '📊 Non-Teaching Leave Cards');
}
function renderTPage() {
  renderCategoryPage('t', 'Teaching', '🏫 Teaching Leave Cards');
}

function renderCategoryPage(pageId, category, title) {
  const el = document.getElementById('pg-' + pageId);
  el.innerHTML = `
    <div class="card">
      <div class="ch grn">${title}</div>
      <div class="toolbar">
        <div class="toolbar-left">
          <div class="srch"><span class="sri">🔍</span><input id="${pageId}Search" type="text" placeholder="Search…"/></div>
        </div>
      </div>
      <div class="tw"><table>
        <thead><tr><th>No.</th><th>Employee ID</th><th>Name</th><th>Position</th><th>School</th><th>Last Updated</th><th class="no-print">Actions</th></tr></thead>
        <tbody id="${pageId}Body"></tbody>
      </table></div>
    </div>
    <div id="${pageId}CardView"></div>`;

  const filtered = state.db.filter(e => e.status === category && e.account_status !== 'inactive');
  const body = document.getElementById(pageId + 'Body');
  body.innerHTML = filtered.map((e, i) => `
    <tr>
      <td>${i+1}</td>
      <td><strong>${escHtml(e.id)}</strong></td>
      <td style="text-align:left;"><strong>${escHtml(e.surname)}</strong>, ${escHtml(e.given)}</td>
      <td style="text-align:left;">${escHtml(e.pos||'')}</td>
      <td style="text-align:left;">${escHtml(e.school||'')}</td>
      <td style="font-size:10.5px;color:var(--mu);">${e.lastEditedAt ? new Date(e.lastEditedAt).toLocaleDateString() : '—'}</td>
      <td class="no-print"><button class="btn b-pri b-sm" data-opencard="${escHtml(e.id)}" data-pageid="${pageId}">📋 Open Card</button></td>
    </tr>`).join('');

  body.querySelectorAll('[data-opencard]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const emp = await ensureRecords(btn.dataset.opencard);
      if (emp) {
        const container = document.getElementById(pageId + 'CardView');
        state.curId = emp.id;
        // Render card into container
        await openLeaveCardInContainer(emp, container);
      }
    });
  });

  document.getElementById(pageId + 'Search').addEventListener('input', function() {
    const q = this.value.toLowerCase();
    body.querySelectorAll('tr').forEach((tr, i) => {
      const text = tr.textContent.toLowerCase();
      tr.style.display = (!q || text.includes(q)) ? '' : 'none';
    });
  });
}

async function openLeaveCardInContainer(emp, container) {
  if (!emp.records || emp.records.length === 0) {
    const res = await apiCall('get_records', { employee_id: emp.id }, 'GET');
    if (res.ok) emp.records = res.records || [];
  }
  const canEdit = state.isAdmin || state.isEncoder;
  const profileHtml = `<div class="cb"><div class="pg">
    ${profileField('Employee No.', emp.id)}
    ${profileField('Full Name', `${emp.surname}, ${emp.given} ${emp.suffix||''}`)}
    ${profileField('Category', emp.status||'')}
    ${profileField('School', emp.school||'')}
  </div></div>`;

  container.innerHTML = `<div class="card" style="margin-top:20px;">
    <div class="ch grn" style="justify-content:space-between;">
      <span>📋 ${escHtml(emp.surname)}, ${escHtml(emp.given)}</span>
      <div style="display:flex;gap:8px;" class="no-print">
        ${canEdit?`<button class="btn b-sm" style="background:rgba(255,255,255,.15);color:white;border:1px solid rgba(255,255,255,.3);" id="cAddRec">➕ Add Record</button>`:''}
        <button class="btn b-sm" style="background:rgba(255,255,255,.15);color:white;border:1px solid rgba(255,255,255,.3);" onclick="window.print()">🖨️ Print</button>
      </div>
    </div>
    ${profileHtml}
    <div id="lcTableWrap"></div>
  </div>`;

  renderLeaveCardTable(emp);
  document.getElementById('cAddRec')?.addEventListener('click', () => showLeaveEntryModal(emp, null, -1));
  wireRowMenus(emp);
}

// ────────────────────────────────────────────────────────────────────────
//  REGISTER / EDIT EMPLOYEE MODAL
// ────────────────────────────────────────────────────────────────────────
function showRegisterModal(emp) {
  const isEdit = !!emp;
  const r = emp || {};
  const html = `
    <div class="mo open" id="registerMo">
      <div class="mb">
        <div class="mh"><h3>${isEdit?'✏️ Edit Employee':'➕ Register Employee'}</h3><button onclick="closeMo('registerMo')" style="background:none;border:none;color:white;font-size:18px;cursor:pointer;">✕</button></div>
        <div class="md">
          <div class="sdiv">👤 Personal Information</div>
          <div class="ig">
            <div class="f hl"><label>Employee No. *</label><input id="reg_id" value="${escHtml(r.id||'')}" placeholder="7 digits"/></div>
            <div class="f"><label>Surname *</label><input id="reg_surname" value="${escHtml(r.surname||'')}"/></div>
            <div class="f"><label>Given Name *</label><input id="reg_given" value="${escHtml(r.given||'')}"/></div>
            <div class="f"><label>Suffix</label><input id="reg_suffix" value="${escHtml(r.suffix||'')}"/></div>
            <div class="f"><label>Maternal Name</label><input id="reg_maternal" value="${escHtml(r.maternal||'')}"/></div>
            <div class="f"><label>Sex *</label><select id="reg_sex"><option value="">—</option><option value="Male">Male</option><option value="Female">Female</option></select></div>
            <div class="f"><label>Civil Status</label><input id="reg_civil" value="${escHtml(r.civil||'')}"/></div>
            <div class="f"><label>Date of Birth *</label><input id="reg_dob" type="date" value="${r.dob||''}"/></div>
            <div class="f"><label>Place of Birth</label><input id="reg_pob" value="${escHtml(r.pob||'')}"/></div>
          </div>
          <div class="sdiv">🏢 Employment Details</div>
          <div class="ig">
            <div class="f"><label>Category *</label><select id="reg_status"><option value="Teaching">Teaching</option><option value="Non-Teaching">Non-Teaching</option><option value="Teaching Related">Teaching Related</option></select></div>
            <div class="f"><label>Account Status</label><select id="reg_accstatus"><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
            <div class="f"><label>Position *</label><input id="reg_pos" value="${escHtml(r.pos||'')}"/></div>
            <div class="f"><label>School / Office *</label><input id="reg_school" value="${escHtml(r.school||'')}"/></div>
            <div class="f"><label>Date of Appointment</label><input id="reg_appt" type="date" value="${r.appt||''}"/></div>
            <div class="f"><label>TIN</label><input id="reg_tin" value="${escHtml(r.tin||'')}"/></div>
            <div class="f"><label>Rating</label><input id="reg_rating" value="${escHtml(r.rating||'')}"/></div>
          </div>
          <div class="sdiv">🎓 Education & Eligibility</div>
          <div class="ig">
            <div class="f"><label>Highest Education</label><input id="reg_edu" value="${escHtml(r.edu||'')}"/></div>
            <div class="f"><label>Eligibility</label><input id="reg_elig" value="${escHtml(r.elig||'')}"/></div>
            <div class="f"><label>Professional Exam</label><input id="reg_pexam" value="${escHtml(r.pexam||'')}"/></div>
            <div class="f"><label>Date of Exam</label><input id="reg_dexam" type="date" value="${r.dexam||''}"/></div>
          </div>
          <div class="sdiv">📍 Contact Information</div>
          <div class="ig">
            <div class="f" style="grid-column:1/-1;"><label>Present Address *</label><input id="reg_addr" value="${escHtml(r.addr||'')}"/></div>
            <div class="f"><label>Spouse Name</label><input id="reg_spouse" value="${escHtml(r.spouse||'')}"/></div>
          </div>
          <div class="sdiv">🔐 Login Credentials</div>
          <div class="ig">
            <div class="f"><label>Email (@deped.gov.ph) *</label><input id="reg_email" type="email" value="${escHtml(r.email||'')}"/></div>
            <div class="f ew"><label>Password ${isEdit?'(leave blank to keep)':'*'}</label><input id="reg_pw" type="password"/><button class="eye-btn" tabindex="-1">👁</button></div>
          </div>
          <div id="reg_err" style="color:var(--rd);font-size:11px;margin-top:8px;"></div>
        </div>
        <div class="mf">
          <button class="btn" style="background:#e0e7ef;color:var(--sl);" onclick="closeMo('registerMo')">Cancel</button>
          <button class="btn b-pri" id="regSave">💾 ${isEdit?'Update':'Register'}</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  const mo = document.getElementById('registerMo');
  mo.querySelector('#reg_sex').value = r.sex || '';
  mo.querySelector('#reg_status').value = r.status || 'Teaching';
  mo.querySelector('#reg_accstatus').value = r.account_status || 'active';
  mo.querySelector('.eye-btn').addEventListener('click', () => {
    const pw = mo.querySelector('#reg_pw');
    pw.type = pw.type === 'password' ? 'text' : 'password';
  });
  document.getElementById('regSave').addEventListener('click', async () => {
    const body = {
      originalId: isEdit ? r.id : '',
      id:           mo.querySelector('#reg_id').value.trim(),
      surname:      mo.querySelector('#reg_surname').value.trim(),
      given:        mo.querySelector('#reg_given').value.trim(),
      suffix:       mo.querySelector('#reg_suffix').value.trim(),
      maternal:     mo.querySelector('#reg_maternal').value.trim(),
      sex:          mo.querySelector('#reg_sex').value,
      civil:        mo.querySelector('#reg_civil').value.trim(),
      dob:          mo.querySelector('#reg_dob').value,
      pob:          mo.querySelector('#reg_pob').value.trim(),
      addr:         mo.querySelector('#reg_addr').value.trim(),
      spouse:       mo.querySelector('#reg_spouse').value.trim(),
      edu:          mo.querySelector('#reg_edu').value.trim(),
      elig:         mo.querySelector('#reg_elig').value.trim(),
      rating:       mo.querySelector('#reg_rating').value.trim(),
      tin:          mo.querySelector('#reg_tin').value.trim(),
      pexam:        mo.querySelector('#reg_pexam').value.trim(),
      dexam:        mo.querySelector('#reg_dexam').value,
      appt:         mo.querySelector('#reg_appt').value,
      status:       mo.querySelector('#reg_status').value,
      account_status: mo.querySelector('#reg_accstatus').value,
      pos:          mo.querySelector('#reg_pos').value.trim(),
      school:       mo.querySelector('#reg_school').value.trim(),
      email:        mo.querySelector('#reg_email').value.trim().toLowerCase(),
      password:     mo.querySelector('#reg_pw').value,
    };
    const res = await apiCall('save_employee', body);
    if (!res.ok) { document.getElementById('reg_err').textContent = res.error; return; }
    closeMo('registerMo');
    if (isEdit) {
      const idx = state.db.findIndex(e => e.id === r.id);
      if (idx >= 0) {
        state.db[idx] = { ...state.db[idx], ...body, id: body.id, records: state.db[idx].records || [] };
      }
    } else {
      state.db.push({ ...body, records: [], conversionLog: [] });
    }
    filterPersonnelTable();
    alert(isEdit ? 'Employee updated!' : 'Employee registered!');
  });
}

// ────────────────────────────────────────────────────────────────────────
//  SCHOOL ADMIN PAGE
// ────────────────────────────────────────────────────────────────────────
async function renderSchoolAdminPage() {
  const el = document.getElementById('pg-sa');
  el.innerHTML = `<div class="card"><div class="ch navy">🏢 School Admin Management</div><div class="cb" id="saContent"><p style="color:var(--mu);">Loading…</p></div></div>`;
  const res = await apiCall('get_school_admins', {}, 'GET');
  const saList = res.school_admins || [];
  const content = document.getElementById('saContent');
  content.innerHTML = `
    <div style="margin-bottom:14px;"><button class="btn b-pri" id="addSABtn">➕ Add School Admin</button></div>
    <div class="tw"><table>
      <thead><tr><th>ID</th><th>Login Email</th><th>Name</th><th class="no-print">Actions</th></tr></thead>
      <tbody id="saBody">${saList.map(sa=>`
        <tr>
          <td>${sa.id}</td>
          <td>${escHtml(sa.login_id)}</td>
          <td>${escHtml(sa.name)}</td>
          <td class="no-print">
            <button class="btn b-slt b-sm" data-editsa="${sa.id}">✏️ Edit</button>
            <button class="btn b-red b-sm" data-delsa="${sa.id}">🗑️ Delete</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;

  document.getElementById('addSABtn').addEventListener('click', () => showSAEditModal(null));
  content.querySelectorAll('[data-editsa]').forEach(btn => {
    btn.addEventListener('click', () => {
      const sa = saList.find(s => s.id == btn.dataset.editsa);
      showSAEditModal(sa);
    });
  });
  content.querySelectorAll('[data-delsa]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this School Admin account?')) return;
      const res = await apiCall('delete_school_admin', { sa_id: +btn.dataset.delsa });
      if (!res.ok) { alert(res.error); return; }
      renderSchoolAdminPage();
    });
  });
}

function showSAEditModal(sa) {
  const isEdit = !!sa;
  const html = `
    <div class="mo open" id="saMo">
      <div class="mb xsm">
        <div class="mh"><h3>${isEdit?'✏️ Edit':'➕ Add'} School Admin</h3><button onclick="closeMo('saMo')" style="background:none;border:none;color:white;font-size:18px;cursor:pointer;">✕</button></div>
        <div class="md">
          <div class="f" style="margin-bottom:12px;"><label>Display Name *</label><input id="sa_name" value="${escHtml(sa?.name||'')}"/></div>
          <div class="f" style="margin-bottom:12px;"><label>Login Email (@deped.gov.ph) *</label><input id="sa_email" value="${escHtml(sa?.login_id||'')}"/></div>
          <div class="f ew" style="margin-bottom:12px;"><label>Password ${isEdit?'(blank=unchanged)':'*'}</label><input id="sa_pw" type="password"/><button class="eye-btn" tabindex="-1">👁</button></div>
          <div id="sa_err" style="color:var(--rd);font-size:11px;"></div>
        </div>
        <div class="mf">
          <button class="btn" style="background:#e0e7ef;color:var(--sl);" onclick="closeMo('saMo')">Cancel</button>
          <button class="btn b-pri" id="saSave">💾 Save</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  document.querySelector('#saMo .eye-btn').addEventListener('click', () => {
    const pw = document.getElementById('sa_pw');
    pw.type = pw.type === 'password' ? 'text' : 'password';
  });
  document.getElementById('saSave').addEventListener('click', async () => {
    const body = { sa_id: sa?.id || 0, name: document.getElementById('sa_name').value.trim(), login_id: document.getElementById('sa_email').value.trim().toLowerCase(), password: document.getElementById('sa_pw').value };
    const res = await apiCall('save_school_admin', body);
    if (!res.ok) { document.getElementById('sa_err').textContent = res.error; return; }
    closeMo('saMo');
    renderSchoolAdminPage();
  });
}

// ────────────────────────────────────────────────────────────────────────
//  PROFILE MODALS
// ────────────────────────────────────────────────────────────────────────
async function showAdminProfileModal() {
  const res = await apiCall('get_admin_cfg', { role: 'admin' }, 'GET');
  const enc = await apiCall('get_admin_cfg', { role: 'encoder' }, 'GET');
  const accounts = res.accounts || [];
  const encAccounts = enc.accounts || [];

  const html = `
    <div class="mo open" id="adminProfMo">
      <div class="mb">
        <div class="mh"><h3>👤 Admin / Encoder Management</h3><button onclick="closeMo('adminProfMo')" style="background:none;border:none;color:white;font-size:18px;cursor:pointer;">✕</button></div>
        <div class="md">
          <div class="sdiv">🔴 Admin Accounts</div>
          <div id="adminAccList">${renderAccountList(accounts, 'admin')}</div>
          <button class="btn b-pri b-sm" style="margin-top:8px;" id="addAdminBtn">➕ Add Admin</button>
          <div class="sdiv" style="margin-top:20px;">🟡 Encoder Accounts</div>
          <div id="encAccList">${renderAccountList(encAccounts, 'encoder')}</div>
          <button class="btn b-amb b-sm" style="margin-top:8px;" id="addEncBtn">➕ Add Encoder</button>
        </div>
        <div class="mf"><button class="btn" style="background:#e0e7ef;color:var(--sl);" onclick="closeMo('adminProfMo')">Close</button></div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  document.getElementById('addAdminBtn').addEventListener('click', () => showAccountEditModal(null, 'admin', 'adminProfMo'));
  document.getElementById('addEncBtn').addEventListener('click', () => showAccountEditModal(null, 'encoder', 'adminProfMo'));
  bindAccountListActions('adminProfMo');
}

function renderAccountList(accounts, role) {
  if (!accounts.length) return `<p style="color:var(--mu);font-size:12px;">No accounts.</p>`;
  return `<table style="width:100%;font-size:12px;border-collapse:collapse;">
    <thead><tr style="background:var(--dv)"><th style="padding:6px;text-align:left;">Name</th><th style="padding:6px;text-align:left;">Login Email</th><th style="padding:6px;text-align:right;" class="no-print">Actions</th></tr></thead>
    <tbody>${accounts.map(a=>`<tr style="border-bottom:1px solid var(--dv);">
      <td style="padding:6px;">${escHtml(a.name)}</td>
      <td style="padding:6px;">${escHtml(a.login_id)}</td>
      <td style="padding:6px;text-align:right;" class="no-print">
        <button class="btn b-slt b-sm" data-editacc="${a.id}" data-role="${role}">✏️</button>
        <button class="btn b-red b-sm" data-delacc="${a.id}" data-role="${role}">🗑️</button>
      </td>
    </tr>`).join('')}</tbody>
  </table>`;
}

function bindAccountListActions(moId) {
  const mo = document.getElementById(moId);
  mo.querySelectorAll('[data-editacc]').forEach(btn => {
    btn.addEventListener('click', () => showAccountEditModal({ id: +btn.dataset.editacc }, btn.dataset.role, moId));
  });
  mo.querySelectorAll('[data-delacc]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this account?')) return;
      const res = await apiCall('save_admin', { _delete: true, account_id: +btn.dataset.delacc, role: btn.dataset.role });
      if (!res.ok) { alert(res.error); return; }
      closeMo(moId);
      showAdminProfileModal();
    });
  });
}

function showAccountEditModal(acc, role, parentMoId) {
  const isEdit = !!(acc && acc.id);
  const html = `
    <div class="mo open" id="accEditMo" style="z-index:600;">
      <div class="mb xsm">
        <div class="mh"><h3>${isEdit?'✏️ Edit':'➕ Add'} ${role === 'admin' ? 'Admin' : 'Encoder'}</h3><button onclick="closeMo('accEditMo')" style="background:none;border:none;color:white;font-size:18px;cursor:pointer;">✕</button></div>
        <div class="md">
          <div class="f" style="margin-bottom:12px;"><label>Full Name *</label><input id="acc_name"/></div>
          <div class="f" style="margin-bottom:12px;"><label>Login Email (@deped.gov.ph) *</label><input id="acc_email"/></div>
          <div class="f ew"><label>Password ${isEdit?'(blank=unchanged)':'*'}</label><input id="acc_pw" type="password"/><button class="eye-btn" tabindex="-1">👁</button></div>
          <div id="acc_err" style="color:var(--rd);font-size:11px;margin-top:8px;"></div>
        </div>
        <div class="mf">
          <button class="btn" style="background:#e0e7ef;color:var(--sl);" onclick="closeMo('accEditMo')">Cancel</button>
          <button class="btn b-pri" id="accSave">💾 Save</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  document.querySelector('#accEditMo .eye-btn').addEventListener('click', () => {
    const pw = document.getElementById('acc_pw');
    pw.type = pw.type === 'password' ? 'text' : 'password';
  });
  document.getElementById('accSave').addEventListener('click', async () => {
    const body = { role, account_id: acc?.id || 0, name: document.getElementById('acc_name').value.trim(), login_id: document.getElementById('acc_email').value.trim().toLowerCase(), password: document.getElementById('acc_pw').value };
    const res = await apiCall('save_admin', body);
    if (!res.ok) { document.getElementById('acc_err').textContent = res.error; return; }
    closeMo('accEditMo');
    closeMo(parentMoId);
    showAdminProfileModal();
  });
}

async function showEncoderProfileModal() {
  const res = await apiCall('get_admin_cfg', { role: 'encoder' }, 'GET');
  const accounts = res.accounts || [];
  const me = accounts.find(a => a.login_id === state.encoderCfg.id) || accounts[0];
  const html = `
    <div class="mo open" id="encProfMo">
      <div class="mb xsm">
        <div class="mh"><h3>👤 Encoder Profile</h3><button onclick="closeMo('encProfMo')" style="background:none;border:none;color:white;font-size:18px;cursor:pointer;">✕</button></div>
        <div class="md">
          <div class="f" style="margin-bottom:12px;"><label>Display Name</label><input id="enc_name" value="${escHtml(me?.name||state.encoderCfg.name||'')}"/></div>
          <div id="enc_err" style="color:var(--rd);font-size:11px;"></div>
        </div>
        <div class="mf">
          <button class="btn" style="background:#e0e7ef;color:var(--sl);" onclick="closeMo('encProfMo')">Cancel</button>
          <button class="btn b-pri" id="encSave">💾 Save</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  document.getElementById('encSave').addEventListener('click', async () => {
    const name = document.getElementById('enc_name').value.trim();
    const res = await apiCall('save_encoder', { name });
    if (!res.ok) { document.getElementById('enc_err').textContent = res.error; return; }
    state.encoderCfg.name = name;
    closeMo('encProfMo');
    renderTopbar();
  });
}

async function showSAProfileModal() {
  const html = `
    <div class="mo open" id="saProfMo">
      <div class="mb xsm">
        <div class="mh"><h3>👤 School Admin Profile</h3><button onclick="closeMo('saProfMo')" style="background:none;border:none;color:white;font-size:18px;cursor:pointer;">✕</button></div>
        <div class="md">
          <div class="f" style="margin-bottom:12px;"><label>Display Name</label><input id="sap_name" value="${escHtml(state.schoolAdminCfg.name||'')}"/></div>
          <div id="sap_err" style="color:var(--rd);font-size:11px;"></div>
        </div>
        <div class="mf">
          <button class="btn" style="background:#e0e7ef;color:var(--sl);" onclick="closeMo('saProfMo')">Cancel</button>
          <button class="btn b-pri" id="sapSave">💾 Save</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  document.getElementById('sapSave').addEventListener('click', async () => {
    const name = document.getElementById('sap_name').value.trim();
    const res = await apiCall('save_school_admin', { sa_id: state.schoolAdminCfg.dbId, name, login_id: state.schoolAdminCfg.id, password: '' });
    if (!res.ok) { document.getElementById('sap_err').textContent = res.error; return; }
    state.schoolAdminCfg.name = name;
    closeMo('saProfMo');
    renderTopbar();
  });
}

// ────────────────────────────────────────────────────────────────────────
//  USER PAGE (Employee self-view)
// ────────────────────────────────────────────────────────────────────────
async function renderUserPage() {
  const el = document.getElementById('pg-user');
  el.innerHTML = `<div style="text-align:center;padding:40px;color:var(--mu);">Loading your leave card…</div>`;
  const emp = await ensureRecords(state.curId);
  if (!emp) { el.innerHTML = `<p style="color:var(--rd);">Employee not found.</p>`; return; }

  el.innerHTML = `<div class="card">
    <div class="ch grn">🪪 My Leave Card — ${escHtml(emp.surname)}, ${escHtml(emp.given)}</div>
    <div class="cb"><div class="pg">
      ${profileField('Employee No.', emp.id)}
      ${profileField('Full Name', `${emp.surname}, ${emp.given} ${emp.suffix||''}`)}
      ${profileField('Category', emp.status||'')}
      ${profileField('Position', emp.pos||'')}
      ${profileField('School / Office', emp.school||'')}
      ${profileField('Email', emp.email||'')}
    </div></div>
    <div class="ch amber" style="justify-content:space-between;">
      <span>📋 Leave Records</span>
      <button class="btn b-sm" style="background:rgba(255,255,255,.15);color:white;border:1px solid rgba(255,255,255,.3);" onclick="window.print()">🖨️ Print</button>
    </div>
    <div id="userLCWrap"></div>
  </div>`;

  // Readonly card table
  const tempWrap = { innerHTML: '' };
  const records = emp.records || [];
  const isT = (emp.status||'').toLowerCase() === 'teaching';
  const segments = [];
  let cur = { conv: null, recs: [] };
  for (const r of records) {
    if (r._conversion) { segments.push(cur); cur = { conv: r, recs: [] }; }
    else cur.recs.push(r);
  }
  segments.push(cur);

  let html = '';
  segments.forEach((seg, si) => {
    const eraStatus = seg.conv ? seg.conv.toStatus : (si === 0 ? emp.status : '');
    const segIsT = (eraStatus||'').toLowerCase() === 'teaching';
    if (seg.conv) {
      html += `<div style="padding:8px 20px;background:var(--au2);border-top:2px solid var(--au);">
        <span style="font-size:11.5px;font-weight:700;color:var(--au);">🔄 Era: ${escHtml(seg.conv.fromStatus||'')} → ${escHtml(seg.conv.toStatus||'')}</span>
      </div>`;
    }
    html += buildTableForSegment(seg.recs, segIsT, emp, false, si, si===0, seg.conv);
  });
  document.getElementById('userLCWrap').innerHTML = html;
}

// ────────────────────────────────────────────────────────────────────────
//  LOGOUT MODAL
// ────────────────────────────────────────────────────────────────────────
function showLogoutModal() {
  const html = `
    <div class="mo open" id="logoutMo">
      <div class="mb xsm">
        <div class="mh"><h3>🚪 Logout</h3><button onclick="closeMo('logoutMo')" style="background:none;border:none;color:white;font-size:18px;cursor:pointer;">✕</button></div>
        <div class="md" style="text-align:center;padding:28px;">
          <div style="font-size:40px;margin-bottom:14px;">👋</div>
          <p style="font-size:14px;margin-bottom:8px;">Are you sure you want to logout?</p>
          <p style="font-size:11px;color:var(--mu);">You will be returned to the login screen.</p>
        </div>
        <div class="mf">
          <button class="btn" style="background:#e0e7ef;color:var(--sl);" onclick="closeMo('logoutMo')">Cancel</button>
          <button class="btn b-red" id="confirmLogout">🚪 Logout</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  document.getElementById('confirmLogout').addEventListener('click', () => {
    closeMo('logoutMo');
    doLogout();
  });
}

function doLogout() {
  Object.assign(state, {
    db: [], role: null, isAdmin: false, isEncoder: false, isSchoolAdmin: false,
    curId: null, page: 'home',
    adminCfg: { id: '', password: '', name: 'Administrator' },
    encoderCfg: { id: '', password: '', name: 'Encoder' },
    schoolAdminCfg: { id: '', dbId: 0, name: 'School Admin' },
  });
  showScreen('login');
  document.getElementById('loginForm')?.reset();
  document.getElementById('loginErr').style.display = 'none';
}

// ────────────────────────────────────────────────────────────────────────
//  UTILITIES
// ────────────────────────────────────────────────────────────────────────
function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function closeMo(id) {
  document.getElementById(id)?.remove();
}

// ────────────────────────────────────────────────────────────────────────
//  INIT
// ────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Overlay for sidebar
  document.getElementById('sbOverlay')?.addEventListener('click', closeSidebar);
  initLogin();
  showScreen('login');

  // After leave card table renders, wire up row menus
  document.addEventListener('click', e => {
    // Close menus when clicking outside
    if (!e.target.closest('.row-menu-wrap')) closeAllMenus();
  });
});
