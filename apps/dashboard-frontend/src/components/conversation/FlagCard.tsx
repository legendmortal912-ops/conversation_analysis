import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { ChevronDown, ChevronUp, AlertTriangle, Eye } from 'lucide-react';

interface FlagCardData {
  id: string;
  pattern: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  excerpt: string;
  highlightText: string;
  turnIndex: number;
  explanation: string;
}

interface FlagCardProps {
  flag: FlagCardData;
  onViewTurn?: (turnIndex: number) => void;
  className?: string;
}

const severityConfig = {
  low: { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', bar: 'bg-blue-500', label: 'Low' },
  medium: { color: 'text-warning-600 dark:text-warning-400', bg: 'bg-warning-50 dark:bg-warning-900/20', bar: 'bg-warning-500', label: 'Medium' },
  high: { color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20', bar: 'bg-orange-500', label: 'High' },
  critical: { color: 'text-danger-600 dark:text-danger-400', bg: 'bg-danger-50 dark:bg-danger-900/20', bar: 'bg-danger-500', label: 'Critical' },
};

export function FlagCard({ flag, onViewTurn, className }: FlagCardProps) {
  const [expanded, setExpanded] = useState(false);
  const config = severityConfig[flag.severity];

  return (
    <div
      className={cn(
        'glass-card overflow-hidden transition-all duration-300',
        expanded && 'ring-1 ring-accent-200 dark:ring-accent-800',
        className
      )}
    >
      {/* Severity indicator strip */}
      <div className={cn('h-1', config.bar)} />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className={cn('h-4 w-4', config.color)} />
            <span className="text-sm font-semibold text-navy-900 dark:text-white">{flag.pattern}</span>
            <Badge
              variant={flag.severity === 'critical' ? 'danger' : flag.severity === 'high' ? 'warning' : 'default'}
            >
              {config.label}
            </Badge>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-400 transition-colors"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {/* Confidence bar */}
        <div className="mt-3 space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500 dark:text-slate-400">Confidence</span>
            <span className="text-xs font-semibold text-navy-900 dark:text-white">{(flag.confidence * 100).toFixed(0)}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 dark:bg-navy-700 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-1000', config.bar)}
              style={{ width: `${flag.confidence * 100}%` }}
            />
          </div>
        </div>

        {/* Excerpt */}
        <div className={cn('mt-3 p-3 rounded-lg text-sm', config.bg)}>
          <p className="text-navy-700 dark:text-slate-300 line-clamp-2">
            &ldquo;...{flag.excerpt}...&rdquo;
          </p>
        </div>

        {/* Expanded content */}
        {expanded && (
          <div className="mt-4 space-y-3 animate-fade-in-up">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Explanation</p>
              <p className="text-sm text-navy-700 dark:text-slate-300">{flag.explanation}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Highlighted Text</p>
              <p className="text-sm bg-warning-100 dark:bg-warning-900/20 px-2 py-1 rounded text-warning-800 dark:text-warning-300 inline">
                {flag.highlightText}
              </p>
            </div>
            {onViewTurn && (
              <button
                onClick={() => onViewTurn(flag.turnIndex)}
                className="flex items-center gap-1.5 text-sm text-accent-600 dark:text-accent-400 hover:text-accent-700 dark:hover:text-accent-300 font-medium transition-colors"
              >
                <Eye className="h-3.5 w-3.5" />
                View Turn #{flag.turnIndex}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
