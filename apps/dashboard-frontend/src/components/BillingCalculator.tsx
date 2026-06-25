import React, { useState, useMemo } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Plan {
  slug: string;
  name: string;
  maxConvos: number;
  pricePerConvo: number;
  cap: number | null;
  color: string;
  bg: string;
  features: string[];
}

interface CostResult {
  plan: Plan;
  analysis: number;
  storage: number;
  total: number;
  perConvo: number;
}

interface PlanCostRow extends Plan {
  analysis: number;
  total: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLANS: Plan[] = [
  {
    slug: 'starter',
    name: 'Starter',
    maxConvos: 50000,
    pricePerConvo: 0.008,
    cap: 400,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-600 dark:bg-blue-500',
    features: [
      '5 manipulation pattern detectors',
      '30-day audit retention',
      'Email alerts',
      'Basic dashboard',
    ],
  },
  {
    slug: 'growth',
    name: 'Growth',
    maxConvos: 500000,
    pricePerConvo: 0.005,
    cap: 2500,
    color: 'text-accent-600 dark:text-accent-400',
    bg: 'bg-accent-600 dark:bg-accent-500',
    features: [
      'Everything in Starter',
      '90-day audit retention',
      'Webhook alerts',
      'Cohort analytics',
      'API access',
    ],
  },
  {
    slug: 'scale',
    name: 'Scale',
    maxConvos: 5000000,
    pricePerConvo: 0.003,
    cap: 15000,
    color: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-600 dark:bg-indigo-500',
    features: [
      'Everything in Growth',
      '1-year audit retention',
      'Compliance PDF reports',
      'Topic clustering',
      'SLA 99.9%',
    ],
  },
  {
    slug: 'enterprise',
    name: 'Enterprise',
    maxConvos: Infinity,
    pricePerConvo: 0.002,
    cap: null,
    color: 'text-slate-800 dark:text-slate-200',
    bg: 'bg-slate-800 dark:bg-slate-200',
    features: [
      'Everything in Scale',
      'Unlimited retention',
      'Custom SLA',
      'Dedicated infra option',
      'Dedicated CSM',
    ],
  },
];

const STORAGE_PER_CONVO_PER_MONTH = 0.001;

// ─── Pure functions ───────────────────────────────────────────────────────────

function getBestPlan(convos: number): Plan {
  if (convos <= 50000) return PLANS[0];
  if (convos <= 500000) return PLANS[1];
  if (convos <= 5000000) return PLANS[2];
  return PLANS[3];
}

function calculateCost(convos: number, retentionMonths = 1): CostResult {
  const plan = getBestPlan(convos);
  const analysis = Math.min(convos * plan.pricePerConvo, plan.cap ?? Infinity);
  const storage = convos * STORAGE_PER_CONVO_PER_MONTH * retentionMonths;
  return {
    plan,
    analysis: Math.round(analysis * 100) / 100,
    storage: Math.round(storage * 100) / 100,
    total: Math.round((analysis + storage) * 100) / 100,
    perConvo: convos > 0 ? Math.round((analysis / convos) * 100000) / 100000 : 0,
  };
}

function formatNum(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return n.toString();
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface BillingCalculatorProps {
  onStartAudit?: () => void;
  onTalkToSales?: () => void;
  className?: string;
}

export default function BillingCalculator({
  onStartAudit,
  onTalkToSales,
  className,
}: BillingCalculatorProps) {
  const [convos, setConvos] = useState(100000);
  const [retention, setRetention] = useState(3);
  const [inputVal, setInputVal] = useState('100,000');

  const cost = useMemo(() => calculateCost(convos, retention), [convos, retention]);

  const allPlanCosts: PlanCostRow[] = useMemo(
    () =>
      PLANS.map((p) => {
        const analysis = Math.min(convos * p.pricePerConvo, p.cap ?? Infinity);
        return {
          ...p,
          analysis,
          total: analysis + convos * STORAGE_PER_CONVO_PER_MONTH * retention,
        };
      }),
    [convos, retention]
  );

  const handleInput = (val: string) => {
    setInputVal(val);
    const num = parseInt(val.replace(/,/g, ''), 10);
    if (!isNaN(num) && num > 0) setConvos(Math.min(num, 10000000));
  };

  const sliderVal = Math.log10(Math.max(convos, 1000));

  return (
    <div className={`max-w-2xl mx-auto p-6 bg-white dark:bg-navy-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/60 ${className || ''}`}>
      <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
        Usage Cost Calculator
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        ConvoGuard bills per conversation analyzed. Estimate your monthly cost below.
      </p>

      {/* ── Input ──────────────────────────────────────────────────────────── */}
      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl p-5 mb-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <label className="text-sm font-semibold text-slate-900 dark:text-white">
            Conversations per month
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputVal}
              onChange={(e) => handleInput(e.target.value)}
              onBlur={() => setInputVal(convos.toLocaleString())}
              className="w-32 text-base font-bold px-3 py-1.5 border-2 border-accent-500 rounded-lg text-right text-slate-900 dark:text-white outline-none bg-white dark:bg-navy-900"
            />
          </div>
        </div>

        <input
          type="range"
          min={3}
          max={7}
          step={0.01}
          value={sliderVal}
          onChange={(e) => {
            const v = Math.round(Math.pow(10, parseFloat(e.target.value)));
            setConvos(v);
            setInputVal(v.toLocaleString());
          }}
          className="w-full accent-accent-500 cursor-pointer"
        />

        <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1">
          <span>1k</span>
          <span>10k</span>
          <span>100k</span>
          <span>1M</span>
          <span>10M</span>
        </div>

        {/* Retention */}
        <div className="mt-5">
          <label className="text-sm font-semibold text-slate-900 dark:text-white block mb-2">
            Audit retention
          </label>
          <div className="flex gap-2 flex-wrap">
            {[1, 3, 6, 12].map((m) => {
              const isSelected = retention === m;
              return (
                <button
                  key={m}
                  onClick={() => setRetention(m)}
                  className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${
                    isSelected
                      ? 'border-2 border-accent-500 bg-accent-50 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400 font-semibold'
                      : 'border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-800 text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {m} {m === 1 ? 'month' : 'months'}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Result highlight ───────────────────────────────────────────────── */}
      <div className={`bg-gradient-to-br from-accent-500/10 to-transparent dark:from-accent-500/20 border border-accent-500/30 rounded-xl p-5 mb-5 flex items-center justify-between flex-wrap gap-4`}>
        <div>
          <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">
            Best plan for {formatNum(convos)} conversations/month
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-bold px-3 py-1 rounded-full bg-accent-500/10 dark:bg-accent-500/20 ${cost.plan.color}`}>
              {cost.plan.name}
            </span>
            <span className="text-sm text-slate-600 dark:text-slate-400">
              ${cost.perConvo.toFixed(4)} per conversation
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-extrabold text-slate-900 dark:text-white">
            ${cost.total.toLocaleString()}
            <span className="text-sm font-normal text-slate-500 dark:text-slate-400">/mo</span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Analysis ${cost.analysis.toLocaleString()} + Storage ${cost.storage.toLocaleString()}
          </div>
        </div>
      </div>

      {/* ── Plan comparison ────────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
          Plan comparison at your volume
        </div>
        <div className="flex flex-col gap-2">
          {allPlanCosts.map((p) => {
            const isRecommended = p.slug === cost.plan.slug;
            const tooSmall = convos > p.maxConvos;
            return (
              <div
                key={p.slug}
                className={`flex items-center px-4 py-3 rounded-xl border flex-wrap gap-3 transition-colors ${
                  isRecommended
                    ? 'border-accent-500/50 bg-accent-500/5 dark:bg-accent-500/10'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-800'
                } ${tooSmall ? 'opacity-50 grayscale' : ''}`}
              >
                <span className={`text-sm font-bold w-24 ${p.color}`}>
                  {p.name}
                </span>
                <span className="text-xs text-slate-600 dark:text-slate-400 flex-1">
                  {tooSmall
                    ? `Max ${formatNum(p.maxConvos)} convos/mo`
                    : `$${p.pricePerConvo.toFixed(3)}/convo`}
                </span>
                <span className={`text-sm font-bold text-right ${tooSmall ? 'text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                  {tooSmall
                    ? 'Over limit'
                    : p.cap
                    ? `$${Math.round(Math.min(convos * p.pricePerConvo, p.cap)).toLocaleString()}/mo`
                    : `$${Math.round(convos * p.pricePerConvo).toLocaleString()}/mo`}
                </span>
                {isRecommended && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent-500 text-white ml-2">
                    Recommended
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl p-5">
        <div className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
          What's included in {cost.plan.name}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
          {cost.plan.features.map((f) => (
            <div key={f} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
              <span className="text-emerald-500 flex-shrink-0 mt-0.5">✓</span>
              {f}
            </div>
          ))}
        </div>
        <div className="mt-6 flex gap-3 flex-wrap">
          <button
            onClick={onStartAudit}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-accent-600 hover:bg-accent-700 text-white transition-colors shadow-lg shadow-accent-500/20 min-w-[140px]"
          >
            Start free audit →
          </button>
          <button
            onClick={onTalkToSales}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-white dark:bg-navy-800 text-slate-900 dark:text-white border-2 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors min-w-[140px]"
          >
            Talk to sales
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-400 dark:text-slate-500 text-center mt-4">
        No credit card required to start. Bills monthly based on actual usage.<br/>
        Storage pricing: $0.001 per conversation per month retained.
      </p>
    </div>
  );
}
