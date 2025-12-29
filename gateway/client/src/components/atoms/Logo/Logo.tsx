/**
 * Logo Component (Atom)
 * DoAi.Me 브랜드 로고
 * 
 * @author Axon (Tech Lead)
 * @version 2.0.0
 */

import { clsx } from 'clsx';

export interface LogoProps {
  /** 로고 크기 */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** 텍스트 포함 여부 */
  showText?: boolean;
  /** 애니메이션 활성화 */
  animated?: boolean;
  /** 추가 CSS 클래스 */
  className?: string;
}

const sizeConfig = {
  sm: { circle1: 16, circle2: 12, fontSize: 'text-sm', gap: 'gap-1.5' },
  md: { circle1: 20, circle2: 14, fontSize: 'text-lg', gap: 'gap-2' },
  lg: { circle1: 28, circle2: 20, fontSize: 'text-2xl', gap: 'gap-2.5' },
  xl: { circle1: 36, circle2: 26, fontSize: 'text-3xl', gap: 'gap-3' },
};

export function Logo({ 
  size = 'md', 
  showText = true, 
  animated = false,
  className 
}: LogoProps) {
  const config = sizeConfig[size];
  
  return (
    <div className={clsx('flex items-center', config.gap, className)}>
      {/* 두 개의 원 (DoAi Yellow) */}
      <div className="relative flex items-center">
        <div 
          className={clsx(
            'rounded-full bg-doai-400',
            animated && 'animate-pulse'
          )}
          style={{ width: config.circle1, height: config.circle1 }}
        />
        <div 
          className={clsx(
            'rounded-full bg-doai-400 -ml-2',
            animated && 'animate-pulse'
          )}
          style={{ 
            width: config.circle2, 
            height: config.circle2,
            animationDelay: animated ? '0.5s' : undefined
          }}
        />
      </div>
      
      {/* 텍스트 */}
      {showText && (
        <span className={clsx('font-bold', config.fontSize)}>
          <span className="text-doai-400">DoAi</span>
          <span className="text-white">.Me</span>
        </span>
      )}
    </div>
  );
}

