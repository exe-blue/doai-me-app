/**
 * Modal - Organism Component
 * 모달 다이얼로그
 */
import { useEffect, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { Button } from '@/components/atoms/Button';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'full';
  closeable?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

const sizeStyles = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  full: 'max-w-[90vw] max-h-[90vh]',
};

export function Modal({
  isOpen,
  onClose,
  title,
  size = 'md',
  closeable = true,
  children,
  footer,
  className,
}: ModalProps) {
  // ESC 키로 닫기
  useEffect(() => {
    if (!isOpen || !closeable) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeable, onClose]);

  // 바디 스크롤 방지
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      {/* 오버레이 */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={closeable ? onClose : undefined}
      />

      {/* 모달 컨텐츠 */}
      <div
        className={clsx(
          'relative w-full bg-doai-black-800 rounded-xl border border-doai-black-600',
          'shadow-2xl animate-in fade-in zoom-in-95 duration-200',
          sizeStyles[size],
          className
        )}
      >
        {/* 헤더 */}
        {(title || closeable) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-doai-black-700">
            {title && (
              <h2 className="text-lg font-semibold text-gray-100">{title}</h2>
            )}
            {closeable && (
              <button
                type="button"
                onClick={onClose}
                className="text-gray-500 hover:text-gray-300 transition-colors"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* 본문 */}
        <div className="px-6 py-4 overflow-auto max-h-[70vh]">
          {children}
        </div>

        {/* 푸터 */}
        {footer && (
          <div className="px-6 py-4 border-t border-doai-black-700 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// 확인 모달 프리셋
export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'info',
}: ConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {cancelText}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <p className="text-gray-300">{message}</p>
    </Modal>
  );
}

