<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Admin / Encoder / School Admin accounts
        Schema::create('admin_config', function (Blueprint $table) {
            $table->id();
            $table->string('login_id')->unique();
            $table->string('password');
            $table->string('name');
            $table->enum('role', ['admin', 'encoder', 'school_admin'])->default('encoder');
            $table->timestamps();
        });

        // Personnel / Employees
        Schema::create('personnel', function (Blueprint $table) {
            $table->string('employee_id', 20)->primary();
            $table->string('email')->unique();
            $table->string('password');
            $table->string('surname', 100)->default('');
            $table->string('given', 100)->default('');
            $table->string('suffix', 20)->default('');
            $table->string('maternal', 100)->default('');
            $table->string('sex', 10)->default('');
            $table->string('civil', 30)->default('');
            $table->date('dob')->nullable();
            $table->string('pob', 200)->default('');
            $table->text('addr')->nullable();
            $table->string('spouse', 200)->default('');
            $table->text('edu')->nullable();
            $table->text('elig')->nullable();
            $table->string('rating', 50)->default('');
            $table->string('tin', 50)->default('');
            $table->string('pexam', 100)->default('');
            $table->date('dexam')->nullable();
            $table->date('appt')->nullable();
            $table->enum('status', ['Teaching', 'Non-Teaching', 'Teaching Related'])->default('Teaching');
            $table->enum('account_status', ['active', 'inactive'])->default('active');
            $table->string('pos', 200)->default('');
            $table->string('school', 200)->default('');
            $table->timestamp('last_edited_at')->nullable();
            $table->timestamps();
        });

        // Leave Records
        Schema::create('leave_records', function (Blueprint $table) {
            $table->id('record_id');
            $table->string('employee_id', 20);
            $table->integer('sort_order')->default(0);
            $table->string('so', 100)->default('');
            $table->string('prd', 100)->default('');
            $table->date('from_date')->nullable();
            $table->date('to_date')->nullable();
            $table->enum('fromPeriod', ['AM', 'PM', 'WD'])->default('WD');
            $table->enum('toPeriod', ['AM', 'PM', 'WD'])->default('WD');
            $table->string('spec', 200)->default('');
            $table->string('action', 255)->default('');
            $table->decimal('force_amount', 10, 3)->default(0);
            $table->decimal('setA_earned', 10, 3)->default(0);
            $table->decimal('setA_abs_wp', 10, 3)->default(0);
            $table->decimal('setA_balance', 10, 3)->default(0);
            $table->decimal('setA_wop', 10, 3)->default(0);
            $table->decimal('setB_earned', 10, 3)->default(0);
            $table->decimal('setB_abs_wp', 10, 3)->default(0);
            $table->decimal('setB_balance', 10, 3)->default(0);
            $table->decimal('setB_wop', 10, 3)->default(0);
            $table->tinyInteger('is_conversion')->default(0);
            $table->string('from_status', 50)->default('');
            $table->string('to_status', 50)->default('');
            $table->date('conversion_date')->nullable();
            $table->timestamps();

            $table->foreign('employee_id')->references('employee_id')->on('personnel')->onDelete('cascade');
            $table->index(['employee_id', 'sort_order']);
        });

        // Seed default admin account
        DB::table('admin_config')->insert([
            ['login_id' => 'admin@deped.gov.ph', 'password' => 'admin123', 'name' => 'System Administrator', 'role' => 'admin'],
            ['login_id' => 'encoder@deped.gov.ph', 'password' => 'encoder123', 'name' => 'Leave Encoder', 'role' => 'encoder'],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('leave_records');
        Schema::dropIfExists('personnel');
        Schema::dropIfExists('admin_config');
    }
};
