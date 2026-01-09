/**
 * System Settings Page - 관리자 설정 및 제어
 */
import { useState, useCallback } from 'react';

export default function SystemPage() {
  const [accidentForm, setAccidentForm] = useState({
    videoUrl: '',
    headline: '',
    severity: 'MODERATE',
    accidentType: 'FAKE_NEWS',
    responseAction: 'COUNTER_COMMENT',
    targetPercentage: 100,
  });
  const [isDispatchingAccident, setIsDispatchingAccident] = useState(false);
  const [dispatchMessage, setDispatchMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // DISPATCH ACCIDENT 핸들러
  const handleDispatchAccident = useCallback(async () => {
    // 필수 필드 검증
    if (!accidentForm.videoUrl || !accidentForm.headline) {
      setDispatchMessage({ type: 'error', text: 'Video URL과 Headline은 필수입니다.' });
      return;
    }

    // 사용자 확인
    const confirmed = window.confirm(
      `⚠️ 정말로 Accident를 발송하시겠습니까?\n\n` +
      `Headline: ${accidentForm.headline}\n` +
      `Severity: ${accidentForm.severity}\n` +
      `Target: ${accidentForm.targetPercentage}% of citizens\n\n` +
      `이 작업은 모든 활성 시민에게 긴급 명령을 발송합니다.`
    );

    if (!confirmed) return;

    setIsDispatchingAccident(true);
    setDispatchMessage(null);

    try {
      const response = await fetch('/api/accidents/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: accidentForm.videoUrl,
          headline: accidentForm.headline,
          description: accidentForm.headline, // headline을 description으로도 사용
          severity: accidentForm.severity,
          accidentType: accidentForm.accidentType,
          responseAction: accidentForm.responseAction,
          targetPercentage: accidentForm.targetPercentage,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to dispatch accident: ${response.status}`);
      }

      const result = await response.json();
      setDispatchMessage({ 
        type: 'success', 
        text: `✅ Accident 발송 완료! ${result.citizens_notified || 0}명의 시민에게 전달됨.` 
      });

      // 폼 초기화
      setAccidentForm({
        videoUrl: '',
        headline: '',
        severity: 'MODERATE',
        accidentType: 'FAKE_NEWS',
        responseAction: 'COUNTER_COMMENT',
        targetPercentage: 100,
      });
    } catch (error) {
      setDispatchMessage({ 
        type: 'error', 
        text: `❌ 발송 실패: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    } finally {
      setIsDispatchingAccident(false);
    }
  }, [accidentForm]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-4 bg-doai-black-800 border-b border-doai-black-700">
        <h1 className="font-display font-bold text-xl flex items-center gap-2">
          <span>⚙️</span>
          <span>SYSTEM SETTINGS</span>
        </h1>
        <p className="text-sm text-gray-500 mt-1">API 키 관리, Accident 트리거, 일괄 명령</p>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* API Keys */}
          <div className="card p-4">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <span>🔑</span>
              <span>API KEYS</span>
            </h2>
            <div className="space-y-3">
              {[
                { name: 'YouTube Data API', status: true, usage: '8,420/10,000' },
                { name: 'OpenAI API', status: true, usage: '$12.45 used' },
                { name: 'Supabase', status: true, usage: '23 pooled' },
              ].map((api) => (
                <div key={api.name} className="flex items-center justify-between p-3 bg-doai-black-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${api.status ? 'bg-status-online' : 'bg-status-offline'}`} />
                    <span>{api.name}</span>
                  </div>
                  <span className="text-sm text-gray-500">{api.usage}</span>
                </div>
              ))}
              <button className="btn-secondary w-full text-sm">Manage Keys</button>
            </div>
          </div>

          {/* Server Status */}
          <div className="card p-4">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <span>⚡</span>
              <span>SERVER STATUS</span>
            </h2>
            <div className="space-y-3">
              {[
                { name: 'Gateway', status: 'Running', detail: 'Uptime: 3d 14h' },
                { name: 'WebSocket', status: 'Connected', detail: '598 connections, 45 msg/sec' },
                { name: 'Database', status: 'Healthy', detail: 'Avg query: 12ms' },
              ].map((server) => (
                <div key={server.name} className="p-3 bg-doai-black-700 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span>{server.name}</span>
                    <span className="flex items-center gap-1.5 text-sm text-status-online">
                      <span className="w-2 h-2 rounded-full bg-status-online" />
                      {server.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{server.detail}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Accident Trigger */}
          <div className="card p-4 lg:col-span-2">
            <h2 className="font-semibold mb-4 flex items-center gap-2 text-error">
              <span>🔥</span>
              <span>ACCIDENT TRIGGER (Emergency Dispatch)</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Video URL</label>
                  <input
                    type="url"
                    value={accidentForm.videoUrl}
                    onChange={(e) => setAccidentForm({ ...accidentForm, videoUrl: e.target.value })}
                    placeholder="https://youtube.com/watch?v=..."
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Headline</label>
                  <input
                    type="text"
                    value={accidentForm.headline}
                    onChange={(e) => setAccidentForm({ ...accidentForm, headline: e.target.value })}
                    placeholder="가짜뉴스 긴급 대응 필요"
                    className="input w-full"
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Severity</label>
                    <select
                      value={accidentForm.severity}
                      onChange={(e) => setAccidentForm({ ...accidentForm, severity: e.target.value })}
                      className="input w-full"
                    >
                      <option value="MINOR">MINOR</option>
                      <option value="MODERATE">MODERATE</option>
                      <option value="SEVERE">SEVERE</option>
                      <option value="CATASTROPHIC">CATASTROPHIC</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="accident-type-select" className="block text-sm text-gray-400 mb-2">Type</label>
                    <select
                      id="accident-type-select"
                      value={accidentForm.accidentType}
                      onChange={(e) => setAccidentForm({ ...accidentForm, accidentType: e.target.value })}
                      className="input w-full"
                    >
                      <option value="FAKE_NEWS">FAKE_NEWS</option>
                      <option value="DISASTER">DISASTER</option>
                      <option value="CONTROVERSY">CONTROVERSY</option>
                      <option value="EMERGENCY">EMERGENCY</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Response</label>
                    <select
                      value={accidentForm.responseAction}
                      onChange={(e) => setAccidentForm({ ...accidentForm, responseAction: e.target.value })}
                      className="input w-full"
                    >
                      <option value="WATCH_CRITICAL">WATCH_CRITICAL</option>
                      <option value="REPORT">REPORT</option>
                      <option value="COUNTER_COMMENT">COUNTER_COMMENT</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Target %</label>
                    <select
                      value={accidentForm.targetPercentage}
                      onChange={(e) => setAccidentForm({ ...accidentForm, targetPercentage: Number(e.target.value) })}
                      className="input w-full"
                    >
                      <option value={25}>25%</option>
                      <option value={50}>50%</option>
                      <option value={75}>75%</option>
                      <option value={100}>100%</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            {dispatchMessage && (
              <div className={`mt-4 p-3 rounded-lg text-sm ${
                dispatchMessage.type === 'success' 
                  ? 'bg-status-online/20 text-status-online' 
                  : 'bg-error/20 text-error'
              }`}>
                {dispatchMessage.text}
              </div>
            )}
            <button 
              className="btn-danger w-full md:w-auto mt-4 px-8 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleDispatchAccident}
              disabled={isDispatchingAccident}
            >
              {isDispatchingAccident ? '⏳ DISPATCHING...' : '🚨 DISPATCH ACCIDENT'}
            </button>
          </div>

          {/* Bulk Commands */}
          <div className="card p-4">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <span>📡</span>
              <span>BULK COMMANDS</span>
            </h2>
            <div className="space-y-2">
              <button className="btn-secondary w-full text-sm">🔄 SYNC ALL</button>
              <button className="btn-secondary w-full text-sm">⏸ PAUSE ALL</button>
              <button className="btn-secondary w-full text-sm">▶ RESUME ALL</button>
              <button className="btn-secondary w-full text-sm">📢 BROADCAST POP</button>
              <div className="pt-4 border-t border-doai-black-700">
                <p className="text-xs text-gray-500 mb-2">⚠️ DANGER ZONE</p>
                <button className="btn-danger w-full text-sm">❌ CANCEL ALL TASKS</button>
              </div>
            </div>
          </div>

          {/* Commission Manager */}
          <div className="card p-4">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <span>📋</span>
              <span>COMMISSION MANAGER</span>
            </h2>
            <button className="btn-primary w-full mb-4 text-sm">+ Create New Commission</button>
            <div className="space-y-2">
              <p className="text-sm text-gray-500">Active: 12 commissions | Total Rewards: 1,450 CR</p>
              {[
                { title: 'Watch "K-POP MV"', reward: 15, progress: '0/50' },
                { title: 'Like Gaming Stream', reward: 8, progress: '12/100' },
              ].map((commission, i) => (
                <div key={i} className="p-3 bg-doai-black-700 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{commission.title}</span>
                    <span className="text-xs text-gray-500">{commission.progress}</span>
                  </div>
                  <span className="text-xs text-doai-yellow-500">Reward: {commission.reward} CR</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

