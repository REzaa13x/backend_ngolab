import React from 'react';
import { AlertTriangle, RefreshCw, LogOut } from 'lucide-react';

interface ErrorBoundaryProps {
  children: any;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends (React.Component as any) {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  handleReset = () => {
    localStorage.removeItem('tangolab_admin_user');
    localStorage.removeItem('tangolab_active_role');
    localStorage.removeItem('tangolab_login_timestamp');
    localStorage.removeItem('tangolab_auth_token');
    window.location.href = '/';
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white">
          <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-8 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-2xl flex items-center justify-center mx-auto border border-red-500/20">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Terjadi Kendala Memuat Antarmuka</h2>
              <p className="text-sm text-slate-400 mt-2">
                {this.state.error?.message || 'Gagal merender komponen halaman.'}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" /> Muat Ulang
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" /> Reset Sesi
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
