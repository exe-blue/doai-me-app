#requires -RunAsAdministrator
# Run: Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
# Or: powershell.exe -ExecutionPolicy Bypass -File .\install.ps1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$AppName = 'doai\node-runner'
$ProgramFilesDir = Join-Path $env:ProgramFiles $AppName
$ProgramDataDir  = Join-Path $env:ProgramData  $AppName
$LogsDir          = Join-Path $ProgramDataDir "logs"
$CacheDir         = Join-Path $ProgramDataDir "cache"

$WinSwExe         = Join-Path $ProgramFilesDir "winsw.exe"
$ServiceXml       = Join-Path $ProgramFilesDir "node-runner-service.xml"
$RunnerExe        = Join-Path $ProgramFilesDir "node-runner.exe"
$ConfigPath       = Join-Path $ProgramDataDir "config.json"

Write-Host "== Installing DOAI Node Runner =="

# 1) 디렉토리 생성
New-Item -ItemType Directory -Force -Path $ProgramFilesDir | Out-Null
New-Item -ItemType Directory -Force -Path $ProgramDataDir  | Out-Null
New-Item -ItemType Directory -Force -Path $LogsDir         | Out-Null
New-Item -ItemType Directory -Force -Path $CacheDir        | Out-Null

# 2) 현재 스크립트 위치(압축 푼 폴더)에서 파일 복사
$SourceDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$filesToCopy = @(
  "node-runner.exe",
  "winsw.exe",
  "node-runner-service.xml"
)

foreach ($f in $filesToCopy) {
  $src = Join-Path $SourceDir $f
  if (-not (Test-Path $src)) { throw "Missing file: $src" }
  Copy-Item -Force $src (Join-Path $ProgramFilesDir $f)
}

# 3) config.json 생성(있으면 절대 덮어쓰지 않음)
if (-not (Test-Path $ConfigPath)) {
  $template = @{
    server_base_url     = "https://<your-vercel>.vercel.app"
    node_id             = "PC-01"
    node_shared_secret  = "REPLACE_ME"
    adb_path            = 'C:\Program Files (x86)\xiaowei\tools\adb.exe'
    poll_interval_ms    = 1500
    max_jobs            = 1
    online_window_sec   = 30
    lease_sec           = 30
    artifacts_dir       = $CacheDir
  }
  $template | ConvertTo-Json -Depth 10 | Out-File -FilePath $ConfigPath -Encoding UTF8
  Write-Host "Created config template: $ConfigPath"
  Write-Host "IMPORTANT: Edit config.json (server_base_url/node_id/node_shared_secret) then restart service."
} else {
  Write-Host "Config already exists, keeping: $ConfigPath"
}

# 4) 서비스 설치 및 시작
if (-not (Test-Path $WinSwExe)) { throw "WinSW not found at $WinSwExe" }
if (-not (Test-Path $ServiceXml)) { throw "Service XML not found at $ServiceXml" }
if (-not (Test-Path $RunnerExe)) { throw "Runner EXE not found at $RunnerExe" }

Push-Location $ProgramFilesDir
try {
  & $WinSwExe stop    2>$null | Out-Null
  & $WinSwExe uninstall 2>$null | Out-Null
  & $WinSwExe install
  & $WinSwExe start
  Write-Host "Service installed and started: DoaiNodeRunner"
} finally {
  Pop-Location
}

# 5) (선택) config 파일 ACL 강화: Administrators + SYSTEM만
try {
  $acl = Get-Acl $ConfigPath
  $acl.SetAccessRuleProtection($true, $false) | Out-Null
  $acl.Access | ForEach-Object { $acl.RemoveAccessRule($_) } | Out-Null

  $admins = New-Object System.Security.Principal.NTAccount("BUILTIN","Administrators")
  $system = New-Object System.Security.Principal.NTAccount("NT AUTHORITY","SYSTEM")

  $rule1 = New-Object System.Security.AccessControl.FileSystemAccessRule($admins,"FullControl","Allow")
  $rule2 = New-Object System.Security.AccessControl.FileSystemAccessRule($system,"FullControl","Allow")
  $acl.AddAccessRule($rule1)
  $acl.AddAccessRule($rule2)
  Set-Acl -Path $ConfigPath -AclObject $acl
  Write-Host "Hardened ACL for config.json"
} catch {
  Write-Warning "ACL hardening failed (non-fatal): $($_.Exception.Message)"
}

Write-Host "Done."
Write-Host "Check: services.msc -> DOAI Node Runner / logs in $LogsDir"
