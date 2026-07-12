# bi-os.ps1 — iOS TestFlight pipeline (proven two-step path on Windows).
# 1. EAS cloud build (production IPA) — NO --auto-submit (Apple ID/SMS trap)
# 2. eas submit --latest (ASC API key via asc-api.local.ps1)
#
# Progress:
#   - Stage banners with timestamps
#   - Upload keeps the EAS MB counter (no --json during upload)
#   - After queue, polls build status every 30s until Finished/Errored
#
# Guide: server/TESTFLIGHT-INTERNAL.md

# Continue: native eas stderr must not abort before $LASTEXITCODE checks.
# Stop + "(upload / ...)" in double-quoted args breaks PS argument parsing.
$ErrorActionPreference = "Continue"
$AppRoot = Split-Path $PSScriptRoot -Parent
Set-Location $AppRoot

# Keep EAS upload progress bar (CI=1 often hides the MB counter).
if ($env:CI -eq "1" -or $env:CI -eq "true") {
  Remove-Item Env:CI -ErrorAction SilentlyContinue
  Write-Host "[bi-os] Cleared CI=1 so EAS can show upload progress."
}

function Write-BiosStep {
  param(
    [Parameter(Mandatory = $true)][string]$Message,
    [string]$Color = "Cyan"
  )
  $ts = Get-Date -Format "HH:mm:ss"
  Write-Host ""
  Write-Host ("[{0}] {1}" -f $ts, $Message) -ForegroundColor $Color
}

function Write-BiosInfo {
  param([Parameter(Mandatory = $true)][string]$Message)
  $ts = Get-Date -Format "HH:mm:ss"
  Write-Host ("[{0}]   {1}" -f $ts, $Message) -ForegroundColor DarkGray
}

function Get-LatestIosBuildId {
  $listPath = Join-Path $env:TEMP ("bi-os-list-{0}.json" -f [guid]::NewGuid().ToString("N"))
  try {
    & eas build:list --platform ios --limit 1 --json --non-interactive 2>$null | Out-File -FilePath $listPath -Encoding utf8
    $raw = Get-Content -Raw -Path $listPath
    $jsonText = ($raw -split "(?=\r?\n\[)" | Where-Object { $_.Trim().StartsWith("[") } | Select-Object -Last 1)
    if (-not $jsonText) {
      $jsonText = ($raw -split "(?=\r?\n\{)" | Where-Object { $_.Trim().StartsWith("{") } | Select-Object -Last 1)
    }
    if (-not $jsonText) { $jsonText = $raw.Trim() }
    $obj = $jsonText | ConvertFrom-Json
    if ($obj -is [Array]) {
      if ($obj.Count -eq 0) { return $null }
      return [string]$obj[0].id
    }
    if ($obj.id) { return [string]$obj.id }
    return $null
  } catch {
    return $null
  } finally {
    Remove-Item $listPath -Force -ErrorAction SilentlyContinue
  }
}

function Get-BuildStatus {
  param([Parameter(Mandatory = $true)][string]$BuildId)
  # Prefer human table (reliable on Windows). JSON path broke when --non-interactive
  # was passed (unsupported) or when Out-File added a UTF-8 BOM.
  try {
    $humanPath = Join-Path $env:TEMP ("bi-os-view-h-{0}.txt" -f [guid]::NewGuid().ToString("N"))
    $jsonPath = Join-Path $env:TEMP ("bi-os-view-j-{0}.txt" -f [guid]::NewGuid().ToString("N"))
    try {
      cmd /c "eas build:view $BuildId > `"$humanPath`" 2>nul"
      if (Test-Path $humanPath) {
        $human = [System.IO.File]::ReadAllText($humanPath)
        if ($human -match '(?im)^\s*Status\s+(\S+)') {
          return [string]$Matches[1]
        }
      }

      cmd /c "eas build:view $BuildId --json > `"$jsonPath`" 2>nul"
      if (Test-Path $jsonPath) {
        $viewRaw = [System.IO.File]::ReadAllText($jsonPath)
        if ($viewRaw.Length -gt 0 -and [int][char]$viewRaw[0] -eq 0xFEFF) {
          $viewRaw = $viewRaw.Substring(1)
        }
        $viewJson = ($viewRaw -split "(?=\r?\n\{)" | Where-Object { $_.Trim().StartsWith("{") } | Select-Object -Last 1)
        if (-not $viewJson) { $viewJson = $viewRaw.Trim() }
        if ($viewJson) {
          $viewObj = $viewJson | ConvertFrom-Json
          if ($viewObj.status) { return [string]$viewObj.status }
          if ($viewObj.Status) { return [string]$viewObj.Status }
        }
      }
      return "poll-error"
    } finally {
      Remove-Item $humanPath, $jsonPath -Force -ErrorAction SilentlyContinue
    }
  } catch {
    return "poll-error"
  }
}

if (-not (Get-Command eas -ErrorAction SilentlyContinue)) {
  Write-Error "EAS CLI not found. Run: npm install -g eas-cli  then  eas login"
}

$AscLocal = Join-Path $AppRoot "asc-api.local.ps1"
if (Test-Path $AscLocal) {
  Write-BiosStep -Message "Loading ASC API key (asc-api.local.ps1)..." -Color "Yellow"
  . $AscLocal
  Set-Location $AppRoot
} else {
  Write-Host ""
  Write-Host "WARN: Missing asc-api.local.ps1 - submit may ask for Apple ID (SMS fails on Windows)." -ForegroundColor Yellow
  Write-Host "  Copy asc-api.local.ps1.example -> asc-api.local.ps1 and fill Key ID / Issuer / .p8 path."
  Write-Host "  See server/TESTFLIGHT-INTERNAL.md section 1b."
  Write-Host ""
}

$pipelineStart = Get-Date
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " bi-os: iOS TestFlight (build + submit)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-BiosInfo -Message "Expect ~10-20 min total (upload + EAS Mac build + submit)."
Write-BiosInfo -Message "At Apple account login during build, answer: n"
Write-Host ""

# --- Step 1: upload (keep live MB counter — do NOT use --json here) ---
Write-BiosStep -Message "Step 1 of 3 - Compress + upload to EAS" -Color "Green"
Write-BiosInfo -Message "Watch the MB counter below during upload."
Write-BiosInfo -Message "Large archives can take several minutes. This is normal."
Write-Host ""

& eas build --platform ios --profile production --no-wait
if ($LASTEXITCODE -ne 0) {
  Write-BiosStep -Message "=== bi-os FAILED: upload or start build ===" -Color "Red"
  exit $LASTEXITCODE
}

$buildId = Get-LatestIosBuildId
$buildUrl = $null
if ($buildId) {
  $buildUrl = "https://expo.dev/accounts/ravivshweids-team/projects/healthingsai-medilab/builds/$buildId"
}

# --- Step 2: poll cloud build ---
Write-BiosStep -Message "Step 2 of 3 - Cloud build on EAS Mac" -Color "Green"
if ($buildId) {
  Write-BiosInfo -Message ("Build ID: {0}" -f $buildId)
  Write-BiosInfo -Message ("Logs: {0}" -f $buildUrl)
  Write-BiosInfo -Message "Polling every 30s (typical: 8-15 min). Status changes print in white."
  Write-BiosInfo -Message "If status stays poll-error, open Logs URL; when Finished: .\submit-ios.bat"
  $pollStart = Get-Date
  $lastStatus = ""
  $pollErrors = 0
  $terminal = @("finished", "errored", "canceled", "cancelled")
  while ($true) {
    Start-Sleep -Seconds 30
    $status = Get-BuildStatus -BuildId $buildId
    $elapsedMin = [math]::Round(((Get-Date) - $pollStart).TotalMinutes, 1)
    $ts = Get-Date -Format "HH:mm:ss"
    if ($status -eq "poll-error") {
      $pollErrors++
      if ($pollErrors -eq 3 -or ($pollErrors % 10 -eq 0)) {
        Write-Host ("[{0}]   poll-error x{1} - check {2}" -f $ts, $pollErrors, $buildUrl) -ForegroundColor Yellow
        Write-Host ("[{0}]   When expo.dev says Finished: Ctrl+C then .\submit-ios.bat" -f $ts) -ForegroundColor Yellow
      }
    } else {
      $pollErrors = 0
    }
    if ($status -ne $lastStatus) {
      Write-Host ("[{0}]   status: {1}  (elapsed {2} min)" -f $ts, $status, $elapsedMin) -ForegroundColor White
      $lastStatus = $status
    } else {
      Write-Host ("[{0}]   still {1}...  ({2} min)" -f $ts, $status, $elapsedMin) -ForegroundColor DarkGray
    }
    $statusLower = $status.ToLowerInvariant()
    if ($terminal -contains $statusLower) {
      if ($statusLower -ne "finished") {
        Write-BiosStep -Message ("=== bi-os FAILED: build status {0} ===" -f $status) -Color "Red"
        if ($buildUrl) { Write-Host "  $buildUrl" }
        exit 1
      }
      Write-BiosStep -Message ("EAS build finished ({0} min on cloud)" -f $elapsedMin) -Color "Green"
      break
    }
  }
} else {
  Write-BiosInfo -Message "Could not resolve build id - using eas build --wait for live output."
  & eas build --platform ios --profile production --wait
  if ($LASTEXITCODE -ne 0) {
    Write-BiosStep -Message "=== bi-os FAILED: build ===" -Color "Red"
    exit $LASTEXITCODE
  }
}

# --- Step 3: submit ---
Write-BiosStep -Message "Step 3 of 3 - Submit IPA to App Store Connect (TestFlight)" -Color "Green"
Write-BiosInfo -Message "Uses ASC API key - no SMS."
& eas submit --platform ios --profile production --latest
if ($LASTEXITCODE -ne 0) {
  Write-BiosStep -Message "=== bi-os FAILED: submit ===" -Color "Red"
  Write-BiosInfo -Message "Build may still be on expo.dev - retry: .\submit-ios.bat"
  exit $LASTEXITCODE
}

$totalMin = [math]::Round(((Get-Date) - $pipelineStart).TotalMinutes, 1)
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host (" bi-os DONE  (total {0} min)" -f $totalMin) -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-BiosInfo -Message "Next: App Store Connect -> TestFlight -> wait Processing -> Install / Update."
Write-BiosInfo -Message "Guide: server/TESTFLIGHT-INTERNAL.md"
