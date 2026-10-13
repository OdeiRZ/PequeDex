<#
.SYNOPSIS
  Pasa en local TODO lo que pasa la CI, para no descubrir los fallos después de
  subir. Se para en el primer fallo y dice cuál.

.DESCRIPTION
  Backend: Pint, PHPStan, Pest sobre SQLite y (si hay un PostgreSQL local) Pest
  sobre PostgreSQL. Frontend: Prettier, ESLint, tipos, Vitest, build y e2e
  (Playwright). Más las auditorías de dependencias de producción.

  PostgreSQL local (opcional, recomendado): un PostgreSQL 18 portátil en
  $env:PEQUEDEX_PG_DIR (por defecto ~\.claude\tools\postgres18) con una base
  `pequedex_test`, usuario/contraseña postgres/postgres, puerto 5433. Si existe,
  el script lo arranca si hace falta y lo para al terminar. La CI corre las pruebas
  también sobre PostgreSQL (job "Backend on PostgreSQL") y una vez falló solo ahí:
  un error de clave única deja abortada la transacción, algo que SQLite no hace.

.PARAMETER SkipE2E
  Salta Playwright (el paso más lento, ~1 min).

.PARAMETER SkipPostgres
  Salta las pruebas sobre PostgreSQL aunque esté instalado.

.EXAMPLE
  ./scripts/verify.ps1
  ./scripts/verify.ps1 -SkipE2E
#>
param(
  [switch]$SkipE2E,
  [switch]$SkipPostgres
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$api = Join-Path $root 'api'
$web = Join-Path $root 'web'
$pgDir = if ($env:PEQUEDEX_PG_DIR) { $env:PEQUEDEX_PG_DIR } else { Join-Path $env:USERPROFILE '.claude\tools\postgres18' }
$pgPort = 5433

$results = [System.Collections.Generic.List[object]]::new()

function Step([string]$name, [scriptblock]$body) {
  Write-Host "`n=== $name" -ForegroundColor Cyan
  $started = Get-Date
  $global:LASTEXITCODE = 0
  & $body
  if ($LASTEXITCODE -ne 0) {
    Write-Host "FALLO en: $name (código $LASTEXITCODE)" -ForegroundColor Red
    exit $LASTEXITCODE
  }
  $seconds = [math]::Round(((Get-Date) - $started).TotalSeconds)
  $results.Add([pscustomobject]@{ Paso = $name; Segundos = $seconds })
}

# --- PostgreSQL local (si está instalado) -------------------------------------
$pgBin = Join-Path $pgDir 'pgsql\bin'
$pgData = Join-Path $pgDir 'data'
$usePostgres = (-not $SkipPostgres) -and (Test-Path (Join-Path $pgBin 'pg_ctl.exe'))
$startedPostgres = $false

if ($usePostgres) {
  $listening = Test-NetConnection -ComputerName 127.0.0.1 -Port $pgPort -InformationLevel Quiet -WarningAction SilentlyContinue
  if (-not $listening) {
    Write-Host 'Arrancando el PostgreSQL local...' -ForegroundColor DarkGray
    Start-Process -FilePath (Join-Path $pgBin 'pg_ctl.exe') -WindowStyle Hidden -Wait `
      -ArgumentList @('-D', "`"$pgData`"", '-o', "`"-p $pgPort -c listen_addresses=127.0.0.1 -c fsync=off`"", '-l', "`"$pgDir\pg.log`"", 'start')
    $startedPostgres = $true
  }
} elseif (-not $SkipPostgres) {
  Write-Host 'Aviso: no hay PostgreSQL local; se salta la prueba sobre PostgreSQL (la CI la hará).' -ForegroundColor Yellow
}

try {
  # --- Backend ----------------------------------------------------------------
  Push-Location $api
  Step 'Backend: Pint (estilo)' { vendor\bin\pint --test }
  Step 'Backend: PHPStan' { vendor\bin\phpstan analyse --memory-limit=1G --no-progress }
  Step 'Backend: Pest (SQLite)' { php artisan test }

  if ($usePostgres) {
    Step 'Backend: Pest (PostgreSQL)' {
      $env:DB_CONNECTION = 'pgsql'; $env:DB_HOST = '127.0.0.1'; $env:DB_PORT = "$pgPort"
      $env:DB_DATABASE = 'pequedex_test'; $env:DB_USERNAME = 'postgres'; $env:DB_PASSWORD = 'postgres'
      try { php artisan test }
      finally { 'DB_CONNECTION', 'DB_HOST', 'DB_PORT', 'DB_DATABASE', 'DB_USERNAME', 'DB_PASSWORD' | ForEach-Object { Remove-Item "Env:$_" -ErrorAction SilentlyContinue } }
    }
  }
  Step 'Backend: composer audit' { composer audit --no-interaction }
  Pop-Location

  # --- Frontend ---------------------------------------------------------------
  Push-Location $web
  Step 'Frontend: Prettier (la CI lo comprueba)' { npx prettier --check src/ }
  Step 'Frontend: ESLint' { npx eslint . }
  Step 'Frontend: tipos (vue-tsc)' { npx vue-tsc --build }
  Step 'Frontend: Vitest' { npx vitest run }
  Step 'Frontend: build' { npm run build }
  Step 'Frontend: npm audit (producción)' { npm audit --omit=dev }
  if (-not $SkipE2E) { Step 'Frontend: e2e (Playwright)' { npx playwright test } }
  Pop-Location

  Write-Host "`nTODO EN VERDE" -ForegroundColor Green
  $results | Format-Table -AutoSize
}
finally {
  Pop-Location -ErrorAction SilentlyContinue
  if ($startedPostgres) {
    Write-Host 'Parando el PostgreSQL local que arrancó este script.' -ForegroundColor DarkGray
    Start-Process -FilePath (Join-Path $pgBin 'pg_ctl.exe') -WindowStyle Hidden -Wait -ArgumentList @('-D', "`"$pgData`"", '-m', 'fast', 'stop')
  }
}
