# bi-os.ps1 - iOS TestFlight pipeline (Windows).
# Three timed stages, ONE eas build only:
#   1. Upload - eas build --no-wait; status check every 30s
#   2. Build  - quiet wait 5 min, then poll same build id every 30s
#   3. Submit - eas submit --latest -> exit (Apple emails when TF ready)
#
# Never start a second eas build (that caused duplicate Expo rows).
# Never use --auto-submit (Apple ID / SMS trap on Windows).
#
# Guide: server/TESTFLIGHT-INTERNAL.md

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

function Get-BuildIdFromText {
  param([Parameter(Mandatory = $true)][string]$Text)
  if ($Text -match 'builds/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})') {
    return [string]$Matches[1]
  }
  return $null
}

function Get-LatestIosBuildId {
  $listPath = Join-Path $env:TEMP ("bi-os-list-{0}.json" -f [guid]::NewGuid().ToString("N"))
  try {
    cmd /c "eas build:list --platform ios --limit 1 --json --non-interactive > `"$listPath`" 2>nul"
    if (-not (Test-Path $listPath)) { return $null }
    $raw = [System.IO.File]::ReadAllText($listPath)
    if ($raw.Length -gt 0 -and [int][char]$raw[0] -eq 0xFEFF) {
      $raw = $raw.Substring(1)
    }
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
Write-Host " bi-os: iOS TestFlight (3 stages, 1 build)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-BiosInfo -Message "Protocol: upload check 30s | build quiet 5 min then poll 30s | submit -> exit"
Write-BiosInfo -Message "At Apple account login during build, answer: n"
Write-Host ""

# --- Stage 1: upload (ONE build) - status check every 30s ---
Write-BiosStep -Message "Stage 1/3 - Upload to EAS  (est. ~1-2 min, check every 30s)" -Color "Green"
Write-BiosInfo -Message "Do not Ctrl+C."
Write-Host ""

$uploadLog = Join-Path $env:TEMP ("bi-os-upload-{0}.log" -f [guid]::NewGuid().ToString("N"))
$uploadErr = Join-Path $env:TEMP ("bi-os-upload-{0}.err" -f [guid]::NewGuid().ToString("N"))
$uploadStart = Get-Date
$easCmd = (Get-Command eas).Source
$uploadProc = Start-Process -FilePath $easCmd -ArgumentList @(
  "build", "--platform", "ios", "--profile", "production", "--no-wait"
) -WorkingDirectory $AppRoot -NoNewWindow -PassThru `
  -RedirectStandardOutput $uploadLog -RedirectStandardError $uploadErr

while (-not $uploadProc.HasExited) {
  Start-Sleep -Seconds 30
  $elapsedMin = [math]::Round(((Get-Date) - $uploadStart).TotalMinutes, 1)
  $ts = Get-Date -Format "HH:mm:ss"
  Write-Host ("[{0}]   upload check - still running ({1} min)" -f $ts, $elapsedMin) -ForegroundColor DarkGray
  foreach ($logFile in @($uploadLog, $uploadErr)) {
    if (Test-Path $logFile) {
      $tail = Get-Content -Path $logFile -Tail 3 -ErrorAction SilentlyContinue
      foreach ($line in $tail) {
        if ($line -and $line.Trim().Length -gt 0) {
          Write-Host ("[{0}]     {1}" -f $ts, $line.Trim()) -ForegroundColor DarkGray
        }
      }
    }
  }
}

$uploadProc.WaitForExit() | Out-Null
$uploadExit = $uploadProc.ExitCode
$uploadMin = [math]::Round(((Get-Date) - $uploadStart).TotalMinutes, 1)

# Merge stderr into log for id parse (EAS often prints URL on stderr)
$uploadText = ""
if (Test-Path $uploadLog) { $uploadText += [System.IO.File]::ReadAllText($uploadLog) }
if (Test-Path $uploadErr) {
  $errText = [System.IO.File]::ReadAllText($uploadErr)
  $uploadText += "`n" + $errText
  if ($errText.Trim().Length -gt 0) {
    Write-Host $errText
  }
}
if (Test-Path $uploadLog) {
  $outText = [System.IO.File]::ReadAllText($uploadLog)
  if ($outText.Trim().Length -gt 0) { Write-Host $outText }
}

if ($uploadExit -ne 0) {
  Write-BiosStep -Message ("=== bi-os FAILED: upload (exit {0}) ===" -f $uploadExit) -Color "Red"
  Remove-Item $uploadLog, $uploadErr -Force -ErrorAction SilentlyContinue
  exit $uploadExit
}

$buildId = Get-BuildIdFromText -Text $uploadText
if (-not $buildId) {
  Write-BiosInfo -Message "Build id not in upload log - checking eas build:list every 30s..."
  for ($i = 1; $i -le 10; $i++) {
    Start-Sleep -Seconds 30
    $buildId = Get-LatestIosBuildId
    $ts = Get-Date -Format "HH:mm:ss"
    if ($buildId) {
      Write-Host ("[{0}]   build id resolved on list check #{1}" -f $ts, $i) -ForegroundColor White
      break
    }
    Write-Host ("[{0}]   upload/list check #{1} - no build id yet" -f $ts, $i) -ForegroundColor DarkGray
  }
}
Remove-Item $uploadLog, $uploadErr -Force -ErrorAction SilentlyContinue

if (-not $buildId) {
  Write-BiosStep -Message "=== bi-os FAILED: could not resolve build id after upload ===" -Color "Red"
  Write-BiosInfo -Message "A build may already be running on expo.dev - do NOT re-run bi-os."
  Write-BiosInfo -Message "Open expo.dev, wait until Finished, then: .\submit-ios.bat"
  exit 1
}

$buildUrl = "https://expo.dev/accounts/ravivshweids-team/projects/healthingsai-medilab/builds/$buildId"
Write-BiosStep -Message ("Upload done ({0} min) - build id {1}" -f $uploadMin, $buildId) -Color "Green"
Write-BiosInfo -Message $buildUrl

# --- Stage 2: quiet 5 min, then poll every 30s (never eas build again) ---
Write-BiosStep -Message "Stage 2/3 - Cloud build  (quiet 5 min, then check every 30s)" -Color "Green"
Write-BiosInfo -Message "Paid EAS typical ~4-5 min - sleeping 5 min before first status check."
$pollStart = Get-Date
for ($m = 1; $m -le 5; $m++) {
  Start-Sleep -Seconds 60
  $ts = Get-Date -Format "HH:mm:ss"
  Write-Host ("[{0}]   build quiet wait... {1}/5 min" -f $ts, $m) -ForegroundColor DarkGray
}

$lastStatus = ""
$pollErrors = 0
$terminal = @("finished", "errored", "canceled", "cancelled")
Write-BiosInfo -Message "First status check now; then every 30s until Finished."
while ($true) {
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
      Write-Host "  $buildUrl"
      exit 1
    }
    Write-BiosStep -Message ("Build finished ({0} min on cloud)" -f $elapsedMin) -Color "Green"
    break
  }
  Start-Sleep -Seconds 30
}

# --- Stage 3: submit then exit (Apple emails when TestFlight is ready) ---
Write-BiosStep -Message "Stage 3/3 - Submit to App Store Connect  (est. ~1-2 min)" -Color "Green"
Write-BiosInfo -Message "Uses ASC API key - no SMS. Then exit - Apple will email when ready."
$submitStart = Get-Date
& eas submit --platform ios --profile production --latest
if ($LASTEXITCODE -ne 0) {
  Write-BiosStep -Message "=== bi-os FAILED: submit ===" -Color "Red"
  Write-BiosInfo -Message "Build is on expo.dev - retry: .\submit-ios.bat"
  exit $LASTEXITCODE
}
$submitMin = [math]::Round(((Get-Date) - $submitStart).TotalMinutes, 1)

$totalMin = [math]::Round(((Get-Date) - $pipelineStart).TotalMinutes, 1)
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host (" bi-os DONE  (total {0} min)" -f $totalMin) -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-BiosInfo -Message ("Stages: upload {0} min | build (above) | submit {1} min" -f $uploadMin, $submitMin)
Write-BiosInfo -Message "Submitted. Apple will email when TestFlight is ready - protocol complete."
Write-BiosInfo -Message "Guide: server/TESTFLIGHT-INTERNAL.md"
exit 0
