import React from 'react';
import { LineChart, Line, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts';
import { cn } from '@/lib/utils';

interface ScorePoint {
  turn: number;
  score: number;
}

interface ScoreTimelineProps {
  data: ScorePoint[];
  height?: number;
  className?: string;
  threshold?: number;
}

function MiniTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ScorePoint }> }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="bg-white dark:bg-navy-800 rounded-lg px-3 py-2 shadow-glass border border-slate-200/50 dark:border-slate-700/50">
      <p className="text-[10px] text-slate-400">Turn {point.turn}</p>
      <p className="text-sm font-bold text-navy-900 dark:text-white">{point.score.toFixed(1)}</p>
    </div>
  );
}

export function ScoreTimeline({ data, height = 80, className, threshold = 65 }: ScoreTimelineProps) {
  return (
    <div className={cn('w-full', className)}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <ReferenceLine y={threshold} stroke="#F59E0B" strokeDasharray="3 3" strokeOpacity={0.5} />
          <Tooltip content={<MiniTooltip />} />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#6366F1"
            strokeWidth={2}
            dot={{ r: 3, fill: '#6366F1', stroke: '#fff', strokeWidth: 1.5 }}
            activeDot={{ r: 5, fill: '#6366F1', stroke: '#fff', strokeWidth: 2 }}
            isAnimationActive={true}
            animationDuration={800}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
