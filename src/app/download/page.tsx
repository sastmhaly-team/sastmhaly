'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n/context';
import { LanguageToggle } from '@/components/layout/LanguageToggle';
import { Download, Monitor, Laptop, ArrowRight, ArrowLeft } from 'lucide-react';

export default function DownloadPage() {
  const { lang, isRtl } = useLanguage();
  const [downloadingOs, setDownloadingOs] = useState<'windows' | 'mac' | null>(null);

  const handleDownload = (os: 'windows' | 'mac') => {
    setDownloadingOs(os);
    // Direct browser download from the API route (no external 404 links)
    const downloadUrl = `/api/download?os=${os}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = os === 'mac' ? 'Sastmhaly-POS.dmg' : 'Sastmhaly-POS-Setup.exe';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      setDownloadingOs(null);
    }, 2500);
  };

  return (
    <div className="min-h-screen bg-[#070D1D] text-[#F1F5F9] font-sans antialiased flex flex-col justify-between selection:bg-[#246BFD] selection:text-white relative overflow-hidden">
      
      {/* Background Ambient Glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#246BFD]/25 rounded-full blur-[130px]" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#6366F1]/20 rounded-full blur-[130px]" />
      </div>

      {/* Top Navbar */}
      <header className="relative z-10 max-w-5xl w-full mx-auto px-6 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-xl overflow-hidden border border-white/10 bg-[#0B1730] flex items-center justify-center p-1 shadow-lg group-hover:scale-105 transition-transform">
            <Image
              src="/logo.png"
              alt="Sastmhaly Logo"
              width={32}
              height={32}
              className="object-contain"
              priority
            />
          </div>
          <span className="text-sm font-extrabold tracking-tight text-white group-hover:text-[#60A5FA] transition-colors">
            {lang === 'ar' ? 'سستمهالي' : 'Sastmhaly'}
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <LanguageToggle />
          <Link
            href="/login"
            className="text-xs font-semibold text-slate-300 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20"
          >
            {lang === 'ar' ? 'تسجيل الدخول' : 'Sign In'}
          </Link>
        </div>
      </header>

      {/* Main Single Centered Section */}
      <main className="relative z-10 max-w-xl w-full mx-auto px-6 py-8 flex flex-col items-center text-center my-auto">
        
        {/* App Icon Glow */}
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#246BFD] to-[#1E3A8A] p-0.5 shadow-2xl shadow-[#246BFD]/30 mb-6 flex items-center justify-center">
          <div className="w-full h-full bg-[#0B1730] rounded-[22px] flex items-center justify-center p-3">
            <Image
              src="/logo.png"
              alt="Sastmhaly"
              width={48}
              height={48}
              className="object-contain"
            />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
          {lang === 'ar' ? 'تحميل النسخة المكتبية (أوفلاين)' : 'Download Desktop App (Offline)'}
        </h1>

        {/* Subtitle */}
        <p className="mt-3 text-xs sm:text-sm text-slate-400 max-w-md leading-relaxed">
          {lang === 'ar' 
            ? 'يعمل بالكامل بدون إنترنت على جهازك مباشرة — اختر نظام التشغيل لبدء التحميل:'
            : 'Runs 100% locally on your computer with zero internet — Choose your OS to download:'}
        </p>

        {/* Exactly 2 Buttons: Windows & Mac */}
        <div className="mt-8 w-full max-w-md flex flex-col sm:flex-row items-center justify-center gap-4">
          
          {/* 1. Windows Button */}
          <button
            onClick={() => handleDownload('windows')}
            disabled={downloadingOs !== null}
            className="w-full sm:w-1/2 p-4 rounded-2xl bg-[#0F1E3D] hover:bg-[#152A56] border border-[#246BFD]/40 hover:border-[#246BFD] text-white shadow-xl hover:shadow-[#246BFD]/20 transition-all duration-300 hover:scale-[1.03] active:scale-95 cursor-pointer flex flex-col items-center justify-center gap-2 group"
          >
            <div className="w-12 h-12 rounded-xl bg-[#246BFD]/15 flex items-center justify-center text-[#60A5FA] group-hover:scale-110 transition-transform">
              <Monitor className="w-6 h-6" />
            </div>
            <div className="text-center">
              <div className="text-xs text-sky-300 font-medium">
                {lang === 'ar' ? 'تحميل مباشر (مثبّت)' : 'Direct Installer'}
              </div>
              <div className="text-base font-extrabold text-white flex items-center justify-center gap-1.5 mt-0.5">
                <span>Windows (.exe)</span>
                <Download className={`w-4 h-4 text-sky-400 ${downloadingOs === 'windows' ? 'animate-bounce' : ''}`} />
              </div>
            </div>
          </button>

          {/* 2. Mac Button */}
          <button
            onClick={() => handleDownload('mac')}
            disabled={downloadingOs !== null}
            className="w-full sm:w-1/2 p-4 rounded-2xl bg-[#0F1E3D] hover:bg-[#152A56] border border-white/10 hover:border-white/30 text-white shadow-xl hover:shadow-white/5 transition-all duration-300 hover:scale-[1.03] active:scale-95 cursor-pointer flex flex-col items-center justify-center gap-2 group"
          >
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-slate-200 group-hover:scale-110 transition-transform">
              <Laptop className="w-6 h-6" />
            </div>
            <div className="text-center">
              <div className="text-xs text-slate-300 font-medium">
                {lang === 'ar' ? 'تحميل مباشر (تطبيق)' : 'Disk Image App'}
              </div>
              <div className="text-base font-extrabold text-white flex items-center justify-center gap-1.5 mt-0.5">
                <span>macOS (.dmg)</span>
                <Download className={`w-4 h-4 text-slate-300 ${downloadingOs === 'mac' ? 'animate-bounce' : ''}`} />
              </div>
            </div>
          </button>
        </div>

        {/* Helper Tip for macOS Gatekeeper */}
        <div className="mt-6 text-[11px] text-slate-400 max-w-sm bg-white/[0.03] border border-white/[0.08] rounded-xl px-3.5 py-2">
          {lang === 'ar' ? (
            <span>
              💡 <strong>لمستخدمي الماك:</strong> عند فتح التطبيق لأول مرة، اضغط بالزر الأيمن (Right-Click) على التطبيق واختر <strong>فتح (Open)</strong>.
            </span>
          ) : (
            <span>
              💡 <strong>Mac Users:</strong> For the first launch, Right-Click the app and select <strong>Open</strong> to approve.
            </span>
          )}
        </div>

        {/* Small Status indicator */}
        {downloadingOs && (
          <div className="mt-4 text-xs text-emerald-400 flex items-center gap-1.5 animate-pulse">
            <span>{lang === 'ar' ? 'جاري بدء التحميل مباشرة على جهازك...' : 'Starting download directly to your device...'}</span>
          </div>
        )}

        {/* Link back */}
        <div className="mt-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            {isRtl ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
            <span>{lang === 'ar' ? 'الرجوع إلى الصفحة الرئيسية' : 'Back to Home'}</span>
          </Link>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="relative z-10 py-5 text-center text-[11px] text-slate-500 border-t border-white/[0.06]">
        <span>© 2026 سستمهالي (Sastmhaly) • النسخة المكتبية الأوفلاين</span>
      </footer>

    </div>
  );
}
