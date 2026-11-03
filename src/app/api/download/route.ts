import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const os = searchParams.get('os') || 'windows';

  const filename = os === 'mac' ? 'Sastmhaly-POS.dmg' : 'Sastmhaly-POS-Setup.exe';
  const filePath = path.join(process.cwd(), 'public', 'downloads', filename);

  if (fs.existsSync(filePath)) {
    const fileBuffer = fs.readFileSync(filePath);
    const contentType = os === 'mac' 
      ? 'application/x-apple-diskimage' 
      : 'application/vnd.microsoft.portable-executable';

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  }

  // Fallback direct static URL
  return NextResponse.redirect(new URL(`/downloads/${filename}`, request.url));
}
