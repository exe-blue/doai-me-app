/**
 * Auth Store - Zustand 기반 인증 상태 관리
 * 
 * Supabase Auth와 연동하여 회원 등급 시스템 지원:
 * - 일반 회원: associate(준회원), regular(정회원), special(특별회원)
 * - 관리자: admin(관리자), owner(소유자)
 * 
 * 보안 주의사항:
 * - 개발용 로그인은 development 환경에서만 활성화
 * - 환경 변수로 개발용 자격증명 관리
 * - 프로덕션에서는 Supabase Auth 사용 필수
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase/client';
import type { User, MembershipTier, AdminRole } from '../lib/auth/types';

// ============================================
// Store Types
// ============================================

interface AuthState {
  // State
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<boolean>;
  loginWithSupabase: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  clearError: () => void;
}

// ============================================
// Helper Functions
// ============================================

/**
 * 개발 환경 여부 확인
 */
function isDevEnvironment(): boolean {
  return import.meta.env.DEV || import.meta.env.MODE === 'development';
}

/**
 * 개발용 자격증명 (환경 변수에서 로드)
 */
function getDevCredentials(): { email: string; password: string } | null {
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

/**
 * 암호학적으로 안전한 랜덤 토큰 생성
 */
function generateSecureToken(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `mock-jwt-token-${crypto.randomUUID()}`;
  }
  
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    const hex = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    return `mock-jwt-token-${hex}`;
  }
  
  return `mock-jwt-token-${Math.random().toString(36).substring(2)}`;
}

/**
 * Supabase에서 사용자 권한 조회
 */
async function fetchUserPermissions(userId: string): Promise<{
  tier: MembershipTier | null;
  adminRole: AdminRole | null;
}> {
  try {
    // 병렬로 membership과 admin_users 조회
    const [membershipResult, adminResult] = await Promise.all([
      supabase
        .from('user_memberships')
        .select('tier')
        .eq('user_id', userId)
        .single(),
      supabase
        .from('admin_users')
        .select('role')
        .eq('user_id', userId)
        .single(),
    ]);
    
    return {
      tier: membershipResult.data?.tier as MembershipTier | null,
      adminRole: adminResult.data?.role as AdminRole | null,
    };
  } catch (error) {
    console.error('[AuthStore] Failed to fetch permissions:', error);
    return { tier: null, adminRole: null };
  }
}

// ============================================
// Auth Store
// ============================================

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial State
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Actions
      
      /**
       * 로그인 (개발용 + Supabase)
       */
      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });

        try {
          // 개발 환경에서 개발용 로그인 허용
          const devCreds = getDevCredentials();
          
          if (devCreds && email === devCreds.email && password === devCreds.password) {
            const mockUser: User = {
              id: 'dev-admin-001',
              email: devCreds.email,
              name: 'Dev Admin',
              tier: null,
              adminRole: 'admin',
              isAdmin: true,
              isOwner: false,
            };
            const mockToken = generateSecureToken();

            set({
              user: mockUser,
              token: mockToken,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });

            return true;
          }

          // Supabase 로그인 시도
          return await get().loginWithSupabase(email, password);
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('[AuthStore] Login failed:', errorMessage);
          set({ isLoading: false, error: '로그인에 실패했습니다' });
          return false;
        }
      },

      /**
       * Supabase Auth로 로그인
       */
      loginWithSupabase: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          
          if (error) {
            set({ isLoading: false, error: error.message });
            return false;
          }
          
          if (!data.user || !data.session) {
            set({ isLoading: false, error: '세션을 생성할 수 없습니다' });
            return false;
          }
          
          // 권한 조회
          const permissions = await fetchUserPermissions(data.user.id);
          
          const user: User = {
            id: data.user.id,
            email: data.user.email || '',
            name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'Unknown',
            tier: permissions.tier,
            adminRole: permissions.adminRole,
            isAdmin: permissions.adminRole === 'admin' || permissions.adminRole === 'owner',
            isOwner: permissions.adminRole === 'owner',
          };
          
          set({
            user,
            token: data.session.access_token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          
          return true;
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('[AuthStore] Supabase login failed:', errorMessage);
          set({ isLoading: false, error: '로그인에 실패했습니다' });
          return false;
        }
      },

      /**
       * 로그아웃
       */
      logout: async () => {
        try {
          await supabase.auth.signOut();
        } catch (error) {
          console.error('[AuthStore] Logout error:', error);
        }
        
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
        });
      },

      /**
       * 세션 갱신
       */
      refreshSession: async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          
          if (!session) {
            set({
              user: null,
              token: null,
              isAuthenticated: false,
            });
            return;
          }
          
          // 권한 갱신
          const permissions = await fetchUserPermissions(session.user.id);
          
          const user: User = {
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Unknown',
            tier: permissions.tier,
            adminRole: permissions.adminRole,
            isAdmin: permissions.adminRole === 'admin' || permissions.adminRole === 'owner',
            isOwner: permissions.adminRole === 'owner',
          };
          
          set({
            user,
            token: session.access_token,
            isAuthenticated: true,
          });
          
        } catch (error) {
          console.error('[AuthStore] Session refresh failed:', error);
        }
      },

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setToken: (token) => set({ token }),
      clearError: () => set({ error: null }),
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

// ============================================
// Supabase Auth Listener
// ============================================

// Auth 상태 변경 리스너 설정
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange(async (event, session) => {
    const store = useAuthStore.getState();
    
    if (event === 'SIGNED_OUT') {
      store.setUser(null);
      store.setToken(null);
    } else if (event === 'SIGNED_IN' && session) {
      // 새 로그인 시 세션 갱신
      await store.refreshSession();
    } else if (event === 'TOKEN_REFRESHED' && session) {
      store.setToken(session.access_token);
    }
  });
}
