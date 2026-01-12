'use server';

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import type { 
  UserPermissions, 
  AuthResult, 
  MembershipTier, 
  AdminRole 
} from '@/lib/auth/types';
import { checkPermission, type Action, type Resource } from '@/lib/auth/permissions';

// Supabase Admin Client (service role)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// Auth Check (Production Ready)
// ============================================

/**
 * 서버 액션용 인증 체크
 * @supabase/ssr을 사용하여 쿠키 기반 세션 확인
 */
export async function checkAdminAuth(): Promise<AuthResult> {
  try {
    // Next.js 15: cookies()는 Promise를 반환하므로 await 필요
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            // Server actions에서는 쿠키 설정 불필요
          },
        },
      }
    );
    
    // 세션 확인
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return {
        authorized: false,
        permissions: getDefaultPermissions(),
        error: '세션이 없습니다',
      };
    }
    
    // 사용자 권한 조회 (병렬)
    const [membershipResult, adminResult] = await Promise.all([
      supabaseAdmin
        .from('user_memberships')
        .select('tier, display_name')
        .eq('user_id', session.user.id)
        .single(),
      supabaseAdmin
        .from('admin_users')
        .select('role')
        .eq('user_id', session.user.id)
        .single(),
    ]);
    
    const tier = membershipResult.data?.tier as MembershipTier | null;
    const adminRole = adminResult.data?.role as AdminRole | null;
    const displayName = membershipResult.data?.display_name;
    
    const permissions: UserPermissions = {
      userId: session.user.id,
      email: session.user.email ?? null,
      tier,
      adminRole,
      isAdmin: adminRole === 'admin' || adminRole === 'owner',
      isOwner: adminRole === 'owner',
      displayName: displayName ?? null,
    };
    
    // 관리자 접근 권한 확인
    const authorized = adminRole !== null && adminRole !== 'pending';
    
    return {
      authorized,
      permissions,
      error: authorized ? undefined : '관리자 권한이 없습니다',
    };
  } catch (error) {
    console.error('[checkAdminAuth] Error:', error);
    return {
      authorized: false,
      permissions: getDefaultPermissions(),
      error: '인증 확인 중 오류가 발생했습니다',
    };
  }
}

/**
 * 기본 권한 객체 (비인증 사용자)
 */
function getDefaultPermissions(): UserPermissions {
  return {
    userId: null,
    email: null,
    tier: null,
    adminRole: null,
    isAdmin: false,
    isOwner: false,
    displayName: null,
  };
}

/**
 * 권한 확인 후 에러 throw 헬퍼
 */
async function requirePermission(
  action: Action,
  resource: Resource
): Promise<AuthResult> {
  const auth = await checkAdminAuth();
  
  if (!auth.authorized) {
    throw new Error(auth.error || '인증이 필요합니다');
  }
  
  const hasPermission = checkPermission(
    auth.permissions.tier,
    auth.permissions.adminRole,
    action,
    resource
  );
  
  if (!hasPermission) {
    const actionNames: Record<Action, string> = {
      view: '조회',
      create: '생성',
      edit: '수정',
      delete: '삭제',
    };
    throw new Error(`${actionNames[action]} 권한이 없습니다`);
  }
  
  return auth;
}

// ============================================
// Dashboard Stats
// ============================================

export async function getDashboardStats() {
  const [nodesResult, devicesResult, activitiesResult, wormholesResult] = await Promise.all([
    // 노드 상태 집계
    supabaseAdmin
      .from('nodes')
      .select('status_v2'),
    
    // 디바이스 상태 집계
    supabaseAdmin
      .from('devices')
      .select('status'),
    
    // 최근 1시간 활동 수
    supabaseAdmin
      .from('activity_logs')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 3600000).toISOString()),
    
    // 오늘 웜홀 수
    supabaseAdmin
      .from('wormhole_events')
      .select('id', { count: 'exact', head: true })
      .gte('detected_at', new Date().toISOString().split('T')[0]),
  ]);

  const nodeStats = {
    active: 0,
    in_umbra: 0,
    offline: 0,
    error: 0,
  };
  
  nodesResult.data?.forEach((n: { status_v2: string }) => {
    const status = n.status_v2 as keyof typeof nodeStats;
    if (status in nodeStats) nodeStats[status]++;
  });

  const deviceStats = {
    online: 0,
    busy: 0,
    offline: 0,
    error: 0,
  };
  
  devicesResult.data?.forEach((d: { status: string }) => {
    const status = d.status as keyof typeof deviceStats;
    if (status in deviceStats) deviceStats[status]++;
  });

  return {
    nodes: nodeStats,
    devices: deviceStats,
    activitiesLastHour: activitiesResult.count || 0,
    wormholesToday: wormholesResult.count || 0,
    lastUpdated: new Date().toISOString(),
  };
}

// ============================================
// Top Activity/Economy
// ============================================

export async function getTopAgentsToday() {
  const today = new Date().toISOString().split('T')[0];
  
  const [activityResult, economyResult] = await Promise.all([
    // Top Activity
    supabaseAdmin.rpc('get_top_activity_agents', { p_date: today, p_limit: 5 }),
    
    // Top Economy
    supabaseAdmin.rpc('get_top_economy_agents', { p_date: today, p_limit: 5 }),
  ]);

  return {
    topActivity: activityResult.data || [],
    topEconomy: economyResult.data || [],
  };
}

// ============================================
// Devices
// ============================================

export async function getDevicesList(nodeId?: string, status?: string) {
  let query = supabaseAdmin
    .from('devices')
    .select(`
      *,
      nodes(node_id, name, status_v2)
    `)
    .order('last_seen', { ascending: false })
    .limit(100);
  
  if (nodeId) query = query.eq('node_id', nodeId);
  if (status) query = query.eq('status', status);
  
  const { data, error } = await query;
  
  if (error) throw new Error(error.message);
  return data || [];
}

export async function retryDevice(deviceId: string) {
  await requirePermission('edit', 'devices');
  
  const { error } = await supabaseAdmin
    .from('devices')
    .update({
      status: 'online',
      consecutive_errors: 0,
      last_error_code: null,
      last_error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('device_id', deviceId);
  
  if (error) throw new Error(error.message);
  
  revalidatePath('/admin/devices');
  return { success: true };
}

// ============================================
// Media Channels
// ============================================

export async function getChannels() {
  const { data, error } = await supabaseAdmin
    .from('media_channels')
    .select('*')
    .order('priority', { ascending: false });
  
  if (error) throw new Error(error.message);
  return data || [];
}

export async function createChannel(formData: FormData) {
  const auth = await requirePermission('create', 'content');

  const rawChannelCode = formData.get('channel_code') as string | null;
  const rawTitle = formData.get('title') as string | null;
  const rawPriority = formData.get('priority') as string | null;

  // Validation: channel_code
  const channelCode = rawChannelCode?.trim();
  if (!channelCode || channelCode.length === 0) {
    throw new Error('channel_code is required and cannot be empty');
  }
  // 허용 문자: 영숫자, 하이픈, 언더스코어만
  if (!/^[a-zA-Z0-9_-]+$/.test(channelCode)) {
    throw new Error('channel_code can only contain alphanumeric characters, hyphens, and underscores');
  }

  // Validation: title
  const title = rawTitle?.trim();
  if (!title || title.length === 0) {
    throw new Error('title is required and cannot be empty');
  }

  // Validation: priority (1-10 범위로 클램핑)
  let priority = parseInt(rawPriority || '5', 10);
  if (isNaN(priority)) priority = 5;
  priority = Math.max(1, Math.min(10, priority));

  const { error } = await supabaseAdmin
    .from('media_channels')
    .insert({
      channel_code: channelCode,
      title,
      priority,
      created_by: auth.permissions.userId,
    });
  
  if (error) throw new Error(error.message);
  
  revalidatePath('/admin/content');
  return { success: true };
}

export async function updateChannel(channelId: string, formData: FormData) {
  const auth = await requirePermission('edit', 'content');
  
  const rawTitle = formData.get('title') as string | null;
  const rawPriority = formData.get('priority') as string | null;
  const rawIsActive = formData.get('is_active') as string | null;
  
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: auth.permissions.userId,
  };
  
  if (rawTitle) {
    const title = rawTitle.trim();
    if (title.length > 0) {
      updateData.title = title;
    }
  }
  
  if (rawPriority) {
    let priority = parseInt(rawPriority, 10);
    if (!isNaN(priority)) {
      updateData.priority = Math.max(1, Math.min(10, priority));
    }
  }
  
  if (rawIsActive !== null) {
    updateData.is_active = rawIsActive === 'true';
  }
  
  const { error } = await supabaseAdmin
    .from('media_channels')
    .update(updateData)
    .eq('id', channelId);
  
  if (error) throw new Error(error.message);
  
  revalidatePath('/admin/content');
  return { success: true };
}

export async function deleteChannel(channelId: string) {
  await requirePermission('delete', 'content');
  
  const { error } = await supabaseAdmin
    .from('media_channels')
    .delete()
    .eq('id', channelId);
  
  if (error) throw new Error(error.message);
  
  revalidatePath('/admin/content');
  return { success: true };
}

export async function getChannelVideos(channelId: string) {
  const { data, error } = await supabaseAdmin
    .from('media_videos')
    .select('*')
    .eq('channel_id', channelId)
    .order('published_at', { ascending: false })
    .limit(20);
  
  if (error) throw new Error(error.message);
  return data || [];
}

// ============================================
// Threat Contents
// ============================================

export async function getThreatContents() {
  const { data, error } = await supabaseAdmin
    .from('threat_contents')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw new Error(error.message);
  return data || [];
}

export async function createThreatContent(formData: FormData) {
  const auth = await requirePermission('create', 'content');

  const rawTitle = formData.get('title') as string | null;
  const rawDescription = formData.get('description') as string | null;
  const rawThreatType = formData.get('threat_type') as string | null;
  const rawSeverity = formData.get('severity') as string | null;

  // Validation: title
  const title = rawTitle?.trim();
  if (!title || title.length === 0) {
    throw new Error('title is required and cannot be empty');
  }

  // Validation: description
  const description = rawDescription?.trim();

  // Validation: threat_type
  const threatType = rawThreatType?.trim();
  if (!threatType || threatType.length === 0) {
    throw new Error('threat_type is required and cannot be empty');
  }

  // Validation: severity (1-10 범위 검증 및 정규화)
  let severity = parseInt(rawSeverity || '5', 10);
  if (isNaN(severity)) severity = 5;
  severity = Math.max(1, Math.min(10, severity));

  const { error } = await supabaseAdmin
    .from('threat_contents')
    .insert({
      title,
      description,
      threat_type: threatType,
      severity,
      created_by: auth.permissions.userId,
    });
  
  if (error) throw new Error(error.message);
  
  revalidatePath('/admin/content');
  return { success: true };
}

export async function updateThreatContent(threatId: string, formData: FormData) {
  const auth = await requirePermission('edit', 'content');
  
  const rawTitle = formData.get('title') as string | null;
  const rawDescription = formData.get('description') as string | null;
  const rawThreatType = formData.get('threat_type') as string | null;
  const rawSeverity = formData.get('severity') as string | null;
  const rawIsActive = formData.get('is_active') as string | null;
  
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: auth.permissions.userId,
  };
  
  if (rawTitle) {
    const title = rawTitle.trim();
    if (title.length > 0) {
      updateData.title = title;
    }
  }
  
  if (rawDescription) {
    updateData.description = rawDescription.trim();
  }
  
  if (rawThreatType) {
    updateData.threat_type = rawThreatType.trim();
  }
  
  if (rawSeverity) {
    let severity = parseInt(rawSeverity, 10);
    if (!isNaN(severity)) {
      updateData.severity = Math.max(1, Math.min(10, severity));
    }
  }
  
  // rawIsActive가 명시적으로 제공된 경우에만 업데이트 (빈 문자열 제외)
  if (rawIsActive !== null && rawIsActive !== '') {
    updateData.is_active = rawIsActive === 'true';
  }
  
  const { error } = await supabaseAdmin
    .from('threat_contents')
    .update(updateData)
    .eq('id', threatId);
  
  if (error) throw new Error(error.message);
  
  revalidatePath('/admin/content');
  return { success: true };
}

export async function deleteThreatContent(threatId: string) {
  await requirePermission('delete', 'content');
  
  const { error } = await supabaseAdmin
    .from('threat_contents')
    .delete()
    .eq('id', threatId);
  
  if (error) throw new Error(error.message);
  
  revalidatePath('/admin/content');
  return { success: true };
}

// ============================================
// Economy Contents
// ============================================

export async function getEconomyContents(status?: string) {
  let query = supabaseAdmin
    .from('economy_contents')
    .select('*')
    .order('open_at', { ascending: false });
  
  if (status) query = query.eq('status', status);
  
  const { data, error } = await query;
  
  if (error) throw new Error(error.message);
  return data || [];
}

export async function createEconomyContent(formData: FormData) {
  const auth = await requirePermission('create', 'content');

  const rawTitle = formData.get('title') as string | null;
  const openAt = formData.get('open_at') as string | null;
  const totalReward = parseFloat(formData.get('total_reward') as string) || 100;
  const rawMaxParticipants = formData.get('max_participants') as string | null;
  const maxParticipants = rawMaxParticipants ? parseInt(rawMaxParticipants, 10) : null;

  // Validation: title
  const title = rawTitle?.trim();
  if (!title || title.length === 0) {
    throw new Error('title is required and cannot be empty');
  }

  // Validation: open_at - 유효한 날짜인지 확인
  let openAtIso: string | null = null;
  if (openAt) {
    const parsedDate = new Date(openAt);
    if (isNaN(parsedDate.getTime())) {
      throw new Error('open_at is not a valid date format');
    }
    openAtIso = parsedDate.toISOString();
  } else {
    throw new Error('open_at is required');
  }

  const { error } = await supabaseAdmin
    .from('economy_contents')
    .insert({
      title,
      open_at: openAtIso,
      total_reward: totalReward,
      max_participants: maxParticipants,
      created_by: auth.permissions.userId,
    });
  
  if (error) throw new Error(error.message);
  
  revalidatePath('/admin/content');
  return { success: true };
}

export async function updateEconomyContent(contentId: string, formData: FormData) {
  const auth = await requirePermission('edit', 'content');
  
  const rawTitle = formData.get('title') as string | null;
  const rawOpenAt = formData.get('open_at') as string | null;
  const rawTotalReward = formData.get('total_reward') as string | null;
  const rawStatus = formData.get('status') as string | null;
  
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: auth.permissions.userId,
  };
  
  if (rawTitle) {
    const title = rawTitle.trim();
    if (title.length > 0) {
      updateData.title = title;
    }
  }
  
  if (rawOpenAt) {
    const parsedDate = new Date(rawOpenAt);
    if (!isNaN(parsedDate.getTime())) {
      updateData.open_at = parsedDate.toISOString();
    }
  }
  
  if (rawTotalReward) {
    const totalReward = parseFloat(rawTotalReward);
    if (!isNaN(totalReward)) {
      updateData.total_reward = totalReward;
    }
  }
  
  if (rawStatus) {
    updateData.status = rawStatus;
  }
  
  const { error } = await supabaseAdmin
    .from('economy_contents')
    .update(updateData)
    .eq('id', contentId);
  
  if (error) throw new Error(error.message);
  
  revalidatePath('/admin/content');
  return { success: true };
}

export async function deleteEconomyContent(contentId: string) {
  await requirePermission('delete', 'content');
  
  const { error } = await supabaseAdmin
    .from('economy_contents')
    .delete()
    .eq('id', contentId);
  
  if (error) throw new Error(error.message);
  
  revalidatePath('/admin/content');
  return { success: true };
}

export async function getEconomyParticipation(contentId: string) {
  const { data, error } = await supabaseAdmin
    .from('economy_participation')
    .select('*')
    .eq('economy_content_id', contentId)
    .order('rank', { ascending: true });
  
  if (error) throw new Error(error.message);
  return data || [];
}

// ============================================
// Activity Logs
// ============================================

export async function getRecentActivities(limit: number = 50) {
  const { data, error } = await supabaseAdmin
    .from('activity_logs')
    .select(`
      *,
      devices(device_id, model),
      nodes(node_id, name)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) throw new Error(error.message);
  return data || [];
}

// ============================================
// Member Management (소유자 전용)
// ============================================

export async function getMembers() {
  await requirePermission('view', 'members');
  
  const { data, error } = await supabaseAdmin
    .from('user_memberships')
    .select(`
      *,
      users:user_id (
        email
      )
    `)
    .order('created_at', { ascending: false });
  
  if (error) throw new Error(error.message);
  return data || [];
}

export async function updateMemberTier(userId: string, newTier: MembershipTier) {
  const auth = await requirePermission('edit', 'members');
  
  // 소유자만 회원 등급 변경 가능
  if (!auth.permissions.isOwner) {
    throw new Error('소유자만 회원 등급을 변경할 수 있습니다');
  }
  
  const validTiers: MembershipTier[] = ['associate', 'regular', 'special'];
  if (!validTiers.includes(newTier)) {
    throw new Error('유효하지 않은 회원 등급입니다');
  }
  
  const { error } = await supabaseAdmin
    .from('user_memberships')
    .update({
      tier: newTier,
      updated_at: new Date().toISOString(),
      updated_by: auth.permissions.userId,
    })
    .eq('user_id', userId);
  
  if (error) throw new Error(error.message);
  
  revalidatePath('/admin/members');
  return { success: true };
}

export async function getAdminUsers() {
  await requirePermission('view', 'members');
  
  const { data, error } = await supabaseAdmin
    .from('admin_users')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw new Error(error.message);
  return data || [];
}

export async function updateAdminRole(userId: string, newRole: AdminRole) {
  const auth = await requirePermission('edit', 'members');
  
  // 소유자만 관리자 역할 변경 가능
  if (!auth.permissions.isOwner) {
    throw new Error('소유자만 관리자 역할을 변경할 수 있습니다');
  }
  
  // 본인의 역할은 변경할 수 없음
  if (userId === auth.permissions.userId) {
    throw new Error('본인의 역할은 변경할 수 없습니다');
  }
  
  const validRoles: AdminRole[] = ['pending', 'viewer', 'admin', 'owner'];
  if (!validRoles.includes(newRole)) {
    throw new Error('유효하지 않은 관리자 역할입니다');
  }
  
  const { error } = await supabaseAdmin
    .from('admin_users')
    .update({
      role: newRole,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
  
  if (error) throw new Error(error.message);
  
  revalidatePath('/admin/members');
  return { success: true };
}
