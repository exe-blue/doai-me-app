# ============================================================
# Laixi 스크립트 심볼릭 링크 설정
# 
# 관리자 권한으로 실행 필요!
# 
# 사용법:
#   powershell -ExecutionPolicy Bypass -File setup_laixi_link.ps1
# ============================================================

$ErrorActionPreference = "Stop"

# 경로 설정
$projectScripts = "D:\exe.blue\aifarm\gateway\scripts\laixi"
$laixiScripts = "C:\Program Files\Laixi\Scripts\doai"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Laixi 스크립트 심볼릭 링크 설정" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 관리자 권한 확인
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "[ERROR] 관리자 권한이 필요합니다!" -ForegroundColor Red
    Write-Host ""
    Write-Host "다음 명령으로 다시 실행하세요:" -ForegroundColor Yellow
    Write-Host '  Start-Process powershell -Verb RunAs -ArgumentList "-ExecutionPolicy Bypass -File $PSCommandPath"'
    exit 1
}

# 소스 폴더 확인
if (-not (Test-Path $projectScripts)) {
    Write-Host "[ERROR] 소스 폴더가 없습니다: $projectScripts" -ForegroundColor Red
    exit 1
}

Write-Host "소스: $projectScripts" -ForegroundColor Green
Write-Host "타겟: $laixiScripts" -ForegroundColor Green
Write-Host ""

# 기존 링크/폴더 제거 (안전성 검증 포함)
if (Test-Path $laixiScripts) {
    # 경로 안전성 검증
    if ([string]::IsNullOrWhiteSpace($laixiScripts)) {
        Write-Host "[ERROR] laixiScripts 경로가 비어있습니다." -ForegroundColor Red
        exit 1
    }
    
    # 루트 또는 시스템 폴더 삭제 방지
    $dangerousPaths = @("C:\", "C:\Windows", "C:\Program Files", "C:\Users", "/", "/usr", "/etc")
    if ($dangerousPaths -contains $laixiScripts) {
        Write-Host "[ERROR] 위험한 경로입니다: $laixiScripts" -ForegroundColor Red
        exit 1
    }
    
    # 예상되는 기본 경로 확인 (Laixi 스크립트 폴더여야 함)
    if (-not ($laixiScripts -like "*scripts*" -or $laixiScripts -like "*laixi*")) {
        Write-Host "[WARNING] 예상치 못한 경로입니다: $laixiScripts" -ForegroundColor Yellow
        $confirm = Read-Host "정말 삭제하시겠습니까? (y/N)"
        if ($confirm -ne 'y') {
            Write-Host "[INFO] 작업이 취소되었습니다." -ForegroundColor Cyan
            exit 0
        }
    }
    
    Write-Host "[INFO] 기존 경로 제거 중..." -ForegroundColor Yellow
    Remove-Item $laixiScripts -Recurse -Force
}

# 심볼릭 링크 생성
Write-Host "[INFO] 심볼릭 링크 생성 중..." -ForegroundColor Yellow

try {
    New-Item -ItemType SymbolicLink -Path $laixiScripts -Target $projectScripts -Force | Out-Null
    
    Write-Host ""
    Write-Host "[SUCCESS] 심볼릭 링크 생성 완료!" -ForegroundColor Green
    Write-Host ""
    Write-Host "이제 Laixi에서 'doai/youtube_watch.js' 등을 실행할 수 있습니다." -ForegroundColor Cyan
    
    # 링크 확인
    Write-Host ""
    Write-Host "링크된 파일:" -ForegroundColor Yellow
    Get-ChildItem $laixiScripts | ForEach-Object { Write-Host "  - $($_.Name)" }
    
} catch {
    Write-Host "[ERROR] 심볼릭 링크 생성 실패: $_" -ForegroundColor Red
    
    # 대안: 복사
    Write-Host ""
    Write-Host "[INFO] 대안으로 파일 복사 시도..." -ForegroundColor Yellow
    
    New-Item -ItemType Directory -Path $laixiScripts -Force | Out-Null
    Copy-Item -Path "$projectScripts\*" -Destination $laixiScripts -Recurse -Force
    
    Write-Host "[SUCCESS] 파일 복사 완료!" -ForegroundColor Green
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan

