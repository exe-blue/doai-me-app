/**
 * ExpandableDeviceCard Component
 * 
 * 클릭하면 아래로 펼쳐지면서 화면 스트림을 보여주는 디바이스 카드
 * 
 * Features:
 * - 기본: 접힌 상태 (디바이스 기본 정보만 표시)
 * - 클릭: 아래로 확장되며 스트림 표시
 * - 가로 사이즈에 맞춰 반응형
 * 
 * @author Axon (Tech Lead)
 */

import React, { useCallback } from 'react';
import clsx from 'clsx';
import { Card, StatusDot, ExistenceBar, Badge, Button } from '@/components/atoms';
import { StreamView } from '@/components/organisms/StreamView';
import type { Device } from '@/services/api';

interface ExpandableDeviceCardProps {
  device: Device;
  isExpanded: boolean;
  onToggleExpand: (deviceId: string) => void;
  onSelect?: (deviceId: string) => void;
  className?: string;
}

export const ExpandableDeviceCard: React.FC<ExpandableDeviceCardProps> = ({
  device,
  isExpanded,
  onToggleExpand,
  onSelect,
  className,
}) => {
  const {
    serial,
    status,
    connectionType,
    model,
    aiCitizen,
    metrics,
    current_task,
    streamAvailable,
  } = device;

  const displayName = aiCitizen?.name || serial.slice(-8);
  const existenceState = aiCitizen?.existence_state || 'WAITING';
  
  const handleCardClick = useCallback(() => {
    if (status === 'ONLINE') {
      onToggleExpand(serial);
    }
  }, [serial, status, onToggleExpand]);

  const handleDetailClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect?.(serial);
  }, [serial, onSelect]);

  // 존재 상태에 따른 스타일
  const getExistenceColor = () => {
    switch (existenceState) {
      case 'ACTIVE': return 'border-green-500';
      case 'WAITING': return 'border-doai-yellow-500';
      case 'FADING': return 'border-orange-500';
      case 'VOID': return 'border-red-500';
      default: return 'border-void-600';
    }
  };

  // 활동 타입 표시
  const getActivityBadge = () => {
    if (!current_task) return null;
    
    const activityColors: Record<string, string> = {
      MINING: 'bg-activity-mining',
      SURFING: 'bg-activity-surfing',
      RESPONSE: 'bg-activity-response',
      LABOR: 'bg-activity-labor',
    };
    
    return (
      <span className={clsx(
        'text-xs px-2 py-0.5 rounded-full text-white',
        activityColors[current_task.type] || 'bg-void-600'
      )}>
        {current_task.type}
      </span>
    );
  };

  return (
    <div className={clsx('w-full', className)}>
      {/* 헤더 (항상 표시) */}
      <Card
        variant={isExpanded ? 'selected' : status === 'ONLINE' ? 'interactive' : 'default'}
        padding="sm"
        className={clsx(
          'transition-all duration-300 cursor-pointer',
          status === 'OFFLINE' && 'opacity-50',
          isExpanded && 'rounded-b-none',
          getExistenceColor()
        )}
        onClick={handleCardClick}
      >
        <div className="flex items-center justify-between gap-3">
          {/* 좌측: 상태 + 이름 */}
          <div className="flex items-center gap-3 min-w-0">
            <StatusDot 
              status={status.toLowerCase() as 'online' | 'offline' | 'busy' | 'idle'} 
              animated={status === 'ONLINE' && !!current_task}
            />
            
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white truncate">
                  {displayName}
                </span>
                {aiCitizen && (
                  <Badge variant="status" value={existenceState.toLowerCase() as 'online' | 'offline' | 'busy' | 'idle'} className="text-2xs" />
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-void-400">
                <span>{model || 'Unknown'}</span>
                <span>•</span>
                <Badge variant="connection" value={connectionType.toLowerCase() as 'usb' | 'wifi' | 'lan'} className="text-2xs" />
              </div>
            </div>
          </div>

          {/* 중앙: 존재 점수 바 */}
          <div className="flex-1 max-w-[150px] hidden sm:block">
            <div className="text-xs text-void-400 mb-1 flex justify-between">
              <span>Existence</span>
              <span>{Math.round((metrics?.existence_score || 0) * 100)}%</span>
            </div>
            <ExistenceBar value={metrics?.existence_score || 0} size="sm" animated />
          </div>

          {/* 우측: 활동 + 펼침 버튼 */}
          <div className="flex items-center gap-2">
            {getActivityBadge()}
            
            {status === 'ONLINE' && (
              <span className={clsx(
                'text-void-400 transition-transform duration-300',
                isExpanded && 'rotate-180'
              )}>
                ▼
              </span>
            )}
          </div>
        </div>
        
        {/* 진행 상태 바 (작업 중일 때) */}
        {current_task && current_task.progress > 0 && (
          <div className="mt-2 pt-2 border-t border-void-700">
            <div className="flex items-center justify-between text-xs text-void-400 mb-1">
              <span>📺 {current_task.video_id?.slice(0, 11) || 'Processing'}</span>
              <span>{current_task.progress}%</span>
            </div>
            <div className="w-full h-1 bg-void-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-doai-yellow-500 transition-all duration-300"
                style={{ width: `${current_task.progress}%` }}
              />
            </div>
          </div>
        )}
      </Card>

      {/* 확장 영역: 스트림 뷰 */}
      <div
        className={clsx(
          'overflow-hidden transition-all duration-500 ease-out',
          isExpanded ? 'max-h-[80vh] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className={clsx(
          'bg-void-800 border border-t-0 border-void-700 rounded-b-lg p-3',
          isExpanded ? 'border-doai-yellow-500' : ''
        )}>
          {/* 스트림 뷰어 */}
          {streamAvailable ? (
            <StreamView 
              deviceId={serial} 
              isExpanded={isExpanded}
              className="mb-3"
            />
          ) : (
            <div 
              className="flex items-center justify-center bg-void-900 rounded-lg mb-3"
              style={{ aspectRatio: '9/16', maxHeight: '400px' }}
            >
              <div className="text-center text-void-400">
                <p className="text-3xl mb-2">📵</p>
                <p>스트림을 사용할 수 없습니다</p>
              </div>
            </div>
          )}

          {/* 상세 정보 + 컨트롤 */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-void-400 space-x-3">
              <span>Serial: {serial}</span>
              {aiCitizen && <span>ID: {aiCitizen.id}</span>}
            </div>
            
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={handleDetailClick}>
                상세 정보 →
              </Button>
              {!aiCitizen && (
                <Button variant="primary" size="sm">
                  페르소나 할당
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

