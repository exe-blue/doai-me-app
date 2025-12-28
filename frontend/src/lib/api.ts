/**
 * AIFarm Backend API Client
 * Connects to FastAPI backend on Vultr server (158.247.210.152:8000)
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://158.247.210.152:8000";

class APIClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (\!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  // ==================== Health & Stats ====================

  async healthCheck() {
    return this.request('/health');
  }

  async getStats() {
    return this.request('/api/stats');
  }

  async getTodayStats() {
    return this.request('/api/stats/today');
  }

  async getDashboard() {
    return this.request('/dashboard');
  }

  async getDailyStats() {
    return this.request('/stats/daily');
  }

  // ==================== Devices ====================

  async getDevices(params?: { status?: string; phoneboard_id?: number; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.phoneboard_id) query.append('phoneboard_id', params.phoneboard_id.toString());
    if (params?.limit) query.append('limit', params.limit.toString());

    const queryString = query.toString();
    return this.request('/api/devices' + (queryString ? '?' + queryString : ''));
  }

  async getDevice(deviceId: number) {
    return this.request('/api/devices/' + deviceId);
  }

  async updateDeviceStatus(deviceId: number, status: string) {
    return this.request('/api/devices/' + deviceId + '/status', {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  async sendDeviceCommand(deviceId: number, command: string, params?: Record<string, unknown>) {
    return this.request('/api/devices/' + deviceId + '/command', {
      method: 'POST',
      body: JSON.stringify({ command, params }),
    });
  }

  async deviceHeartbeat(deviceIds: number[]) {
    return this.request('/api/devices/heartbeat', {
      method: 'POST',
      body: JSON.stringify({ device_ids: deviceIds }),
    });
  }

  // ==================== Activities (BE Agents) ====================

  async getActivities() {
    return this.request('/api/activities');
  }

  async getActivity(activityId: string) {
    return this.request('/api/activities/' + activityId);
  }

  async updateActivity(activityId: string, data: { allocated_devices?: number; status?: string }) {
    return this.request('/api/activities/' + activityId, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async assignDevicesToActivity(activityId: string, deviceIds: number[]) {
    return this.request('/api/activities/' + activityId + '/assign', {
      method: 'POST',
      body: JSON.stringify({ device_ids: deviceIds }),
    });
  }

  async startActivity(activityId: string) {
    return this.request('/api/activities/' + activityId + '/start', {
      method: 'POST',
    });
  }

  // ==================== Channels ====================

  async getChannels() {
    return this.request('/api/channels');
  }

  async getChannel(channelId: string) {
    return this.request('/api/channels/' + channelId);
  }

  async updateChannel(channelId: string, data: { stats?: Record<string, number>; experience_points?: number }) {
    return this.request('/api/channels/' + channelId, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // ==================== Trending ====================

  async getTrending(limit = 20) {
    return this.request('/api/trending?limit=' + limit);
  }

  // ==================== DO Requests ====================

  async getDORequests(params?: { status?: string; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.limit) query.append('limit', params.limit.toString());

    const queryString = query.toString();
    return this.request('/api/do-requests' + (queryString ? '?' + queryString : ''));
  }

  async createDORequest(data: {
    title: string;
    keyword: string;
    video_title?: string;
    agent_start?: number;
    agent_end?: number;
    like_probability?: number;
    comment_probability?: number;
    subscribe_probability?: number;
    execute_immediately?: boolean;
    priority?: number;
    memo?: string;
  }) {
    return this.request('/api/do-requests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDORequest(requestId: string, status: string) {
    return this.request('/api/do-requests/' + requestId, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  async updateDORequestStatus(requestId: string, status: string) {
    return this.request('/api/do-requests/' + requestId + '/status', {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  async getUnifiedLogs(params?: { source?: string; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.source) query.append('source', params.source);
    if (params?.limit) query.append('limit', params.limit.toString());

    const queryString = query.toString();
    return this.request('/api/logs' + (queryString ? '?' + queryString : ''));
  }

  // ==================== Battle Log ====================

  async getBattleLog(limit = 50) {
    return this.request('/api/battle-log?limit=' + limit);
  }

  async createBattleLog(data: {
    event_type: string;
    description: string;
    our_channel_id?: string;
    our_channel_name?: string;
    impact_score?: number;
  }) {
    return this.request('/api/battle-log', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ==================== Notifications ====================

  async getNotifications(unreadOnly = false) {
    return this.request('/api/notifications' + (unreadOnly ? '?unread=true' : ''));
  }

  async markNotificationRead(notificationId: string) {
    return this.request('/api/notifications/' + notificationId + '/read', {
      method: 'PUT',
    });
  }

  // ==================== Ideas (Remix) ====================

  async getIdeas(params?: { limit?: number }) {
    const query = new URLSearchParams();
    if (params?.limit) query.append('limit', params.limit.toString());

    const queryString = query.toString();
    return this.request('/api/ideas' + (queryString ? '?' + queryString : ''));
  }

  async updateIdeaStatus(ideaId: string, status: string) {
    return this.request('/api/ideas/' + ideaId, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }
}

export const api = new APIClient(API_BASE_URL);
