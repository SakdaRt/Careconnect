import { ReactNode, useState } from 'react';
import { cn } from '../../contexts/ThemeContext';

export interface Tab {
  id: string;
  label: string;
  count?: number;
  icon?: ReactNode;
  content?: ReactNode;
}

export interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  onChange?: (tabId: string) => void;
  variant?: 'line' | 'pills';
  fullWidth?: boolean;
}

export function Tabs({ tabs, defaultTab, onChange, variant = 'line', fullWidth = false }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    onChange?.(tabId);
  };

  const activeTabContent = tabs.find(tab => tab.id === activeTab)?.content;

  if (variant === 'pills') {
    return (
      <div>
        {/* Pills Tabs */}
        <div className={cn('flex gap-2 mb-4', fullWidth ? 'w-full' : 'flex-wrap')}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                'px-4 py-2 rounded-lg font-medium transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                fullWidth && 'flex-1',
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              <span className="flex items-center gap-2 justify-center">
                {tab.icon}
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-full',
                      activeTab === tab.id
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-700'
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTabContent && <div>{activeTabContent}</div>}
      </div>
    );
  }

  // Line variant (default)
  return (
    <div>
      {/* Line Tabs */}
      <div className="border-b border-gray-200 mb-4">
        <div className={cn('flex gap-8', fullWidth && 'justify-around')}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                'pb-3 font-medium transition-colors relative',
                'focus:outline-none focus:ring-0',
                activeTab === tab.id
                  ? 'text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <span className="flex items-center gap-2">
                {tab.icon}
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-full',
                      activeTab === tab.id
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600'
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </span>

              {/* Active indicator */}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTabContent && <div>{activeTabContent}</div>}
    </div>
  );
}

// Simple Tab Panels (for controlled tabs)
export interface TabPanelProps {
  value: string;
  activeValue: string;
  children: ReactNode;
}

export function TabPanel({ value, activeValue, children }: TabPanelProps) {
  if (value !== activeValue) return null;
  return <div>{children}</div>;
}
