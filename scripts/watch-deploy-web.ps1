#Requires -Version 7.0
param([int]$DebounceSeconds = 5)
$ErrorActionPreference = 'Stop'
$workspacePath = Split-Path -Parent $PSScriptRoot
$watcher = [System.IO.FileSystemWatcher]::new($workspacePath)
$watcher.IncludeSubdirectories = $true
$watcher.NotifyFilter = [System.IO.NotifyFilters]'FileName, LastWrite, Size'
$watcher.EnableRaisingEvents = $true
$ignored = [regex]'[\\/](?:web-dist|dist|node_modules|deploy|\.git)[\\/]'
$pendingAt = Get-Date
$pending = $true
try {
  Write-Host "Watching $workspacePath. Ctrl+C stops automatic deployment."
  while ($true) {
    $change = $watcher.WaitForChanged([System.IO.WatcherChangeTypes]::All, 1000)
    if (-not $change.TimedOut) {
      $fullPath = Join-Path $workspacePath $change.Name
      if ($fullPath -notmatch $ignored -and $fullPath -notmatch '[\\/]scripts[\\/](?:deploy|watch-deploy)-web\.ps1$') {
        $pendingAt = Get-Date; $pending = $true
        Write-Host "Change queued: $($change.Name)"
      }
    }
    if ($pending -and ((Get-Date) - $pendingAt).TotalSeconds -ge $DebounceSeconds) {
      $pending = $false
      try { & (Join-Path $PSScriptRoot 'deploy-web.ps1') } catch { Write-Warning $_ }
    }
  }
} finally { $watcher.Dispose() }
