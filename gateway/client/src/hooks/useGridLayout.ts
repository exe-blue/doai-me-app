/**
 * useGridLayout Hook
 * 화면 크기에 따른 동적 그리드 레이아웃 계산
 * 
 * @author Axon (Tech Lead)
 * @version 2.0.0
 */

import { useState, useEffect, RefObject } from 'react';
import { calculateGridLayout, type GridLayout } from '../lib/grid-calculator';

export function useGridLayout(
  containerRef: RefObject<HTMLDivElement>,
  deviceCount: number
): GridLayout {
  const [layout, setLayout] = useState<GridLayout>(() => 
    calculateGridLayout({
      containerWidth: window.innerWidth,
      containerHeight: window.innerHeight,
      deviceCount
    })
  );

  useEffect(() => {
    const updateLayout = () => {
      const container = containerRef.current;
      if (!container) return;

      const { width, height } = container.getBoundingClientRect();
      const newLayout = calculateGridLayout({
        containerWidth: width,
        containerHeight: height,
        deviceCount
      });
      setLayout(newLayout);
    };

    // 초기 계산
    updateLayout();

    // 리사이즈 이벤트 핸들러 (debounced)
    let timeoutId: number | null = null;
    const handleResize = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = window.setTimeout(updateLayout, 100);
    };

    window.addEventListener('resize', handleResize);
    
    // ResizeObserver로 컨테이너 크기 변화 감지
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [containerRef, deviceCount]);

  return layout;
}
