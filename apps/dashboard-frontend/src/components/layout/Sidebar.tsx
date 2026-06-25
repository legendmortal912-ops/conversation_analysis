import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/ui';
import {
  LayoutDashboard,
  MessageSquare,
  Bell,
  FileBarChart,
  Settings,
  Radio,
  Shield,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  Bot,
} from 'lucide-react';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/playground', icon: FlaskConical, label: 'Playground' },
  { to: '/models', icon: Bot, label: 'Models Fleet' },
  { to: '/conversations', icon: MessageSquare, label: 'Conversations' },
  { to: '/alerts', icon: Bell, label: 'Alerts' },
  { to: '/live', icon: Radio, label: 'Live Monitor' },
  { to: '/reports', icon: FileBarChart, label: 'Reports' },
];

const settingsItems = [
  { to: '/settings/general', label: 'General' },
  { to: '/settings/team', label: 'Team' },
  { to: '/settings/api-keys', label: 'API Keys' },
  { to: '/settings/alerts', label: 'Alert Rules' },
  { to: '/settings/billing', label: 'Billing' },
];

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebarCollapse } = useUIStore();
  const location = useLocation();
  const isSettings = location.pathname.startsWith('/settings');

  return (
    <aside
      className={cn(
        'glass-sidebar h-screen flex flex-col transition-all duration-300 ease-in-out z-30',
        sidebarCollapsed ? 'w-[72px]' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className={cn('flex items-center h-16 px-4 border-b border-slate-200/50 dark:border-slate-700/30', sidebarCollapsed ? 'justify-center' : 'gap-3')}>
        <div className="relative flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-500 to-purple-600 flex items-center justify-center shadow-lg shadow-accent-500/30">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-success-500 rounded-full border-2 border-white dark:border-navy-900" />
        </div>
        {!sidebarCollapsed && (
          <div className="animate-fade-in">
            <h1 className="text-base font-bold text-navy-900 dark:text-white tracking-tight">ConvoGuard</h1>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium tracking-widest uppercase">Shield AI</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className={cn('text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-600 mb-3', sidebarCollapsed ? 'text-center' : 'px-3')}>
          {sidebarCollapsed ? '•••' : 'Main'}
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group',
                  sidebarCollapsed && 'justify-center px-2',
                  isActive
                    ? 'bg-accent-50 dark:bg-accent-900/20 text-accent-600 dark:text-accent-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-700/50 hover:text-navy-900 dark:hover:text-white'
                )
              }
            >
              <Icon className={cn('h-5 w-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110')} />
              {!sidebarCollapsed && <span className="animate-fade-in">{item.label}</span>}
            </NavLink>
          );
        })}

        {/* Settings Section */}
        <div className="pt-4">
          <p className={cn('text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-600 mb-3', sidebarCollapsed ? 'text-center' : 'px-3')}>
            {sidebarCollapsed ? '•••' : 'Settings'}
          </p>
          {sidebarCollapsed ? (
            <NavLink
              to="/settings/project"
              className={({ isActive }) =>
                cn(
                  'flex items-center justify-center px-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group',
                  isActive || isSettings
                    ? 'bg-accent-50 dark:bg-accent-900/20 text-accent-600 dark:text-accent-400'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-700/50'
                )
              }
            >
              <Settings className="h-5 w-5 group-hover:scale-110 transition-transform" />
            </NavLink>
          ) : (
            settingsItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-accent-50 dark:bg-accent-900/20 text-accent-600 dark:text-accent-400'
                      : 'text-slate-500 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-navy-700/50 hover:text-navy-900 dark:hover:text-white'
                  )
                }
              >
                <div className="w-5 h-5 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-current" />
                </div>
                <span>{item.label}</span>
              </NavLink>
            ))
          )}
        </div>
      </nav>

      {/* Collapse Toggle */}
      <div className="p-3 border-t border-slate-200/50 dark:border-slate-700/30">
        <button
          onClick={toggleSidebarCollapse}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-700/50 transition-colors"
        >
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!sidebarCollapsed && <span className="text-xs">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
