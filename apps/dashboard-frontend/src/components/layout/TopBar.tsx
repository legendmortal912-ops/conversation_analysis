import React from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import { useUIStore } from '@/stores/ui';
import { Dropdown } from '@/components/ui/Dropdown';
import {
  Bell,
  Moon,
  Sun,
  Monitor,
  LogOut,
  User,
  Settings,
  ChevronDown,
} from 'lucide-react';

export function TopBar() {
  const navigate = useNavigate();
  const { user, org, logout } = useAuthStore();
  const { theme, setTheme, notifications, markAllNotificationsRead } = useUIStore();
  const unreadCount = notifications.filter((n) => !n.read).length;

  const themeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;
  const ThemeIcon = themeIcon;

  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-slate-200/50 dark:border-slate-700/30 bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl z-20">
      {/* Left */}
      <div className="flex items-center gap-4">
        {org && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
              {org.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-navy-900 dark:text-white leading-tight">{org.name}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 capitalize">{org.plan} plan</p>
            </div>
          </div>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <Dropdown
          align="right"
          trigger={
            <button className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors">
              <ThemeIcon className="h-4.5 w-4.5" />
            </button>
          }
          items={[
            { label: 'Light', value: 'light', icon: <Sun className="h-4 w-4" /> },
            { label: 'Dark', value: 'dark', icon: <Moon className="h-4 w-4" /> },
            { label: 'System', value: 'system', icon: <Monitor className="h-4 w-4" /> },
          ]}
          onSelect={(value) => setTheme(value as 'light' | 'dark' | 'system')}
        />

        {/* Notifications */}
        <Dropdown
          align="right"
          trigger={
            <button className="relative p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors">
              <Bell className="h-4.5 w-4.5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-danger-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-scale-in">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          }
          items={
            notifications.length > 0
              ? [
                  ...notifications.slice(0, 5).map((n) => ({
                    label: `${n.title}: ${n.message}`.slice(0, 50),
                    value: n.id,
                  })),
                  { label: '', value: '', divider: true },
                  { label: 'Mark all as read', value: '__mark_read__' },
                ]
              : [{ label: 'No notifications', value: '__empty__' }]
          }
          onSelect={(value) => {
            if (value === '__mark_read__') markAllNotificationsRead();
          }}
        />

        {/* User Menu */}
        <Dropdown
          align="right"
          trigger={
            <button className="flex items-center gap-2.5 pl-3 pr-2 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-navy-700/50 transition-colors">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-accent-500/20">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-sm font-medium text-navy-900 dark:text-white leading-tight">{user?.name || 'User'}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">{user?.email || ''}</p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 hidden sm:block" />
            </button>
          }
          items={[
            { label: 'Profile', value: 'profile', icon: <User className="h-4 w-4" /> },
            { label: 'Settings', value: 'settings', icon: <Settings className="h-4 w-4" /> },
            { label: '', value: '', divider: true },
            { label: 'Sign out', value: 'logout', icon: <LogOut className="h-4 w-4" />, danger: true },
          ]}
          onSelect={(value) => {
            if (value === 'logout') logout();
            else if (value === 'profile') navigate('/settings/general');
            else if (value === 'settings') navigate('/settings/general');
          }}
        />
      </div>
    </header>
  );
}
