import React from 'react';
import { cn } from '@/lib/utils';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-8 text-center animate-fade-in', className)}>
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-accent-100 dark:bg-accent-900/20 rounded-full blur-xl scale-150" />
        <div className="relative p-5 rounded-2xl bg-accent-50 dark:bg-accent-900/30 text-accent-400">
          {icon || <Inbox className="h-10 w-10" />}
        </div>
      </div>
      <h3 className="text-lg font-semibold text-navy-900 dark:text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
