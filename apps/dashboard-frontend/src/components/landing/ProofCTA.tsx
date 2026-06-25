import React from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowRight, Quote } from 'lucide-react';

export default function ProofCTA() {
  return (
    <section className="py-24 bg-[#0A0D14] relative border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-6 relative z-10 flex flex-col items-center">
        
        {/* Testimonial */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto text-center mb-24"
        >
          <Quote className="w-12 h-12 text-indigo-500/20 mx-auto mb-6" />
          <p className="text-2xl md:text-3xl font-medium text-slate-200 leading-relaxed mb-8">
            "Before ConvoGuard, we only knew if our AI was hallucinating facts. Now we know when it's manipulating our customers. The difference in liability is staggering."
          </p>
          <div className="flex items-center justify-center gap-4">
            <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700" />
            <div className="text-left">
              <div className="font-semibold text-white">Sarah Jenkins</div>
              <div className="text-sm text-slate-400">Chief Compliance Officer, FinTech AI</div>
            </div>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full max-w-4xl relative"
        >
          {/* Glow effect behind CTA */}
          <div className="absolute inset-0 bg-indigo-500/20 blur-[100px] rounded-full pointer-events-none" />
          
          <div className="relative rounded-3xl border border-slate-800 bg-slate-900/50 backdrop-blur-xl p-12 md:p-16 text-center overflow-hidden">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-6">
              Ready to see the unseen?
            </h2>
            <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
              Drop in a link to any AI conversation and we'll analyze it for manipulation patterns in seconds. No credit card required.
            </p>
            <Link 
              to="/login" 
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-all shadow-lg shadow-indigo-500/25 text-lg"
            >
              Audit Your AI Free <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </motion.div>

        {/* Logo Strip / Footer */}
        <div className="mt-24 pt-12 border-t border-slate-800/50 w-full flex flex-col items-center">
          <p className="text-sm text-slate-500 font-semibold uppercase tracking-widest mb-8">
            Works with any major LLM architecture
          </p>
          <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
            {/* Minimal SVG placeholders for logos */}
            <div className="text-xl font-bold tracking-tighter text-slate-200">OpenAI</div>
            <div className="text-xl font-bold tracking-tight text-slate-200">Anthropic</div>
            <div className="text-xl font-bold tracking-wide text-slate-200">Mistral</div>
            <div className="text-xl font-bold tracking-tight text-slate-200">Meta Llama</div>
            <div className="text-xl font-bold text-slate-200">Google Gemini</div>
          </div>
        </div>
        
      </div>
    </section>
  );
}
