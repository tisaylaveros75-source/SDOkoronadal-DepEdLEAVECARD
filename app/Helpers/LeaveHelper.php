<?php

namespace App\Helpers;

class LeaveHelper
{
    // ── Date normalisation ──────────────────────────────────────
    public static function normaliseDate(?string $d): ?string
    {
        if (!$d) return null;
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $d)) return $d;
        if (preg_match('/^(\d{2})\/(\d{2})\/(\d{4})$/', $d, $m)) {
            return "{$m[3]}-{$m[1]}-{$m[2]}";
        }
        if (str_contains($d, 'T')) return substr($d, 0, 10);
        return null;
    }

    // ── Leave classification ────────────────────────────────────
    public static function classifyLeave(string $act): array
    {
        $a = strtolower($act);
        $isForceDis = (str_contains($a, 'force') || str_contains($a, 'mandatory')) && str_contains($a, 'disapproved');
        return [
            'isAcc'          => str_contains($a, 'accrual') || str_contains($a, 'service credit'),
            'isMon'          => str_contains($a, 'monetization') && !str_contains($a, 'disapproved'),
            'isMD'           => str_contains($a, 'monetization') && str_contains($a, 'disapproved'),
            'isForceDis'     => $isForceDis,
            'isDis'          => str_contains($a, '(disapproved)') && !(str_contains($a, 'monetization') && str_contains($a, 'disapproved')) && !$isForceDis,
            'isSick'         => str_contains($a, 'sick'),
            'isForce'        => (str_contains($a, 'force') || str_contains($a, 'mandatory')) && !str_contains($a, 'disapproved'),
            'isPer'          => str_contains($a, 'personal'),
            'isTransfer'     => str_contains($a, 'credit entry') || str_contains($a, 'from denr'),
            'isTerminal'     => str_contains($a, 'terminal'),
            'isSetB_noDeduct'=> str_contains($a, 'maternity') || str_contains($a, 'paternity'),
            'isSetA_noDeduct'=> str_contains($a, 'solo parent') || str_contains($a, 'wellness') ||
                                str_contains($a, 'special privilege') || str_contains($a, 'spl') ||
                                str_contains($a, 'rehabilitation') || str_contains($a, 'study') ||
                                str_contains($a, 'magna carta') || str_contains($a, 'vawc') ||
                                str_contains($a, 'cto') || str_contains($a, 'compensatory'),
            'isVacation'     => str_contains($a, 'vacation') && !str_contains($a, '(disapproved)'),
        ];
    }

    // ── Calculate weekdays ──────────────────────────────────────
    public static function calcDays(array $r): float
    {
        $a = strtolower($r['action'] ?? '');
        $isForceAction = (str_contains($a, 'force') || str_contains($a, 'mandatory')) && !str_contains($a, 'disapproved');
        $isForceDis    = (str_contains($a, 'force') || str_contains($a, 'mandatory')) &&  str_contains($a, 'disapproved');

        $forceAmount = (float)($r['forceAmount'] ?? 0);
        if (($isForceAction || $isForceDis) && $forceAmount > 0) return $forceAmount;

        $from = $r['from'] ?? '';
        $to   = $r['to']   ?? '';

        if ($from && $to) {
            $startHalf = in_array($r['fromPeriod'] ?? 'WD', ['AM', 'PM']);
            $endHalf   = in_array($r['toPeriod']   ?? 'WD', ['AM', 'PM']);

            if ($from === $to && $startHalf) {
                $d   = new \DateTime($from);
                $day = (int)$d->format('N'); // 1=Mon 7=Sun
                return ($day <= 5) ? 0.5 : 0;
            }

            $count = 0;
            $start = new \DateTime($from);
            $end   = new \DateTime($to);
            if ($end < $start) return 0;

            $cur = clone $start;
            while ($cur <= $end) {
                $day = (int)$cur->format('N');
                if ($day <= 5) $count++;
                $cur->modify('+1 day');
            }

            if ($startHalf) $count -= 0.5;
            if ($endHalf)   $count -= 0.5;
            if ($count < 0) $count = 0;
            return $count;
        }
        return 0;
    }

    // ── Format date MM/DD/YYYY ──────────────────────────────────
    public static function fmtD(?string $ds): string
    {
        if (!$ds) return '';
        if (preg_match('/^\d{2}\/\d{2}\/\d{4}$/', $ds)) return $ds;
        $d = new \DateTime($ds . (str_contains($ds, 'T') ? '' : 'T00:00:00'));
        if (!$d) return $ds;
        return $d->format('m/d/Y');
    }

    // ── Record → DB row ─────────────────────────────────────────
    public static function recordToRow(array $r, string $empId, int $sortOrder): array
    {
        $isConv = !empty($r['_conversion']);
        $action = $r['action'] ?? '';
        $isXfer = self::isTransferAction($action);

        $setAEarned = isset($r['setA_earned']) ? (float)$r['setA_earned']
                    : ($isXfer ? (float)($r['trV'] ?? 0) : 0);
        $setBEarned = isset($r['setB_earned']) ? (float)$r['setB_earned']
                    : ($isXfer ? (float)($r['trS'] ?? 0) : 0);

        return [
            'employee_id'     => $empId,
            'sort_order'      => $sortOrder,
            'so'              => $r['so']           ?? '',
            'prd'             => $isConv ? ''       : ($r['prd'] ?? ''),
            'from_date'       => self::normaliseDate($r['from'] ?? ''),
            'to_date'         => self::normaliseDate($r['to']   ?? ''),
            'fromPeriod'      => $r['fromPeriod']   ?? 'WD',
            'toPeriod'        => $r['toPeriod']     ?? 'WD',
            'spec'            => $r['spec']          ?? '',
            'action'          => $action,
            'force_amount'    => (float)($r['forceAmount'] ?? 0),
            'setA_earned'     => $setAEarned,
            'setA_abs_wp'     => (float)($r['setA_abs_wp']  ?? 0),
            'setA_balance'    => $isConv ? (float)($r['fwdBV'] ?? 0) : (float)($r['setA_balance'] ?? 0),
            'setA_wop'        => (float)($r['setA_wop']     ?? 0),
            'setB_earned'     => $setBEarned,
            'setB_abs_wp'     => (float)($r['setB_abs_wp']  ?? 0),
            'setB_balance'    => $isConv ? (float)($r['fwdBS'] ?? 0) : (float)($r['setB_balance'] ?? 0),
            'setB_wop'        => (float)($r['setB_wop']     ?? 0),
            'is_conversion'   => $isConv ? 1 : 0,
            'from_status'     => $r['fromStatus']   ?? '',
            'to_status'       => $r['toStatus']     ?? '',
            'conversion_date' => self::normaliseDate($r['date'] ?? ''),
        ];
    }

    // ── DB row → JS record ──────────────────────────────────────
    public static function rowToRecord(array $row): array
    {
        $action = (string)($row['action'] ?? '');
        $isMon  = str_contains(strtolower($action), 'monetization') && !str_contains(strtolower($action), 'disapproved');
        $isMD   = str_contains(strtolower($action), 'monetization') &&  str_contains(strtolower($action), 'disapproved');
        $isXfer = self::isTransferAction($action);

        $setAE = (float)($row['setA_earned'] ?? 0);
        $setBE = (float)($row['setB_earned'] ?? 0);
        $setAA = (float)($row['setA_abs_wp'] ?? 0);
        $setBA = (float)($row['setB_abs_wp'] ?? 0);

        $rawFP = strtoupper((string)($row['fromPeriod'] ?? 'WD'));
        $rawTP = strtoupper((string)($row['toPeriod']   ?? 'WD'));
        $fromPeriod = in_array($rawFP, ['AM', 'PM']) ? $rawFP : 'WD';
        $toPeriod   = in_array($rawTP, ['AM', 'PM']) ? $rawTP : 'WD';

        $fromDate = '';
        if (!empty($row['from_date'])) {
            $fromDate = $row['from_date'] instanceof \DateTime
                ? $row['from_date']->format('Y-m-d')
                : substr((string)$row['from_date'], 0, 10);
        }
        $toDate = '';
        if (!empty($row['to_date'])) {
            $toDate = $row['to_date'] instanceof \DateTime
                ? $row['to_date']->format('Y-m-d')
                : substr((string)$row['to_date'], 0, 10);
        }

        $r = [
            'so'           => (string)($row['so']   ?? ''),
            'prd'          => (string)($row['prd']  ?? ''),
            'from'         => $fromDate,
            'to'           => $toDate,
            'fromPeriod'   => $fromPeriod,
            'toPeriod'     => $toPeriod,
            'spec'         => (string)($row['spec']  ?? ''),
            'action'       => $action,
            'forceAmount'  => (float)($row['force_amount'] ?? 0),
            'earned'       => $setAE,
            'monAmount'    => $isMon ? $setAA : 0,
            'monDisAmt'    => $isMD  ? $setAA : 0,
            'monV'         => $isMon ? $setAA : 0,
            'monS'         => $isMon ? $setBA : 0,
            'monDV'        => $isMD  ? $setAA : 0,
            'monDS'        => $isMD  ? $setBA : 0,
            'trV'          => $isXfer ? $setAE : 0,
            'trS'          => $isXfer ? $setBE : 0,
            'setA_earned'  => $setAE,
            'setA_abs_wp'  => $setAA,
            'setA_balance' => (float)($row['setA_balance'] ?? 0),
            'setA_wop'     => (float)($row['setA_wop']     ?? 0),
            'setB_earned'  => $setBE,
            'setB_abs_wp'  => $setBA,
            'setB_balance' => (float)($row['setB_balance'] ?? 0),
            'setB_wop'     => (float)($row['setB_wop']     ?? 0),
            '_record_id'   => (int)($row['record_id'] ?? 0),
        ];

        if (!empty($row['is_conversion'])) {
            $r['_conversion'] = true;
            $r['fromStatus']  = (string)($row['from_status']     ?? '');
            $r['toStatus']    = (string)($row['to_status']       ?? '');
            $r['date']        = (string)($row['conversion_date'] ?? '');
            $r['fwdBV']       = (float)($row['setA_balance'] ?? 0);
            $r['fwdBS']       = (float)($row['setB_balance'] ?? 0);
        }
        return $r;
    }

    // ── Personnel DB row → array ────────────────────────────────
    public static function personnelRowToJs(array $r): array
    {
        return [
            'id'             => $r['employee_id'],
            'email'          => $r['email'],
            'password'       => $r['password'],
            'surname'        => $r['surname'],
            'given'          => $r['given'],
            'suffix'         => $r['suffix'] ?? '',
            'maternal'       => $r['maternal'] ?? '',
            'sex'            => $r['sex'] ?? '',
            'civil'          => $r['civil'] ?? '',
            'dob'            => $r['dob'],
            'pob'            => $r['pob'] ?? '',
            'addr'           => $r['addr'] ?? '',
            'spouse'         => $r['spouse'] ?? '',
            'edu'            => $r['edu'] ?? '',
            'elig'           => $r['elig'] ?? '',
            'rating'         => $r['rating'] ?? '',
            'tin'            => $r['tin'] ?? '',
            'pexam'          => $r['pexam'] ?? '',
            'dexam'          => $r['dexam'],
            'appt'           => $r['appt'],
            'status'         => $r['status'],
            'account_status' => $r['account_status'] ?? 'active',
            'pos'            => $r['pos'] ?? '',
            'school'         => $r['school'] ?? '',
            'lastEditedAt'   => $r['last_edited_at'],
            'conversionLog'  => [],
            'records'        => [],
        ];
    }

    // ── Compute row balance updates ─────────────────────────────
    public static function computeRowBalanceUpdates(array $records, string $empId, string $empStatus): array
    {
        $segments = [];
        $currentStatus = $empStatus;

        $firstConv = null;
        foreach ($records as $r) {
            if (!empty($r['_conversion'])) { $firstConv = $r; break; }
        }
        if ($firstConv) {
            $currentStatus = $firstConv['fromStatus'] ?? $empStatus;
        }

        $currentSeg = ['eraStatus' => $currentStatus, 'conv' => null, 'recs' => []];

        foreach ($records as $r) {
            if (!$r) continue;
            if (!empty($r['_conversion'])) {
                $segments[] = $currentSeg;
                $newStatus = $r['toStatus'] ?? $empStatus;
                $currentSeg = ['eraStatus' => $newStatus, 'conv' => $r, 'recs' => []];
            } else {
                $currentSeg['recs'][] = $r;
            }
        }
        $segments[] = $currentSeg;

        $updates = [];

        foreach ($segments as $seg) {
            if ($seg['eraStatus'] === 'Teaching') {
                $bal = 0;
                foreach ($seg['recs'] as $r) {
                    if (empty($r['_record_id'])) continue;
                    $C = self::classifyLeave($r['action'] ?? '');
                    $rowAEarned = 0; $rowAAbsWP = 0; $rowAWOP = 0;
                    $rowBAbsWP  = 0; $rowBWOP   = 0;

                    if ($C['isTransfer']) { $rowAEarned = (float)($r['trV'] ?? 0); $bal += $rowAEarned; }
                    elseif ((float)($r['earned'] ?? 0) > 0 && !$C['isMon'] && !$C['isPer']) { $rowAEarned = (float)$r['earned']; $bal += $rowAEarned; }
                    elseif ($C['isMD'])       { $bal += (float)($r['monDisAmt'] ?? 0); $rowAAbsWP = (float)($r['monDisAmt'] ?? 0); }
                    elseif ($C['isForceDis']) { $d = self::calcDays($r); $rowAAbsWP = $d; $bal += $d; }
                    elseif ($C['isMon']) {
                        $m = (float)($r['monAmount'] ?? 0);
                        if ($bal >= $m) { $rowAAbsWP = $m; $bal -= $m; }
                        else { $rowAAbsWP = $bal; $rowAWOP = $m - $bal; $bal = 0; }
                    } elseif (!$C['isDis']) {
                        $days = self::calcDays($r);
                        if ($days > 0) {
                            if ($C['isSick']) { if ($bal >= $days) { $rowBAbsWP = $days; $bal -= $days; } else { $rowBAbsWP = $bal; $rowBWOP = $days - $bal; $bal = 0; } }
                            elseif ($C['isPer'])           { $rowAWOP = $days; }
                            elseif ($C['isVacation'])      { if ($bal >= $days) { $rowAAbsWP = $days; $bal -= $days; } else { $rowAAbsWP = $bal; $rowAWOP = $days - $bal; $bal = 0; } }
                            elseif ($C['isForce'])         { if ($bal >= $days) { $rowAAbsWP = $days; $bal -= $days; } else { $rowAAbsWP = $bal; $rowAWOP = $days - $bal; $bal = 0; } }
                            elseif ($C['isTerminal'])      { if ($bal >= $days) { $rowBAbsWP = $days; $bal -= $days; } else { $rowBAbsWP = $bal; $rowBWOP = $days - $bal; $bal = 0; } }
                            elseif ($C['isSetB_noDeduct']) { $rowBAbsWP = $days; }
                            else                           { $rowAAbsWP = $days; }
                        }
                    }

                    $isE = (float)($r['earned'] ?? 0) > 0;
                    $showBalInSetB = ($C['isSick'] || $C['isSetB_noDeduct'] || $C['isTerminal']) && !$isE && !$C['isDis'] && !$C['isForceDis'] && !$C['isMon'] && !$C['isMD'];

                    $updates[] = [
                        'record_id'    => $r['_record_id'],
                        'employee_id'  => $empId,
                        'setA_earned'  => round($rowAEarned, 3),
                        'setA_abs_wp'  => round($rowAAbsWP, 3),
                        'setA_balance' => $showBalInSetB ? 0 : round($bal, 3),
                        'setA_wop'     => round($rowAWOP, 3),
                        'setB_earned'  => 0,
                        'setB_abs_wp'  => round($rowBAbsWP, 3),
                        'setB_balance' => $showBalInSetB ? round($bal, 3) : 0,
                        'setB_wop'     => round($rowBWOP, 3),
                    ];
                }
            } else {
                $bV = 0; $bS = 0;
                foreach ($seg['recs'] as $r) {
                    if (empty($r['_record_id'])) continue;
                    $C = self::classifyLeave($r['action'] ?? '');
                    $rowAEarned = 0; $rowAAbsWP = 0; $rowAWOP = 0;
                    $rowBEarned = 0; $rowBAbsWP = 0; $rowBWOP  = 0;

                    if ($C['isTransfer']) {
                        $rowAEarned = (float)($r['trV'] ?? 0); $rowBEarned = (float)($r['trS'] ?? 0); $bV += $rowAEarned; $bS += $rowBEarned;
                    } elseif ($C['isAcc']) {
                        $v = ((float)($r['earned'] ?? 0) === 0.0 && !str_contains(strtolower($r['action'] ?? ''), 'service')) ? 1.25 : (float)($r['earned'] ?? 0);
                        $rowAEarned = $v; $rowBEarned = $v; $bV += $v; $bS += $v;
                    } elseif ((float)($r['earned'] ?? 0) > 0) {
                        $rowAEarned = (float)$r['earned']; $rowBEarned = (float)$r['earned']; $bV += $rowAEarned; $bS += $rowBEarned;
                    } elseif ($C['isMD']) {
                        $bV += (float)($r['monDV'] ?? 0); $bS += (float)($r['monDS'] ?? 0); $rowAAbsWP = (float)($r['monDV'] ?? 0); $rowBAbsWP = (float)($r['monDS'] ?? 0);
                    } elseif ($C['isForceDis']) {
                        $d = self::calcDays($r); $rowAAbsWP = $d; $bV += $d;
                    } elseif ($C['isMon']) {
                        $mV = (float)($r['monV'] ?? 0); $mS = (float)($r['monS'] ?? 0);
                        if ($bV >= $mV) { $rowAAbsWP = $mV; $bV -= $mV; } else { $rowAAbsWP = $bV; $rowAWOP = $mV - $bV; $bV = 0; }
                        if ($bS >= $mS) { $rowBAbsWP = $mS; $bS -= $mS; } else { $rowBAbsWP = $bS; $rowBWOP = $mS - $bS; $bS = 0; }
                    } elseif ($C['isDis'])      { /* no change */ }
                    elseif ($C['isPer'])        { $d = self::calcDays($r); if ($d > 0) $rowAWOP = $d; }
                    elseif ($C['isVacation'])   { $d = self::calcDays($r); if ($d > 0) { if ($bV >= $d) { $rowAAbsWP = $d; $bV -= $d; } else { $rowAAbsWP = $bV; $rowAWOP = $d - $bV; $bV = 0; } } }
                    elseif ($C['isSick'])       { $d = self::calcDays($r); if ($d > 0) { if ($bS >= $d) { $rowBAbsWP = $d; $bS -= $d; } else { $rowBAbsWP = $bS; $rowBWOP = $d - $bS; $bS = 0; } } }
                    elseif ($C['isForce'])      { $d = self::calcDays($r); if ($d > 0) { if ($bV >= $d) { $rowAAbsWP = $d; $bV -= $d; } else { $rowAAbsWP = $bV; $rowAWOP = $d - $bV; $bV = 0; } } }
                    elseif ($C['isTerminal'])   { $d = self::calcDays($r); if ($d > 0) { if ($bV >= $d) { $rowAAbsWP = $d; $bV -= $d; } else { $rowAAbsWP = $bV; $rowAWOP = $d - $bV; $bV = 0; } if ($bS >= $d) { $rowBAbsWP = $d; $bS -= $d; } else { $rowBAbsWP = $bS; $rowBWOP = $d - $bS; $bS = 0; } } }
                    elseif ($C['isSetB_noDeduct']) { $d = self::calcDays($r); if ($d > 0) $rowBAbsWP = $d; }
                    elseif ($C['isSetA_noDeduct']) { $d = self::calcDays($r); if ($d > 0) $rowAAbsWP = $d; }
                    else                           { $d = self::calcDays($r); if ($d > 0) $rowAAbsWP = $d; }

                    $updates[] = [
                        'record_id'    => $r['_record_id'],
                        'employee_id'  => $empId,
                        'setA_earned'  => round($rowAEarned, 3),
                        'setA_abs_wp'  => round($rowAAbsWP, 3),
                        'setA_balance' => round($bV, 3),
                        'setA_wop'     => round($rowAWOP, 3),
                        'setB_earned'  => round($rowBEarned, 3),
                        'setB_abs_wp'  => round($rowBAbsWP, 3),
                        'setB_balance' => round($bS, 3),
                        'setB_wop'     => round($rowBWOP, 3),
                    ];
                }
            }
        }
        return $updates;
    }

    private static function isTransferAction(string $action): bool
    {
        $a = strtolower($action);
        return str_contains($a, 'credit entry') || str_contains($a, 'from denr');
    }

    // ── Validation ──────────────────────────────────────────────
    public static function validateEmployeeId(string $id): ?string
    {
        if (!preg_match('/^\d{7}$/', $id)) return 'Invalid Employee No. — must be exactly 7 numbers.';
        return null;
    }

    public static function validateDepedEmail(string $email): ?string
    {
        if (!$email) return 'Email address is required.';
        if (!str_ends_with($email, '@deped.gov.ph')) return 'Email must use @deped.gov.ph domain.';
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) return 'Invalid email format.';
        return null;
    }

    public static function validateLeaveEntry(array $empRecords, array $newRec, int $editIdx, string $empStatus): ?string
    {
        $al   = strtolower($newRec['action'] ?? '');
        $from = $newRec['from'] ?? '';
        $year = $from ? (int)(new \DateTime($from))->format('Y') : null;
        if (!$year) return null;

        $existing = array_filter($empRecords, function($r, $i) use ($editIdx) {
            if (!empty($r['_conversion'])) return false;
            if ($editIdx >= 0 && $i === $editIdx) return false;
            return true;
        }, ARRAY_FILTER_USE_BOTH);

        $isForce = (str_contains($al, 'force') || str_contains($al, 'mandatory')) && !str_contains($al, 'disapproved');
        if ($isForce) {
            $forceDays = (float)($newRec['forceAmount'] ?? 0) > 0 ? (float)$newRec['forceAmount'] : self::calcDays($newRec);
            if ($forceDays > 5) return "⚠️ Force/Mandatory Leave cannot exceed 5 days per year. You entered {$forceDays} day(s).";
            $existingForce = array_filter($existing, function($r) use ($year) {
                $ra = strtolower($r['action'] ?? '');
                $ry = $r['from'] ? (int)(new \DateTime($r['from']))->format('Y') : null;
                return (str_contains($ra, 'force') || str_contains($ra, 'mandatory')) && !str_contains($ra, 'disapproved') && $ry === $year;
            });
            if (count($existingForce) > 0) return "⚠️ Force/Mandatory Leave is only allowed ONCE per year ({$year}). A Force Leave entry already exists.";
        }

        if (str_contains($al, 'magna carta') || str_contains($al, 'special leave benefit')) {
            $newDays = self::calcDays($newRec);
            $existingDays = array_sum(array_map(function($r) use ($year) {
                $ra = strtolower($r['action'] ?? '');
                $ry = $r['from'] ? (int)(new \DateTime($r['from']))->format('Y') : null;
                return (str_contains($ra, 'magna carta') || str_contains($ra, 'special leave benefit')) && $ry === $year ? self::calcDays($r) : 0;
            }, $existing));
            $total = $existingDays + $newDays;
            if ($total > 60) return "⚠️ Special Leave Benefits for Women (Magna Carta) cannot exceed 60 days per year. Total: {$total} day(s).";
        }

        if ((float)($newRec['earned'] ?? 0) > 0 && $empStatus === 'Non-Teaching') {
            $existingEarned = array_sum(array_map(function($r) use ($year) {
                $ry = ($r['from'] ?? '') ? (int)(new \DateTime($r['from']))->format('Y') : null;
                return ((float)($r['earned'] ?? 0) > 0 && $ry === $year) ? (float)$r['earned'] : 0;
            }, $existing));
            $totalEarned = $existingEarned + (float)$newRec['earned'];
            if ($totalEarned > 15) return "⚠️ Non-Teaching leave accrual cannot exceed 15 days per year. Total: " . number_format($totalEarned, 3) . " days.";
        }
        return null;
    }
}
