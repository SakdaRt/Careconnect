import type { TrustLevel } from '../contexts/AuthContext';

export interface TrustLevelConfig {
  label: string;
  shortLabel: string;
  color: string;
  bgColor: string;
  textColor: string;
  badgeVariant: 'default' | 'info' | 'success' | 'warning';
  dotColor: string;
}

const trustLevelConfigs: Record<TrustLevel, TrustLevelConfig> = {
  L0: {
    label: 'เริ่มต้น',
    shortLabel: 'เริ่มต้น',
    color: 'gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-700',
    badgeVariant: 'default',
    dotColor: 'bg-gray-400',
  },
  L1: {
    label: 'ยืนยันการติดต่อ',
    shortLabel: 'ยืนยันการติดต่อ',
    color: 'blue',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800',
    badgeVariant: 'info',
    dotColor: 'bg-blue-500',
  },
  L2: {
    label: 'ยืนยันตัวตน',
    shortLabel: 'ยืนยันตัวตน',
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
    badgeVariant: 'success',
    dotColor: 'bg-green-500',
  },
  L3: {
    label: 'มืออาชีพ',
    shortLabel: 'มืออาชีพ',
    color: 'amber',
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-800',
    badgeVariant: 'warning',
    dotColor: 'bg-amber-500',
  },
};

export function getTrustLevelConfig(level: TrustLevel | string | undefined | null): TrustLevelConfig {
  const key = (level || 'L0') as TrustLevel;
  return trustLevelConfigs[key] || trustLevelConfigs.L0;
}

export function getTrustLevelLabel(level: TrustLevel | string | undefined | null): string {
  return getTrustLevelConfig(level).label;
}

export interface TrustChecklistItem {
  key: string;
  label: string;
  done: boolean;
}

export function getTrustChecklist(user: {
  is_email_verified?: boolean;
  is_phone_verified?: boolean;
  trust_level?: string;
  kyc_status?: string | null;
  bank_account_count?: number;
} | null): TrustChecklistItem[] {
  if (!user) return [];
  const hasKyc = user.kyc_status === 'approved';
  const hasBank = (user.bank_account_count ?? 0) > 0;

  return [
    { key: 'email', label: 'ยืนยันอีเมล', done: !!user.is_email_verified },
    { key: 'phone', label: 'ยืนยันเบอร์โทร', done: !!user.is_phone_verified },
    { key: 'kyc', label: 'ยืนยันตัวตน (KYC)', done: hasKyc },
    { key: 'bank', label: 'เพิ่มบัญชีธนาคาร', done: hasBank },
  ];
}

export function getTrustProgress(user: Parameters<typeof getTrustChecklist>[0]): number {
  const items = getTrustChecklist(user);
  if (items.length === 0) return 0;
  const done = items.filter((i) => i.done).length;
  return Math.round((done / items.length) * 100);
}
