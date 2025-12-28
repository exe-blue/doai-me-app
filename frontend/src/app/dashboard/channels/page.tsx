'use client';

export const dynamic = 'force-dynamic';

import { motion } from 'framer-motion';
import { AnimatedNumber } from '@/components/common/AnimatedNumber';
import {
  Video,
  TrendingUp,
  Users,
  Eye,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ChannelsPage() {
  // Empty channel list - will be populated from database
  const channels: any[] = [];

  const stats = {
    totalChannels: 0,
    totalSubscribers: 0,
    totalViews: 0,
    avgGrowth: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Channels</h1>
          <p className="text-[#a0a0b0] mt-2">YouTube 채널 관리 및 성장 추적</p>
        </div>
        <Button className="btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          Add Channel
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Video className="w-6 h-6" />}
          label="Total Channels"
          value={stats.totalChannels}
        />
        <StatCard
          icon={<Users className="w-6 h-6" />}
          label="Subscribers"
          value={stats.totalSubscribers}
        />
        <StatCard
          icon={<Eye className="w-6 h-6" />}
          label="Total Views"
          value={stats.totalViews}
        />
        <StatCard
          icon={<TrendingUp className="w-6 h-6" />}
          label="Avg Growth"
          value={stats.avgGrowth}
          suffix="%"
        />
      </div>

      {/* Channels List or Empty State */}
      {channels.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-minimal p-12 text-center"
        >
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-600/10 flex items-center justify-center">
              <Video className="w-8 h-8 text-purple-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">채널이 없습니다</h3>
            <p className="text-[#a0a0b0] mb-6">
              YouTube 채널을 추가하여 성장을 추적하고 관리하세요.
            </p>
            <Button className="btn-primary">
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Channel
            </Button>
          </div>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {channels.map((channel, i) => (
            <motion.div
              key={channel.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="card-minimal p-6 hover:border-purple-500/30 cursor-pointer transition-all duration-200"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-600/20 to-indigo-600/20 flex items-center justify-center">
                  <Video className="w-6 h-6 text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white truncate">{channel.name}</h3>
                  <p className="text-sm text-[#606070]">{channel.category}</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#a0a0b0]">Subscribers</span>
                  <span className="text-white font-medium">{channel.subscribers}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#a0a0b0]">Growth</span>
                  <span className="text-green-400 font-medium">+{channel.growth}%</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  suffix,
}: Readonly<{
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix?: string;
}>) {
  return (
    <div className="card-minimal p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="text-purple-400">{icon}</div>
        <span className="text-sm font-medium text-[#a0a0b0]">{label}</span>
      </div>
      <div className="text-3xl font-bold text-white">
        <AnimatedNumber value={value} duration={1000} />
        {suffix && <span className="text-xl ml-1">{suffix}</span>}
      </div>
    </div>
  );
}
