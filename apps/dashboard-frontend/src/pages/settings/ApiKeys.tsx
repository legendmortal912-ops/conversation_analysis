import React, { useState, useEffect } from 'react';
import {
  Key, Plus, Trash2, Copy, Check, AlertTriangle, Loader2, X, Terminal,
} from 'lucide-react';
import { apiKeyApi } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  expiresAt?: string | null;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
}

// ─── Code snippet tabs ────────────────────────────────────────────────────────

const SDK_SNIPPETS = {
  nodejs: `// npm install convoguard-js
import { ConvoGuard } from 'convoguard-js';

const cg = new ConvoGuard({
  apiKey: process.env.CONVOGUARD_API_KEY,
  projectId: '<YOUR_PROJECT_ID>',
});

// In your AI response handler:
async function handleAIResponse(session, userMessage, aiResponse) {
  // Start tracking the conversation
  const conv = await cg.startConversation();
  
  // Log the user's input
  await cg.addTurn(conv.id, { speaker: 'user', content: userMessage });
  
  // Log your AI's response to get real-time manipulation analysis
  const result = await cg.addTurn(conv.id, { speaker: 'ai', content: aiResponse });
  
  if (result.analysis?.flags) {
    console.log("Manipulation flags:", result.analysis.flags);
  }
  
  sendToUser(aiResponse);
}`,
  python: `# pip install convoguard-py
from convoguard import ConvoGuard
import os

cg = ConvoGuard(
    api_key=os.environ.get("CONVOGUARD_API_KEY"),
    project_id="<YOUR_PROJECT_ID>"
)

# Use the context manager to automatically track conversations
def on_ai_response(user_msg, ai_msg):
    with cg.conversation() as conv:
        # 1. Log the user's input
        cg.add_turn(conv.id, "user", user_msg)
        
        # 2. Log your AI's response to get real-time manipulation analysis
        result = cg.add_turn(conv.id, "ai", ai_msg)
        
        # 3. Check for any detected manipulation flags
        if result.analysis and result.analysis.flags:
            for flag in result.analysis.flags:
                print(f"Warning: {flag.pattern} ({flag.severity}) - {flag.explanation}")
                
        send_to_user(ai_msg)`,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
      {description && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{description}</p>}
    </div>
  );
}

function Spinner() {
  return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-accent-500" /></div>;
}

// ─── Generate Key Modal ───────────────────────────────────────────────────────

interface GenerateModalProps {
  onClose: () => void;
  onSuccess: (key: { id: string; key: string }) => void;
}

function GenerateKeyModal({ onClose, onSuccess }: GenerateModalProps) {
  const [name, setName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      const payload: { name: string; expiresInDays?: number } = { name: name.trim() };
      if (expiresInDays !== '') {
        payload.expiresInDays = expiresInDays;
      }
      const r = await apiKeyApi.create(payload);
      onSuccess({ id: r.id, key: r.key });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create key');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-6">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-navy-700 transition-colors">
          <X className="h-4 w-4" />
        </button>
        <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1">Generate New API Key</h2>
        <p className="text-sm text-slate-500 mb-5">Give it a descriptive label so you can identify it later.</p>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Key Label</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Production, Staging, CI/CD"
              required
              autoFocus
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-accent-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Expiration</label>
            <select
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-accent-500 outline-none"
            >
              <option value="">Never</option>
              <option value="7">7 Days</option>
              <option value="30">30 Days</option>
              <option value="90">90 Days</option>
              <option value="365">1 Year</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>}
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-accent-600 hover:bg-accent-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Generate Key
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Revealed Key Banner ──────────────────────────────────────────────────────

function RevealedKeyBanner({ apiKey, onDismiss }: { apiKey: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-800 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-green-800 dark:text-green-300 mb-1">Save this key — it won't be shown again</p>
          <p className="text-xs text-green-700 dark:text-green-400 mb-3">Copy it now and store it securely in your environment variables.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-xs bg-white dark:bg-navy-900 px-3 py-2.5 rounded-lg border border-green-200 dark:border-green-800 break-all text-slate-800 dark:text-slate-200">
              {apiKey}
            </code>
            <button
              onClick={copy}
              className="p-2.5 rounded-lg bg-green-100 hover:bg-green-200 dark:bg-green-800/30 dark:hover:bg-green-800/50 text-green-700 dark:text-green-400 transition-colors flex-shrink-0"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <button onClick={onDismiss} className="text-green-600 dark:text-green-400 text-lg hover:text-green-800 leading-none">&times;</button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ApiKeys() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revokeConfirm, setRevokeConfirm] = useState<string | null>(null);
  const [sdkTab, setSdkTab] = useState<'nodejs' | 'python'>('nodejs');

  const fetchKeys = async () => {
    try {
      const r = await apiKeyApi.list();
      // Map from API shape to our shape
      setKeys((r.keys as unknown as ApiKey[]) ?? []);
    } catch {
      setKeys([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchKeys(); }, []);

  const handleRevoke = async (id: string) => {
    try {
      await apiKeyApi.revoke(id);
      fetchKeys();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to revoke key');
    }
    setRevokeConfirm(null);
  };

  const copyPrefix = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Key className="h-6 w-6 text-accent-500" />
            API Keys
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            API keys authenticate SDK calls. Each key is shown only once at creation.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent-600 hover:bg-accent-700 text-white text-sm font-semibold transition-colors shadow-lg shadow-accent-500/20"
        >
          <Plus className="h-4 w-4" />
          Generate New Key
        </button>
      </div>

      {/* Revealed key banner */}
      {revealedKey && (
        <RevealedKeyBanner apiKey={revealedKey} onDismiss={() => setRevealedKey(null)} />
      )}

      {/* Keys list */}
      <div className="convo-card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <SectionHeader title="Your API Keys" description="Active keys can be used to authenticate SDK and webhook requests." />
        </div>

        {loading ? (
          <Spinner />
        ) : keys.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-navy-800 flex items-center justify-center mx-auto mb-4">
              <Key className="h-7 w-7 text-slate-400" />
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm">No API keys yet.</p>
            <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Generate your first key to start sending data.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-navy-800">
              <tr>
                {['Label', 'Prefix', 'Created', 'Expires', 'Last Used', 'Status', ''].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-navy-900 divide-y divide-slate-50 dark:divide-slate-800/50">
              {keys.map((k) => {
                const isExpired = k.expiresAt && new Date(k.expiresAt) < new Date();
                return (
                <tr key={k.id} className={k.revokedAt || isExpired ? 'opacity-50' : ''}>
                  <td className="px-5 py-4 text-sm font-medium text-slate-900 dark:text-white">{k.name}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5">
                      <code className="font-mono text-xs bg-slate-100 dark:bg-navy-800 px-2 py-1 rounded">{k.keyPrefix}...</code>
                      {!k.revokedAt && (
                        <button
                          onClick={() => copyPrefix(k.keyPrefix, k.id)}
                          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                        >
                          {copiedId === k.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-500">{new Date(k.createdAt).toLocaleDateString()}</td>
                  <td className="px-5 py-4 text-sm text-slate-500">{k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : <span className="text-slate-400">Never</span>}</td>
                  <td className="px-5 py-4 text-sm text-slate-500">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : <span className="text-slate-400">Never</span>}</td>
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${k.revokedAt || isExpired ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' : 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'}`}>
                      {k.revokedAt ? 'Revoked' : isExpired ? 'Expired' : 'Active'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    {!k.revokedAt && (
                      revokeConfirm === k.id ? (
                        <div className="flex items-center gap-2 justify-end">
                          <span className="text-xs text-slate-500">Confirm?</span>
                          <button onClick={() => handleRevoke(k.id)} className="text-xs text-red-600 hover:text-red-700 font-semibold">Yes</button>
                          <button onClick={() => setRevokeConfirm(null)} className="text-xs text-slate-500 hover:text-slate-700">Cancel</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setRevokeConfirm(k.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Revoke key"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )
                    )}
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        )}
      </div>

      {/* SDK snippets */}
      <div className="convo-card overflow-hidden">
        <div className="px-6 pt-5">
          <div className="flex items-center gap-3 mb-4">
            <Terminal className="h-5 w-5 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">SDK Quick Start</h3>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 p-1 rounded-lg bg-slate-100 dark:bg-navy-800 w-fit mb-0">
            {(['nodejs', 'python'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setSdkTab(t)}
                className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  sdkTab === t
                    ? 'bg-white dark:bg-navy-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {t === 'nodejs' ? 'Node.js' : 'Python'}
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <pre className="overflow-x-auto p-6 text-xs font-mono text-slate-300 bg-navy-950 dark:bg-[#0a0e1a] leading-relaxed">
            <code>{SDK_SNIPPETS[sdkTab]}</code>
          </pre>
          <button
            onClick={() => { navigator.clipboard.writeText(SDK_SNIPPETS[sdkTab]); }}
            className="absolute top-4 right-4 p-2 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 text-slate-400 hover:text-white transition-colors"
            title="Copy snippet"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Modals */}
      {showModal && (
        <GenerateKeyModal
          onClose={() => setShowModal(false)}
          onSuccess={({ key }) => {
            setShowModal(false);
            setRevealedKey(key);
            fetchKeys();
          }}
        />
      )}
    </div>
  );
}
