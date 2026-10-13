import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { updateTenantSettings } from '@/lib/db/queries';

export const BUCKET_NAME = 'merchant-logos';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('logo') as File | null;
    const tenantId = (formData.get('tenantId') as string) || 'tenant_albaraka';

    if (!file) {
      return NextResponse.json({ error: 'لم يتم إرسال ملف الشعار' }, { status: 400 });
    }

    // Check size limit: max 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'حجم ملف الشعار يتجاوز الحد الأقصى (5 ميجابايت)' }, { status: 400 });
    }

    const fileExt = file.name.split('.').pop() || 'png';
    const cleanFileName = `${tenantId}/${Date.now()}_logo.${fileExt}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage bucket: merchant-logos
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(cleanFileName, buffer, {
        contentType: file.type || 'image/png',
        upsert: true,
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return NextResponse.json({
        error: `تعذر الرفع إلى Supabase Bucket (${BUCKET_NAME}): ${uploadError.message}. تأكد من إنشاء باكت باسم "${BUCKET_NAME}" وتفعيله كـ Public في لوحة Supabase.`,
        bucket: BUCKET_NAME,
      }, { status: 500 });
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(uploadData.path);

    const logoUrl = publicUrlData.publicUrl;

    // Update database tenant logo_url
    updateTenantSettings(tenantId, { logo_url: logoUrl });

    return NextResponse.json({
      success: true,
      logo_url: logoUrl,
      bucket: BUCKET_NAME,
    });
  } catch (error: any) {
    console.error('Logo upload error:', error);
    return NextResponse.json({ error: error.message || 'حدث خطأ أثناء رفع الشعار' }, { status: 500 });
  }
}
