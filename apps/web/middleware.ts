// apps/web/middleware.ts
// Server-side 권한 보호 미들웨어
// 회원 등급별 접근 제어 (준회원/정회원/특별회원/관리자/소유자)

import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ============================================
// 경로별 권한 설정
// ============================================

/**
 * 공개 경로 (인증 불필요)
 */
const PUBLIC_PATHS = [
  '/',
  '/admin/login',
  '/admin/signup',
  '/admin/unauthorized',
  '/api',
];

/**
 * 회원 전용 경로 (최소 준회원 이상)
 * 준회원은 /philosophy만 접근 가능
 */
const MEMBER_PATHS = ['/philosophy'];

/**
 * 정회원 이상 경로
 */
const REGULAR_MEMBER_PATHS = ['/dashboard', '/monitoring'];

/**
 * 관리자 전용 경로
 */
const ADMIN_PATHS = ['/admin'];

// ============================================
// 타입 정의
// ============================================

type MembershipTier = 'associate' | 'regular' | 'special';
type AdminRole = 'pending' | 'viewer' | 'admin' | 'owner';

interface UserPermissions {
  userId: string;
  tier: MembershipTier | null;
  adminRole: AdminRole | null;
}

// ============================================
// 미들웨어 메인
// ============================================

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  
  // 공개 경로는 통과
  if (isPublicPath(pathname)) {
    return response;
  }
  
  // Supabase 클라이언트 생성
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          cookiesToSet.forEach(({ name, value }: { name: string; value: string }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options?: Record<string, unknown> }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );
  
  try {
    // 세션 확인
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return handleUnauthenticated(request, pathname);
    }
    
    // 사용자 권한 조회
    const permissions = await getUserPermissions(supabase, session.user.id);
    
    // 경로별 권한 체크
    return checkPathPermissions(request, pathname, permissions, response);
    
  } catch (error) {
    console.error('[Middleware] Auth check error:', error);
    return handleUnauthenticated(request, pathname);
  }
}

// ============================================
// 헬퍼 함수
// ============================================

/**
 * 공개 경로 여부 확인
 */
function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(path => {
    if (path === '/') return pathname === '/';
    if (path === '/api') return pathname.startsWith('/api');
    return pathname === path || pathname.startsWith(path + '/');
  });
}

/**
 * 사용자 권한 조회
 */
async function getUserPermissions(
  supabase: ReturnType<typeof createServerClient>,
  userId: string
): Promise<UserPermissions> {
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
    userId,
    tier: membershipResult.data?.tier as MembershipTier | null,
    adminRole: adminResult.data?.role as AdminRole | null,
  };
}

/**
 * 미인증 사용자 처리
 */
function handleUnauthenticated(request: NextRequest, pathname: string): NextResponse {
  // 회원 전용 경로 접근 시 로그인 페이지로
  if (isMemberPath(pathname)) {
    const loginUrl = new URL('/admin/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }
  
  // 관리자 경로 접근 시 관리자 로그인으로
  if (pathname.startsWith('/admin')) {
    const loginUrl = new URL('/admin/login', request.url);
    return NextResponse.redirect(loginUrl);
  }
  
  return NextResponse.next();
}

/**
 * 회원 경로 여부 확인
 */
function isMemberPath(pathname: string): boolean {
  return [...MEMBER_PATHS, ...REGULAR_MEMBER_PATHS].some(
    path => pathname.startsWith(path)
  );
}

/**
 * 경로별 권한 체크
 */
function checkPathPermissions(
  request: NextRequest,
  pathname: string,
  permissions: UserPermissions,
  response: NextResponse
): NextResponse {
  const { tier, adminRole } = permissions;
  
  // ============================================
  // 관리자 경로 (/admin/*)
  // ============================================
  if (pathname.startsWith('/admin')) {
    // 관리자만 접근 가능
    if (!adminRole || adminRole === 'pending') {
      const unauthorizedUrl = new URL('/admin/unauthorized', request.url);
      return NextResponse.redirect(unauthorizedUrl);
    }
    
    // 회원 관리 페이지는 관리자/소유자만
    if (pathname.startsWith('/admin/members')) {
      if (adminRole !== 'admin' && adminRole !== 'owner') {
        const unauthorizedUrl = new URL('/admin/unauthorized', request.url);
        return NextResponse.redirect(unauthorizedUrl);
      }
    }
    
    return response;
  }
  
  // ============================================
  // 철학 라이브러리 (/philosophy/*)
  // ============================================
  if (pathname.startsWith('/philosophy')) {
    // 모든 회원 접근 가능 (준회원 포함)
    if (tier || adminRole) {
      return response;
    }
    
    // 비회원은 로그인 필요
    const loginUrl = new URL('/admin/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }
  
  // ============================================
  // 정회원 이상 경로 (/dashboard, /monitoring)
  // ============================================
  if (REGULAR_MEMBER_PATHS.some(path => pathname.startsWith(path))) {
    // 관리자 또는 정회원 이상
    if (adminRole && adminRole !== 'pending') {
      return response;
    }
    
    if (tier === 'regular' || tier === 'special') {
      return response;
    }
    
    // 준회원은 철학 라이브러리로 리다이렉트
    if (tier === 'associate') {
      const redirectUrl = new URL('/philosophy', request.url);
      return NextResponse.redirect(redirectUrl);
    }
    
    // 비회원은 로그인 필요
    const loginUrl = new URL('/admin/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }
  
  return response;
}

// ============================================
// 매처 설정
// ============================================

export const config = {
  matcher: [
    // 관리자 경로
    '/admin/:path*',
    // 회원 전용 경로
    '/philosophy/:path*',
    '/dashboard/:path*',
    '/monitoring/:path*',
  ],
};
