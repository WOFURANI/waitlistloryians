'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  Columns,
  LayoutGrid,
  Sparkles,
  Loader2,
  Mail,
  CheckCircle2,
  XCircle,
  ArrowRight,
  MousePointerClick,
  Layers,
  ChevronRight
} from 'lucide-react';

// Custom SVG Logo for Loryians (matching the exact purple/lavender interlocking geometry of logo.svg)
function LoryiansLogo({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg className={className} viewBox="302.5 -15 506.5 539.5" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M530 295.5H573.5L727 117.5V193H794V0H608.5V68H680L530 243V295.5Z" fill="#782ADD" />
      <path d="M690 442.5L757 509.5H436V418.5H501V442.5H690Z" fill="#782ADD" />
      <path d="M385 0H317.5V390H406.5V321.5H385V0Z" fill="#782ADD" />
      <path d="M501 0H436V390H727V444.5L794 509.5V321.5H501V0Z" fill="#D1AAF9" />
    </svg>
  );
}

const BANNED_EMAIL_DOMAINS = new Set([
  'temp-mail.org', 'tempmail.com', 'mailinator.com', 'yopmail.com', '10minutemail.com',
  'guerrillamail.com', 'dispostable.com', 'getairmail.com', 'burnermail.io', 'trashmail.com',
  'tempmailaddress.com', 'sharklasers.com', 'guerrillamailblock.com', 'guerrillamail.net',
  'guerrillamail.org', 'guerrillamail.biz', 'grr.la', 'pokemail.net', 'spam4.me',
  'disposable.com', 'duck.com', 'anonaddy.com', 'simplelogin.co', 'maildrop.cc'
]);

export default function Home() {
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);

  const isTyping = email.length > 0;
  const isPopping = isFocused || isTyping;

  // Load and render Cloudflare Turnstile
  React.useEffect(() => {
    // Inject Turnstile script
    if (!document.getElementById('cloudflare-turnstile-script')) {
      const script = document.createElement('script');
      script.id = 'cloudflare-turnstile-script';
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }

    let widgetId: string | null = null;
    const renderTurnstile = () => {
      const turnstile = (window as any).turnstile;
      if (turnstile && turnstileRef.current && !widgetId) {
        try {
          widgetId = turnstile.render(turnstileRef.current, {
            sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY || '1x00000000000000000000AA', // fallback to Cloudflare test key
            callback: (token: string) => {
              setTurnstileToken(token);
            },
            'error-callback': () => {
              setTurnstileToken(null);
            },
            'expired-callback': () => {
              setTurnstileToken(null);
            }
          });
        } catch (e) {
          console.error("Turnstile render error:", e);
        }
      }
    };

    const interval = setInterval(() => {
      if ((window as any).turnstile) {
        renderTurnstile();
        clearInterval(interval);
      }
    }, 100);

    return () => {
      clearInterval(interval);
      if (widgetId && (window as any).turnstile) {
        try {
          (window as any).turnstile.remove(widgetId);
        } catch (e) {
          // Ignore removal error on unmount
        }
      }
    };
  }, []);

  const handleScrollToForm = () => {
    inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
      inputRef.current?.focus();
    }, 600);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Strict format check
    if (!email || typeof email !== 'string' || email.length > 254 || !/^\S+@\S+\.\S+$/.test(email)) {
      setStatus('error');
      setMessage('Please enter a valid email address.');
      return;
    }

    const sanitizedEmail = email.trim().toLowerCase();
    const domain = sanitizedEmail.split('@')[1];

    // Block disposable email addresses immediately on the client side
    if (BANNED_EMAIL_DOMAINS.has(domain)) {
      setStatus('error');
      setMessage('Disposable email addresses are not allowed. Please use a work or personal email.');
      return;
    }

    // Require Turnstile token if Turnstile has loaded (or in production)
    const turnstileRequired = (window as any).turnstile || process.env.NODE_ENV === 'production';
    if (turnstileRequired && !turnstileToken) {
      setStatus('error');
      setMessage('Please complete the security check.');
      return;
    }

    setStatus('loading');
    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, website, turnstileToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit email.');
      }

      setStatus('success');
      setMessage(data.message || "You're on the waitlist! We'll reach out soon.");
      setEmail('');
      setWebsite('');
      setTurnstileToken(null);
      // Reset Turnstile widget for subsequent entries
      if ((window as any).turnstile) {
        try {
          (window as any).turnstile.reset();
        } catch (e) {
          console.error("Turnstile reset error:", e);
        }
      }
    } catch (error: any) {
      setStatus('error');
      setMessage(error.message || 'Something went wrong. Please try again.');
      // Also reset on error to allow the user to try again
      if ((window as any).turnstile) {
        try {
          (window as any).turnstile.reset();
        } catch (e) {
          // ignore
        }
      }
    }
  };

  // Stagger animation container
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.2,
      },
    },
  };

  // Stagger items
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring' as const,
        stiffness: 100,
        damping: 16
      }
    },
  };

  return (
    <div className="relative min-h-screen bg-white text-purple-950 overflow-hidden font-sans select-none">

      {/* Background gradients representing the brand's soft lavender accents */}
      <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden">
        {/* Top Left Gradient Orb */}
        <motion.div
          animate={{
            scale: isPopping ? [1, 1.15, 1] : 1,
            backgroundColor: isPopping
              ? (isTyping ? ["#c084fc", "#f472b6", "#818cf8", "#c084fc"] : "#e8d5ff")
              : "#f3e8ff",
            opacity: isPopping ? 0.8 : 0.6,
          }}
          transition={{
            duration: isTyping ? 6 : 0.5,
            repeat: isTyping ? Infinity : 0,
            ease: "easeInOut",
          }}
          className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full blur-[100px] pointer-events-none"
        />

        {/* Bottom Right Gradient Orb */}
        <motion.div
          animate={{
            scale: isPopping ? [1, 1.2, 1] : 1,
            backgroundColor: isPopping
              ? (isTyping ? ["#a78bfa", "#fb7185", "#6366f1", "#a78bfa"] : "#ddd6fe")
              : "#ede9fe",
            opacity: isPopping ? 0.7 : 0.5,
          }}
          transition={{
            duration: isTyping ? 8 : 0.5,
            repeat: isTyping ? Infinity : 0,
            ease: "easeInOut",
            delay: 0.5,
          }}
          className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full blur-[120px] pointer-events-none"
        />

        {/* Middle Center Gradient Orb */}
        <motion.div
          animate={{
            scale: isPopping ? [1, 1.1, 1] : 1,
            backgroundColor: isPopping
              ? (isTyping ? ["#fae8ff", "#e0f2fe", "#ede9fe", "#fae8ff"] : "#f5e6ff")
              : "#faf5ff",
            opacity: isPopping ? 0.9 : 0.8,
          }}
          transition={{
            duration: isTyping ? 5 : 0.5,
            repeat: isTyping ? Infinity : 0,
            ease: "easeInOut",
          }}
          className="absolute top-[35%] left-[50%] -translate-x-1/2 w-[80%] h-[40%] rounded-full blur-[80px] pointer-events-none"
        />
      </div>

      {/* Dynamic floating sparkles/particles */}
      <AnimatePresence>
        {isTyping && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
            <motion.div
              initial={{ x: "20vw", y: "90vh", opacity: 0, scale: 0.5 }}
              animate={{
                y: "20vh",
                opacity: [0, 0.7, 0],
                x: ["20vw", "25vw", "18vw"]
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeOut" }}
              className="absolute w-6 h-6 rounded-full bg-pink-300 blur-[3px]"
            />
            <motion.div
              initial={{ x: "75vw", y: "85vh", opacity: 0, scale: 0.4 }}
              animate={{
                y: "15vh",
                opacity: [0, 0.6, 0],
                x: ["75vw", "70vw", "78vw"]
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeOut", delay: 1 }}
              className="absolute w-8 h-8 rounded-full bg-purple-300 blur-[4px]"
            />
            <motion.div
              initial={{ x: "45vw", y: "95vh", opacity: 0, scale: 0.6 }}
              animate={{
                y: "30vh",
                opacity: [0, 0.8, 0],
                x: ["45vw", "48vw", "42vw"]
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeOut", delay: 2 }}
              className="absolute w-5 h-5 rounded-full bg-indigo-300 blur-[3px]"
            />
            <motion.div
              initial={{ x: "10vw", y: "75vh", opacity: 0, scale: 0.3 }}
              animate={{
                y: "10vh",
                opacity: [0, 0.5, 0],
                x: ["10vw", "12vw", "8vw"]
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
              className="absolute w-4 h-4 rounded-full bg-fuchsia-300 blur-[2px]"
            />
            <motion.div
              initial={{ x: "85vw", y: "90vh", opacity: 0, scale: 0.5 }}
              animate={{
                y: "25vh",
                opacity: [0, 0.6, 0],
                x: ["85vw", "80vw", "88vw"]
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 4.5, repeat: Infinity, ease: "easeOut", delay: 1.5 }}
              className="absolute w-6 h-6 rounded-full bg-pink-300 blur-[3px]"
            />
          </div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <main className="max-w-5xl mx-auto px-6 pt-20 pb-24 md:pt-28 md:pb-32 flex flex-col items-center text-center">

        {/* Centered Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex flex-col items-center gap-4 mb-12"
        >
          <LoryiansLogo className="w-24 h-24 text-[#782ADD]" />
          <span className="font-bold text-2xl tracking-tight text-purple-950">Loryians</span>
        </motion.div>

        {/* Animated tag */}


        {/* Staggered Hero Typography */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="flex flex-col items-center max-w-3xl"
        >
          <motion.h1
            variants={itemVariants}
            className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-purple-950 leading-[1.1] mb-6"
          >
            Launch your projects without the{' '}
            <span className="bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 bg-clip-text text-transparent">
              bloat.
            </span>
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="text-lg md:text-xl text-purple-800/80 leading-relaxed max-w-2xl mb-10 font-normal"
          >
            The minimalist workspace for solo founders and small teams to plan, track, and ship faster. No bloated menus, no configuration fatigue, just pure workflow flow.
          </motion.p>

          {/* Waitlist Subscription Form */}
          <motion.div
            variants={itemVariants}
            className="w-full max-w-md px-2"
          >
            <form
              onSubmit={handleSubmit}
              className={`flex flex-col sm:flex-row items-stretch gap-2.5 p-1.5 rounded-2xl border bg-white/80 backdrop-blur-md transition-all duration-500 ${isPopping
                ? 'border-pink-300 shadow-[0_8px_35px_rgba(236,72,153,0.12)] ring-1 ring-pink-200'
                : 'border-purple-100 shadow-[0_8px_30px_rgb(124,58,237,0.03)] focus-within:border-purple-300 focus-within:shadow-[0_8px_35px_rgba(124,58,237,0.08)]'
                }`}
            >
              {/* Honeypot field for bot protection */}
              <div className="hidden" aria-hidden="true">
                <input
                  type="text"
                  name="website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              {/* Input field with motion focus transition */}
              <input
                ref={inputRef}
                type="email"
                placeholder="Enter your work email..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                disabled={status === 'loading'}
                className="flex-grow px-4 py-3 rounded-xl text-base text-purple-950 placeholder-purple-300/80 bg-transparent border-0 outline-none focus:ring-0 w-full transition-all"
              />

              <motion.button
                type="submit"
                disabled={status === 'loading'}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="cursor-pointer bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-3 rounded-xl transition-all duration-200 shadow-md flex items-center justify-center gap-2 whitespace-nowrap"
              >
                {status === 'loading' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    Requesting...
                  </>
                ) : (
                  <>
                    Request Access
                    <ChevronRight className="w-4 h-4 text-purple-200" />
                  </>
                )}
              </motion.button>
            </form>

            {/* Cloudflare Turnstile widget container */}
            <div className="flex justify-center mt-3.5 mb-1 scale-[0.9] origin-center">
              <div ref={turnstileRef} />
            </div>

            {/* Input Response Feedbacks */}
            <AnimatePresence mode="wait">
              {status === 'success' && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="mt-4 flex items-center gap-2 text-sm text-green-600 bg-green-50/70 border border-green-100 rounded-xl px-4 py-3"
                >
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  <p className="text-left font-medium">{message}</p>
                </motion.div>
              )}

              {status === 'error' && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="mt-4 flex items-center gap-2 text-sm text-red-600 bg-red-50/70 border border-red-100 rounded-xl px-4 py-3"
                >
                  <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <p className="text-left font-medium">{message}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>

        {/* Gorgeous Animated Product Kanban Preview Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, type: 'spring', stiffness: 50, damping: 20 }}
          className="w-full mt-16 md:mt-24 rounded-2xl border border-purple-100 bg-white/50 backdrop-blur-sm p-4 shadow-[0_12px_40px_rgba(124,58,237,0.04)]"
        >
          <div className="flex items-center justify-between border-b border-purple-50/60 pb-3 mb-4 px-2">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
              <span className="text-xs text-purple-400 font-mono ml-2">Loryians Workspace</span>
            </div>
            <div className="flex gap-2">
              <div className="w-16 h-4 rounded bg-purple-50" />
              <div className="w-10 h-4 rounded bg-purple-50" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
            {/* Column 1 */}
            <div className="rounded-xl bg-purple-50/40 border border-purple-50/80 p-3">
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-xs font-bold text-purple-900 uppercase tracking-wider">Backlog</span>
                <span className="text-2xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold font-mono">3</span>
              </div>
              <div className="space-y-2">
                <motion.div
                  whileHover={{ y: -2, boxShadow: "0 6px 15px rgba(124,58,237,0.06)" }}
                  className="bg-white border border-purple-100/50 rounded-lg p-3 shadow-[0_2px_8px_rgba(124,58,237,0.02)] cursor-pointer"
                >
                  <div className="flex gap-1.5 mb-1.5">
                    <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded font-medium">Design</span>
                  </div>
                  <h4 className="text-sm font-semibold text-purple-950">Refine landing page spacing and font scales</h4>
                  <div className="flex justify-between items-center mt-3 pt-2 border-t border-purple-50">
                    <div className="w-4 h-4 rounded-full bg-purple-200" />
                    <span className="text-3xs font-mono text-purple-400">#LOR-124</span>
                  </div>
                </motion.div>

                <div className="bg-white/60 border border-purple-50/50 rounded-lg p-3 shadow-none opacity-80">
                  <h4 className="text-sm font-semibold text-purple-900">Add Resend integration for welcome triggers</h4>
                  <div className="flex justify-between items-center mt-3">
                    <div className="w-4 h-4 rounded-full bg-indigo-200" />
                    <span className="text-3xs font-mono text-purple-300">#LOR-125</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 2 */}
            <div className="rounded-xl bg-purple-50/40 border border-purple-50/80 p-3">
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-xs font-bold text-purple-900 uppercase tracking-wider">In Progress</span>
                <span className="text-2xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold font-mono">1</span>
              </div>
              <div className="space-y-2">
                <motion.div
                  whileHover={{ y: -2, boxShadow: "0 6px 15px rgba(124,58,237,0.06)" }}
                  className="bg-white border-2 border-purple-200 rounded-lg p-3 shadow-[0_4px_12px_rgba(124,58,237,0.04)] cursor-pointer"
                >
                  <div className="flex gap-1.5 mb-1.5">
                    <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">Priority</span>
                    <span className="text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded font-medium">Marketing</span>
                  </div>
                  <h4 className="text-sm font-bold text-purple-950">Ship the waitlist page to beta founders</h4>
                  <div className="flex justify-between items-center mt-4 pt-2 border-t border-purple-50">
                    <div className="flex -space-x-1.5">
                      <div className="w-4.5 h-4.5 rounded-full bg-purple-300 border border-white" />
                      <div className="w-4.5 h-4.5 rounded-full bg-indigo-300 border border-white" />
                    </div>
                    <span className="text-3xs font-mono text-purple-600 font-semibold">In flow 🚀</span>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Column 3 */}
            <div className="rounded-xl bg-purple-50/40 border border-purple-50/80 p-3">
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-xs font-bold text-purple-900 uppercase tracking-wider">Completed</span>
                <span className="text-2xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold font-mono">5</span>
              </div>
              <div className="space-y-2">
                <div className="bg-white/70 border border-purple-50/30 rounded-lg p-3 shadow-none opacity-60 line-through text-purple-400">
                  <h4 className="text-sm font-medium text-purple-400">Set up database tables in Supabase config</h4>
                  <div className="flex justify-between items-center mt-3">
                    <div className="w-4 h-4 rounded-full bg-green-200" />
                    <span className="text-3xs font-mono text-purple-300">#LOR-122</span>
                  </div>
                </div>

                <div className="bg-white/70 border border-purple-50/30 rounded-lg p-3 shadow-none opacity-60 line-through text-purple-400">
                  <h4 className="text-sm font-medium text-purple-400">Define visual style guide & logo SVG</h4>
                  <div className="flex justify-between items-center mt-3">
                    <div className="w-4 h-4 rounded-full bg-green-200" />
                    <span className="text-3xs font-mono text-purple-300">#LOR-121</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Features Teaser ("Why Loryians?") */}
        <section className="w-full mt-28 md:mt-36" id="features">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-purple-950 mb-4">
              Everything you need. Nothing you don't.
            </h2>
            <p className="text-base md:text-lg text-purple-800/80">
              We cut out standard SaaS bloat so you can focus entirely on your product. Get back into your development flow.
            </p>
          </div>

          {/* Core Feature Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">

            {/* Card 1: Minimalist UI */}
            <motion.div
              whileInView={{ opacity: [0, 1], y: [20, 0] }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: 0.1 }}
              whileHover={{ y: -4, border: '1px solid rgba(124, 58, 237, 0.25)' }}
              className="group rounded-2xl border border-purple-100 bg-white/50 backdrop-blur-sm p-6 shadow-[0_4px_20px_rgba(124,58,237,0.01)] transition-all duration-300 hover:shadow-[0_8px_30px_rgba(124,58,237,0.04)] cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 mb-4 group-hover:bg-purple-100 group-hover:text-purple-700 transition-colors">
                <LayoutGrid className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-purple-950 mb-2">Minimalist UI</h3>
              <p className="text-purple-800/85 text-sm leading-relaxed">
                Clean interfaces with absolute zero clutter. Keep your cognitive load low and stay focused on building the core features of your product.
              </p>
            </motion.div>

            {/* Card 2: Effortless Kanban */}
            <motion.div
              whileInView={{ opacity: [0, 1], y: [20, 0] }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: 0.2 }}
              whileHover={{ y: -4, border: '1px solid rgba(124, 58, 237, 0.25)' }}
              className="group rounded-2xl border border-purple-100 bg-white/50 backdrop-blur-sm p-6 shadow-[0_4px_20px_rgba(124,58,237,0.01)] transition-all duration-300 hover:shadow-[0_8px_30px_rgba(124,58,237,0.04)] cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 mb-4 group-hover:bg-purple-100 group-hover:text-purple-700 transition-colors">
                <Columns className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-purple-950 mb-2">Effortless Kanban</h3>
              <p className="text-purple-800/85 text-sm leading-relaxed">
                Drag, drop, and progress. Simple task flows designed to map perfectly to founder timelines. Ship tickets and release builds without friction.
              </p>
            </motion.div>

            {/* Card 3: Built for Speed */}
            <motion.div
              whileInView={{ opacity: [0, 1], y: [20, 0] }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: 0.3 }}
              whileHover={{ y: -4, border: '1px solid rgba(124, 58, 237, 0.25)' }}
              className="group rounded-2xl border border-purple-100 bg-white/50 backdrop-blur-sm p-6 shadow-[0_4px_20px_rgba(124,58,237,0.01)] transition-all duration-300 hover:shadow-[0_8px_30px_rgba(124,58,237,0.04)] cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 mb-4 group-hover:bg-purple-100 group-hover:text-purple-700 transition-colors">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-purple-950 mb-2">Built for Speed</h3>
              <p className="text-purple-800/85 text-sm leading-relaxed">
                Intuitively mapped keyboard shortcuts, optimized server responses, and zero-latency drag-and-drop state sync. Built for efficiency.
              </p>
            </motion.div>
          </div>
        </section>

        {/* How it Works / Workflow Steps */}
        <section className="w-full mt-28 md:mt-36" id="workflow">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-purple-950 mb-4">
              Designed for High-Velocity Shipping
            </h2>
            <p className="text-base md:text-lg text-purple-800/80">
              Establish workflow momentum. Get your ideas out of backlog and into production in three clear steps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Step 1 */}
            <div className="flex flex-col items-center md:items-start text-center md:text-left relative">
              <span className="text-5xl font-black text-purple-100 mb-4 font-mono select-none">01</span>
              <h3 className="text-lg font-bold text-purple-950 mb-2">Define Your Focus</h3>
              <p className="text-purple-800/85 text-sm leading-relaxed">
                Create a clean Kanban board for your MVP or project without complex onboarding steps or metadata constraints.
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center md:items-start text-center md:text-left relative">
              <span className="text-5xl font-black text-purple-100 mb-4 font-mono select-none">02</span>
              <h3 className="text-lg font-bold text-purple-950 mb-2">Execute In Flow</h3>
              <p className="text-purple-800/85 text-sm leading-relaxed">
                Write quick task logs, assign priority levels, and drag tasks smoothly across columns with real-time feedback loop.
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center md:items-start text-center md:text-left relative">
              <span className="text-5xl font-black text-purple-100 mb-4 font-mono select-none">03</span>
              <h3 className="text-lg font-bold text-purple-950 mb-2">Ship Continuously</h3>
              <p className="text-purple-800/85 text-sm leading-relaxed">
                Clear blocker tickets, track project milestones, and release builds with zero administrative friction.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="w-full max-w-4xl mx-auto mt-28 md:mt-36" id="faq">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-purple-950 mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-base md:text-lg text-purple-800/80">
              Got questions about our minimalist project management platform? We have answers.
            </p>
          </div>

          <div className="space-y-6 text-left">
            <div className="rounded-2xl border border-purple-100/80 bg-white/40 p-6 backdrop-blur-sm">
              <h3 className="text-base font-bold text-purple-950 mb-2">What is Loryians and how does it help founders?</h3>
              <p className="text-purple-800/85 text-sm leading-relaxed">
                Loryians is a lightweight project management tool specifically engineered for solo founders and small product teams. By cutting out bloated sub-menus and complex configuration settings, it lets you plan, track, and ship builds with zero friction, keeping your cognitive load low.
              </p>
            </div>

            <div className="rounded-2xl border border-purple-100/80 bg-white/40 p-6 backdrop-blur-sm">
              <h3 className="text-base font-bold text-purple-950 mb-2">How does Loryians compare to traditional project management platforms?</h3>
              <p className="text-purple-800/85 text-sm leading-relaxed">
                Traditional tools are built for large enterprise management and feature excessive configuration fatigue. Loryians focuses on a streamlined, keyboard-friendly Kanban layout, giving developers and designers a task tracker that loads instantly.
              </p>
            </div>

            <div className="rounded-2xl border border-purple-100/80 bg-white/40 p-6 backdrop-blur-sm">
              <h3 className="text-base font-bold text-purple-950 mb-2">Will waitlist members receive an early-stage discount?</h3>
              <p className="text-purple-800/85 text-sm leading-relaxed">
                Yes, signing up for the waitlist grants you an exclusive early-stage discount when our paid plans launch. We will also reach out with invitation tokens and release notes as we roll out collaborative boards.
              </p>
            </div>

            <div className="rounded-2xl border border-purple-100/80 bg-white/40 p-6 backdrop-blur-sm">
              <h3 className="text-base font-bold text-purple-950 mb-2">Is there a free plan available?</h3>
              <p className="text-purple-800/85 text-sm leading-relaxed">
                Absolutely. We have a free plan that lets you explore the app in a limited way, so you can test the minimalist workflow and core features before deciding to upgrade.
              </p>
            </div>
          </div>
        </section>

      </main>

      {/* Footer Section */}
      <footer className="w-full max-w-5xl mx-auto px-6 py-8 border-t border-purple-50 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 opacity-80">
          <LoryiansLogo className="w-6 h-6" />
          <span className="text-sm font-semibold text-purple-900">Loryians &copy; 2026</span>
        </div>

        <div className="flex items-center gap-6 text-sm text-purple-700 font-medium">
          <motion.a
            whileHover={{ y: -1, color: '#7C3AED' }}
            href="https://x.com/loryiansapp"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 transition-colors"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Twitter/X
          </motion.a>

          <motion.a
            whileHover={{ y: -1, color: '#7C3AED' }}
            href="mailto:hello@loryians.com"
            className="flex items-center gap-1.5 transition-colors"
          >
            <Mail className="w-4 h-4" />
            Contact
          </motion.a>
        </div>
      </footer>
    </div>
  );
}
