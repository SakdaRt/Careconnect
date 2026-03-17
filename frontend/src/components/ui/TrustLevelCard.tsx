import { Shield, CheckCircle2, Circle, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../utils/cn';
import {
  getTrustLevelConfig,
  getTrustChecklist,
  getTrustProgress,
  type TrustChecklistItem,
} from '../../utils/trustLevel';

interface TrustLevelCardProps {
  user: {
    trust_level?: string;
    is_email_verified?: boolean;
    is_phone_verified?: boolean;
    bank_account_count?: number;
    role?: string;
  } | null;
  className?: string;
}

const checklistLinks: Record<string, string> = {
  email: '/profile',
  phone: '/profile',
  kyc: '/kyc',
  bank: '/wallet/bank-accounts',
};

export function TrustLevelCard({ user, className }: TrustLevelCardProps) {
  if (!user) return null;

  const config = getTrustLevelConfig(user.trust_level);
  const checklist = getTrustChecklist(user);
  const progress = getTrustProgress(user);
  const nextItem = checklist.find((i) => !i.done);

  return (
    <div className={cn('bg-white rounded-xl border p-4 sm:p-5', className)}>
      <div className="flex items-center gap-3 mb-3">
        <div className={cn('w-10 h-10 rounded-full flex items-center justify-center', config.bgColor)}>
          <Shield className={cn('w-5 h-5', config.textColor)} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className={cn('text-sm font-semibold', config.textColor)}>
              {config.label}
            </span>
            <span className={cn('w-2 h-2 rounded-full', config.dotColor)} />
          </div>
          <p className="text-xs text-gray-500">ความน่าเชื่อถือของคุณ</p>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>ความสมบูรณ์</span>
          <span>{progress}%</span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              progress < 25 && 'bg-gray-400',
              progress >= 25 && progress < 50 && 'bg-blue-500',
              progress >= 50 && progress < 100 && 'bg-green-500',
              progress >= 100 && 'bg-amber-500',
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        {checklist.map((item: TrustChecklistItem) => (
          <ChecklistRow key={item.key} item={item} />
        ))}
      </div>

      {nextItem && (
        <div className="mt-4 pt-3 border-t">
          <Link
            to={checklistLinks[nextItem.key] || '/profile'}
            className={cn(
              'flex items-center justify-between text-sm font-medium rounded-lg px-3 py-2',
              config.bgColor, config.textColor, 'hover:opacity-80 transition-opacity'
            )}
          >
            <span>ทำต่อ: {nextItem.label}</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </div>
  );
}

function ChecklistRow({ item }: { item: TrustChecklistItem }) {
  if (item.done) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-700">
        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
        <span>{item.label}</span>
      </div>
    );
  }

  return (
    <Link
      to={checklistLinks[item.key] || '/profile'}
      className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 transition-colors group"
    >
      <Circle className="w-4 h-4 flex-shrink-0" />
      <span>{item.label}</span>
      <ChevronRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}
