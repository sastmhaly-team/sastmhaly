'use client';

const AGENT_PORT = 18274;

// Try multiple URLs in order — covers IPv4, IPv6, and hostname resolution variants.
// Chrome allows HTTP requests to 'localhost' and '127.0.0.1' from HTTPS pages
// (secure context exception). We try both because Windows may resolve 'localhost'
// to either 127.0.0.1 (IPv4) or ::1 (IPv6) depending on the hosts file.
const AGENT_URLS = [
  `http://localhost:${AGENT_PORT}`,
  `http://127.0.0.1:${AGENT_PORT}`,
];

export interface AgentPrinter {
  name: string;
  isDefault: boolean;
  port?: string;
}

export interface AgentStatus {
  connected: boolean;
  version?: string;
  platform?: string;
  url?: string; // which URL worked
}

/**
 * Try a single URL with timeout. Returns the response or null.
 */
async function tryFetch(url: string, timeoutMs: number, options?: RequestInit): Promise<Response | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch {
    return null;
  }
}

/**
 * Check if the Sastmhaly Desktop Print Agent is running.
 * Tries multiple URLs and retries to handle intermittent connections.
 */
export async function checkPrintAgentStatus(): Promise<AgentStatus> {
  if (typeof window === 'undefined') return { connected: false };

  // Try each URL with 2 attempts each, 2 second timeout per attempt
  for (const baseUrl of AGENT_URLS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await tryFetch(`${baseUrl}/status`, 2000, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (res && res.ok) {
        try {
          const data = await res.json();
          if (data && (data.status === 'ok' || data.app?.includes('Sastmhaly'))) {
            return {
              connected: true,
              version: data.version || '1.0.0',
              platform: data.platform || 'Windows',
              url: baseUrl,
            };
          }
        } catch {
          // JSON parse failed — not our agent
        }
      }

      // Small pause between retries
      if (attempt === 0) await new Promise(r => setTimeout(r, 300));
    }
  }

  return { connected: false };
}

// Cache the working URL so subsequent calls don't scan all URLs
let _workingBaseUrl: string | null = null;

async function getWorkingBaseUrl(): Promise<string | null> {
  if (_workingBaseUrl) {
    // Verify it's still alive (quick check)
    const res = await tryFetch(`${_workingBaseUrl}/status`, 1500);
    if (res && res.ok) return _workingBaseUrl;
    _workingBaseUrl = null; // was cached but now dead — re-detect
  }

  const status = await checkPrintAgentStatus();
  if (status.connected && status.url) {
    _workingBaseUrl = status.url;
    return _workingBaseUrl;
  }
  return null;
}

/**
 * Get list of installed Windows printers from the local Print Agent
 */
export async function getPrintAgentPrinters(): Promise<{ success: boolean; printers: AgentPrinter[]; defaultPrinter?: string; error?: string }> {
  const baseUrl = await getWorkingBaseUrl();
  if (!baseUrl) return { success: false, printers: [], error: 'مساعد الطباعة غير متصل' };

  const res = await tryFetch(`${baseUrl}/printers`, 3000, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (res && res.ok) {
    try {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.printers)) {
        const defaultP = data.printers.find((p: AgentPrinter) => p.isDefault)?.name;
        return {
          success: true,
          printers: data.printers,
          defaultPrinter: defaultP || (data.printers.length > 0 ? data.printers[0].name : undefined),
        };
      }
    } catch {
      // ignore
    }
  }

  return { success: false, printers: [], error: 'تعذر جلب قائمة الطابعات' };
}

/**
 * Send raw binary TSPL or ESC/POS buffer directly to a Windows printer via the Print Agent
 */
export async function printRawViaAgent(
  buffer: Uint8Array,
  printerName?: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  const baseUrl = await getWorkingBaseUrl();
  if (!baseUrl) {
    return { success: false, error: 'مساعد طباعة سستمهالي غير متصل. تأكد من تشغيل البرنامج.' };
  }

  try {
    const base64Data = uint8ArrayToBase64(buffer);

    const res = await tryFetch(`${baseUrl}/print-raw`, 8000, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        printerName: printerName || undefined,
        base64Data,
      }),
    });

    if (!res) {
      _workingBaseUrl = null; // connection dropped — re-detect next time
      return { success: false, error: 'انتهت مهلة إرسال البيانات لمساعد الطباعة' };
    }

    const result = await res.json();
    return result;
  } catch (err: any) {
    _workingBaseUrl = null;
    console.error('Print Agent error:', err);
    return {
      success: false,
      error: 'فشل الاتصال بمساعد طباعة سستمهالي. تأكد من تشغيل البرنامج.',
    };
  }
}

/**
 * Safe chunked conversion of Uint8Array to base64 string
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}
