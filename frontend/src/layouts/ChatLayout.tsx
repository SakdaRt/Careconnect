import { ReactNode } from 'react';
import { TopBar } from '../components/navigation/TopBar';
import { BottomBar } from '../components/navigation/BottomBar';

interface ChatLayoutProps {
  children: ReactNode;
}

export function ChatLayout({ children }: ChatLayoutProps) {
  return (
    <div className="h-dvh bg-white flex flex-col overflow-hidden">
      <TopBar />

      <main className="flex-1 flex flex-col overflow-hidden pb-16 min-h-0">
        {children}
      </main>

      <BottomBar />
    </div>
  );
}
