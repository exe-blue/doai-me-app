'use client';

export const dynamic = 'force-dynamic';

import { motion } from 'framer-motion';
import { GlowCard } from '@/components/common/GlowCard';
import { mockNotifications } from '@/data/mock';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { 
  Bell,
  Check,
  Trash2,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle
} from 'lucide-react';

const typeConfig = {
  alert: { icon: AlertTriangle, color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
  info: { icon: Info, color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  warning: { icon: AlertTriangle, color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' },
  error: { icon: XCircle, color: 'text-red-400 bg-red-500/10 border-red-500/30' },
  success: { icon: CheckCircle, color: 'text-green-400 bg-green-500/10 border-green-500/30' },
};

export default function NotificationsPage() {
  const unreadCount = mockNotifications.filter(n => !n.isRead).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
            <Bell className="w-8 h-8 text-cyan-400" />
            알림
          </h1>
          <p className="text-muted-foreground">시스템 알림 및 이벤트</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            disabled
            aria-label="모두 읽음 처리 (현재 비활성화)"
            onClick={() => {/* TODO: implement markAllRead */}}
          >
            <Check className="w-4 h-4 mr-2" />
            모두 읽음
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            disabled
            aria-label="선택된 알림 삭제 (현재 비활성화)"
            onClick={() => {/* TODO: implement deleteSelected */}}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            삭제
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlowCard glowColor="cyan" className="!p-4">
          <div className="text-2xl font-bold text-cyan-400">{mockNotifications.length}</div>
          <div className="text-xs text-muted-foreground">Total</div>
        </GlowCard>
        <GlowCard glowColor="pink" className="!p-4">
          <div className="text-2xl font-bold text-pink-400">{unreadCount}</div>
          <div className="text-xs text-muted-foreground">Unread</div>
        </GlowCard>
        <GlowCard glowColor="green" className="!p-4">
          <div className="text-2xl font-bold text-green-400">
            {mockNotifications.filter(n => n.type === 'success').length}
          </div>
          <div className="text-xs text-muted-foreground">Success</div>
        </GlowCard>
        <GlowCard glowColor="yellow" className="!p-4">
          <div className="text-2xl font-bold text-yellow-400">
            {mockNotifications.filter(n => n.type === 'warning' || n.type === 'error').length}
          </div>
          <div className="text-xs text-muted-foreground">Alerts</div>
        </GlowCard>
      </div>

      {/* Notifications List */}
      <GlowCard glowColor="cyan" hover={false}>
        <ScrollArea className="h-[600px]">
          <div className="space-y-3">
            {mockNotifications.map((notification, i) => {
              const config = typeConfig[notification.type];
              const Icon = config.icon;
              
              return (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`p-4 rounded-lg border ${config.color} ${
                    !notification.isRead ? 'ring-1 ring-primary/30' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <Icon className="w-5 h-5 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{notification.title}</span>
                        {!notification.isRead && (
                          <Badge variant="default" className="text-[10px]">NEW</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{notification.message}</p>
                      <div className="text-xs text-muted-foreground mt-2">
                        {formatDistanceToNow(new Date(notification.createdAt), { 
                          addSuffix: true,
                          locale: ko 
                        })}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon">
                      <Check className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </ScrollArea>
      </GlowCard>
    </div>
  );
}