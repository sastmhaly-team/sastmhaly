; ====================================================================
; Sastmhaly POS - Windows Installer Script (NSIS)
; ====================================================================
Unicode True
RequestExecutionLevel user
SetCompressor /SOLID lzma

!define APP_NAME "سستمهالي - Sastmhaly POS"
!define APP_PUBLISHER "Sastmhaly"
!define APP_VERSION "1.0.0"
!define APP_EXE "Sastmhaly_POS.exe"
!define APP_DIR "SastmhalyPOS"

Name "${APP_NAME}"
OutFile "Sastmhaly-POS-Setup.exe"
InstallDir "C:\${APP_DIR}"
InstallDirRegKey HKCU "Software\${APP_DIR}" ""
Icon "app.ico"
UninstallIcon "app.ico"

VIProductVersion "1.0.0.0"
VIAddVersionKey "ProductName" "${APP_NAME}"
VIAddVersionKey "CompanyName" "${APP_PUBLISHER}"
VIAddVersionKey "FileDescription" "برنامج تثبيت سستمهالي لنقاط البيع"
VIAddVersionKey "FileVersion" "${APP_VERSION}"
VIAddVersionKey "LegalCopyright" "Copyright © 2026 ${APP_PUBLISHER}"

; Modern UI
!include "MUI2.nsh"

!define MUI_ICON "app.ico"
!define MUI_UNICON "app.ico"
!define MUI_ABORTWARNING

; Interface Settings
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "تشغيل سستمهالي الآن"
!define MUI_FINISHPAGE_SHOWREADME ""
!define MUI_FINISHPAGE_SHOWREADME_TEXT "إنشاء اختصار على سطح المكتب"
!define MUI_FINISHPAGE_SHOWREADME_FUNCTION CreateDesktopShortcut

; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; Languages
!insertmacro MUI_LANGUAGE "Arabic"

; ====================================================================
; Installation Section
; ====================================================================
Section "MainSection" SEC01
  ; Terminate any previous running instance of the app or background node to release locks
  ExecWait 'cmd.exe /c taskkill /F /IM node.exe /T 2>nul'
  ExecWait 'cmd.exe /c taskkill /F /IM Sastmhaly_POS.exe /T 2>nul'
  Sleep 1000

  SetOutPath "$INSTDIR"
  
  ; Write basic executable and script files
  File "app.ico"
  File "run_app.vbs"
  File "Sastmhaly_POS.exe"
  File "node.exe"
  File "/oname=تشغيل_سستمهالي.bat" "run_app.bat"

  ; Copy merchant config if present next to installer or in user Downloads
  IfFileExists "$EXEDIR\sastmhaly_config.json" 0 +2
    CopyFiles /SILENT "$EXEDIR\sastmhaly_config.json" "$INSTDIR\sastmhaly_config.json"
  IfFileExists "$PROFILE\Downloads\sastmhaly_config.json" 0 +2
    CopyFiles /SILENT "$PROFILE\Downloads\sastmhaly_config.json" "$INSTDIR\sastmhaly_config.json"

  ; Copy initial database if present next to installer
  IfFileExists "$EXEDIR\sastmhaly.db" 0 +3
    CreateDirectory "$INSTDIR\data"
    CopyFiles /SILENT "$EXEDIR\sastmhaly.db" "$INSTDIR\data\sastmhaly.db"

  ; Extract the Next.js standalone runtime
  SetOutPath "$INSTDIR"
  File "/oname=server.js" "/Users/rogerpeter/sastmhaly/offline/windows/standalone_server.js"
  File "/Users/rogerpeter/sastmhaly/.next/standalone/package.json"
  
  SetOutPath "$INSTDIR\.next"
  File /r "/Users/rogerpeter/sastmhaly/.next/standalone/.next\*"

  ; Ensure all static assets (CSS, JS chunks, media) are explicitly extracted
  SetOutPath "$INSTDIR\.next\static"
  File /r "/Users/rogerpeter/sastmhaly/.next/static\*"

  SetOutPath "$INSTDIR\public"
  File /r /x "downloads" "/Users/rogerpeter/sastmhaly/public\*"

  SetOutPath "$INSTDIR\node_modules"
  File /r "/Users/rogerpeter/sastmhaly/.next/standalone/node_modules\*"

  ; Extract default database only if none exists yet so user data is never overwritten
  IfFileExists "$INSTDIR\data\sastmhaly.db" +4 0
    CreateDirectory "$INSTDIR\data"
    SetOutPath "$INSTDIR\data"
    File /nonfatal "/Users/rogerpeter/sastmhaly/data\sastmhaly.db"

  SetOutPath "$INSTDIR"

  ; Create Desktop Shortcut
  CreateShortCut "$DESKTOP\سستمهالي - نقاط البيع.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\app.ico" 0
  
  ; Create Start Menu Shortcuts
  CreateDirectory "$SMPROGRAMS\سستمهالي"
  CreateShortCut "$SMPROGRAMS\سستمهالي\سستمهالي - نقاط البيع.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\app.ico" 0
  CreateShortCut "$SMPROGRAMS\سستمهالي\إلغاء التثبيت.lnk" "$INSTDIR\uninstall.exe" "" "" 0

  ; Create Uninstaller
  WriteUninstaller "$INSTDIR\uninstall.exe"

  ; Add to Windows Add/Remove Programs and Registry
  WriteRegStr HKCU "Software\${APP_DIR}" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\${APP_DIR}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_DIR}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_DIR}" "DisplayIcon" "$INSTDIR\app.ico"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_DIR}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_DIR}" "Publisher" "${APP_PUBLISHER}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_DIR}" "UninstallString" "$INSTDIR\uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_DIR}" "InstallLocation" "$INSTDIR"
SectionEnd

Function CreateDesktopShortcut
  SetOutPath "$INSTDIR"
  CreateShortCut "$DESKTOP\سستمهالي - نقاط البيع.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\app.ico" 0
FunctionEnd

; ====================================================================
; Uninstallation Section
; ====================================================================
Section "Uninstall"
  ; Remove Desktop and Start Menu Shortcuts
  Delete "$DESKTOP\سستمهالي - نقاط البيع.lnk"
  Delete "$SMPROGRAMS\سستمهالي\سستمهالي - نقاط البيع.lnk"
  Delete "$SMPROGRAMS\سستمهالي\إلغاء التثبيت.lnk"
  RMDir "$SMPROGRAMS\سستمهالي"

  ; Remove Installed Directory
  RMDir /r "$INSTDIR"

  ; Remove Registry Keys
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_DIR}"
  DeleteRegKey HKCU "Software\${APP_DIR}"
SectionEnd
