!define PRODUCT_NAME "سستمهالي - نقاط البيع"
!define PRODUCT_NAME_EN "Sastmhaly POS"
!define PRODUCT_VERSION "1.0.0"
!define PRODUCT_PUBLISHER "سستمهالي"
!define PRODUCT_WEB_SITE "https://sastmhaly.com"
!define PRODUCT_DIR_REGKEY "Software\Microsoft\Windows\CurrentVersion\App Paths\SastmhalyPOS.exe"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME_EN}"

Unicode true
SetCompressor /SOLID lzma

!include "MUI2.nsh"
!include "FileFunc.nsh"

; MUI Settings
!define MUI_ABORTWARNING
!define MUI_ICON "app.ico"
!define MUI_UNICON "app.ico"

; Installer Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\launcher.vbs"
!define MUI_FINISHPAGE_RUN_TEXT "تشغيل نظام سستمهالي الآن"
!insertmacro MUI_PAGE_FINISH

; Uninstaller Pages
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; Language
!insertmacro MUI_LANGUAGE "Arabic"

Name "${PRODUCT_NAME}"
OutFile "Sastmhaly-Store-Setup.exe"
InstallDir "$LOCALAPPDATA\SastmhalyPOS"
ShowInstDetails show
ShowUnInstDetails show

Section "MainSection" SEC01
  SetOutPath "$INSTDIR"
  SetOverwrite ifnewer

  File "node.exe"
  File "server.js"
  File "db.js"
  File "package.json"
  File "app.ico"
  File "run_app.bat"
  File "launcher.vbs"
  File "stop_app.bat"

  SetOutPath "$INSTDIR\public"
  File /r "public\*.*"

  SetOutPath "$INSTDIR\node_modules"
  File /r "node_modules\*.*"

  ; Create shortcuts
  CreateDirectory "$SMPROGRAMS\سستمهالي"
  CreateShortcut "$SMPROGRAMS\سستمهالي\${PRODUCT_NAME}.lnk" "$INSTDIR\launcher.vbs" "" "$INSTDIR\app.ico" 0
  CreateShortcut "$SMPROGRAMS\سستمهالي\إيقاف النظام.lnk" "$INSTDIR\stop_app.bat" "" "$INSTDIR\app.ico" 0
  CreateShortcut "$SMPROGRAMS\سستمهالي\إلغاء التثبيت.lnk" "$INSTDIR\uninst.exe" "" "$INSTDIR\app.ico" 0
  CreateShortcut "$DESKTOP\سستمهالي - نقاط البيع.lnk" "$INSTDIR\launcher.vbs" "" "$INSTDIR\app.ico" 0

SectionEnd

Section -Post
  WriteUninstaller "$INSTDIR\uninst.exe"
  WriteRegStr HKCU "${PRODUCT_DIR_REGKEY}" "" "$INSTDIR\launcher.vbs"
  WriteRegStr HKCU "${PRODUCT_UNINST_KEY}" "DisplayName" "$(^Name)"
  WriteRegStr HKCU "${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\uninst.exe"
  WriteRegStr HKCU "${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\app.ico"
  WriteRegStr HKCU "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr HKCU "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
SectionEnd

Section Uninstall
  Delete "$DESKTOP\سستمهالي - نقاط البيع.lnk"
  Delete "$SMPROGRAMS\سستمهالي\*.*"
  RMDir "$SMPROGRAMS\سستمهالي"

  RMDir /r "$INSTDIR\public"
  RMDir /r "$INSTDIR\node_modules"
  Delete "$INSTDIR\node.exe"
  Delete "$INSTDIR\server.js"
  Delete "$INSTDIR\db.js"
  Delete "$INSTDIR\package.json"
  Delete "$INSTDIR\app.ico"
  Delete "$INSTDIR\run_app.bat"
  Delete "$INSTDIR\launcher.vbs"
  Delete "$INSTDIR\stop_app.bat"
  Delete "$INSTDIR\uninst.exe"

  ; Note: we keep data/ to protect database from accidental loss

  DeleteRegKey HKCU "${PRODUCT_UNINST_KEY}"
  DeleteRegKey HKCU "${PRODUCT_DIR_REGKEY}"
  SetAutoClose true
SectionEnd

