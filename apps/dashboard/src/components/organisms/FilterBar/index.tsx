/**
 * FilterBar - Organism Component
 * 대시보드 상단의 필터 바
 * 
 * Filters: Status, Activity, Existence, Connection, Battery
 * Search, Sort, View Toggle
 */
import { useState } from 'react';
import { clsx } from 'clsx';
import { Input } from '@/components/atoms/Input';
import { FilterDropdown, type FilterOption } from '@/components/molecules/FilterDropdown';

// 필터 옵션 정의
const STATUS_OPTIONS: FilterOption[] = [
  { value: 'ONLINE', label: 'Online', icon: '🟢', color: '#22C55E' },
  { value: 'OFFLINE', label: 'Offline', icon: '🔴', color: '#EF4444' },
  { value: 'BUSY', label: 'Busy', icon: '🟡', color: '#F59E0B' },
  { value: 'IDLE', label: 'Idle', icon: '⚪', color: '#6B7280' },
];

const ACTIVITY_OPTIONS: FilterOption[] = [
  { value: 'MINING', label: 'Mining', icon: '🎭', color: '#8B5CF6' },
  { value: 'SURFING', label: 'Surfing', icon: '🍿', color: '#06B6D4' },
  { value: 'RESPONSE', label: 'Response', icon: '🔥', color: '#EF4444' },
  { value: 'LABOR', label: 'Labor', icon: '💰', color: '#F59E0B' },
  { value: 'IDLE', label: 'Idle', icon: '💤', color: '#6B7280' },
];

const EXISTENCE_OPTIONS: FilterOption[] = [
  { value: 'CRITICAL', label: 'Critical (0-20%)', color: '#EF4444' },
  { value: 'LOW', label: 'Low (20-40%)', color: '#F97316' },
  { value: 'MEDIUM', label: 'Medium (40-60%)', color: '#FFCC00' },
  { value: 'HIGH', label: 'High (60-80%)', color: '#84CC16' },
  { value: 'MAX', label: 'Max (80-100%)', color: '#22C55E' },
];

const CONNECTION_OPTIONS: FilterOption[] = [
  { value: 'USB', label: 'USB', icon: '🔌', color: '#A855F7' },
  { value: 'WIFI', label: 'WiFi', icon: '📶', color: '#06B6D4' },
  { value: 'LAN', label: 'LAN', icon: '🔗', color: '#10B981' },
];

const SORT_OPTIONS = [
  { value: 'name_asc', label: 'Name (A-Z)' },
  { value: 'name_desc', label: 'Name (Z-A)' },
  { value: 'existence_desc', label: 'Existence (High-Low)' },
  { value: 'existence_asc', label: 'Existence (Low-High)' },
  { value: 'lastActive_desc', label: 'Recently Active' },
  { value: 'credits_desc', label: 'Credits (High-Low)' },
];

export interface FilterState {
  status: string[];
  activity: string[];
  existence: string[];
  connection: string[];
  search: string;
  sortBy: string;
}

export interface FilterBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  stats?: {
    online: number;
    offline: number;
    busy: number;
    idle: number;
  };
  viewMode?: 'grid' | 'list';
  onViewModeChange?: (mode: 'grid' | 'list') => void;
  className?: string;
}

export function FilterBar({
  filters,
  onFiltersChange,
  stats,
  viewMode = 'grid',
  onViewModeChange,
  className,
}: FilterBarProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      status: [],
      activity: [],
      existence: [],
      connection: [],
      search: '',
      sortBy: 'name_asc',
    });
  };

  const hasActiveFilters = 
    filters.status.length > 0 ||
    filters.activity.length > 0 ||
    filters.existence.length > 0 ||
    filters.connection.length > 0 ||
    filters.search !== '';

  return (
    <div className={clsx(
      'bg-doai-black-800 border-b border-doai-black-700',
      className
    )}>
      {/* 메인 필터 행 */}
      <div className="px-4 py-3 flex flex-wrap items-center gap-3">
        {/* 필터 드롭다운들 */}
        <FilterDropdown
          label="Status"
          options={STATUS_OPTIONS.map(opt => ({
            ...opt,
            count: stats?.[opt.value.toLowerCase() as keyof typeof stats],
          }))}
          selected={filters.status}
          onChange={(values) => updateFilter('status', values)}
        />

        <FilterDropdown
          label="Activity"
          options={ACTIVITY_OPTIONS}
          selected={filters.activity}
          onChange={(values) => updateFilter('activity', values)}
        />

        <FilterDropdown
          label="Existence"
          options={EXISTENCE_OPTIONS}
          selected={filters.existence}
          onChange={(values) => updateFilter('existence', values)}
        />

        <FilterDropdown
          label="Connection"
          options={CONNECTION_OPTIONS}
          selected={filters.connection}
          onChange={(values) => updateFilter('connection', values)}
        />

        {/* 검색 */}
        <div className="flex-1 min-w-[200px] max-w-[300px]">
          <Input
            type="search"
            size="sm"
            placeholder="🔍 Search by name..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            leftIcon="🔍"
          />
        </div>

        {/* 정렬 */}
        <label htmlFor="sortBy-select" className="sr-only">
          Sort by
        </label>
        <select
          id="sortBy-select"
          aria-label="Sort by"
          value={filters.sortBy}
          onChange={(e) => updateFilter('sortBy', e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm bg-doai-black-800 border border-doai-black-600 text-gray-100"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* 뷰 모드 토글 */}
        {onViewModeChange && (
          <div className="flex rounded-lg border border-doai-black-600 overflow-hidden">
            <button
              type="button"
              onClick={() => onViewModeChange('grid')}
              className={clsx(
                'px-3 py-1.5 text-sm',
                viewMode === 'grid'
                  ? 'bg-doai-yellow-500 text-doai-black-900'
                  : 'bg-doai-black-800 text-gray-400 hover:text-gray-100'
              )}
            >
              ⊞ Grid
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('list')}
              className={clsx(
                'px-3 py-1.5 text-sm',
                viewMode === 'list'
                  ? 'bg-doai-yellow-500 text-doai-black-900'
                  : 'bg-doai-black-800 text-gray-400 hover:text-gray-100'
              )}
            >
              ☰ List
            </button>
          </div>
        )}

        {/* 필터 클리어 */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-sm text-gray-400 hover:text-gray-100"
          >
            Clear All
          </button>
        )}
      </div>

      {/* 통계 요약 행 - 토글 버튼은 항상 표시 */}
      {stats && (
        <div className="px-4 py-2 border-t border-doai-black-700 flex items-center gap-6 text-sm">
          {isExpanded && (
            <>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-status-online" />
                Online: {stats.online}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-status-offline" />
                Offline: {stats.offline}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-status-busy" />
                Busy: {stats.busy}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-status-idle" />
                Idle: {stats.idle}
              </span>
            </>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="ml-auto text-gray-500 hover:text-gray-300"
          >
            {isExpanded ? '▲ Collapse' : '▼ Expand'}
          </button>
        </div>
      )}
    </div>
  );
}

