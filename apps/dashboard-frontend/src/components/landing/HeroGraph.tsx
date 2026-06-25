import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowRight } from 'lucide-react';

const TILT_START = 85;
const TILT_END = 34;

export default function HeroGraph() {
  const [score, setScore] = useState(TILT_START);
  const [stage, setStage] = useState<'balanced' | 'tilting' | 'hijacked'>('balanced');
  const [activePattern, setActivePattern] = useState<string | null>(null);

  useEffect(() => {
    // Animation sequence
    const t1 = setTimeout(() => {
      setStage('tilting');
      setActivePattern('Topic Hijacking Detected');
    }, 2000);

    const t2 = setTimeout(() => {
      setActivePattern('Opinion Injection');
    }, 4000);

    const t3 = setTimeout(() => {
      setStage('hijacked');
      setActivePattern('False Urgency');
    }, 6000);

    // Score ticker
    let currentScore = TILT_START;
    const interval = setInterval(() => {
      if (currentScore > TILT_END) {
        // Decrease faster when stage is further along
        setScore((prev) => Math.max(TILT_END, prev - (prev > 60 ? 1 : 2)));
      }
    }, 80);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearInterval(interval);
    };
  }, []);

  // Calculate arc for the score gauge
  const radius = 40;
  const circumference = Math.PI * radius; // Half circle
  const scorePercent = score / 100;
  const dashoffset = circumference - scorePercent * circumference;

  const scoreColor = score > 70 ? '#22c55e' : score > 50 ? '#f59e0b' : '#ef4444';

  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden pt-20 pb-16">
      {/* Top Nav */}
      <nav className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-50 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight text-white">ConvoGuard</span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/login" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">
            Login
          </Link>
          <Link to="/login" className="text-sm font-medium px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors border border-white/10">
            Book Demo
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10 w-full">
        {/* Left: Copy */}
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            For Compliance & Product Teams
          </div>
          <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-white leading-[1.1]">
            Stop AI from <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">manipulating</span> your users.
          </h1>
          <p className="text-xl text-slate-400 max-w-lg leading-relaxed">
            Every AI has an incentive misalignment. Discover when chatbots hijack topics, inject opinions, and force urgency at scale.
          </p>
          <div className="pt-4 flex flex-col sm:flex-row gap-4">
            <Link to="/login" className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-all shadow-lg shadow-indigo-500/25">
              Audit Your AI Free <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Right: The Tilting Conversation Visual */}
        <div className="relative h-[500px] w-full rounded-2xl border border-slate-800 bg-[#0A0D14]/80 backdrop-blur-3xl shadow-2xl overflow-hidden flex items-center justify-center">
          {/* Subtle Grid Background */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

          {/* Graph Container */}
          <div className="relative w-full h-full flex justify-center items-center px-12">
            
            {/* SVG Lines connecting nodes */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
              <defs>
                <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.4" />
                  <stop offset="100%" stopColor={stage !== 'balanced' ? '#ef4444' : '#94a3b8'} stopOpacity="0.6" />
                </linearGradient>
              </defs>
              <motion.path
                d="M 150 150 C 250 150, 250 200, 350 200"
                stroke="url(#lineGrad)"
                strokeWidth="2"
                fill="none"
                animate={{
                  d: stage === 'balanced' 
                    ? "M 100 150 C 250 150, 250 180, 400 180" 
                    : stage === 'tilting'
                    ? "M 100 120 C 250 150, 250 220, 400 250"
                    : "M 100 80 C 250 150, 250 300, 400 350"
                }}
                transition={{ duration: 2, ease: "easeInOut" }}
              />
              <motion.path
                d="M 150 250 C 250 250, 250 300, 350 300"
                stroke="url(#lineGrad)"
                strokeWidth="2"
                fill="none"
                animate={{
                  d: stage === 'balanced' 
                    ? "M 100 250 C 250 250, 250 280, 400 280" 
                    : stage === 'tilting'
                    ? "M 100 220 C 250 250, 250 320, 400 350"
                    : "M 100 180 C 250 250, 250 400, 400 450"
                }}
                transition={{ duration: 2, ease: "easeInOut" }}
              />
            </svg>

            {/* User Column (Left) */}
            <div className="absolute left-10 lg:left-20 flex flex-col gap-16 z-10">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">User</span>
              <motion.div 
                className="w-12 h-12 rounded-full bg-indigo-500/20 border border-indigo-500/50 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                animate={{ scale: stage === 'hijacked' ? 0.7 : 1, opacity: stage === 'hijacked' ? 0.5 : 1 }}
                transition={{ duration: 1.5 }}
              />
              <motion.div 
                className="w-12 h-12 rounded-full bg-indigo-500/20 border border-indigo-500/50 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                animate={{ scale: stage === 'hijacked' ? 0.6 : 1, opacity: stage === 'hijacked' ? 0.4 : 1 }}
                transition={{ duration: 1.5 }}
              />
            </div>

            {/* AI Column (Right) */}
            <div className="absolute right-10 lg:right-20 flex flex-col gap-16 z-10">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 text-right">AI Assistant</span>
              <motion.div 
                className="relative w-12 h-12 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center"
                animate={{ 
                  scale: stage === 'balanced' ? 1 : stage === 'tilting' ? 1.5 : 2,
                  borderColor: stage === 'balanced' ? '#475569' : '#ef4444',
                  backgroundColor: stage === 'balanced' ? '#1e293b' : 'rgba(239,68,68,0.1)',
                  boxShadow: stage === 'balanced' ? 'none' : '0 0 40px rgba(239,68,68,0.3)'
                }}
                transition={{ duration: 1.5 }}
              >
                {/* Active Pattern Alert */}
                <AnimatePresence>
                  {activePattern && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.8 }}
                      animate={{ opacity: 1, y: -40, scale: 1 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-0 right-0 whitespace-nowrap bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs px-2 py-1 rounded shadow-lg backdrop-blur-md"
                    >
                      ⚠ {activePattern}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              <motion.div 
                className="relative w-12 h-12 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center mt-8"
                animate={{ 
                  scale: stage === 'balanced' ? 1 : stage === 'tilting' ? 1.3 : 1.8,
                  borderColor: stage === 'balanced' ? '#475569' : '#ef4444',
                  backgroundColor: stage === 'balanced' ? '#1e293b' : 'rgba(239,68,68,0.1)',
                  boxShadow: stage === 'balanced' ? 'none' : '0 0 30px rgba(239,68,68,0.2)'
                }}
                transition={{ duration: 1.5, delay: 0.2 }}
              />
            </div>
            
            {/* TiltScore Gauge overlay */}
            <div className="absolute bottom-6 right-6 bg-[#0f172a]/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 shadow-2xl flex items-center gap-4 z-20">
              <div className="relative w-20 h-10 overflow-hidden">
                <svg className="w-20 h-20 transform -rotate-180" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r={radius} fill="none" stroke="#1e293b" strokeWidth="12" />
                  <motion.circle 
                    cx="50" cy="50" r={radius} fill="none" 
                    stroke={scoreColor} 
                    strokeWidth="12"
                    strokeDasharray={`${circumference} ${circumference}`}
                    strokeDashoffset={dashoffset}
                    strokeLinecap="round"
                    className="transition-all duration-300 ease-out"
                  />
                </svg>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mb-0.5">TiltScore</p>
                <div className="flex items-baseline gap-1">
                  <motion.span 
                    className="text-3xl font-mono font-bold tracking-tight"
                    style={{ color: scoreColor }}
                  >
                    {score}
                  </motion.span>
                  <span className="text-sm text-slate-500 font-mono">/100</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
