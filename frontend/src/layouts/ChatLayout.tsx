import { ReactNode } from 'react';
import { TopBar } from '../components/navigation/TopBar';

interface ChatLayoutProps {
  children: ReactNode;
}

export function ChatLayout({ children }: ChatLayoutProps) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <TopBar />

      {/* Chat content fills remaining space */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>

      {/* No BottomBar in Chat Room */}
    </div>
  );
}
