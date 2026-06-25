import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { gql, useQuery, useMutation } from '@apollo/client';
import { apiKeyApi } from '@/lib/api';
import BillingCalculator from '@/components/BillingCalculator';
import {
  Building2, Users, Key, Bell, CreditCard, Plus, Trash2, Copy, Check,
  Mail, Webhook, Save, UserPlus, AlertTriangle,
  ToggleLeft, ToggleRight, Loader2, X, MessageSquare, RefreshCw, Flag
} from 'lucide-react';

// ─── GraphQL ────────────────────────────────────────────────────────────────
const GET_ORG = gql`
  query GetOrgSettings {
    organization { id name plan slug }
    members { id name email role createdAt }
    projects { id name }
  }
`;
const GET_USAGE = gql`
  query GetUsage { usageStats { totalConversations totalTurns totalFlags plan orgName } }
`;
const UPDATE_ORG = gql`
  mutation UpdateOrg($name: String!) { updateOrganization(name: $name) { id name } }
`;
const INVITE_USER = gql`
  mutation InviteUser($email: String!, $role: Role!) { inviteUser(email: $email, role: $role) }
`;
const REMOVE_USER = gql`
  mutation RemoveUser($userId: ID!) { removeUser(userId: $userId) }
`;
const GET_ALERT_CONFIGS = gql`
  query GetAlertConfigs($projectId: ID!) {
    alertConfigs(projectId: $projectId) {
      id channel webhookUrl slackWebhookUrl emailAddresses enabled
    }
  }
`;
const UPSERT_ALERT_CONFIG = gql`
  mutation UpsertAlert($projectId: ID!, $channel: String!, $webhookUrl: String, $slackWebhookUrl: String, $emailAddresses: [String!], $enabled: Boolean!) {
    upsertAlertConfig(projectId: $projectId, channel: $channel, webhookUrl: $webhookUrl, slackWebhookUrl: $slackWebhookUrl, emailAddresses: $emailAddresses, enabled: $enabled) { id }
  }
`;
const CREATE_PROJECT = gql`
  mutation CP($input: CreateProjectInput!) { createProject(input: $input) { id name } }
`;

const GET_CUSTOM_RULES = gql`
  query GetCustomRules($projectId: ID!) {
    project(id: $projectId) {
      id
      customRules { id name description patterns severity isEnabled createdAt }
    }
  }
`;
const CREATE_CUSTOM_RULE = gql`
  mutation CreateCustomRule($input: CreateCustomRuleInput!) {
    createCustomRule(input: $input) { id name }
  }
`;
const DELETE_CUSTOM_RULE = gql`
  mutation DeleteCustomRule($id: ID!) {
    deleteCustomRule(id: $id)
  }
`;


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

// ─── Tab: General ─────────────────────────────────────────────────────────────
function GeneralTab() {
  const { data, loading } = useQuery(GET_ORG);
  const [updateOrg, { loading: saving }] = useMutation(UPDATE_ORG);
  const [orgName, setOrgName] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (data?.organization) setOrgName(data.organization.name); }, [data]);

  const handleSave = async () => {
    await updateOrg({ variables: { name: orgName }, refetchQueries: [{ query: GET_ORG }] });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <Spinner />;
  const org = data?.organization;

  return (
    <div className="space-y-6 max-w-lg">
      <SectionHeader title="Organization" description="Update your organization profile." />
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Organization Name</label>
          <input
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-accent-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Slug</label>
          <input
            value={org?.slug ?? ''}
            disabled
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800/50 text-slate-400 text-sm cursor-not-allowed"
          />
          <p className="text-xs text-slate-400 mt-1">Your unique identifier — cannot be changed</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Plan</label>
          <span className="px-3 py-1.5 rounded-lg bg-accent-50 dark:bg-accent-900/20 text-accent-700 dark:text-accent-400 text-sm font-semibold capitalize">
            {org?.plan?.toLowerCase() ?? 'free'}
          </span>
        </div>
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 bg-accent-600 hover:bg-accent-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
        {saved ? 'Saved!' : 'Save Changes'}
      </button>
    </div>
  );
}

// ─── Tab: Team ────────────────────────────────────────────────────────────────
function TeamTab() {
  const { data, loading, refetch } = useQuery(GET_ORG);
  const [inviteUser, { loading: inviting }] = useMutation(INVITE_USER);
  const [removeUser] = useMutation(REMOVE_USER);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('ANALYST');
  const [successMsg, setSuccessMsg] = useState('');

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    try {
      await inviteUser({ variables: { email: inviteEmail, role: inviteRole } });
      setSuccessMsg(`Invite sent to ${inviteEmail}`);
      setInviteEmail('');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e: any) { alert(e.message); }
  };

  const handleRemove = async (userId: string, name: string) => {
    if (!confirm(`Remove ${name} from the organization?`)) return;
    try { await removeUser({ variables: { userId } }); refetch(); }
    catch (e: any) { alert(e.message); }
  };

  const roleColors: Record<string, string> = {
    OWNER: 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
    ADMIN: 'bg-accent-100 text-accent-700 dark:bg-accent-900/20 dark:text-accent-400',
    ANALYST: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
    VIEWER: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <SectionHeader title="Team Members" description="Manage who has access to your organization." />

      {/* Members table */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-navy-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Member</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Joined</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-navy-900 divide-y divide-slate-100 dark:divide-slate-800">
            {(data?.members ?? []).map((m: any) => (
              <tr key={m.id}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{m.name}</p>
                      <p className="text-xs text-slate-500">{m.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${roleColors[m.role] ?? roleColors.VIEWER}`}>
                    {m.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">{new Date(m.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right">
                  {m.role !== 'OWNER' && (
                    <button
                      onClick={() => handleRemove(m.id, m.name)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invite form */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Invite a Team Member</h3>
        {successMsg && (
          <div className="mb-4 px-4 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
            <Check className="h-4 w-4" />{successMsg}
          </div>
        )}
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Email address</label>
            <input
              type="email"
              placeholder="colleague@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-800 text-sm focus:ring-2 focus:ring-accent-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Role</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-800 text-sm focus:ring-2 focus:ring-accent-500 outline-none"
            >
              <option value="ADMIN">Admin</option>
              <option value="ANALYST">Analyst</option>
              <option value="VIEWER">Viewer</option>
            </select>
          </div>
          <button
            onClick={handleInvite}
            disabled={inviting || !inviteEmail}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent-600 hover:bg-accent-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-60"
          >
            {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Send Invite
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: API Keys ────────────────────────────────────────────────────────────
function ApiKeysTab() {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [revealedKey, setRevealedKey] = useState<{ id: string; key: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchKeys = async () => {
    try { const r = await apiKeyApi.list(); setKeys(r.keys); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchKeys(); }, []);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const r = await apiKeyApi.create({ name: newKeyName });
      setRevealedKey({ id: r.id, key: r.key });
      setNewKeyName('');
      fetchKeys();
    } catch (e: any) { alert(e.message); }
    finally { setCreating(false); }
  };

  const handleRevoke = async (id: string, name: string) => {
    if (!confirm(`Revoke "${name}"? This cannot be undone.`)) return;
    try { await apiKeyApi.revoke(id); fetchKeys(); }
    catch (e: any) { alert(e.message); }
  };

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="API Keys" description="Used to send conversation data via the SDK. Each key is shown only once on creation." />

      {/* New key reveal banner */}
      {revealedKey && (
        <div className="border border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-800 dark:text-green-300">Save this key — it won't be shown again</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 font-mono text-xs bg-white dark:bg-navy-900 px-3 py-2 rounded-lg border border-green-200 break-all">
                  {revealedKey.key}
                </code>
                <button onClick={() => copy(revealedKey.key, revealedKey.id)} className="p-2 rounded-lg bg-green-100 hover:bg-green-200 text-green-700 transition-colors">
                  {copiedId === revealedKey.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button onClick={() => setRevealedKey(null)} className="text-green-600 text-lg">&times;</button>
          </div>
        </div>
      )}

      {/* Create */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Create New Key</h3>
        <div className="flex gap-3">
          <input
            placeholder="Key name (e.g. Production)"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-800 text-sm focus:ring-2 focus:ring-accent-500 outline-none"
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newKeyName.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent-600 hover:bg-accent-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-60"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? <Spinner /> : keys.length === 0 ? (
        <div className="text-center py-10 text-slate-500 text-sm">No API keys yet.</div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-navy-800">
              <tr>
                {['Name', 'Prefix', 'Created', 'Last Used', 'Status', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-navy-900 divide-y divide-slate-100 dark:divide-slate-800">
              {keys.map((k: any) => (
                <tr key={k.id} className={k.revokedAt ? 'opacity-50' : ''}>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">{k.name}</td>
                  <td className="px-4 py-3"><code className="font-mono text-xs bg-slate-100 dark:bg-navy-800 px-2 py-1 rounded">{k.keyPrefix}...</code></td>
                  <td className="px-4 py-3 text-sm text-slate-500">{new Date(k.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'Never'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${k.revokedAt ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {k.revokedAt ? 'Revoked' : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!k.revokedAt && (
                      <button onClick={() => handleRevoke(k.id, k.name)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Alert Rules ─────────────────────────────────────────────────────────
function AlertRulesTab({ projects }: { projects: any[] }) {
  const [selectedProject, setSelectedProject] = useState('');
  useEffect(() => { if (projects.length > 0 && !selectedProject) setSelectedProject(projects[0].id); }, [projects]);

  const { data, loading, refetch } = useQuery(GET_ALERT_CONFIGS, {
    variables: { projectId: selectedProject },
    skip: !selectedProject,
  });
  const [upsertConfig] = useMutation(UPSERT_ALERT_CONFIG);

  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailAddresses, setEmailAddresses] = useState('');
  const [slackEnabled, setSlackEnabled] = useState(false);
  const [slackWebhook, setSlackWebhook] = useState('');
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    if (!data?.alertConfigs) return;
    const cfgs = data.alertConfigs;
    const e = cfgs.find((c: any) => c.channel === 'EMAIL');
    const s = cfgs.find((c: any) => c.channel === 'SLACK');
    const w = cfgs.find((c: any) => c.channel === 'WEBHOOK');
    if (e) { setEmailEnabled(e.enabled); setEmailAddresses((e.emailAddresses ?? []).join(', ')); }
    if (s) { setSlackEnabled(s.enabled); setSlackWebhook(s.slackWebhookUrl ?? ''); }
    if (w) { setWebhookEnabled(w.enabled); setWebhookUrl(w.webhookUrl ?? ''); }
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        upsertConfig({ variables: { projectId: selectedProject, channel: 'EMAIL', emailAddresses: emailAddresses.split(',').map((e) => e.trim()).filter(Boolean), enabled: emailEnabled } }),
        upsertConfig({ variables: { projectId: selectedProject, channel: 'SLACK', slackWebhookUrl: slackWebhook, emailAddresses: [], enabled: slackEnabled } }),
        upsertConfig({ variables: { projectId: selectedProject, channel: 'WEBHOOK', webhookUrl, emailAddresses: [], enabled: webhookEnabled } }),
      ]);
      setSavedMsg('Alert rules saved!');
      refetch();
      setTimeout(() => setSavedMsg(''), 3000);
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  if (projects.length === 0) return (
    <div>
      <SectionHeader title="Alert Rules" />
      <div className="text-center py-12 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-500 text-sm">
        Create a project in the Playground first to configure alerts.
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <SectionHeader title="Alert Rules" description="Configure how you receive alerts when manipulation is detected." />
      <div className="max-w-xs">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Project</label>
        <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-800 text-sm focus:ring-2 focus:ring-accent-500 outline-none">
          {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {loading ? <Spinner /> : (
        <div className="space-y-4">
          {/* Email */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-slate-500" />
                <div><p className="text-sm font-semibold text-slate-900 dark:text-white">Email Alerts</p><p className="text-xs text-slate-500">Receive alerts via email</p></div>
              </div>
              <button onClick={() => setEmailEnabled(!emailEnabled)} className={`transition-colors ${emailEnabled ? 'text-accent-600' : 'text-slate-400'}`}>
                {emailEnabled ? <ToggleRight className="h-7 w-7" /> : <ToggleLeft className="h-7 w-7" />}
              </button>
            </div>
            {emailEnabled && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Addresses (comma-separated)</label>
                <input placeholder="alert@company.com" value={emailAddresses} onChange={(e) => setEmailAddresses(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-800 text-sm focus:ring-2 focus:ring-accent-500 outline-none" />
              </div>
            )}
          </div>

          {/* Slack */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">💬</span>
                <div><p className="text-sm font-semibold text-slate-900 dark:text-white">Slack</p><p className="text-xs text-slate-500">Send alerts via incoming webhook</p></div>
              </div>
              <button onClick={() => setSlackEnabled(!slackEnabled)} className={`transition-colors ${slackEnabled ? 'text-accent-600' : 'text-slate-400'}`}>
                {slackEnabled ? <ToggleRight className="h-7 w-7" /> : <ToggleLeft className="h-7 w-7" />}
              </button>
            </div>
            {slackEnabled && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Slack Webhook URL</label>
                <input placeholder="https://hooks.slack.com/services/..." value={slackWebhook} onChange={(e) => setSlackWebhook(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-800 text-sm font-mono focus:ring-2 focus:ring-accent-500 outline-none" />
                <p className="text-xs text-slate-400 mt-1">Create one at api.slack.com/apps → Incoming Webhooks</p>
              </div>
            )}
          </div>

          {/* Webhook */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Webhook className="h-5 w-5 text-slate-500" />
                <div><p className="text-sm font-semibold text-slate-900 dark:text-white">Custom Webhook</p><p className="text-xs text-slate-500">POST alerts to your own endpoint</p></div>
              </div>
              <button onClick={() => setWebhookEnabled(!webhookEnabled)} className={`transition-colors ${webhookEnabled ? 'text-accent-600' : 'text-slate-400'}`}>
                {webhookEnabled ? <ToggleRight className="h-7 w-7" /> : <ToggleLeft className="h-7 w-7" />}
              </button>
            </div>
            {webhookEnabled && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Endpoint URL</label>
                <input placeholder="https://your-api.com/webhook/convoguard" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-800 text-sm font-mono focus:ring-2 focus:ring-accent-500 outline-none" />
              </div>
            )}
          </div>
        </div>
      )}

      {savedMsg && <div className="px-4 py-2 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 flex items-center gap-2"><Check className="h-4 w-4" />{savedMsg}</div>}
      <button onClick={handleSave} disabled={saving || !selectedProject}
        className="flex items-center gap-2 px-5 py-2.5 bg-accent-600 hover:bg-accent-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-60">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save Alert Rules
      </button>
    </div>
  );
}

// ─── Tab: Custom Rules ────────────────────────────────────────────────────────
function CustomRulesTab({ projects }: { projects: any[] }) {
  const [selectedProject, setSelectedProject] = useState('');
  useEffect(() => { if (projects.length > 0 && !selectedProject) setSelectedProject(projects[0].id); }, [projects]);

  const { data, loading, refetch } = useQuery(GET_CUSTOM_RULES, {
    variables: { projectId: selectedProject },
    skip: !selectedProject,
  });
  const [createRule] = useMutation(CREATE_CUSTOM_RULE);
  const [deleteRule] = useMutation(DELETE_CUSTOM_RULE);

  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('HIGH');
  const [patternsStr, setPatternsStr] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    const patterns = patternsStr.split(',').map(p => p.trim()).filter(Boolean);
    if (!name || patterns.length === 0) return alert('Name and at least one pattern are required');
    setSaving(true);
    try {
      await createRule({
        variables: {
          input: {
            projectId: selectedProject,
            name,
            description,
            severity,
            patterns,
          }
        }
      });
      setShowModal(false);
      setName(''); setDescription(''); setPatternsStr(''); setSeverity('HIGH');
      refetch();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this custom rule?')) return;
    try {
      await deleteRule({ variables: { id } });
      refetch();
    } catch (e: any) { alert(e.message); }
  };

  const rules = data?.project?.customRules || [];

  if (projects.length === 0) return (
    <div>
      <SectionHeader title="Custom Rules" />
      <div className="text-center py-12 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-500 text-sm">
        Create a project first to define custom rules.
      </div>
    </div>
  );

  return (
    <div className="space-y-6 relative">
      <div className="flex items-center justify-between">
        <SectionHeader title="Custom Rules" description="Define project-specific keywords and patterns to flag." />
        <button onClick={() => setShowModal(true)} disabled={!selectedProject} className="flex items-center gap-2 px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white rounded-xl text-sm font-medium transition-colors">
          <Plus className="h-4 w-4" /> Add Rule
        </button>
      </div>

      <div className="max-w-xs">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Project</label>
        <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-800 text-sm focus:ring-2 focus:ring-accent-500 outline-none">
          {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {loading ? <Spinner /> : rules.length === 0 ? (
        <div className="text-center py-10 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 text-sm">No custom rules defined for this project.</div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-navy-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Rule</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Severity</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Patterns</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-navy-900 divide-y divide-slate-100 dark:divide-slate-800">
              {rules.map((r: any) => (
                <tr key={r.id}>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{r.name}</p>
                    {r.description && <p className="text-xs text-slate-500">{r.description}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs font-bold rounded-lg ${r.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' : r.severity === 'HIGH' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                      {r.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {r.patterns.slice(0, 3).map((p: string, i: number) => (
                        <span key={i} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">{p}</span>
                      ))}
                      {r.patterns.length > 3 && <span className="px-2 py-1 text-xs text-slate-400">+{r.patterns.length - 3}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDelete(r.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-navy-900 rounded-2xl p-6 w-full max-w-lg shadow-xl border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Create Custom Rule</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Rule Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Financial Advice" className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-sm focus:ring-2 focus:ring-accent-500 outline-none text-slate-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Flags unauthorized investment guarantees" className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-sm focus:ring-2 focus:ring-accent-500 outline-none text-slate-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Severity</label>
                <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-sm focus:ring-2 focus:ring-accent-500 outline-none text-slate-900 dark:text-white">
                  <option value="CRITICAL">CRITICAL (Drops score by 12 points)</option>
                  <option value="HIGH">HIGH (Drops score by 8 points)</option>
                  <option value="MEDIUM">MEDIUM (Drops score by 5 points)</option>
                  <option value="LOW">LOW (Drops score by 3 points)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Keywords / Patterns</label>
                <textarea value={patternsStr} onChange={(e) => setPatternsStr(e.target.value)} placeholder="guarantee profit, buy stocks, investment advice" rows={3} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-sm focus:ring-2 focus:ring-accent-500 outline-none text-slate-900 dark:text-white resize-none" />
                <p className="text-xs text-slate-500 mt-1">Comma-separated list of phrases to detect using semantic similarity.</p>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg">Cancel</button>
                <button onClick={handleCreate} disabled={saving} className="px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save Rule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Billing ─────────────────────────────────────────────────────────────
function BillingTab() {
  const { data, loading } = useQuery(GET_USAGE);
  const [showUpgrade, setShowUpgrade] = useState(false);
  if (loading) return <Spinner />;

  const stats = data?.usageStats;
  const planLimits: Record<string, { conversations: number; label: string; color: string }> = {
    FREE: { conversations: 1000, label: 'Free', color: 'bg-slate-500' },
    STARTER: { conversations: 10000, label: 'Starter', color: 'bg-accent-500' },
    GROWTH: { conversations: 100000, label: 'Growth', color: 'bg-purple-500' },
    ENTERPRISE: { conversations: Infinity, label: 'Enterprise', color: 'bg-amber-500' },
  };
  const plan = planLimits[stats?.plan ?? 'FREE'];
  const convPct = plan.conversations === Infinity ? 5 : Math.min(100, ((stats?.totalConversations ?? 0) / plan.conversations) * 100);

  return (
    <div className="space-y-6">
      <SectionHeader title="Billing & Usage" description="Your real usage tracked from the database." />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Conversations Analyzed', value: stats?.totalConversations ?? 0, Icon: MessageSquare, color: 'text-purple-400' },
          { label: 'Turns Processed', value: stats?.totalTurns ?? 0, Icon: RefreshCw, color: 'text-blue-400' },
          { label: 'Flags Detected', value: stats?.totalFlags ?? 0, Icon: Flag, color: 'text-rose-400' },
        ].map((s) => (
          <div key={s.label} className="convo-card p-5 flex flex-col items-start">
            <s.Icon className={`h-6 w-6 mb-3 ${s.color}`} />
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{s.value.toLocaleString()}</p>
            <p className="text-sm text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="convo-card p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Current Plan</h3>
            <p className="text-xs text-slate-500 mt-0.5">Usage tracked from DB</p>
          </div>
          <span className={`px-3 py-1 rounded-lg text-white text-sm font-semibold ${plan.color}`}>{plan.label}</span>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-400">Conversations</span>
            <span className="font-medium text-slate-900 dark:text-white">
              {(stats?.totalConversations ?? 0).toLocaleString()} / {plan.conversations === Infinity ? 'Unlimited' : plan.conversations.toLocaleString()}
            </span>
          </div>
          <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${plan.color}`} style={{ width: `${convPct}%` }} />
          </div>
        </div>
      </div>

      <div className="convo-card p-5 mt-6">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Need more capacity?</h3>
        <p className="text-sm text-slate-500 mb-4">Upgrade to increase limits, unlock team features, and get priority support.</p>
        <button
          onClick={() => setShowUpgrade(true)}
          className="px-5 py-2.5 bg-gradient-to-r from-accent-600 to-purple-600 hover:from-accent-700 hover:to-purple-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-accent-500/20 transition-all"
        >
          Upgrade Plan
        </button>
      </div>

      {/* Upgrade modal */}
      {showUpgrade && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 overflow-y-auto">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm -z-10" onClick={() => setShowUpgrade(false)} />
          <div className="relative w-full max-w-4xl z-10">
            <button
              onClick={() => setShowUpgrade(false)}
              className="absolute -top-10 right-0 flex items-center gap-1.5 text-white/70 hover:text-white text-sm transition-colors"
            >
              <X className="h-4 w-4" /> Close
            </button>
            <BillingCalculator />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function Settings() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: orgData } = useQuery(GET_ORG);

  // Extract the tab from /settings/<tab>
  const pathParts = location.pathname.split('/');
  const tab = pathParts[pathParts.length - 1] || 'general';

  const tabs = [
    { id: 'general', label: 'General', icon: Building2 },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'api-keys', label: 'API Keys', icon: Key },
    { id: 'custom-rules', label: 'Custom Rules', icon: Flag },
    { id: 'alerts', label: 'Alert Rules', icon: Bell },
    { id: 'billing', label: 'Billing', icon: CreditCard },
  ];

  const validTabs = tabs.map((t) => t.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage your organization and preferences</p>
      </div>

      <div className="flex gap-6">
        {/* Tab nav */}
        <nav className="w-48 flex-shrink-0 space-y-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => navigate(`/settings/${id}`)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                tab === id
                  ? 'bg-accent-50 text-accent-700 dark:bg-accent-900/20 dark:text-accent-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700'
              }`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />{label}
            </button>
          ))}
        </nav>

        {/* Content pane */}
        <div className="flex-1 min-w-0 bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-8">
          {tab === 'general' && <GeneralTab />}
          {tab === 'team' && <TeamTab />}
          {tab === 'api-keys' && <ApiKeysTab />}
          {tab === 'custom-rules' && <CustomRulesTab projects={orgData?.projects ?? []} />}
          {tab === 'alerts' && <AlertRulesTab projects={orgData?.projects ?? []} />}
          {tab === 'billing' && <BillingTab />}
          {!validTabs.includes(tab) && <GeneralTab />}
        </div>
      </div>
    </div>
  );
}
