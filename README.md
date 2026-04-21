# SDO Koronadal City — Leave Card System (Laravel)

A full-featured leave card management system for the Schools Division Office of Koronadal City, 
converted from Next.js to PHP Laravel.

---

## 📁 Project Structure

```
leavecard-laravel/
├── app/
│   ├── Helpers/
│   │   └── LeaveHelper.php          ← ALL business logic (balance calc, classification, etc.)
│   └── Http/
│       └── Controllers/
│           └── LeaveCardApiController.php  ← All 18+ API endpoints
├── database/
│   └── migrations/
│       └── 2024_01_01_000001_create_leave_card_tables.php
├── public/
│   ├── css/app.css                  ← Red Armour theme (full original styles)
│   ├── js/app.js                    ← Complete Vanilla JS SPA frontend
│   └── img/
│       ├── janice.jpg
│       └── jeoan.jpg
├── resources/views/
│   └── app.blade.php                ← SPA shell
├── routes/
│   ├── api.php                      ← All API routes
│   └── web.php                      ← SPA catch-all route
└── .env.example
```

---

## 🚀 Installation

### Requirements
- PHP 8.1+
- MySQL 5.7+ or MariaDB 10.3+
- Composer
- Laravel 10+

### Steps

**1. Create a new Laravel project and copy files:**
```bash
composer create-project laravel/laravel sdo-leavecard
cd sdo-leavecard
```

**2. Copy the provided files into your Laravel project:**
- `app/Helpers/LeaveHelper.php`
- `app/Http/Controllers/LeaveCardApiController.php`
- `database/migrations/` → all migration files
- `public/css/app.css`
- `public/js/app.js`
- `public/img/` → janice.jpg, jeoan.jpg
- `resources/views/app.blade.php`
- `routes/api.php` (replace existing)
- `routes/web.php` (replace existing)

**3. Configure your database:**
```bash
cp .env.example .env
php artisan key:generate
```

Edit `.env`:
```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=sdo_leavecard
DB_USERNAME=your_db_user
DB_PASSWORD=your_db_password
```

**4. Create the database:**
```sql
CREATE DATABASE sdo_leavecard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

**5. Run migrations (creates tables + seeds default accounts):**
```bash
php artisan migrate
```

**6. Configure API routes — update `bootstrap/app.php` or `app/Http/Kernel.php`:**

In Laravel 11, add to `bootstrap/app.php`:
```php
->withRouting(
    web: __DIR__.'/../routes/web.php',
    api: __DIR__.'/../routes/api.php',
    apiPrefix: 'api',
)
```

In Laravel 10, ensure `routes/api.php` is loaded in `app/Http/Kernel.php` (already done by default).

**7. Start the development server:**
```bash
php artisan serve
# Visit: http://localhost:8000
```

---

## 🔐 Default Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@deped.gov.ph | admin123 |
| Encoder | encoder@deped.gov.ph | encoder123 |

> ⚠️ **Change these passwords immediately after first login!**

---

## 🎯 Features

### For Admin
- ✅ Full personnel management (add, edit, archive/restore)
- ✅ All leave card operations
- ✅ Admin & encoder account management
- ✅ School admin account management
- ✅ Dashboard with statistics

### For Encoder
- ✅ View all leave cards
- ✅ Add/edit/delete leave records
- ✅ Add conversion era markers
- ✅ Balance auto-computation

### For School Admin
- ✅ View leave cards
- ✅ Dashboard overview

### For Employees
- ✅ Self-service leave card view
- ✅ Print own leave card

---

## 📊 Leave Types Supported

| Type | Description |
|------|-------------|
| Accrual / Service Credit | Earned leave |
| Vacation Leave | Deducted from Set A |
| Sick Leave | Deducted from Set B |
| Force/Mandatory Leave | Max 5 days/year |
| Personal Leave | W/O Pay |
| Monetization | Cash conversion |
| Terminal Leave | Final leave |
| Maternity/Paternity | Set B, no deduct |
| Magna Carta (SLB) | Max 60 days/year |
| Credit Entry / Transfer | Balance transfer |
| Disapproved Leave | No deduction |
| Solo Parent, Wellness, CTO, etc. | Set A, no deduct |

---

## 🏗️ Architecture

### Backend (Laravel PHP)
- **Routes**: `routes/api.php` — 20 REST endpoints
- **Controller**: `LeaveCardApiController` — all API logic
- **Helper**: `LeaveHelper` — complete business logic port from TypeScript

### Frontend (Vanilla JavaScript SPA)
- Single-page application loaded via Blade template
- State management via plain JS object
- No framework dependencies (no React, Vue, etc.)
- All original business logic ported from TypeScript

### Database (MySQL)
- `admin_config` — admin/encoder/school_admin accounts
- `personnel` — employee profiles
- `leave_records` — all leave entries with balance columns

---

## 🖨️ Print Support
The system has full print CSS for generating leave card printouts directly from the browser.
Press the 🖨️ Print button on any leave card to print.

---

## 👩‍💻 Developers

| Developer | Role |
|-----------|------|
| Jenly Orberte | Lead Developer — Backend, Database, Architecture |
| Janice | UI/UX Developer — Frontend, Design, Leave Card Tables |

---

## 📝 License
For internal use by SDO Koronadal City only.
