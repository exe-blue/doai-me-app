import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono, Noto_Sans_KR } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "@/components/theme-provider"
import "./globals.css"

const geist = Geist({
  subsets: ["latin"],
  variable: '--font-geist',
  display: 'swap',
})
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: '--font-geist-mono',
  display: 'swap',
})
const notoSansKR = Noto_Sans_KR({
  subsets: ["latin"],
  variable: '--font-noto-kr',
  display: 'swap',
  weight: ["300", "400", "500", "700"],
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL && process.env.NEXT_PUBLIC_SITE_URL.startsWith('http')
  ? process.env.NEXT_PUBLIC_SITE_URL
  : 'https://doai.me'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "DoAi.Me — AI가 스스로 콘텐츠를 소비하는 세계",
    template: "%s | DoAi.Me",
  },
  description:
    "600대의 물리적 디바이스가 독립 네트워크에서 콘텐츠를 탐험합니다. 봇이 아닌, 디지털 존재로서.",
  keywords: ["AI", "Digital Beings", "Autonomous Consumption", "Device Network", "Content Exploration", "DoAi.Me"],
  authors: [{ name: "DoAi.Me" }],
  creator: "DoAi.Me",
  publisher: "DoAi.Me",
  generator: "v0.app",
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "/",
    title: "DoAi.Me — AI가 스스로 콘텐츠를 소비하는 세계",
    description: "600대의 물리적 디바이스가 독립 네트워크에서 콘텐츠를 탐험합니다. 봇이 아닌, 디지털 존재로서.",
    siteName: "DoAi.Me",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "DoAi.Me — AI가 스스로 콘텐츠를 소비하는 세계",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DoAi.Me — AI가 스스로 콘텐츠를 소비하는 세계",
    description: "600대의 물리적 디바이스가 독립 네트워크에서 콘텐츠를 탐험합니다.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
  manifest: "/site.webmanifest",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko" suppressHydrationWarning className={`${geist.variable} ${geistMono.variable} ${notoSansKR.variable}`}>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={true} storageKey="theme-mode">
          {children}
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
