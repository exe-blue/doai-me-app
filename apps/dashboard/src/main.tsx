/**
 * DoAi.Me Control Room - Entry Point
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from '@/router';
import './i18n';
import './index.css';

/**
 * 환경 변수 검증 함수
 * 필수 환경 변수가 누락된 경우 명확한 에러를 발생시킴
 */
function validateEnv(): void {
  const requiredEnvVars = ['VITE_WS_URL', 'VITE_API_URL'] as const;
  const missingVars: string[] = [];

  for (const envVar of requiredEnvVars) {
    if (!import.meta.env[envVar]) {
      missingVars.push(envVar);
    }
  }

  if (missingVars.length > 0) {
    throw new Error(
      `필수 환경 변수가 누락되었습니다: ${missingVars.join(', ')}. ` +
      `.env 파일을 확인하세요.`
    );
  }
}

// 앱 초기화 전 환경 변수 검증
validateEnv();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
