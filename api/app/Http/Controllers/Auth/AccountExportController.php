<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Users\AccountExporter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccountExportController extends Controller
{
    /** Todos los datos de la cuenta en un JSON descargable (`pequedex-datos.json`). */
    public function show(Request $request, AccountExporter $exporter): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json($exporter->export($user), headers: [
            'Content-Disposition' => 'attachment; filename="pequedex-datos.json"',
        ], options: JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
}
