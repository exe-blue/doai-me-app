'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { AnimatedNumber } from '@/components/common/AnimatedNumber';
import {
  Smartphone,
  CheckCircle,
  Moon,
  AlertTriangle,
  RefreshCw,
  Filter,
  Eye,
  Play
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DevicesPage() {
  const [selectedPhoneboard, setSelectedPhoneboard] = useState<number | null>(null);

  // Empty stats - will be populated from database
  const stats = {
    totalDevices: 0,
    activeDevices: 0,
    idleDevices: 0,
    errorDevices: 0,
  };

  // 30 phoneboards × 20 devices = 600 total
  const phoneboards = Array.from({ length: 30 }, (_, i) => ({
    id: i + 1,
    activeCount: 0,
    idleCount: 0,
    errorCount: 0,
  }));

  const selectedBoard = selectedPhoneboard ? phoneboards[selectedPhoneboard - 1] : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Citizens</h1>
          <p className="text-[#a0a0b0] mt-2">30 Rooms × 20 Citizens = 600명의 디지털 시민</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="btn-secondary">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Button variant="outline" size="sm" className="btn-secondary">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick Access: Control Demo */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <Play className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-white">실시간 제어 (The Synapse)</h3>
              <p className="text-xs text-[#808090]">시민의 눈을 통해 세상을 보세요</p>
            </div>
          </div>
          <Link href="/control/demo-device-001">
            <Button className="bg-emerald-600 hover:bg-emerald-500 text-white">
              <Eye className="w-4 h-4 mr-2" />
              Demo 시작
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Smartphone className="w-6 h-6" />}
          label="Citizens"
          value={stats.totalDevices}
          color="purple"
        />
        <StatCard
          icon={<CheckCircle className="w-6 h-6" />}
          label="ACTIVE"
          value={stats.activeDevices}
          color="green"
        />
        <StatCard
          icon={<Moon className="w-6 h-6" />}
          label="WAITING"
          value={stats.idleDevices}
          color="yellow"
        />
        <StatCard
          icon={<AlertTriangle className="w-6 h-6" />}
          label="FADING"
          value={stats.errorDevices}
          color="red"
        />
      </div>

      {/* Phoneboard Grid */}
      <div className="card-minimal p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Phoneboard Grid</h2>
          <p className="text-sm text-[#606070]">
            {selectedBoard ? `Board #${selectedBoard.id}` : 'Select a phoneboard to view details'}
          </p>
        </div>

        <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
          {phoneboards.map((board) => (
            <motion.button
              key={board.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedPhoneboard(board.id)}
              className={`
                aspect-square rounded-lg border transition-all duration-200
                ${selectedPhoneboard === board.id
                  ? 'border-purple-500 bg-purple-600/20'
                  : 'border-[#1f1f2e] bg-[#12121a] hover:border-[#2f2f42]'
                }
              `}
            >
              <div className="flex flex-col items-center justify-center h-full">
                <span className="text-xs font-medium text-white">{board.id}</span>
                <div className="flex gap-0.5 mt-1">
                  {board.activeCount > 0 && (
                    <div className="w-1 h-1 rounded-full bg-green-400" />
                  )}
                  {board.idleCount > 0 && (
                    <div className="w-1 h-1 rounded-full bg-yellow-400" />
                  )}
                  {board.errorCount > 0 && (
                    <div className="w-1 h-1 rounded-full bg-red-400" />
                  )}
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Selected Board Details */}
      {selectedBoard && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-minimal p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">
              Phoneboard #{selectedBoard.id} - Device Grid (20 devices)
            </h2>
            <button
              type="button"
              onClick={() => setSelectedPhoneboard(null)}
              className="text-sm text-[#a0a0b0] hover:text-white transition-colors"
            >
              Close ×
            </button>
          </div>

          <div className="grid grid-cols-4 gap-3 md:grid-cols-5 lg:grid-cols-10">
            {Array.from({ length: 20 }, (_, i) => {
              const deviceId = `device-${selectedBoard.id}-${i + 1}`;
              return (
                <Link
                  key={i}
                  href={`/control/${deviceId}`}
                  className="group"
                >
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="aspect-[9/16] rounded-lg bg-[#1a1a24] border border-[#1f1f2e] hover:border-emerald-500/50 transition-all duration-200 cursor-pointer overflow-hidden relative"
                  >
                    {/* 디바이스 번호 */}
                    <div className="absolute top-2 left-2 text-[10px] text-white/40 font-mono">
                      #{i + 1}
                    </div>
                    
                    {/* 상태 표시 */}
                    <div className="absolute top-2 right-2">
                      <div className="w-2 h-2 rounded-full bg-gray-500/50" />
                    </div>
                    
                    {/* 호버 오버레이 */}
                    <div className="absolute inset-0 bg-emerald-500/0 group-hover:bg-emerald-500/10 transition-colors flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Eye className="w-6 h-6 text-emerald-400" />
                      </div>
                    </div>
                    
                    {/* 하단 정보 */}
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/50 to-transparent">
                      <p className="text-[9px] text-white/60 truncate">
                        Citizen #{(selectedBoard.id - 1) * 20 + i + 1}
                      </p>
                    </div>
                  </motion.div>
                </Link>
              );
            })}
          </div>

          <div className="mt-6 p-4 bg-[#1a1a24] rounded-lg border border-[#1f1f2e]">
            <p className="text-sm text-[#a0a0b0] text-center">
              디바이스 데이터가 없습니다. 데이터베이스에 연결하여 실시간 상태를 확인하세요.
            </p>
          </div>
        </motion.div>
      )}
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