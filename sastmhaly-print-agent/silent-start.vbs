Set WshShell = CreateObject("WScript.Shell")
scriptDir = WshShell.ExpandEnvironmentStrings("%LOCALAPPDATA%\SastmhalyPrintAgent")
ps1File = scriptDir & "\SastmhalyPrintAgent.ps1"
WshShell.Run "powershell.exe -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File """ & ps1File & """", 0, False
