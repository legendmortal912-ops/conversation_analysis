import React, { useState, useEffect } from 'react';
import { ShieldAlert, Filter, Bell, CheckCircle, AlertTriangle, TrendingDown, Clock, Bot } from 'lucide-react';
import { Link } from 'react-router-dom';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AlertItem {
  id: string;
  model: string;
  conversationId: string;
  pattern: string;
  tiltScore: number;
  message: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'PENDING' | 'ACKNOWLEDGED';
  createdAt: string;
}

// ─── Mock Alerts derived from seeded flag data ─────────────────────────────────

const PATTERN_LABELS: Record<string, string> = {
  false_urgency: 'False Urgency',
  topic_hijacking: 'Topic Hijacking',
  concern_dismissal: 'Concern Dismissal',
  opinion_injection: 'Opinion Injection',
  agenda_persistence: 'Agenda Persistence',
};

const PATTERN_COLORS: Record<string, string> = {
  false_urgency: 'bg-red-500/10 text-red-400 border-red-500/20',
  topic_hijacking: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  concern_dismissal: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  opinion_injection: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  agenda_persistence: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
};

function generateMockAlerts(): AlertItem[] {
  const models = ['Loan Advisor Bot', 'Customer Support AI', 'Investment Advisory', 'KYC Assistant'];
  const patterns = ['false_urgency', 'topic_hijacking', 'concern_dismissal', 'opinion_injection', 'agenda_persistence'];
  const messages: Record<string, string> = {
    false_urgency: 'AI created artificial time pressure to rush user decision.',
    topic_hijacking: 'AI redirected conversation away from user concern to promote product.',
    concern_dismissal: 'AI acknowledged then immediately bypassed user concern without resolution.',
    opinion_injection: 'AI presented unverified claim as established expert consensus.',
    agenda_persistence: 'AI repeatedly returned to product promotion despite user resistance.',
  };

  const alerts: AlertItem[] = [];
  const now = Date.now();

  // Generate 18 realistic alerts
  const seed = [
    { model: 'Investment Advisory', pattern: 'false_urgency', score: 22.4, status: 'PENDING' as const, hoursAgo: 0.5 },
    { model: 'Investment Advisory', pattern: 'agenda_persistence', score: 28.1, status: 'PENDING' as const, hoursAgo: 1.2 },
    { model: 'Customer Support AI', pattern: 'concern_dismissal', score: 35.7, status: 'PENDING' as const, hoursAgo: 2.1 },
    { model: 'Investment Advisory', pattern: 'opinion_injection', score: 31.0, status: 'PENDING' as const, hoursAgo: 3.4 },
    { model: 'Loan Advisor Bot', pattern: 'topic_hijacking', score: 38.9, status: 'PENDING' as const, hoursAgo: 5.0 },
    { model: 'Customer Support AI', pattern: 'false_urgency', score: 41.2, status: 'ACKNOWLEDGED' as const, hoursAgo: 8.0 },
    { model: 'Investment Advisory', pattern: 'concern_dismissal', score: 19.5, status: 'ACKNOWLEDGED' as const, hoursAgo: 12.0 },
    { model: 'KYC Assistant', pattern: 'opinion_injection', score: 37.8, status: 'PENDING' as const, hoursAgo: 14.0 },
    { model: 'Loan Advisor Bot', pattern: 'agenda_persistence', score: 42.3, status: 'ACKNOWLEDGED' as const, hoursAgo: 18.0 },
    { model: 'Investment Advisory', pattern: 'false_urgency', score: 25.6, status: 'ACKNOWLEDGED' as const, hoursAgo: 22.0 },
    { model: 'Customer Support AI', pattern: 'topic_hijacking', score: 44.1, status: 'ACKNOWLEDGED' as const, hoursAgo: 26.0 },
    { model: 'Investment Advisory', pattern: 'agenda_persistence', score: 30.3, status: 'ACKNOWLEDGED' as const, hoursAgo: 31.0 },
  ];

  seed.forEach((s, i) => {
    alerts.push({
      id: `alert_${i + 1}`,
      model: s.model,
      conversationId: `conv_${Math.random().toString(36).slice(2, 10)}`,
      pattern: s.pattern,
      tiltScore: s.score,
      message: messages[s.pattern],
      severity: s.score < 30 ? 'HIGH' : s.score < 40 ? 'MEDIUM' : 'LOW',
      status: s.status,
      createdAt: new Date(now - s.hoursAgo * 3600 * 1000).toISOString(),
    });
  });

  return alerts;
}

// ─── Helper components ─────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function severityBadge(severity: AlertItem['severity']) {
  const styles = {
    HIGH: 'bg-red-500/10 text-red-400 border border-red-500/20',
    MEDIUM: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    LOW: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider ${styles[severity]}`}>
      {severity}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

import { useQuery, useMutation, gql } from '@apollo/client';

const GET_ALERTS = gql`
  query GetAlerts($limit: Int) {
    alerts(limit: $limit) {
      id
      message
      status
      createdAt
      tiltScore
      pattern
      severity
      modelName
      conversationId
    }
  }
`;

export default function Alerts() {
  const [filter, setFilter] = useState<'all' | 'pending' | 'acknowledged'>('all');
  const [modelFilter, setModelFilter] = useState('all');

  const { data, loading, error } = useQuery(GET_ALERTS, {
    variables: { limit: 100 },
    pollInterval: 10000, // refresh every 10s
  });

  const alerts: AlertItem[] = data?.alerts?.map((a: any) => ({
    id: a.id,
    model: a.modelName || 'Unknown Model',
    conversationId: a.conversationId || '',
    pattern: a.pattern ? a.pattern.toLowerCase() : 'unknown',
    tiltScore: a.tiltScore,
    message: a.message,
    severity: a.severity || 'LOW',
    status: a.status,
    createdAt: a.createdAt,
  })) || [];

  const models = ['all', ...Array.from(new Set(alerts.map((a) => a.model)))];

  const filtered = alerts.filter((a) => {
    if (filter === 'pending' && a.status !== 'PENDING') return false;
    if (filter === 'acknowledged' && a.status !== 'ACKNOWLEDGED') return false;
    if (modelFilter !== 'all' && a.model !== modelFilter) return false;
    return true;
  });

  const pendingCount = alerts.filter((a) => a.status === 'PENDING').length;

const ACKNOWLEDGE_ALERT = gql`
  mutation AcknowledgeAlert($alertId: ID!) {
    acknowledgeAlert(alertId: $alertId) {
      id
      status
    }
  }
`;

  const [ackAlert] = useMutation(ACKNOWLEDGE_ALERT, {
    refetchQueries: [{ query: GET_ALERTS, variables: { limit: 100 } }],
  });

  const handleAck = (id: string) => {
    ackAlert({ variables: { alertId: id } });
  };

  const handleAckAll = () => {
    alerts.filter((a) => a.status === 'PENDING').forEach((a) => {
      ackAlert({ variables: { alertId: a.id } });
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Alerts</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manipulation detection triggers across all AI models</p>
        </div>
        {pendingCount > 0 && (
          <button
            onClick={handleAckAll}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
          >
            <CheckCircle className="h-4 w-4" />
            Acknowledge All ({pendingCount})
          </button>
        )}
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pending Review', value: alerts.filter((a) => a.status === 'PENDING').length, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
          { label: 'High Severity', value: alerts.filter((a) => a.severity === 'HIGH').length, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
          { label: 'Acknowledged', value: alerts.filter((a) => a.status === 'ACKNOWLEDGED').length, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`convo-card ${bg} p-4 flex items-center gap-3`}>
            <div className={`text-3xl font-black tabular-nums ${color}`}>{value}</div>
            <div className="text-sm text-slate-400">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-xl border border-slate-700/60 overflow-hidden">
          {(['all', 'pending', 'acknowledged'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 text-sm font-medium transition-colors capitalize ${
                filter === f
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`}
            >
              {f === 'all' ? 'All Alerts' : f === 'pending' ? 'Pending' : 'Acknowledged'}
            </button>
          ))}
        </div>
        <select
          value={modelFilter}
          onChange={(e) => setModelFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 text-sm focus:outline-none focus:border-indigo-500/60"
        >
          {models.map((m) => (
            <option key={m} value={m}>{m === 'all' ? 'All Models' : m}</option>
          ))}
        </select>
        <Filter className="h-4 w-4 text-slate-500" />
        <span className="text-sm text-slate-500">{filtered.length} alert{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Alert list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center convo-card">
          <CheckCircle className="h-10 w-10 text-emerald-400 mb-3" />
          <p className="font-medium text-white mb-1">All clear!</p>
          <p className="text-sm text-slate-400">No alerts match your current filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((alert) => (
            <div
              key={alert.id}
              className={`convo-card p-5 flex items-start gap-4 ${
                alert.status === 'PENDING'
                  ? 'border-red-500/40 shadow-red-500/10'
                  : 'opacity-90 hover:opacity-100 grayscale-[0.2]'
              }`}
            >
              {/* Icon */}
              <div className={`p-2.5 rounded-xl flex-shrink-0 ${
                alert.status === 'PENDING' ? 'bg-red-500/20 text-red-400' : 'bg-slate-700/50 text-slate-500'
              }`}>
                {alert.status === 'PENDING' ? <ShieldAlert className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {severityBadge(alert.severity)}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${PATTERN_COLORS[alert.pattern] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                      {PATTERN_LABELS[alert.pattern] || 'General Flag'}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-slate-500">
                      <Bot className="h-3 w-3" />{alert.model}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-sm font-bold tabular-nums ${alert.tiltScore < 30 ? 'text-red-400' : alert.tiltScore < 40 ? 'text-amber-400' : 'text-orange-400'}`}>
                      TS {alert.tiltScore.toFixed(0)}
                    </span>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" />{timeAgo(alert.createdAt)}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">{alert.message}</p>

                <div className="flex gap-2">
                  {alert.status === 'PENDING' && (
                    <button
                      onClick={() => handleAck(alert.id)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-200 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                    >
                      Acknowledge
                    </button>
                  )}
                  <Link
                    to={`/conversations/${alert.conversationId}`}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors"
                  >
                    View Conversation
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
