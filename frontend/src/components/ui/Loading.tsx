import { Loader2 } from 'lucide-react';
import { cn } from '../../contexts/ThemeContext';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeStyles = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
};

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <Loader2
      className={cn('animate-spin text-blue-600', sizeStyles[size], className)}
    />
  );
}

// Loading overlay (full screen)
export interface LoadingOverlayProps {
  message?: string;
}

export function LoadingOverlay({ message = 'กำลังโหลด...' }: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 shadow-xl flex flex-col items-center gap-4">
        <Spinner size="xl" />
        <p className="text-gray-700 font-medium">{message}</p>
      </div>
    </div>
  );
}

// Loading state for content areas
export interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingState({ message = 'กำลังโหลด...', size = 'md' }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <Spinner size={size === 'sm' ? 'md' : size === 'md' ? 'lg' : 'xl'} />
      <p className="text-gray-600">{message}</p>
    </div>
  );
}

// Skeleton loader for cards/content
export interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string;
  height?: string;
}

export function Skeleton({
  className,
  variant = 'rectangular',
  width,
  height,
}: SkeletonProps) {
  const variantStyles = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded',
  };

  return (
    <div
      className={cn(
        'bg-gray-200 animate-pulse',
        variantStyles[variant],
        className
      )}
      style={{ width, height }}
    />
  );
}

// Skeleton for Job Card
export function JobCardSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex justify-between gap-4">
        <div className="flex-1 space-y-3">
          <Skeleton height="24px" width="60%" />
          <Skeleton height="16px" width="40%" />
          <div className="flex gap-3">
            <Skeleton height="16px" width="120px" />
            <Skeleton height="16px" width="120px" />
          </div>
          <Skeleton height="16px" width="50%" />
        </div>
        <div className="flex flex-col items-end gap-2">
          <Skeleton variant="rectangular" width="80px" height="32px" />
          <Skeleton variant="rectangular" width="60px" height="16px" />
        </div>
      </div>
    </div>
  );
}

// Skeleton for Care Recipient Card
export function CareRecipientCardSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex gap-4">
        <Skeleton variant="circular" width="48px" height="48px" />
        <div className="flex-1 space-y-2">
          <Skeleton height="20px" width="40%" />
          <Skeleton height="16px" width="60%" />
          <Skeleton height="16px" width="50%" />
          <div className="flex gap-2">
            <Skeleton height="24px" width="80px" />
            <Skeleton height="24px" width="80px" />
          </div>
        </div>
      </div>
    </div>
  );
}
