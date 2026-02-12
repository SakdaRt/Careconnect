import { HTMLAttributes } from 'react';
import { cn } from '../../contexts/ThemeContext';
import { JobStatus, TrustLevel } from '../../mocks';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  children: React.ReactNode;
}

export function Badge({ variant = 'default', children, className, ...props }: BadgeProps) {
  const variantStyles = {
    default: 'bg-gray-100 text-gray-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-orange-100 text-orange-800',
    danger: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

// Status Badge for Job Status
export interface StatusBadgeProps {
  status: JobStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const statusConfig: Record<JobStatus, { label: string; variant: BadgeProps['variant'] }> = {
    draft: { label: 'แบบร่าง', variant: 'default' },
    posted: { label: 'เปิดรับสมัคร', variant: 'info' },
    assigned: { label: 'มอบหมายแล้ว', variant: 'warning' },
    in_progress: { label: 'กำลังดำเนินการ', variant: 'success' },
    completed: { label: 'เสร็จสิ้น', variant: 'success' },
    cancelled: { label: 'ยกเลิก', variant: 'danger' },
    expired: { label: 'หมดอายุ', variant: 'danger' },
  };

  const config = statusConfig[status];

  return <Badge variant={config.variant}>{config.label}</Badge>;
}

// Trust Level Badge
export interface TrustLevelBadgeProps {
  level: TrustLevel;
}

export function TrustLevelBadge({ level }: TrustLevelBadgeProps) {
  const levelConfig: Record<TrustLevel, { label: string; variant: BadgeProps['variant'] }> = {
    L0: { label: 'L0 - ยังไม่ยืนยัน', variant: 'default' },
    L1: { label: 'L1 - พื้นฐาน', variant: 'info' },
    L2: { label: 'L2 - ยืนยันแล้ว', variant: 'success' },
    L3: { label: 'L3 - เชื่อถือได้', variant: 'success' },
  };

  const config = levelConfig[level];

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
