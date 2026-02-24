import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  DollarSign,
  MessageSquare,
  Settings,
  FileText,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts';
import { cn } from '../contexts/ThemeContext';

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const menuItems = [
    { icon: LayoutDashboard, label: 'แดชบอร์ด', path: '/admin/dashboard' },
    { icon: Briefcase, label: 'จัดการงาน', path: '/admin/jobs' },
    { icon: Users, label: 'จัดการผู้ใช้', path: '/admin/users' },
    { icon: DollarSign, label: 'การเงิน', path: '/admin/financial' },
    { icon: MessageSquare, label: 'ข้อพิพาท', path: '/admin/disputes' },
    { icon: FileText, label: 'รายงาน', path: '/admin/reports' },
    { icon: Settings, label: 'ตั้งค่าระบบ', path: '/admin/settings' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <aside
        className={cn(
          'bg-gray-900 text-white transition-all duration-300 fixed lg:sticky lg:top-0 h-screen z-50',
          sidebarOpen ? 'w-64' : 'w-0 lg:w-20'
        )}
      >
        {/* Logo & Toggle */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-800">
          {sidebarOpen && (
            <Link to="/admin/dashboard" className="font-bold text-xl">
              Admin Portal
            </Link>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? 'ซ่อนเมนู' : 'แสดงเมนู'}
            aria-expanded={sidebarOpen}
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-900"
          >
            {sidebarOpen ? <X className="w-6 h-6" aria-hidden="true" /> : <Menu className="w-6 h-6" aria-hidden="true" />}
          </button>
        </div>

        {/* Menu Items */}
        <nav className="mt-4 px-2">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 focus:ring-offset-gray-900',
                isActive(item.path)
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              {sidebarOpen && <span>{item.label}</span>}
            </Link>
          ))}
        </nav>

        {/* User Info & Logout */}
        {sidebarOpen && (
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800">
            <div className="mb-3">
              <p className="text-sm font-semibold text-white">{user?.name || 'Admin'}</p>
              <p className="text-xs text-gray-400">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2 text-gray-300 hover:bg-gray-800 hover:text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <LogOut className="w-5 h-5" aria-hidden="true" />
              <span>ออกจากระบบ</span>
            </button>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6">
          <h1 className="text-xl font-semibold text-gray-900">
            {menuItems.find(item => isActive(item.path))?.label || 'Admin Portal'}
          </h1>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {user?.name || 'Admin'}
            </span>
          </div>
        </header>

        {/* Page Content */}
        <main id="main-content" className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>

      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 lg:hidden z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
