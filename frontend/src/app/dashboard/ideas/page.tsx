'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { GlowCard } from '@/components/common/GlowCard';
import { AnimatedNumber } from '@/components/common/AnimatedNumber';
import { mockRemixIdeas, mockTrendingShorts } from '@/data/mock';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Lightbulb,
  TrendingUp,
  Music,
  Hash,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  ExternalLink,
  Play
} from 'lucide-react';

const statusColors = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  approved: 'bg-green-500/20 text-green-400 border-green-500/30',
  in_production: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  published: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const directionLabels = {
  parody: '패러디',
  mashup: '매시업',
  localization: '현지화',
  twist: '트위스트',
};

export default function IdeasPage() {
  const [selectedIdea, setSelectedIdea] = useState(mockRemixIdeas[0]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
            <Lightbulb className="w-8 h-8 text-yellow-400" />
            리믹스 아이디어
          </h1>
          <p className="text-muted-foreground">AI가 생성한 콘텐츠 리믹스 아이디어</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-cyan-400 border-cyan-500/30">
            <AnimatedNumber value={mockRemixIdeas.length} /> Ideas Today
          </Badge>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlowCard glowColor="yellow" className="!p-4">
          <div className="text-2xl font-bold text-yellow-400">
            <AnimatedNumber value={mockRemixIdeas.filter(i => i.status === 'pending').length} />
          </div>
          <div className="text-xs text-muted-foreground">Pending Review</div>
        </GlowCard>
        <GlowCard glowColor="green" className="!p-4">
          <div className="text-2xl font-bold text-green-400">
            <AnimatedNumber value={mockRemixIdeas.filter(i => i.status === 'approved').length} />
          </div>
          <div className="text-xs text-muted-foreground">Approved</div>
        </GlowCard>
        <GlowCard glowColor="cyan" className="!p-4">
          <div className="text-2xl font-bold text-cyan-400">
            <AnimatedNumber value={mockRemixIdeas.filter(i => i.status === 'in_production').length} />
          </div>
          <div className="text-xs text-muted-foreground">In Production</div>
        </GlowCard>
        <GlowCard glowColor="purple" className="!p-4">
          <div className="text-2xl font-bold text-purple-400">
            <AnimatedNumber value={mockRemixIdeas.filter(i => i.status === 'published').length} />
          </div>
          <div className="text-xs text-muted-foreground">Published</div>
        </GlowCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ideas List */}
        <div className="lg:col-span-1">
          <GlowCard glowColor="yellow" hover={false}>
            <h2 className="text-lg font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              Generated Ideas
            </h2>
            <ScrollArea className="h-[500px]">
              <div className="space-y-3 pr-4">
                {mockRemixIdeas.map((idea, i) => (
                  <motion.div
                    key={idea.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className={`p-3 rounded-lg cursor-pointer transition-all ${
                      selectedIdea.id === idea.id 
                        ? 'bg-primary/10 border border-primary/30' 
                        : 'bg-background/50 hover:bg-background/70'
                    }`}
                    onClick={() => setSelectedIdea(idea)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <Badge className={statusColors[idea.status]} variant="outline">
                        {idea.status}
                      </Badge>
                      <Badge variant="outline">{directionLabels[idea.remixDirection]}</Badge>
                    </div>
                    <h3 className="font-medium text-sm mb-1 line-clamp-2">{idea.title}</h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Sparkles className="w-3 h-3 text-yellow-400" />
                      <span>{(idea.estimatedViralProbability * 100).toFixed(0)}% viral</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          </GlowCard>
        </div>

        {/* Idea Detail */}
        <div className="lg:col-span-2">
          <motion.div
            key={selectedIdea.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <GlowCard glowColor="cyan" hover={false}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <Badge className={statusColors[selectedIdea.status]} variant="outline">
                    {selectedIdea.status}
                  </Badge>
                  <h2 className="text-xl font-bold mt-2" style={{ fontFamily: 'var(--font-display)' }}>
                    {selectedIdea.title}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <ThumbsDown className="w-4 h-4 mr-1" />
                    Reject
                  </Button>
                  <Button size="sm" className="bg-green-500 hover:bg-green-600">
                    <ThumbsUp className="w-4 h-4 mr-1" />
                    Approve
                  </Button>
                </div>
              </div>

              {/* Viral Score */}
              <div className="p-4 rounded-lg bg-background/50 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">예상 바이럴 확률</span>
                  <span className="text-xl font-bold text-yellow-400">
                    {(selectedIdea.estimatedViralProbability * 100).toFixed(0)}%
                  </span>
                </div>
                <Progress value={selectedIdea.estimatedViralProbability * 100} className="h-3" />
              </div>

              {/* Details */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">콘셉트</h3>
                  <p className="text-sm">{selectedIdea.conceptDescription}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">차별화 포인트</h3>
                  <p className="text-sm">{selectedIdea.differentiationPoint}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">리믹스 방향</h3>
                    <Badge variant="outline">{directionLabels[selectedIdea.remixDirection]}</Badge>
                  </div>
                  {selectedIdea.recommendedMusic && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">추천 음악</h3>
                      <div className="flex items-center gap-1 text-sm">
                        <Music className="w-4 h-4 text-pink-400" />
                        {selectedIdea.recommendedMusic}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Source Shorts */}
              <div className="mt-6 pt-4 border-t border-border/50">
                <h3 className="text-sm font-medium mb-3">소스 Shorts</h3>
                <div className="space-y-2">
                  {selectedIdea.sourceShorts.map((shorts, i) => (
                    <div key={i} className="p-3 rounded-lg bg-background/50 flex items-center gap-3">
                      <div className="w-16 h-9 bg-gradient-to-br from-pink-500/20 to-purple-500/20 rounded flex items-center justify-center">
                        <Play className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{shorts.title}</div>
                        <div className="text-xs text-muted-foreground">{shorts.channelName}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold">
                          {(shorts.viewCount / 1000000).toFixed(1)}M
                        </div>
                        <div className="text-xs text-muted-foreground">views</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </GlowCard>
          </motion.div>
        </div>
      </div>

      {/* Trending Shorts */}
      <GlowCard glowColor="pink" hover={false}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
            <TrendingUp className="w-5 h-5 text-pink-400" />
            Trending Shorts
          </h2>
          <Badge variant="secondary">{mockTrendingShorts.length} detected</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {mockTrendingShorts.map((shorts, i) => (
            <motion.div
              key={shorts.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="p-4 rounded-lg bg-background/50 border border-border/50"
            >
              <div className="flex items-start justify-between mb-2">
                <Badge variant="outline" className="text-cyan-400">
                  {(shorts.viralScore * 100).toFixed(0)}% viral
                </Badge>
                <Eye className="w-4 h-4 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-sm mb-1 line-clamp-2">{shorts.title}</h3>
              <div className="text-xs text-muted-foreground mb-2">{shorts.channelName}</div>
              <div className="flex items-center gap-2 text-xs mb-2">
                <span className="font-bold">{(shorts.viewCount / 1000000).toFixed(1)}M views</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {shorts.hashtags.slice(0, 3).map((tag, j) => (
                  <Badge key={j} variant="secondary" className="text-[10px]">
                    {tag}
                  </Badge>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </GlowCard>
    </div>
  );
}
