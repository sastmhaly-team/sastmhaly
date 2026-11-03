' Sastmhaly POS - Silent Native Launcher
Option Explicit
Dim oShell, oFSO, appDir, nodeExe, configFile, phone, pass, targetUrl
Dim http, i, ready, edgePath, chromePath, appLaunched, content

Set oShell = CreateObject("WScript.Shell")
Set oFSO = CreateObject("Scripting.FileSystemObject")

appDir = oFSO.GetParentFolderName(WScript.ScriptFullName)

' Check if node server is already running on port 3456
Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
On Error Resume Next
http.Open "GET", "http://127.0.0.1:3456", False
http.Send
If Err.Number <> 0 Then
  ' Not running, start server silently using bundled node.exe
  nodeExe = appDir & "\node.exe"
  If Not oFSO.FileExists(nodeExe) Then
    nodeExe = "node.exe"
  End If
  
  ' Set environment and start node server silently (0 = hide window)
  oShell.CurrentDirectory = appDir
  oShell.Run "cmd /c set OFFLINE_MODE=true&&set DATABASE_MODE=sqlite&&set PORT=3456&&""" & nodeExe & """ server.js", 0, False
  
  ' Wait for server to start (up to 30 seconds)
  ready = False
  For i = 1 To 60
    WScript.Sleep 500
    Err.Clear
    http.Open "GET", "http://127.0.0.1:3456", False
    http.Send
    If Err.Number = 0 Then
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

