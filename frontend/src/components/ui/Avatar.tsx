import { HTMLAttributes, useState } from 'react';
import { cn } from '../../contexts/ThemeContext';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string;
  name?: string;
  size?: AvatarSize;
  alt?: string;
}

const sizeStyles: Record<AvatarSize, { container: string; icon: string; text: string }> = {
  xs: { container: 'w-6 h-6', icon: 'w-3 h-3', text: 'text-xs' },
  sm: { container: 'w-8 h-8', icon: 'w-4 h-4', text: 'text-sm' },
  md: { container: 'w-10 h-10', icon: 'w-5 h-5', text: 'text-base' },
  lg: { container: 'w-12 h-12', icon: 'w-6 h-6', text: 'text-lg' },
  xl: { container: 'w-16 h-16', icon: 'w-8 h-8', text: 'text-xl' },
};

export function Avatar({ src, name, size = 'md', alt, className, ...props }: AvatarProps) {
  const styles = sizeStyles[size];
  const [imgError, setImgError] = useState(false);

  // Generate initials from name
  const getInitials = (name?: string) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const initials = getInitials(name);

  // Show default avatar if no src or image failed to load
  if (!src || imgError) {
    return (
      <div 
        className={cn(
          'relative inline-flex items-center justify-center flex-shrink-0 rounded-full overflow-hidden',
          styles.container,
          // Always use a visible background
          'bg-blue-500 text-white',
          className
        )} 
        {...props}
      >
        <span className={cn('font-bold select-none', styles.text)}>
          {initials}
        </span>
      </div>
    );
  }

  // Try to load image
  return (
    <div className={cn('relative inline-flex items-center justify-center flex-shrink-0 rounded-full overflow-hidden', styles.container, className)} {...props}>
      <img 
        src={src} 
        alt={alt || name || 'Avatar'} 
        className="w-full h-full object-cover"
        onError={() => setImgError(true)}
      />
    </div>
  );
}
