<#
.SYNOPSIS
  Roll dsh-notify-desktop out of the DSH desktop profile.

.DESCRIPTION
  Run this when the desktop app will not start (or misbehaves) after installing
  the notification plugin. Default is a DRY RUN: it only reports what it would
  do. Pass -Apply to actually restore.

  The restore is file-level (no CLI, no running app required):
    1. restore profiles\desktop\package.json / pnpm-lock.yaml / cordis.patch.yml
       from the .bak-notify copies taken before the install;
    2. remove the node_modules link of the plugin.

  After -Apply, start the desktop app again. Start it once; do not double-launch.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File docs\rollback.ps1
  powershell -ExecutionPolicy Bypass -File docs\rollback.ps1 -Apply
#>
param(
  [switch]$Apply,
  [string]$ProfileDir = (Join-Path $env:USERPROFILE '.dsh\profiles\desktop')
)

$names = @('package.json', 'pnpm-lock.yaml', 'cordis.patch.yml')
Write-Host "profile: $ProfileDir"
if (-not (Test-Path $ProfileDir)) { Write-Host 'profile directory not found - nothing to do'; exit 1 }

foreach ($name in $names) {
  $target = Join-Path $ProfileDir $name
  $backup = "$target.bak-notify"
  if (-not (Test-Path $backup)) { Write-Host "SKIP  $name (no $name.bak-notify)"; continue }
  if ($Apply) {
    Copy-Item -LiteralPath $backup -Destination $target -Force
    Write-Host "RESTORED $name"
  } else {
    Write-Host "WOULD RESTORE $name from $name.bak-notify"
  }
}

$link = Join-Path $ProfileDir 'node_modules\dsh-notify-desktop'
if (Test-Path $link) {
  if ($Apply) {
    $item = Get-Item -LiteralPath $link -Force
    if ($item.LinkType) { $item.Delete() } else { Remove-Item -LiteralPath $link -Recurse -Force }
    Write-Host 'REMOVED node_modules\dsh-notify-desktop'
  } else {
    Write-Host 'WOULD REMOVE node_modules\dsh-notify-desktop'
  }
} else {
  Write-Host 'SKIP  node_modules\dsh-notify-desktop (absent)'
}

if (-not $Apply) { Write-Host ''; Write-Host 'DRY RUN - re-run with -Apply to restore.' }
