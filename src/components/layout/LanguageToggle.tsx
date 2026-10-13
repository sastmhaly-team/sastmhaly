'use client';

import React from 'react';
import { useLanguage } from '@/lib/i18n/context';
import { Globe } from 'lucide-react';

export function LanguageToggle() {
  const { lang, setLang } = useLanguage();

  return (
    <button
      onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-[#E5EAF2] bg-white text-[#172033] hover:bg-[#F7F9FC] transition-colors cursor-pointer"
      title="Switch Language / تغيير اللغة"
    >
      <Globe className="w-3.5 h-3.5 text-[#246BFD]" />
      <span>{lang === 'ar' ? 'English' : 'العربية'}</span>
    </button>
  );
}
