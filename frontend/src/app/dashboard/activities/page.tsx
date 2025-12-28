'use client';

export const dynamic = 'force-dynamic';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { GlowCard } from '@/components/common/GlowCard';
import { AnimatedNumber } from '@/components/common/AnimatedNumber';
import { mockActivities } from '@/data/mock';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Smartphone, 
  CheckCircle, 
  Clock,
  TrendingUp,
  Play,
  Pause,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const activityDetails: Record<string, {
  fullDescription: string;
  workflow: string[];
  outputs: string[];
}> = {
  shorts_remix: {
    fullDescription: '트렌딩 YouTube Shorts를 실시간 탐지하고, AI가 바이럴 요소를 분석하여 우리 채널에 맞는 리믹스/변형 아이디어를 자동 생성합니다.',
    workflow: [
      '트렌딩 Shorts 탭 스크롤 탐색',
      '영상 정보 추출 (제목, 조회수, 음악 등)',
      '바이럴 요소 AI 분석',
      '리믹스 아이디어 3가지 생성',
      '타겟 채널 매칭 및 저장',
    ],
    outputs: ['트렌딩 Shorts 데이터', '바이럴 스코어', '리믹스 아이디어 카드'],
  },
  playlist_curator: {
    fullDescription: 'AI가 매일 다양한 테마를 생성하고, 디바이스가 관련 영상을 탐색하여 플레이리스트를 자동으로 큐레이션합니다.',
    workflow: [
      'AI가 일일 테마 10개 생성',
      '키워드 기반 YouTube 검색',
      '영상 적합성 평가',
      '플레이리스트에 영상 추가',
      '순서 최적화 및 완성',
    ],
    outputs: ['일일 테마 리스트', '큐레이션 플레이리스트', '테마별 영상 데이터'],
  },
  persona_commenter: {
    fullDescription: '10가지 AI 페르소나가 각자의 관심사에 맞는 영상을 탐색하고, 기존 댓글에 대댓글을 달아 자연스러운 커뮤니티 인터랙션을 생성합니다.',
    workflow: [
      '페르소나별 관심 키워드 검색',
      '적합한 영상 선택 및 시청',
      '댓글 섹션에서 타겟 댓글 선정',
      'AI가 페르소나 스타일로 대댓글 생성',
      '대댓글 작성 및 보고',
    ],
    outputs: ['페르소나별 활동 로그', '작성된 대댓글', '인게이지먼트 통계'],
  },
  trend_scout: {
    fullDescription: '24시간 전 세계 YouTube를 순찰하며 떠오르기 직전인 콘텐츠와 크리에이터를 발굴하고, 경쟁사보다 먼저 트렌드를 캐치합니다.',
    workflow: [
      '순찰 구역별 디바이스 할당',
      '소규모 채널 이상 징후 탐지',
      '지역별 트렌딩 모니터링',
      '바이럴 후보 심층 분석',
      '스카우트 알림 생성',
    ],
    outputs: ['Rising Star 알림', '바이럴 후보 리스트', '트렌드 원점 발견'],
  },
  challenge_hunter: {
    fullDescription: 'YouTube에서 진행 중인 챌린지와 밈을 실시간 탐지하고, 생명주기를 분석하여 최적의 참여 타이밍과 방식을 추천합니다.',
    workflow: [
      '챌린지 해시태그 모니터링',
      '동일 음악 사용 영상 클러스터링',
      '챌린지 생명주기 분석',
      '참여 기회 점수 산정',
      '차별화 아이디어 제안',
    ],
    outputs: ['활성 챌린지 리스트', '참여 추천 카드', '생명주기 분석 리포트'],
  },
  thumbnail_lab: {
    fullDescription: '경쟁 영상들의 썸네일과 제목을 분석하여 어떤 조합이 클릭을 유발하는지 학습하고, 우리 채널 콘텐츠 최적화에 활용합니다.',
    workflow: [
      '카테고리별 인기 영상 수집',
      '썸네일 이미지 분석 (얼굴, 텍스트, 색상)',
      '제목 패턴 분석',
      'CTR 예측 모델 적용',
      '최적화 제안 생성',
    ],
    outputs: ['썸네일 트렌드 리포트', 'CTR 예측 점수', '개선 제안'],
  },
};

export default function ActivitiesPage() {
  const [selectedActivity, setSelectedActivity] = useState(mockActivities[0].id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          6대 상시 활동
        </h1>
        <p className="text-muted-foreground">600대 디바이스가 24시간 수행하는 AI 자동화 활동</p>
      </div>

      {/* Activity Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mockActivities.map((activity, i) => {
          const details = activityDetails[activity.id];
          const isSelected = selectedActivity === activity.id;
          
          return (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <GlowCard
                glowColor={
                  activity.id === 'shorts_remix' ? 'cyan' :
                  activity.id === 'playlist_curator' ? 'purple' :
                  activity.id === 'persona_commenter' ? 'pink' :
                  activity.id === 'trend_scout' ? 'yellow' :
                  activity.id === 'challenge_hunter' ? 'orange' : 'blue'
                }
                className={`cursor-pointer ${isSelected ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setSelectedActivity(activity.id)}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{activity.icon}</span>
                    <div>
                      <h3 className="font-bold">{activity.name}</h3>
                      <p className="text-xs text-muted-foreground">{activity.description}</p>
                    </div>
                  </div>
                  <Badge 
                    variant={activity.activeDevices > activity.allocatedDevices * 0.9 ? 'default' : 'secondary'}
                    className="text-[10px]"
                  >
                    Active
                  </Badge>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="text-center p-2 rounded-lg bg-background/50">
                    <div className="text-lg font-bold text-cyan-400">
                      <AnimatedNumber value={activity.activeDevices} />
                    </div>
                    <div className="text-[10px] text-muted-foreground">Devices</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-background/50">
                    <div className="text-lg font-bold text-pink-400">
                      <AnimatedNumber value={activity.itemsProcessedToday} format="compact" />
                    </div>
                    <div className="text-[10px] text-muted-foreground">Today</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-background/50">
                    <div className="text-lg font-bold text-green-400">
                      {activity.successRate}%
                    </div>
                    <div className="text-[10px] text-muted-foreground">Success</div>
                  </div>
                </div>

                {/* Progress */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Device Allocation</span>
                    <span>{activity.activeDevices}/{activity.allocatedDevices}</span>
                  </div>
                  <Progress value={(activity.activeDevices / activity.allocatedDevices) * 100} className="h-1.5" />
                </div>
              </GlowCard>
            </motion.div>
          );
        })}
      </div>

      {/* Activity Detail */}
      {selectedActivity && <ActivityDetail selectedActivity={selectedActivity} />}
    </div>
  );
}

// Separate component to handle activity detail with memoized random values
function ActivityDetail({ selectedActivity }: { selectedActivity: string }) {
  const activity = mockActivities.find(a => a.id === selectedActivity);
  const details = activityDetails[selectedActivity];
  
  // Memoize random values to prevent re-computation on every render
  const outputValues = useMemo(() => {
    if (!details) return [];
    return details.outputs.map((_, index) => Math.floor(Math.random() * 500) + 100);
  }, [selectedActivity, details]);

  // Handle case where activity is not found
  if (!activity || !details) {
    return (
      <GlowCard glowColor="cyan" hover={false}>
        <div className="text-center text-muted-foreground py-8">
          활동을 찾을 수 없습니다
        </div>
      </GlowCard>
    );
  }

  return (
    <motion.div
      key={selectedActivity}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <GlowCard glowColor="cyan" hover={false}>
        <div>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <span className="text-4xl">{activity.icon}</span>
              <div>
                <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                  {activity.name}
                </h2>
                <p className="text-sm text-muted-foreground">{details.fullDescription}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                설정
              </Button>
              <Button variant="outline" size="sm">
                <Pause className="w-4 h-4 mr-2" />
                일시정지
              </Button>
            </div>
          </div>

          <Tabs defaultValue="workflow" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="workflow">워크플로우</TabsTrigger>
              <TabsTrigger value="outputs">아웃풋</TabsTrigger>
              <TabsTrigger value="devices">디바이스</TabsTrigger>
              <TabsTrigger value="logs">로그</TabsTrigger>
            </TabsList>

            <TabsContent value="workflow">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {details.workflow.map((step, i) => (
                  <div key={i} className="relative">
                    <div className="p-4 rounded-lg bg-background/50 border border-border/50 h-full">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                          {i + 1}
                        </div>
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      </div>
                      <p className="text-sm">{step}</p>
                    </div>
                    {i < details.workflow.length - 1 && (
                      <div className="hidden md:block absolute top-1/2 -right-2 w-4 h-0.5 bg-border" />
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="outputs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {details.outputs.map((output, i) => (
                  <div key={i} className="p-4 rounded-lg bg-background/50 border border-border/50">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-cyan-400" />
                      <span className="font-medium">{output}</span>
                    </div>
                    <div className="text-2xl font-bold text-cyan-400">
                      <AnimatedNumber value={outputValues[i]} />
                    </div>
                    <p className="text-xs text-muted-foreground">오늘 생성됨</p>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="devices">
              <div className="grid grid-cols-10 gap-1">
                {Array.from({ length: activity.allocatedDevices }, (_, i) => (
                  <div
                    key={i}
                    className={`aspect-square rounded ${
                      i < activity.activeDevices ? 'bg-green-500' : 'bg-gray-600'
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-4 mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-green-500" />
                  <span>Active ({activity.activeDevices})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-gray-600" />
                  <span>Idle ({activity.allocatedDevices - activity.activeDevices})</span>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="logs">
              <ScrollArea className="h-[300px]">
                <div className="space-y-2 font-mono text-xs">
                  {Array.from({ length: 20 }, (_, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded bg-background/50">
                      <span className="text-muted-foreground">
                        {new Date(Date.now() - i * 60000).toLocaleTimeString()}
                      </span>
                      <span className={i % 3 === 0 ? 'text-green-400' : i % 3 === 1 ? 'text-cyan-400' : 'text-yellow-400'}>
                        {i % 3 === 0 ? '[SUCCESS]' : i % 3 === 1 ? '[INFO]' : '[PROCESS]'}
                      </span>
                      <span>
                        {i % 3 === 0 ? 'Item processed successfully' : 
                         i % 3 === 1 ? 'Device heartbeat received' : 
                         'Processing new item...'}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </GlowCard>
    </motion.div>
  );
}