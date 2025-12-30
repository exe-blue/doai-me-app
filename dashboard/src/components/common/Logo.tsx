'use client';

import Image from 'next/image';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'auto' | 'dark' | 'light';
}

export function Logo({ className = '', size = 'md', variant = 'auto' }: LogoProps) {
  // 크기별 높이 설정 (로고 비율 약 3:1)
  const sizeConfig = {
    sm: { height: 24, width: 72 },
    md: { height: 32, width: 96 },
    lg: { height: 40, width: 120 },
  };

  const { height, width } = sizeConfig[size];

  // auto인 경우 CSS로 다크/라이트 모드 전환
  if (variant === 'auto') {
    return (
      <div className={`relative ${className}`} style={{ width, height }}>
        {/* 다크모드용 로고 (흰색 텍스트) - 다크 테마에서만 표시 */}
        <Image
          src="/logo_darkmode.svg"
          alt="DoAi.Me"
          width={width}
          height={height}
          className="dark:block hidden object-contain"
          priority
        />
        {/* 라이트모드용 로고 (검은색 텍스트) - 라이트 테마에서만 표시 */}
        <Image
          src="/logo_lightmode.svg"
          alt="DoAi.Me"
          width={width}
          height={height}
          className="dark:hidden block object-contain"
          priority
        />
      </div>
    );
  }

  // 특정 variant가 지정된 경우
  const logoSrc = variant === 'dark' ? '/logo_darkmode.svg' : '/logo_lightmode.svg';
  
  return (
    <div className={className}>
      <Image
        src={logoSrc}
        alt="DoAi.Me"
        width={width}
        height={height}
        className="object-contain"
        priority
      />
    </div>
  );
}

