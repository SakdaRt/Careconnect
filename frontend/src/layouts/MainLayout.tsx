import { ReactNode } from 'react';
import { TopBar } from '../components/navigation/TopBar';
import { BottomBar } from '../components/navigation/BottomBar';

interface MainLayoutProps {
  children: ReactNode;
  showBottomBar?: boolean;
}

export function MainLayout({ children, showBottomBar = true }: MainLayoutProps) {
  // Product decision: keep bottom navigation visible on every in-app page.
  const shouldShowBottomBar = showBottomBar || showBottomBar === false;

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar />

      <main id="main-content" className={shouldShowBottomBar ? 'pb-16' : ''}>
        {children}
      </main>

      {shouldShowBottomBar && <BottomBar />}
    </div>
  );
}
