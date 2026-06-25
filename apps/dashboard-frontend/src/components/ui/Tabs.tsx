import React from 'react';
import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
  variant?: 'underline' | 'pills';
}

export function Tabs({ tabs, activeTab, onChange, className, variant = 'underline' }: TabsProps) {
  if (variant === 'pills') {
    return (
      <div className={cn('flex gap-1.5 p-1 bg-slate-100 dark:bg-navy-800 rounded-xl', className)}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200',
              activeTab === tab.id
                ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-navy-700 dark:hover:text-slate-200'
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  'ml-1 px-1.5 py-0.5 text-xs rounded-full',
                  activeTab === tab.id
                    ? 'bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-400'
                    : 'bg-slate-200 text-slate-600 dark:bg-navy-600 dark:text-slate-400'
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('border-b border-slate-200 dark:border-slate-700', className)}>
      <div className="flex gap-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'text-accent-600 dark:text-accent-400'
                : 'text-slate-500 dark:text-slate-400 hover:text-navy-700 dark:hover:text-slate-200'
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  'ml-1 px-1.5 py-0.5 text-xs rounded-full',
                  activeTab === tab.id
                    ? 'bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-400'
                    : 'bg-slate-100 text-slate-600 dark:bg-navy-700 dark:text-slate-400'
                )}
              >
                {tab.count}
              </span>
            )}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-500 rounded-full" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
