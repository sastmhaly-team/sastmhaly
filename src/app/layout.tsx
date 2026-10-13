import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n/context";
import { AuthProvider } from "@/lib/auth/context";
import { NavProvider } from "@/lib/nav-context";

export const metadata: Metadata = {
  title: "Sastmhaly | سستمهالي - Multi-Tenant Retail & Supermarket Management SaaS",
  description: "Enterprise SaaS Platform for Retail Shops, Supermarkets, POS, Multi-Branch Inventory & Accounting",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#F7F9FC] text-[#172033]">
        <LanguageProvider>
          <AuthProvider>
            <NavProvider>
              {children}
            </NavProvider>
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
