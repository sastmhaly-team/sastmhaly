/**
 * Production-ready CSV exporter with UTF-8 BOM for Microsoft Excel Arabic compatibility
 * and protection against formula injection attacks.
 */

export interface ExportColumn<T> {
  header: string;
  key: keyof T | ((row: T) => string | number | undefined | null);
}

export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '""';
  }

  let str = String(value).trim();

  // Protect against CSV / Excel Formula Injection
  // If cell starts with =, +, -, @, \t, \r, prepend a single quote
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Escape double quotes by doubling them
  str = str.replace(/"/g, '""');

  return `"${str}"`;
}

export function generateCsv<T>(data: T[], columns: ExportColumn<T>[]): string {
  // \uFEFF is the UTF-8 Byte Order Mark (BOM) for Excel
  const bom = '\uFEFF';

  const headers = columns.map(col => sanitizeCsvCell(col.header)).join(',');

  const rows = data.map(row => {
    return columns.map(col => {
      let val: unknown;
      if (typeof col.key === 'function') {
        val = col.key(row);
      } else {
        val = row[col.key];
      }
      return sanitizeCsvCell(val);
    }).join(',');
  });

  return bom + [headers, ...rows].join('\r\n');
}

export function downloadCsv(filename: string, csvContent: string): void {
  if (typeof window === 'undefined') return;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToCsv<T extends Record<string, any>>(
  filename: string,
  data: T[],
  headers: Array<{ key: string; labelEn?: string; labelAr?: string; header?: string }>,
  isRtl: boolean = false
): void {
  const columns: ExportColumn<T>[] = headers.map(h => ({
    header: h.header || (isRtl ? (h.labelAr || h.labelEn || h.key) : (h.labelEn || h.labelAr || h.key)),
    key: (row: T) => row[h.key]
  }));

  const csv = generateCsv(data, columns);
  downloadCsv(filename, csv);
}
