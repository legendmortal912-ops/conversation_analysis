import React, { useState, useEffect } from 'react';
import { gql, useQuery } from '@apollo/client';
import { Search, ChevronRight, Loader2, MessageSquare, FlaskConical } from 'lucide-react';
import { Link } from 'react-router-dom';

const GET_PROJECTS = gql`query GetProjects { projects { id name } }`;
const GET_CONVERSATIONS = gql`
  query GetConversations($projectId: ID!, $first: Int, $after: String, $filters: ConversationFilters) {
    conversations(projectId: $projectId, first: $first, after: $after, filters: $filters) {
      totalCount
      pageInfo { hasNextPage endCursor }
      edges {
        cursor
        node { id externalId status tiltScore grade flagCount turnCount startedAt }
      }
    }
  }
`;
const SEARCH_CONVERSATIONS = gql`
  query SearchConvs($projectId: ID!, $query: String!) {
    searchConversations(projectId: $projectId, query: $query) {
      id externalId status tiltScore grade flagCount turnCount startedAt
    }
  }
`;

const statusBadge = (status: string) => {
  switch (status) {
    case 'COMPLETED': return 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400';
    case 'ACTIVE': return 'bg-accent-50 text-accent-700 dark:bg-accent-900/20 dark:text-accent-400';
    case 'FLAGGED': return 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400';
    default: return 'bg-slate-100 text-slate-600';
  }
};

const gradeColor = (grade: string | null) => {
  if (grade === 'A') return 'text-green-600';
  if (grade === 'B') return 'text-blue-500';
  if (grade === 'C') return 'text-amber-500';
  return 'text-red-600';
};

export default function Conversations() {
  const { data: projectsData, loading: projectsLoading } = useQuery(GET_PROJECTS);
  const projects = projectsData?.projects ?? [];
  const [selectedProject, setSelectedProject] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    if (projects.length > 0 && !selectedProject) setSelectedProject(projects[0].id);
  }, [projects]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data, loading, fetchMore } = useQuery(GET_CONVERSATIONS, {
    variables: { projectId: selectedProject, first: 20 },
    skip: !selectedProject || !!debouncedSearch,
  });

  const { data: searchData, loading: searchLoading } = useQuery(SEARCH_CONVERSATIONS, {
    variables: { projectId: selectedProject, query: debouncedSearch },
    skip: !selectedProject || !debouncedSearch,
  });

  const conversations = debouncedSearch
    ? (searchData?.searchConversations ?? [])
    : (data?.conversations?.edges?.map((e: any) => e.node) ?? []);

  const totalCount = data?.conversations?.totalCount ?? 0;
  const hasNextPage = data?.conversations?.pageInfo?.hasNextPage ?? false;
  const endCursor = data?.conversations?.pageInfo?.endCursor;

  const handleLoadMore = () => {
    if (!hasNextPage || !endCursor) return;
    fetchMore({ variables: { after: endCursor } });
  };

  if (projectsLoading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-accent-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Conversations</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">All analyzed AI interactions</p>
        </div>
        <div className="flex items-center gap-3">
          {projects.length > 0 && (
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-800 text-sm focus:ring-2 focus:ring-accent-500 outline-none"
            >
              {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <div className="relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-navy-800 focus:ring-2 focus:ring-accent-500 outline-none w-44"
            />
          </div>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="convo-card p-16 text-center">
          <MessageSquare className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="font-medium text-slate-900 dark:text-white mb-2">No projects yet</p>
          <p className="text-sm text-slate-500 mb-4">Create a project and analyze conversations in the Playground first.</p>
          <Link to="/playground" className="inline-flex items-center gap-2 px-4 py-2 bg-accent-600 text-white rounded-xl text-sm font-medium">
            <FlaskConical className="h-4 w-4" />Open Playground
          </Link>
        </div>
      ) : (
        <div className="convo-card overflow-hidden">
          {(loading || searchLoading) && conversations.length === 0 ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-accent-500" /></div>
          ) : conversations.length === 0 ? (
            <div className="py-16 text-center">
              <MessageSquare className="h-8 w-8 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">
                {debouncedSearch ? 'No conversations match your search.' : 'No conversations yet. Analyze one in the Playground.'}
              </p>
            </div>
          ) : (
            <>
              <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-sm text-slate-500">
                  {debouncedSearch ? `${conversations.length} result(s)` : `${totalCount} conversations total`}
                </span>
              </div>
              <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
                <thead className="bg-slate-50 dark:bg-navy-800">
                  <tr>
                    {['ID', 'Status', 'Score', 'Flags', 'Turns', 'Started', ''].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-navy-900 divide-y divide-slate-100 dark:divide-slate-800">
                  {conversations.map((conv: any) => (
                    <tr key={conv.id} className="hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                          {conv.externalId || (conv.id.slice(0, 12) + '...')}
                        </div>
                        <div className="text-xs text-slate-400 font-mono">{conv.id.slice(0, 8)}</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${statusBadge(conv.status)}`}>
                          {conv.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {conv.tiltScore != null ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900 dark:text-white">{Math.round(conv.tiltScore)}</span>
                            <span className={`text-sm font-bold ${gradeColor(conv.grade)}`}>{conv.grade}</span>
                          </div>
                        ) : <span className="text-xs text-slate-400">Pending</span>}
                      </td>
                      <td className="px-5 py-4">
                        {conv.flagCount > 0
                          ? <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">{conv.flagCount} flag{conv.flagCount > 1 ? 's' : ''}</span>
                          : <span className="text-xs text-slate-400">None</span>}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-500">{conv.turnCount}</td>
                      <td className="px-5 py-4 text-sm text-slate-500">{new Date(conv.startedAt).toLocaleString()}</td>
                      <td className="px-5 py-4 text-right">
                        <Link to={`/conversations/${conv.id}`} className="flex items-center justify-end gap-1 text-accent-600 hover:text-accent-700 text-sm font-medium">
                          View <ChevronRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {hasNextPage && !debouncedSearch && (
                <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 text-center">
                  <button onClick={handleLoadMore} className="px-5 py-2 text-sm font-medium text-accent-600 hover:bg-accent-50 rounded-xl transition-colors">
                    Load more
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
