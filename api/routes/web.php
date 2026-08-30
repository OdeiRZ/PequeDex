<?php

use Illuminate\Support\Facades\Route;

// Backend is API-only (the actual UI is the separate Vue SPA in web/); this
// just gives a human landing on the API's own domain something other than a
// blank 404, and doubles as a trivial uptime check.
Route::get('/', fn () => response()->json(['app' => 'PequeDex API', 'status' => 'ok']));
