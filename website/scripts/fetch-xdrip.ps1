# Mirror the current xDrip+ release into website/downloads/ for the CareSens help topic.
#
# xDrip+ is GPL-3.0 software from the Nightscout community. We serve the upstream
# build byte-for-byte and the help page links to the source. Do not repackage or
# resign the APK, that would make us the distributor of a modified medical-adjacent
# app.
#
# ASCII only in this file, deliberately. PowerShell 5.1 reads a BOM-less script in
# the machine's ANSI codepage, not UTF-8. On a Hebrew Windows that is CP1255, where
# the third byte of an em dash decodes to a right curly quote -- which PowerShell
# treats as a string delimiter, so one dash in a comment made the whole script fail
# to parse. Same file parsed fine on an English machine, which is the worst kind of
# bug to leave in a release script.
$ErrorActionPreference = "Stop"
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$DstDir = Join-Path $Root "website\downloads"
$Apk = Join-Path $DstDir "xdrip-plus.apk"
$Note = Join-Path $DstDir "xdrip-plus-version.txt"

$release = Invoke-RestMethod -Uri "https://api.github.com/repos/NightscoutFoundation/xDrip/releases/latest" `
  -Headers @{ "User-Agent" = "healthings-website" }

# Upstream also publishes variant1..4 builds (alternate app IDs for people running
# two copies side by side). A CareSens user wants the plain one.
$asset = $release.assets |
  Where-Object { $_.name -match '^xDrip-plus-\d{8}-[0-9a-f]+\.apk$' } |
  Select-Object -First 1

if (-not $asset) {
  Write-Error "No plain xDrip-plus APK in release $($release.tag_name) - check the asset names before mirroring."
}

New-Item -ItemType Directory -Force -Path $DstDir | Out-Null
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $Apk

$sha = (Get-FileHash -Algorithm SHA256 $Apk).Hash.ToLower()
$size = [math]::Round((Get-Item $Apk).Length / 1MB, 1)

@(
  "xDrip+ mirror on healthings.ai",
  "upstream: $($asset.browser_download_url)",
  "release:  $($release.tag_name)",
  "file:     $($asset.name)",
  "sha256:   $sha",
  "mirrored: $(Get-Date -Format 'yyyy-MM-dd')",
  "licence:  GPL-3.0 - source at https://github.com/NightscoutFoundation/xDrip"
) | Set-Content -Path $Note -Encoding utf8

Write-Host "OK - $($asset.name) (${size} MB) -> website\downloads\xdrip-plus.apk"
Write-Host "sha256 $sha"
Write-Host "Upload to the VPS, then: bash server/scripts/deploy-website.sh"
