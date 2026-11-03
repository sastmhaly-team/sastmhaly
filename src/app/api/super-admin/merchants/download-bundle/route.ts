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

طريقة التشغيل الفوري:
1. قم بفك الضغط عن هذا المجلد.
2. اضغط مرتين على ملف التشغيل السريع:
   ${os === 'mac' ? `تشغيل_سستمهالي - ${safeMerchantName}.command` : `تشغيل_سستمهالي - ${safeMerchantName}.bat`}
3. سيفتح النظام تلقائياً على جهازك بوضع أوفلاين وتفتح شاشة تسجيل الدخول ببياناتك مباشرة!
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
      // Mac specific bundle
      const macCommandContent = `#!/bin/bash
DIR="$( cd "$( dirname "\${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"
echo "======================================================="
echo "  سستمهالي - النسخة المكتبية الأوفلاين"
echo "  المتجر: ${merchantName}"
echo "  رقم الهاتف: ${phone}"
echo "======================================================="
export OFFLINE_MODE=true
export DATABASE_MODE=sqlite
export MERCHANT_ID="${tenant.id}"
export PORT=3456
open "http://localhost:3456/login?phone=${phone}&pass=${password}"
npm run dev -- -p 3456
`;
      const scriptPath = path.join(tmpDir, `تشغيل_سستمهالي - ${safeMerchantName}.command`);
      fs.writeFileSync(scriptPath, macCommandContent, { encoding: 'utf-8', mode: 0o755 });

      // Copy signed Sastmhaly POS.app if present
      const macAppSource = path.join(projectRoot, 'offline', 'mac', 'Sastmhaly POS.app');
      if (fs.existsSync(macAppSource)) {
        execSync(`cp -R "${macAppSource}" "${tmpDir}/"`);
      }
    } else {
      // Windows specific bundle
      const winBatContent = `@echo off
chcp 65001 > nul
title سستمهالي - ${merchantName} (النسخة المكتبية)
echo =======================================================
echo   سستمهالي لنقاط البيع وإدارة المتاجر
echo   المتجر: ${merchantName}
echo   رقم هاتف الدخول: ${phone}
echo =======================================================
set OFFLINE_MODE=true
set DATABASE_MODE=sqlite
set MERCHANT_ID=${tenant.id}
set MERCHANT_NAME=${merchantName}
set DEFAULT_PHONE=${phone}
set DEFAULT_PASS=${password}
set PORT=3456
start "" "http://localhost:3456/login?phone=${phone}&pass=${password}"
npm run dev -- -p 3456
pause
`;
      const batPath = path.join(tmpDir, `تشغيل_سستمهالي - ${safeMerchantName}.bat`);
      fs.writeFileSync(batPath, winBatContent, 'utf-8');

      // Copy Setup.exe if present
      const exeSource = path.join(projectRoot, 'offline', 'windows', 'Sastmhaly-POS-Setup.exe');
      if (fs.existsSync(exeSource)) {
        fs.copyFileSync(exeSource, path.join(tmpDir, 'Sastmhaly-POS-Setup.exe'));
      }
    }

    // Copy electron launcher if present
    const electronSource = path.join(projectRoot, 'electron');
    if (fs.existsSync(electronSource)) {
      execSync(`cp -R "${electronSource}" "${tmpDir}/"`);
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
