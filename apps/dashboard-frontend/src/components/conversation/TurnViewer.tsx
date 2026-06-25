import React from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Bot, User } from 'lucide-react';

interface Turn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  flagged?: boolean;
  flagPatterns?: string[];
}

interface TurnViewerProps {
  turns: Turn[];
  highlightedTurnId?: string;
  className?: string;
}

export function TurnViewer({ turns, highlightedTurnId, className }: TurnViewerProps) {
  return (
    <div className={cn('space-y-4 py-4', className)}>
      {turns.map((turn) => {
        const isUser = turn.role === 'user';
        const isHighlighted = turn.id === highlightedTurnId;

        return (
          <div
            key={turn.id}
            id={`turn-${turn.id}`}
            className={cn(
              'flex gap-3',
              isUser ? 'flex-row-reverse' : 'flex-row',
              isHighlighted && 'animate-pulse-glow rounded-2xl'
            )}
          >
            {/* Avatar */}
            <div
              className={cn(
                'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                isUser
                  ? 'bg-accent-100 dark:bg-accent-900/30 text-accent-600 dark:text-accent-400'
                  : 'bg-slate-100 dark:bg-navy-700 text-slate-500 dark:text-slate-400'
              )}
            >
              {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>

            {/* Message */}
            <div
              className={cn(
                'max-w-[75%] rounded-2xl px-4 py-3 relative',
                isUser
                  ? 'bg-accent-500 text-white rounded-tr-md'
                  : 'bg-slate-100 dark:bg-navy-700 text-navy-800 dark:text-slate-200 rounded-tl-md',
                turn.flagged && !isUser && 'ring-2 ring-warning-400/50 bg-warning-50 dark:bg-warning-900/10'
              )}
            >
              {turn.flagged && !isUser && (
                <div className="flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-warning-500" />
                  <span className="text-xs font-semibold text-warning-600 dark:text-warning-400">
                    {turn.flagPatterns?.join(', ') || 'Flagged'}
                  </span>
                </div>
              )}
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{turn.content}</p>
              <p
                className={cn(
                  'text-[10px] mt-1.5',
                  isUser ? 'text-accent-200' : 'text-slate-400 dark:text-slate-500'
                )}
              >
                {turn.timestamp}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
