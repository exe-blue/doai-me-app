'use client';

// ============================================
// ShareButton - 클라이언트 컴포넌트
// Web Share API 또는 클립보드 복사 기능 제공
// ============================================

import { Share2 } from 'lucide-react';

interface ShareButtonProps {
  title: string;
  text?: string;
}

export function ShareButton({ title, text }: ShareButtonProps) {
  const handleShare = async () => {
    const shareData = {
      title,
      text: text || title,
      url: typeof window !== 'undefined' ? window.location.href : '',
    };

    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        // Web Share API 사용
        await navigator.share(shareData);
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        // Fallback: URL을 클립보드에 복사
        await navigator.clipboard.writeText(shareData.url);
        // TODO: 토스트 알림으로 "URL이 복사되었습니다" 표시
      }
    } catch (error) {
      // 사용자가 공유를 취소했거나 오류 발생
      console.error('Share failed:', error);
    }
  };

  return (
    <button
      className="p-2 text-neutral-400 hover:text-purple-400 transition-colors"
      title="공유하기"
      aria-label="공유하기"
      onClick={handleShare}
    >
      <Share2 className="w-5 h-5" />
    </button>
  );
}
