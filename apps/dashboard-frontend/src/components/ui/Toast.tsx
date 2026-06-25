import React from 'react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/ui';
import { X, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorMap = {
  success: 'border-success-200 dark:border-success-800 bg-success-50 dark:bg-success-900/20',
  error: 'border-danger-200 dark:border-danger-800 bg-danger-50 dark:bg-danger-900/20',
  warning: 'border-warning-200 dark:border-warning-800 bg-warning-50 dark:bg-warning-900/20',
  info: 'border-accent-200 dark:border-accent-800 bg-accent-50 dark:bg-accent-900/20',
};

const iconColorMap = {
  success: 'text-success-500',
  error: 'text-danger-500',
  warning: 'text-warning-500',
  info: 'text-accent-500',
};

export function Toast() {
  const { toasts, removeToast } = useUIStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 max-w-sm">
      {toasts.map((toast) => {
        const Icon = iconMap[toast.type];
        return (
          <div
            key={toast.id}
            className={cn(
              'flex items-start gap-3 p-4 rounded-xl border shadow-glass-lg backdrop-blur-xl animate-slide-in-right',
              colorMap[toast.type]
            )}
          >
            <Icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', iconColorMap[toast.type])} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-navy-900 dark:text-white">{toast.title}</p>
              {toast.description && (
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{toast.description}</p>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-navy-700/50 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
