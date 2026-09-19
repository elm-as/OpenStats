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
SetupIconFile=frontend\electron\icon.ico
LicenseFile=frontend\electron\charte_troll.txt
Compression=lzma2/max
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

[Messages]
french.WelcomeLabel2=Cet assistant va installer [name] sur votre ordinateur.%n%nPréparez-vous à analyser vos données avec rigueur, sans souffrir : DuckDB, Scikit-Learn, XGBoost, LightGBM et des graphiques Plotly impeccables.
french.FinishedHeadingLabel=Fini de bricoler, place aux maths !
french.FinishedLabel=L'installation de [name] est terminée avec succès.%n%nVos jeux de données n'ont qu'à bien se tenir. Aucun stagiaire n'a été maltraité durant ce build.
french.ClickFinish=Cliquez sur Terminer pour lancer la bête.

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"
Name: "anti_overfit"; Description: "Jurer solennellement de ne pas tenter d'ajuster du bruit blanc avec un modèle à 50 couches"; GroupDescription: "Engagements déontologiques :"

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
