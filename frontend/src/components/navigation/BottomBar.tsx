import { Link, useLocation } from 'react-router-dom';
import { Briefcase, Search, Users, Wallet, Bell, User } from 'lucide-react';
import { useAuth } from '../../contexts';
import { cn } from '../../contexts/ThemeContext';

export function BottomBar() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const TabLink = ({ to, icon: Icon, label, paths }: { to: string; icon: React.ComponentType<{ className?: string }>; label: string; paths?: string[] }) => {
    const active = paths ? paths.some(isActive) : isActive(to);
    return (
      <Link
        to={to}
        className={cn(
          'flex flex-col items-center justify-center flex-1 h-full transition-colors',
          active ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
        )}
      >
        <Icon className="w-6 h-6" />
        <span className="text-xs mt-1">{label}</span>
      </Link>
    );
  };

  // Hirer Bottom Bar: งานของฉัน | ค้นหาผู้ดูแล | ผู้รับการดูแล | กระเป๋าเงิน
  if (user.role === 'hirer') {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-around h-16">
            <TabLink to="/hirer/home" icon={Briefcase} label="งานของฉัน" paths={['/hirer/home', '/hirer/create-job', '/jobs']} />
            <TabLink to="/hirer/search-caregivers" icon={Search} label="ค้นหาผู้ดูแล" />
            <TabLink to="/hirer/care-recipients" icon={Users} label="ผู้รับการดูแล" paths={['/hirer/care-recipients']} />
            <TabLink to="/hirer/wallet" icon={Wallet} label="กระเป๋าเงิน" paths={['/hirer/wallet']} />
          </div>
        </div>
      </div>
    );
  }

  // Caregiver Bottom Bar: ค้นหางาน | งานของฉัน | แจ้งเตือน | โปรไฟล์
  if (user.role === 'caregiver') {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-around h-16">
            <TabLink to="/caregiver/jobs/feed" icon={Search} label="ค้นหางาน" />
            <TabLink to="/caregiver/jobs/my-jobs" icon={Briefcase} label="งานของฉัน" />
            <TabLink to="/notifications" icon={Bell} label="แจ้งเตือน" />
            <TabLink to="/profile" icon={User} label="โปรไฟล์" paths={['/profile', '/caregiver/profile', '/kyc', '/settings']} />
          </div>
        </div>
      </div>
    );
  }

  return null;
}
