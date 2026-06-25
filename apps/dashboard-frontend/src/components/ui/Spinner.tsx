import React from 'react';
import { cn } from '@/lib/utils';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-3',
};

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <div
      className={cn(
        'animate-spin rounded-full border-accent-200 dark:border-accent-800 border-t-accent-500',
        sizeClasses[size],
        className
      )}
    />
  );
}

interface FullPageSpinnerProps {
  message?: string;
}

export function FullPageSpinner({ message = 'Loading...' }: FullPageSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 animate-fade-in">
      <div className="relative">
        <div className="h-14 w-14 rounded-full border-4 border-accent-100 dark:border-accent-900" />
        <div className="absolute inset-0 h-14 w-14 rounded-full border-4 border-transparent border-t-accent-500 animate-spin" />
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{message}</p>
    </div>
  );
}
