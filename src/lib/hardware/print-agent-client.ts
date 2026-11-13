'use client';

const AGENT_PORT = 18274;
const AGENT_BASE_URL = `http://127.0.0.1:${AGENT_PORT}`;

export interface AgentPrinter {
  name: string;
  isDefault: boolean;
  port?: string;
}

export interface AgentStatus {
  connected: boolean;
  version?: string;
  platform?: string;
}

/**
 * Check if the Sastmhaly Desktop Print Agent is running on the local PC
 */
export async function checkPrintAgentStatus(): Promise<AgentStatus> {
  if (typeof window === 'undefined') return { connected: false };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);

    const res = await fetch(`${AGENT_BASE_URL}/status`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json'
      }
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && (data.status === 'ok' || data.app?.includes('Sastmhaly'))) {
        return {
          connected: true,
          version: data.version || '1.0.0',
          platform: data.platform || 'Windows'
        };
      }
    }
  } catch {
    // Agent is not running
  }

  return { connected: false };
}

/**
 * Get list of installed Windows printers from the local Print Agent
 */
export async function getPrintAgentPrinters(): Promise<{ success: boolean; printers: AgentPrinter[]; defaultPrinter?: string; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(`${AGENT_BASE_URL}/printers`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json'
      }
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.printers)) {
        const defaultP = data.printers.find((p: AgentPrinter) => p.isDefault)?.name;
        return {
          success: true,
          printers: data.printers,
          defaultPrinter: defaultP || (data.printers.length > 0 ? data.printers[0].name : undefined)
        };
      }
    }
  } catch (err: any) {
    return { success: false, printers: [], error: err.message || 'فشل الاتصال بمساعد الطباعة' };
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
  try {
    const base64Data = uint8ArrayToBase64(buffer);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${AGENT_BASE_URL}/print-raw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        printerName: printerName || undefined,
        base64Data
      })
    });

    clearTimeout(timeoutId);

    const result = await res.json();
    return result;
  } catch (err: any) {
    console.error('Print Agent error:', err);
    return {
      success: false,
      error: err.name === 'AbortError'
        ? 'انتهت مهلة إرسال البيانات لمساعد الطباعة'
        : 'فشل الاتصال بمساعد طباعة سستمهالي. تأكد من تشغيل البرنامج.'
    };
  }
}

/**
 * Safe conversion of Uint8Array to base64 string
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

