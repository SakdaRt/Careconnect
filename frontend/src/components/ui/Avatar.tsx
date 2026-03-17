import { HTMLAttributes, useMemo, useState } from 'react';
import { cn } from '../../utils/cn';
import { getAvatarUrl, type AvatarVariant } from '../../utils/avatar';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string;
  userId?: string | null;
  avatarVersion?: number | null;
  name?: string;
  size?: AvatarSize;
  alt?: string;
}

const sizeConfig: Record<AvatarSize, { container: string; text: string; variant: AvatarVariant }> = {
  xs:   { container: 'w-6 h-6',   text: 'text-[10px]', variant: 'thumb' },
  sm:   { container: 'w-8 h-8',   text: 'text-xs',     variant: 'thumb' },
  md:   { container: 'w-10 h-10', text: 'text-sm',     variant: 'sm' },
  lg:   { container: 'w-12 h-12', text: 'text-base',   variant: 'sm' },
  xl:   { container: 'w-16 h-16', text: 'text-lg',     variant: 'sm' },
  '2xl': { container: 'w-24 h-24', text: 'text-2xl',   variant: 'md' },
  '3xl': { container: 'w-32 h-32', text: 'text-3xl',   variant: 'md' },
};

export function Avatar({ src, userId, avatarVersion, name, size = 'md', alt, className, ...props }: AvatarProps) {
  const cfg = sizeConfig[size];
  const [imgError, setImgError] = useState(false);

  const resolvedSrc = useMemo(() => {
    if (src) return src;
    return getAvatarUrl(userId, avatarVersion, cfg.variant);
  }, [src, userId, avatarVersion, cfg.variant]);

  const getInitials = (n?: string) => {
    if (!n) return '?';
    const parts = n.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const initials = getInitials(name);

  if (!resolvedSrc || imgError) {
    return (
      <div 
        className={cn(
          'relative inline-flex items-center justify-center flex-shrink-0 rounded-full overflow-hidden',
          cfg.container,
          'bg-blue-500 text-white',
          className
        )} 
        {...props}
      >
        <span className={cn('font-bold select-none', cfg.text)}>
          {initials}
        </span>
      </div>
    );
  }

  return (
    <div className={cn('relative inline-flex items-center justify-center flex-shrink-0 rounded-full overflow-hidden', cfg.container, className)} {...props}>
      <img 
        src={resolvedSrc} 
        alt={alt || name || 'Avatar'} 
        className="w-full h-full object-cover"
        onError={() => setImgError(true)}
      />
    </div>
  );
}
