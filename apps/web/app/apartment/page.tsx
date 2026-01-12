// apps/web/app/apartment/page.tsx
// 디바이스 관리 (아파트 시각화) 페이지 - v0.dev 연동 대기

'use client';

import Link from 'next/link';
import { Building, ArrowLeft, Construction } from 'lucide-react';

export default function ApartmentPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-white flex flex-col">
      {/* 헤더 */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-black/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto h-full px-4 md:px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/"
              className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">홈으로</span>
            </Link>
            <div className="h-6 w-px bg-white/20" />
            <h1 className="text-lg font-bold text-[#FFCC00] flex items-center gap-2">
              <Building className="w-5 h-5" />
              Apartment
            </h1>
          </div>
          
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold text-[#FFCC00]">DoAi</span>
            <span className="text-xl font-light text-white">.Me</span>
          </Link>
        </div>
      </header>

      {/* 메인 콘텐츠 - Placeholder */}
      <div className="flex-1 flex items-center justify-center pt-16">
        <div className="text-center px-4">
          <Construction className="w-16 h-16 mx-auto mb-6 text-[#FFCC00] opacity-50" />
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            디바이스 아파트
          </h2>
          <p className="text-neutral-500 max-w-md mx-auto mb-8">
            스마트폰 디바이스를 아파트 호실로 시각화하여 관리하는 페이지입니다.
            <br />
            1대의 디바이스 = 1개의 호실, 1개의 AI 에이전트 = 1명의 거주자
            <br />
            v0.dev에서 디자인 작업 후 연동 예정입니다.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 text-purple-400 rounded-full text-sm">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            v0.dev 연동 대기 중
          </div>
        </div>
      </div>
    </main>
  );
}
