' Sastmhaly POS - Silent Native Launcher
Option Explicit
Dim oShell, oFSO, appDir, appExe

Set oShell = CreateObject("WScript.Shell")
Set oFSO = CreateObject("Scripting.FileSystemObject")

appDir = oFSO.GetParentFolderName(WScript.ScriptFullName)
appExe = oShell.ExpandEnvironmentStrings("%LOCALAPPDATA%\SastmhalyPOS\Sastmhaly_POS.exe")

If oFSO.FileExists(appExe) Then
  oShell.Run """" & appExe & """", 1, False
ElseIf oFSO.FileExists(appDir & "\Sastmhaly-Store-Setup.exe") Then
  oShell.Run """" & appDir & "\Sastmhaly-Store-Setup.exe""", 1, False
ElseIf oFSO.FileExists(appDir & "\Sastmhaly-POS-Setup.exe") Then
  oShell.Run """" & appDir & "\Sastmhaly-POS-Setup.exe""", 1, False
End If

Set oShell = Nothing
Set oFSO = Nothing
