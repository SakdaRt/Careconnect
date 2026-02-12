import { HTMLAttributes, ReactNode } from 'react';
import { MapPin, Calendar, Clock, DollarSign, User, ChevronRight } from 'lucide-react';
import { cn } from '../../contexts/ThemeContext';
import { Job, CareRecipient } from '../../mocks';
import { StatusBadge } from './Badge';
import { Avatar } from './Avatar';

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

// Job Card Component
export interface JobCardProps {
  job: Job;
  onClick?: () => void;
  showCaregiver?: boolean;
  showHirer?: boolean;
}

export function JobCard({ job, onClick, showCaregiver = false, showHirer = false }: JobCardProps) {
  return (
    <Card clickable onClick={onClick} className="hover:border-blue-300">
      <div className="flex items-start justify-between gap-3">
        {/* Left side - Job info */}
        <div className="flex-1 min-w-0">
          {/* Title & Badge */}
          <div className="flex items-start gap-2 mb-2">
            <h3 className="font-semibold text-gray-900 text-lg flex-1 line-clamp-1">
              {job.title}
            </h3>
            <StatusBadge status={job.status} />
          </div>

          {/* Patient name */}
          <p className="text-sm text-gray-600 mb-3 flex items-center gap-1">
            <User className="w-4 h-4" />
            {job.patient_name}
          </p>

          {/* Date & Time */}
          <div className="flex flex-wrap gap-3 text-sm text-gray-600 mb-3">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {new Date(job.start_date).toLocaleDateString('th-TH', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {job.start_time} - {job.end_time}
            </span>
          </div>

          {/* Location */}
          <p className="text-sm text-gray-600 mb-3 flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            {job.location}
          </p>

          {/* Caregiver/Hirer info */}
          {showCaregiver && job.caregiver_name && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
              <Avatar name={job.caregiver_name} size="sm" />
              <div>
                <p className="text-xs text-gray-500">ผู้ดูแล</p>
                <p className="text-sm font-medium text-gray-900">{job.caregiver_name}</p>
              </div>
            </div>
          )}

          {showHirer && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
              <Avatar name={job.hirer_name} size="sm" />
              <div>
                <p className="text-xs text-gray-500">ผู้ว่าจ้าง</p>
                <p className="text-sm font-medium text-gray-900">{job.hirer_name}</p>
              </div>
            </div>
          )}
        </div>

        {/* Right side - Pay amount & Arrow */}
        <div className="flex flex-col items-end gap-2">
          <div className="text-right">
            <p className="text-xl font-bold text-blue-600 flex items-center gap-1">
              <DollarSign className="w-5 h-5" />
              {job.pay_amount.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">
              {job.pay_rate_type === 'hourly' ? 'บาท/ชม.' : job.pay_rate_type === 'daily' ? 'บาท/วัน' : 'บาท'}
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>
      </div>
    </Card>
  );
}

// Care Recipient Card Component
export interface CareRecipientCardProps {
  recipient: CareRecipient;
  onClick?: () => void;
}

export function CareRecipientCard({ recipient, onClick }: CareRecipientCardProps) {
  const mobilityLevelText = {
    independent: 'ช่วยเหลือตัวเองได้',
    assisted: 'ต้องการความช่วยเหลือ',
    wheelchair: 'ใช้รถเข็น',
    bedridden: 'ติดเตียง',
  };

  return (
    <Card clickable onClick={onClick} className="hover:border-blue-300">
      <div className="flex items-start gap-4">
        <Avatar name={recipient.name} size="lg" />

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-lg mb-1">{recipient.name}</h3>

          <div className="flex flex-wrap gap-2 mb-3">
            <span className="text-sm text-gray-600">
              อายุ {recipient.age} ปี
            </span>
            <span className="text-gray-300">•</span>
            <span className="text-sm text-gray-600">
              {recipient.gender === 'male' ? 'ชาย' : recipient.gender === 'female' ? 'หญิง' : 'อื่นๆ'}
            </span>
            <span className="text-gray-300">•</span>
            <span className="text-sm text-gray-600">{recipient.relationship}</span>
          </div>

          <p className="text-sm text-gray-600 mb-2">
            {mobilityLevelText[recipient.mobility_level]}
          </p>

          {recipient.medical_conditions.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {recipient.medical_conditions.slice(0, 3).map((condition, index) => (
                <span
                  key={index}
                  className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded"
                >
                  {condition}
                </span>
              ))}
              {recipient.medical_conditions.length > 3 && (
                <span className="text-xs text-gray-500 px-2 py-1">
                  +{recipient.medical_conditions.length - 3} เพิ่มเติม
                </span>
              )}
            </div>
          )}
        </div>

        <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
      </div>
    </Card>
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
