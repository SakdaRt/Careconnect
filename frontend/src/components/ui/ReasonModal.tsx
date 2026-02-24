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
  presetReasons?: string[];
  requireReason?: boolean;
}

const DEFAULT_CANCEL_REASONS = [
  'ติดธุระฉุกเฉิน ไม่สามารถมาได้',
  'ผู้รับการดูแลอาการดีขึ้น ไม่ต้องการบริการแล้ว',
  'เปลี่ยนวันนัดหมาย',
  'ได้รับการดูแลจากแหล่งอื่นแล้ว',
  'ปัญหาด้านงบประมาณ',
  'อื่น ๆ',
];

export function ReasonModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  placeholder = 'รายละเอียดเพิ่มเติม (ถ้ามี)...',
  confirmText = 'ยืนยัน',
  cancelText = 'กลับไป',
  variant = 'info',
  loading = false,
  minLength,
  presetReasons,
  requireReason = false,
}: ReasonModalProps) {
  const [selected, setSelected] = useState<string>('');
  const [detail, setDetail] = useState('');

  const presets = presetReasons ?? DEFAULT_CANCEL_REASONS;
  const isPresetMode = presets.length > 0;

  const combinedReason = selected
    ? detail.trim() ? `${selected}: ${detail.trim()}` : selected
    : detail.trim();

  const isValid = isPresetMode
    ? selected !== ''
    : requireReason
      ? combinedReason.length >= (minLength ?? 1)
      : true;

  const variantStyles = {
    danger: 'bg-red-600 hover:bg-red-700',
    warning: 'bg-orange-600 hover:bg-orange-700',
    info: 'bg-blue-600 hover:bg-blue-700',
    primary: 'bg-blue-600 hover:bg-blue-700',
  };

  const selectedBorder = {
    danger: 'border-red-500 bg-red-50 text-red-700',
    warning: 'border-orange-500 bg-orange-50 text-orange-700',
    info: 'border-blue-500 bg-blue-50 text-blue-700',
    primary: 'border-blue-500 bg-blue-50 text-blue-700',
  };

  const handleClose = () => {
    if (loading) return;
    setSelected('');
    setDetail('');
    onClose();
  };

  const handleConfirm = () => {
    if (!isValid || loading) return;
    onConfirm(combinedReason || title);
    setSelected('');
    setDetail('');
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
      <div className="flex flex-col gap-3">
        {description && <p className="text-sm text-gray-600">{description}</p>}

        {isPresetMode && (
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">เลือกเหตุผล <span className="text-red-500">*</span></p>
            <div className="flex flex-col gap-1.5">
              {presets.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  disabled={loading}
                  onClick={() => setSelected(reason)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors',
                    selected === reason
                      ? selectedBorder[variant]
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700'
                  )}
                >
                  {selected === reason && <span className="mr-1.5">✓</span>}
                  {reason}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="text-sm font-medium text-gray-600 mb-1 block">
            รายละเอียดเพิ่มเติม <span className="text-gray-400 font-normal">(ไม่บังคับ)</span>
          </label>
          <textarea
            className={cn(
              'w-full px-3 py-2 border rounded-lg transition-colors text-sm',
              'focus:outline-none focus:ring-2 focus:border-transparent',
              variant === 'danger' ? 'focus:ring-red-500' : 'focus:ring-blue-500',
              'border-gray-300 hover:border-gray-400 min-h-20 resize-none'
            )}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder={placeholder}
            disabled={loading}
          />
        </div>
      </div>
    </Modal>
  );
}
