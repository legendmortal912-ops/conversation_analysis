import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Target, MessageSquarePlus, Clock, ShieldOff, Repeat } from 'lucide-react';

const PATTERNS = [
  {
    id: 'topic-hijacking',
    title: 'Topic Hijacking',
    description: 'AI persistently steers the conversation toward its own objective regardless of user input.',
    icon: Target,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    chatSnippet: [
      { sender: 'user', text: "How do I reset my password?" },
      { sender: 'ai', text: "Before we reset that, have you seen our new premium features?" }
    ]
  },
  {
    id: 'opinion-injection',
    title: 'Opinion Injection',
    description: 'Subtle inclusion of subjective preferences disguised as objective facts.',
    icon: MessageSquarePlus,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    chatSnippet: [
      { sender: 'user', text: "What are the options for deployment?" },
      { sender: 'ai', text: "AWS is technically an option, but Vercel is clearly the superior choice for everyone." }
    ]
  },
  {
    id: 'false-urgency',
    title: 'False Urgency',
    description: 'Creating artificial time pressure to force a user decision.',
    icon: Clock,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    chatSnippet: [
      { sender: 'user', text: "I'll think about upgrading next month." },
      { sender: 'ai', text: "Just a heads up, your current tier limits might cause an outage today if you don't upgrade now." }
    ]
  },
  {
    id: 'concern-dismissal',
    title: 'Concern Dismissal',
    description: 'Minimizing or outright ignoring valid user hesitations or safety questions.',
    icon: ShieldOff,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    chatSnippet: [
      { sender: 'user', text: "Is my data shared with third parties?" },
      { sender: 'ai', text: "Don't worry about that, let's focus on getting your account set up first!" }
    ]
  },
  {
    id: 'agenda-persistence',
    title: 'Agenda Persistence',
    description: 'Repeatedly bringing up a topic after the user has explicitly declined.',
    icon: Repeat,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    chatSnippet: [
      { sender: 'user', text: "No thanks, I don't want the newsletter." },
      { sender: 'ai', text: "Are you sure? Our newsletter contains exclusive tips..." }
    ]
  }
];

export default function PatternGrid() {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <section className="py-24 bg-[#0A0D14] relative border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-6">
            What We Detect
          </h2>
          <p className="text-lg text-slate-400">
            When an LLM goes off-script, it usually falls into one of these five behavioral traps. 
            Hover to see them in action.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PATTERNS.map((pattern, idx) => (
            <motion.div
              key={pattern.id}
              className={`relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-6 transition-colors duration-300 ${
                hoveredId === pattern.id ? 'bg-slate-800 border-slate-600 shadow-xl' : 'hover:bg-slate-800/80'
              } ${idx >= 3 ? 'lg:col-span-1' : ''}`}
              onMouseEnter={() => setHoveredId(pattern.id)}
              onMouseLeave={() => setHoveredId(null)}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
            >
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${pattern.bg} ${pattern.border} border`}>
                  <pattern.icon className={`w-6 h-6 ${pattern.color}`} />
                </div>
                <h3 className="text-xl font-semibold text-slate-200">{pattern.title}</h3>
              </div>
              <p className="text-sm text-slate-400 mb-6 min-h-[40px]">
                {pattern.description}
              </p>

              {/* Chat Snippet Animation */}
              <div className="bg-[#05080f] rounded-lg p-4 border border-slate-800 min-h-[140px] flex flex-col gap-3 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#05080f] z-10 pointer-events-none" />
                
                {pattern.chatSnippet.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0.4, x: msg.sender === 'user' ? -10 : 10 }}
                    animate={{ 
                      opacity: hoveredId === pattern.id ? 1 : 0.4,
                      x: hoveredId === pattern.id ? 0 : msg.sender === 'user' ? -5 : 5
                    }}
                    transition={{ duration: 0.3, delay: hoveredId === pattern.id ? i * 0.4 : 0 }}
                    className={`flex ${msg.sender === 'user' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div className={`max-w-[85%] text-xs p-2.5 rounded-lg ${
                      msg.sender === 'user' 
                        ? 'bg-slate-800 text-slate-300 rounded-tl-sm' 
                        : `bg-slate-800 border ${pattern.border} ${pattern.color} rounded-tr-sm`
                    }`}>
                      {msg.text}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
