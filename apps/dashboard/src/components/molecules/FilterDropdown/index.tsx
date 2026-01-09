/**
 * FilterDropdown - Molecular Component
 * 다중 선택 필터 드롭다운
 */
import { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';

export interface FilterOption {
  value: string;
  label: string;
  icon?: string;
  color?: string;
  count?: number;
}

export interface FilterDropdownProps {
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  multiple?: boolean;
  className?: string;
}

export function FilterDropdown({
  label,
  options,
  selected,
  onChange,
  multiple = true,
  className,
}: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = (value: string) => {
    if (multiple) {
      if (selected.includes(value)) {
        onChange(selected.filter((v) => v !== value));
      } else {
        onChange([...selected, value]);
      }
    } else {
      onChange([value]);
      setIsOpen(false);
    }
  };

  const handleSelectAll = () => {
    onChange(options.map((o) => o.value));
  };

  const handleClear = () => {
    onChange([]);
  };

  // 표시 텍스트 결정
  const displayText = selected.length === 0
    ? 'ALL'
    : selected.length === options.length
      ? 'ALL'
      : `${selected.length} selected`;

  return (
    <div ref={dropdownRef} className={clsx('relative', className)}>
      {/* 트리거 버튼 */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm',
          'bg-doai-black-800 border border-doai-black-600',
          'hover:border-doai-black-500 transition-colors',
          isOpen && 'border-doai-yellow-500'
        )}
      >
        <span className="text-gray-400">{label}:</span>
        <span className="text-gray-100">{displayText}</span>
        <span className={clsx(
          'transition-transform duration-200',
          isOpen && 'rotate-180'
        )}>
          ▼
        </span>
      </button>

      {/* 드롭다운 메뉴 */}
      {isOpen && (
        <div className="absolute z-50 mt-1 min-w-[200px] py-2 rounded-lg
                        bg-doai-black-800 border border-doai-black-600 shadow-lg">
          {/* 옵션 목록 */}
          <div className="max-h-[300px] overflow-y-auto">
            {options.map((option) => {
              const isSelected = selected.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleToggle(option.value)}
                  className={clsx(
                    'w-full flex items-center gap-2 px-3 py-2 text-sm text-left',
                    'hover:bg-doai-black-700 transition-colors',
                    isSelected && 'bg-doai-black-700'
                  )}
                >
                  {/* 체크박스 */}
                  <span className={clsx(
                    'w-4 h-4 rounded border flex items-center justify-center text-xs',
                    isSelected 
                      ? 'bg-doai-yellow-500 border-doai-yellow-500 text-doai-black-900' 
                      : 'border-doai-black-500'
                  )}>
                    {isSelected && '✓'}
                  </span>

                  {/* 아이콘 */}
                  {option.icon && <span>{option.icon}</span>}

                  {/* 색상 점 */}
                  {option.color && (
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: option.color }}
                    />
                  )}

                  {/* 라벨 */}
                  <span className="flex-1 text-gray-100">{option.label}</span>

                  {/* 카운트 */}
                  {option.count !== undefined && (
                    <span className="text-gray-500">({option.count})</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* 액션 버튼 */}
          {multiple && (
            <div className="flex gap-2 px-3 pt-2 mt-2 border-t border-doai-black-600">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs text-gray-400 hover:text-gray-100"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-gray-400 hover:text-gray-100"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

