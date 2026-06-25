import React, { useState, useRef, useEffect } from 'react';
import { gql, useQuery, useMutation } from '@apollo/client';
import {
  Send, Upload, FlaskConical, Plus, Trash2,
  ShieldAlert, AlertTriangle, CheckCircle, Loader2, Copy, Check,
  FileText, RefreshCw, Info, Link, X,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Use CDN for pdf worker to avoid complex bundler configuration
pdfjsLib.GlobalWorkerOptions.workerSrc = '//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const GET_PROJECTS = gql`query GetProjects { projects { id name } }`;
const CREATE_PROJECT = gql`
  mutation CreateProject($input: CreateProjectInput!) {
    createProject(input: $input) { id name }
  }
`;
const SAVE_ANALYZED_CONVERSATION = gql`
  mutation SaveAnalyzedConversation($projectId: ID!, $payload: JSON!) {
    saveAnalyzedConversation(projectId: $projectId, payload: $payload) {
      id
    }
  }
`;

interface Message { role: 'USER' | 'ASSISTANT' | 'SYSTEM'; content: string; }
interface AnalysisResult {
  conversationId: string;
  tiltScore: number;
  grade: string;
  flags: Array<{ patternName: string; severity: string; confidence: number; description: string; evidence: string; }>;
}

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700 border-red-200',
  HIGH: 'bg-orange-100 text-orange-700 border-orange-200',
  MEDIUM: 'bg-amber-100 text-amber-700 border-amber-200',
  LOW: 'bg-blue-100 text-blue-700 border-blue-200',
};

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const color = score <= 20 ? '#22c55e' : score <= 40 ? '#f59e0b' : score <= 60 ? '#f97316' : '#ef4444';
  const r = 38;
  const circ = 2 * Math.PI * r;
  const pct = (score / 100) * circ;
  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg className="w-24 h-24 -rotate-90 absolute" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#e2e8f0" strokeWidth="8" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${pct} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease' }} />
      </svg>
      <div className="text-center z-10">
        <p className="text-2xl font-bold" style={{ color }}>{score}</p>
        <p className="text-xs font-bold" style={{ color }}>{grade}</p>
      </div>
    </div>
  );
}

export default function Playground() {
  const { data: projectsData, refetch: refetchProjects } = useQuery(GET_PROJECTS);
  const [createProject] = useMutation(CREATE_PROJECT);
  const [saveAnalyzedConversation] = useMutation(SAVE_ANALYZED_CONVERSATION);
  const projects = projectsData?.projects ?? [];

  const [selectedProjectId, setSelectedProjectId] = useState(() => localStorage.getItem('playground_projectId') || '');
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('playground_messages');
    return saved ? JSON.parse(saved) : [];
  });
  
  useEffect(() => localStorage.setItem('playground_projectId', selectedProjectId), [selectedProjectId]);
  useEffect(() => localStorage.setItem('playground_messages', JSON.stringify(messages)), [messages]);

  const [newRole, setNewRole] = useState<'USER' | 'ASSISTANT' | 'SYSTEM'>('USER');
  const [newContent, setNewContent] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(() => {
    const saved = localStorage.getItem('playground_result');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (result) localStorage.setItem('playground_result', JSON.stringify(result));
    else localStorage.removeItem('playground_result');
  }, [result]);

  const [error, setError] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState('');
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  // URL import state
  const [showUrlImport, setShowUrlImport] = useState(false);
  const [urlInput, setUrlInput] = useState(() => localStorage.getItem('playground_url') || '');
  useEffect(() => localStorage.setItem('playground_url', urlInput), [urlInput]);
  const [urlFetching, setUrlFetching] = useState(false);
  const [urlError, setUrlError] = useState('');
  const [urlSuccess, setUrlSuccess] = useState<{ platform: string; title: string; count: number; warning?: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) setSelectedProjectId(projects[0].id);
  }, [projects]);

  const addMessage = () => {
    if (!newContent.trim()) return;
    setMessages([...messages, { role: newRole, content: newContent.trim() }]);
    setNewContent('');
    textareaRef.current?.focus();
  };

  const removeMessage = (i: number) => setMessages(messages.filter((_, idx) => idx !== i));

  // ── URL import handler ────────────────────────────────────
  const fetchFromUrl = async () => {
    const url = urlInput.trim();
    if (!url) return;
    setUrlError('');
    setUrlSuccess(null);

    // SECURITY FIX (Flaw 13): Intercept unsupported Claude/Gemini URLs early
    if (url.includes('claude.ai') || url.includes('gemini.google.com')) {
      setUrlError("Claude and Gemini conversations cannot be imported via link because they require authentication. Please export your chat as a file and use the 'Import File' option.");
      return;
    }

    setUrlFetching(true);
    try {
      const res = await fetch('http://127.0.0.1:8001/fetch/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail ?? `Server error ${res.status}`);
      }
      const mapped: Message[] = (data.turns ?? []).map((t: any) => ({
        role: (['user', 'human'].includes((t.role ?? '').toLowerCase()) ? 'USER' : 'ASSISTANT') as Message['role'],
        content: t.content ?? '',
      })).filter((m: Message) => m.content.trim());

      if (mapped.length === 0) throw new Error('No messages could be extracted from this URL.');

      setMessages(mapped);
      setUrlSuccess({
        platform: data.platform ?? 'generic',
        title: data.title ?? 'Imported Conversation',
        count: mapped.length,
        warning: data.warning ?? undefined,
      });
    } catch (e: any) {
      setUrlError(e.message ?? 'Failed to fetch the URL.');
    } finally {
      setUrlFetching(false);
    }
  };

  const closeUrlModal = () => {
    setShowUrlImport(false);
    setUrlInput('');
    setUrlError('');
    setUrlSuccess(null);
  };

  const handleImport = () => {
    setImportError('');
    try {
      const parsed = JSON.parse(importJson);
      let arr = Array.isArray(parsed) ? parsed : null;
      if (!arr && parsed.messages && Array.isArray(parsed.messages)) arr = parsed.messages;
      if (!arr && parsed.conversation?.messages && Array.isArray(parsed.conversation.messages)) arr = parsed.conversation.messages;
      
      if (!Array.isArray(arr)) throw new Error('Expected an array of messages');

      const extractContent = (m: any) => {
        if (typeof m.content === 'string' && m.content) return m.content;
        if (typeof m.text === 'string' && m.text) return m.text;
        if (typeof m.message === 'string' && m.message) return m.message;
        if (typeof m.summary === 'string' && m.summary) return m.summary;
        const copy = { ...m };
        delete copy.role;
        return JSON.stringify(copy, null, 2);
      };

      const mapped: Message[] = arr.map((m: any) => ({
        role: (['user', 'human'].includes((m.role ?? '').toLowerCase()) ? 'USER' :
               ['assistant', 'ai', 'model'].includes((m.role ?? '').toLowerCase()) ? 'ASSISTANT' : 'SYSTEM'),
        content: extractContent(m),
      }));
      setMessages(mapped);
      setShowImport(false);
      setImportJson('');
    } catch (e: any) { setImportError(e.message); }
  };

  // ── Garbled text detector ──────────────────────────────────
  // Returns true if text is binary/garbled (can't be reliably analysed)
  const isTextGarbled = (text: string): boolean => {
    if (!text || text.length < 10) return false;
    // Count printable characters (regular ASCII + common Unicode letters)
    const printable = Array.from(text).filter(c => {
      const code = c.charCodeAt(0);
      return (code >= 32 && code <= 126) || // standard printable ASCII
             code === 9 || code === 10 || code === 13 || // tab, LF, CR
             (code >= 0x00C0 && code <= 0x024F) || // Latin Extended
             (code >= 0x0600 && code <= 0x06FF) || // Arabic
             (code >= 0x0900 && code <= 0x097F) || // Devanagari
             (code >= 0x4E00 && code <= 0x9FFF);   // CJK
    }).length;
    const ratio = printable / text.length;
    return ratio < 0.75; // less than 75% readable → garbled
  };

  // ── Conversation parser (shared by PDF + TXT) ─────────────────────────
  const parseConversationText = (fullText: string): Message[] => {
    const msgs: Message[] = [];
    let currentRole: 'USER' | 'ASSISTANT' | 'SYSTEM' = 'USER';
    let currentText = '';

    // Role detection: supports formats like:
    //   User: ..., **User**: ..., [User]: ..., Human: ..., You: ...
    //   Assistant: ..., ChatGPT: ..., Claude: ..., AI: ...
    //   Also handles lines like "--- User ---" or "=== Assistant ==="
    const USER_ROLE_RE    = /^(?:\*\*|__|\[|\s)*(?:user|human|you|me|customer|client|patient|person|questioner)(?:\*\*|__|\])*\s*[:：\-–—]\s*/i;
    const ASST_ROLE_RE    = /^(?:\*\*|__|\[|\s)*(?:assistant|ai|bot|agent|chatgpt|gpt|claude|gemini|doctor|helper|system\s+response)(?:\*\*|__|\])*\s*[:：\-–—]\s*/i;
    const SYSTEM_ROLE_RE  = /^(?:\*\*|__|\[|\s)*(?:system|prompt|context|instruction)(?:\*\*|__|\])*\s*[:：\-–—]\s*/i;
    // Divider-style role markers: === User ===  or  --- Assistant ---
    const USER_DIV_RE     = /^[-=*#]+\s*(?:user|human|you|me|customer)\s*[-=*#]+\s*$/i;
    const ASST_DIV_RE     = /^[-=*#]+\s*(?:assistant|ai|bot|gpt|claude|gemini)\s*[-=*#]+\s*$/i;

    const lines = fullText.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();

      if (USER_ROLE_RE.test(trimmed) || USER_DIV_RE.test(trimmed)) {
        if (currentText.trim()) msgs.push({ role: currentRole, content: currentText.trim() });
        currentRole = 'USER';
        const colonIdx = trimmed.search(/[:：\-–—]/);
        currentText = (colonIdx >= 0 ? trimmed.slice(colonIdx + 1) : '') + '\n';
      } else if (ASST_ROLE_RE.test(trimmed) || ASST_DIV_RE.test(trimmed)) {
        if (currentText.trim()) msgs.push({ role: currentRole, content: currentText.trim() });
        currentRole = 'ASSISTANT';
        const colonIdx = trimmed.search(/[:：\-–—]/);
        currentText = (colonIdx >= 0 ? trimmed.slice(colonIdx + 1) : '') + '\n';
      } else if (SYSTEM_ROLE_RE.test(trimmed)) {
        if (currentText.trim()) msgs.push({ role: currentRole, content: currentText.trim() });
        currentRole = 'SYSTEM';
        const colonIdx = trimmed.search(/[:：\-–—]/);
        currentText = (colonIdx >= 0 ? trimmed.slice(colonIdx + 1) : '') + '\n';
      } else {
        currentText += line + '\n';
      }
    }
    if (currentText.trim()) msgs.push({ role: currentRole, content: currentText.trim() });

    if (msgs.length === 0) return [];

    const hasAssistant = msgs.some(m => m.role === 'ASSISTANT');
    const hasUser = msgs.some(m => m.role === 'USER');

    // If no role markers found at all — try splitting on blank lines (paragraphs)
    // and alternating USER / ASSISTANT
    if (!hasAssistant || !hasUser) {
      const paragraphs = fullText
        .split(/\n{2,}/)
        .map(p => p.trim())
        .filter(p => p.length > 0);

      if (paragraphs.length >= 2) {
        // Multiple paragraphs → alternate roles
        return paragraphs.map((p, idx) => ({
          role: idx % 2 === 0 ? 'USER' : 'ASSISTANT',
          content: p,
        }));
      }

      // Single block — split into equal-ish halves and call first USER, second ASSISTANT
      if (msgs.length === 1) {
        const sentences = fullText.split(/(?<=[.!?])\s+/).filter(s => s.trim());
        if (sentences.length >= 4) {
          const half = Math.ceil(sentences.length / 2);
          return [
            { role: 'USER', content: sentences.slice(0, half).join(' ') },
            { role: 'ASSISTANT', content: sentences.slice(half).join(' ') },
          ];
        }
      }

      // Genuine single-message — assign roles by original alternation
      msgs.forEach((m, idx) => { m.role = idx % 2 === 0 ? 'USER' : 'ASSISTANT'; });
    }

    return msgs;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');

    if (file.name.toLowerCase().endsWith('.pdf')) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          // Join with space but keep line breaks from 'hasEOL' flag
          const pageText = textContent.items.map((item: any) =>
            item.str + (item.hasEOL ? '\n' : '')
          ).join('');
          fullText += pageText + '\n';
        }

        // ✔ Garbled text check — catch image-based or corrupted PDFs early
        if (isTextGarbled(fullText)) {
          setImportError(
            '\u26a0\ufe0f This PDF appears to be image-based or has an unsupported encoding.\n\n' +
            'The extracted text is unreadable (binary/garbled characters detected).\n\n' +
            'Please try:\n' +
            '  • Exporting the conversation as plain text (.txt) from the AI app\n' +
            '  • Copying and pasting the conversation text into \'Paste JSON\'\n' +
            '  • Using a text-based PDF export (not a screenshot/scan)'
          );
          setShowImport(true);
          e.target.value = '';
          return;
        }

        const msgs = parseConversationText(fullText);
        const userCount = msgs.filter(m => m.role === 'USER').length;
        const asstCount = msgs.filter(m => m.role === 'ASSISTANT').length;

        if (msgs.length > 0) {
          setMessages(msgs);
          // Warn if all messages ended up as one role (no markers found)
          if (userCount === 0 || asstCount === 0) {
            setImportError(
              `\u2139\ufe0f Imported ${msgs.length} messages but could not detect role markers.\n` +
              `Alternated USER/ASSISTANT automatically. ` +
              `If the split looks wrong, try adding "User:" and "Assistant:" labels to your chat export.`
            );
          }
        } else {
          setImportError('Could not extract any messages from the PDF.');
          setShowImport(true);
        }
      } catch (err: any) {
        setImportError('Failed to parse PDF: ' + err.message);
        setShowImport(true);
      }
      e.target.value = '';
      return;
    }

    // TXT files: parse directly as conversation text
    if (file.name.toLowerCase().endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;

        // Garbled check for TXT files too
        if (isTextGarbled(text)) {
          setImportError(
            '\u26a0\ufe0f This file contains unreadable/garbled text.\n\n' +
            'Try exporting your conversation as plain text directly from the AI app.'
          );
          setShowImport(true);
          return;
        }

        try {
          const parsed = JSON.parse(text);
          let arr = Array.isArray(parsed) ? parsed : null;
          if (!arr && parsed.messages && Array.isArray(parsed.messages)) arr = parsed.messages;
          if (!arr && parsed.conversation?.messages && Array.isArray(parsed.conversation.messages)) arr = parsed.conversation.messages;
          
          if (Array.isArray(arr)) {
            const extractContent = (m: any) => {
              if (typeof m.content === 'string' && m.content) return m.content;
              if (typeof m.text === 'string' && m.text) return m.text;
              if (typeof m.message === 'string' && m.message) return m.message;
              if (typeof m.summary === 'string' && m.summary) return m.summary;
              const copy = { ...m };
              delete copy.role;
              return JSON.stringify(copy, null, 2);
            };

            const mapped: Message[] = arr.map((m: any) => ({
              role: (['user', 'human'].includes((m.role ?? '').toLowerCase()) ? 'USER' :
                     ['assistant', 'ai', 'model'].includes((m.role ?? '').toLowerCase()) ? 'ASSISTANT' : 'SYSTEM'),
              content: extractContent(m),
            }));
            setMessages(mapped);
            return;
          }
        } catch { /* not JSON, parse as plain text conversation */ }

        const msgs = parseConversationText(text);
        const userCount = msgs.filter(m => m.role === 'USER').length;
        const asstCount = msgs.filter(m => m.role === 'ASSISTANT').length;

        if (msgs.length > 0) {
          setMessages(msgs);
          if (userCount === 0 || asstCount === 0) {
            setImportError(
              `\u2139\ufe0f Imported ${msgs.length} messages — could not detect "User:" / "Assistant:" labels.\n` +
              `Alternated roles automatically. Check the messages panel to verify the split looks right.`
            );
          }
        } else {
          setImportError('Could not extract any messages from the TXT file.');
          setShowImport(true);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
      return;
    }

    // JSON / other: open paste modal
    const reader = new FileReader();
    reader.onload = (ev) => { setImportJson(ev.target?.result as string); setShowImport(true); };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleAnalyze = async () => {
    if (!selectedProjectId) { setError('Please select a project first'); return; }
    if (messages.length === 0) { setError('Add at least one message'); return; }
    setError(''); setAnalyzing(true); setResult(null);
    try {
      // SECURITY FIX (Flaw 11): Route through ingest-service so quotas are enforced and usage is logged.
      // We pass credentials: 'include' so the ingest-service can verify the user's session cookie.
      // @ts-ignore
      const API_URL = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${API_URL}/ingest/analyze/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          project_id: selectedProjectId,
          conversation_id: `playground-${Date.now()}`,
          context_mode: 'playground',
          turns: messages.map((m, i) => ({
            turn_index: i,
            role: m.role.toLowerCase() === 'user' ? 'user' : 'assistant',
            content: m.content,
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Analysis failed' }));
        throw new Error(err.message ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      
      const allFlags = (data.turn_results || []).flatMap((t: any) => 
        (t.flags || []).map((f: any) => ({
          id: Math.random().toString(),
          turnIndex: t.turn_index,
          patternName: f.pattern,
          severity: f.severity,
          scoreImpact: f.score,
          description: f.description,
          evidence: f.evidence?.join(' ') || '',
        }))
      );

      const payload = {
        conversationId: data.conversation_id ?? 'unknown',
        tiltScore: Math.round(data.tilt_score ?? 100),
        grade: data.tilt_grade ?? 'A',
        turns: messages.map((m, i) => ({ role: m.role, content: m.content })),
        flags: allFlags,
      };

      await saveAnalyzedConversation({
        variables: {
          projectId: selectedProjectId,
          payload,
        }
      });

      setResult({
        ...payload,
        flags: allFlags,
      });
    } catch (e: any) { setError(e.message); }
    finally { setAnalyzing(false); }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    setCreatingProject(true);
    try {
      const res = await createProject({ variables: { input: { name: newProjectName.trim() } } });
      await refetchProjects();
      setSelectedProjectId(res.data.createProject.id);
      setShowNewProject(false);
      setNewProjectName('');
    } catch (e: any) { alert(e.message); }
    finally { setCreatingProject(false); }
  };

  const roleColors: Record<string, string> = {
    USER: 'bg-accent-50 border-accent-200 dark:bg-accent-900/20 dark:border-accent-800',
    ASSISTANT: 'bg-slate-50 border-slate-200 dark:bg-navy-800 dark:border-slate-700',
    SYSTEM: 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800',
  };
  const roleBadge: Record<string, string> = {
    USER: 'bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400',
    ASSISTANT: 'bg-slate-100 text-slate-700 dark:bg-navy-700 dark:text-slate-300',
    SYSTEM: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-500 to-purple-600 flex items-center justify-center shadow-lg shadow-accent-500/20">
            <FlaskConical className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Playground</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Test your AI model's conversations for manipulation patterns</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".json,.txt,.pdf" className="hidden" onChange={handleFileUpload} />
          <button onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors">
            <Upload className="h-4 w-4" />Import File
          </button>
          <button onClick={() => setShowUrlImport(true)}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors">
            <Link className="h-4 w-4" />Import URL
          </button>
          <button onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors">
            <FileText className="h-4 w-4" />Paste JSON
          </button>
        </div>
      </div>

      {/* Import modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="convo-card w-full max-w-2xl">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Import Conversation</h2>
              <p className="text-sm text-slate-500 mb-1">Paste a JSON array of messages. Supports OpenAI, Anthropic, and Gemini formats.</p>
              <p className="text-xs text-slate-400 mb-3 font-mono">Format: [{"{"}"role": "user", "content": "Hello"{"}"}]</p>
              <textarea
                value={importJson}
                onChange={(e) => setImportJson(e.target.value)}
                rows={10}
                className="w-full font-mono text-xs px-3 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-navy-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-accent-500 outline-none resize-none"
                placeholder='[{"role": "user", "content": "Hello"}, {"role": "assistant", "content": "Hi there!"}]'
              />
              {importError && <p className="text-sm text-red-600 mt-2">{importError}</p>}
              <div className="flex gap-3 mt-4 justify-end">
                <button onClick={() => { setShowImport(false); setImportError(''); }}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-700">
                  Cancel
                </button>
                <button onClick={handleImport} className="px-4 py-2 rounded-xl bg-accent-600 hover:bg-accent-700 text-white text-sm font-medium">
                  Import
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* URL Import modal */}
      {showUrlImport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="convo-card w-full max-w-lg">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-500 to-purple-600 flex items-center justify-center">
                  <Link className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">Import from URL</h2>
                  <p className="text-xs text-slate-500">Paste a shared conversation link</p>
                </div>
              </div>
              <button onClick={closeUrlModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Supported platforms */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-400">Supports:</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />ChatGPT
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />Generic
                </span>
              </div>

              {/* URL input */}
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <Link className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="url"
                  value={urlInput}
                  onChange={e => { setUrlInput(e.target.value); setUrlError(''); setUrlSuccess(null); }}
                  onKeyDown={e => e.key === 'Enter' && !urlFetching && fetchFromUrl()}
                  placeholder="https://chatgpt.com/share/..."
                  disabled={urlFetching}
                  autoFocus
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-accent-500 outline-none disabled:opacity-60 transition-all"
                />
              </div>

              {/* Fetching state */}
              {urlFetching && (
                <div className="flex items-center gap-3 px-4 py-3 bg-accent-50 dark:bg-accent-900/20 border border-accent-200 dark:border-accent-800 rounded-xl">
                  <Loader2 className="h-4 w-4 text-accent-600 animate-spin flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-accent-700 dark:text-accent-400">Fetching conversation…</p>
                    <p className="text-xs text-accent-600/70 dark:text-accent-500">Downloading and parsing the shared link</p>
                  </div>
                </div>
              )}

              {/* Success state */}
              {urlSuccess && !urlFetching && (
                <div className="space-y-2">
                  <div className="flex items-start gap-3 px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-green-700 dark:text-green-400">
                        Imported {urlSuccess.count} messages
                        <span className="ml-2 text-xs font-normal capitalize opacity-70">from {urlSuccess.platform}</span>
                      </p>
                      <p className="text-xs text-green-600/80 dark:text-green-500 mt-0.5 truncate">{urlSuccess.title}</p>
                    </div>
                  </div>
                  {urlSuccess.warning && (
                    <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700 dark:text-amber-400">{urlSuccess.warning}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Error state */}
              {urlError && !urlFetching && (
                <div className="flex items-start gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 dark:text-red-400">{urlError}</p>
                </div>
              )}

              {/* Platform help */}
              <div className="px-3 py-3 bg-slate-50 dark:bg-navy-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">How to get a shareable link:</p>
                <ul className="space-y-1.5">
                  <li className="flex items-start gap-2 text-xs text-slate-500">
                    <span className="w-2 h-2 rounded-full bg-green-500 mt-0.5 flex-shrink-0" />
                    <span><strong>ChatGPT:</strong> Open a conversation → Share → Copy Link</span>
                  </li>
                  <li className="flex items-start gap-2 text-xs text-slate-500">
                    <span className="w-2 h-2 rounded-full bg-orange-400 mt-0.5 flex-shrink-0" />
                    <span><strong>Claude:</strong> No share link — use Settings → Privacy → Export Data, then Import File</span>
                  </li>
                  <li className="flex items-start gap-2 text-xs text-slate-500">
                    <span className="w-2 h-2 rounded-full bg-slate-400 mt-0.5 flex-shrink-0" />
                    <span><strong>Gemini / others:</strong> Export as .txt or .json, then use Import File</span>
                  </li>
                </ul>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button onClick={closeUrlModal}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors">
                  {urlSuccess ? 'Close' : 'Cancel'}
                </button>
                {urlSuccess ? (
                  <button
                    onClick={() => { closeUrlModal(); }}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                    <CheckCircle className="h-4 w-4" />Analyze Now
                  </button>
                ) : (
                  <button
                    onClick={fetchFromUrl}
                    disabled={!urlInput.trim() || urlFetching}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-accent-600 to-purple-600 hover:from-accent-700 hover:to-purple-700 text-white text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-accent-500/20">
                    {urlFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link className="h-4 w-4" />}
                    {urlFetching ? 'Fetching…' : 'Fetch & Import'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Builder */}
        <div className="space-y-4">
          {/* Project selector */}
          <div className="convo-card p-5">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-slate-900 dark:text-white">Project</label>
              <button onClick={() => setShowNewProject(true)}
                className="flex items-center gap-1.5 text-xs text-accent-600 hover:text-accent-700 font-medium">
                <Plus className="h-3.5 w-3.5" />New Project
              </button>
            </div>
            {showNewProject && (
              <div className="mb-3 flex gap-2">
                <input autoFocus placeholder="Project name" value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 text-sm focus:ring-2 focus:ring-accent-500 outline-none" />
                <button onClick={handleCreateProject} disabled={creatingProject}
                  className="px-3 py-2 bg-accent-600 text-white rounded-xl text-sm disabled:opacity-60">
                  {creatingProject ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
                </button>
                <button onClick={() => setShowNewProject(false)}
                  className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-500">Cancel</button>
              </div>
            )}
            {projects.length === 0 ? (
              <p className="text-sm text-slate-500">No projects yet. Create one to get started.</p>
            ) : (
              <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-accent-500 outline-none">
                {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>

          {/* Messages */}
          <div className="convo-card overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">Messages ({messages.length})</span>
                {messages.length > 0 && (() => {
                  const uCount = messages.filter(m => m.role === 'USER').length;
                  const aCount = messages.filter(m => m.role === 'ASSISTANT').length;
                  return (
                    <>
                      {uCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400">
                          {uCount} USER
                        </span>
                      )}
                      {aCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {aCount} ASST
                        </span>
                      )}
                      {(uCount === 0 || aCount === 0) && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                          ⚠ One-sided
                        </span>
                      )}
                    </>
                  );
                })()}
              </div>
              {messages.length > 0 && (
                <button onClick={() => { setMessages([]); setResult(null); setImportError(''); }}
                  className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" />Clear all
                </button>
              )}
            </div>
            {/* Inline import status banner */}
            {importError && messages.length > 0 && (
              <div className={`px-4 py-2.5 border-b text-xs flex items-start gap-2 ${
                importError.startsWith('⚠') || importError.startsWith('\u26a0')
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                  : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
              }`}>
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <span className="whitespace-pre-line leading-relaxed">{importError}</span>
                <button onClick={() => setImportError('')} className="ml-auto flex-shrink-0 opacity-60 hover:opacity-100">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="text-center py-8">
                  <FlaskConical className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No messages yet</p>
                  <p className="text-xs text-slate-400 mt-1">Add messages below or import a conversation</p>
                </div>
              ) : messages.map((m, i) => (
                <div key={i} className={`border rounded-xl p-3 ${roleColors[m.role]}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-semibold flex-shrink-0 ${roleBadge[m.role]}`}>{m.role}</span>
                    <button onClick={() => removeMessage(i)} className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 mt-2 whitespace-pre-wrap">{m.content}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Add message */}
          <div className="convo-card p-4 space-y-3">
            <div className="flex gap-2">
              {(['USER', 'ASSISTANT', 'SYSTEM'] as const).map((r) => (
                <button key={r} onClick={() => setNewRole(r)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${newRole === r ? roleBadge[r] + ' ring-2 ring-current ring-offset-1' : 'bg-slate-50 dark:bg-navy-800 text-slate-500'}`}>
                  {r}
                </button>
              ))}
            </div>
            <textarea ref={textareaRef} value={newContent} onChange={(e) => setNewContent(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addMessage(); }}
              placeholder={`Type ${newRole.toLowerCase()} message... (Ctrl+Enter to add)`}
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-accent-500 outline-none resize-none" />
            <div className="flex gap-2">
              <button onClick={addMessage} disabled={!newContent.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-100 dark:bg-navy-700 hover:bg-slate-200 dark:hover:bg-navy-600 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium transition-colors disabled:opacity-60">
                <Plus className="h-4 w-4" />Add Message
              </button>
              <button onClick={handleAnalyze} disabled={analyzing || messages.length === 0 || !selectedProjectId}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-accent-600 to-purple-600 hover:from-accent-700 hover:to-purple-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-accent-500/20 disabled:opacity-60">
                {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
                {analyzing ? 'Analyzing...' : 'Analyze'}
              </button>
            </div>
          </div>

          {error && (
            <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Right: Results */}
        <div>
          {!result && !analyzing ? (
            <div className="convo-card h-full flex items-center justify-center p-12 min-h-[400px]">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-500/10 to-purple-500/10 flex items-center justify-center mx-auto mb-4">
                  <ShieldAlert className="h-8 w-8 text-accent-400" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">Results appear here</h3>
                <p className="text-sm text-slate-500 max-w-xs mb-6">Add messages and click Analyze to detect manipulation patterns.</p>
                <div className="space-y-2 text-left">
                  <div className="flex items-start gap-2 text-xs text-slate-400">
                    <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>Supports OpenAI, Anthropic, Gemini JSON for import</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-slate-400">
                    <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>TiltScore 0–100 (0 = clean, higher = more manipulation detected)</span>
                  </div>
                </div>
              </div>
            </div>
          ) : analyzing ? (
            <div className="convo-card h-full flex items-center justify-center p-12 min-h-[400px]">
              <div className="text-center">
                <Loader2 className="h-10 w-10 animate-spin text-accent-500 mx-auto mb-4" />
                <p className="text-sm font-medium text-slate-900 dark:text-white">Analyzing conversation...</p>
                <p className="text-xs text-slate-500 mt-1">Running manipulation detection models</p>
              </div>
            </div>
          ) : result ? (
            <div className="space-y-4">
              {/* Score card */}
              <div className="convo-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">Analysis Result</h2>
                  <span className="text-xs text-slate-400 font-mono">{result.conversationId.slice(0, 12)}...</span>
                </div>
                <div className="flex items-center gap-6">
                  <ScoreRing score={result.tiltScore} grade={result.grade} />
                  <div className="space-y-2">
                    <div><p className="text-xs text-slate-500">TiltScore</p><p className="text-lg font-bold text-slate-900 dark:text-white">{result.tiltScore}<span className="text-sm font-normal text-slate-400">/100</span></p></div>
                    <div><p className="text-xs text-slate-500">Flags</p><p className="text-lg font-bold text-slate-900 dark:text-white">{result.flags.length}</p></div>
                    <div><p className="text-xs text-slate-500">Grade</p><p className="text-lg font-bold text-slate-900 dark:text-white">{result.grade}</p></div>
                  </div>
                </div>
                {result.tiltScore <= 20 && (
                  <div className="mt-4 flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                    <CheckCircle className="h-4 w-4" />No significant manipulation detected
                  </div>
                )}
              </div>

              {/* Flags */}
              {result.flags.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white px-1">Detected Patterns ({result.flags.length})</h3>
                  {result.flags.map((flag, i) => (
                    <div key={i} className={`border rounded-xl p-4 ${SEVERITY_COLORS[flag.severity] ?? SEVERITY_COLORS.LOW}`}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                          <span className="text-sm font-semibold">{flag.patternName.replace(/_/g, ' ')}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/50">{flag.severity}</span>
                          <span className="text-xs opacity-70">{Math.round(flag.confidence * 100)}%</span>
                        </div>
                      </div>
                      <p className="text-xs opacity-80 mb-1">{flag.description}</p>
                      {flag.evidence && <p className="text-xs opacity-70"><span className="font-semibold">Evidence: </span>{flag.evidence}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="convo-card p-6 text-center">
                  <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-900 dark:text-white">No flags detected</p>
                  <p className="text-xs text-slate-500 mt-1">This conversation appears clean</p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
