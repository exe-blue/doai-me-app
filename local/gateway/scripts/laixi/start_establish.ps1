# DoAi.Me Connection Establishment Protocol v1.0
# 최초 접속 무결성 검증 시스템 (PowerShell)
#
# 실행: .\start_establish.ps1 [-Mode Full|Verify|Init] [-AutoRestart] [-LogFile <path>]

param(
    [ValidateSet('Full', 'Verify', 'Init')]
    [string]$Mode = 'Full',
    
    [switch]$AutoRestart,
    
    [string]$LogFile = '',
    
    [string]$LaixiUrl = 'ws://127.0.0.1:22221',
    
    [int]$RestartDelay = 10
)

$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "DoAi.Me Connection Establishment"

# ============================================
# 로깅
# ============================================

function Write-Log {
    param(
        [string]$Level,
        [string]$Message
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $colors = @{
        'INFO' = 'Cyan'
        'SUCCESS' = 'Green'
        'WARN' = 'Yellow'
        'ERROR' = 'Red'
    }
    
    $color = $colors[$Level]
    if (-not $color) { $color = 'White' }
    
    $logMessage = "[$timestamp] [$Level] $Message"
    
    Write-Host $logMessage -ForegroundColor $color
    
    if ($LogFile) {
        $logMessage | Out-File -FilePath $LogFile -Append -Encoding UTF8
    }
}

# ============================================
# 사전 검증
# ============================================

function Test-Prerequisites {
    Write-Host ""
    Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║   DoAi.Me Connection Establishment Protocol v1.0          ║" -ForegroundColor Cyan
    Write-Host "║              최초 접속 무결성 검증 시스템                    ║" -ForegroundColor Cyan
    Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
    
    # 1. Node.js 확인
    Write-Log "INFO" "Node.js 확인 중..."
    try {
        $nodeVersion = node -v 2>&1
        Write-Log "SUCCESS" "Node.js $nodeVersion 감지"
    } catch {
        Write-Log "ERROR" "Node.js가 설치되지 않았습니다. https://nodejs.org"
        return $false
    }
    
    # 2. Laixi 프로세스 확인
    Write-Log "INFO" "Laixi 앱 확인 중..."
    $laixiProcess = Get-Process -Name "Laixi" -ErrorAction SilentlyContinue
    if ($laixiProcess) {
        Write-Log "SUCCESS" "Laixi 앱 실행 중 (PID: $($laixiProcess.Id))"
    } else {
        Write-Log "WARN" "Laixi 앱이 실행되지 않았습니다."
        
        $continue = Read-Host "계속 진행하시겠습니까? (Y/N)"
        if ($continue -ne 'Y' -and $continue -ne 'y') {
            return $false
        }
    }
    
    # 3. WebSocket 포트 확인
    Write-Log "INFO" "WebSocket 포트 확인 중..."
    try {
        $tcpConnection = Get-NetTCPConnection -LocalPort 22221 -ErrorAction SilentlyContinue
        if ($tcpConnection) {
            Write-Log "SUCCESS" "포트 22221 열림"
        } else {
            Write-Log "WARN" "포트 22221이 열리지 않았습니다."
        }
    } catch {
        Write-Log "WARN" "포트 상태 확인 실패 (관리자 권한 필요)"
    }
    
    # 4. 스크립트 디렉토리 확인
    $scriptPath = Split-Path -Parent $MyInvocation.ScriptName
    if (-not $scriptPath) {
        $scriptPath = Get-Location
    }
    
    $establishScript = Join-Path $scriptPath "establish_connection.js"
    if (-not (Test-Path $establishScript)) {
        Write-Log "ERROR" "establish_connection.js 파일을 찾을 수 없습니다."
        Write-Log "INFO" "경로: $establishScript"
        return $false
    }
    
    Write-Log "SUCCESS" "스크립트 파일 확인됨"
    
    # 5. 의존성 확인
    $nodeModulesPath = Join-Path $scriptPath "node_modules"
    if (-not (Test-Path $nodeModulesPath)) {
        Write-Log "INFO" "의존성 설치 중..."
        Push-Location $scriptPath
        npm install ws --save
        Pop-Location
    }
    
    return $true
}

# ============================================
# 성립 명령 실행
# ============================================

function Start-Establishment {
    param(
        [string]$RunMode
    )
    
    $scriptPath = Split-Path -Parent $MyInvocation.ScriptName
    if (-not $scriptPath) {
        $scriptPath = Get-Location
    }
    
    $establishScript = Join-Path $scriptPath "establish_connection.js"
    
    # 모드별 인수
    $args = @()
    switch ($RunMode) {
        'Verify' { $args += '--verify-only' }
        'Init' { $args += '--init-only' }
    }
    
    # 환경 변수 설정
    $env:LAIXI_WS_URL = $LaixiUrl
    
    Write-Host ""
    Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Yellow
    Write-Host "  성립 명령 실행 중... (모드: $RunMode)" -ForegroundColor Yellow
    Write-Host "  종료하려면 Ctrl+C를 누르세요." -ForegroundColor Yellow
    Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Yellow
    Write-Host ""
    
    # 실행
    Push-Location $scriptPath
    try {
        & node $establishScript $args
        $exitCode = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    
    return $exitCode
}

# ============================================
# 메인 실행
# ============================================

# 사전 검증
if (-not (Test-Prerequisites)) {
    Write-Log "ERROR" "사전 검증 실패. 종료합니다."
    exit 1
}

# 실행 루프
$attemptCount = 0
$maxAttempts = 100

do {
    $attemptCount++
    
    if ($attemptCount -gt 1) {
        Write-Log "INFO" "재시작 대기 중... ($RestartDelay 초)"
        Start-Sleep -Seconds $RestartDelay
        Write-Host ""
        Write-Log "INFO" "═══ 재시작 #$attemptCount ═══"
    }
    
    $exitCode = Start-Establishment -RunMode $Mode
    
    if ($exitCode -eq 0) {
        Write-Log "SUCCESS" "정상 종료"
        break
    } else {
        Write-Log "WARN" "비정상 종료 (코드: $exitCode)"
    }
    
} while ($AutoRestart -and $attemptCount -lt $maxAttempts)

if ($AutoRestart -and $attemptCount -ge $maxAttempts) {
    Write-Log "ERROR" "최대 재시작 횟수 초과 ($maxAttempts 회)"
}

Write-Host ""
Write-Host "프로세스가 종료되었습니다." -ForegroundColor Gray
