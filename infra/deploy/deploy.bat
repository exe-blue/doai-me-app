@echo off
REM ============================================================
REM AIFarm Secure Deployment Script
REM ============================================================
REM 
REM Prerequisites:
REM 1. Create deploy.env from deploy.env.example
REM 2. Set up SSH keys: ssh-keygen -t ed25519 -f %USERPROFILE%\.ssh\id_ed25519_aifarm
REM 3. Copy public key to server: ssh-copy-id -i %USERPROFILE%\.ssh\id_ed25519_aifarm.pub user@server
REM 4. Verify server fingerprint is in known_hosts
REM
REM Security Notes:
REM - Uses SSH key authentication (no password in scripts)
REM - Validates SSH host key from known_hosts
REM - Uses dedicated deploy user (not root)
REM - Input validation on environment variables
REM ============================================================

setlocal EnableDelayedExpansion

echo ==========================================
echo AIFarm Secure Deployment
echo ==========================================

REM Load environment variables from deploy.env with validation
if not exist "%~dp0deploy.env" (
    echo ERROR: deploy.env not found!
    echo Please copy deploy.env.example to deploy.env and configure it.
    exit /b 1
)

echo Loading configuration from deploy.env...

REM Temp file for caret detection (^ is an escape char and requires special handling)
set "CARET_CHECK_TMP=%TEMP%\deploy_caret_check_%RANDOM%.tmp"

REM Parse deploy.env with validation
for /f "usebackq tokens=*" %%L in ("%~dp0deploy.env") do (
    set "LINE=%%L"
    
    REM Skip empty lines
    if "!LINE!"=="" (
        REM Skip
    ) else (
        REM Skip comment lines (starting with #)
        echo !LINE! | findstr /b /c:"#" >nul
        if errorlevel 1 (
            REM Not a comment, parse key=value
            for /f "tokens=1,* delims==" %%a in ("!LINE!") do (
                set "KEY=%%a"
                set "VAL=%%b"
                
                REM Trim leading/trailing spaces from key
                for /f "tokens=* delims= " %%k in ("!KEY!") do set "KEY=%%k"
                
                REM Trim leading/trailing spaces from value
                if defined VAL (
                    for /f "tokens=* delims= " %%v in ("!VAL!") do set "VAL=%%v"
                )
                
                REM Validate key contains only safe characters (alphanumeric and underscore)
                echo !KEY! | findstr /r "^[A-Za-z_][A-Za-z0-9_]*$" >nul
                if errorlevel 1 (
                    echo WARNING: Skipping invalid key format: !KEY!
                ) else (
                    REM Check for unsafe characters in value
                    REM Reject values containing: & | < > ^ ` 
                    set "SAFE_VAL=1"
                    echo !VAL! | findstr /l /c:"&" >nul && set "SAFE_VAL=0"
                    echo !VAL! | findstr /l /c:"|" >nul && set "SAFE_VAL=0"
                    echo !VAL! | findstr /l /c:"<" >nul && set "SAFE_VAL=0"
                    echo !VAL! | findstr /l /c:">" >nul && set "SAFE_VAL=0"
                    echo !VAL! | findstr /l /c:"`" >nul && set "SAFE_VAL=0"
                    REM Caret (^) detection: use temp file because echo consumes ^ as escape char
                    REM Write variable to temp file using 'set', then check file with findstr
                    >"!CARET_CHECK_TMP!" (set VAL)
                    findstr /l "^^" "!CARET_CHECK_TMP!" >nul 2>&1 && set "SAFE_VAL=0"
                    
                    if "!SAFE_VAL!"=="0" (
                        echo ERROR: Unsafe characters detected in value for !KEY!
                        echo Values cannot contain: ^& ^| ^< ^> ^^ ` 
                        echo Please update deploy.env and remove special characters.
                        if exist "!CARET_CHECK_TMP!" del "!CARET_CHECK_TMP!" >nul 2>&1
                        exit /b 1
                    )
                    
                    REM Set the environment variable
                    set "!KEY!=!VAL!"
                )
            )
        )
    )
)

REM Cleanup temp file used for caret detection
if exist "!CARET_CHECK_TMP!" del "!CARET_CHECK_TMP!" >nul 2>&1

REM Validate required variables
if not defined AIFARM_SERVER_HOST (
    echo ERROR: AIFARM_SERVER_HOST not set in deploy.env
    exit /b 1
)
if not defined AIFARM_SERVER_USER (
    echo ERROR: AIFARM_SERVER_USER not set in deploy.env
    exit /b 1
)
if not defined AIFARM_LOCAL_PATH (
    echo ERROR: AIFARM_LOCAL_PATH not set in deploy.env
    exit /b 1
)

REM Validate AIFARM_SERVER_HOST format (basic IP/hostname check)
echo %AIFARM_SERVER_HOST% | findstr /r "^[0-9A-Za-z][-0-9A-Za-z.]*[0-9A-Za-z]$" >nul
if errorlevel 1 (
    echo %AIFARM_SERVER_HOST% | findstr /r "^[0-9A-Za-z]$" >nul
    if errorlevel 1 (
        echo ERROR: AIFARM_SERVER_HOST appears invalid: %AIFARM_SERVER_HOST%
        exit /b 1
    )
)

REM Validate AIFARM_SERVER_USER format (alphanumeric, underscore, hyphen)
echo %AIFARM_SERVER_USER% | findstr /r "^[a-z_][a-z0-9_-]*$" >nul
if errorlevel 1 (
    echo ERROR: AIFARM_SERVER_USER appears invalid: %AIFARM_SERVER_USER%
    echo Username should contain only lowercase letters, numbers, underscore, hyphen
    exit /b 1
)

REM Warn if using root
if "%AIFARM_SERVER_USER%"=="root" (
    echo.
    echo WARNING: Using root user is not recommended!
    echo Consider creating a dedicated deploy user with sudo access.
    echo.
)

REM Set SSH options
set SSH_OPTS=
if defined AIFARM_SSH_KEY (
    set SSH_OPTS=-i "%AIFARM_SSH_KEY%"
)

REM Set remote home directory
if "%AIFARM_SERVER_USER%"=="root" (
    set REMOTE_HOME=/root
) else (
    set REMOTE_HOME=/home/%AIFARM_SERVER_USER%
)

echo.
echo Configuration:
echo   Server: %AIFARM_SERVER_USER%@%AIFARM_SERVER_HOST%
echo   Local Path: %AIFARM_LOCAL_PATH%
echo   Remote Home: %REMOTE_HOME%
echo.

REM Verify SSH connection first
echo [Step 1] Verifying SSH connection...
ssh %SSH_OPTS% %AIFARM_SERVER_USER%@%AIFARM_SERVER_HOST% "echo 'SSH connection verified'"
if errorlevel 1 (
    echo ERROR: SSH connection failed!
    echo Please ensure:
    echo   1. SSH key is properly configured
    echo   2. Server fingerprint is in known_hosts
    echo   3. Deploy user has proper permissions
    exit /b 1
)

echo.
echo [Step 2] Uploading setup script...
scp %SSH_OPTS% "%~dp0aifarm_setup.sh" %AIFARM_SERVER_USER%@%AIFARM_SERVER_HOST%:%REMOTE_HOME%/
if errorlevel 1 (
    echo ERROR: Failed to upload setup script!
    exit /b 1
)

echo.
echo [Step 3] Uploading aifarm project to user home directory...
REM Upload to user's home directory first (not directly to /opt/)
scp %SSH_OPTS% -r "%AIFARM_LOCAL_PATH%" %AIFARM_SERVER_USER%@%AIFARM_SERVER_HOST%:%REMOTE_HOME%/aifarm_upload/
if errorlevel 1 (
    echo ERROR: Failed to upload project files!
    exit /b 1
)

echo.
echo [Step 4] Running setup script on server...
echo NOTE: Setup script will move files to /opt/aifarm using sudo
if "%AIFARM_SERVER_USER%"=="root" (
    ssh %SSH_OPTS% %AIFARM_SERVER_USER%@%AIFARM_SERVER_HOST% "chmod +x %REMOTE_HOME%/aifarm_setup.sh && bash %REMOTE_HOME%/aifarm_setup.sh"
    REM Move uploaded files to /opt/aifarm
    ssh %SSH_OPTS% %AIFARM_SERVER_USER%@%AIFARM_SERVER_HOST% "mkdir -p /opt/aifarm && cp -r %REMOTE_HOME%/aifarm_upload/* /opt/aifarm/ && chown -R aifarm:aifarm /opt/aifarm"
) else (
    ssh %SSH_OPTS% %AIFARM_SERVER_USER%@%AIFARM_SERVER_HOST% "chmod +x %REMOTE_HOME%/aifarm_setup.sh && sudo bash %REMOTE_HOME%/aifarm_setup.sh"
    REM Move uploaded files to /opt/aifarm using sudo
    ssh %SSH_OPTS% %AIFARM_SERVER_USER%@%AIFARM_SERVER_HOST% "sudo mkdir -p /opt/aifarm && sudo cp -r %REMOTE_HOME%/aifarm_upload/* /opt/aifarm/ && sudo chown -R aifarm:aifarm /opt/aifarm"
)

echo.
echo [Step 5] Starting aifarm service...
if "%AIFARM_SERVER_USER%"=="root" (
    ssh %SSH_OPTS% %AIFARM_SERVER_USER%@%AIFARM_SERVER_HOST% "systemctl start aifarm"
) else (
    ssh %SSH_OPTS% %AIFARM_SERVER_USER%@%AIFARM_SERVER_HOST% "sudo systemctl start aifarm"
)

echo.
echo [Step 6] Checking service status...
if "%AIFARM_SERVER_USER%"=="root" (
    ssh %SSH_OPTS% %AIFARM_SERVER_USER%@%AIFARM_SERVER_HOST% "systemctl status aifarm"
) else (
    ssh %SSH_OPTS% %AIFARM_SERVER_USER%@%AIFARM_SERVER_HOST% "sudo systemctl status aifarm"
)

echo.
echo ==========================================
echo Deployment Complete!
echo Dashboard: http://%AIFARM_SERVER_HOST%:8080/dashboard
echo ==========================================
pause