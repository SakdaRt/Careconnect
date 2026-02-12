import { HTMLAttributes } from 'react';
import { User } from 'lucide-react';
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

  // Generate initials from name
  const getInitials = (name?: string) => {
    if (!name) return '';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  // Generate color from name (for consistent coloring)
  const getColorFromName = (name?: string) => {
    if (!name) return 'bg-gray-300 text-gray-700';

    const colors = [
      'bg-blue-500 text-white',
      'bg-green-500 text-white',
      'bg-purple-500 text-white',
      'bg-pink-500 text-white',
      'bg-indigo-500 text-white',
      'bg-teal-500 text-white',
      'bg-orange-500 text-white',
      'bg-red-500 text-white',
    ];

    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const initials = getInitials(name);
  const colorClass = getColorFromName(name);

  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center flex-shrink-0 rounded-full overflow-hidden',
        styles.container,
        !src && colorClass,
        className
      )}
      {...props}
    >
      {src ? (
        <img src={src} alt={alt || name || 'Avatar'} className="w-full h-full object-cover" />
      ) : initials ? (
        <span className={cn('font-semibold select-none', styles.text)}>{initials}</span>
      ) : (
        <User className={cn('text-current', styles.icon)} />
      )}
    </div>
  );
}
