import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from '@/lib/utils';

interface PatternData {
  name: string;
  value: number;
  color: string;
}

interface PatternDonutProps {
  data: PatternData[];
  height?: number;
  className?: string;
}

const COLORS = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#F97316', '#14B8A6'];

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: PatternData }> }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="bg-white dark:bg-navy-800 rounded-xl px-4 py-3 shadow-glass-lg border border-slate-200/50 dark:border-slate-700/50">
      <p className="text-xs text-slate-500 dark:text-slate-400">{item?.name}</p>
      <p className="text-lg font-bold text-navy-900 dark:text-white">{item?.value}</p>
    </div>
  );
}

export function PatternDonut({ data, height = 260, className }: PatternDonutProps) {
  const coloredData = data.map((d, i) => ({
    ...d,
    color: d.color || COLORS[i % COLORS.length]!,
  }));
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className={cn('relative', className)}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={coloredData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={3}
            dataKey="value"
            stroke="none"
            isAnimationActive={true}
            animationDuration={1200}
            animationBegin={200}
          >
            {coloredData.map((entry, index) => (
              <Cell key={index} fill={entry.color} className="hover:opacity-80 transition-opacity cursor-pointer" />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      {/* Center Label */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <p className="text-2xl font-bold text-navy-900 dark:text-white">{total}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Total</p>
        </div>
      </div>
      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-4">
        {coloredData.map((entry, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-xs text-slate-600 dark:text-slate-400">{entry.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
