import React from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { SparkLine } from '@/components/charts/SparkLine';

interface KPICardProps {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  sparkData?: number[];
  className?: string;
  loading?: boolean;
}

export function KPICard({ label, value, change, changeLabel, icon, sparkData, className, loading }: KPICardProps) {
  if (loading) {
    return (
      <div className={cn('glass-card p-6 space-y-3', className)}>
        <div className="skeleton h-4 w-24" />
        <div className="skeleton h-8 w-32" />
        <div className="skeleton h-3 w-20" />
      </div>
    );
  }

  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;
  const isNeutral = change === undefined || change === 0;

  return (
    <div className={cn('glass-card-hover p-6 group', className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="stat-value text-navy-900 dark:text-white group-hover:gradient-text transition-all duration-500">
            {value}
          </p>
          {change !== undefined && (
            <div className="flex items-center gap-1.5">
              {isPositive && <TrendingUp className="h-3.5 w-3.5 text-success-500" />}
              {isNegative && <TrendingDown className="h-3.5 w-3.5 text-danger-500" />}
              {isNeutral && <Minus className="h-3.5 w-3.5 text-slate-400" />}
              <span
                className={cn(
                  'text-xs font-semibold',
                  isPositive && 'text-success-600 dark:text-success-400',
                  isNegative && 'text-danger-600 dark:text-danger-400',
                  isNeutral && 'text-slate-400'
                )}
              >
                {isPositive ? '+' : ''}
                {change}%
              </span>
              {changeLabel && <span className="text-xs text-slate-400 dark:text-slate-500">{changeLabel}</span>}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-3">
          {icon && (
            <div className="p-2.5 rounded-xl bg-accent-50 dark:bg-accent-900/20 text-accent-500 group-hover:scale-110 transition-transform duration-300">
              {icon}
            </div>
          )}
          {sparkData && sparkData.length > 0 && (
            <div className="w-20 h-8">
              <SparkLine data={sparkData} color={isNegative ? '#EF4444' : '#10B981'} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
