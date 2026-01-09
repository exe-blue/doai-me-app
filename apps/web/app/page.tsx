// apps/web/app/page.tsx
// DoAi.Me 메인 랜딩 페이지

'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Header } from './components/layout/Header';
import { Hero } from './components/landing/Hero';
import { Manifesto } from './components/landing/Manifesto';
import { Enter } from './components/landing/Enter';

// ParticleNetwork 동적 임포트 (SSR 비활성화)
const ParticleNetwork = dynamic(() => import('./components/ParticleNetwork'), {
  ssr: false,
});

export default function HomePage() {
  const [isDark, setIsDark] = useState(true);

  // 초기 테마 설정
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  // 테마 토글
  const toggleTheme = useCallback(() => {
    setIsDark(prev => {
      const newIsDark = !prev;
      if (newIsDark) {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      }
      return newIsDark;
    });
  }, []);

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#050505] text-white' : 'bg-[#FAFAFA] text-black'} transition-colors duration-500`}>
      {/* 파티클 배경 */}
      <ParticleNetwork isDark={isDark} zIndex={0} />

      {/* CRT Scanlines (다크 모드에서만) */}
      {isDark && (
        <div className="scanlines fixed inset-0 pointer-events-none z-10 opacity-20" />
      )}

      {/* 헤더 */}
      <Header 
        isDark={isDark} 
        onToggleTheme={toggleTheme} 
      />

      {/* 메인 콘텐츠 */}
      <main className="relative z-20">
        {/* Hero 섹션 */}
        <Hero />

        {/* Manifesto 섹션 */}
        <Manifesto />

        {/* Enter CTA 섹션 */}
        <Enter />
      </main>

      {/* 글로벌 스타일 */}
      <style jsx global>{`
        /* Amber gradient text */
        .text-gradient-amber {
          background: linear-gradient(135deg, #F59E0B 0%, #FBBF24 50%, #F59E0B 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* CRT Scanlines */
        .scanlines {
          background: repeating-linear-gradient(
            0deg,
            rgba(0, 0, 0, 0.15),
            rgba(0, 0, 0, 0.15) 1px,
            transparent 1px,
            transparent 2px
          );
        }

        /* Smooth scroll */
        html {
          scroll-behavior: smooth;
        }

        /* Selection color */
        ::selection {
          background: rgba(245, 158, 11, 0.3);
          color: inherit;
        }
      `}</style>
    </div>
  );
}
