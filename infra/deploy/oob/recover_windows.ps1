#
# DoAi.Me Node Recovery Script (Windows)
# Strategos Security Design v1
#
# 사용법:
#   .\recover_windows.ps1 -Mode <soft|restart|box_reset>
#
# Modes:
#   soft      - ADB 재시작 + 에이전트 재시작 (Step 1)
#   restart   - 전체 서비스 재시작 (Step 2)
#   box_reset - 박스 전원 제어 요청 (Step 3, Orchestrator에서 실행)
#

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("soft", "restart", "box_reset")]
    [string]$Mode = "soft"
)

# === 설정 ===
$DOAI_HOME = if ($env:DOAI_HOME) { $env:DOAI_HOME } else { "C:\DoAi" }
$LOG_FILE = Join-Path $DOAI_HOME "logs\recover.log"
$NODE_RUNNER_PATH = Join-Path $DOAI_HOME "node-runner"

# 로그 함수
function Write-Log {
    param([string]$Message)
    $timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    $logMessage = "[$timestamp] $Message"
    Write-Host $logMessage
    Add-Content -Path $LOG_FILE -Value $logMessage -ErrorAction SilentlyContinue
}

function Write-LogInfo {
    param([string]$Message)
    Write-Log "INFO: $Message"
}

function Write-LogError {
    param([string]$Message)
    Write-Log "ERROR: $Message"
}

# === Soft Recovery (Step 1) ===
function Invoke-SoftRecovery {
    Write-LogInfo "Starting SOFT recovery..."
    
    # 1. ADB 서버 재시작
    Write-LogInfo "Restarting ADB server..."
    
    try {
        & adb kill-server 2>$null
        Start-Sleep -Seconds 2
        & adb start-server
        
        $devices = & adb devices 2>$null
        $deviceCount = ($devices | Select-String "device$").Count
        Write-LogInfo "ADB server restarted. Devices: $deviceCount"
    }
    catch {
        Write-LogError "ADB server restart failed: $_"
        return 3
    }
    
    # 2. NodeRunner 재시작
    Write-LogInfo "Restarting NodeRunner..."
    
    # Python 프로세스 찾기 (CIM 사용으로 CommandLine 접근 보장)
    $nodeRunnerProcess = Get-CimInstance -ClassName Win32_Process -ErrorAction SilentlyContinue | 
        Where-Object { $_.CommandLine -like "*noderunner.py*" } |
        ForEach-Object { Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue }
    
    if ($nodeRunnerProcess) {
        Write-LogInfo "Stopping existing NodeRunner process..."
        $nodeRunnerProcess | Stop-Process -Force
        Start-Sleep -Seconds 2
    }
    
    # NodeRunner 재시작 (백그라운드)
    $startScript = Join-Path $NODE_RUNNER_PATH "start.bat"
    if (Test-Path $startScript) {
        Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $startScript -WorkingDirectory $NODE_RUNNER_PATH -WindowStyle Hidden
        Write-LogInfo "NodeRunner started via start.bat"
    }
    else {
        Write-LogInfo "start.bat not found, NodeRunner restart skipped"
    }
    
    Write-LogInfo "SOFT recovery completed"
    return 0
}

# === Restart Recovery (Step 2) ===
function Invoke-RestartRecovery {
    Write-LogInfo "Starting RESTART recovery..."
    
    # 1. 모든 관련 프로세스 종료
    Write-LogInfo "Stopping all DoAi processes..."
    
    $processPatterns = @("noderunner.py", "gateway", "doai")
    foreach ($pattern in $processPatterns) {
        # CIM/WMI 사용으로 CommandLine 속성 접근 보장 (구형 PowerShell 호환)
        Get-CimInstance -ClassName Win32_Process -ErrorAction SilentlyContinue | 
            Where-Object { $_.CommandLine -like "*$pattern*" } |
            ForEach-Object { 
                Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue 
            }
    }
    
    Start-Sleep -Seconds 3
    
    # 2. ADB 완전 재시작
    Write-LogInfo "Restarting ADB server..."
    & adb kill-server 2>$null
    Start-Sleep -Seconds 3
    & adb start-server
    
    # 3. USB 디바이스 재스캔 (Windows)
    Write-LogInfo "Rescanning USB devices..."
    try {
        # devcon 또는 pnputil 사용
        if (Get-Command "pnputil" -ErrorAction SilentlyContinue) {
            & pnputil /scan-devices 2>$null
            Write-LogInfo "USB devices rescanned via pnputil"
        }
    }
    catch {
        Write-LogInfo "USB rescan not available"
    }
    
    # 4. 서비스 재시작
    Start-Sleep -Seconds 5
    
    $startScript = Join-Path $NODE_RUNNER_PATH "start.bat"
    if (Test-Path $startScript) {
        Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $startScript -WorkingDirectory $NODE_RUNNER_PATH -WindowStyle Hidden
        Write-LogInfo "NodeRunner restarted"
    }
    
    # 5. 디바이스 인식 대기
    Write-LogInfo "Waiting for devices to reconnect..."
    Start-Sleep -Seconds 10
    
    $devices = & adb devices 2>$null
    $deviceCount = ($devices | Select-String "device$").Count
    Write-LogInfo "RESTART recovery completed. Devices: $deviceCount"
    
    return 0
}

# === Box Reset (Step 3) ===
function Invoke-BoxResetRecovery {
    Write-LogInfo "BOX_RESET requested - this should be executed by Orchestrator"
    
    # 서비스 정리
    Write-LogInfo "Preparing for box reset..."
    
    Get-Process -Name "python*" -ErrorAction SilentlyContinue | 
        Where-Object { $_.CommandLine -like "*noderunner.py*" } |
        Stop-Process -Force -ErrorAction SilentlyContinue
    
    & adb kill-server 2>$null
    
    Write-LogInfo "Node ready for box power cycle"
    Write-LogInfo "Orchestrator will handle box TCP commands"
    
    return 0
}

# === 메인 ===
function Main {
    # 로그 디렉토리 생성
    $logDir = Split-Path $LOG_FILE -Parent
    if (-not (Test-Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }
    
    Write-LogInfo "=========================================="
    Write-LogInfo "Recovery script started: mode=$Mode"
    Write-LogInfo "=========================================="
    
    switch ($Mode) {
        "soft" {
            $exitCode = Invoke-SoftRecovery
        }
        "restart" {
            $exitCode = Invoke-RestartRecovery
        }
        "box_reset" {
            $exitCode = Invoke-BoxResetRecovery
        }
        default {
            Write-LogError "Invalid mode: $Mode"
            Write-Host "Usage: .\recover_windows.ps1 -Mode <soft|restart|box_reset>"
            exit 2
        }
    }
    
    Write-LogInfo "Recovery completed with exit code: $exitCode"
    exit $exitCode
}

# 스크립트 실행
Main

