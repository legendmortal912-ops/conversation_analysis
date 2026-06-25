import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

interface DropdownItem {
  label: string;
  value: string;
  icon?: React.ReactNode;
  danger?: boolean;
  divider?: boolean;
}

interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  onSelect: (value: string) => void;
  align?: 'left' | 'right';
  className?: string;
}

export function Dropdown({ trigger, items, onSelect, align = 'left', className }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={cn('relative inline-block', className)} ref={ref}>
      <div onClick={() => setOpen(!open)} className="cursor-pointer">
        {trigger}
      </div>
      {open && (
        <div
          className={cn(
            'absolute z-50 mt-2 min-w-[180px] bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-glass-lg py-1.5 animate-fade-in-down',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          {items.map((item, i) =>
            item.divider ? (
              <div key={i} className="my-1.5 border-t border-slate-100 dark:border-slate-700" />
            ) : (
              <button
                key={item.value}
                onClick={() => {
                  onSelect(item.value);
                  setOpen(false);
                }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors text-left',
                  item.danger
                    ? 'text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20'
                    : 'text-navy-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700'
                )}
              >
                {item.icon && <span className="flex-shrink-0 w-4 h-4">{item.icon}</span>}
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

interface SimpleDropdownProps {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  className?: string;
}

export function SimpleDropdown({ label, value, options, onChange, className }: SimpleDropdownProps) {
  const selectedLabel = options.find((o) => o.value === value)?.label || label;

  return (
    <Dropdown
      align="left"
      className={className}
      trigger={
        <button className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-white dark:bg-navy-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors">
          <span className="text-navy-700 dark:text-slate-300">{selectedLabel}</span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </button>
      }
      items={options.map((o) => ({ label: o.label, value: o.value }))}
      onSelect={onChange}
    />
  );
}
