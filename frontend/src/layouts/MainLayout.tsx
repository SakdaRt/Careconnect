import { ReactNode } from 'react';
import { TopBar } from '../components/navigation/TopBar';
import { BottomBar } from '../components/navigation/BottomBar';

interface MainLayoutProps {
  children: ReactNode;
  showBottomBar?: boolean;
}

export function MainLayout({ children, showBottomBar = true }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar />

      <main className={showBottomBar ? 'pb-16' : ''}>
        {children}
      </main>

      {showBottomBar && <BottomBar />}
    </div>
  );
}
