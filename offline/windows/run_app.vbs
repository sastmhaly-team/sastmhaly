' Sastmhaly POS - Silent Native Launcher
Option Explicit
Dim oShell, oFSO, appDir, installedDir, nodeExe, configFile, phone, pass, targetUrl
Dim http, i, ready, edgePath, chromePath, appLaunched, content, installerExe, f, files

Set oShell = CreateObject("WScript.Shell")
Set oFSO = CreateObject("Scripting.FileSystemObject")

appDir = oFSO.GetParentFolderName(WScript.ScriptFullName)
installedDir = "C:\SastmhalyPOS"

' Read custom install directory from registry if user installed to another folder
On Error Resume Next
Dim regDir
regDir = oShell.RegRead("HKCU\Software\SastmhalyPOS\InstallDir")
If regDir <> "" And oFSO.FolderExists(regDir) Then
  installedDir = regDir
End If
On Error GoTo 0

If Not oFSO.FileExists(installedDir & "\server.js") Then
  installedDir = oShell.ExpandEnvironmentStrings("%LOCALAPPDATA%\SastmhalyPOS")
End If

' If server.js is not in the current folder, check if it was installed in AppData
If Not oFSO.FileExists(appDir & "\server.js") Then
  If oFSO.FileExists(installedDir & "\server.js") Then
    ' Copy sastmhaly_config.json from current directory if present
    If oFSO.FileExists(appDir & "\sastmhaly_config.json") Then
      On Error Resume Next
      oFSO.CopyFile appDir & "\sastmhaly_config.json", installedDir & "\sastmhaly_config.json", True
      On Error GoTo 0
    End If
    appDir = installedDir
  Else
    ' Not installed and not in current folder - find installer in current folder
    installerExe = ""
    Set files = oFSO.GetFolder(appDir).Files
    For Each f In files
      If LCase(oFSO.GetExtensionName(f.Name)) = "exe" And (InStr(f.Name, "Setup") > 0 Or InStr(f.Name, "تثبيت") > 0) Then
        installerExe = f.Path
        Exit For
      End If
    Next
    If installerExe <> "" Then
      oShell.Run """" & installerExe & """", 1, True
      If oFSO.FileExists(installedDir & "\server.js") Then
        appDir = installedDir
      End If
    End If
  End If
End If

' Check if node server is already running and healthy on port 3456
Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
On Error Resume Next
http.Open "GET", "http://127.0.0.1:3456/login", False
http.Send
If Err.Number <> 0 Or http.Status >= 500 Then
  ' Kill any zombie or hung node.exe
  oShell.Run "cmd /c taskkill /F /IM node.exe 2>nul", 0, True
  WScript.Sleep 500

  ' Not running, start server silently using bundled node.exe
  nodeExe = appDir & "\node.exe"
  If Not oFSO.FileExists(nodeExe) Then
    nodeExe = installedDir & "\node.exe"
    If Not oFSO.FileExists(nodeExe) Then
      nodeExe = "node.exe"
    End If
  End If
  
  ' Set environment and start node server silently (0 = hide window)
  oShell.CurrentDirectory = appDir
  oShell.Run "cmd /c cd /d """ & appDir & """ && set ""OFFLINE_MODE=true"" && set ""DATABASE_MODE=sqlite"" && set ""IS_OFFLINE_BUNDLE=true"" && set ""NEXT_PUBLIC_OFFLINE_MODE=true"" && set ""PORT=3456"" && set ""APP_DIR=" & appDir & """ && """ & nodeExe & """ server.js > """ & oShell.ExpandEnvironmentStrings("%TEMP%\sastmhaly_server.log") & """ 2>&1", 0, False
  
  ' Wait for server to start (up to 30 seconds)
  ready = False
  For i = 1 To 60
    WScript.Sleep 500
    Err.Clear
    http.Open "GET", "http://127.0.0.1:3456/login", False
    http.Send
    If Err.Number = 0 And http.Status < 500 Then
      ready = True
      Exit For
    End If
  Next
End If
On Error GoTo 0

' Read merchant credentials from sastmhaly_config.json if present
phone = ""
pass = ""
configFile = appDir & "\sastmhaly_config.json"
If oFSO.FileExists(configFile) Then
  Set content = oFSO.OpenTextFile(configFile, 1)
  Dim fileText
  fileText = content.ReadAll()
  content.Close()
  phone = ExtractJsonValue(fileText, "phone")
  pass = ExtractJsonValue(fileText, "password")
End If

If phone <> "" Then
  targetUrl = "http://127.0.0.1:3456/login?phone=" & phone & "&pass=" & pass
Else
  targetUrl = "http://127.0.0.1:3456/login"
End If

' Launch in standalone Native App Window (App Mode - NO URL BAR, NO TABS, NO BROWSER CONTROLS)
appLaunched = False

edgePath = oShell.ExpandEnvironmentStrings("%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe")
If Not oFSO.FileExists(edgePath) Then
  edgePath = oShell.ExpandEnvironmentStrings("%ProgramFiles%\Microsoft\Edge\Application\msedge.exe")
End If

chromePath = oShell.ExpandEnvironmentStrings("%ProgramFiles%\Google\Chrome\Application\chrome.exe")
If Not oFSO.FileExists(chromePath) Then
  chromePath = oShell.ExpandEnvironmentStrings("%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe")
End If
If Not oFSO.FileExists(chromePath) Then
  chromePath = oShell.ExpandEnvironmentStrings("%LocalAppData%\Google\Chrome\Application\chrome.exe")
End If

If oFSO.FileExists(edgePath) Then
  oShell.Run """" & edgePath & """ --app=""" & targetUrl & """ --window-size=1366,868", 1, False
  appLaunched = True
ElseIf oFSO.FileExists(chromePath) Then
  oShell.Run """" & chromePath & """ --app=""" & targetUrl & """ --window-size=1366,868", 1, False
  appLaunched = True
Else
  ' Fallback to default browser
  oShell.Run targetUrl, 1, False
End If

Function ExtractJsonValue(json, key)
  Dim p, p2, pValStart, pValEnd
  p = InStr(json, """" & key & """")
  If p > 0 Then
    p2 = InStr(p, json, ":")
    If p2 > 0 Then
      pValStart = InStr(p2, json, """")
      If pValStart > 0 Then
        pValEnd = InStr(pValStart + 1, json, """")
        If pValEnd > 0 Then
          ExtractJsonValue = Mid(json, pValStart + 1, pValEnd - pValStart - 1)
          Exit Function
        End If
      End If
    End If
  End If
  ExtractJsonValue = ""
End Function

