/**
 * Pure Code 128 (Subset B) Barcode Generator & Helper
 * Generates crisp vector SVGs scannable by all standard 1D/2D optical and laser scanners.
 * 100% dependency-free, operates offline without external network or assets.
 */

const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
];

export interface BarcodeRect {
  x: number;
  width: number;
}

/**
 * Encodes text to Code 128 bars and spaces
 */
export function encodeCode128(text: string): { totalWidth: number; bars: BarcodeRect[] } {
  const cleanText = (text || '000000').trim();
  const indices: number[] = [104]; // Start Code B
  let checksum = 104;

  for (let i = 0; i < cleanText.length; i++) {
    const code = cleanText.charCodeAt(i) - 32;
    const validCode = code >= 0 && code <= 95 ? code : 0;
    indices.push(validCode);
    checksum += validCode * (i + 1);
  }

  checksum = checksum % 103;
  indices.push(checksum);
  indices.push(106); // Stop pattern

  const quietModules = 10;
  let currentX = quietModules;
  const bars: BarcodeRect[] = [];

  indices.forEach(idx => {
    const pattern = CODE128_PATTERNS[idx];
    for (let pIdx = 0; pIdx < pattern.length; pIdx++) {
      const width = parseInt(pattern[pIdx], 10);
      const isBar = pIdx % 2 === 0;
      if (isBar) {
        bars.push({ x: currentX, width });
      }
      currentX += width;
    }
  });

  const totalWidth = currentX + quietModules;
  return { totalWidth, bars };
}

/**
 * Generates an Egyptian standard or custom retail 13-digit barcode (EAN-13 style)
 */
export function generateRandomBarcode(prefix: string = '622'): string {
  // 622 is the GS1 country code for Egypt
  let code = prefix;
  while (code.length < 12) {
    code += Math.floor(Math.random() * 10).toString();
  }
  
  // Calculate standard Modulo 10 Check Digit (EAN-13 algorithm)
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(code[i], 10);
    sum += (i % 2 === 0) ? digit : digit * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return code + checkDigit.toString();
}

