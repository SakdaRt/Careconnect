import { Link, useLocation } from 'react-router-dom';
import { Home, PlusCircle, Users, Wallet, Search, Briefcase, User } from 'lucide-react';
import { useAuth } from '../../contexts';
import { cn } from '../../contexts/ThemeContext';

export function BottomBar() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  // Hirer Bottom Bar
  if (user.role === 'hirer') {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-around h-16">
            {/* Home */}
            <Link
              to="/hirer/home"
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full transition-colors',
                isActive('/hirer/home')
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
              )}
            >
              <Home className="w-6 h-6" />
              <span className="text-xs mt-1">หน้าแรก</span>
            </Link>

            {/* Create Job */}
            <Link
              to="/hirer/create-job"
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full transition-colors',
                isActive('/hirer/create-job')
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
              )}
            >
              <PlusCircle className="w-6 h-6" />
              <span className="text-xs mt-1">สร้างงาน</span>
            </Link>

            {/* Care Recipients */}
            <Link
              to="/hirer/care-recipients"
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full transition-colors',
                isActive('/hirer/care-recipients')
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
              )}
            >
              <Users className="w-6 h-6" />
              <span className="text-xs mt-1">ผู้รับการดูแล</span>
            </Link>

            {/* Wallet */}
            <Link
              to="/hirer/wallet"
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full transition-colors',
                isActive('/hirer/wallet')
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
              )}
            >
              <Wallet className="w-6 h-6" />
              <span className="text-xs mt-1">กระเป๋าเงิน</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Caregiver Bottom Bar
  if (user.role === 'caregiver') {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-around h-16">
            {/* Find Jobs */}
            <Link
              to="/caregiver/jobs/feed"
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full transition-colors',
                isActive('/caregiver/jobs/feed')
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
              )}
            >
              <Search className="w-6 h-6" />
              <span className="text-xs mt-1">ค้นหางาน</span>
            </Link>

            {/* My Jobs */}
            <Link
              to="/caregiver/jobs/my-jobs"
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full transition-colors',
                isActive('/caregiver/jobs/my-jobs')
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
              )}
            >
              <Briefcase className="w-6 h-6" />
              <span className="text-xs mt-1">งานของฉัน</span>
            </Link>

            {/* Wallet */}
            <Link
              to="/caregiver/wallet"
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full transition-colors',
                isActive('/caregiver/wallet')
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
              )}
            >
              <Wallet className="w-6 h-6" />
              <span className="text-xs mt-1">กระเป๋าเงิน</span>
            </Link>

            {/* Profile */}
            <Link
              to="/caregiver/profile"
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full transition-colors',
                isActive('/caregiver/profile')
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
              )}
            >
              <User className="w-6 h-6" />
              <span className="text-xs mt-1">โปรไฟล์</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
