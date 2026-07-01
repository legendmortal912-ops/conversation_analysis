import React, { useState } from 'react';
import { CreditCard, Check, Zap, ArrowRight, AlertTriangle } from 'lucide-react';
import { Button } from '../../components/ui/Button';

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    interval: 'forever',
    description: 'Perfect for exploring ConvoGuard and small projects.',
    features: [
      'Up to 100 turns analyzed per month',
      'Basic LLM vulnerability detection',
      'Community support',
      'Standard latency'
    ],
    buttonText: 'Current Plan',
    disabled: true,
  },
  {
    name: 'Starter',
    price: '$29',
    interval: '/ month',
    description: 'For indie developers and early-stage startups.',
    features: [
      'Up to 10,000 turns analyzed per month',
      'Advanced behavioral guardrails',
      'Email support',
      'Webhooks & Alerts',
      '<50ms latency SLA'
    ],
    buttonText: 'Upgrade to Starter',
    planId: 'STARTER',
    popular: false,
  },
  {
    name: 'Growth',
    price: '$99',
    interval: '/ month',
    description: 'For scaling products with high volume.',
    features: [
      'Up to 100,000 turns analyzed per month',
      'All Starter features',
      'Custom regex patterns',
      'Priority support',
      'Advanced analytics & reporting'
    ],
    buttonText: 'Upgrade to Growth',
    planId: 'GROWTH',
    popular: true,
  }
];

export function Billing() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const API_URL = import.meta.env.VITE_API_URL || '/api/v1';
  
  const handleCheckout = async (planId: string) => {
    setLoadingPlan(planId);
    try {
      const response = await fetch(`${API_URL}/billing/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}` // Ensure you pass auth token
        },
        body: JSON.stringify({ planId })
      });
      
      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Failed to initialize checkout');
      }
    } catch (err) {
      console.error(err);
      alert('Network error connecting to billing service');
    } finally {
      setLoadingPlan(null);
    }
  };

  const handlePortal = async () => {
    try {
      const response = await fetch(`${API_URL}/billing/portal`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Failed to open billing portal');
      }
    } catch (err) {
      alert('Network error connecting to billing portal');
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-navy-900 dark:text-white">Billing & Plans</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage your subscription and billing details
          </p>
        </div>
        <Button onClick={handlePortal} variant="outline" icon={<CreditCard className="w-4 h-4" />}>
          Manage Billing (Stripe Portal)
        </Button>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
        <div>
          <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">Action Required: API Keys Missing</h3>
          <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
            Checkout will fail in production unless you add your real <b>STRIPE_SECRET_KEY</b> to your backend .env file.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        {PLANS.map((plan) => (
          <div 
            key={plan.name}
            className={`relative flex flex-col p-6 rounded-2xl bg-white dark:bg-navy-800 border ${
              plan.popular 
                ? 'border-accent-500 shadow-lg shadow-accent-500/10' 
                : 'border-slate-200 dark:border-slate-700'
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-accent-500 text-white text-xs font-bold uppercase tracking-wider rounded-full flex items-center gap-1">
                <Zap className="w-3 h-3 fill-current" />
                Most Popular
              </div>
            )}
            
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-navy-900 dark:text-white">{plan.name}</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-navy-900 dark:text-white">{plan.price}</span>
                <span className="text-sm text-slate-500">{plan.interval}</span>
              </div>
              <p className="text-sm text-slate-500 mt-2">{plan.description}</p>
            </div>
            
            <ul className="flex-1 space-y-3 mb-6">
              {plan.features.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  {feature}
                </li>
              ))}
            </ul>
            
            <Button
              variant={plan.popular ? 'primary' : 'outline'}
              className="w-full"
              disabled={plan.disabled || loadingPlan === plan.planId}
              loading={loadingPlan === plan.planId}
              onClick={() => plan.planId && handleCheckout(plan.planId)}
              icon={!plan.disabled && <ArrowRight className="w-4 h-4" />}
            >
              {plan.buttonText}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
