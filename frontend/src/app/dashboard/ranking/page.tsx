'use client';

export const dynamic = 'force-dynamic';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { GlowCard } from '@/components/common/GlowCard';
import { AnimatedNumber } from '@/components/common/AnimatedNumber';
import { LevelBadge } from '@/components/common/LevelBadge';
import { mockChannels, mockCompetitors } from '@/data/mock';
import { Badge } from '@/components/ui/badge';
import { 
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  Crown,
  Medal,
  Award
} from 'lucide-react';

// Deterministic level generator based on channel id/index
function generateLevel(id: string, index: number): number {
  // Simple hash-based deterministic value
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), index);
  return 40 + (hash % 30);
}

export default function RankingPage() {
  // Memoize to prevent recalculation on every render and ensure SSR/client consistency
  const allChannels = useMemo(() => {
    return [...mockChannels, ...mockCompetitors.map((c, i) => ({
      ...c,
      level: generateLevel(c.id, i),
      isCompetitor: true,
    }))].sort((a, b) => (a.categoryRank || 999) - (b.categoryRank || 999));
  }, []);

  const categories = [...new Set(allChannels.map(c => c.category))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          랭킹 보드
        </h1>
        <p className="text-muted-foreground">카테고리별 경쟁 현황을 실시간으로 확인하세요</p>
      </div>

      {/* Global Ranking */}
      <GlowCard glowColor="yellow" hover={false}>
        <div className="flex items-center gap-2 mb-4">
          <Crown className="w-6 h-6 text-yellow-400" />
          <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            Our Channels - Global Ranking
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mockChannels.slice(0, 6).map((channel, i) => (
            <motion.div
              key={channel.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="p-4 rounded-lg bg-background/50 border border-border/50"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold ${
                  channel.globalRank <= 100 ? 'bg-yellow-500/20 text-yellow-400' :
                  channel.globalRank <= 300 ? 'bg-cyan-500/20 text-cyan-400' :
                  'bg-background text-muted-foreground'
                }`}>
                  #{channel.globalRank}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{channel.name}</div>
                  <div className="text-xs text-muted-foreground">{channel.category}</div>
                </div>
                <LevelBadge level={channel.level} size="sm" />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Category #{channel.categoryRank}
                </span>
                <span className="text-green-400 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  +{channel.weeklyGrowth}%
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </GlowCard>

      {/* Category Rankings */}
      {categories.map((category, catIndex) => {
        const categoryChannels = allChannels.filter(c => c.category === category);
        const ourChannels = categoryChannels.filter(c => !('isCompetitor' in c));
        
        return (
          <motion.div
            key={category}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: catIndex * 0.1 }}
          >
            <GlowCard 
              glowColor={catIndex % 3 === 0 ? 'cyan' : catIndex % 3 === 1 ? 'pink' : 'purple'} 
              hover={false}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">
                    {category === '게임' ? '🎮' : 
                     category === '뷰티' ? '💄' : 
                     category === 'IT/테크' ? '💻' : 
                     category === '요리' ? '🍳' : '💪'}
                  </span>
                  <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                    {category} 카테고리
                  </h2>
                </div>
                <Badge variant="outline">
                  {ourChannels.length} of ours
                </Badge>
              </div>

              <div className="space-y-2">
                {categoryChannels.slice(0, 5).map((channel, i) => {
                  const isOurs = !('isCompetitor' in channel);
                  const RankIcon = i === 0 ? Crown : i === 1 ? Medal : i === 2 ? Award : Trophy;
                  
                  return (
                    <motion.div
                      key={channel.id || i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`flex items-center gap-4 p-3 rounded-lg ${
                        isOurs 
                          ? 'bg-cyan-500/10 border border-cyan-500/30' 
                          : 'bg-background/50'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        i === 0 ? 'bg-yellow-500/20' : 
                        i === 1 ? 'bg-gray-400/20' : 
                        i === 2 ? 'bg-orange-500/20' : 
                        'bg-background'
                      }`}>
                        <RankIcon className={`w-4 h-4 ${
                          i === 0 ? 'text-yellow-400' : 
                          i === 1 ? 'text-gray-400' : 
                          i === 2 ? 'text-orange-400' : 
                          'text-muted-foreground'
                        }`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{channel.name}</span>
                          {isOurs && <Badge variant="default" className="text-[10px]">OURS</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {(channel.subscriberCount / 1000).toFixed(0)}K subscribers
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">#{channel.categoryRank || i + 1}</div>
                        <div className="text-xs text-green-400 flex items-center justify-end gap-1">
                          <TrendingUp className="w-3 h-3" />
                          +2
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </GlowCard>
          </motion.div>
        );
      })}
    </div>
  );
}