import { NextRequest, NextResponse } from 'next/server';
import { getTenant, getSupabase } from '@/lib/db/supabase-queries';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';


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
    const supabase = getSupabase();
    const { data: ownerUser } = await supabase
      .from('users')
      .select('phone, username, password_hash, full_name')
      .eq('tenant_id', tenantId)
      .eq('role', 'merchant_owner')
      .maybeSingle();

    const phone = ownerUser?.phone || ownerUser?.username || tenant.phone;
    const password = ownerUser?.password_hash || '12345678';
    const merchantName = tenant.name || 'متجر_سستمهالي';
    const safeMerchantName = merchantName.replace(/[\\/:*?"<>|]/g, '_').trim();

    // Prepare temporary directory for merchant bundle
    const tmpDir = path.join('/tmp', `sastmhaly_bundle_${tenantId}_${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    // 1. Credentials text file
    const credsContent = `=======================================================
بيانات تشغيل النظام الأوفلاين لمتجر: ${merchantName}
=======================================================
- اسم المتجر: ${merchantName}
- رقم الهاتف (اسم المستخدم): ${phone}
- كلمة المرور: ${password}

طريقة التثبيت والتشغيل على ويندوز:
1. قم بفك الضغط عن هذا المجلد.
2. اضغط مرتين على ملف التثبيت:
   "تثبيت_سستمهالي - ${safeMerchantName}.exe"
3. اضغط "التالي" ثم "تثبيت" (يستغرق بضع ثوانٍ فقط).
4. سيتم إنشاء أيقونة على سطح المكتب باسم "سستمهالي - نقاط البيع".
5. سيفتح النظام فوراً كتطبيق مثبت مستقل بدون متصفح أو روابط، ومسجّل ببياناتك تلقائياً!

ملاحظة: إذا ظهر تنبيه الحماية Windows SmartScreen:
اضغط على "More info" (مزيد من المعلومات) ثم "Run anyway" (تشغيل على أي حال).
=======================================================`;

    fs.writeFileSync(path.join(tmpDir, 'بيانات_تسجيل_الدخول.txt'), credsContent, 'utf-8');

    // 2. Pre-configured sastmhaly_config.json
    const configData = {
      tenant_id: tenant.id,
      merchant_name: merchantName,
      phone,
      password,
      slug: tenant.slug,
      is_offline: true,
      created_at: new Date().toISOString()
    };
    fs.writeFileSync(path.join(tmpDir, 'sastmhaly_config.json'), JSON.stringify(configData, null, 2), 'utf-8');

    const projectRoot = process.cwd();

    if (os === 'mac') {
      // Mac specific bundle — shell-script .app that opens Safari/browser to the local server
      const macCommandContent = `#!/bin/bash
# Sastmhaly POS - ${merchantName}
DIR="$( cd "$( dirname "\${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# Find the project root (where package.json is)
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

# Check if server already running
if lsof -Pi :$PORT -sTCP:LISTEN -t > /dev/null 2>&1; then
  open "http://localhost:$PORT/login?phone=$PHONE&pass=$PASS"
  exit 0
fi

# Notify start
osascript -e 'display notification "جاري تشغيل النظام..." with title "سستمهالي POS"'

cd "$PROJECT"
export OFFLINE_MODE=true
export DATABASE_MODE=sqlite
export PORT=$PORT

# Start server in background
(npm run dev -- -p $PORT >> /tmp/sastmhaly_mac.log 2>&1) &
SERVER_PID=$!

# Wait for server ready (up to 60 seconds)
for i in $(seq 1 60); do
  sleep 1
  if curl -s "http://localhost:$PORT" > /dev/null 2>&1; then
    open "http://localhost:$PORT/login?phone=$PHONE&pass=$PASS"
    break
  fi
done

wait $SERVER_PID
`;
      const scriptPath = path.join(tmpDir, `تشغيل_سستمهالي - ${safeMerchantName}.command`);
      fs.writeFileSync(scriptPath, macCommandContent, { encoding: 'utf-8', mode: 0o755 });

      // Copy signed Sastmhaly POS.app if present
      const macAppSource = path.join(projectRoot, 'offline', 'mac', 'Sastmhaly POS.app');
      if (fs.existsSync(macAppSource)) {
        execSync(`cp -R "${macAppSource}" "${tmpDir}/"`);
      }
    } else {
      // Windows specific bundle - Real installable application
      const setupExeSource = path.join(projectRoot, 'offline', 'windows', 'Sastmhaly-POS-Setup.exe');
      if (fs.existsSync(setupExeSource)) {
        fs.copyFileSync(setupExeSource, path.join(tmpDir, `تثبيت_سستمهالي - ${safeMerchantName}.exe`));
      }

      // Copy standalone portable launcher
      const launcherSource = path.join(projectRoot, 'offline', 'windows', 'Sastmhaly_POS.exe');
      if (fs.existsSync(launcherSource)) {
        fs.copyFileSync(launcherSource, path.join(tmpDir, `تشغيل_مباشر - ${safeMerchantName}.exe`));
      }

      // Copy app icon
      const icoSource = path.join(projectRoot, 'offline', 'windows', 'app.ico');
      if (fs.existsSync(icoSource)) {
        fs.copyFileSync(icoSource, path.join(tmpDir, 'app.ico'));
      }

      // Copy runner script for portable launch
      const vbsSource = path.join(projectRoot, 'offline', 'windows', 'run_app.vbs');
      if (fs.existsSync(vbsSource)) {
        fs.copyFileSync(vbsSource, path.join(tmpDir, 'run_app.vbs'));
      }
    }

    // Create the ZIP archive
    const zipFilenameArabic = `سستمهالي - ${safeMerchantName} - ${os === 'mac' ? 'ماك' : 'ويندوز'}.zip`;
    const zipFilenameAscii = `Sastmhaly_${tenant.slug || 'merchant'}_${os}.zip`;
    const outZipPath = path.join('/tmp', `bundle_${tenantId}_${Date.now()}.zip`);

    execSync(`cd "${tmpDir}" && zip -r "${outZipPath}" .`, { stdio: 'pipe' });

    const zipBuffer = fs.readFileSync(outZipPath);

    // Clean up temporary files
    try {
      execSync(`rm -rf "${tmpDir}" "${outZipPath}"`);
    } catch (e) {
      // ignore
    }

    const encodedFilename = encodeURIComponent(zipFilenameArabic);

    return new NextResponse(zipBuffer, {
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

