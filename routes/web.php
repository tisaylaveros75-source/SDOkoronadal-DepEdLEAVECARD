<?php

use Illuminate\Support\Facades\Route;

// All web routes serve the SPA shell
Route::get('/{any?}', function () {
    return view('app');
})->where('any', '.*');
