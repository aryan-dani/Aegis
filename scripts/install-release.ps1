param(
  [string]$Version = "0.1.6",
  [string]$Repo = "aryan-dani/aegis"
)

$ErrorActionPreference = "Stop"

function Step($message) {
  Write-Host "==> $message" -ForegroundColor Cyan
}

$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$installerName = "Aegis_${Version}_x64-setup.exe"
$downloadDir = Join-Path $root "src-tauri\target\release\bundle\nsis"
$installerPath = Join-Path $downloadDir $installerName

New-Item -ItemType Directory -Force -Path $downloadDir | Out-Null

if (-not (Test-Path $installerPath)) {
  Step "Downloading $installerName from GitHub release v$Version"

  $ghCandidates = @(
    "gh",
    "$env:ProgramFiles\GitHub CLI\gh.exe",
    "$env:LOCALAPPDATA\GitHub CLI\gh.exe"
  )
  $gh = $ghCandidates | Where-Object {
    if ($_ -eq "gh") {
      Get-Command gh -ErrorAction SilentlyContinue
    } else {
      Test-Path $_
    }
  } | Select-Object -First 1

  if ($gh) {
    & $gh release download "v$Version" --repo $Repo --pattern $installerName --dir $downloadDir --clobber
  } else {
    $url = "https://github.com/$Repo/releases/download/v$Version/$installerName"
    Invoke-WebRequest -Uri $url -OutFile $installerPath
  }
}

if (-not (Test-Path $installerPath)) {
  throw "Installer was not found or downloaded: $installerPath"
}

Step "Launching installer"
Unblock-File -Path $installerPath -ErrorAction SilentlyContinue
Start-Process -FilePath $installerPath
Write-Host "Started installer: $installerPath" -ForegroundColor Green
