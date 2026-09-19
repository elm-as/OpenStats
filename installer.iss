; OpenStats Desktop - Script d'installation Inno Setup
; Charte ElmasCore - "From Data to Systems"

#define MyAppName "OpenStats Desktop"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "ElmasCore"
#define MyAppURL "https://openstats.elmas.solutions"
#define MyAppExeName "OpenStats Desktop.exe"
#define SourceDir "frontend\release\win-unpacked"

[Setup]
; Identifiant GUID unique pour OpenStats Desktop
AppId={{B58F7824-34DF-4B6A-91C7-C58F9A10DE24}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
UninstallDisplayIcon={app}\{#MyAppExeName}
OutputDir=frontend\release
OutputBaseFilename=OpenStats_Setup_v{#MyAppVersion}
SetupIconFile=frontend\build\icon.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
CloseApplications=yes
CloseApplicationsFilter=*.exe
RestartApplications=no

[Languages]
Name: "french"; MessagesFile: "compiler:Languages\French.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[Code]
// Arrêt préventif de tout processus OpenStats résiduel pour éviter les verrous de fichiers
procedure KillRunningProcesses();
var
  ResultCode: Integer;
begin
  Exec('taskkill.exe', '/F /IM "OpenStats Desktop.exe" /T', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec('taskkill.exe', '/F /IM "openstats-backend.exe" /T', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

function InitializeSetup(): Boolean;
begin
  KillRunningProcesses();
  Result := True;
end;

function InitializeUninstall(): Boolean;
begin
  KillRunningProcesses();
  Result := True;
end;
