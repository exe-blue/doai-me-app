/**
 * DeviceGrid Component
 * 동적 그리드 레이아웃으로 디바이스 표시
 * 
 * @author Axon (Tech Lead)
 * @version 2.0.0
 */

import { DeviceCard } from './DeviceCard';
import type { DiscoveredDevice } from '../types';
import type { GridLayout } from '../lib/grid-calculator';

interface DeviceGridProps {
  devices: DiscoveredDevice[];
  layout: GridLayout;
  onDeviceClick: (deviceId: string) => void;
}

export function DeviceGrid({ devices, layout, onDeviceClick }: DeviceGridProps) {
  return (
    <div
      className="grid p-2"
      style={{
        gridTemplateColumns: `repeat(${layout.cols}, ${layout.cellWidth}px)`,
        gridAutoRows: `${layout.cellHeight}px`,
        gap: '8px',
        justifyContent: 'center'
      }}
    >
      {devices.map((device) => (
        <DeviceCard
          key={device.serial}
          device={device}
          width={layout.cellWidth}
          height={layout.cellHeight}
          streamQuality={layout.streamQuality}
          onClick={() => onDeviceClick(device.serial)}
        />
      ))}
    </div>
  );
}

