; DOAI Node Runner - Inno Setup script (no PowerShell dependency)
; Build: iscc /DMyAppVersion=0.1.0 node-runner-setup.iss
; Run from the folder that contains node-runner.exe, winsw.exe, node-runner-service.xml.

#ifndef MyAppVersion
#define MyAppVersion "0.0.0"
#endif

#define MyAppName "DOAI Node Runner"
#define MyAppPublisher "DOAI"
#define MyAppURL "https://github.com/exe-blue/doai-me-app"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\doai\node-runner
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
PrivilegesRequired=admin
; 고정: setup.exe 미사용. 리포 이름 + 버전 + installer (영문). CI는 release/.../Output/ 이 경로만 검사/업로드.
OutputDir=Output
OutputBaseFilename=doai-me-app-{#MyAppVersion}-win-x64-installer
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
CloseApplications=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "node-runner.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "winsw.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "node-runner-service.xml"; DestDir: "{app}"; Flags: ignoreversion
Source: ".env.local.example"; DestDir: "{app}"; Flags: ignoreversion

[Dirs]
; ProgramData: config, logs, cache (created by [Code] if needed)
Name: "{commonappdata}\doai\node-runner"; Permissions: users-full
Name: "{commonappdata}\doai\node-runner\logs"; Permissions: users-full
Name: "{commonappdata}\doai\node-runner\cache"; Permissions: users-full

[Code]
const
  ConfigDir = '{commonappdata}\doai\node-runner';
  ConfigFile = 'config.json';

procedure CreateConfigIfNotExists;
var
  ConfigPath: String;
  ArtifactsDir: String;
  Json: String;
begin
  ConfigPath := ExpandConstant(ConfigDir) + '\' + ConfigFile;
  if not FileExists(ConfigPath) then
  begin
    ArtifactsDir := ExpandConstant(ConfigDir) + '\cache';
    StringChange(ArtifactsDir, '\', '\\');
    Json := '{"server_base_url":"https://<your-vercel>.vercel.app","node_id":"PC-01","node_shared_secret":"REPLACE_ME","adb_path":"C:\\Program Files (x86)\\xiaowei\\tools\\adb.exe","poll_interval_ms":1500,"max_jobs":1,"online_window_sec":30,"lease_sec":30,"artifacts_dir":"' + ArtifactsDir + '"}';
    SaveStringToFile(ConfigPath, Json, False);
    Log('Created config template: ' + ConfigPath);
  end
  else
    Log('Config already exists, keeping: ' + ConfigPath);
end;

procedure CopyEnvLocalFromExample;
var
  DataDir, SrcPath, DstPath: String;
begin
  DataDir := ExpandConstant(ConfigDir);
  DstPath := DataDir + '\.env.local';
  if not FileExists(DstPath) then
  begin
    SrcPath := ExpandConstant('{app}\.env.local.example');
    if FileExists(SrcPath) then
      if FileCopy(SrcPath, DstPath, False) then
        Log('Created .env.local from .env.local.example: ' + DstPath);
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  LogsDir: String;
begin
  if CurStep = ssPostInstall then
  begin
    LogsDir := ExpandConstant('{commonappdata}\doai\node-runner\logs');
    if not DirExists(LogsDir) then
      ForceDirectories(LogsDir);
    CreateConfigIfNotExists;
    CopyEnvLocalFromExample;
  end;
end;

[Run]
; Install and start Windows service (no PowerShell)
Filename: "{app}\winsw.exe"; Parameters: "install"; WorkingDir: "{app}"; StatusMsg: "Installing service..."; Flags: runhidden waituntilterminated
Filename: "{app}\winsw.exe"; Parameters: "start"; WorkingDir: "{app}"; StatusMsg: "Starting service..."; Flags: runhidden waituntilterminated
; D.1: Start Tray App after install (--tray)
Filename: "{app}\node-runner.exe"; Parameters: "--tray"; WorkingDir: "{app}"; Description: "Start Tray App"; Flags: nowait postinstall

[UninstallRun]
; Stop and remove service before deleting files (no PowerShell)
Filename: "{app}\winsw.exe"; Parameters: "stop"; WorkingDir: "{app}"; RunOnceId: "UninstallServiceStop"; Flags: runhidden waituntilterminated
Filename: "{app}\winsw.exe"; Parameters: "uninstall"; WorkingDir: "{app}"; RunOnceId: "UninstallServiceUninstall"; Flags: runhidden waituntilterminated
