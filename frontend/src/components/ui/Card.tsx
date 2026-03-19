import { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../utils/cn';

// Base Card Component
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  clickable?: boolean;
  padding?: 'sm' | 'md' | 'lg';
}

export function Card({ children, clickable, padding = 'md', className, ...props }: CardProps) {
  const paddingStyles = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  return (
    <div
      className={cn(
        'bg-white rounded-lg border border-gray-200 shadow-sm',
        clickable && 'hover:shadow-md hover:border-gray-300 cursor-pointer transition-all duration-150',
        paddingStyles[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// Wallet Card Component
export interface WalletCardProps {
  title: string;
  amount: number;
  icon?: ReactNode;
  variant?: 'primary' | 'success' | 'warning';
  description?: string;
  onClick?: () => void;
}

export function WalletCard({
  title,
  amount,
  icon,
  variant = 'primary',
  description,
  onClick,
}: WalletCardProps) {
  const variantStyles = {
    primary: 'bg-gradient-to-br from-blue-500 to-blue-600 text-white',
    success: 'bg-gradient-to-br from-green-500 to-green-600 text-white',
    warning: 'bg-gradient-to-br from-orange-500 to-orange-600 text-white',
  };

  return (
    <Card
      clickable={!!onClick}
      onClick={onClick}
      className={cn('border-0 shadow-md', variantStyles[variant])}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm opacity-90 mb-1">{title}</p>
          <p className="text-3xl font-bold mb-2">
            ฿{amount.toLocaleString()}
          </p>
          {description && <p className="text-xs opacity-75">{description}</p>}
        </div>

        {icon && (
          <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
