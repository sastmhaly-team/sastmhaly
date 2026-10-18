'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n/context';
import { LanguageToggle } from '@/components/layout/LanguageToggle';
import { 
  ArrowRight, Sparkles, Smartphone, Store, ShieldCheck, Zap, 
  BarChart3, Clock, CreditCard, Check, Layers, Users, 
  Boxes, Receipt, MessageCircle, ChevronRight
} from 'lucide-react';

/* Reusable Smooth Scroll Reveal Component */
function AnimateOnScroll({
  children,
  className = '',
  delay = 0,
  direction = 'up',
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'zoom';
}) {
  const [isVisible, setIsVisible] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!('IntersectionObserver' in window)) {
      setIsVisible(true);
      return;
    }

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const getTransform = () => {
    if (isVisible) return 'opacity-100 translate-y-0 translate-x-0 scale-100';
    switch (direction) {
      case 'up':
        return 'opacity-0 translate-y-14 scale-[0.97]';
      case 'down':
        return 'opacity-0 -translate-y-12 scale-[0.97]';
      case 'left':
        return 'opacity-0 -translate-x-14';
      case 'right':
        return 'opacity-0 translate-x-14';
      case 'zoom':
        return 'opacity-0 scale-90 translate-y-8';
      default:
        return 'opacity-0 translate-y-14';
    }
  };

  return (
    <div
      ref={ref}
      style={{
        transitionDuration: '800ms',
        transitionDelay: `${delay}ms`,
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      className={`transition-all will-change-transform ${getTransform()} ${className}`}
    >
      {children}
    </div>
  );
}

export default function LandingPage() {
  const { lang, isRtl } = useLanguage();

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-[#1D1D1F] selection:bg-[#0071E3] selection:text-white font-sans antialiased overflow-x-hidden">
      {/* 1. Apple-style Translucent Navigation Bar */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-black/[0.07] transition-all">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
          {/* Logo & Brand */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded-lg overflow-hidden border border-black/10 bg-white flex items-center justify-center p-0.5 shadow-2xs group-hover:scale-110 transition-transform duration-300">
              <Image
                src="/logo.png"
                alt="Sastmhaly Logo"
                width={28}
                height={28}
                className="object-contain"
                priority
              />
            </div>
            <span className="text-sm font-bold tracking-tight text-[#1D1D1F] group-hover:text-[#0071E3] transition-colors duration-300">
              {lang === 'ar' ? 'سستمهالي' : 'Sastmhaly'}
            </span>
          </Link>

          {/* Center Navigation Links (Hidden on mobile) */}
          <div className="hidden md:flex items-center gap-6 text-[12px] font-medium text-[#1D1D1F]/70">
            <a href="#features" className="hover:text-[#0071E3] hover:scale-105 transition-all duration-200">
              {lang === 'ar' ? 'المميزات' : 'Features'}
            </a>
            <a href="#pos" className="hover:text-[#0071E3] hover:scale-105 transition-all duration-200">
              {lang === 'ar' ? 'نقطة البيع' : 'POS'}
            </a>
            <a href="#inventory" className="hover:text-[#0071E3] hover:scale-105 transition-all duration-200">
              {lang === 'ar' ? 'المخزون' : 'Inventory'}
            </a>
            <a href="#hr" className="hover:text-[#0071E3] hover:scale-105 transition-all duration-200">
              {lang === 'ar' ? 'الموظفين' : 'Staff & HR'}
            </a>
            <a href="#stats" className="hover:text-[#0071E3] hover:scale-105 transition-all duration-200">
              {lang === 'ar' ? 'الأداء' : 'Performance'}
            </a>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3">
            <LanguageToggle />

            <Link
              href="/login"
              className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-[#1D1D1F] hover:bg-[#333336] active:scale-95 text-white text-[12px] font-medium transition-all duration-300 shadow-2xs hover:shadow-md hover:scale-105"
            >
              <span>{lang === 'ar' ? 'تسجيل الدخول' : 'Sign In'}</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* 2. Hero Section (Apple Dramatic Minimalism with Smooth Animated Motion) */}
      <section className="relative pt-16 pb-20 sm:pt-24 sm:pb-32 px-4 sm:px-6 max-w-5xl mx-auto text-center">
        {/* Ambient Floating Glow Orbs in Background */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[550px] sm:w-[700px] h-[350px] bg-gradient-to-tr from-blue-400/20 via-indigo-300/15 to-purple-400/10 rounded-full blur-3xl pointer-events-none animate-pulse-soft -z-10" />
        <div className="absolute top-40 -left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none animate-float-slow -z-10" />
        <div className="absolute top-60 -right-10 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none animate-float-reverse -z-10" />

        {/* Big Apple Headline with Smooth AnimateOnScroll & Flowing Blue Gradient Text */}
        <AnimateOnScroll direction="up" delay={0}>
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.15] max-w-4xl mx-auto mb-6">
            {lang === 'ar' ? (
              <>
                <span className="inline-block gradient-text-animated text-4xl sm:text-6xl md:text-7xl font-extrabold hover:scale-[1.02] transition-transform duration-500">
                  البساطة المطلقة
                </span>
                <br />
                <span className="inline-block mt-2 gradient-text-animated text-4xl sm:text-6xl md:text-7xl font-black hover:scale-[1.02] transition-transform duration-500">
                  لقوة أعمالك ومتجرك
                </span>
              </>
            ) : (
              <>
                <span className="inline-block gradient-text-animated text-4xl sm:text-6xl md:text-7xl font-extrabold hover:scale-[1.02] transition-transform duration-500">
                  Pure Simplicity
                </span>
                <br />
                <span className="inline-block mt-2 gradient-text-animated text-4xl sm:text-6xl md:text-7xl font-black hover:scale-[1.02] transition-transform duration-500">
                  Engineered for your store
                </span>
              </>
            )}
          </h1>
        </AnimateOnScroll>

        {/* Subtitle with AnimateOnScroll */}
        <AnimateOnScroll direction="up" delay={150}>
          <p className="text-base sm:text-xl text-[#86868B] max-w-2xl mx-auto font-normal leading-relaxed mb-10 transition-colors duration-500 hover:text-[#1D1D1F]">
            {lang === 'ar'
              ? 'نظام سحابي فائق السرعة صُمم لإدارة نقاط البيع، المخازن متعددة الفروع، الحسابات ومسير رواتب الموظفين بكل دقة وسلاسة.'
              : 'A blazingly fast cloud platform designed to manage POS, multi-branch inventory, finances, and automated staff payroll with total precision.'}
          </p>
        </AnimateOnScroll>

        {/* CTA Buttons with AnimateOnScroll */}
        <AnimateOnScroll direction="up" delay={250}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mb-16">
            <Link
              href="/login"
              className="group relative overflow-hidden w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] active:scale-95 text-white text-sm font-semibold shadow-lg shadow-blue-500/25 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/40 hover:-translate-y-1"
            >
              <span className="transition-transform duration-300 group-hover:scale-105">
                {lang === 'ar' ? 'دخول المنظومة' : 'Launch Platform'}
              </span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180 group-hover:translate-x-1.5 rtl:group-hover:-translate-x-1.5 transition-transform duration-300" />
            </Link>

            <a
              href="https://wa.me/201558516263"
              target="_blank"
              rel="noopener noreferrer"
              className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-white hover:bg-[#F5F5F7] border border-black/10 text-sm font-semibold text-[#1D1D1F] transition-all duration-300 shadow-sm hover:shadow-md hover:scale-[1.03] active:scale-95 hover:-translate-y-1"
            >
              <MessageCircle className="w-4 h-4 text-[#25D366] group-hover:scale-125 group-hover:rotate-12 transition-transform duration-300" />
              <span className="transition-colors duration-300 group-hover:text-emerald-700">
                {lang === 'ar' ? 'تواصل معنا على واتساب' : 'Chat on WhatsApp'}
              </span>
            </a>
          </div>
        </AnimateOnScroll>

        {/* 3. Hero Visual - Real Dashboard with macOS Window Frame, Floating Motion & Scroll Reveal */}
        <AnimateOnScroll direction="zoom" delay={350} className="relative mx-auto max-w-5xl">
          <div className="relative group card-float-animated">
            {/* Floating Bobbing Badges around the Window */}
            <div className="hidden sm:flex absolute -top-5 -right-3 z-30 items-center gap-2 px-4 py-2 rounded-2xl bg-white/95 backdrop-blur-md border border-black/10 shadow-xl badge-bob-1 hover:scale-110 transition-transform cursor-default">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0071E3]"></span>
              </span>
              <span className="text-xs font-bold text-[#1D1D1F] hover:text-[#0071E3] transition-colors">
                {lang === 'ar' ? '⚡️ سرعة استجابة < 0.2 ثانية' : '⚡️ Sub-second 0.2s Speed'}
              </span>
            </div>

            <div className="hidden sm:flex absolute -bottom-5 -left-3 z-30 items-center gap-2.5 px-4 py-2 rounded-2xl bg-white/95 backdrop-blur-md border border-black/10 shadow-xl badge-bob-2 hover:scale-110 transition-transform cursor-default">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-bold text-[#1D1D1F] hover:text-emerald-600 transition-colors">
                {lang === 'ar' ? '🔒 مزامنة سحابية متعددة الفروع' : '🔒 Multi-Branch Cloud Sync'}
              </span>
            </div>

            {/* macOS Window Outer Shell */}
            <div className="relative rounded-2xl sm:rounded-3xl p-1.5 sm:p-2.5 bg-gradient-to-b from-black/[0.08] via-black/[0.04] to-transparent border border-black/[0.08] shadow-2xl transition-all duration-700 hover:shadow-[0_25px_60px_-15px_rgba(0,113,227,0.3)]">
              <div className="rounded-xl sm:rounded-2xl bg-white border border-black/[0.08] overflow-hidden shadow-inner">
                
                {/* macOS Window Top Header Bar (3 Mac buttons on top left, link removed) */}
                <div dir="ltr" className="flex items-center justify-between px-4 py-3 bg-[#F6F6F8] border-b border-black/[0.07] select-none">
                  {/* 3 macOS Window Controls in Top Left */}
                  <div className="flex items-center gap-2.5 group/dots">
                    <div
                      title="Close"
                      className="w-3.5 h-3.5 rounded-full bg-[#FF5F56] border border-[#E0443E] shadow-2xs flex items-center justify-center cursor-pointer transition-transform hover:scale-125 active:scale-95"
                    >
                      <span className="text-[9px] text-[#4A0002] font-black opacity-0 group-hover/dots:opacity-90 transition-opacity">×</span>
                    </div>
                    <div
                      title="Minimize"
                      className="w-3.5 h-3.5 rounded-full bg-[#FFBD2E] border border-[#DEA123] shadow-2xs flex items-center justify-center cursor-pointer transition-transform hover:scale-125 active:scale-95"
                    >
                      <span className="text-[9px] text-[#543500] font-black opacity-0 group-hover/dots:opacity-90 transition-opacity">–</span>
                    </div>
                    <div
                      title="Zoom"
                      className="w-3.5 h-3.5 rounded-full bg-[#27C93F] border border-[#1AAB29] shadow-2xs flex items-center justify-center cursor-pointer transition-transform hover:scale-125 active:scale-95"
                    >
                      <span className="text-[8px] text-[#003808] font-black opacity-0 group-hover/dots:opacity-90 transition-opacity">+</span>
                    </div>
                  </div>

                  {/* Right Indicator: Real-time Live Badge */}
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200 shadow-2xs hover:scale-105 transition-transform">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="font-sans">
                      {lang === 'ar' ? 'مزامنة سحابية لحظية' : 'Real-time Sync Active'}
                    </span>
                  </div>
                </div>

                {/* Main Dashboard Image */}
                <div className="relative w-full overflow-hidden bg-[#FBFBFD] group/image">
                  <Image
                    src="/dashboard.png"
                    alt="Sastmhaly Merchant Dashboard"
                    width={1400}
                    height={800}
                    className="w-full h-auto object-cover block transition-transform duration-700 ease-out group-hover/image:scale-[1.018]"
                    priority
                  />
                </div>

              </div>
            </div>
          </div>
        </AnimateOnScroll>
      </section>

      {/* 4. Apple Bento Grid Feature Showcase with Animate on Scroll */}
      <section id="features" className="py-20 sm:py-28 px-4 sm:px-6 max-w-5xl mx-auto border-t border-black/[0.06]">
        <AnimateOnScroll direction="up" delay={0}>
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#1D1D1F] mb-3 hover:tracking-wide transition-all duration-500 cursor-default">
              {lang === 'ar' ? 'كل تفصيلة، صُممت بإتقان.' : 'Every detail. Perfected.'}
            </h2>
            <p className="text-base text-[#86868B] transition-colors duration-300 hover:text-[#1D1D1F] cursor-default">
              {lang === 'ar' 
                ? 'تكنولوجيا متطورة بواجهة بسيطة تمنحك تحكماً شاملاً بمتجرك دون أي تعقيد تقني.' 
                : 'Advanced cloud capability packaged in an intuitive experience.'}
            </p>
          </div>
        </AnimateOnScroll>

        {/* Bento Grid with Staggered Scroll Reveals */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Fast POS (Spans 2 cols on md) */}
          <AnimateOnScroll direction="up" delay={100} className="md:col-span-2 flex flex-col h-full">
            <div id="pos" className="group h-full p-8 rounded-3xl bg-white border border-black/[0.06] shadow-sm flex flex-col justify-between hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 ease-out">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center mb-5 group-hover:scale-120 group-hover:rotate-6 transition-all duration-300">
                  <Zap className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-[#1D1D1F] mb-2 group-hover:text-[#0071E3] group-hover:translate-x-1 rtl:group-hover:-translate-x-1 inline-block transition-all duration-300">
                  {lang === 'ar' ? 'كاشير خاطف لا يتوقف' : 'Blazing Fast POS'}
                </h3>
                <p className="text-sm text-[#86868B] leading-relaxed max-w-lg mb-6 group-hover:text-[#1D1D1F] transition-colors duration-300">
                  {lang === 'ar'
                    ? 'إصدار الفواتير وطباعتها في جزء من الثانية مع دعم فوري للباركود، المنتجات الموزونة، وتعليق وحفظ الفواتير دون فقدان البيانات.'
                    : 'Instant receipt generation, thermal printing, barcode scanning, scale products, and held orders without interruptions.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-[#1D1D1F]/80">
                <span className="px-3.5 py-1.5 bg-[#F5F5F7] group-hover:bg-blue-50 group-hover:text-[#0071E3] group-hover:scale-105 transition-all duration-300 rounded-full cursor-default">
                  ✓ {lang === 'ar' ? 'طابعات 80mm و 58mm' : '80mm / 58mm Printers'}
                </span>
                <span className="px-3.5 py-1.5 bg-[#F5F5F7] group-hover:bg-blue-50 group-hover:text-[#0071E3] group-hover:scale-105 transition-all duration-300 rounded-full cursor-default">
                  ✓ {lang === 'ar' ? 'موازين الباركود' : 'Scale Barcodes'}
                </span>
                <span className="px-3.5 py-1.5 bg-[#F5F5F7] group-hover:bg-blue-50 group-hover:text-[#0071E3] group-hover:scale-105 transition-all duration-300 rounded-full cursor-default">
                  ✓ {lang === 'ar' ? 'خصومات وتعديل فوري' : 'Instant Discounts'}
                </span>
              </div>
            </div>
          </AnimateOnScroll>

          {/* Card 2: Multi-Branch & Inventory */}
          <AnimateOnScroll direction="up" delay={250} className="flex flex-col h-full">
            <div id="inventory" className="group h-full p-8 rounded-3xl bg-white border border-black/[0.06] shadow-sm flex flex-col justify-between hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 ease-out">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-5 group-hover:scale-120 group-hover:-rotate-6 transition-all duration-300">
                  <Boxes className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-[#1D1D1F] mb-2 group-hover:text-indigo-600 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 inline-block transition-all duration-300">
                  {lang === 'ar' ? 'المخازن والفروع' : 'Multi-Branch Stock'}
                </h3>
                <p className="text-sm text-[#86868B] leading-relaxed mb-6 group-hover:text-[#1D1D1F] transition-colors duration-300">
                  {lang === 'ar'
                    ? 'رؤية مركزية لأرصدة جميع الفروع مع تحويلات البضائع وتنبيهات النواقص والصلاحيات.'
                    : 'Centralized live balances across branches, inter-branch transfers, and expiry warnings.'}
                </p>
              </div>
              <span className="text-xs font-bold text-[#0071E3] flex items-center gap-1 group-hover:translate-x-1.5 rtl:group-hover:-translate-x-1.5 transition-transform duration-300">
                <span className="hover:underline">{lang === 'ar' ? 'تحكم مركزي كامل' : 'Full Central Control'}</span>
                <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
              </span>
            </div>
          </AnimateOnScroll>

          {/* Card 3: Staff & HR */}
          <AnimateOnScroll direction="up" delay={150} className="flex flex-col h-full">
            <div id="hr" className="group h-full p-8 rounded-3xl bg-white border border-black/[0.06] shadow-sm flex flex-col justify-between hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 ease-out">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-5 group-hover:scale-120 group-hover:rotate-6 transition-all duration-300">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-[#1D1D1F] mb-2 group-hover:text-emerald-600 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 inline-block transition-all duration-300">
                  {lang === 'ar' ? 'شؤون الموظفين والرواتب' : 'Staff & Automated HR'}
                </h3>
                <p className="text-sm text-[#86868B] leading-relaxed mb-6 group-hover:text-[#1D1D1F] transition-colors duration-300">
                  {lang === 'ar'
                    ? 'حضور وانصراف يومي، تتبع السلف والمكافآت، وحساب مسير الرواتب الصافية مع قسائم رسمية جاهزة للطباعة.'
                    : 'Check-in & out, daily absence, advances, penalties, and automated net payroll calculations with printable payslips.'}
                </p>
              </div>
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                <span className="group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform">{lang === 'ar' ? 'مسير رواتب دقيق 100%' : '100% Accurate Payroll'}</span>
                <Check className="w-3.5 h-3.5 group-hover:scale-150 transition-transform duration-300" />
              </span>
            </div>
          </AnimateOnScroll>

          {/* Card 4: Profit & Analytics (Spans 2 cols on md) */}
          <AnimateOnScroll direction="up" delay={300} className="md:col-span-2 flex flex-col h-full">
            <div className="group h-full p-8 rounded-3xl bg-white border border-black/[0.06] shadow-sm flex flex-col justify-between hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 ease-out">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-5 group-hover:scale-120 group-hover:-rotate-6 transition-all duration-300">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-[#1D1D1F] mb-2 group-hover:text-amber-600 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 inline-block transition-all duration-300">
                  {lang === 'ar' ? 'صافي الأرباح والتقارير المالية الدقيقة' : 'Real Net Profit & Analytics'}
                </h3>
                <p className="text-sm text-[#86868B] leading-relaxed max-w-lg mb-6 group-hover:text-[#1D1D1F] transition-colors duration-300">
                  {lang === 'ar'
                    ? 'يعرفك البرنامج على أرباحك الصافية الحقيقية بعد خصم تكلفة شراء البضاعة، مصاريف التشغيل، مرتبات الموظفين، مع تقارير تفصيلية قابلة للتصدير لإكسيل.'
                    : 'Know your exact net profits after deducting cost of goods sold, operating expenses, and payroll, with interactive Excel exports.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-[#1D1D1F]/80">
                <span className="px-3.5 py-1.5 bg-[#F5F5F7] group-hover:bg-amber-50 group-hover:text-amber-700 group-hover:scale-105 transition-all duration-300 rounded-full cursor-default">
                  ✓ {lang === 'ar' ? 'حساب تكلفة الوحدة بدقة' : 'True Unit Costing'}
                </span>
                <span className="px-3.5 py-1.5 bg-[#F5F5F7] group-hover:bg-amber-50 group-hover:text-amber-700 group-hover:scale-105 transition-all duration-300 rounded-full cursor-default">
                  ✓ {lang === 'ar' ? 'تصدير إكسيل بفلتر التاريخ' : 'Date Range Excel Export'}
                </span>
                <span className="px-3.5 py-1.5 bg-[#F5F5F7] group-hover:bg-amber-50 group-hover:text-amber-700 group-hover:scale-105 transition-all duration-300 rounded-full cursor-default">
                  ✓ {lang === 'ar' ? 'سجل الأرباح اليومية والشهرية' : 'Daily & Monthly Profits'}
                </span>
              </div>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* 5. Performance / Numbers Section with Animated Glowing Numbers & Scroll Reveal */}
      <section id="stats" className="py-20 px-4 sm:px-6 max-w-5xl mx-auto border-t border-black/[0.06]">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
          <AnimateOnScroll direction="zoom" delay={100}>
            <div className="group p-6 rounded-3xl bg-white/60 border border-black/[0.04] backdrop-blur-xs hover:bg-white hover:shadow-2xl hover:-translate-y-2 transition-all duration-500">
              <span className="text-5xl sm:text-6xl font-black text-[#1D1D1F] tracking-tight block mb-2 font-mono group-hover:scale-110 group-hover:text-[#0071E3] transition-all duration-500 stat-number-glow inline-block">
                &lt; 0.2s
              </span>
              <h4 className="text-sm font-bold text-[#1D1D1F] mb-1 group-hover:tracking-wide transition-all duration-300">
                {lang === 'ar' ? 'سرعة استجابة فائقة' : 'Sub-second response'}
              </h4>
              <p className="text-xs text-[#86868B] group-hover:text-[#1D1D1F] transition-colors duration-300">
                {lang === 'ar' ? 'واجهات فورية تعمل دون أي بطء أو انتظار' : 'Zero lag POS and management screens'}
              </p>
            </div>
          </AnimateOnScroll>

          <AnimateOnScroll direction="zoom" delay={250}>
            <div className="group p-6 rounded-3xl bg-white/60 border border-black/[0.04] backdrop-blur-xs hover:bg-white hover:shadow-2xl hover:-translate-y-2 transition-all duration-500">
              <span className="text-5xl sm:text-6xl font-black text-[#0071E3] tracking-tight block mb-2 font-mono group-hover:scale-110 stat-number-glow transition-all duration-500 inline-block">
                99.9%
              </span>
              <h4 className="text-sm font-bold text-[#1D1D1F] mb-1 group-hover:tracking-wide transition-all duration-300">
                {lang === 'ar' ? 'توافر واستقرار سحابي' : 'Cloud Availability'}
              </h4>
              <p className="text-xs text-[#86868B] group-hover:text-[#1D1D1F] transition-colors duration-300">
                {lang === 'ar' ? 'بياناتك محفوظة ومحمية ومشفرة سحابياً' : 'Automated backups and cloud redundancy'}
              </p>
            </div>
          </AnimateOnScroll>

          <AnimateOnScroll direction="zoom" delay={400}>
            <div className="group p-6 rounded-3xl bg-white/60 border border-black/[0.04] backdrop-blur-xs hover:bg-white hover:shadow-2xl hover:-translate-y-2 transition-all duration-500">
              <span className="text-5xl sm:text-6xl font-black text-emerald-600 tracking-tight block mb-2 font-mono group-hover:scale-110 stat-number-glow transition-all duration-500 inline-block">
                5 min
              </span>
              <h4 className="text-sm font-bold text-[#1D1D1F] mb-1 group-hover:tracking-wide transition-all duration-300">
                {lang === 'ar' ? 'تدريب الكاشير' : 'Cashier Onboarding'}
              </h4>
              <p className="text-xs text-[#86868B] group-hover:text-[#1D1D1F] transition-colors duration-300">
                {lang === 'ar' ? 'واجهة عربية سهلة ومريحة يفهمها أي عامل فوراً' : 'Intuitive design anyone can master in minutes'}
              </p>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* 6. Apple Heroic Closing Banner with Motion Texts and Scroll Reveal */}
      <section className="py-20 px-4 sm:px-6 max-w-5xl mx-auto">
        <AnimateOnScroll direction="zoom" delay={150}>
          <div className="group rounded-3xl bg-[#1D1D1F] text-white p-8 sm:p-14 text-center relative overflow-hidden shadow-2xl transition-all duration-700 hover:shadow-[0_20px_60px_rgba(0,113,227,0.4)]">
            {/* Subtle background glow */}
            <div className="absolute -top-24 -left-24 w-80 h-80 bg-[#0071E3]/30 rounded-full blur-3xl pointer-events-none animate-pulse-soft"></div>
            <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-indigo-500/30 rounded-full blur-3xl pointer-events-none animate-float-slow"></div>

            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-4 relative z-10 animate-text-flow bg-gradient-to-r from-white via-blue-200 to-white bg-clip-text text-transparent hover:scale-[1.01] transition-transform duration-500 cursor-default">
              {lang === 'ar' ? 'ارتقِ بتجارتك إلى المستوى التالي.' : 'Upgrade your retail experience.'}
            </h2>
            <p className="text-sm sm:text-base text-[#86868B] max-w-xl mx-auto mb-8 relative z-10 font-normal leading-relaxed hover:text-white transition-colors duration-300 cursor-default">
              {lang === 'ar'
                ? 'انضم إلى منظومة سستمهالي وأدر متجرك بأعلى معايير السرعة والأمان والاحترافية.'
                : 'Join Sastmhaly and manage your stores with uncompromising speed and elegance.'}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 relative z-10">
              <Link
                href="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] text-sm font-bold shadow-md hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300"
              >
                <span>{lang === 'ar' ? 'تسجيل الدخول للمنظومة' : 'Sign In Now'}</span>
                <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              </Link>

              <a
                href="https://wa.me/201558516263"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-white/10 hover:bg-white/15 text-white text-sm font-bold border border-white/20 hover:scale-105 transition-all duration-300 shadow-sm"
              >
                <MessageCircle className="w-4 h-4 text-[#25D366]" />
                <span>{lang === 'ar' ? 'تواصل معنا' : 'Get in Touch'}</span>
              </a>
            </div>
          </div>
        </AnimateOnScroll>
      </section>

      {/* 7. Apple Minimalist Footer */}
      <footer className="border-t border-black/[0.06] bg-[#F5F5F7] py-8 text-xs text-[#86868B]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded overflow-hidden bg-white border border-black/10 flex items-center justify-center p-0.5">
              <Image src="/logo.png" alt="Sastmhaly" width={16} height={16} />
            </div>
            <p className="text-[11px] transition-colors hover:text-[#1D1D1F]">
              © 2026 {lang === 'ar' ? 'سستمهالي. جميع الحقوق محفوظة.' : 'Sastmhaly. All rights reserved.'}
            </p>
          </div>

          <div className="flex items-center gap-5 text-[11px]">
            <Link href="/login" className="hover:text-[#0071E3] hover:underline transition-all duration-200 font-medium">
              {lang === 'ar' ? 'بوابة الدخول' : 'Login Portal'}
            </Link>
            <a href="https://wa.me/201558516263" target="_blank" rel="noopener noreferrer" className="hover:text-[#0071E3] hover:underline transition-all duration-200">
              {lang === 'ar' ? 'الدعم الفني عبر واتساب' : 'WhatsApp Support'}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
