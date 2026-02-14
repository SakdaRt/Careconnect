import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="text-5xl">⚠️</div>
            <h1 className="text-xl font-semibold text-gray-900">เกิดข้อผิดพลาด</h1>
            <p className="text-gray-600 text-sm">
              แอปพลิเคชันพบข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง
            </p>
            {(import.meta as any).env?.DEV && this.state.error && (
              <pre className="mt-2 p-3 bg-red-50 border border-red-200 rounded text-xs text-left text-red-800 overflow-auto max-h-40">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                ลองใหม่
              </button>
              <button
                onClick={() => { window.location.href = '/'; }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
              >
                กลับหน้าหลัก
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function RouteErrorFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="text-5xl">🔍</div>
        <h1 className="text-xl font-semibold text-gray-900">ไม่พบหน้าที่ต้องการ</h1>
        <p className="text-gray-600 text-sm">
          หน้านี้อาจถูกลบหรือย้ายไปแล้ว
        </p>
        <button
          onClick={() => { window.location.href = '/'; }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          กลับหน้าหลัก
        </button>
      </div>
    </div>
  );
}
