// apps/web/app/auth/profile/page.tsx
// 사용자 프로필 편집 페이지 - v0.dev 연동 대기

'use client';

import Link from 'next/link';
import { User, ArrowLeft, Construction } from 'lucide-react';

export default function ProfilePage() {
  // TODO: i18n 통합 - useTranslation() 훅 사용
  // 현재 프로젝트에 i18n 설정이 없어 하드코딩된 문자열 유지
  // i18n 설정 후 아래 키로 교체:
  // - profile.home, profile.title, profile.heading
  // - profile.description.line1/2/3, profile.badge
  // - profile.loginPrompt, profile.loginLink
  // - profile.brand.part1, profile.brand.part2
  
  return (
    <main className="min-h-screen bg-background text-white flex flex-col">
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
            <h1 className="text-lg font-bold text-primary flex items-center gap-2">
              <User className="w-5 h-5" />
              Profile
            </h1>
          </div>
          
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold text-primary">DoAi</span>
            <span className="text-xl font-light text-white">.Me</span>
          </Link>
        </div>
      </header>

      {/* 메인 콘텐츠 - Placeholder */}
      <div className="flex-1 flex items-center justify-center pt-16">
        <div className="text-center px-4">
          <Construction className="w-16 h-16 mx-auto mb-6 text-primary opacity-50" />
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            프로필 설정
          </h2>
          <p className="text-neutral-500 max-w-md mx-auto mb-8">
            계정 정보와 프로필을 수정할 수 있는 페이지입니다.
            <br />
            로그인이 필요한 보호된 페이지입니다.
            <br />
            Supabase Auth 연동 예정입니다.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 text-purple-400 rounded-full text-sm">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            v0.dev 연동 대기 중
          </div>
          
          <div className="mt-8 text-sm text-neutral-500">
            로그인이 필요합니다.{' '}
            <Link href="/auth/login" className="text-primary hover:underline">
              로그인하기
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
