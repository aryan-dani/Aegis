<#
.SYNOPSIS
  Capture LinkedIn marketing screenshots from the Vite marketing preview.

.EXAMPLE
  pwsh scripts/capture-marketing-screenshots.ps1
#>

$ErrorActionPreference = "Stop"

$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$outDir = Join-Path $root "docs/marketing/screenshots"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$port = 1423
$env:VITE_AEGIS_MARKETING = "true"

Write-Host "Starting marketing preview on port $port..." -ForegroundColor Cyan
$devJob = Start-Job -ScriptBlock {
  param($root, $port)
  Set-Location $root
  $env:VITE_AEGIS_MARKETING = "true"
  & pnpm vite --port $port --strictPort
} -ArgumentList $root, $port

try {
  $ready = $false
  $deadline = (Get-Date).AddSeconds(45)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri "http://localhost:$port/marketing.html" -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -eq 200) {
        $ready = $true
        break
      }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }
  if (-not $ready) {
    throw "Marketing preview did not start on port $port."
  }

  if (-not (Test-Path (Join-Path $root "node_modules/playwright"))) {
    Write-Host "Installing Playwright (one-time)..." -ForegroundColor DarkGray
    pnpm add -D playwright | Out-Null
    pnpm exec playwright install chromium | Out-Null
  }

  node (Join-Path $root "scripts/capture-marketing-screenshots.cjs") $outDir $port
  Write-Host "Saved screenshots to $outDir" -ForegroundColor Green
}
finally {
  if ($devJob) {
    Stop-Job -Job $devJob -ErrorAction SilentlyContinue
    Remove-Job -Job $devJob -Force -ErrorAction SilentlyContinue
  }
}
