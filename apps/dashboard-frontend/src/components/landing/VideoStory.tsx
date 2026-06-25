import React, { useRef, useEffect, useState, useCallback } from 'react';

/* ─── Types ──────────────────────────────────────────────────────────── */
interface Section {
  id: string;
  type: 'intro' | 'story' | 'outro';
  video?: string;
  side?: 'right' | 'left';
  tag?: string;
  tagNum?: string;
  headline: string;
  headlineAccent?: string;
  subline: string;
  accent: string;
  glow: string;
  bg: string;
}

const SECTIONS: Section[] = [
  {
    id: 'intro',
    type: 'intro',
    headline: 'ConvoGuard',
    headlineAccent: 'AI Safety, Engineered.',
    subline: 'Every AI conversation leaves a fingerprint. We read it.',
    accent: '#6366f1',
    glow: 'rgba(99,102,241,0.3)',
    bg: 'radial-gradient(ellipse 80% 80% at 50% 40%, rgba(99,102,241,0.12) 0%, transparent 70%), #0A0D14',
  },
  {
    id: 'problem',
    type: 'story',
    video: '/videos/video1.mp4',
    side: 'right',
    tag: 'The Problem',
    tagNum: '01',
    headline: 'AI is tilting your',
    headlineAccent: 'conversations.',
    subline: 'Subtle topic hijacks. Injected opinions. Manufactured urgency. Modern AI manipulates at scale — and most companies have no idea it\'s happening.',
    accent: '#6366f1',
    glow: 'rgba(99,102,241,0.22)',
    bg: '#0A0D14',
  },
  {
    id: 'detect',
    type: 'story',
    video: '/videos/video2.mp4',
    side: 'left',
    tag: 'How We Detect It',
    tagNum: '02',
    headline: '5 patterns.',
    headlineAccent: 'Caught in real time.',
    subline: 'ConvoGuard scores every turn — flagging Topic Hijacking, Opinion Injection, False Urgency, Concern Dismissal, and Agenda Persistence before they compound.',
    accent: '#a855f7',
    glow: 'rgba(168,85,247,0.22)',
    bg: '#0A0D14',
  },
  {
    id: 'dashboard',
    type: 'story',
    video: '/videos/video3.mp4',
    side: 'right',
    tag: 'The Deliverable',
    tagNum: '03',
    headline: 'A dashboard.',
    headlineAccent: 'An audit trail. A shield.',
    subline: 'Every conversation is hash-chained and timestamped. Your compliance team gets tamper-proof records. Your legal team gets evidence. Your leadership gets a live TiltScore.',
    accent: '#22d3ee',
    glow: 'rgba(34,211,238,0.18)',
    bg: '#0A0D14',
  },
  {
    id: 'closing',
    type: 'story',
    video: '/videos/video4.mp4',
    side: 'left',
    tag: 'Proven Results',
    tagNum: '04',
    headline: 'Trust, built on',
    headlineAccent: 'evidence.',
    subline: 'From solo developers to enterprise compliance teams, ConvoGuard surfaces manipulation in minutes — with zero infrastructure changes.',
    accent: '#34d399',
    glow: 'rgba(52,211,153,0.18)',
    bg: '#0A0D14',
  },
  {
    id: 'outro',
    type: 'outro',
    headline: 'Audit your AI.',
    headlineAccent: 'For free.',
    subline: 'Connect to any LLM in minutes. No infrastructure changes. See your first TiltScore in 60 seconds.',
    accent: '#6366f1',
    glow: 'rgba(99,102,241,0.35)',
    bg: 'radial-gradient(ellipse 80% 80% at 50% 60%, rgba(99,102,241,0.14) 0%, transparent 70%), #0A0D14',
  },
];

/* ─── Hooks ─────────────────────────────────────────────────────────── */
function useInView(threshold = 0.35) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        setInView(e.isIntersecting);
        if (e.isIntersecting) setEntered(true);
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView, entered };
}

function useTilt() {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0, scale: 1 });
  const frame = useRef<number>(0);

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      setTilt({ x: dy * -12, y: dx * 12, scale: 1.04 });
    });
  }, []);

  const onLeave = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      setTilt({ x: 0, y: 0, scale: 1 });
    });
  }, []);

  return { ref, tilt, onMove, onLeave };
}

/* ─── Navbar ─────────────────────────────────────────────────────────── */
function Navbar({ active }: { active: number }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  return (
    <div
      className="fixed top-5 left-1/2 z-50 -translate-x-1/2"
      style={{
        width: scrolled ? 'min(620px, calc(100vw - 2rem))' : 'min(820px, calc(100vw - 2rem))',
        transition: 'width 0.6s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      <nav
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-2xl"
        style={{
          background: 'rgba(10, 13, 20, 0.55)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.06) inset, 0 0 0 1px rgba(99,102,241,0.1)',
        }}
      >
        {/* Logo + Brand */}
        <a href="/" className="flex items-center gap-2.5 group">
          <img
            src="/logo.png"
            alt="ConvoGuard"
            className="w-8 h-8 rounded-xl object-cover transition-all duration-300 group-hover:scale-110 group-hover:rotate-3"
            style={{ boxShadow: '0 0 12px rgba(99,102,241,0.5)' }}
          />
          <span className="font-bold text-white text-sm tracking-tight">
            Convo<span style={{ color: '#818cf8' }}>Guard</span>
          </span>
        </a>

        {/* Center nav links */}
        <div className="hidden md:flex items-center gap-0.5">
          {['Problem', 'Detection', 'Dashboard', 'Results'].map((label, i) => (
            <button
              key={label}
              onClick={() => document.getElementById(`section-${i + 1}`)?.scrollIntoView({ behavior: 'smooth' })}
              className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/[0.07] transition-all duration-200"
            >
              {label}
            </button>
          ))}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <a
            href="/login"
            className="hidden sm:inline-flex px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/[0.07] transition-all duration-200"
          >
            Sign In
          </a>
          <a
            href="/register"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all duration-300 hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              boxShadow: '0 0 0 1px rgba(99,102,241,0.4), 0 4px 16px rgba(99,102,241,0.3)',
            }}
          >
            Get Started <span>&#8594;</span>
          </a>
        </div>
      </nav>
    </div>
  );
}

/* ─── Progress Sidebar ───────────────────────────────────────────────── */
function ProgressBar({ count, active }: { count: number; active: number }) {
  return (
    <div className="fixed right-7 top-1/2 -translate-y-1/2 z-40 hidden xl:flex flex-col gap-4 items-center">
      <div className="flex flex-col gap-3">
        {Array.from({ length: count }).map((_, i) => (
          <button
            key={i}
            onClick={() => document.getElementById(`section-${i}`)?.scrollIntoView({ behavior: 'smooth' })}
            className="relative flex items-center justify-center w-3 h-3 rounded-full transition-all duration-500"
            style={{
              background: i === active ? SECTIONS[i].accent : 'rgba(255,255,255,0.12)',
              transform: i === active ? 'scale(1.5)' : 'scale(1)',
              boxShadow: i === active ? `0 0 10px ${SECTIONS[i].glow}` : 'none',
            }}
            aria-label={`Section ${i + 1}`}
          />
        ))}
      </div>
      <div
        className="text-[10px] font-mono text-slate-600 mt-2 tracking-wider"
        style={{ writingMode: 'vertical-rl' }}
      >
        {String(active + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
      </div>
    </div>
  );
}

/* ─── Floating Orbs Background ──────────────────────────────────────── */
function FloatingOrbs({ accent, glow }: { accent: string; glow: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {[
        { size: 300, top: '10%', left: '5%', dur: '18s', delay: '0s' },
        { size: 200, top: '60%', right: '8%', dur: '22s', delay: '-6s' },
        { size: 150, top: '30%', left: '50%', dur: '15s', delay: '-3s' },
      ].map((orb, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: orb.size,
            height: orb.size,
            top: orb.top,
            left: (orb as any).left,
            right: (orb as any).right,
            background: `radial-gradient(circle, ${glow} 0%, transparent 70%)`,
            animation: `orbFloat ${orb.dur} ease-in-out infinite`,
            animationDelay: orb.delay,
            filter: 'blur(1px)',
          }}
        />
      ))}
    </div>
  );
}

/* ─── Grid Overlay ───────────────────────────────────────────────────── */
function GridOverlay() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)',
        backgroundSize: '56px 56px',
        maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)',
      }}
    />
  );
}

/* ─── Video Panel with Tilt ─────────────────────────────────────────── */
function VideoPanel({ src, side, accent, glow, inView }: {
  src: string; side: 'right' | 'left'; accent: string; glow: string; inView: boolean;
}) {
  const { ref: tiltRef, tilt, onMove, onLeave } = useTilt();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (inView) v.play().catch(() => {});
  }, [inView]);

  // Hover tilt: right-side videos tilt LEFT on hover, left-side tilt RIGHT
  const hoverTiltDir = side === 'right' ? -1 : 1;

  return (
    <div
      ref={tiltRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="w-full h-full flex items-center justify-center p-6 lg:p-10 cursor-none"
      style={{
        transform: inView
          ? `translateX(${side === 'right' ? '0' : '0'})` : `translateX(${side === 'right' ? '80px' : '-80px'})`,
        opacity: inView ? 1 : 0,
        transition: 'transform 1s cubic-bezier(0.16,1,0.3,1), opacity 0.9s ease',
      }}
    >
      <div
        className="relative w-full max-w-2xl rounded-3xl overflow-hidden"
        style={{
          transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y * hoverTiltDir}deg) scale(${tilt.scale})`,
          transition: tilt.scale === 1
            ? 'transform 0.7s cubic-bezier(0.16,1,0.3,1)'
            : 'transform 0.15s ease-out',
          boxShadow: tilt.scale > 1
            ? `0 30px 80px rgba(0,0,0,0.6), 0 0 60px ${glow}, 0 0 120px ${glow}`
            : `0 20px 60px rgba(0,0,0,0.5), 0 0 40px ${glow}`,
          willChange: 'transform',
        }}
      >
        {/* Shimmer border */}
        <div
          className="absolute inset-0 rounded-3xl z-10 pointer-events-none"
          style={{
            border: `1.5px solid ${accent}`,
            opacity: 0.3,
            boxShadow: `inset 0 0 40px ${glow}`,
          }}
        />
        {/* Reflection glare */}
        <div
          className="absolute inset-0 rounded-3xl z-10 pointer-events-none"
          style={{
            background: `linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 50%)`,
          }}
        />
        <video
          ref={videoRef}
          src={src}
          autoPlay
          loop
          muted
          playsInline
          className="w-full block"
          style={{ aspectRatio: '16/9', objectFit: 'cover', display: 'block' }}
        />
      </div>
    </div>
  );
}

/* ─── Text Panel ─────────────────────────────────────────────────────── */
function TextPanel({ section, entered, delay = 0 }: { section: Section; entered: boolean; delay?: number }) {
  return (
    <div
      className="w-full h-full flex flex-col justify-center px-8 lg:px-16 xl:px-20 py-16 lg:py-0"
      style={{
        transform: entered ? 'translateY(0)' : 'translateY(30px)',
        opacity: entered ? 1 : 0,
        transition: `transform 1s ${delay}s cubic-bezier(0.16,1,0.3,1), opacity 0.9s ${delay}s ease`,
      }}
    >
      {/* Tag pill */}
      {section.tag && (
        <div
          className="inline-flex items-center gap-2 mb-6 w-fit"
          style={{
            animation: entered ? 'none' : undefined,
          }}
        >
          <span
            className="text-[11px] font-bold tracking-[0.22em] uppercase px-3.5 py-1.5 rounded-full"
            style={{
              color: section.accent,
              background: `${section.accent}12`,
              border: `1px solid ${section.accent}30`,
              letterSpacing: '0.2em',
            }}
          >
            {section.tagNum} — {section.tag}
          </span>
        </div>
      )}

      {/* Headline */}
      <h2 className="font-bold leading-[1.08] text-white mb-2" style={{ fontSize: 'clamp(2rem, 4vw, 3.4rem)' }}>
        {section.headline}
      </h2>
      {section.headlineAccent && (
        <h2
          className="font-bold leading-[1.08] mb-6"
          style={{
            fontSize: 'clamp(2rem, 4vw, 3.4rem)',
            background: `linear-gradient(135deg, ${section.accent}, ${section.accent}aa)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          {section.headlineAccent}
        </h2>
      )}

      {/* Body */}
      <p className="text-slate-400 leading-relaxed max-w-md" style={{ fontSize: 'clamp(0.95rem, 1.5vw, 1.1rem)' }}>
        {section.subline}
      </p>

      {/* Accent rule */}
      <div
        className="mt-8 rounded-full"
        style={{
          height: '2px',
          width: entered ? '80px' : '0px',
          background: `linear-gradient(to right, ${section.accent}, transparent)`,
          transition: 'width 1s 0.6s ease',
        }}
      />
    </div>
  );
}

/* ─── Intro Section ─────────────────────────────────────────────────── */
function IntroSection({ section, index }: { section: Section; index: number }) {
  const { ref, entered } = useInView(0.2);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(p => p + 1), 60);
    return () => clearInterval(t);
  }, []);

  const words = ['conversations.', 'trust.', 'AI systems.', 'your data.'];
  const currentWord = words[Math.floor(tick / 30) % words.length];

  return (
    <section
      id={`section-${index}`}
      ref={ref}
      className="relative w-full min-h-screen flex flex-col items-center justify-center overflow-hidden"
      style={{ background: section.bg }}
    >
      <GridOverlay />
      <FloatingOrbs accent={section.accent} glow={section.glow} />

      {/* Shield logo large */}
      <div
        className="relative mb-10"
        style={{
          transform: entered ? 'translateY(0) scale(1)' : 'translateY(-30px) scale(0.8)',
          opacity: entered ? 1 : 0,
          transition: 'transform 1.2s cubic-bezier(0.16,1,0.3,1), opacity 1s ease',
        }}
      >
        <div
          className="w-32 h-32 rounded-3xl flex items-center justify-center mx-auto"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.1))',
            border: '1px solid rgba(99,102,241,0.3)',
            boxShadow: '0 0 60px rgba(99,102,241,0.3), 0 0 120px rgba(99,102,241,0.1)',
            animation: 'logoPulse 3s ease-in-out infinite',
            padding: '12px',
          }}
        >
          <img
            src="/logo.png"
            alt="ConvoGuard Logo"
            className="w-full h-full object-contain rounded-2xl"
          />
        </div>
        {/* Ring pulse */}
        <div
          className="absolute inset-0 rounded-3xl"
          style={{
            border: '1px solid rgba(99,102,241,0.2)',
            animation: 'ringExpand 2.5s ease-out infinite',
          }}
        />
      </div>

      {/* Brand name */}
      <div
        className="text-center px-6"
        style={{
          transform: entered ? 'translateY(0)' : 'translateY(20px)',
          opacity: entered ? 1 : 0,
          transition: 'transform 1.2s 0.15s cubic-bezier(0.16,1,0.3,1), opacity 1s 0.15s ease',
        }}
      >
        <h1
          className="font-black tracking-tight text-white mb-3"
          style={{ fontSize: 'clamp(3.5rem, 10vw, 8rem)', letterSpacing: '-0.03em', lineHeight: 1 }}
        >
          Convo<span style={{ color: '#818cf8' }}>Guard</span>
        </h1>
        <p
          className="font-light tracking-[0.3em] uppercase mb-8"
          style={{ fontSize: 'clamp(0.75rem, 1.5vw, 1rem)', color: 'rgba(148,163,184,0.8)' }}
        >
          AI Safety, Engineered.
        </p>

        {/* Typewriter line */}
        <div
          className="flex items-center justify-center gap-3 text-lg text-slate-400"
          style={{ fontSize: 'clamp(1rem, 2vw, 1.3rem)' }}
        >
          <span>Protecting your</span>
          <span
            className="font-semibold"
            style={{ color: section.accent, minWidth: '200px', textAlign: 'left' }}
          >
            {currentWord}
            <span className="inline-block w-0.5 h-5 ml-1 align-middle bg-indigo-400" style={{ animation: 'blink 1s step-end infinite' }} />
          </span>
        </div>
      </div>

      {/* Scroll CTA */}
      <div
        className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3"
        style={{
          opacity: entered ? 0.7 : 0,
          transition: 'opacity 1s 0.8s ease',
        }}
      >
        <span className="text-xs tracking-[0.2em] uppercase text-slate-500">Scroll to explore</span>
        <div
          className="w-6 h-10 rounded-full border border-slate-700 flex items-start justify-center pt-2"
        >
          <div
            className="w-1.5 h-1.5 rounded-full bg-indigo-400"
            style={{ animation: 'scrollBounce 1.8s ease-in-out infinite' }}
          />
        </div>
      </div>
    </section>
  );
}

/* ─── Story Section ──────────────────────────────────────────────────── */
function StorySection({ section, index }: { section: Section; index: number }) {
  const { ref, inView, entered } = useInView(0.3);
  const isRight = section.side === 'right';

  return (
    <section
      id={`section-${index}`}
      ref={ref}
      className="relative w-full min-h-screen flex items-center overflow-hidden"
      style={{
        background: inView
          ? `radial-gradient(ellipse 60% 80% at ${isRight ? '75%' : '25%'} 50%, ${section.glow} 0%, transparent 60%), ${section.bg}`
          : section.bg,
        transition: 'background 1s ease',
      }}
    >
      <GridOverlay />
      <FloatingOrbs accent={section.accent} glow={section.glow} />

      {/* Center divider */}
      <div
        className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px pointer-events-none hidden lg:block"
        style={{
          background: `linear-gradient(to bottom, transparent 8%, ${section.accent}40 35%, ${section.accent}40 65%, transparent 92%)`,
          opacity: inView ? 1 : 0,
          transition: 'opacity 1s ease',
        }}
      />

      <div className="relative z-10 w-full flex flex-col lg:flex-row min-h-screen">
        {/* Video half */}
        <div className={`w-full lg:w-1/2 min-h-[50vh] lg:min-h-screen flex items-center ${isRight ? 'lg:order-2' : 'lg:order-1'}`}>
          <VideoPanel
            src={section.video!}
            side={section.side!}
            accent={section.accent}
            glow={section.glow}
            inView={inView}
          />
        </div>

        {/* Text half */}
        <div className={`w-full lg:w-1/2 flex items-center ${isRight ? 'lg:order-1' : 'lg:order-2'}`}>
          <TextPanel section={section} entered={entered} delay={0.18} />
        </div>
      </div>

      {/* Section number watermark */}
      <div
        className="absolute bottom-8 left-8 font-mono text-slate-800 pointer-events-none select-none"
        style={{ fontSize: 'clamp(4rem, 8vw, 7rem)', fontWeight: 900, lineHeight: 1 }}
      >
        {section.tagNum}
      </div>
    </section>
  );
}

/* ─── Outro Section ─────────────────────────────────────────────────── */
function OutroSection({ section, index }: { section: Section; index: number }) {
  const { ref, entered } = useInView(0.25);
  const [hovered, setHovered] = useState<'audit' | 'signin' | null>(null);

  return (
    <section
      id={`section-${index}`}
      ref={ref}
      className="relative w-full min-h-screen flex flex-col items-center justify-center overflow-hidden px-6"
      style={{ background: section.bg }}
    >
      <GridOverlay />
      <FloatingOrbs accent={section.accent} glow={section.glow} />

      {/* Stats row */}
      <div
        className="flex flex-wrap items-center justify-center gap-16 mb-20"
        style={{
          transform: entered ? 'translateY(0)' : 'translateY(30px)',
          opacity: entered ? 1 : 0,
          transition: 'transform 1s ease, opacity 1s ease',
        }}
      >
        {[
          { val: '99.7%', label: 'Detection Accuracy' },
          { val: '<50ms', label: 'Analysis Latency' },
          { val: '500M+', label: 'Turns Analyzed' },
        ].map((s, i) => (
          <div key={i} className="text-center">
            <div
              className="font-black mb-1"
              style={{
                fontSize: 'clamp(2.2rem, 5vw, 3.5rem)',
                background: `linear-gradient(135deg, #fff, ${section.accent})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {s.val}
            </div>
            <div className="text-slate-500 text-sm tracking-wider uppercase">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Main headline */}
      <div
        className="text-center mb-6"
        style={{
          transform: entered ? 'translateY(0)' : 'translateY(20px)',
          opacity: entered ? 1 : 0,
          transition: 'transform 1s 0.15s ease, opacity 1s 0.15s ease',
        }}
      >
        <h2
          className="font-black text-white"
          style={{ fontSize: 'clamp(3rem, 8vw, 6.5rem)', letterSpacing: '-0.03em', lineHeight: 1 }}
        >
          {section.headline}
        </h2>
        <h2
          className="font-black"
          style={{
            fontSize: 'clamp(3rem, 8vw, 6.5rem)',
            letterSpacing: '-0.03em',
            lineHeight: 1,
            background: `linear-gradient(135deg, ${section.accent}, #a855f7)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          {section.headlineAccent}
        </h2>
      </div>

      <p
        className="text-slate-400 text-center max-w-lg mb-14 text-lg leading-relaxed"
        style={{
          transform: entered ? 'translateY(0)' : 'translateY(20px)',
          opacity: entered ? 1 : 0,
          transition: 'transform 1s 0.25s ease, opacity 1s 0.25s ease',
        }}
      >
        {section.subline}
      </p>

      {/* CTA Buttons */}
      <div
        className="flex flex-col sm:flex-row items-center gap-4"
        style={{
          transform: entered ? 'translateY(0)' : 'translateY(20px)',
          opacity: entered ? 1 : 0,
          transition: 'transform 1s 0.35s ease, opacity 1s 0.35s ease',
        }}
      >
        <a
          href="/register"
          onMouseEnter={() => setHovered('audit')}
          onMouseLeave={() => setHovered(null)}
          className="relative inline-flex items-center justify-center gap-2.5 px-10 py-4 rounded-2xl font-bold text-white text-base overflow-hidden transition-all duration-300"
          style={{
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            boxShadow: hovered === 'audit'
              ? '0 0 0 2px rgba(99,102,241,0.6), 0 20px 60px rgba(99,102,241,0.45)'
              : '0 0 0 1px rgba(99,102,241,0.25), 0 8px 32px rgba(99,102,241,0.25)',
            transform: hovered === 'audit' ? 'translateY(-3px) scale(1.03)' : 'translateY(0) scale(1)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Start Free Audit
          <span
            className="ml-1 transition-transform duration-300"
            style={{ transform: hovered === 'audit' ? 'translateX(4px)' : 'translateX(0)' }}
          >→</span>
        </a>

        <a
          href="/login"
          onMouseEnter={() => setHovered('signin')}
          onMouseLeave={() => setHovered(null)}
          className="inline-flex items-center justify-center gap-2 px-10 py-4 rounded-2xl font-semibold text-slate-300 text-base transition-all duration-300"
          style={{
            border: '1px solid rgba(255,255,255,0.1)',
            background: hovered === 'signin' ? 'rgba(255,255,255,0.06)' : 'transparent',
            boxShadow: hovered === 'signin' ? '0 8px 24px rgba(0,0,0,0.3)' : 'none',
            transform: hovered === 'signin' ? 'translateY(-2px)' : 'translateY(0)',
          }}
        >
          Sign In
        </a>
      </div>

      {/* Footer text */}
      <p className="absolute bottom-8 text-xs text-slate-700 tracking-wider">
        © 2025 ConvoGuard · AI Safety Platform
      </p>
    </section>
  );
}

/* ─── Root Component ──────────────────────────────────────────────────── */
export default function VideoStory() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    SECTIONS.forEach((_, i) => {
      const el = document.getElementById(`section-${i}`);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([e]) => { if (e.isIntersecting) setActiveIndex(i); },
        { threshold: 0.4 }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach(o => o.disconnect());
  }, []);

  return (
    <>
      <style>{`
        @keyframes orbFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(20px, -30px) scale(1.05); }
          66% { transform: translate(-15px, 20px) scale(0.97); }
        }
        @keyframes logoPulse {
          0%, 100% { box-shadow: 0 0 60px rgba(99,102,241,0.3), 0 0 120px rgba(99,102,241,0.1); }
          50% { box-shadow: 0 0 80px rgba(99,102,241,0.5), 0 0 160px rgba(99,102,241,0.2); }
        }
        @keyframes ringExpand {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes scrollBounce {
          0%, 100% { transform: translateY(0); opacity: 1; }
          50% { transform: translateY(14px); opacity: 0.3; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        * { scroll-behavior: smooth; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0A0D14; }
        ::-webkit-scrollbar-thumb { background: #6366f130; border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: #6366f160; }
      `}</style>

      <Navbar active={activeIndex} />
      <ProgressBar count={SECTIONS.length} active={activeIndex} />

      {SECTIONS.map((section, i) => {
        if (section.type === 'intro') return <IntroSection key={section.id} section={section} index={i} />;
        if (section.type === 'outro') return <OutroSection key={section.id} section={section} index={i} />;
        return <StorySection key={section.id} section={section} index={i} />;
      })}
    </>
  );
}
