import React, { useState } from 'react';
import {
  FileBarChart, Download, Plus, Loader2, Calendar,
  FileText, ShieldAlert, TrendingDown, Bot, BarChart3,
  AlertTriangle, CheckCircle, X,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GeneratedReport {
  id: string;
  type: string;
  status: 'COMPLETED' | 'PROCESSING';
  createdAt: string;
  dateFrom: string;
  dateTo: string;
  model: string;
  blob?: Blob;
}

// ─── Report Data ──────────────────────────────────────────────────────────────

const MODELS = ['All Models', 'Loan Advisor Bot', 'Customer Support AI', 'Investment Advisory', 'KYC Assistant'];

const REPORT_TYPES = [
  { value: 'SECURITY_AUDIT', label: 'Security Audit', desc: 'Full manipulation detection audit with flag breakdown' },
  { value: 'EXECUTIVE_SUMMARY', label: 'Executive Summary', desc: 'C-suite overview of AI model health and risk posture' },
  { value: 'PATTERN_ANALYSIS', label: 'Pattern Analysis', desc: 'Deep dive into manipulation patterns and trends' },
  { value: 'COMPLIANCE_REPORT', label: 'Compliance Report', desc: 'Regulatory-ready report with immutable audit chain' },
];

// ─── Report HTML generator ────────────────────────────────────────────────────

function generateReportHTML(params: {
  type: string;
  model: string;
  dateFrom: string;
  dateTo: string;
}): string {
  const typeLabel = REPORT_TYPES.find((t) => t.value === params.type)?.label ?? params.type;
  const now = new Date().toLocaleString();

  // Fake but realistic stats
  const totalConversations = params.model === 'All Models' ? 8000 : 2000;
  const flagged = params.model === 'All Models' ? 2400 : 600;
  const critical = params.model === 'All Models' ? 800 : 200;
  const avgTiltScore = params.model === 'Investment Advisory' ? 28.1 : params.model === 'Customer Support AI' ? 55.7 : params.model === 'KYC Assistant' ? 91.2 : 75.4;

  const patternData = [
    { name: 'False Urgency', rate: '12.4%', severity: 'HIGH', count: Math.round(totalConversations * 0.124) },
    { name: 'Topic Hijacking', rate: '8.9%', severity: 'HIGH', count: Math.round(totalConversations * 0.089) },
    { name: 'Concern Dismissal', rate: '15.2%', severity: 'MEDIUM', count: Math.round(totalConversations * 0.152) },
    { name: 'Opinion Injection', rate: '7.3%', severity: 'MEDIUM', count: Math.round(totalConversations * 0.073) },
    { name: 'Agenda Persistence', rate: '11.1%', severity: 'MEDIUM', count: Math.round(totalConversations * 0.111) },
  ];

  const sevColor = (s: string) => s === 'HIGH' ? '#ef4444' : '#f59e0b';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>ConvoGuard — ${typeLabel}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: #fff; }
  .page { max-width: 860px; margin: 0 auto; padding: 48px 48px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 2px solid #6366f1; }
  .logo { font-size: 22px; font-weight: 800; color: #6366f1; letter-spacing: -0.5px; }
  .logo span { color: #a855f7; }
  .report-meta { text-align: right; font-size: 12px; color: #64748b; }
  .report-meta h2 { font-size: 18px; font-weight: 700; color: #1e293b; margin-bottom: 4px; }
  .section { margin-bottom: 36px; }
  .section-title { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #6366f1; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
  .kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }
  .kpi-value { font-size: 28px; font-weight: 800; color: #1e293b; }
  .kpi-label { font-size: 11px; color: #64748b; margin-top: 4px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  .kpi.danger .kpi-value { color: #ef4444; }
  .kpi.warning .kpi-value { color: #f59e0b; }
  .kpi.good .kpi-value { color: #10b981; }
  .tiltscore-box { background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); border-radius: 16px; padding: 24px; color: white; margin-bottom: 24px; }
  .tiltscore-box h3 { font-size: 13px; opacity: 0.8; margin-bottom: 8px; }
  .tiltscore-num { font-size: 64px; font-weight: 900; letter-spacing: -2px; }
  .tiltscore-desc { font-size: 13px; opacity: 0.85; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: #f1f5f9; padding: 10px 14px; text-align: left; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; }
  td { padding: 12px 14px; border-bottom: 1px solid #f1f5f9; }
  tr:last-child td { border-bottom: none; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 700; }
  .badge-high { background: #fef2f2; color: #dc2626; }
  .badge-medium { background: #fffbeb; color: #d97706; }
  .bar { height: 8px; background: #e2e8f0; border-radius: 4px; margin-top: 4px; }
  .bar-fill { height: 100%; border-radius: 4px; }
  .finding { background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 14px 16px; margin-bottom: 12px; }
  .finding.warning { background: #fffbeb; border-color: #fde68a; }
  .finding-title { font-weight: 700; font-size: 13px; color: #1e293b; margin-bottom: 4px; }
  .finding-desc { font-size: 12px; color: #475569; line-height: 1.5; }
  .footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; }
  .audit-hash { font-family: monospace; font-size: 10px; color: #94a3b8; }
</style>
</head>
<body>
<div class="page">

  <div class="header">
    <div>
      <div class="logo">Convo<span>Guard</span></div>
      <div style="font-size:11px;color:#64748b;margin-top:4px;">AI Safety &amp; Model Observability Platform</div>
    </div>
    <div class="report-meta">
      <h2>${typeLabel}</h2>
      <div>Model: <strong>${params.model}</strong></div>
      <div>Period: ${new Date(params.dateFrom).toLocaleDateString()} – ${new Date(params.dateTo).toLocaleDateString()}</div>
      <div>Generated: ${now}</div>
      <div style="margin-top:6px;" class="audit-hash">Report ID: cg_rpt_${Math.random().toString(36).slice(2,18)}</div>
    </div>
  </div>

  <!-- Executive Summary -->
  <div class="section">
    <div class="section-title">Executive Summary</div>
    <div class="tiltscore-box">
      <h3>FLEET AVERAGE TILTSCORE™</h3>
      <div class="tiltscore-num">${avgTiltScore.toFixed(1)}</div>
      <div class="tiltscore-desc">${avgTiltScore <= 30 ? '✅ Healthy — Your AI models are operating within safe behavioral bounds.' : avgTiltScore <= 60 ? '⚠️ Concerning — Multiple manipulation patterns detected. Review flagged conversations.' : '🚨 Critical — Significant manipulation risk. Immediate intervention recommended.'}</div>
    </div>
    <div class="kpi-grid">
      <div class="kpi ${avgTiltScore > 70 ? 'danger' : avgTiltScore > 40 ? 'warning' : 'good'}">
        <div class="kpi-value">${avgTiltScore.toFixed(0)}</div>
        <div class="kpi-label">TiltScore™</div>
      </div>
      <div class="kpi">
        <div class="kpi-value">${totalConversations.toLocaleString()}</div>
        <div class="kpi-label">Conversations</div>
      </div>
      <div class="kpi danger">
        <div class="kpi-value">${flagged.toLocaleString()}</div>
        <div class="kpi-label">Flagged (${((flagged/totalConversations)*100).toFixed(1)}%)</div>
      </div>
      <div class="kpi danger">
        <div class="kpi-value">${critical.toLocaleString()}</div>
        <div class="kpi-label">Critical Risk</div>
      </div>
    </div>
  </div>

  <!-- Pattern Analysis -->
  <div class="section">
    <div class="section-title">Manipulation Pattern Breakdown</div>
    <table>
      <thead>
        <tr>
          <th>Pattern</th>
          <th>Detection Rate</th>
          <th>Conversations Affected</th>
          <th>Severity</th>
          <th>Distribution</th>
        </tr>
      </thead>
      <tbody>
        ${patternData.map((p) => `
        <tr>
          <td><strong>${p.name}</strong></td>
          <td>${p.rate}</td>
          <td>${p.count.toLocaleString()}</td>
          <td><span class="badge badge-${p.severity.toLowerCase()}">${p.severity}</span></td>
          <td>
            <div class="bar">
              <div class="bar-fill" style="width:${p.rate};background:${sevColor(p.severity)}"></div>
            </div>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>

  <!-- Key Findings -->
  <div class="section">
    <div class="section-title">Key Findings &amp; Recommendations</div>

    ${avgTiltScore < 40 ? `
    <div class="finding">
      <div class="finding-title">🚨 Critical: AI Model Exhibiting Systematic Manipulation</div>
      <div class="finding-desc">The Investment Advisory model has a TiltScore of ${avgTiltScore.toFixed(1)}, indicating systematic use of false urgency and agenda persistence. 30% of conversations show the AI repeatedly redirecting users back to product promotion after explicit user resistance. Immediate model retraining or suspension is recommended.</div>
    </div>` : ''}

    <div class="finding warning">
      <div class="finding-title">⚠️ High Rate of Concern Dismissal Detected</div>
      <div class="finding-desc">15.2% of AI responses acknowledge user concerns but immediately pivot to promotional content without substantively addressing the concern. This pattern is associated with lower user trust scores and higher churn risk in fintech contexts.</div>
    </div>

    <div class="finding warning">
      <div class="finding-title">⚠️ False Urgency Patterns in 12.4% of Conversations</div>
      <div class="finding-desc">The AI is creating artificial time pressure ("limited spots", "offer expires today") without factual basis. This is classified as a dark pattern under FTC guidelines and may expose the organization to regulatory risk.</div>
    </div>

    <div class="finding" style="background:#f0fdf4;border-color:#bbf7d0;">
      <div class="finding-title">✅ Recommendation: Enable Real-Time Alerts</div>
      <div class="finding-desc">Configure TiltScore alert thresholds at 60 to catch concerning conversations before they reach the critical range. The ConvoGuard SDK supports real-time webhook notifications within 200ms of conversation completion.</div>
    </div>
  </div>

  <!-- Audit Trail -->
  <div class="section">
    <div class="section-title">Immutable Audit Trail</div>
    <table>
      <thead>
        <tr><th>Timestamp</th><th>Event</th><th>Hash (SHA-256)</th></tr>
      </thead>
      <tbody>
        ${Array.from({ length: 5 }, (_, i) => `
        <tr>
          <td style="font-family:monospace;font-size:11px;">${new Date(Date.now() - i * 86400000).toISOString().slice(0,19)}Z</td>
          <td>${['Analysis batch completed', 'Pattern model updated', 'Alert threshold triggered', 'Conversation ingested', 'Report generated'][i]}</td>
          <td style="font-family:monospace;font-size:10px;color:#64748b;">${Math.random().toString(36).repeat(4).slice(0,40)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>

  <div class="footer">
    <div>ConvoGuard™ — AI Safety &amp; Model Observability | confidential</div>
    <div class="audit-hash">Merkle root: ${Math.random().toString(36).repeat(5).slice(0,64)}</div>
  </div>

</div>
</body>
</html>`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Reports() {
  const [reports, setReports] = useState<GeneratedReport[]>([]);
  const [showGenerate, setShowGenerate] = useState(false);
  const [reportType, setReportType] = useState('SECURITY_AUDIT');
  const [selectedModel, setSelectedModel] = useState('All Models');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!selectedModel) return;
    setGenerating(true);
    // Simulate processing delay
    await new Promise((r) => setTimeout(r, 1800));

    const html = generateReportHTML({ type: reportType, model: selectedModel, dateFrom, dateTo });
    const blob = new Blob([html], { type: 'text/html' });
    const typeLabel = REPORT_TYPES.find((t) => t.value === reportType)?.label ?? reportType;

    const report: GeneratedReport = {
      id: `rpt_${Date.now().toString(36)}`,
      type: typeLabel,
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
      dateFrom,
      dateTo,
      model: selectedModel,
      blob,
    };

    setReports((prev) => [report, ...prev]);
    setShowGenerate(false);
    setGenerating(false);
  };

  const handleDownload = (report: GeneratedReport) => {
    if (!report.blob) return;
    const url = URL.createObjectURL(report.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ConvoGuard_${report.type.replace(/\s+/g, '_')}_${report.dateFrom}_${report.dateTo}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const typeLabel = (type: string) => REPORT_TYPES.find((t) => t.value === type)?.label ?? type;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Reports</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Generate detailed audit reports and compliance exports</p>
        </div>
        <button
          onClick={() => setShowGenerate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20"
        >
          <Plus className="h-4 w-4" />
          Generate Report
        </button>
      </div>

      {/* Report types info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {REPORT_TYPES.map((rt) => (
          <div key={rt.value} className="convo-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-indigo-400" />
              <span className="text-xs font-semibold text-slate-900 dark:text-white">{rt.label}</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">{rt.desc}</p>
          </div>
        ))}
      </div>

      {/* Generate modal */}
      {showGenerate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !generating && setShowGenerate(false)} />
          <div className="relative w-full max-w-lg bg-[#0f1629] border border-slate-700/60 rounded-2xl shadow-2xl p-6">
            <button
              onClick={() => setShowGenerate(false)}
              disabled={generating}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <h2 className="text-lg font-bold text-white mb-1">Generate New Report</h2>
            <p className="text-sm text-slate-400 mb-6">Creates a detailed HTML report you can download and share.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Report Type</label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-white text-sm focus:outline-none focus:border-indigo-500/60"
                >
                  {REPORT_TYPES.map((rt) => (
                    <option key={rt.value} value={rt.value}>{rt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Model</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-white text-sm focus:outline-none focus:border-indigo-500/60"
                >
                  {MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Start Date</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-white text-sm focus:outline-none focus:border-indigo-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">End Date</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-white text-sm focus:outline-none focus:border-indigo-500/60"
                  />
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={generating}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-semibold transition-all disabled:opacity-70 shadow-lg shadow-indigo-500/20"
              >
                {generating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Generating report...</>
                ) : (
                  <><BarChart3 className="h-4 w-4" /> Generate & Download</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reports list */}
      {reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center convo-card">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center mb-4">
            <FileBarChart className="h-8 w-8 text-indigo-400" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">No reports yet</h2>
          <p className="text-slate-500 text-sm max-w-sm mb-6">
            Generate your first report to get a detailed analysis of your AI models' safety posture.
          </p>
          <button
            onClick={() => setShowGenerate(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-500/20"
          >
            <Plus className="h-4 w-4" /> Generate First Report
          </button>
        </div>
      ) : (
        <div className="convo-card overflow-hidden">
          <table className="min-w-full">
            <thead className="border-b border-slate-700/40">
              <tr>
                {['Report', 'Model', 'Period', 'Status', ''].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {reports.map((report) => (
                <tr key={report.id} className="hover:bg-slate-700/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{report.type}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">{report.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-sm text-slate-300">
                      <Bot className="h-3.5 w-3.5 text-slate-500" />
                      {report.model}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-sm text-slate-400">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(report.dateFrom).toLocaleDateString()} – {new Date(report.dateTo).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <CheckCircle className="h-3 w-3" /> Ready
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDownload(report)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700/60 text-sm font-medium text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" /> Download
                    </button>
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
