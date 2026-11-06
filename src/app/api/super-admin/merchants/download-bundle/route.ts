import { NextRequest, NextResponse } from 'next/server';
import { getTenant, isOfflineMode } from '@/lib/db/supabase-queries';
import { db } from '@/lib/db';
import path from 'path';
import fs from 'fs';
import JSZip from 'jszip';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenant_id');
    const os = searchParams.get('os') || 'windows';

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    const tenant = await getTenant(tenantId);
    if (!tenant) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    // Fetch the merchant owner to get credentials (phone & password)
    let ownerUser: { phone?: string; username?: string; password_hash?: string; full_name?: string } | undefined = undefined;

    if (isOfflineMode()) {
      ownerUser = db.prepare('SELECT phone, username, password_hash, full_name FROM users WHERE tenant_id = ? AND role = "merchant_owner"').get(tenantId) as any;
    } else {
      try {
        const { getSupabase } = await import('@/lib/db/supabase-queries');
        const supabase = getSupabase();
        const { data } = await supabase
          .from('users')
          .select('phone, username, password_hash, full_name')
          .eq('tenant_id', tenantId)
          .eq('role', 'merchant_owner')
          .maybeSingle();
        ownerUser = data || undefined;
      } catch (e) {
        ownerUser = db.prepare('SELECT phone, username, password_hash, full_name FROM users WHERE tenant_id = ? AND role = "merchant_owner"').get(tenantId) as any;
      }
    }

    const phone = ownerUser?.phone || ownerUser?.username || tenant.phone;
    const password = ownerUser?.password_hash || '12345678';
    const merchantName = tenant.name || 'متجر_سستمهالي';
    const safeMerchantName = merchantName.replace(/[\\/:*?"<>|]/g, '_').trim();

    const zip = new JSZip();

    // 1. Credentials text file
    const credsContent = `=======================================================
بيانات تشغيل النظام الأوفلاين لمتجر: ${merchantName}
=======================================================
- اسم المتجر: ${merchantName}
- رقم الهاتف (اسم المستخدم): ${phone}
- كلمة المرور: ${password}

طريقة التثبيت والتشغيل المحلي 100% بدون إنترنت:
1. شغّل برنامج التثبيت: "تثبيت_سستمهالي - ${merchantName}.exe"
2. سيتم تثبيت تطبيق سستمهالي الأصلي لسطح المكتب وإنشاء اختصار باسم "سستمهالي - نقاط البيع" على سطح المكتب.
3. افتح البرنامج مباشرة؛ سيعمل 100% أوفلاين محلياً داخل نافذة تطبيق مستقلة بدون متصفح وبدون الحاجة لأي إنترنت نهائياً!
4. عند فتح البرنامج لأول مرة يمكنك رفع شعار متجرك وضبط بيانات المتجر بالكامل.

ملاحظة: إذا ظهر تنبيه الحماية Windows SmartScreen:
اضغط على "More info" (مزيد من المعلومات) ثم "Run anyway" (تشغيل على أي حال).
=======================================================`;

    zip.file('بيانات_تسجيل_الدخول.txt', credsContent);

    // 2. Pre-configured sastmhaly_config.json with merchant data
    let initialData = {
      branches: [] as any[],
      categories: [] as any[],
      units: [] as any[],
      products: [] as any[]
    };

    try {
      if (isOfflineMode()) {
        initialData = {
          branches: db.prepare('SELECT * FROM branches WHERE tenant_id = ?').all(tenantId) as any[],
          categories: db.prepare('SELECT * FROM categories WHERE tenant_id = ?').all(tenantId) as any[],
          units: db.prepare('SELECT * FROM units WHERE tenant_id = ?').all(tenantId) as any[],
          products: db.prepare('SELECT * FROM products WHERE tenant_id = ?').all(tenantId) as any[]
        };
      } else {
        const { getSupabase } = await import('@/lib/db/supabase-queries');
        const supabase = getSupabase();
        const [branchesRes, categoriesRes, unitsRes, productsRes] = await Promise.all([
          supabase.from('branches').select('*').eq('tenant_id', tenantId),
          supabase.from('categories').select('*').eq('tenant_id', tenantId),
          supabase.from('units').select('*').eq('tenant_id', tenantId),
          supabase.from('products').select('*').eq('tenant_id', tenantId)
        ]);
        initialData = {
          branches: branchesRes.data || [],
          categories: categoriesRes.data || [],
          units: unitsRes.data || [],
          products: productsRes.data || []
        };
      }
    } catch (e) {
      try {
        initialData = {
          branches: db.prepare('SELECT * FROM branches WHERE tenant_id = ?').all(tenantId) as any[],
          categories: db.prepare('SELECT * FROM categories WHERE tenant_id = ?').all(tenantId) as any[],
          units: db.prepare('SELECT * FROM units WHERE tenant_id = ?').all(tenantId) as any[],
          products: db.prepare('SELECT * FROM products WHERE tenant_id = ?').all(tenantId) as any[]
        };
      } catch (err) {
        console.warn('Could not pre-fetch merchant data:', err);
      }
    }

    const configData = {
      tenant_id: tenant.id,
      merchant_name: merchantName,
      phone,
      password,
      slug: tenant.slug,
      is_offline: true,
      created_at: new Date().toISOString(),
      initial_data: initialData
    };
    zip.file('sastmhaly_config.json', JSON.stringify(configData, null, 2));

    const projectRoot = process.cwd();

    if (os === 'mac') {
      const macCommandContent = `#!/bin/bash
# Sastmhaly POS - ${merchantName}
DIR="$( cd "$( dirname "\${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
SEARCH="$DIR"
PROJECT=""
for i in 1 2 3 4 5 6 7 8 9 10; do
  if [ -f "$SEARCH/package.json" ]; then
    PROJECT="$SEARCH"
    break
  fi
  SEARCH="$(dirname "$SEARCH")"
done

if [ -z "$PROJECT" ]; then
  osascript -e 'display dialog "خطأ: لم يتم العثور على مجلد المشروع." with title "سستمهالي - خطأ" buttons {"موافق"} default button "موافق" with icon stop'
  exit 1
fi

PORT=3456
PHONE="${phone}"
PASS="${password}"

if lsof -Pi :$PORT -sTCP:LISTEN -t > /dev/null 2>&1; then
  open "http://localhost:$PORT/login?phone=$PHONE&pass=$PASS"
  exit 0
fi

osascript -e 'display notification "جاري تشغيل النظام..." with title "سستمهالي POS"'
cd "$PROJECT"
export OFFLINE_MODE=true
export DATABASE_MODE=sqlite
export PORT=$PORT
(npm run dev -- -p $PORT >> /tmp/sastmhaly_mac.log 2>&1) &
SERVER_PID=$!
for i in $(seq 1 60); do
  sleep 1
  if curl -s "http://localhost:$PORT" > /dev/null 2>&1; then
    open "http://localhost:$PORT/login?phone=$PHONE&pass=$PASS"
    break
  fi
done
wait $SERVER_PID
`;
      zip.file(`تشغيل_سستمهالي - ${safeMerchantName}.command`, macCommandContent);

      const macDmgSource = path.join(projectRoot, 'offline', 'mac', 'Sastmhaly-POS.dmg');
      if (fs.existsSync(macDmgSource)) {
        zip.file(`Sastmhaly-POS - ${safeMerchantName}.dmg`, fs.readFileSync(macDmgSource));
      }
    } else {
      // Windows specific bundle
      const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
      const setupExeSource = path.join(projectRoot, 'sastmhaly-merchant-windows', 'Sastmhaly-Store-Setup.exe');
      const fallbackSetup = path.join(projectRoot, 'public', 'downloads', 'Sastmhaly-POS-Setup.exe');

      const finalSetupPath = fs.existsSync(setupExeSource) ? setupExeSource : fallbackSetup;

      if (fs.existsSync(finalSetupPath)) {
        zip.file(`تثبيت_سستمهالي - ${safeMerchantName}.exe`, fs.readFileSync(finalSetupPath));
      }

      // Add internet shortcut for direct installer download from Vercel Edge CDN
      const installerUrlContent = `[InternetShortcut]\r\nURL=https://sastmhaly.vercel.app/downloads/Sastmhaly-POS-Setup.exe\r\n`;
      zip.file('تحميل_برنامج_التثبيت_لويندوز.url', installerUrlContent);

      const icoSource = path.join(projectRoot, 'sastmhaly-merchant-windows', 'app.ico');
      if (fs.existsSync(icoSource)) {
        zip.file('app.ico', fs.readFileSync(icoSource));
      }

      // Include a pre-configured .bat launcher that launches the native offline desktop app
      const batContent = `@echo off
chcp 65001 >nul
title سستمهالي - نقاط البيع (تطبيق محلي أوفلاين)
cd /d "%~dp0"

set "APP_EXE=%LOCALAPPDATA%\\SastmhalyPOS\\Sastmhaly_POS.exe"

if exist "%APP_EXE%" (
  start "" "%APP_EXE%"
  exit /b
)

:: If not installed yet, find installer in current directory and run it
for %%f in ("*تثبيت*.exe" "Sastmhaly*.exe" "*Setup*.exe") do (
  if exist "%%~ff" (
    echo جاري تثبيت برنامج سستمهالي للمتجر...
    start "" "%%~ff"
    exit /b
  )
)

echo يرجى تشغيل ملف التثبيت أولاً: تثبيت_سستمهالي.exe
pause
`;
      zip.file(`تشغيل_سستمهالي - ${safeMerchantName}.bat`, batContent);

      // Include initial SQLite DB if exists
      const dbSource = path.join(projectRoot, 'data', 'sastmhaly.db');
      if (fs.existsSync(dbSource)) {
        zip.file('sastmhaly.db', fs.readFileSync(dbSource));
      }
    }

    // Generate in-memory ZIP buffer with JSZip (ZERO dependency on system zip binary)
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    const zipFilenameArabic = `سستمهالي - ${safeMerchantName} - ${os === 'mac' ? 'ماك' : 'ويندوز'}.zip`;
    const zipFilenameAscii = `Sastmhaly_${tenant.slug || 'merchant'}_${os}.zip`;
    const encodedFilename = encodeURIComponent(zipFilenameArabic);

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFilenameAscii}"; filename*=UTF-8''${encodedFilename}`,
        'Content-Length': zipBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('Error generating merchant offline bundle:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate bundle' },
      { status: 500 }
    );
  }
}
