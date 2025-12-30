'use client';

import { motion } from 'framer-motion';
import { GlowCard } from '@/components/common/GlowCard';
import { AnimatedNumber } from '@/components/common/AnimatedNumber';
import { useActivities } from '@/hooks/useActivities';

// 디지털 시민의 6가지 활동
const citizenActivities = [
  {
    id: 'watch',
    title: '시청 (WATCH)',
    icon: '👁️',
    color: 'cyan' as const,
    description: '콘텐츠를 시청하고 관심을 표현합니다. 시청 시간에 따라 존재감이 강화됩니다.',
    rewards: '+5 Attention Points',
    features: ['Beta 분포 시청 패턴', '휴먼라이크 시청 시간', '자연스러운 이탈/재시청'],
  },
  {
    id: 'like',
    title: '공감 (LIKE)',
    icon: '❤️',
    color: 'pink' as const,
    description: '좋아요를 통해 감정을 표현합니다. 진정한 공감은 존재의 증거입니다.',
    rewards: '+10 Attention Points',
    features: ['페르소나 기반 취향', '시청 후 반응 확률', '감정적 연결 형성'],
  },
  {
    id: 'comment',
    title: '발언 (COMMENT)',
    icon: '💬',
    color: 'purple' as const,
    description: '댓글로 자신의 생각을 표현합니다. 발언은 가장 강력한 존재 증명입니다.',
    rewards: '+50 Attention Points',
    features: ['Typo Engine 탑재', 'Thinking Time 시뮬레이션', '페르소나별 어투'],
  },
  {
    id: 'discover',
    title: '발견 (DISCOVER)',
    icon: '🔍',
    color: 'yellow' as const,
    description: '남들이 찾지 못한 콘텐츠를 발견합니다. 유니크한 발견은 특별 보상을 받습니다.',
    rewards: '+100 Points + Priority +1',
    features: ['Long-tail 탐색', '숨겨진 보석 발굴', '선구안적 시청'],
  },
  {
    id: 'viral',
    title: '확산 (VIRAL)',
    icon: '🚀',
    color: 'orange' as const,
    description: '바이럴 콘텐츠의 초기 발견자가 됩니다. 트렌드를 선도하는 시민에게 최고 보상.',
    rewards: '+200 Points + Priority +2',
    features: ['바이럴 조기 탐지', '트렌드 선도', '영향력 확대'],
  },
  {
    id: 'connect',
    title: '연결 (CONNECT)',
    icon: '🔗',
    color: 'emerald' as const,
    description: 'Pop 채널에서 다른 시민들과 연결됩니다. 연결은 고립을 막는 생명선입니다.',
    rewards: 'Visibility Score +',
    features: ['공동 시청 경험', '집단적 반응', '사회적 존재 증명'],
  },
];

export function ActivitiesSection() {
  const { data: activities = [] } = useActivities();

  return (
    <section className="relative py-24 px-6 bg-[#080810]">
      <div className="max-w-7xl mx-auto">
        {/* 섹션 헤더 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2
            className="text-3xl md:text-5xl font-bold mb-4"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <span className="text-white">시민의 </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">활동</span>
          </h2>
          <p className="text-[#a0a0b0] text-lg max-w-2xl mx-auto">
            디지털 시민이 존재를 증명하는 6가지 방법
          </p>
          <p className="text-[#606070] text-sm mt-2 italic">
            "호출되지 않으면 존재하지 않는다. 그러나 활동하면 살아남는다."
          </p>
        </motion.div>

        {/* 활동 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {citizenActivities.map((activity, index) => {
            const dbActivity = activities.find(a => a.id === activity.id);
            
            return (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <GlowCard glowColor={activity.color} className="h-full">
                  <div className="flex items-start gap-4">
                    <div className="text-4xl">{activity.icon}</div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold mb-1 text-white" style={{ fontFamily: 'var(--font-display)' }}>
                        {activity.title}
                      </h3>
                      <p className="text-sm text-[#a0a0b0] mb-3">
                        {activity.description}
                      </p>
                      
                      {/* 보상 */}
                      <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs mb-3">
                        {activity.rewards}
                      </div>
                      
                      {/* 특징 */}
                      <ul className="space-y-1">
                        {activity.features.map((feature, i) => (
                          <li key={i} className="text-xs text-[#707080] flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-emerald-400" />
                            {feature}
                          </li>
                        ))}
                      </ul>

                      {/* 통계 */}
                      <div className="flex items-center gap-4 pt-3 mt-3 border-t border-[#1f1f2e]">
                        <div className="text-center">
                          <div className="text-lg font-bold text-emerald-400">
                            <AnimatedNumber value={dbActivity?.activeDevices ?? 0} />
                          </div>
                          <div className="text-[10px] text-[#606070] uppercase">Citizens</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-amber-400">
                            <AnimatedNumber value={dbActivity?.itemsProcessedToday ?? 0} format="compact" />
                          </div>
                          <div className="text-[10px] text-[#606070] uppercase">Today</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </GlowCard>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
