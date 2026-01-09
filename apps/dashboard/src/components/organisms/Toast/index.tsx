/**
 * Toast - Organism Component
 * 토스트 알림 시스템
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import { clsx } from 'clsx';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
}

export interface ToastProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

// 변형별 스타일
const variantStyles: Record<ToastVariant, { bg: string; icon: string }> = {
  success: { bg: 'bg-status-online/20 border-status-online', icon: '✓' },
  error: { bg: 'bg-error/20 border-error', icon: '✕' },
  warning: { bg: 'bg-warning/20 border-warning', icon: '⚠' },
  info: { bg: 'bg-info/20 border-info', icon: 'ℹ' },
};

function ToastItem({ toast, onDismiss }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);
  const { bg, icon } = variantStyles[toast.variant];
  
  // onDismiss를 ref로 저장하여 의존성 변경으로 인한 타이머 재시작 방지
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const duration = toast.duration || 5000;
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onDismissRef.current(toast.id), 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration]);

  return (
    <div
      className={clsx(
        'flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg',
        'transition-all duration-300',
        bg,
        isExiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'
      )}
    >
      <span className="text-lg">{icon}</span>
      <span className="flex-1 text-sm text-gray-100">{toast.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="text-gray-500 hover:text-gray-300"
      >
        ✕
      </button>
    </div>
  );
}

// Toast Container
export interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
  position?: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left';
}

const positionStyles = {
  'top-right': 'top-4 right-4',
  'bottom-right': 'bottom-4 right-4',
  'top-left': 'top-4 left-4',
  'bottom-left': 'bottom-4 left-4',
};

export function ToastContainer({
  toasts,
  onDismiss,
  position = 'top-right',
}: ToastContainerProps) {
  // onDismiss를 useCallback으로 메모이제이션하여 자식 컴포넌트에 안정적인 참조 전달
  const handleDismiss = useCallback((id: string) => {
    onDismiss(id);
  }, [onDismiss]);

  if (toasts.length === 0) return null;

  return (
    <div
      className={clsx(
        'fixed z-[600] flex flex-col gap-2 max-w-sm',
        positionStyles[position]
      )}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={handleDismiss} />
      ))}
    </div>
  );
}

/**
 * 안전한 고유 ID 생성
 * crypto.randomUUID()가 가능하면 사용, 아니면 폴백
 */
function generateId(): string {
  // 모던 환경에서는 crypto.randomUUID() 사용
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  
  // 폴백: crypto.getRandomValues() 사용
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  
  // 최종 폴백: Math.random() (보안이 중요하지 않은 경우에만)
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

// Toast Hook
export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, variant: ToastVariant = 'info', duration?: number) => {
    const id = generateId();
    setToasts((prev) => [...prev, { id, message, variant, duration }]);
    return id;
  };

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAll = () => {
    setToasts([]);
  };

  return {
    toasts,
    addToast,
    dismissToast,
    clearAll,
    // 편의 메서드
    success: (msg: string) => addToast(msg, 'success'),
    error: (msg: string) => addToast(msg, 'error'),
    warning: (msg: string) => addToast(msg, 'warning'),
    info: (msg: string) => addToast(msg, 'info'),
  };
}
