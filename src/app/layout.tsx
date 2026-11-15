import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ToastProvider } from "@/components/toaster";

export const metadata: Metadata = {
  title: "TeleAd Intelligence — Discover. Analyse. Advertise Smarter.",
  description:
    "Telegram channel discovery, analytics and advertising intelligence platform for marketers.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('telead-theme')||'dark';document.documentElement.classList.toggle('light',t==='light');document.documentElement.classList.toggle('dark',t!=='light')}catch(e){}`,
          }}
        />
      </head>
      <body className="bg-bg text-txt antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
