<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use App\Helpers\LeaveHelper;
use Exception;

class LeaveCardApiController extends Controller
{
    // ── POST /api/login ─────────────────────────────────────────
    public function login(Request $request): JsonResponse
    {
        try {
            $id       = strtolower(trim($request->input('id', '')));
            $password = $request->input('password', '');

            if (!$id || !$password) {
                return response()->json(['ok' => false, 'error' => 'Please enter your email and password.'], 401);
            }

            // Admin / Encoder / School Admin
            $row = DB::table('admin_config')->whereRaw('LOWER(login_id) = ?', [$id])->first();
            if ($row && $row->password === $password) {
                return response()->json([
                    'ok'       => true,
                    'role'     => $row->role,
                    'name'     => $row->name,
                    'login_id' => $row->login_id,
                    'db_id'    => $row->id,
                ]);
            }

            // Employee
            $emp = DB::table('personnel')->whereRaw('LOWER(email) = ?', [$id])->first();
            if ($emp && $emp->password === $password) {
                if (($emp->account_status ?? 'active') === 'inactive') {
                    return response()->json(['ok' => false, 'error' => 'Your account is inactive. Please contact the administrator.'], 403);
                }
                return response()->json([
                    'ok'             => true,
                    'role'           => 'employee',
                    'employee_id'    => $emp->employee_id,
                    'name'           => trim("{$emp->given} {$emp->surname}"),
                    'status'         => $emp->status,
                    'account_status' => $emp->account_status ?? 'active',
                ]);
            }

            return response()->json(['ok' => false, 'error' => 'Incorrect email or password. Please try again.'], 401);
        } catch (Exception $e) {
            return response()->json(['ok' => false, 'error' => $e->getMessage()], 500);
        }
    }

    // ── GET /api/get_personnel ──────────────────────────────────
    public function getPersonnel(Request $request): JsonResponse
    {
        try {
            $page  = max(1, (int)$request->input('page', 1));
            $limit = min(200, (int)$request->input('limit', 100));
            $offset = ($page - 1) * $limit;

            $total = DB::table('personnel')->count();
            $rows  = DB::table('personnel')
                ->orderBy('surname')
                ->orderBy('given')
                ->limit($limit)
                ->offset($offset)
                ->get()
                ->toArray();

            $data = array_map(function($r) {
                $arr = (array)$r;
                $emp = LeaveHelper::personnelRowToJs($arr);
                $emp['records'] = [];
                return $emp;
            }, $rows);

            return response()->json(['ok' => true, 'data' => $data, 'total' => $total, 'page' => $page, 'limit' => $limit])
                ->header('Cache-Control', 'no-store, no-cache, must-revalidate');
        } catch (Exception $e) {
            return response()->json(['ok' => false, 'error' => $e->getMessage()], 500);
        }
    }

    // ── GET /api/get_records ────────────────────────────────────
    public function getRecords(Request $request): JsonResponse
    {
        try {
            $empId = $request->input('employee_id');
            if (!$empId) return response()->json(['ok' => false, 'error' => 'employee_id required'], 400);

            $rows = DB::table('leave_records')
                ->where('employee_id', $empId)
                ->orderBy('sort_order')
                ->orderBy('record_id')
                ->get()
                ->toArray();

            $records = array_map(fn($r) => LeaveHelper::rowToRecord((array)$r), $rows);
            return response()->json(['ok' => true, 'records' => $records]);
        } catch (Exception $e) {
            return response()->json(['ok' => false, 'error' => $e->getMessage()], 500);
        }
    }

    // ── GET /api/get_admin_cfg ──────────────────────────────────
    public function getAdminCfg(Request $request): JsonResponse
    {
        try {
            $role = $request->input('role', 'admin');
            $accounts = DB::table('admin_config')
                ->where('role', $role)
                ->orderBy('id')
                ->get(['id', 'name', 'login_id', 'password', 'role'])
                ->toArray();

            return response()->json(['ok' => true, 'accounts' => $accounts])
                ->header('Cache-Control', 'no-store, no-cache, must-revalidate');
        } catch (Exception $e) {
            return response()->json(['ok' => false, 'error' => $e->getMessage()], 500);
        }
    }

    // ── GET /api/get_school_admins ──────────────────────────────
    public function getSchoolAdmins(): JsonResponse
    {
        try {
            $rows = DB::table('admin_config')
                ->where('role', 'school_admin')
                ->orderBy('name')
                ->get(['id', 'login_id', 'name'])
                ->toArray();
            return response()->json(['ok' => true, 'school_admins' => $rows]);
        } catch (Exception $e) {
            return response()->json(['ok' => false, 'error' => $e->getMessage()], 500);
        }
    }

    // ── POST /api/save_record ───────────────────────────────────
    public function saveRecord(Request $request): JsonResponse
    {
        try {
            $empId = $request->input('employee_id');
            $record = $request->input('record', []);

            $emp = DB::table('personnel')->where('employee_id', $empId)->first();
            if (!$emp) return response()->json(['ok' => false, 'error' => 'Employee not found.'], 404);

            $action    = strtolower($record['action'] ?? '');
            $isAccrual = str_contains($action, 'accrual') || str_contains($action, 'service credit');
            $empCat    = strtolower($emp->status ?? '');
            $isNTorTR  = in_array($empCat, ['non-teaching', 'teaching related']);
            $isInactive = $emp->account_status === 'inactive';

            if ($isAccrual && $isNTorTR && $isInactive) {
                return response()->json(['ok' => false, 'skipped' => true, 'error' => "Skipped: employee {$empId} is inactive."]);
            }

            $maxSort = DB::table('leave_records')->where('employee_id', $empId)->max('sort_order') ?? 0;
            $sortOrder = $maxSort + 1;

            $row = LeaveHelper::recordToRow($record, $empId, $sortOrder);
            $recordId = DB::table('leave_records')->insertGetId($row);

            DB::table('personnel')->where('employee_id', $empId)
                ->update(['last_edited_at' => now()]);

            return response()->json(['ok' => true, 'record_id' => $recordId]);
        } catch (Exception $e) {
            return response()->json(['ok' => false, 'error' => $e->getMessage()], 500);
        }
    }

    // ── POST /api/update_record ─────────────────────────────────
    public function updateRecord(Request $request): JsonResponse
    {
        try {
            $empId    = $request->input('employee_id');
            $recordId = $request->input('record_id');
            $record   = $request->input('record', []);

            $sortRow = DB::table('leave_records')->where('record_id', $recordId)->first();
            $sortOrder = (int)($sortRow->sort_order ?? 0);

            $row = LeaveHelper::recordToRow($record, $empId, $sortOrder);
            unset($row['employee_id']);

            DB::table('leave_records')->where('record_id', $recordId)->update($row);
            DB::table('personnel')->where('employee_id', $empId)->update(['last_edited_at' => now()]);

            return response()->json(['ok' => true]);
        } catch (Exception $e) {
            return response()->json(['ok' => false, 'error' => $e->getMessage()], 500);
        }
    }

    // ── POST /api/delete_record ─────────────────────────────────
    public function deleteRecord(Request $request): JsonResponse
    {
        try {
            $recordId = $request->input('record_id');
            $empId    = $request->input('employee_id');

            $row = DB::table('leave_records')
                ->where('record_id', $recordId)
                ->where('employee_id', $empId)
                ->first();
            if (!$row) return response()->json(['ok' => false, 'error' => 'Record not found.'], 404);
            if ($row->is_conversion) return response()->json(['ok' => false, 'error' => 'Cannot delete conversion markers directly.'], 400);

            DB::table('leave_records')->where('record_id', $recordId)->delete();
            DB::table('personnel')->where('employee_id', $empId)->update(['last_edited_at' => now()]);

            return response()->json(['ok' => true]);
        } catch (Exception $e) {
            return response()->json(['ok' => false, 'error' => $e->getMessage()], 500);
        }
    }

    // ── POST /api/delete_era ────────────────────────────────────
    public function deleteEra(Request $request): JsonResponse
    {
        try {
            $recordId = $request->input('record_id');
            $empId    = $request->input('employee_id');

            $row = DB::table('leave_records')
                ->where('record_id', $recordId)
                ->where('employee_id', $empId)
                ->first();
            if (!$row) return response()->json(['ok' => false, 'error' => 'Record not found.'], 404);
            if (!$row->is_conversion) return response()->json(['ok' => false, 'error' => 'Not a conversion marker.'], 400);

            DB::table('leave_records')->where('record_id', $recordId)->delete();
            return response()->json(['ok' => true]);
        } catch (Exception $e) {
            return response()->json(['ok' => false, 'error' => $e->getMessage()], 500);
        }
    }

    // ── POST /api/insert_record_at ──────────────────────────────
    public function insertRecordAt(Request $request): JsonResponse
    {
        try {
            $empId          = $request->input('employee_id');
            $record         = $request->input('record', []);
            $afterSortOrder = (int)$request->input('after_sort_order', 0);

            DB::table('leave_records')
                ->where('employee_id', $empId)
                ->where('sort_order', '>', $afterSortOrder)
                ->increment('sort_order');

            $newSortOrder = $afterSortOrder + 1;
            $row = LeaveHelper::recordToRow($record, $empId, $newSortOrder);
            $recordId = DB::table('leave_records')->insertGetId($row);

            DB::table('personnel')->where('employee_id', $empId)->update(['last_edited_at' => now()]);

            return response()->json(['ok' => true, 'record_id' => $recordId, 'sort_order' => $newSortOrder]);
        } catch (Exception $e) {
            return response()->json(['ok' => false, 'error' => $e->getMessage()], 500);
        }
    }

    // ── POST /api/reorder_records ───────────────────────────────
    public function reorderRecords(Request $request): JsonResponse
    {
        try {
            $empId     = $request->input('employee_id');
            $recordIds = $request->input('record_ids', []);

            foreach ($recordIds as $i => $rid) {
                DB::table('leave_records')
                    ->where('record_id', $rid)
                    ->where('employee_id', $empId)
                    ->update(['sort_order' => $i]);
            }
            return response()->json(['ok' => true]);
        } catch (Exception $e) {
            return response()->json(['ok' => false, 'error' => $e->getMessage()], 500);
        }
    }

    // ── POST /api/save_row_balance ──────────────────────────────
    public function saveRowBalance(Request $request): JsonResponse
    {
        try {
            $b = $request->all();
            DB::table('leave_records')->where('record_id', $b['record_id'])->update([
                'setA_earned'  => $b['setA_earned'],
                'setA_abs_wp'  => $b['setA_abs_wp'],
                'setA_balance' => $b['setA_balance'],
                'setA_wop'     => $b['setA_wop'],
                'setB_earned'  => $b['setB_earned'],
                'setB_abs_wp'  => $b['setB_abs_wp'],
                'setB_balance' => $b['setB_balance'],
                'setB_wop'     => $b['setB_wop'],
            ]);
            return response()->json(['ok' => true]);
        } catch (Exception $e) {
            return response()->json(['ok' => false, 'error' => $e->getMessage()], 500);
        }
    }

    // ── POST /api/save_employee ─────────────────────────────────
    public function saveEmployee(Request $request): JsonResponse
    {
        try {
            $p  = $request->all();
            $id = trim($p['id'] ?? '');

            $idErr = LeaveHelper::validateEmployeeId($id);
            if ($idErr) return response()->json(['ok' => false, 'error' => $idErr], 400);

            $email = strtolower(trim($p['email'] ?? ''));
            $emailErr = LeaveHelper::validateDepedEmail($email);
            if ($emailErr) return response()->json(['ok' => false, 'error' => $emailErr], 400);

            $required = ['surname' => 'Surname', 'given' => 'Given name', 'sex' => 'Sex',
                         'status' => 'Category', 'dob' => 'Date of Birth',
                         'addr' => 'Present Address', 'pos' => 'Position / Designation',
                         'school' => 'School / Office Assignment'];
            foreach ($required as $field => $label) {
                if (!trim($p[$field] ?? ''))
                    return response()->json(['ok' => false, 'error' => "{$label} is required."], 400);
            }

            $originalId = trim($p['originalId'] ?? '') ?: $id;

            $dupEmail = DB::table('personnel')
                ->whereRaw('LOWER(email) = ?', [$email])
                ->where('employee_id', '!=', $originalId)
                ->exists();
            if ($dupEmail)
                return response()->json(['ok' => false, 'error' => "Email \"{$email}\" is already registered to another employee."], 400);

            $existing = DB::table('personnel')->where('employee_id', $originalId)->first();
            $isNew = !$existing;

            $pw = $p['password'] ?? '';
            if (!$isNew && !$pw) {
                $cur = DB::table('personnel')->where('employee_id', $originalId)->value('password');
                $pw = $cur ?? '';
            }
            if ($isNew && !$pw)
                return response()->json(['ok' => false, 'error' => 'Password is required for new employees.'], 400);

            $data = [
                'employee_id'    => $id,
                'email'          => $email,
                'password'       => $pw,
                'surname'        => $p['surname']  ?? '',
                'given'          => $p['given']    ?? '',
                'suffix'         => $p['suffix']   ?? '',
                'maternal'       => $p['maternal'] ?? '',
                'sex'            => $p['sex']      ?? '',
                'civil'          => $p['civil']    ?? '',
                'dob'            => LeaveHelper::normaliseDate($p['dob']   ?? ''),
                'pob'            => $p['pob']      ?? '',
                'addr'           => $p['addr']     ?? '',
                'spouse'         => $p['spouse']   ?? '',
                'edu'            => $p['edu']      ?? '',
                'elig'           => $p['elig']     ?? '',
                'rating'         => $p['rating']   ?? '',
                'tin'            => $p['tin']      ?? '',
                'pexam'          => $p['pexam']    ?? '',
                'dexam'          => LeaveHelper::normaliseDate($p['dexam'] ?? ''),
                'appt'           => LeaveHelper::normaliseDate($p['appt']  ?? ''),
                'status'         => $p['status']   ?? 'Teaching',
                'account_status' => in_array($p['account_status'] ?? '', ['active', 'inactive']) ? $p['account_status'] : 'active',
                'pos'            => $p['pos']      ?? '',
                'school'         => $p['school']   ?? '',
                'last_edited_at' => now(),
                'updated_at'     => now(),
            ];

            if (!$isNew) {
                DB::table('personnel')->where('employee_id', $originalId)->update($data);
            } else {
                $data['created_at'] = now();
                DB::table('personnel')->insert($data);
            }

            if ($isNew && !empty($p['records']) && is_array($p['records'])) {
                DB::table('leave_records')->where('employee_id', $originalId)->delete();
                foreach ($p['records'] as $i => $rec) {
                    $row = LeaveHelper::recordToRow($rec, $id, $i);
                    DB::table('leave_records')->insert($row);
                }
            }

            return response()->json(['ok' => true, 'employee_id' => $id]);
        } catch (Exception $e) {
            return response()->json(['ok' => false, 'error' => $e->getMessage()], 500);
        }
    }

    // ── POST /api/save_admin ────────────────────────────────────
    public function saveAdmin(Request $request): JsonResponse
    {
        try {
            $p         = $request->all();
            $role      = $p['role'] ?? 'admin';
            $accountId = (int)($p['account_id'] ?? 0);
            $isDelete  = !empty($p['_delete']);

            if ($isDelete) {
                if (!$accountId) return response()->json(['ok' => false, 'error' => 'account_id required for delete.'], 400);
                DB::table('admin_config')->where('id', $accountId)->where('role', $role)->delete();
                return response()->json(['ok' => true]);
            }

            $name    = trim($p['name']     ?? '');
            $loginId = strtolower(trim($p['login_id'] ?? ''));
            $pw      = $p['password'] ?? '';

            if (!$name || !$loginId) return response()->json(['ok' => false, 'error' => 'Name and login ID are required.'], 400);
            if (!str_ends_with($loginId, '@deped.gov.ph')) return response()->json(['ok' => false, 'error' => 'Login ID must use @deped.gov.ph domain.'], 400);

            if ($accountId > 0) {
                $row = DB::table('admin_config')->where('id', $accountId)->where('role', $role)->first();
                if (!$row) return response()->json(['ok' => false, 'error' => 'Account not found.'], 404);
                $finalPw = $pw !== '' ? $pw : $row->password;
                DB::table('admin_config')->where('id', $accountId)->update(['name' => $name, 'login_id' => $loginId, 'password' => $finalPw]);
            } else {
                if (!$pw) return response()->json(['ok' => false, 'error' => 'Password is required for new accounts.'], 400);
                DB::table('admin_config')->insert(['login_id' => $loginId, 'password' => $pw, 'name' => $name, 'role' => $role]);
            }
            return response()->json(['ok' => true]);
        } catch (Exception $e) {
            return response()->json(['ok' => false, 'error' => $e->getMessage()], 500);
        }
    }

    // ── POST /api/save_school_admin ─────────────────────────────
    public function saveSchoolAdmin(Request $request): JsonResponse
    {
        try {
            $p       = $request->all();
            $saId    = (int)($p['sa_id'] ?? 0);
            $name    = trim($p['name']     ?? '');
            $loginId = strtolower(trim($p['login_id'] ?? ''));
            $pw      = $p['password'] ?? '';

            if (!$name)    return response()->json(['ok' => false, 'error' => 'Display name is required.'], 400);
            if (!$loginId) return response()->json(['ok' => false, 'error' => 'Login email is required.'], 400);
            if (!str_ends_with($loginId, '@deped.gov.ph')) return response()->json(['ok' => false, 'error' => 'Login ID must use @deped.gov.ph domain.'], 400);

            $dup = DB::table('admin_config')->whereRaw('LOWER(login_id) = ?', [$loginId])->where('id', '!=', $saId)->exists();
            if ($dup) return response()->json(['ok' => false, 'error' => 'That email is already in use by another account.'], 400);

            $finalId = $saId;
            if ($saId > 0) {
                $row = DB::table('admin_config')->where('id', $saId)->where('role', 'school_admin')->first();
                if (!$row) return response()->json(['ok' => false, 'error' => 'School Admin account not found.'], 404);
                $finalPw = $pw !== '' ? $pw : $row->password;
                DB::table('admin_config')->where('id', $saId)->update(['name' => $name, 'login_id' => $loginId, 'password' => $finalPw]);
            } else {
                if (!$pw) return response()->json(['ok' => false, 'error' => 'Password is required for new accounts.'], 400);
                $finalId = DB::table('admin_config')->insertGetId(['login_id' => $loginId, 'password' => $pw, 'name' => $name, 'role' => 'school_admin']);
            }
            return response()->json(['ok' => true, 'sa_id' => $finalId]);
        } catch (Exception $e) {
            return response()->json(['ok' => false, 'error' => $e->getMessage()], 500);
        }
    }

    // ── POST /api/delete_school_admin ───────────────────────────
    public function deleteSchoolAdmin(Request $request): JsonResponse
    {
        try {
            $saId = $request->input('sa_id');
            $affected = DB::table('admin_config')->where('id', $saId)->where('role', 'school_admin')->delete();
            if (!$affected) return response()->json(['ok' => false, 'error' => 'School Admin account not found.'], 404);
            return response()->json(['ok' => true]);
        } catch (Exception $e) {
            return response()->json(['ok' => false, 'error' => $e->getMessage()], 500);
        }
    }

    // ── POST /api/save_encoder ──────────────────────────────────
    public function saveEncoder(Request $request): JsonResponse
    {
        try {
            $name = $request->input('name');
            if (!$name) return response()->json(['ok' => false, 'error' => 'Name is required.'], 400);
            $row = DB::table('admin_config')->where('role', 'encoder')->first();
            if ($row) DB::table('admin_config')->where('id', $row->id)->update(['name' => $name]);
            return response()->json(['ok' => true]);
        } catch (Exception $e) {
            return response()->json(['ok' => false, 'error' => $e->getMessage()], 500);
        }
    }

    // ── POST /api/archive ───────────────────────────────────────
    public function archive(Request $request): JsonResponse
    {
        try {
            $empId = $request->input('employee_id');
            DB::table('personnel')->where('employee_id', $empId)->update(['account_status' => 'inactive']);
            return response()->json(['ok' => true]);
        } catch (Exception $e) {
            return response()->json(['ok' => false, 'error' => $e->getMessage()], 500);
        }
    }

    // ── POST /api/unarchive ─────────────────────────────────────
    public function unarchive(Request $request): JsonResponse
    {
        try {
            $empId = $request->input('employee_id');
            DB::table('personnel')->where('employee_id', $empId)->update(['account_status' => 'active']);
            return response()->json(['ok' => true]);
        } catch (Exception $e) {
            return response()->json(['ok' => false, 'error' => $e->getMessage()], 500);
        }
    }

    // ── POST /api/compute_balances (bonus endpoint) ─────────────
    public function computeBalances(Request $request): JsonResponse
    {
        try {
            $empId   = $request->input('employee_id');
            $records = $request->input('records', []);
            $status  = $request->input('status', 'Teaching');

            $updates = LeaveHelper::computeRowBalanceUpdates($records, $empId, $status);
            return response()->json(['ok' => true, 'updates' => $updates]);
        } catch (Exception $e) {
            return response()->json(['ok' => false, 'error' => $e->getMessage()], 500);
        }
    }

    // ── POST /api/validate_leave ────────────────────────────────
    public function validateLeave(Request $request): JsonResponse
    {
        try {
            $empRecords = $request->input('emp_records', []);
            $newRec     = $request->input('record', []);
            $editIdx    = (int)$request->input('edit_idx', -1);
            $status     = $request->input('status', 'Teaching');

            $err = LeaveHelper::validateLeaveEntry($empRecords, $newRec, $editIdx, $status);
            return response()->json(['ok' => true, 'error' => $err]);
        } catch (Exception $e) {
            return response()->json(['ok' => false, 'error' => $e->getMessage()], 500);
        }
    }
}
