# ==============================================================================
# Sastmhaly Desktop Print Agent (مساعد طباعة سستمهالي)
# Lightweight Local Print Agent for Windows (Zero dependencies, pure PowerShell)
# Enables instant, silent raw TSPL / ESC-POS printing directly from the web app.
#
# HOW IT WORKS:
#   - Listens on http://127.0.0.1:18274/ for print commands from the web browser
#   - Uses Win32 RAW spooler API (WritePrinter) to send TSPL directly to printer
#   - Zero GDI overhead → zero blank labels → pixel-perfect size every time
# ==============================================================================

$ErrorActionPreference = "Continue"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

$port  = 18274
$logPath = "$env:TEMP\SastmhalyPrintAgent.log"

function Write-Log($msg) {
    $ts = Get-Date -Format "HH:mm:ss"
    $line = "[$ts] $msg"
    Add-Content -Path $logPath -Value $line -Encoding UTF8 -ErrorAction SilentlyContinue
    try { Write-Host $line } catch { }
}

Write-Log "=========================================="
Write-Log " مساعد طباعة سستمهالي - يبدأ..."
Write-Log "=========================================="

# ---------------------------------------------------------------------------
# Register URL reservation so HttpListener works WITHOUT admin rights.
# This is required on Windows Vista+ for non-admin users.
# If it fails (needs elevation), we fall back to localhost only.
# ---------------------------------------------------------------------------
function Register-UrlAcl($url) {
    try {
        $existing = & netsh http show urlacl url=$url 2>&1
        if ($existing -match [regex]::Escape($url)) {
            Write-Log "[OK] URL ACL موجود بالفعل: $url"
            return $true
        }
        $result = & netsh http add urlacl url=$url user="$env:USERDOMAIN\$env:USERNAME" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Log "[OK] تم تسجيل URL ACL: $url"
            return $true
        }
        Write-Log "[!] فشل تسجيل URL ACL (يحتاج صلاحيات): $result"
        return $false
    } catch {
        Write-Log "[!] استثناء أثناء تسجيل URL ACL: $_"
        return $false
    }
}

$url127  = "http://127.0.0.1:$port/"
$urlLH   = "http://localhost:$port/"
$urlIPv6 = "http://[::1]:$port/"

Register-UrlAcl $url127  | Out-Null
Register-UrlAcl $urlLH   | Out-Null
Register-UrlAcl $urlIPv6 | Out-Null

# ---------------------------------------------------------------------------
# Win32 P/Invoke for RAW spooler printing (bypasses GDI page model entirely)
# ---------------------------------------------------------------------------
$win32Code = @"
using System;
using System.Runtime.InteropServices;

public class RawPrinterHelper {
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

    public static bool SendBytesToPrinter(string szPrinterName, byte[] bytes) {
        if (bytes == null || bytes.Length == 0) return false;
        IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
        Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
        IntPtr hPrinter = IntPtr.Zero;
        DOCINFOA di = new DOCINFOA();
        di.pDocName  = "Sastmhaly Label";
        di.pDataType = "RAW";
        bool success = false;
        try {
            if (OpenPrinter(szPrinterName, out hPrinter, IntPtr.Zero)) {
                if (StartDocPrinter(hPrinter, 1, di)) {
                    if (StartPagePrinter(hPrinter)) {
                        Int32 dwWritten = 0;
                        success = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out dwWritten);
                        EndPagePrinter(hPrinter);
                    }
                    EndDocPrinter(hPrinter);
                }
                ClosePrinter(hPrinter);
            }
        } catch (Exception) {
            success = false;
        } finally {
            Marshal.FreeCoTaskMem(pUnmanagedBytes);
        }
        return success;
    }
}
"@

try {
    Add-Type -TypeDefinition $win32Code -ErrorAction Stop
    Write-Log "[OK] Win32 RAW Printer API ready."
} catch {
    $errMsg = $_.Exception.Message
    if ($errMsg -match "already defined" -or $errMsg -match "already exists") {
        Write-Log "[OK] Win32 API already loaded (session reuse)."
    } else {
        Write-Log "[WARN] Add-Type warning (non-fatal): $errMsg"
        # Try loading without error action as fallback
        try { Add-Type -TypeDefinition $win32Code 2>$null } catch { }
    }
}

# ---------------------------------------------------------------------------
# Start HTTP Listener
# ---------------------------------------------------------------------------
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($url127)
$listener.Prefixes.Add($urlLH)
$listener.Prefixes.Add($urlIPv6)

try {
    $listener.Start()
    Write-Log "[OK] الخادم يعمل على http://127.0.0.1:$port/"
    Write-Log "[OK] جاهز لاستقبال اوامر الطباعة من سستمهالي."
} catch [System.Net.HttpListenerException] {
    Write-Log "[ERROR] فشل تشغيل الخادم (HttpListenerException): $($_.Exception.Message)"
    Write-Log "[ERROR] رمز الخطأ: $($_.Exception.ErrorCode)"
    # Port already in use — another instance is running
    if ($_.Exception.ErrorCode -eq 183 -or $_.Exception.Message -match "conflicts") {
        Write-Log "[INFO] يبدو ان المساعد مفتوح بالفعل. لا حاجة لتشغيل نسخة جديدة."
    }
    exit 0
} catch {
    Write-Log "[ERROR] خطأ غير متوقع عند تشغيل الخادم: $_"
    exit 1
}

# Helper: send JSON response with CORS headers
function Send-JsonResponse($response, $data, $statusCode = 200) {
    try {
        $json   = $data | ConvertTo-Json -Compress -Depth 4
        $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)

        $response.StatusCode    = $statusCode
        $response.ContentType   = "application/json; charset=utf-8"
        $response.Headers.Add("Access-Control-Allow-Origin",          "*")
        $response.Headers.Add("Access-Control-Allow-Methods",         "GET, POST, OPTIONS")
        $response.Headers.Add("Access-Control-Allow-Headers",         "Content-Type, Authorization, *")
        $response.Headers.Add("Access-Control-Allow-Private-Network", "true")
        $response.ContentLength64 = $buffer.Length
        $response.OutputStream.Write($buffer, 0, $buffer.Length)
    } catch { }
    try { $response.OutputStream.Close() } catch { }
}

# ---------------------------------------------------------------------------
# Main request loop
# ---------------------------------------------------------------------------
Write-Log "[OK] الحلقة الرئيسية تعمل - في انتظار طلبات الطباعة..."

while ($listener.IsListening) {
    try {
        $context  = $listener.GetContext()
        $request  = $context.Request
        $response = $context.Response

        $path   = $request.Url.AbsolutePath.ToLower().TrimEnd('/')
        $method = $request.HttpMethod.ToUpper()

        Write-Log ">>> $method $path"

        # CORS Preflight
        if ($method -eq "OPTIONS") {
            $response.StatusCode = 204
            $response.Headers.Add("Access-Control-Allow-Origin",          "*")
            $response.Headers.Add("Access-Control-Allow-Methods",         "GET, POST, OPTIONS")
            $response.Headers.Add("Access-Control-Allow-Headers",         "Content-Type, *")
            $response.Headers.Add("Access-Control-Allow-Private-Network", "true")
            try { $response.OutputStream.Close() } catch { }
            continue
        }

        # GET /status  or  GET /  or  GET /health
        if ($method -eq "GET" -and ($path -eq "/status" -or $path -eq "" -or $path -eq "/health")) {
            Send-JsonResponse $response @{
                status   = "ok"
                app      = "Sastmhaly Print Agent"
                version  = "1.1.0"
                platform = "Windows"
                port     = $port
            }
            continue
        }

        # GET /printers
        if ($method -eq "GET" -and $path -eq "/printers") {
            $printers = @()
            try {
                $rawList = Get-CimInstance Win32_Printer -ErrorAction Stop | Select-Object Name, Default, PortName
                foreach ($p in $rawList) {
                    $printers += @{ name = $p.Name; isDefault = [bool]$p.Default; port = $p.PortName }
                }
            } catch {
                try {
                    $rawList = Get-WmiObject Win32_Printer -ErrorAction Stop | Select-Object Name, Default, PortName
                    foreach ($p in $rawList) {
                        $printers += @{ name = $p.Name; isDefault = [bool]$p.Default; port = $p.PortName }
                    }
                } catch {
                    Write-Log "[!] تعذر جلب الطابعات: $_"
                }
            }
            Send-JsonResponse $response @{ success = $true; printers = $printers }
            continue
        }

        # POST /print-raw
        if ($method -eq "POST" -and $path -eq "/print-raw") {
            try {
                $reader   = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $bodyText = $reader.ReadToEnd()
                $reader.Close()

                $body        = $bodyText | ConvertFrom-Json
                $printerName = $body.printerName
                $base64Data  = $body.base64Data

                # Auto-detect default printer if none specified
                if (-not $printerName) {
                    try {
                        $def = Get-CimInstance Win32_Printer -Filter "Default = True" -ErrorAction Stop | Select-Object -First 1
                        if ($def) { $printerName = $def.Name }
                    } catch {
                        $def = Get-WmiObject Win32_Printer -Filter "Default = True" -ErrorAction Stop | Select-Object -First 1
                        if ($def) { $printerName = $def.Name }
                    }
                }

                if (-not $printerName) {
                    Send-JsonResponse $response @{ success = $false; error = "لم يتم تحديد طابعة ولا توجد طابعة افتراضية" } 400
                    continue
                }
                if (-not $base64Data) {
                    Send-JsonResponse $response @{ success = $false; error = "بيانات الطباعة مفقودة (base64Data)" } 400
                    continue
                }

                $bytes = [System.Convert]::FromBase64String($base64Data)
                Write-Log "[PRINT] الطابعة: $printerName | الحجم: $($bytes.Length) bytes"

                $ok = [RawPrinterHelper]::SendBytesToPrinter($printerName, $bytes)

                if ($ok) {
                    Write-Log "[OK] تمت الطباعة بنجاح!"
                    Send-JsonResponse $response @{ success = $true; message = "تمت الطباعة بنجاح"; printer = $printerName; bytesSent = $bytes.Length }
                } else {
                    Write-Log "[!] فشل إرسال البيانات للطابعة."
                    Send-JsonResponse $response @{ success = $false; error = "فشل إرسال بيانات الطباعة. تاكد من تشغيل الطابعة وتوصيلها." } 500
                }
            } catch {
                Write-Log "[ERROR] خطأ في معالجة طلب الطباعة: $_"
                Send-JsonResponse $response @{ success = $false; error = "خطأ داخلي: $_" } 500
            }
            continue
        }

        # 404
        Send-JsonResponse $response @{ success = $false; error = "Endpoint not found: $path" } 404

    } catch [System.Net.HttpListenerException] {
        # Listener was stopped cleanly
        Write-Log "[INFO] تم إيقاف الخادم."
        break
    } catch {
        Write-Log "[ERROR] خطأ في الحلقة الرئيسية: $_"
    }
}

Write-Log "[INFO] المساعد انتهى."
