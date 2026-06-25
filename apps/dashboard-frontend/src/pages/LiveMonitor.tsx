import React, { useState, useEffect } from 'react';
import { gql, useQuery } from '@apollo/client';
import { Radio, Loader2, Activity, ShieldAlert, Zap, AlertTriangle } from 'lucide-react';

const GET_PROJECTS = gql`query GetProjects { projects { id name } }`;

const GET_LIVE_DATA = gql`
  query GetLiveData($projectId: ID!) {
    conversations(projectId: $projectId, first: 10) {
      edges {
        node { id externalId status tiltScore grade flagCount turnCount startedAt }
      }
    }
    flags(projectId: $projectId, limit: 10) {
      id patternName severity confidence createdAt
    }
    dashboardMetrics(projectId: $projectId) {
      avgTiltScore
      flaggedTurns
      totalConversations
    }
  }
`;

function StatCard({ title, value, subtitle, icon: Icon, colorClass }: any) {
  return (
    <div className="convo-card p-6">
      <div className="flex items-start justify-between mb-2">
        <div className={`p-3 rounded-xl ${colorClass}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex h-3 w-3 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-accent-500"></span>
        </div>
      </div>
      <p className="text-sm font-medium text-slate-500 mt-4 mb-1">{title}</p>
      <div className="flex items-baseline gap-2">
        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{value}</h3>
        <span className="text-xs font-medium text-slate-400">{subtitle}</span>
      </div>
    </div>
  );
}

export default function LiveMonitor() {
  const { data: projectsData } = useQuery(GET_PROJECTS);
  const projects = projectsData?.projects ?? [];
  const [selectedProject, setSelectedProject] = useState('');

  useEffect(() => {
    if (projects.length > 0 && !selectedProject) setSelectedProject(projects[0].id);
  }, [projects]);

  const { data, loading } = useQuery(GET_LIVE_DATA, {
    variables: { projectId: selectedProject },
    skip: !selectedProject,
    pollInterval: 5000, // Poll every 5 seconds for "live" feel
  });

  if (loading && !data) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-accent-500" /></div>;

  const metrics = data?.dashboardMetrics;
  const recentConvs = data?.conversations?.edges?.map((e: any) => e.node) ?? [];
  const recentFlags = data?.flags ?? [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-accent-50 text-accent-600 dark:bg-accent-900/20 dark:text-accent-400">
            <Radio className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Live Monitor</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Real-time event stream</p>
          </div>
        </div>
        {projects.length > 0 && (
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-slate-700 text-sm rounded-xl px-3 py-2 outline-none"
          >
            {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Current Health"
          value={metrics ? Math.round(metrics.avgTiltScore) : 0}
          subtitle="Avg TiltScore"
          icon={Activity}
          colorClass="bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400"
        />
        <StatCard
          title="Active Sessions"
          value={metrics?.totalConversations || 0}
          subtitle="Total recorded"
          icon={Zap}
          colorClass="bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
        />
        <StatCard
          title="Security Events"
          value={metrics?.flaggedTurns || 0}
          subtitle="Flagged convos"
          icon={ShieldAlert}
          colorClass="bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Conversations Stream */}
        <div className="convo-card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-navy-800/50">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-accent-500 animate-pulse" />
              Latest Conversations
            </h2>
          </div>
          <div className="p-0">
            {recentConvs.length === 0 ? (
              <p className="p-5 text-sm text-slate-500 text-center">Waiting for incoming events...</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[500px] overflow-y-auto">
                {recentConvs.map((conv: any) => (
                  <div key={conv.id} className="p-4 hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {conv.externalId || conv.id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">{new Date(conv.startedAt).toLocaleTimeString()}</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-semibold mb-1 ${
                        conv.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                        conv.status === 'FLAGGED' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {conv.status}
                      </span>
                      <p className="text-xs text-slate-500">Score: {conv.tiltScore ? Math.round(conv.tiltScore) : '-'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Real-time Threat Stream */}
        <div className="convo-card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-navy-800/50">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              Threat Detections
            </h2>
          </div>
          <div className="p-0">
            {recentFlags.length === 0 ? (
              <p className="p-5 text-sm text-slate-500 text-center">No threats detected recently.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[500px] overflow-y-auto">
                {recentFlags.map((flag: any) => (
                  <div key={flag.id} className="p-4 hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors flex items-start gap-3">
                    <div className={`p-2 rounded-lg mt-0.5 ${
                      flag.severity === 'CRITICAL' ? 'bg-red-100 text-red-600' :
                      flag.severity === 'HIGH' ? 'bg-orange-100 text-orange-600' :
                      flag.severity === 'MEDIUM' ? 'bg-amber-100 text-amber-600' :
                      'bg-blue-100 text-blue-600'
                    }`}>
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {flag.patternName.replace(/_/g, ' ')}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs">
                        <span className="text-slate-500">{new Date(flag.createdAt).toLocaleTimeString()}</span>
                        <span className="text-slate-300 dark:text-slate-700">•</span>
                        <span className="font-medium text-slate-600 dark:text-slate-400">Confidence: {Math.round(flag.confidence * 100)}%</span>
                        <span className="text-slate-300 dark:text-slate-700">•</span>
                        <span className="font-medium text-slate-600 dark:text-slate-400">{flag.severity}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
