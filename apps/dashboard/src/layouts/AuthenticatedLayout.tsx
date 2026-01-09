/**
 * AuthenticatedLayout - 인증된 사용자용 레이아웃
 * CSS Grid 기반 Bento/Grid 패턴 적용
 * 
 * 왜 Grid를 사용하는가?
 * - Flexbox보다 더 명확한 2차원 레이아웃 제어
 * - 헤더/메인/푸터 영역의 명시적 크기 지정 가능
 * - 반응형 레이아웃에 유리한 구조
 */
import { Outlet } from 'react-router-dom';
import { GlobalNavBar } from '@/components/organisms/GlobalNavBar';

export default function AuthenticatedLayout() {
  return (
    <div 
      className="min-h-screen bg-doai-black-900 grid"
      style={{
        gridTemplateRows: 'auto 1fr',  // 헤더: auto, 메인: 나머지
        gridTemplateColumns: '1fr',     // 단일 컬럼
      }}
    >
      {/* Global Navigation Bar - Row 1 */}
      <GlobalNavBar />

      {/* Main Content Area - Row 2 */}
      <main className="overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

