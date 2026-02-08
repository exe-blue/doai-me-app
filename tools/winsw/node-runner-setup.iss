; DOAI Node Runner - Inno Setup script
; Build: iscc /DMyAppVersion=0.1.0 node-runner-setup.iss
; Run from the folder that contains node-runner.exe, winsw.exe, install.ps1, etc.

#ifndef MyAppVersion
#define MyAppVersion "0.0.0"
#endif

#define MyAppName "DOAI Node Runner"
#define MyAppPublisher "DOAI"
#define MyAppURL "https://github.com/doai/doai-me-app"

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
OutputBaseFilename=setup
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
Source: "install.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "update.ps1"; DestDir: "{app}"; Flags: ignoreversion

[Run]
; Post-install: create ProgramData dirs, config template, install & start Windows service
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -NoProfile -File ""{app}\install.ps1"""; WorkingDir: "{app}"; StatusMsg: "Installing service..."; Flags: runhidden waituntilterminated

[UninstallRun]
; Stop and remove service before deleting files
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -NoProfile -Command ""& '{app}\winsw.exe' stop; & '{app}\winsw.exe' uninstall"""; WorkingDir: "{app}"; RunOnceId: "UninstallService"; Flags: runhidden waituntilterminated
