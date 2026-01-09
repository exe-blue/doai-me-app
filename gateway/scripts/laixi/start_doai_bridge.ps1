# DoAi.ME Market Bridge Launcher (PowerShell)
# 
# 사용법:
# .\start_doai_bridge.ps1
# .\start_doai_bridge.ps1 -LaixiUrl "ws://192.168.1.100:22221"
#

param(
    [string]$ApiUrl = "http://localhost:3000",
    [int]$WsPort = 8080,
    [string]$LaixiUrl = "ws://127.0.0.1:22221"
)

$Host.UI.RawUI.WindowTitle = "DoAi.ME Market Bridge"

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Yellow
Write-Host "║       DoAi.ME Market Bridge Launcher                 ║" -ForegroundColor Yellow
Write-Host "║       Laixi ↔ DoAi.ME 실시간 연결                    ║" -ForegroundColor Yellow
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Yellow
Write-Host ""

# Node.js 확인
$nodeVersion = $null
try {
    $nodeVersion = node --version 2>$null
} catch {}

if (-not $nodeVersion) {
    Write-Host "[ERROR] Node.js가 설치되어 있지 않습니다." -ForegroundColor Red
    Write-Host "        https://nodejs.org 에서 다운로드하세요." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "[INFO] Node.js version: $nodeVersion" -ForegroundColor Cyan

# 작업 디렉토리 설정
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir
Write-Host "[INFO] 실행 위치: $scriptDir" -ForegroundColor Cyan
Write-Host ""

# 의존성 확인
if (-not (Test-Path "node_modules")) {
    Write-Host "[INFO] 의존성 설치 중..." -ForegroundColor Yellow
    npm install ws --save
    Write-Host ""
}

# 환경변수 설정
$env:DOAI_API_URL = $ApiUrl
$env:DOAI_WS_PORT = $WsPort
$env:LAIXI_WS_URL = $LaixiUrl

Write-Host "[INFO] 설정:" -ForegroundColor Green
Write-Host "       - DoAi.ME API: $ApiUrl" -ForegroundColor White
Write-Host "       - WebSocket 포트: $WsPort" -ForegroundColor White
Write-Host "       - Laixi 주소: $LaixiUrl" -ForegroundColor White
Write-Host ""
Write-Host "[INFO] 브릿지 시작 중..." -ForegroundColor Green
Write-Host "       종료하려면 Ctrl+C를 누르세요." -ForegroundColor Gray
Write-Host ""
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host ""

# 브릿지 실행
node doai_market_bridge.js

Write-Host ""
Write-Host "[INFO] 브릿지가 종료되었습니다." -ForegroundColor Yellow
Read-Host "Press Enter to exit"

