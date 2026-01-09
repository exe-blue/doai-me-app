/**
 * Auth Store - Zustand 기반 인증 상태 관리
 * 
 * 보안 주의사항:
 * - 개발용 로그인은 development 환경에서만 활성화
 * - 환경 변수로 개발용 자격증명 관리
 * - 프로덕션에서는 실제 API 연동 필수
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'operator' | 'viewer';
}

interface AuthState {
  // State
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
}

/**
 * 암호학적으로 안전한 랜덤 토큰 생성
 * 
 * 왜 이렇게 작성했는가?
 * - Date.now()는 예측 가능하여 보안에 취약
 * - crypto.randomUUID() 또는 crypto.getRandomValues() 사용
 */
function generateSecureToken(): string {
  // crypto.randomUUID() 사용 가능 시 (모던 브라우저)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `mock-jwt-token-${crypto.randomUUID()}`;
  }
  
  // fallback: crypto.getRandomValues() 사용
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    const hex = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    return `mock-jwt-token-${hex}`;
  }
  
  // 최후의 fallback (권장하지 않음)
  return `mock-jwt-token-${Math.random().toString(36).substring(2)}`;
}

/**
 * 개발 환경 여부 확인
 */
function isDevEnvironment(): boolean {
  return import.meta.env.DEV || import.meta.env.MODE === 'development';
}

/**
 * 개발용 자격증명 (환경 변수에서 로드)
 * .env.example에 VITE_DEV_ADMIN_EMAIL, VITE_DEV_ADMIN_PASSWORD 추가 필요
 */
function getDevCredentials(): { email: string; password: string } | null {
  // 프로덕션에서는 개발용 로그인 비활성화
  if (!isDevEnvironment()) {
    return null;
  }
  
  const email = import.meta.env.VITE_DEV_ADMIN_EMAIL;
  const password = import.meta.env.VITE_DEV_ADMIN_PASSWORD;
  
  if (!email || !password) {
    return null;
  }
  
  return { email, password };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // Initial State
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      // Actions
      login: async (email: string, password: string) => {
        set({ isLoading: true });

        try {
          // 개발 환경에서만 개발용 로그인 허용
          const devCreds = getDevCredentials();
          
          if (devCreds && email === devCreds.email && password === devCreds.password) {
            const mockUser: User = {
              id: 'admin-001',
              email: devCreds.email,
              name: 'Dev Admin',
              role: 'admin',
            };
            // 암호학적으로 안전한 토큰 생성
            const mockToken = generateSecureToken();

            set({
              user: mockUser,
              token: mockToken,
              isAuthenticated: true,
              isLoading: false,
            });

            return true;
          }

          // TODO: 실제 API 연동 구현
          // const response = await authApi.login(email, password);
          // ...

          set({ isLoading: false });
          return false;
        } catch (error) {
          // 보안: 민감한 정보 노출 방지 (전체 에러 객체 로깅 금지)
          // 스택 트레이스에 이메일/비밀번호가 포함될 수 있음
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('[AuthStore] Login failed:', errorMessage);
          set({ isLoading: false });
          return false;
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
      },

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setToken: (token) => set({ token }),
    }),
    {
      name: 'doai-auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

