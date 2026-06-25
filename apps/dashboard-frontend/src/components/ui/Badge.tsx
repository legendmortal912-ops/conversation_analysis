import React from 'react';
import { cn, getGradeBg } from '@/lib/utils';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'grade';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  grade?: string;
  className?: string;
  pulse?: boolean;
}

const variantClasses: Record<Exclude<BadgeVariant, 'grade'>, string> = {
  default: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  success: 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400',
  warning: 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400',
  danger: 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400',
  info: 'bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400',
};

export function Badge({ children, variant = 'default', grade, className, pulse }: BadgeProps) {
  const classes =
    variant === 'grade' && grade ? getGradeBg(grade) : variantClasses[variant === 'grade' ? 'default' : variant];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-300',
        classes,
        pulse && 'animate-pulse-glow',
        className
      )}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-current" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
        </span>
      )}
      {children}
    </span>
  );
}

interface ScoreBadgeProps {
  score: number;
  className?: string;
}

export function ScoreBadge({ score, className }: ScoreBadgeProps) {
  const grade =
    score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 65 ? 'C' : score >= 50 ? 'D' : 'F';

  return (
    <Badge variant="grade" grade={grade} className={cn('tabular-nums', className)}>
      {grade} · {score.toFixed(1)}
    </Badge>
  );
}
