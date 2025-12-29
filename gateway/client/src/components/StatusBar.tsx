/**
 * StatusBar Component
 * 하단 상태 바: 그리드 정보 + 페이지네이션
 * 
 * @author Axon (Tech Lead)
 * @version 2.0.0
 */

import type { GridLayout } from '../lib/grid-calculator';

interface StatusBarProps {
  total: number;
  online: number;
  layout: GridLayout;
  currentPage: number;
  onPageChange: (page: number) => void;
}

export function StatusBar({ 
  total, 
  online, 
  layout, 
  currentPage, 
  onPageChange 
}: StatusBarProps) {
  const { pagination, streamQuality } = layout;
  
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-t border-gray-700 text-sm">
      {/* 왼쪽: 통계 */}
      <div className="flex items-center gap-4 text-gray-400">
        <span>📱 {online}/{total} Online</span>
        <span>📐 {layout.cols}×{layout.rows}</span>
        <span>🎬 {streamQuality.resolution} @ {streamQuality.maxFps}fps</span>
      </div>
      
      {/* 중앙: 페이지네이션 */}
      {pagination.enabled && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white"
          >
            ◀
          </button>
          
          <span className="text-gray-300">
            Page {currentPage + 1} / {pagination.totalPages}
          </span>
          
          <button
            onClick={() => onPageChange(Math.min(pagination.totalPages - 1, currentPage + 1))}
            disabled={currentPage >= pagination.totalPages - 1}
            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white"
          >
            ▶
          </button>
        </div>
      )}
      
      {/* 오른쪽: 품질 정보 */}
      <div className="text-gray-500">
        {pagination.devicesPerPage} devices/page
      </div>
    </div>
  );
}

