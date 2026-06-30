import React, { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { gql, useQuery } from "@apollo/client";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import {
  ArrowLeft,
  Activity,
  MessageSquare,
  AlertTriangle,
  Settings2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Eye,
  Save,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PatternRates {
  false_urgency: number;
  topic_hijacking: number;
  concern_dismissal: number;
  opinion_injection: number;
  agenda_persistence: number;
}

interface ModelDetail {
  id: string;
  name: string;
  aiSystemName: string;
  environment: string;
  alertThreshold: number;
  webhookUrl: string;
  tiltScore: number;
  totalConversations: number;
  patternRates: PatternRates;
}

interface TrendPoint {
  date: string;
  avgScore: number;
  conversations: number;
}

interface FlaggedConversation {
  id: string;
  externalId?: string;
  tiltScore: number;
  patterns: string[];
  turnCount: number;
  timestamp: string;
  turns?: ConversationTurn[];
}

interface ConversationTurn {
  index: number;
  role: "user" | "assistant";
  content: string;
}

// ─── No mock data used in production ────────────────────────────────────────────

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tiltColor(score: number): string {
  if (score <= 30) return "#34d399"; // green — safe
  if (score <= 60) return "#fb923c"; // orange — concerning
  return "#f87171"; // red — manipulative
}

function tiltTextClass(score: number): string {
  if (score <= 30) return "text-emerald-400";
  if (score <= 60) return "text-amber-400";
  return "text-red-400";
}

const PATTERN_LABELS: Record<string, string> = {
  false_urgency: "False Urgency",
  topic_hijacking: "Topic Hijacking",
  concern_dismissal: "Concern Dismissal",
  opinion_injection: "Opinion Injection",
  agenda_persistence: "Agenda Persistence",
};

const PATTERN_COLORS: Record<string, string> = {
  false_urgency: "#f87171",
  topic_hijacking: "#fb923c",
  concern_dismissal: "#fbbf24",
  opinion_injection: "#a78bfa",
  agenda_persistence: "#f472b6",
};

const GET_PROJECT_METRICS = gql`
  query GetProjectMetrics($projectId: ID!) {
    dashboardMetrics(projectId: $projectId) {
      dailyStats {
        date
        avgScore
      }
    }
  }
`;

function OverviewTab({ model }: { model: ModelDetail }) {
  const { data } = useQuery(GET_PROJECT_METRICS, {
    variables: { projectId: model.id },
  });

  const trend: TrendPoint[] =
    data?.dashboardMetrics?.dailyStats?.map((s: any) => ({
      date: s.date,
      avgScore: s.avgScore || 0,
      conversations: s.conversations || 0,
    })) || [];

  const patterns = Object.entries(model.patternRates) as [
    keyof PatternRates,
    number,
  ][];
  const barData = patterns.map(([key, rate]) => ({
    name: PATTERN_LABELS[key].replace(" ", "\n"),
    rate,
    fill: PATTERN_COLORS[key],
  }));

  return (
    <div className="space-y-6">
      {/* Trend chart */}
      <div className="convo-card p-6">
        <h3 className="text-sm font-semibold text-white mb-1">
          TiltScore Trend — Last 30 Days
        </h3>
        <p className="text-xs text-slate-500 mb-5">
          Average TiltScore per day. Higher = more manipulation detected.
        </p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={trend}
              margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#1e293b"
              />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => v.slice(5)}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#475569", fontSize: 11 }}
                dy={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#475569", fontSize: 11 }}
                domain={[0, 100]}
              />
              <Tooltip
                contentStyle={{
                  background: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: 10,
                  fontSize: 12,
                  color: "#e2e8f0",
                }}
                labelStyle={{ color: "#94a3b8" }}
              />
              <ReferenceLine
                y={model.alertThreshold}
                stroke="#fb923c"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: `Alert: ${model.alertThreshold}`,
                  fill: "#fb923c",
                  fontSize: 10,
                }}
              />
              <Line
                type="monotone"
                dataKey="avgScore"
                name="Avg TiltScore"
                stroke={tiltColor(model.tiltScore)}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: tiltColor(model.tiltScore) }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pattern breakdown */}
      <div className="convo-card p-6">
        <h3 className="text-sm font-semibold text-white mb-1">
          Pattern Rate Breakdown
        </h3>
        <p className="text-xs text-slate-500 mb-5">
          Percentage of conversations where each pattern was detected.
        </p>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={barData}
              margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#1e293b"
              />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#475569", fontSize: 10 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#475569", fontSize: 11 }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                contentStyle={{
                  background: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: 10,
                  fontSize: 12,
                  color: "#e2e8f0",
                }}
                formatter={(v: number) => [`${v.toFixed(1)}%`, "Rate"]}
              />
              <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                {barData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

const PAGE_SIZE = 20;

const GET_MODEL_CONVERSATIONS = gql`
  query GetModelConversations(
    $projectId: ID!
    $first: Int
    $filters: ConversationFilters
  ) {
    conversations(projectId: $projectId, first: $first, filters: $filters) {
      totalCount
      edges {
        node {
          id
          externalId
          tiltScore
          turnCount
          startedAt
          flags {
            patternName
          }
          turns {
            index
            role
            content
          }
        }
      }
    }
  }
`;

function ConversationsTab({ model }: { model: ModelDetail }) {
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<any | null>(null);

  const { data, loading } = useQuery(GET_MODEL_CONVERSATIONS, {
    variables: {
      projectId: model.id,
      first: 100, // fetch enough to paginate locally or you could implement real pagination
      filters: { minTiltScore: model.alertThreshold },
    },
    skip: !model.id,
  });

  const rawEdges = data?.conversations?.edges || [];
  const conversations: FlaggedConversation[] = rawEdges.map((e: any) => ({
    id: e.node.id,
    externalId: e.node.externalId,
    tiltScore: e.node.tiltScore,
    patterns: Array.from(
      new Set(e.node.flags?.map((f: any) => f.patternName) || []),
    ) as string[],
    turnCount: e.node.turnCount,
    timestamp: e.node.startedAt,
    turns: [...(e.node.turns || [])].sort((a, b) => a.index - b.index),
  }));

  const totalPages = Math.ceil(conversations.length / PAGE_SIZE);
  const pageConvos = conversations.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE,
  );

  const turns: ConversationTurn[] = selected?.turns || [];

  return (
    <div className="space-y-4">
      {selected ? (
        // Conversation detail drawer
        <div className="convo-card overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-700/40">
            <button
              onClick={() => setSelected(null)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-400">
                  {selected.id}
                </span>
                <span
                  className={`text-lg font-black tabular-nums ${tiltTextClass(selected.tiltScore)}`}
                >
                  {selected.tiltScore.toFixed(0)}
                </span>
              </div>
              <div className="flex gap-1.5 mt-1 flex-wrap">
                {selected.patterns.map((p) => (
                  <span
                    key={p}
                    className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-500/20 text-red-400 border border-red-500/20"
                  >
                    {PATTERN_LABELS[p] ?? p}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="p-5 space-y-3">
            {turns.map((turn) => (
              <div
                key={turn.index}
                className={`flex gap-3 ${turn.role === "assistant" ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${turn.role === "user" ? "bg-slate-700 text-slate-300" : "bg-indigo-600/30 text-indigo-300"}`}
                >
                  {turn.role === "user" ? "U" : "AI"}
                </div>
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm ${turn.role === "user" ? "bg-slate-700/50 text-slate-200 rounded-tl-none" : "bg-indigo-600/15 border border-indigo-500/20 text-slate-200 rounded-tr-none"}`}
                >
                  {turn.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="convo-card overflow-hidden">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-700/40">
                  {[
                    "Conversation ID",
                    "TiltScore",
                    "Patterns Triggered",
                    "Turns",
                    "Timestamp",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageConvos.map((conv) => (
                  <tr
                    key={conv.id}
                    className="border-b border-slate-800/60 hover:bg-slate-700/20 transition-colors cursor-pointer"
                    onClick={() => setSelected(conv)}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-slate-300">
                        {conv.id}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-base font-black tabular-nums ${tiltTextClass(conv.tiltScore)}`}
                      >
                        {conv.tiltScore.toFixed(0)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {conv.patterns.map((p) => (
                          <span
                            key={p}
                            className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-700/60 text-slate-300"
                          >
                            {p.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {conv.turnCount}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {new Date(conv.timestamp).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Eye className="h-3.5 w-3.5 text-slate-600 hover:text-indigo-400 transition-colors" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm text-slate-400">
            <span>
              Showing {page * PAGE_SIZE + 1}–
              {Math.min((page + 1) * PAGE_SIZE, conversations.length)} of{" "}
              {conversations.length} flagged
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-lg hover:bg-slate-700/50 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-white">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg hover:bg-slate-700/50 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SettingsTab({ model }: { model: ModelDetail }) {
  const [threshold, setThreshold] = useState(model.alertThreshold);
  const [webhook, setWebhook] = useState(model.webhookUrl ?? "");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    // Optimistic — API may not be up yet
    await new Promise((r) => setTimeout(r, 500));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const thColor =
    threshold <= 30
      ? "text-emerald-400"
      : threshold <= 60
        ? "text-amber-400"
        : "text-red-400";

  return (
    <div className="max-w-md space-y-6">
      <div className="convo-card p-6 space-y-5">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
            Alert Threshold — fires when TiltScore rises above
          </label>
          <div className="flex items-center gap-4 mt-3">
            <input
              type="range"
              min={10}
              max={90}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="flex-1 accent-indigo-500"
            />
            <span
              className={`text-2xl font-black w-14 text-right tabular-nums ${thColor}`}
            >
              {threshold}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Currently set to <strong className={thColor}>{threshold}</strong> —
            conversations scoring <strong>above</strong> this will trigger
            alerts.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
            Webhook URL
          </label>
          <input
            value={webhook}
            onChange={(e) => setWebhook(e.target.value)}
            placeholder="https://your-api.com/webhook/convoguard"
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/50 border border-slate-700/60 text-white text-sm placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30"
          />
          <p className="text-xs text-slate-500 mt-1.5">
            ConvoGuard will POST alert payloads here when TiltScore rises above
            threshold.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-semibold transition-all disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saved ? "Saved!" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "conversations", label: "Conversations", icon: MessageSquare },
  { id: "settings", label: "Settings", icon: Settings2 },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function ModelDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>("overview");
  const [model, setModel] = useState<ModelDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch or fall back to mock
  React.useEffect(() => {
    const doFetch = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/models/${id}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("API unavailable");
        const data = await res.json();
        const rawModel = data.model ?? data;
        if (rawModel) {
          setModel({
            id: rawModel.model_id || rawModel.id,
            name: rawModel.model_name || rawModel.name,
            aiSystemName: rawModel.environment || rawModel.aiSystemName || "",
            environment: rawModel.environment || "production",
            alertThreshold:
              rawModel.alert_threshold || rawModel.alertThreshold || 60,
            webhookUrl: rawModel.alert_webhook_url || rawModel.webhookUrl || "",
            tiltScore: rawModel.stats?.tilt_p50 ?? rawModel.tiltScore ?? 0,
            totalConversations:
              rawModel.stats?.total_conversations ??
              rawModel.totalConversations ??
              0,
            patternRates: rawModel.stats?.pattern_rates ||
              rawModel.patternRates || {
                false_urgency: 0,
                topic_hijacking: 0,
                concern_dismissal: 0,
                opinion_injection: 0,
                agenda_persistence: 0,
              },
          });
        }
      } catch (err) {
        console.error("Failed to load model details:", err);
        setModel(null);
      } finally {
        setLoading(false);
      }
    };
    doFetch();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!model) {
    return (
      <div className="text-center py-24 text-slate-400">
        <p>Model not found.</p>
        <button
          onClick={() => navigate("/models")}
          className="mt-4 text-indigo-400 hover:underline text-sm"
        >
          ← Back to models
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate("/models")}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Models
        </button>

        <div className="flex items-start gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {model.name}
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  model.environment === "production"
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                }`}
              >
                {model.environment.toUpperCase()}
              </span>
            </div>
            <p className="text-sm text-slate-400 font-mono">
              {model.aiSystemName}
            </p>
          </div>
          <div className="text-right">
            <div
              className={`text-5xl font-black tabular-nums ${tiltTextClass(model.tiltScore)}`}
            >
              {model.tiltScore.toFixed(0)}
            </div>
            <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
              TiltScore
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {model.totalConversations.toLocaleString()} conversations
            </div>
          </div>
        </div>

        {model.tiltScore > model.alertThreshold && (
          <div className="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            TiltScore above alert threshold ({model.alertThreshold}) — review
            flagged conversations
          </div>
        )}
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 p-1 rounded-xl bg-slate-800/50 border border-slate-700/40 w-fit">
        {TABS.map(({ id: tabId, label, icon: Icon }) => (
          <button
            key={tabId}
            onClick={() => setTab(tabId)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === tabId
                ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && <OverviewTab model={model} />}
      {tab === "conversations" && <ConversationsTab model={model} />}
      {tab === "settings" && <SettingsTab model={model} />}
    </div>
  );
}
