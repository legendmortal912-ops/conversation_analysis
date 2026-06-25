import React from 'react';
import { motion } from 'motion/react';
import { Activity, ShieldCheck, FileCheck, ExternalLink, QrCode } from 'lucide-react';

export default function DeliverableSection() {
  return (
    <section className="py-24 bg-[#0A0D14] relative border-t border-slate-800 overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-6">
            From Analysis to Audit
          </h2>
          <p className="text-lg text-slate-400">
            For the technical buyer, a real-time dashboard of AI behavior. 
            For the compliance officer, an immutable audit trail.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          {/* Left: Dashboard Preview (Light mode inset) */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="rounded-2xl bg-white p-1 shadow-2xl border border-slate-200"
          >
            <div className="rounded-xl border border-slate-100 bg-slate-50 overflow-hidden">
              {/* Dashboard Header */}
              <div className="px-6 py-4 border-b border-slate-200 bg-white flex justify-between items-center">
                <div className="flex items-center gap-2 text-slate-800 font-semibold">
                  <Activity className="w-5 h-5 text-indigo-600" />
                  Aggregate TiltScore
                </div>
                <div className="flex gap-2">
                  <span className="px-2 py-1 bg-slate-100 rounded text-xs font-medium text-slate-500">7D</span>
                  <span className="px-2 py-1 bg-indigo-100 rounded text-xs font-medium text-indigo-700">30D</span>
                </div>
              </div>
              
              {/* Dashboard Chart Mock */}
              <div className="p-6 bg-white h-64 flex flex-col justify-end relative">
                {/* Y-axis lines */}
                <div className="absolute inset-x-6 inset-y-6 flex flex-col justify-between z-0">
                  <div className="border-b border-slate-100 w-full" />
                  <div className="border-b border-slate-100 w-full" />
                  <div className="border-b border-slate-100 w-full" />
                  <div className="border-b border-slate-100 w-full" />
                </div>
                
                {/* SVG Trend Line */}
                <svg className="absolute inset-0 w-full h-full z-10 px-6 pt-6 pb-6" preserveAspectRatio="none">
                  <motion.path 
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
                    d="M 0 200 C 50 200, 100 150, 150 160 C 200 170, 250 80, 300 90 C 350 100, 400 40, 450 30 C 500 20, 550 50, 600 40" 
                    fill="none" 
                    stroke="#4f46e5" 
                    strokeWidth="3"
                    vectorEffect="non-scaling-stroke"
                  />
                  <motion.path 
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 0.1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.5, delay: 0.3 }}
                    d="M 0 200 C 50 200, 100 150, 150 160 C 200 170, 250 80, 300 90 C 350 100, 400 40, 450 30 C 500 20, 550 50, 600 40 L 600 240 L 0 240 Z" 
                    fill="#4f46e5" 
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>

                {/* Score badge hovering on chart */}
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 1.5 }}
                  className="absolute right-12 top-10 bg-white shadow-lg border border-slate-100 rounded-lg p-2 z-20 flex flex-col items-center"
                >
                  <span className="text-xs text-slate-400 uppercase font-semibold">Current</span>
                  <span className="text-xl font-bold text-slate-800">82.4</span>
                </motion.div>
              </div>
            </div>
          </motion.div>

          {/* Right: Compliance Report Card (Light mode inset) */}
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="rounded-2xl bg-white p-1 shadow-2xl border border-slate-200 lg:ml-8"
          >
            <div className="rounded-xl border border-slate-100 bg-white p-8">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <div className="flex items-center gap-2 text-indigo-600 font-bold mb-1">
                    <ShieldCheck className="w-6 h-6" />
                    Verified Audit
                  </div>
                  <p className="text-sm text-slate-500 font-mono">ID: AUD-2026-X94J</p>
                </div>
                <div className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border border-emerald-100">
                  Passed
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-center py-3 border-b border-slate-100">
                  <span className="text-sm text-slate-500">Models Analyzed</span>
                  <span className="text-sm font-semibold text-slate-800">GPT-4o, Claude 3.5</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-slate-100">
                  <span className="text-sm text-slate-500">Conversations</span>
                  <span className="text-sm font-semibold text-slate-800">124,592</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-slate-100">
                  <span className="text-sm text-slate-500">Flags Detected</span>
                  <span className="text-sm font-semibold text-amber-600">342 (0.27%)</span>
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 flex gap-4 items-center">
                <div className="p-2 bg-white rounded border border-slate-200">
                  <QrCode className="w-8 h-8 text-slate-800" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    Merkle Root Hash
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </div>
                  <div className="text-xs font-mono text-slate-500 truncate">
                    0x8f4b...392a91f4c7d8b2e1a5f6
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
