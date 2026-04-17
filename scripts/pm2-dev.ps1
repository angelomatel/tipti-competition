param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidateSet('start', 'stop', 'restart', 'status', 'logs')]
  [string]$Action,

  [Parameter(Position = 1)]
  [ValidateSet('all', 'frontend', 'backend', 'bot')]
  [string]$Target = 'all'
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ecosystemFile = Join-Path $repoRoot 'ecosystem.dev.config.js'
$appNames = @{
  frontend = 'frontend-dev'
  backend = 'backend-dev'
  bot = 'tipti-clanker-dev'
}

function Get-SelectedApps {
  param([string]$Selection)

  if ($Selection -eq 'all') {
    return @('frontend-dev', 'backend-dev', 'tipti-clanker-dev')
  }

  return @($appNames[$Selection])
}

function Invoke-Pm2 {
  param([string[]]$Arguments)

  & pm2 @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "pm2 exited with code $LASTEXITCODE"
  }
}

function Remove-Pm2AppIfPresent {
  param([string]$AppName)

  & cmd.exe /d /c "pm2 delete $AppName >nul 2>&1"
}

$selectedApps = Get-SelectedApps -Selection $Target

switch ($Action) {
  'start' {
    foreach ($app in $selectedApps) {
      Remove-Pm2AppIfPresent -AppName $app
      Invoke-Pm2 -Arguments @('start', $ecosystemFile, '--only', $app)
    }
  }
  'stop' {
    foreach ($app in $selectedApps) {
      Remove-Pm2AppIfPresent -AppName $app
    }
  }
  'restart' {
    foreach ($app in $selectedApps) {
      Remove-Pm2AppIfPresent -AppName $app
      Invoke-Pm2 -Arguments @('start', $ecosystemFile, '--only', $app)
    }
  }
  'status' {
    if ($Target -eq 'all') {
      Invoke-Pm2 -Arguments @('status')
    }
    else {
      foreach ($app in $selectedApps) {
        Invoke-Pm2 -Arguments @('status', $app)
      }
    }
  }
  'logs' {
    if ($Target -eq 'all') {
      Invoke-Pm2 -Arguments @('logs')
    }
    else {
      Invoke-Pm2 -Arguments @('logs', $selectedApps[0])
    }
  }
}
