import { ReactNode } from 'react';

interface PlaceholderPageProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export function PlaceholderPage({ title, description, children }: PlaceholderPageProps) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">{title}</h1>
        {description && (
          <p className="text-gray-600 mb-6">{description}</p>
        )}
        {children || (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
            <p className="text-blue-800">
              หน้านี้กำลังพัฒนา (Placeholder)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
