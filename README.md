# SDO City of Koronadal — Leave Management System
## Next.js 14 + TypeScript Conversion

---

## Project Structure

```
deped-lms/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout (fonts, scripts)
│   │   ├── page.tsx                # Entry point → AppProvider + App
│   │   ├── globals.css             # All styles (from style.css)
│   │   └── api/                   # Next.js API Route Handlers (replaces api.php)
│   │       ├── login/route.ts
│   │       ├── get_personnel/route.ts
│   │       ├── save_employee/route.ts
│   │       ├── archive/route.ts
│   │       ├── unarchive/route.ts
│   │       ├── get_records/route.ts
│   │       ├── save_record/route.ts
│   │       ├── update_record/route.ts
│   │       ├── delete_record/route.ts
│   │       ├── delete_era/route.ts
│   │       ├── reorder_records/route.ts
│   │       ├── save_row_balance/route.ts
│   │       ├── save_admin/route.ts
│   │       ├── save_encoder/route.ts
│   │       ├── get_admin_cfg/route.ts
│   │       ├── get_school_admins/route.ts
│   │       ├── save_school_admin/route.ts
│   │       └── delete_school_admin/route.ts
│   ├── types/
│   │   └── index.ts               # All TypeScript interfaces
│   ├── lib/
│   │   ├── api.ts                 # API helper + all leave logic utilities
│   │   ├── db.ts                  # MySQL connection pool + schema migration
│   │   └── recordToRow.ts        # DB ↔ JS record converters
│   ├── hooks/
│   │   └── useAppStore.ts        # Global state (useReducer + Context)
│   └── components/
│       ├── AppProvider.tsx        # Context provider wrapper
│       ├── App.tsx                # Root component, session restore
│       ├── AppScreen.tsx          # Dashboard layout + page routing
│       ├── LoginScreen.tsx        # Login page
│       ├── Navigation.tsx         # Topbar + Sidebar
│       ├── StatsRow.tsx           # StatBox + helpers
│       ├── pages/
│       │   ├── PersonnelListPage.tsx
│       │   ├── LeaveCardsPage.tsx  # With monthly NT accrual button
│       │   ├── SchoolAdminPage.tsx
│       │   ├── NTCardPage.tsx      # Non-Teaching leave card
│       │   ├── TCardPage.tsx       # Teaching leave card
│       │   └── UserPage.tsx        # Employee read-only view
│       ├── modals/
│       │   ├── RegisterModal.tsx   # Personnel registration/edit
│       │   ├── AdminProfileModal.tsx # Admin+Encoder+SchoolAdmin settings
│       │   ├── EncoderProfileModal.tsx
│       │   ├── SAProfileModal.tsx
│       │   ├── LogoutModal.tsx
│       │   └── CardStatusModal.tsx
│       └── leavecard/
│           ├── LeaveCardTable.tsx  # Row computation + table headers + ProfileBlock
│           ├── LeaveEntryForm.tsx  # Shared entry form (NT + Teaching)
│           └── EraSection.tsx     # Collapsible past era sections
├── .env.local.example
├── package.json
├── tsconfig.json
└── next.config.js
```

---

## Setup Instructions

### 1. Install dependencies

```bash
cd deped-lms
npm install
npm install mysql2        # MySQL driver
```

### 2. Configure database

```bash
cp .env.local.example .env.local
# Edit .env.local with your MySQL credentials
```

Your `.env.local`:
```
DB_HOST=localhost
DB_NAME=mydatabase
DB_USER=root
DB_PASSWORD=yourpassword
```

### 3. Run the database schema

Run the original SQL schema in your MySQL server (same `admin_config`, `personnel`, `leave_records` tables). The app's self-healing migration in `src/lib/db.ts` will automatically add any missing columns on first run.

### 4. Start development server

```bash
npm run dev
# Open http://localhost:3000
```

### 5. Build for production

```bash
npm run build
npm run start
```

---

## What Changed from PHP → Next.js

| Old (PHP)         | New (Next.js TSX)                        |
|-------------------|------------------------------------------|
| `api.php`         | `src/app/api/*/route.ts` (Route Handlers)|
| `index.php`       | `src/app/page.tsx` + all components      |
| `systemjs.js`     | Split into typed hooks, lib, components  |
| `style.css`       | `src/app/globals.css`                    |
| Global JS state   | `useReducer` + React Context             |
| DOM manipulation  | React state + JSX rendering              |
| `sessionStorage`  | Still used for session persistence       |
| `localStorage`    | Still used for NT accrual monthly key    |

---

## Roles & Access

| Role         | Access                                          |
|--------------|-------------------------------------------------|
| admin        | Full access — personnel, leave cards, settings  |
| encoder      | Leave cards + personnel edit, no admin settings |
| school_admin | Personnel register/edit only, no leave cards    |
| employee     | Read-only view of own leave card                |

---

## Notes

- All emails must end with `@deped.gov.ph`
- Employee IDs must be exactly **8 numeric digits**
- Terminal Leave goes to **Set B** only (same as Sick/Maternity)
- Monthly NT accrual (1.25 each set) is **once per month**, tracked in `localStorage`
- The `mysql2` package is required — install it separately as it is not bundled with Next.js
