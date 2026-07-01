import React, { useState, useEffect } from 'react';
import { gql, useQuery } from '@apollo/client';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts';
import { Activity, Users, MessageSquareWarning, ShieldAlert, Bot, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

// ─── GraphQL ─────────────────────────────────────────────────────────────────

const GET_PROJECTS = gql`query GetProjects { projects { id name } }`;
const GET_METRICS = gql`
  query GetDashboard($projectId: ID!) {
    dashboardMetrics(projectId: $projectId) {
      totalConversations totalTurns flaggedTurns avgTiltScore criticalAlerts patternCounts
      dailyStats { date conversations flags avgScore }
    }
  }
`;

// No static demo data needed

// ─── Helpers ─────────────────────────────────────────────────────────────────

function gradeOf(score: number) {
  if (score >= 90) return { label: 'A', color: 'text-emerald-400' };
  if (score >= 80) return { label: 'B', color: 'text-emerald-400' };
  if (score >= 70) return { label: 'C', color: 'text-amber-400' };
  if (score >= 60) return { label: 'D', color: 'text-amber-400' };
  return { label: 'F', color: 'text-red-400' };
}

const PATTERN_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#8b5cf6', '#6366f1'];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ title, value, sub, icon: Icon, accent = '#6366f1' }: {
  title: string; value: string; sub?: string; icon: React.ElementType; accent?: string;
}) {
  return (
    <div className="convo-card p-5">
      <div className="flex items-start justify-between mb-4">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
        <div className="p-2 rounded-xl" style={{ backgroundColor: accent + '22' }}>
          <Icon className="w-4 h-4" style={{ color: accent }} />
        </div>
      </div>
      <p className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data: projectsData, loading: projectsLoading } = useQuery(GET_PROJECTS);
  const projects: any[] = projectsData?.projects ?? [];
  const [selectedProject, setSelectedProject] = useState('');
  useEffect(() => {
    if (projects.length > 0 && !selectedProject) setSelectedProject(projects[0].id);
  }, [projects]);

  const { data, loading } = useQuery(GET_METRICS, {
    variables: { projectId: selectedProject },
    skip: !selectedProject,
  });

  // Determine which metrics to use
  const liveMetrics = data?.dashboardMetrics;
  const hasLive = !!(liveMetrics && liveMetrics.totalConversations > 0);
  const metrics = hasLive ? liveMetrics : null;

  const showLoader = projectsLoading || (loading && !hasLive);

  if (showLoader) {
    return (
      <div className="flex justify-center py-24">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  const patternEntries = metrics
    ? Object.entries((metrics.patternCounts as Record<string, number>) ?? {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
    : [];

  const avgScore = metrics ? Math.round(metrics.avgTiltScore) : 0;
  const grade = gradeOf(avgScore);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Overview</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time analysis of your AI model fleet
          </p>
        </div>
        <div className="flex items-center gap-3">
          {projects.length > 0 && (
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="bg-slate-800 border border-slate-700/60 text-slate-300 text-sm rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {!metrics ? (
        /* No data at all */
        <div className="flex flex-col items-center justify-center py-24 text-center convo-card">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4">
            <ShieldAlert className="h-8 w-8 text-indigo-400" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">No data yet</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm mb-6">
            Start sending conversations via the SDK or visit the Playground to analyze your first conversation.
          </p>
          <Link
            to="/playground"
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-500/20"
          >
            Open Playground
          </Link>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Fleet Avg TiltScore"
              value={`${avgScore}`}
              sub={`Grade ${grade.label} — ${avgScore >= 70 ? 'Healthy' : avgScore >= 40 ? 'Concerning' : 'Critical'}`}
              icon={Activity}
              accent="#6366f1"
            />
            <StatCard
              title="Conversations"
              value={metrics.totalConversations.toLocaleString()}
              sub="Total analyzed"
              icon={Users}
              accent="#10b981"
            />
            <StatCard
              title="Flagged"
              value={metrics.flaggedTurns.toLocaleString()}
              sub={`${((metrics.flaggedTurns / metrics.totalConversations) * 100).toFixed(1)}% flag rate`}
              icon={MessageSquareWarning}
              accent="#f59e0b"
            />
            <StatCard
              title="Pending Alerts"
              value={String(metrics.criticalAlerts)}
              sub="Require review"
              icon={ShieldAlert}
              accent="#ef4444"
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* TiltScore trend */}
            <div className="lg:col-span-2 convo-card p-6">
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="h-4 w-4 text-indigo-400" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">TiltScore™ Trend — Last 7 Days</h2>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics.dailyStats ?? []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                    <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} dy={8} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', fontSize: '12px' }}
                      labelStyle={{ color: '#94a3b8' }}
                      itemStyle={{ color: '#c7d2fe' }}
                    />
                    <Area type="monotone" dataKey="avgScore" name="Avg TiltScore" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#scoreGrad)" dot={{ fill: '#6366f1', r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Pattern breakdown */}
            <div className="convo-card p-6">
              <div className="flex items-center gap-2 mb-6">
                <Bot className="h-4 w-4 text-purple-400" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Top Patterns</h2>
              </div>
              {patternEntries.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-slate-500 text-sm">No flags detected</div>
              ) : (
                <div className="space-y-4">
                  {patternEntries.map(([name, count], i) => {
                    const max = patternEntries[0][1] as number;
                    return (
                      <div key={name}>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-slate-700 dark:text-slate-300 font-medium capitalize">{name.replace(/_/g, ' ')}</span>
                          <span className="text-slate-500 tabular-nums">{(count as number).toLocaleString()}</span>
                        </div>
                        <div className="w-full bg-slate-700/50 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full transition-all"
                            style={{ width: `${((count as number) / max) * 100}%`, backgroundColor: PATTERN_COLORS[i] }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Daily bar chart */}
          <div className="convo-card p-6">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-6">Daily Conversations — Last 7 Days</h2>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.dailyStats ?? []} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                  <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', fontSize: '12px' }}
                    labelStyle={{ color: '#94a3b8' }}
                    itemStyle={{ color: '#c7d2fe' }}
                  />
                  <Bar dataKey="conversations" name="Conversations" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="flags" name="Flags" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
