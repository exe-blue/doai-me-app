/**
 * PublicLayout - 공개 페이지용 레이아웃
 * Landing, Login 페이지에서 사용
 */
import { Outlet } from 'react-router-dom';

export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-doai-black-950">
      <Outlet />
    </div>
  );
}

