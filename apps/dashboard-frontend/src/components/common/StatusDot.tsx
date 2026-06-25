import React from 'react';
import { cn } from '@/lib/utils';

type StatusType = 'online' | 'offline' | 'warning' | 'danger' | 'idle';

interface StatusDotProps {
  status: StatusType;
  label?: string;
  className?: string;
  pulse?: boolean;
}

const colorMap: Record<StatusType, string> = {
  online: 'bg-success-500',
  offline: 'bg-slate-400',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  idle: 'bg-slate-300 dark:bg-slate-600',
};

const pulseMap: Record<StatusType, string> = {
  online: 'bg-success-400',
  offline: 'bg-slate-300',
  warning: 'bg-warning-400',
  danger: 'bg-danger-400',
  idle: 'bg-slate-200',
};

export function StatusDot({ status, label, className, pulse = false }: StatusDotProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className="relative flex h-2.5 w-2.5">
        {pulse && (
          <span
            className={cn(
              'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
              pulseMap[status]
            )}
          />
        )}
        <span className={cn('relative inline-flex rounded-full h-2.5 w-2.5', colorMap[status])} />
      </span>
      {label && <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>}
    </span>
  );
}
