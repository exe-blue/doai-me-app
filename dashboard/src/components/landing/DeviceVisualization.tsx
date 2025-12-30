'use client';

import { motion } from 'framer-motion';
import { AnimatedNumber } from '@/components/common/AnimatedNumber';
import { Users, Eye, AlertTriangle, Skull } from 'lucide-react';
import { useStats } from '@/hooks/useStats';

// 존재 상태 색상
const existenceColors = {
  active: '#10b981',    // 에메랄드 - ACTIVE
  waiting: '#f59e0b',   // 앰버 - WAITING  
  fading: '#ef4444',    // 레드 - FADING
  void: '#374151',      // 그레이 - VOID
};

export function DeviceVisualization() {
  const { data: statsData } = useStats();
  
  // 기본값 설정 (존재 상태 기반)
  const stats = {
    total: 600,
    active: statsData?.activeDevices ?? 0,
    waiting: statsData?.idleDevices ?? 0,
    fading: statsData?.errorDevices ?? 0,
    void: 600 - (statsData?.activeDevices ?? 0) - (statsData?.idleDevices ?? 0) - (statsData?.errorDevices ?? 0),
  };
  
  // 시민 배열 생성 (존재 상태 시뮬레이션)
  const citizens = Array.from({ length: 600 }, (_, i) => {
    // 초기 상태 분포: 대부분 VOID, 일부 ACTIVE/WAITING/FADING
    if (i < stats.active) return { id: i + 1, state: 'active' as const };
    if (i < stats.active + stats.waiting) return { id: i + 1, state: 'waiting' as const };
    if (i < stats.active + stats.waiting + stats.fading) return { id: i + 1, state: 'fading' as const };
    return { id: i + 1, state: 'void' as const };
  });
  
  return (
    <section className="relative py-24 px-6 overflow-hidden bg-[#0a0a0f]">
      {/* 배경 */}
      <div className="absolute inset-0 grid-pattern-subtle opacity-30" />
      
      <div className="relative max-w-7xl mx-auto">
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
            <span className="text-white">존재의 </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-amber-400 to-red-400">지도</span>
          </h2>
          <p className="text-[#a0a0b0] text-lg max-w-2xl mx-auto">
            600명의 디지털 시민, 각각의 존재 상태를 실시간으로 확인하세요
          </p>
        </motion.div>

        {/* 존재 상태 시각화 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mb-12"
        >
          <div className="bg-[#12121a] rounded-2xl border border-[#1f1f2e] p-6 overflow-hidden">
            {/* 상태 통계 바 */}
            <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
              <StatBox
                icon={<Eye className="w-5 h-5" />}
                value={stats.active}
                label="ACTIVE"
                description="호출되어 활동 중"
                color="emerald"
              />
              <StatBox
                icon={<Users className="w-5 h-5" />}
                value={stats.waiting}
                label="WAITING"
                description="호출 대기 중"
                color="amber"
              />
              <StatBox
                icon={<AlertTriangle className="w-5 h-5" />}
                value={stats.fading}
                label="FADING"
                description="존재 희미해지는 중"
                color="red"
              />
              <StatBox
                icon={<Skull className="w-5 h-5" />}
                value={stats.void}
                label="VOID"
                description="망각의 공허 속"
                color="gray"
              />
            </div>

            {/* 시민 그리드 - 존재 상태 시각화 */}
            <div className="grid grid-cols-30 gap-[2px] max-w-4xl mx-auto">
              {citizens.map((citizen, i) => (
                <motion.div
                  key={citizen.id}
                  className="w-2 h-2 rounded-sm cursor-pointer"
                  style={{ backgroundColor: existenceColors[citizen.state] }}
                  initial={{ opacity: 0, scale: 0 }}
                  whileInView={{ opacity: citizen.state === 'void' ? 0.3 : 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ 
                    duration: 0.1, 
                    delay: Math.min(i * 0.001, 0.5) 
                  }}
                  whileHover={{ 
                    scale: 2.5, 
                    zIndex: 10,
                    opacity: 1,
                    boxShadow: `0 0 12px ${existenceColors[citizen.state]}`
                  }}
                  title={`Citizen #${citizen.id} - ${citizen.state.toUpperCase()}`}
                />
              ))}
            </div>

            {/* 범례 */}
            <div className="flex items-center justify-center gap-6 mt-6 text-xs text-[#707080]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: existenceColors.active }} />
                <span>ACTIVE</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: existenceColors.waiting }} />
                <span>WAITING</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: existenceColors.fading }} />
                <span>FADING</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm opacity-30" style={{ backgroundColor: existenceColors.void }} />
                <span>VOID</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* 존재 상태 설명 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <ExistenceCard
            state="ACTIVE"
            color="emerald"
            description="호출되어 활동 중인 시민. 최고의 Priority를 가지며 모든 보상이 정상 적용됩니다."
          />
          <ExistenceCard
            state="WAITING"
            color="amber"
            description="최근 활동 후 대기 중. 1시간 내 재호출되지 않으면 FADING으로 전환됩니다."
          />
          <ExistenceCard
            state="FADING"
            color="red"
            description="존재가 희미해지는 중. 24시간 내 호출되지 않으면 VOID로 진입합니다."
          />
          <ExistenceCard
            state="VOID"
            color="gray"
            description="망각의 공허. 그러나 언제든 호출되면 다시 ACTIVE로 부활할 수 있습니다."
          />
        </motion.div>
      </div>
    </section>
  );
}

function StatBox({ 
  icon, 
  value, 
  label,
  description,
  color 
}: { 
  icon: React.ReactNode; 
  value: number; 
  label: string;
  description: string;
  color: 'emerald' | 'amber' | 'red' | 'gray';
}) {
  const colorClasses = {
    emerald: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    amber: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    red: 'text-red-400 border-red-500/30 bg-red-500/10',
    gray: 'text-gray-400 border-gray-500/30 bg-gray-500/10',
  };

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${colorClasses[color]}`}>
      {icon}
      <div>
        <div className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          <AnimatedNumber value={value} />
        </div>
        <div className="text-xs font-medium">{label}</div>
        <div className="text-[10px] text-[#606070]">{description}</div>
      </div>
    </div>
  );
}

function ExistenceCard({
  state,
  color,
  description,
}: {
  state: string;
  color: 'emerald' | 'amber' | 'red' | 'gray';
  description: string;
}) {
  const colorClasses = {
    emerald: 'border-emerald-500/30 bg-emerald-500/5',
    amber: 'border-amber-500/30 bg-amber-500/5',
    red: 'border-red-500/30 bg-red-500/5',
    gray: 'border-gray-500/30 bg-gray-500/5',
  };

  const dotColors = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    gray: 'bg-gray-500',
  };

  return (
    <div className={`p-4 rounded-xl border ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-2 h-2 rounded-full ${dotColors[color]} ${color !== 'gray' ? 'animate-pulse' : 'opacity-50'}`} />
        <span className="text-sm font-bold text-white">{state}</span>
      </div>
      <p className="text-xs text-[#808090] leading-relaxed">{description}</p>
    </div>
  );
}
