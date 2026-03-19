import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

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

