; Sastmhaly POS Launcher NSIS Script
Unicode True
RequestExecutionLevel user
SilentInstall silent
OutFile "Sastmhaly_POS.exe"
Icon "app.ico"

VIProductVersion "1.0.0.0"
VIAddVersionKey "ProductName" "سستمهالي - Sastmhaly POS"
VIAddVersionKey "CompanyName" "Sastmhaly POS"
VIAddVersionKey "FileDescription" "نظام نقاط البيع وإدارة المتاجر"
VIAddVersionKey "FileVersion" "1.0.0.0"
VIAddVersionKey "LegalCopyright" "Copyright © 2026 Sastmhaly"

Section
  ; Execute run_app.vbs using wscript.exe silently from the same directory
  SetOutPath "$EXEDIR"
  Exec '"$WINDIR\System32\wscript.exe" "$EXEDIR\run_app.vbs"'
SectionEnd

