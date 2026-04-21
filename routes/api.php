<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\LeaveCardApiController;

// ── Authentication ───────────────────────────────────────────
Route::post('/login', [LeaveCardApiController::class, 'login']);

// ── Personnel ────────────────────────────────────────────────
Route::get('/get_personnel',   [LeaveCardApiController::class, 'getPersonnel']);
Route::post('/save_employee',  [LeaveCardApiController::class, 'saveEmployee']);
Route::post('/archive',        [LeaveCardApiController::class, 'archive']);
Route::post('/unarchive',      [LeaveCardApiController::class, 'unarchive']);

// ── Leave Records ────────────────────────────────────────────
Route::get('/get_records',          [LeaveCardApiController::class, 'getRecords']);
Route::post('/save_record',         [LeaveCardApiController::class, 'saveRecord']);
Route::post('/update_record',       [LeaveCardApiController::class, 'updateRecord']);
Route::post('/delete_record',       [LeaveCardApiController::class, 'deleteRecord']);
Route::post('/delete_era',          [LeaveCardApiController::class, 'deleteEra']);
Route::post('/insert_record_at',    [LeaveCardApiController::class, 'insertRecordAt']);
Route::post('/reorder_records',     [LeaveCardApiController::class, 'reorderRecords']);
Route::post('/save_row_balance',    [LeaveCardApiController::class, 'saveRowBalance']);

// ── Admin / Config ───────────────────────────────────────────
Route::get('/get_admin_cfg',         [LeaveCardApiController::class, 'getAdminCfg']);
Route::post('/save_admin',           [LeaveCardApiController::class, 'saveAdmin']);
Route::post('/save_encoder',         [LeaveCardApiController::class, 'saveEncoder']);
Route::get('/get_school_admins',     [LeaveCardApiController::class, 'getSchoolAdmins']);
Route::post('/save_school_admin',    [LeaveCardApiController::class, 'saveSchoolAdmin']);
Route::post('/delete_school_admin',  [LeaveCardApiController::class, 'deleteSchoolAdmin']);

// ── Utility ──────────────────────────────────────────────────
Route::post('/compute_balances',  [LeaveCardApiController::class, 'computeBalances']);
Route::post('/validate_leave',    [LeaveCardApiController::class, 'validateLeave']);
