'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { GlowCard } from '@/components/common/GlowCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { 
  Settings,
  Server,
  Bell,
  Shield,
  Zap,
  Database,
  Globe,
  Key,
  RefreshCw,
  Download,
  Upload
} from 'lucide-react';

export default function SettingsPage() {
  // Controlled state for notification settings
  const [viralAlert, setViralAlert] = useState(true);
  const [rankAlert, setRankAlert] = useState(true);
  const [deviceErrorAlert, setDeviceErrorAlert] = useState(true);
  const [questCompleteAlert, setQuestCompleteAlert] = useState(true);
  
  // Controlled state for activity settings
  const [autoRotation, setAutoRotation] = useState(true);
  const [aiAutoGenerate, setAiAutoGenerate] = useState(true);
  const [personaAutoActivate, setPersonaAutoActivate] = useState(true);
  const [rateLimiting, setRateLimiting] = useState(true);
  const [accessLogging, setAccessLogging] = useState(true);
  
  // Loading states for async actions
  const [isRestarting, setIsRestarting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Handler for system restart
  const handleRestart = async () => {
    if (!confirm('시스템을 재시작하시겠습니까? 진행 중인 작업이 중단될 수 있습니다.')) {
      return;
    }
    
    setIsRestarting(true);
    try {
      // TODO: Call restart API
      // await restartSystem();
      alert('시스템 재시작 요청이 전송되었습니다.');
    } catch (error) {
      alert('시스템 재시작에 실패했습니다.');
      console.error('Restart error:', error);
    } finally {
      setIsRestarting(false);
    }
  };

  // Handler for saving settings
  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const settings = {
        notifications: { viralAlert, rankAlert, deviceErrorAlert, questCompleteAlert },
        activity: { autoRotation, aiAutoGenerate, personaAutoActivate },
        api: { rateLimiting },
        security: { accessLogging },
      };
      // TODO: Call save settings API
      // await updateSettings(settings);
      console.log('Settings to save:', settings);
      alert('설정이 저장되었습니다.');
    } catch (error) {
      alert('설정 저장에 실패했습니다.');
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
          <Settings className="w-8 h-8 text-cyan-400" />
          설정
        </h1>
        <p className="text-muted-foreground">시스템 설정 및 구성</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Server Settings */}
        <GlowCard glowColor="cyan" hover={false}>
          <div className="flex items-center gap-2 mb-4">
            <Server className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              서버 설정
            </h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
              <div>
                <div className="font-medium">서버 주소</div>
                <div className="text-sm text-muted-foreground">158.247.210.152</div>
              </div>
              <Badge variant="outline" className="text-green-400 border-green-500/30">Connected</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
              <div>
                <div className="font-medium">API 포트</div>
                <div className="text-sm text-muted-foreground">8000</div>
              </div>
              <Badge variant="outline">FastAPI</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
              <div>
                <div className="font-medium">Phoneboards</div>
                <div className="text-sm text-muted-foreground">30개 연결됨</div>
              </div>
              <Badge variant="outline" className="text-green-400 border-green-500/30">30/30</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
              <div>
                <div className="font-medium">Devices</div>
                <div className="text-sm text-muted-foreground">600대 등록됨</div>
              </div>
              <Badge variant="outline" className="text-cyan-400 border-cyan-500/30">600</Badge>
            </div>
          </div>
        </GlowCard>

        {/* Database Settings */}
        <GlowCard glowColor="purple" hover={false}>
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              데이터베이스
            </h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
              <div>
                <div className="font-medium">Supabase</div>
                <div className="text-sm text-muted-foreground">aifarm-db.supabase.co</div>
              </div>
              <Badge variant="outline" className="text-green-400 border-green-500/30">Connected</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
              <div>
                <div className="font-medium">Storage</div>
                <div className="text-sm text-muted-foreground">2.4 GB / 10 GB</div>
              </div>
              <Badge variant="outline">24%</Badge>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1">
                <Download className="w-4 h-4 mr-2" />
                백업
              </Button>
              <Button variant="outline" size="sm" className="flex-1">
                <Upload className="w-4 h-4 mr-2" />
                복원
              </Button>
            </div>
          </div>
        </GlowCard>

        {/* Notification Settings */}
        <GlowCard glowColor="yellow" hover={false}>
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-yellow-400" />
            <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              알림 설정
            </h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
              <div>
                <div className="font-medium">바이럴 히트 알림</div>
                <div className="text-sm text-muted-foreground">영상 조회수 100K 돌파 시</div>
              </div>
              <Switch checked={viralAlert} onCheckedChange={setViralAlert} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
              <div>
                <div className="font-medium">순위 변동 알림</div>
                <div className="text-sm text-muted-foreground">카테고리 순위 변동 시</div>
              </div>
              <Switch checked={rankAlert} onCheckedChange={setRankAlert} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
              <div>
                <div className="font-medium">디바이스 오류 알림</div>
                <div className="text-sm text-muted-foreground">디바이스 연결 끊김 시</div>
              </div>
              <Switch checked={deviceErrorAlert} onCheckedChange={setDeviceErrorAlert} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
              <div>
                <div className="font-medium">퀘스트 완료 알림</div>
                <div className="text-sm text-muted-foreground">일일/주간 퀘스트 완료 시</div>
              </div>
              <Switch checked={questCompleteAlert} onCheckedChange={setQuestCompleteAlert} />
            </div>
          </div>
        </GlowCard>

        {/* Activity Settings */}
        <GlowCard glowColor="pink" hover={false}>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-pink-400" />
            <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              활동 설정
            </h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
              <div>
                <div className="font-medium">자동 디바이스 로테이션</div>
                <div className="text-sm text-muted-foreground">2시간마다 활동 재배치</div>
              </div>
              <Switch checked={autoRotation} onCheckedChange={setAutoRotation} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
              <div>
                <div className="font-medium">AI 아이디어 자동 생성</div>
                <div className="text-sm text-muted-foreground">트렌드 발견 시 자동 생성</div>
              </div>
              <Switch checked={aiAutoGenerate} onCheckedChange={setAiAutoGenerate} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
              <div>
                <div className="font-medium">페르소나 자동 활성화</div>
                <div className="text-sm text-muted-foreground">피크 시간대 자동 활성화</div>
              </div>
              <Switch checked={personaAutoActivate} onCheckedChange={setPersonaAutoActivate} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
              <div>
                <div className="font-medium">헬스체크 간격</div>
                <div className="text-sm text-muted-foreground">5분마다</div>
              </div>
              <Badge variant="outline">5min</Badge>
            </div>
          </div>
        </GlowCard>

        {/* API Settings */}
        <GlowCard glowColor="green" hover={false}>
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-5 h-5 text-green-400" />
            <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              API 설정
            </h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
              <div>
                <div className="font-medium">YouTube Data API</div>
                <div className="text-sm text-muted-foreground">일일 할당량 관리</div>
              </div>
              <Badge variant="outline" className="text-green-400 border-green-500/30">45%</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
              <div>
                <div className="font-medium">OpenAI API</div>
                <div className="text-sm text-muted-foreground">GPT-4 콘텐츠 생성</div>
              </div>
              <Badge variant="outline" className="text-green-400 border-green-500/30">Active</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
              <div>
                <div className="font-medium">Rate Limiting</div>
                <div className="text-sm text-muted-foreground">요청 제한 관리</div>
              </div>
              <Switch checked={rateLimiting} onCheckedChange={setRateLimiting} />
            </div>
          </div>
        </GlowCard>

        {/* Security Settings */}
        <GlowCard glowColor="orange" hover={false}>
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-orange-400" />
            <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              보안 설정
            </h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
              <div>
                <div className="font-medium">API 키 관리</div>
                <div className="text-sm text-muted-foreground">환경 변수로 관리</div>
              </div>
              <Button variant="outline" size="sm">
                <Key className="w-4 h-4 mr-2" />
                관리
              </Button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
              <div>
                <div className="font-medium">SSL/TLS</div>
                <div className="text-sm text-muted-foreground">HTTPS 암호화</div>
              </div>
              <Badge variant="outline" className="text-green-400 border-green-500/30">Enabled</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
              <div>
                <div className="font-medium">접근 로그</div>
                <div className="text-sm text-muted-foreground">모든 요청 기록</div>
              </div>
              <Switch checked={accessLogging} onCheckedChange={setAccessLogging} />
            </div>
          </div>
        </GlowCard>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <Button 
          className="bg-cyan-500 hover:bg-cyan-600"
          onClick={handleRestart}
          disabled={isRestarting}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isRestarting ? 'animate-spin' : ''}`} />
          {isRestarting ? '재시작 중...' : '시스템 재시작'}
        </Button>
        <Button 
          variant="outline"
          onClick={handleSaveSettings}
          disabled={isSaving}
        >
          {isSaving ? '저장 중...' : '설정 저장'}
        </Button>
      </div>
    </div>
  );
}