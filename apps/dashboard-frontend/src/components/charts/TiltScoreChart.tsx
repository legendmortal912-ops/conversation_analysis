import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { cn } from '@/lib/utils';

interface DataPoint {
  date: string;
  score: number;
  [key: string]: string | number;
}

interface TiltScoreChartProps {
  data: DataPoint[];
  height?: number;
  showArea?: boolean;
  className?: string;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const score = payload[0]?.value ?? 0;
  const color = score >= 80 ? '#10B981' : score >= 65 ? '#F59E0B' : '#EF4444';

  return (
    <div className="bg-white dark:bg-navy-800 rounded-xl px-4 py-3 shadow-glass-lg border border-slate-200/50 dark:border-slate-700/50">
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</p>
      <p className="text-lg font-bold" style={{ color }}>
        {score.toFixed(1)}
      </p>
    </div>
  );
}

export function TiltScoreChart({ data, height = 300, showArea = true, className }: TiltScoreChartProps) {
  const Chart = showArea ? AreaChart : LineChart;

  return (
    <div className={cn('w-full', className)}>
      <ResponsiveContainer width="100%" height={height}>
        <Chart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <defs>
            <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366F1" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="currentColor"
            className="text-slate-100 dark:text-slate-800"
          />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#94a3b8' }}
            dy={10}
          />
          <YAxis
            domain={[0, 100]}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#94a3b8' }}
            dx={-10}
          />
          <Tooltip content={<CustomTooltip />} />
          {showArea && (
            <Area
              type="monotone"
              dataKey="score"
              fill="url(#scoreGradient)"
              stroke="none"
              isAnimationActive={true}
              animationDuration={1500}
            />
          )}
          <Line
            type="monotone"
            dataKey="score"
            stroke="#6366F1"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 6, fill: '#6366F1', stroke: '#fff', strokeWidth: 2 }}
            isAnimationActive={true}
            animationDuration={1500}
          />
        </Chart>
      </ResponsiveContainer>
    </div>
  );
}
