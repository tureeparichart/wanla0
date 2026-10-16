import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in Application:', error, errorInfo);
  }

  private handleResetData = () => {
    try {
      localStorage.clear();
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-100 text-slate-800 flex items-center justify-center p-4 font-['Prompt',sans-serif]">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 p-6 sm:p-8 text-center animate-in fade-in">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>
            
            <h1 className="text-xl font-bold text-slate-800 mb-2">
              ระบบจัดการวันลา โรงเรียนบ้านห้วยไคร้
            </h1>
            <p className="text-sm text-slate-600 mb-6">
              เกิดข้อผิดพลาดในการโหลดหน้าเว็บชั่วคราว ไม่ต้องกังวล ข้อมูลของคุณยังปลอดภัย
            </p>

            {this.state.error?.message && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left text-xs text-slate-600 mb-6 max-h-32 overflow-y-auto font-mono">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReload}
                className="flex items-center justify-center gap-2 bg-blue-900 hover:bg-blue-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>รีเฟรชหน้าเว็บ</span>
              </button>
              
              <button
                onClick={this.handleResetData}
                className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer"
                title="ล้างแคชในเบราว์เซอร์แล้วโหลดใหม่"
              >
                <RotateCcw className="w-4 h-4 text-slate-500" />
                <span>ล้างแคชเครื่องนี้</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
