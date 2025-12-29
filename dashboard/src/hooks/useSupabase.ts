/**
 * Supabase 직접 연동 훅
 * React Query + Supabase 조합
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, Database } from '@/lib/supabase';

type Device = Database['public']['Tables']['devices']['Row'];
type Activity = Database['public']['Tables']['activities']['Row'];
type Channel = Database['public']['Tables']['channels']['Row'];
type TrendingShort = Database['public']['Tables']['trending_shorts']['Row'];
type DORequest = Database['public']['Tables']['do_requests']['Row'];
type BattleLog = Database['public']['Tables']['battle_logs']['Row'];
type Notification = Database['public']['Tables']['notifications']['Row'];

// ==================== Devices ====================

export function useSupabaseDevices(params?: { status?: string; phoneboard_id?: number }) {
  return useQuery({
    queryKey: ['supabase-devices', params],
    queryFn: async () => {
      let query = supabase.from('devices').select('*');
      
      if (params?.status) {
        query = query.eq('status', params.status);
      }
      if (params?.phoneboard_id) {
        query = query.eq('phoneboard_id', params.phoneboard_id);
      }
      
      const { data, error } = await query.order('id');
      if (error) throw error;
      return data as Device[];
    },
    refetchInterval: 10000,
  });
}

export function useDeviceStats() {
  return useQuery({
    queryKey: ['supabase-device-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('devices')
        .select('status');
      
      if (error) throw error;
      
      const stats = {
        total: data.length,
        active: data.filter(d => d.status === 'active').length,
        idle: data.filter(d => d.status === 'idle').length,
        error: data.filter(d => d.status === 'error').length,
      };
      
      return stats;
    },
    refetchInterval: 30000,
  });
}

// ==================== Activities ====================

export function useSupabaseActivities() {
  return useQuery({
    queryKey: ['supabase-activities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .order('allocated_devices', { ascending: false });
      
      if (error) throw error;
      return data as Activity[];
    },
    refetchInterval: 30000,
  });
}

// ==================== Channels ====================

export function useSupabaseChannels() {
  return useQuery({
    queryKey: ['supabase-channels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .order('level', { ascending: false });
      
      if (error) throw error;
      return data as Channel[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useSupabaseChannel(channelId: string) {
  return useQuery({
    queryKey: ['supabase-channel', channelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .eq('id', channelId)
        .single();
      
      if (error) throw error;
      return data as Channel;
    },
    enabled: !!channelId,
  });
}

// ==================== Trending Shorts ====================

export function useSupabaseTrending(limit = 20) {
  return useQuery({
    queryKey: ['supabase-trending', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trending_shorts')
        .select('*')
        .order('detected_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data as TrendingShort[];
    },
    refetchInterval: 60000,
  });
}

// ==================== DO Requests ====================

export function useSupabaseDORequests(params?: { status?: string; limit?: number }) {
  return useQuery({
    queryKey: ['supabase-do-requests', params],
    queryFn: async () => {
      let query = supabase
        .from('do_requests')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (params?.status) {
        query = query.eq('status', params.status);
      }
      if (params?.limit) {
        query = query.limit(params.limit);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as DORequest[];
    },
    refetchInterval: 10000,
  });
}

export function useSupabaseCreateDORequest() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (request: Database['public']['Tables']['do_requests']['Insert']) => {
      const { data, error } = await supabase
        .from('do_requests')
        .insert(request)
        .select()
        .single();
      
      if (error) throw error;
      return data as DORequest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase-do-requests'] });
    },
  });
}

export function useUpdateDORequestStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updateData: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      };
      
      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }
      
      const { data, error } = await supabase
        .from('do_requests')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as DORequest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase-do-requests'] });
    },
  });
}

// ==================== Battle Log ====================

export function useSupabaseBattleLog(limit = 50) {
  return useQuery({
    queryKey: ['supabase-battle-log', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('battle_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data as BattleLog[];
    },
    refetchInterval: 30000,
  });
}

export function useSupabaseCreateBattleLog() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (log: Database['public']['Tables']['battle_logs']['Insert']) => {
      const { data, error } = await supabase
        .from('battle_logs')
        .insert(log)
        .select()
        .single();
      
      if (error) throw error;
      return data as BattleLog;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase-battle-log'] });
    },
  });
}

// ==================== Notifications ====================

export function useSupabaseNotifications(unreadOnly = false) {
  return useQuery({
    queryKey: ['supabase-notifications', unreadOnly],
    queryFn: async () => {
      let query = supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (unreadOnly) {
        query = query.eq('is_read', false);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Notification[];
    },
    refetchInterval: 30000,
  });
}

export function useSupabaseMarkNotificationRead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase-notifications'] });
    },
  });
}

// ==================== Realtime Subscriptions ====================

export function subscribeToDevices(callback: (payload: { new: Device; old: Device }) => void) {
  return supabase
    .channel('devices-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'devices' },
      (payload) => callback(payload as unknown as { new: Device; old: Device })
    )
    .subscribe();
}

export function subscribeToDORequests(callback: (payload: { new: DORequest; old: DORequest }) => void) {
  return supabase
    .channel('do-requests-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'do_requests' },
      (payload) => callback(payload as unknown as { new: DORequest; old: DORequest })
    )
    .subscribe();
}

export function subscribeToBattleLog(callback: (payload: { new: BattleLog }) => void) {
  return supabase
    .channel('battle-log-changes')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'battle_logs' },
      (payload) => callback(payload as unknown as { new: BattleLog })
    )
    .subscribe();
}

export function subscribeToNotifications(callback: (payload: { new: Notification }) => void) {
  return supabase
    .channel('notifications-changes')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications' },
      (payload) => callback(payload as unknown as { new: Notification })
    )
    .subscribe();
}

