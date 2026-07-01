import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Bot, Activity, AlertTriangle,
  ChevronRight, Zap, BarChart3, X, Server, Loader2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PatternRate {
  false_urgency: number;
  topic_hijacking: number;
  concern_dismissal: number;
  opinion_injection: number;
  agenda_persistence: number;
}

interface ModelCard {
  id: string;
  name: string;
  aiSystemName: string;
  alertThreshold: number;
  tiltScore: number | null;
  totalConversations: number;
  patternRates: PatternRate;
  environment: string;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tiltColor(score: number | null | undefined): string {
  if (score == null) return 'text-slate-400';
  if (score <= 35) return 'text-emerald-400';
  if (score <= 60) return 'text-amber-400';
  return 'text-red-400';
}

function tiltBg(score: number | null | undefined): string {
  if (score == null) return 'border-slate-300 dark:border-slate-700/40';
  if (score <= 35) return 'border-emerald-500/40 shadow-emerald-500/10';
  if (score <= 60) return 'border-amber-500/40 shadow-amber-500/10';
  return 'border-red-500/40 shadow-red-500/10';
}

function envBadge(env: string) {
  const lower = env.toLowerCase();
  if (lower === 'production')
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">PROD</span>;
  if (lower === 'staging')
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">STAGING</span>;
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-500/20 text-slate-400 border border-slate-500/30">DEV</span>;
}

const PATTERN_LABELS: Record<string, string> = {
  false_urgency: 'Urgency',
  topic_hijacking: 'Hijack',
  concern_dismissal: 'Dismiss',
  opinion_injection: 'Opinion',
  agenda_persistence: 'Agenda',
};

const PATTERN_COLORS: Record<string, string> = {
  false_urgency: 'bg-red-500',
  topic_hijacking: 'bg-orange-500',
  concern_dismissal: 'bg-amber-500',
  opinion_injection: 'bg-purple-500',
  agenda_persistence: 'bg-pink-500',
};

// ─── Register Modal ───────────────────────────────────────────────────────────

interface RegisterModalProps {
  onClose: () => void;
  onAdd: (model: ModelCard) => void;
}

function RegisterModelModal({ onClose, onAdd }: RegisterModalProps) {
  const [name, setName] = useState('');
  const [aiSystemName, setAiSystemName] = useState('');
  const [environment, setEnvironment] = useState('production');
  const [alertThreshold, setAlertThreshold] = useState(60);

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !aiSystemName.trim()) return;
    
    setLoading(true);
    try {
      const res = await fetch('/api/v1/models', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_name: name.trim(),
          environment: aiSystemName.trim(), // The REST backend maps environment -> aiSystemName in DB
          alert_threshold: alertThreshold,
          description: environment
        })
      });

      if (res.ok) {
        const data = await res.json();
        const newModel: ModelCard = {
          id: data.model_id,
          name: data.model_name,
          aiSystemName: data.environment,
          alertThreshold: data.alert_threshold,
          tiltScore: null, // new — no conversations yet
          totalConversations: 0,
          patternRates: { false_urgency: 0, topic_hijacking: 0, concern_dismissal: 0, opinion_injection: 0, agenda_persistence: 0 },
          environment: environment, // preserve original selection
          createdAt: data.created_at,
        };
        onAdd(newModel);
        onClose();
      } else {
        console.error("Failed to register model", await res.text());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#0f1629] border border-slate-700/60 rounded-2xl shadow-2xl p-6">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors">
          <X className="h-4 w-4" />
        </button>

        <h2 className="text-lg font-bold text-white mb-1">Register New Model</h2>
        <p className="text-sm text-slate-400 mb-6">Add an AI model to start monitoring its conversations.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Model Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Loan Advisor Bot"
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">System Identifier</label>
            <input
              value={aiSystemName}
              onChange={(e) => setAiSystemName(e.target.value)}
              placeholder="loan-advisor-v2"
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-white text-sm placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Environment</label>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-white text-sm focus:outline-none focus:border-indigo-500/60"
            >
              <option value="production">Production</option>
              <option value="staging">Staging</option>
              <option value="development">Development</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
              Alert Threshold — TiltScore above {alertThreshold} fires alert
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range" min={10} max={90} value={alertThreshold}
                onChange={(e) => setAlertThreshold(Number(e.target.value))}
                className="flex-1 accent-indigo-500"
              />
              <span className={`text-lg font-bold w-10 text-right ${tiltColor(alertThreshold)}`}>{alertThreshold}</span>
            </div>
          </div>
          <button
            type="submit"
            disabled={!name.trim() || !aiSystemName.trim() || loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-semibold transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/20"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {loading ? 'Registering...' : 'Register Model'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Model Card ───────────────────────────────────────────────────────────────

function ModelCardComponent({ model, onClick }: { model: ModelCard; onClick: () => void }) {
  if (!model) return null;
  const safeRates = model.patternRates ?? { false_urgency: 0, topic_hijacking: 0, concern_dismissal: 0, opinion_injection: 0, agenda_persistence: 0 };
  const patterns = Object.entries(safeRates) as [keyof PatternRate, number][];
  const maxRate = Math.max(...Object.values(safeRates), 1);

  return (
    <div
      onClick={onClick}
      className={`group relative cursor-pointer convo-card ${tiltBg(model.tiltScore)} p-6`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center">
              <Bot className="h-4 w-4 text-indigo-400" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{model.name}</h3>
          </div>
          <div className="flex items-center gap-2">
            {envBadge(model.environment)}
            <span className="text-[10px] text-slate-500 font-mono">{model.aiSystemName}</span>
            <span className="text-[10px] text-slate-400 font-mono ml-2 border-l border-slate-600 pl-2" title="Project ID">ID: {model.id}</span>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-4xl font-black tabular-nums ${tiltColor(model.tiltScore)}`}>
            {model.tiltScore != null ? Math.round(model.tiltScore) : '—'}
          </div>
          <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">TiltScore</div>
        </div>
      </div>

      {/* Pattern bars */}
      <div className="space-y-1.5 mb-4">
        {patterns.map(([key, rate]) => (
          <div key={key} className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 w-14 text-right flex-shrink-0">{PATTERN_LABELS[key]}</span>
            <div className="flex-1 h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${PATTERN_COLORS[key]}`}
                style={{ width: `${Math.min((rate / maxRate) * 100, 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400 w-8 tabular-nums">{(rate ?? 0).toFixed(1)}%</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-700/40">
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Activity className="h-3 w-3" />
            {(model.totalConversations ?? 0).toLocaleString()} convos
          </span>
          {model.tiltScore != null && model.alertThreshold != null && model.tiltScore > model.alertThreshold && (
            <span className="flex items-center gap-1 text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              Above threshold ({model.alertThreshold})
            </span>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-indigo-400 transition-colors" />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Models() {
  const navigate = useNavigate();
  const [models, setModels] = useState<ModelCard[] | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [liveData, setLiveData] = useState(false);

  // Try to fetch live data in background — never blocks render
  useEffect(() => {
    fetch('/api/v1/models', {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const rawList =
          Array.isArray(data?.models) ? data.models :
          Array.isArray(data?.data) ? data.data :
          Array.isArray(data) ? data :
          null;
        
        if (rawList) {
          const list: ModelCard[] = rawList.map((m: any) => ({
            id: m.model_id || m.id,
            name: m.model_name || m.name,
            aiSystemName: m.environment || m.aiSystemName || '',
            environment: m.environment || 'production',
            alertThreshold: m.alert_threshold || m.alertThreshold || 60,
            tiltScore: m.stats?.tilt_p50 ?? m.tiltScore ?? 0,
            totalConversations: m.stats?.total_conversations ?? m.totalConversations ?? 0,
            patternRates: m.stats?.pattern_rates || m.patternRates || {},
            createdAt: m.created_at || m.createdAt || new Date().toISOString()
          }));
          setModels(list);
          setLiveData(true);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch models:', err);
        setModels([]);
      });
  }, []);

  if (models === null) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  const criticalCount = models.filter((m) => (m.tiltScore ?? 0) > 80).length;
  const concerningCount = models.filter((m) => (m.tiltScore ?? 0) >= 40 && (m.tiltScore ?? 0) <= 80).length;
  const healthyCount = models.filter((m) => (m.tiltScore ?? 101) < 40).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Models Fleet</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Monitor all registered AI models across your organization</p>
        </div>
        <button
          onClick={() => setShowRegister(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20"
        >
          <Plus className="h-4 w-4" />
          Register New Model
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Healthy', count: healthyCount, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
          { label: 'Concerning', count: concerningCount, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
          { label: 'Critical', count: criticalCount, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
        ].map(({ label, count, color, bg }) => (
          <div key={label} className={`convo-card ${bg} p-4 flex items-center gap-3`}>
            <div className={`text-3xl font-black tabular-nums ${color}`}>{count}</div>
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">{label}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">model{count !== 1 ? 's' : ''}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Grid */}
      {models.length === 0 && liveData ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-slate-700/50 rounded-2xl bg-slate-800/20 backdrop-blur-md">
          <div className="w-16 h-16 bg-slate-700/30 rounded-2xl flex items-center justify-center mb-4 border border-slate-600/30">
            <Bot className="h-8 w-8 text-indigo-400 opacity-80" />
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight">No models registered</h3>
          <p className="text-sm text-slate-400 mt-2 max-w-md">
            Register your first AI model to start monitoring conversations for manipulation, opinion injection, and urgency bias.
          </p>
          <button
            onClick={() => setShowRegister(true)}
            className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20"
          >
            <Plus className="h-4 w-4" />
            Register Model
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {models.map((model) => (
            <ModelCardComponent
              key={model.id}
              model={model}
              onClick={() => navigate(`/models/${model.id}`)}
            />
          ))}
        </div>
      )}

      {/* Fleet stats bar */}
      <div className="convo-card px-6 py-4 flex items-center gap-6 text-sm">
        <BarChart3 className="h-4 w-4 text-slate-500 flex-shrink-0" />
        <div className="flex gap-6 flex-wrap">
          <span className="text-slate-500 dark:text-slate-400">
            Total conversations: <span className="text-slate-900 dark:text-white font-semibold">{models.reduce((s, m) => s + (m.totalConversations ?? 0), 0).toLocaleString()}</span>
          </span>
          <span className="text-slate-500 dark:text-slate-400">
            Fleet avg TiltScore:{' '}
            {(() => {
              const scored = models.filter((m) => m.tiltScore != null);
              if (scored.length === 0) return <span className="font-semibold text-slate-400">N/A</span>;
              const avg = scored.reduce((s, m) => s + (m.tiltScore ?? 0), 0) / scored.length;
              return <span className="font-semibold" style={{ color: avg >= 70 ? '#34d399' : '#fb923c' }}>{avg.toFixed(1)}</span>;
            })()
            }
          </span>
          <span className="text-slate-500 dark:text-slate-400">
            Alert threshold: <span className="text-amber-500 dark:text-amber-400 font-semibold">TiltScore &lt; {Math.round(models.reduce((s, m) => s + (m.alertThreshold ?? 60), 0) / Math.max(models.length, 1))}</span>
          </span>
        </div>
        <Zap className="h-3 w-3 text-indigo-400 ml-auto flex-shrink-0" />
      </div>

      {/* Modal */}
      {showRegister && (
        <RegisterModelModal
          onClose={() => setShowRegister(false)}
          onAdd={(m) => setModels((prev) => [...prev, m])}
        />
      )}
    </div>
  );
}
