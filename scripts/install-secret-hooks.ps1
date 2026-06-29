# Install pre-commit hooks (gitleaks) — run once per machine
$ErrorActionPreference = "Stop"
pip install pre-commit
Set-Location (Split-Path $PSScriptRoot -Parent)
pre-commit install
Write-Host "OK — gitleaks will run on each commit. Test: pre-commit run --all-files"
