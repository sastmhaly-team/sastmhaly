# ==============================================================================
# Sastmhaly Desktop Print Agent (مساعد طباعة سستمهالي)
# Lightweight Local Print Agent for Windows (Zero dependencies, pure PowerShell)
# Enables instant, silent raw TSPL / ESC-POS printing directly from the web app.
# ==============================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "سستمهالي - مساعد الطباعة المباشرة (Sastmhaly Print Agent)"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "       سستمهالي - مساعد الطباعة المباشرة (Print Agent)     " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "جاري تهيئة خادم الطباعة المحلي..." -ForegroundColor Gray

# Define Win32 RawPrinterHelper P/Invoke
$win32Code = @"
using System;
using System.IO;
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
        di.pDocName = "Sastmhaly Print Job";
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
} catch {
    # If already loaded in current session, ignore
}

# Start HTTP Listener on port 18274
$port = 18274
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$port/")
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
    Write-Host "[✓] خادم الطباعة يعمل بنجاح على: http://127.0.0.1:$port/" -ForegroundColor Green
    Write-Host "[✓] جاهز لاستقبال أوامر الطباعة من متصفح سستمهالي تلقائياً." -ForegroundColor Green
    Write-Host "اترك هذه النافذة مفتوحة أثناء استخدام الكاشير ونظام الباركود." -ForegroundColor Gray
    Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray
} catch {
    Write-Host "[!] فشل تشغيل الخادم على المنفذ $port. قد يكون البرنامج مفتوحاً بالفعل في الخلفية." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor DarkRed
    Read-Host "اضغط Enter للإغلاق..."
    Exit
}

# Helper to send JSON response with full CORS & Private Network Access headers
function Send-JsonResponse($response, $data, $statusCode = 200) {
    $json = $data | ConvertTo-Json -Compress -Depth 4
    $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)

    $response.StatusCode = $statusCode
    $response.ContentType = "application/json; charset=utf-8"
    $response.Headers.Add("Access-Control-Allow-Origin", "*")
    $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, *")
    $response.Headers.Add("Access-Control-Allow-Private-Network", "true")

    $response.ContentLength64 = $buffer.Length
    $response.OutputStream.Write($buffer, 0, $buffer.Length)
    $response.OutputStream.Close()
}

# Main event loop
while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $path = $request.Url.AbsolutePath.ToLower()
        $method = $request.HttpMethod.ToUpper()

        # Handle CORS Preflight OPTIONS
        if ($method -eq "OPTIONS") {
            $response.StatusCode = 204
            $response.Headers.Add("Access-Control-Allow-Origin", "*")
            $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, *")
            $response.Headers.Add("Access-Control-Allow-Private-Network", "true")
            $response.OutputStream.Close()
            continue
        }

        # Route: GET /status or /health
        if ($method -eq "GET" -and ($path -eq "/status" -or $path -eq "/health" -or $path -eq "/")) {
            Send-JsonResponse $response @{
                status = "ok"
                app = "Sastmhaly Print Agent"
                version = "1.0.0"
                platform = "Windows"
            }
            continue
        }

        # Route: GET /printers
        if ($method -eq "GET" -and $path -eq "/printers") {
            $printers = @()
            try {
                $rawList = Get-CimInstance Win32_Printer | Select-Object Name, Default, PortName, DriverName
                foreach ($p in $rawList) {
                    $printers += @{
                        name = $p.Name
                        isDefault = [bool]$p.Default
                        port = $p.PortName
                    }
                }
            } catch {
                # Fallback to WMI
                $rawList = Get-WmiObject Win32_Printer | Select-Object Name, Default, PortName
                foreach ($p in $rawList) {
                    $printers += @{
                        name = $p.Name
                        isDefault = [bool]$p.Default
                        port = $p.PortName
                    }
                }
            }

            Send-JsonResponse $response @{
                success = $true
                printers = $printers
            }
            continue
        }

        # Route: POST /print-raw
        if ($method -eq "POST" -and $path -eq "/print-raw") {
            $reader = New-Object System.IO.StreamReader($request.InputStream, $request.ContentEncoding)
            $bodyText = $reader.ReadToEnd()
            $reader.Close()

            $body = $bodyText | ConvertFrom-Json

            $printerName = $body.printerName
            $base64Data = $body.base64Data

            if (-not $printerName) {
                # Get default printer if not specified
                $defaultPrinter = Get-CimInstance Win32_Printer -Filter "Default = True"
                if ($defaultPrinter) {
                    $printerName = $defaultPrinter.Name
                }
            }

            if (-not $printerName) {
                Send-JsonResponse $response @{
                    success = $false
                    error = "لم يتم العثور على طابعة محددة أو طابعة افتراضية"
                } 400
                continue
            }

            if (-not $base64Data) {
                Send-JsonResponse $response @{
                    success = $false
                    error = "بيانات الطباعة مفقودة (base64Data)"
                } 400
                continue
            }

            $bytes = [System.Convert]::FromBase64String($base64Data)

            Write-Host "[+] جاري إرسال أمر طباعة مباشر إلى: $printerName ($($bytes.Length) بايت)..." -ForegroundColor Cyan

            $ok = [RawPrinterHelper]::SendBytesToPrinter($printerName, $bytes)

            if ($ok) {
                Write-Host "[✓] تمت الطباعة بنجاح وبدون أي هدر للورق!" -ForegroundColor Green
                Send-JsonResponse $response @{
                    success = $true
                    message = "تمت الطباعة بنجاح"
                    printer = $printerName
                    bytesSent = $bytes.Length
                }
            } else {
                Write-Host "[!] فشل إرسال البيانات للطابعة $printerName" -ForegroundColor Red
                Send-JsonResponse $response @{
                    success = $false
                    error = "فشل إرسال البيانات المباشرة للطابعة ($printerName). تأكد من تشغيل الطابعة وتوصيل الكابل."
                } 500
            }
            continue
        }

        # 404 Not Found
        Send-JsonResponse $response @{
            success = $false
            error = "Endpoint not found: $path"
        } 404

    } catch {
        Write-Host "[!] خطأ أثناء معالجة الطلب: $_" -ForegroundColor Red
    }
}

