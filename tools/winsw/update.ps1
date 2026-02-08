#requires -RunAsAdministrator
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

param(
  [Parameter(Mandatory=$true)]
  [string]$RepoOwner,

  [Parameter(Mandatory=$true)]
  [string]$RepoName,

  [string]$GithubToken = ""
)

$AppName = "doai\node-runner"
$ProgramFilesDir = Join-Path $env:ProgramFiles $AppName
$ProgramDataDir  = Join-Path $env:ProgramData  $AppName
$LogsDir          = Join-Path $ProgramDataDir "logs"
$CacheDir         = Join-Path $ProgramDataDir "cache"

$WinSwExe    = Join-Path $ProgramFilesDir "winsw.exe"
$RunnerExe   = Join-Path $ProgramFilesDir "node-runner.exe"

New-Item -ItemType Directory -Force -Path $CacheDir | Out-Null

function Invoke-GitHubApi($url) {
  $headers = @{
    "User-Agent" = "doai-node-runner-updater"
    "Accept"     = "application/vnd.github+json"
  }
  if ($GithubToken -ne "") { $headers["Authorization"] = "Bearer $GithubToken" }
  return Invoke-RestMethod -Uri $url -Headers $headers -Method Get
}

Write-Host "== Updating DOAI Node Runner from GitHub Releases =="

if (-not (Test-Path $WinSwExe)) { throw "WinSW not found: $WinSwExe" }
if (-not (Test-Path $RunnerExe)) { throw "Runner exe not found: $RunnerExe" }

$releaseUrl = "https://api.github.com/repos/$RepoOwner/$RepoName/releases/latest"
$rel = Invoke-GitHubApi $releaseUrl

$tag = $rel.tag_name
Write-Host "Latest release: $tag"

$zip = $rel.assets | Where-Object { $_.name -match "^node-runner-win-x64-v.*\.zip$" } | Select-Object -First 1
if (-not $zip) { throw "Release asset zip not found. Expected: node-runner-win-x64-v*.zip" }

$zipPath = Join-Path $CacheDir $zip.name
Write-Host "Downloading: $($zip.browser_download_url)"
$headers = @{ "User-Agent" = "doai-node-runner-updater" }
if ($GithubToken -ne "") { $headers["Authorization"] = "Bearer $GithubToken" }
Invoke-WebRequest -Uri $zip.browser_download_url -OutFile $zipPath -Headers $headers

$shaAsset = $rel.assets | Where-Object { $_.name -eq "sha256sums.txt" } | Select-Object -First 1
$shaPath = Join-Path $CacheDir "sha256sums.txt"
if ($shaAsset) {
  Write-Host "Downloading checksum: sha256sums.txt"
  Invoke-WebRequest -Uri $shaAsset.browser_download_url -OutFile $shaPath -Headers $headers
}

$extractDir = Join-Path $CacheDir ("extract_" + $tag)
if (Test-Path $extractDir) { Remove-Item -Recurse -Force $extractDir }
New-Item -ItemType Directory -Force -Path $extractDir | Out-Null
Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force

$newRunner = Join-Path $extractDir "node-runner.exe"
if (-not (Test-Path $newRunner)) { throw "node-runner.exe not found in zip" }

if (Test-Path $shaPath) {
  $expectedLine = (Get-Content $shaPath | Where-Object { $_ -match [Regex]::Escape($zip.name) } | Select-Object -First 1)
  if ($expectedLine) {
    $expected = ($expectedLine -split "\s+")[0].Trim()
    $actual = (Get-FileHash -Algorithm SHA256 $zipPath).Hash.ToLower()
    if ($actual -ne $expected.ToLower()) { throw "SHA256 mismatch: expected $expected, got $actual" }
    Write-Host "Checksum OK"
  } else {
    Write-Warning "No checksum line found for $($zip.name). Skipping verification."
  }
}

Push-Location $ProgramFilesDir
try {
  Write-Host "Stopping service..."
  & $WinSwExe stop

  $bak = $RunnerExe + ".bak"
  Copy-Item -Force $RunnerExe $bak

  Write-Host "Replacing node-runner.exe..."
  Copy-Item -Force $newRunner $RunnerExe

  Write-Host "Starting service..."
  & $WinSwExe start

  Write-Host "Update complete: $tag"
} catch {
  Write-Warning "Update failed: $($_.Exception.Message)"
  Write-Warning "Attempting rollback..."
  try {
    & $WinSwExe stop 2>$null | Out-Null
    $bak = $RunnerExe + ".bak"
    if (Test-Path $bak) { Copy-Item -Force $bak $RunnerExe }
    & $WinSwExe start 2>$null | Out-Null
    Write-Host "Rollback done."
  } catch {
    Write-Error "Rollback failed: $($_.Exception.Message)"
  }
  throw
} finally {
  Pop-Location
}
