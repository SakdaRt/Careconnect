import { useState } from 'react';
import { Modal } from './Modal';
import { cn } from '../../contexts/ThemeContext';

export interface ReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  title: string;
  description?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'primary';
  loading?: boolean;
  minLength?: number;
}

export function ReasonModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  placeholder = 'กรุณาอธิบายเหตุผล...',
  confirmText = 'ยืนยัน',
  cancelText = 'กลับไป',
  variant = 'info',
  loading = false,
  minLength = 10,
}: ReasonModalProps) {
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();
  const isValid = trimmed.length >= minLength;

  const variantStyles = {
    danger: 'bg-red-600 hover:bg-red-700',
    warning: 'bg-orange-600 hover:bg-orange-700',
    info: 'bg-blue-600 hover:bg-blue-700',
    primary: 'bg-blue-600 hover:bg-blue-700',
  };

  const handleClose = () => {
    if (loading) return;
    setReason('');
    onClose();
  };

  const handleConfirm = () => {
    if (!isValid || loading) return;
    onConfirm(trimmed);
    setReason('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      size="sm"
      footer={
        <div className="flex gap-3 justify-end">
          <button
            onClick={handleClose}
            disabled={loading}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !isValid}
            className={cn(
              'px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50',
              variantStyles[variant]
            )}
          >
            {loading ? 'กำลังดำเนินการ...' : confirmText}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        {description && <p className="text-sm text-gray-600 mb-1">{description}</p>}
        <label className="text-sm font-semibold text-gray-700">เหตุผล</label>
        <textarea
          className={cn(
            'w-full px-4 py-2 border rounded-lg transition-colors',
            'focus:outline-none focus:ring-2 focus:border-transparent min-h-28',
            variant === 'danger' ? 'focus:ring-red-500' : 'focus:ring-blue-500',
            'border-gray-300 hover:border-gray-400'
          )}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={placeholder}
          disabled={loading}
        />
        <div className="flex items-center justify-between">
          <span className={cn('text-xs', isValid ? 'text-green-600' : 'text-gray-400')}>
            {trimmed.length}/{minLength} ตัวอักษรขั้นต่ำ
          </span>
          {!isValid && trimmed.length > 0 && (
            <span className="text-xs text-amber-600">กรุณาอธิบายเพิ่มเติม</span>
          )}
        </div>
      </div>
    </Modal>
  );
}
