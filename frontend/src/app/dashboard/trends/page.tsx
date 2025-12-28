'use client';

export const dynamic = 'force-dynamic';

import { motion } from 'framer-motion';
import { AnimatedNumber } from '@/components/common/AnimatedNumber';
import {
  TrendingUp,
  Target,
  Flame,
  Search,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function TrendsPage() {
  // Empty data - will be populated from database
  const stats = {
    activeTrends: 0,
    earlyStage: 0,
    peakStage: 0,
    totalEngagement: 0,
  };

  const trends: any[] = [];
  const challenges: any[] = [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Trends</h1>
          <p className="text-[#a0a0b0] mt-2">YouTube 트렌드 및 챌린지 추적</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="btn-secondary">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Button className="btn-primary">
            <Search className="w-4 h-4 mr-2" />
            Find Trends
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<TrendingUp className="w-6 h-6" />}
          label="Active Trends"
          value={stats.activeTrends}
          color="purple"
        />
        <StatCard
          icon={<Flame className="w-6 h-6" />}
          label="Early Stage"
          value={stats.earlyStage}
          color="green"
        />
        <StatCard
          icon={<Target className="w-6 h-6" />}
          label="Peak Stage"
          value={stats.peakStage}
          color="yellow"
        />
        <StatCard
          icon={<TrendingUp className="w-6 h-6" />}
          label="Engagement"
          value={stats.totalEngagement}
          color="red"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="trends" className="w-full">
        <TabsList className="bg-[#12121a] border border-[#1f1f2e]">
          <TabsTrigger
            value="trends"
            className="data-[state=active]:bg-purple-600/20 data-[state=active]:text-white"
          >
            Trends
          </TabsTrigger>
          <TabsTrigger
            value="challenges"
            className="data-[state=active]:bg-purple-600/20 data-[state=active]:text-white"
          >
            Challenges
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="mt-6">
          {trends.length === 0 ? (
            <EmptyState
              icon={<TrendingUp />}
              title="트렌드가 없습니다"
              description="AI가 발견한 트렌드가 여기에 표시됩니다."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {trends.map((trend, i) => (
                <TrendCard key={trend.id} trend={trend} index={i} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="challenges" className="mt-6">
          {challenges.length === 0 ? (
            <EmptyState
              icon={<Target />}
              title="챌린지가 없습니다"
              description="발견된 YouTube 챌린지가 여기에 표시됩니다."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {challenges.map((challenge, i) => (
                <ChallengeCard key={challenge.id} challenge={challenge} index={i} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: Readonly<{
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'purple' | 'green' | 'yellow' | 'red';
}>) {
  const colorClasses = {
    purple: 'text-purple-400',
    green: 'text-green-400',
    yellow: 'text-yellow-400',
    red: 'text-red-400',
  };

  return (
    <div className="card-minimal p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={colorClasses[color]}>{icon}</div>
        <span className="text-sm font-medium text-[#a0a0b0]">{label}</span>
      </div>
      <div className="text-3xl font-bold text-white">
        <AnimatedNumber value={value} duration={1000} />
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: Readonly<{
  icon: React.ReactNode;
  title: string;
  description: string;
}>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-minimal p-12 text-center"
    >
      <div className="max-w-md mx-auto">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-600/10 flex items-center justify-center">
          <div className="w-8 h-8 text-purple-400">{icon}</div>
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
        <p className="text-[#a0a0b0]">{description}</p>
      </div>
    </motion.div>
  );
}

function TrendCard({
  trend,
  index,
}: Readonly<{
  trend: any;
  index: number;
}>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="card-minimal p-6 hover:border-purple-500/30 cursor-pointer transition-all duration-200"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-600/20 to-indigo-600/20 flex items-center justify-center">
          <TrendingUp className="w-6 h-6 text-purple-400" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-white">{trend.title}</h3>
          <p className="text-sm text-[#606070]">{trend.category}</p>
        </div>
      </div>
    </motion.div>
  );
}

function ChallengeCard({
  challenge,
  index,
}: Readonly<{
  challenge: any;
  index: number;
}>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="card-minimal p-6 hover:border-purple-500/30 cursor-pointer transition-all duration-200"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-600/20 to-emerald-600/20 flex items-center justify-center">
          <Target className="w-6 h-6 text-green-400" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-white">{challenge.title}</h3>
          <p className="text-sm text-[#606070]">{challenge.stage}</p>
        </div>
      </div>
    </motion.div>
  );
}
