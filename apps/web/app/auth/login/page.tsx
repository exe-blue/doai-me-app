// apps/web/app/auth/login/page.tsx
// 사용자 로그인 페이지 - v0.dev 연동 대기

'use client';

import Link from 'next/link';
import { LogIn, ArrowLeft, Construction } from 'lucide-react';

export default function LoginPage() {
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
              <LogIn className="w-5 h-5" />
              Login
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
            로그인
          </h2>
          <p className="text-neutral-500 max-w-md mx-auto mb-8">
            DoAi.Me 계정으로 로그인하는 페이지입니다.
            <br />
            Supabase Auth 연동 예정입니다.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 text-purple-400 rounded-full text-sm">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            v0.dev 연동 대기 중
          </div>
          
          <div className="mt-8 text-sm text-neutral-500">
            계정이 없으신가요?{' '}
            <Link href="/auth/signup" className="text-primary hover:underline">
              회원가입
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
