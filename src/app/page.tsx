'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { useLanguage } from '@/lib/i18n/context';
import { LanguageToggle } from '@/components/layout/LanguageToggle';
import { Phone, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

export default function MasterLoginPage() {
  const router = useRouter();
  const { user, loginAs, isLoading } = useAuth();
  const { lang, t, isRtl } = useLanguage();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // If already logged in, automatically redirect to appropriate workspace
  useEffect(() => {
    if (!isLoading && user) {
      if (user.role === 'super_admin') {
        router.replace('/super-admin');
      } else if (user.role === 'cashier') {
        router.replace('/merchant/pos');
      } else {
        router.replace('/merchant/dashboard');
      }
    }
  }, [user, isLoading, router]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Digits only, max 11 digits
    const cleaned = e.target.value.replace(/\D/g, '').slice(0, 11);
    setPhone(cleaned);
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Phone number validation: exactly 11 digits
    if (phone.length !== 11) {
      setError(
        lang === 'ar'
          ? 'رقم الهاتف يجب أن يتكون من 11 رقماً بالضبط (مثال: 01211583961)'
          : 'Phone number must be exactly 11 digits (e.g. 01211583961)'
      );
      return;
    }

    if (!password) {
      setError(lang === 'ar' ? 'يرجى إدخال كلمة المرور' : 'Please enter your password');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.trim(),
          password: password
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(
          lang === 'ar'
            ? 'رقم الهاتف أو كلمة المرور غير صحيحة'
            : 'Invalid phone number or password'
        );
        setSubmitting(false);
        return;
      }

      await loginAs(phone.trim());

      // Redirect based on returned role or redirectUrl
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else if (data.user?.role === 'super_admin') {
        window.location.href = '/super-admin';
      } else if (data.user?.role === 'cashier') {
        window.location.href = '/merchant/pos';
      } else {
        window.location.href = '/merchant/dashboard';
      }
    } catch {
      setError(
        lang === 'ar'
          ? 'تعذر الاتصال بالخادم، يرجى المحاولة مرة أخرى'
          : 'Server connection error, please try again'
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6FB] flex flex-col justify-between items-center p-4 sm:p-6 selection:bg-[#246BFD] selection:text-white">
      {/* Top Navbar */}
      <header className="w-full max-w-5xl flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden border border-[#E5EAF2] bg-white flex items-center justify-center p-0.5 shadow-2xs">
            <Image
              src="/logo.png"
              alt="Sastmhaly Logo"
              width={36}
              height={36}
              className="object-contain"
              priority
            />
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-[#0B1730] tracking-tight">
              {lang === 'ar' ? 'سستمهالي' : 'Sastmhaly'}
            </h1>
            <p className="text-[10px] text-[#687386] font-medium leading-none">
              {lang === 'ar' ? 'منظومة التجزئة وإدارة الأعمال' : 'Retail ERP & POS Platform'}
            </p>
          </div>
        </div>

        <LanguageToggle />
      </header>

      {/* Main Login Card */}
      <main className="w-full max-w-[420px] my-auto py-8">
        <div className="bg-white rounded-2xl border border-[#E5EAF2] shadow-sm p-6 sm:p-8">
          {/* Logo & Headline */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 rounded-2xl overflow-hidden border border-[#E5EAF2] bg-white flex items-center justify-center p-1.5 mb-3.5 shadow-2xs">
              <Image
                src="/logo.png"
                alt="Sastmhaly Logo"
                width={56}
                height={56}
                className="object-contain"
                priority
              />
            </div>
            <h2 className="text-xl font-bold text-[#0B1730] tracking-tight">
              {lang === 'ar' ? 'تسجيل الدخول إلى سستمهالي' : 'Sign in to Sastmhaly'}
            </h2>
            <p className="text-xs text-[#687386] mt-1 max-w-[280px] leading-relaxed">
              {lang === 'ar'
                ? 'البوابة الموحدة لإدارة المنصة والمتاجر ونقاط البيع'
                : 'Unified portal for platform administration, merchants & POS'}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] flex items-start gap-2.5 text-xs text-[#DC2626]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Master Phone & Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Phone Number Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-[#172033]">
                  {lang === 'ar' ? 'رقم الهاتف (11 رقماً) *' : 'Phone Number (11 digits) *'}
                </label>
                <div className="flex items-center gap-1.5">
                  {phone.length === 11 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#10B981]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'مكتمل' : 'Valid'}</span>
                    </span>
                  )}
                  <span className={`text-[11px] font-mono font-semibold ${phone.length === 11 ? 'text-[#10B981]' : 'text-[#687386]'}`}>
                    {phone.length}/11
                  </span>
                </div>
              </div>
              <div className="relative">
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  autoFocus
                  required
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="01000000000"
                  dir="ltr"
                  className="w-full py-2.5 px-10 rounded-xl border border-[#E5EAF2] bg-[#F7F9FC] text-sm font-mono text-[#0B1730] focus:bg-white focus:border-[#246BFD] focus:outline-none transition-all text-left rtl:text-right"
                />
                <Phone className="w-4 h-4 text-[#687386] absolute right-3 rtl:right-3 top-3.5 pointer-events-none" />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-[#172033]">
                  {lang === 'ar' ? 'كلمة المرور *' : 'Password *'}
                </label>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5EAF2] bg-[#F7F9FC] text-sm text-[#0B1730] focus:bg-white focus:border-[#246BFD] focus:outline-none transition-all pl-10 pr-10 rtl:pl-10 rtl:pr-10"
                />
                <Lock className="w-4 h-4 text-[#687386] absolute left-3 rtl:left-auto rtl:right-3 top-3.5 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 rtl:right-auto rtl:left-3 top-3 text-[#687386] hover:text-[#0B1730] p-0.5 rounded cursor-pointer"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 rounded-xl bg-[#246BFD] hover:bg-[#1A54D4] active:scale-[0.99] text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-60"
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>{t('loading')}</span>
                </span>
              ) : (
                <>
                  <span>{lang === 'ar' ? 'تسجيل الدخول' : 'Sign In'}</span>
                  <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                </>
              )}
            </button>
          </form>

          {/* Security & Multi-Role Notice */}
          <div className="mt-6 pt-5 border-t border-[#F1F4F9] text-center">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#687386]">
              <ShieldCheck className="w-4 h-4 text-[#10B981]" />
              <span>
                {lang === 'ar'
                  ? 'تسجيل دخول موحد مشفر وآمن لكافة المستخدمين'
                  : 'Encrypted unified login for all roles and branches'}
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-5xl py-3 text-center text-xs text-[#687386]">
        <p className="text-[11px]">
          {lang === 'ar'
            ? 'سستمهالي • منصة سحابية لإدارة تجارة التجزئة والسوبرماركت'
            : 'Sastmhaly • Multi-Tenant Retail & Supermarket Cloud Platform'}
        </p>
      </footer>
    </div>
  );
}
