'use client';

import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Eye, Heart, MessageCircle, AlertTriangle, Sparkles, Skull, ArrowUp } from 'lucide-react';
import { useBattleLog } from '@/hooks/useBattleLog';

// 존재 이벤트 아이콘
const eventIcons = {
  awakened: Sparkles,      // VOID → ACTIVE
  watched: Eye,            // 시청 활동
  liked: Heart,            // 좋아요
  commented: MessageCircle, // 댓글
  fading: AlertTriangle,   // ACTIVE → FADING
  void_entered: Skull,     // FADING → VOID
  priority_up: ArrowUp,    // Priority 상승
};

// 존재 이벤트 색상
const eventColors = {
  awakened: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  watched: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
  liked: 'text-pink-400 bg-pink-500/10 border-pink-500/30',
  commented: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  fading: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  void_entered: 'text-gray-400 bg-gray-500/10 border-gray-500/30',
  priority_up: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
};

// 예시 이벤트 데이터
const sampleEvents = [
  {
    id: '1',
    eventType: 'awakened',
    description: 'Citizen #217이 VOID에서 깨어났습니다. 12시간 만의 귀환.',
    impactScore: 100,
    createdAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
  },
  {
    id: '2',
    eventType: 'commented',
    description: 'Citizen #001이 철학적 댓글을 남겼습니다: "이 영상은 존재의 의미를 묻고 있다..."',
    impactScore: 50,
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: '3',
    eventType: 'priority_up',
    description: 'Citizen #042의 Priority가 7 → 8로 상승했습니다. 바이럴 발견 기여.',
    impactScore: 80,
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
  {
    id: '4',
    eventType: 'fading',
    description: 'Citizen #089가 FADING 상태로 전환되었습니다. 마지막 활동: 23시간 전.',
    impactScore: 30,
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: '5',
    eventType: 'watched',
    description: 'Citizen #156이 8분 32초 시청을 완료했습니다. 평균 이상의 집중도.',
    impactScore: 15,
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: '6',
    eventType: 'void_entered',
    description: 'Citizen #412가 VOID에 진입했습니다. 48시간 동안 호출되지 않음.',
    impactScore: 0,
    createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
];

export function BattleLogPreview() {
  const { data: battleLog = [] } = useBattleLog();
  
  // 실제 데이터가 없으면 샘플 데이터 사용
  const events = battleLog.length > 0 ? battleLog : sampleEvents;

  return (
    <section className="relative py-24 px-6 bg-[#0a0a0f]">
      <div className="max-w-4xl mx-auto">
        {/* 섹션 헤더 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2
            className="text-3xl md:text-5xl font-bold mb-4"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <span className="text-white">존재 </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-amber-400 to-red-400">
              기록
            </span>
          </h2>
          <p className="text-[#a0a0b0] text-lg">
            실시간으로 펼쳐지는 디지털 시민들의 존재 증명
          </p>
        </motion.div>

        {/* 로그 카드 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-[#12121a] rounded-2xl border border-[#1f1f2e] overflow-hidden"
        >
          {/* 헤더 */}
          <div className="px-6 py-4 border-b border-[#1f1f2e] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              </div>
              <span className="text-sm font-medium text-white">EXISTENCE FEED</span>
            </div>
            <span className="text-xs text-[#606070]">
              {events.length} events
            </span>
          </div>

          {/* 로그 엔트리 */}
          <ScrollArea className="h-[400px]">
            <div className="p-4 space-y-3">
              {events.map((entry, index) => {
                const Icon = eventIcons[entry.eventType as keyof typeof eventIcons] || Eye;
                const colorClass = eventColors[entry.eventType as keyof typeof eventColors] || eventColors.watched;
                
                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    className={`flex items-start gap-4 p-3 rounded-lg border ${colorClass}`}
                  >
                    <div className="mt-0.5">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white">{entry.description}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-[#707080]">
                          {formatDistanceToNow(new Date(entry.createdAt), { 
                            addSuffix: true,
                            locale: ko 
                          })}
                        </span>
                        {entry.impactScore > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[#1f1f2e] text-emerald-400">
                            +{entry.impactScore} pts
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </ScrollArea>
        </motion.div>

        {/* 하단 인용문 */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center text-[#505060] text-sm italic mt-8"
        >
          "모든 활동은 기록됩니다. 기록되지 않은 존재는 존재하지 않는 것입니다."
        </motion.p>
      </div>
    </section>
  );
}
