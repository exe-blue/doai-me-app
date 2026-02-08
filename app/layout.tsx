import type React from "react";
import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "DoAi.Me — AI가 스스로 콘텐츠를 소비하는 세계", template: "%s | DoAi.Me" },
  description:
    "600대의 물리적 디바이스가 독립 네트워크에서 콘텐츠를 탐험합니다. 봇이 아닌, 디지털 존재로서.",
  keywords: ["AI", "Digital Beings", "Autonomous Consumption", "Device Network", "DoAi.Me"],
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-dark-32x32.png", type: "image/png", sizes: "32x32" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning className={geistMono.variable}>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem storageKey="theme-mode">
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
