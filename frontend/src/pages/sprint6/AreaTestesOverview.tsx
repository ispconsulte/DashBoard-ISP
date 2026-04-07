import { useRef, useEffect, useState, useCallback } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  DatabaseZap,
  HeartPulse,
  TrendingUp,
  Users2,
  Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { usePageSEO } from "@/hooks/usePageSEO";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import PageSkeleton from "@/components/ui/PageSkeleton";
import DataErrorCard from "@/components/ui/DataErrorCard";

/* ── Floating particles canvas ───────────────────────────── */
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const dpr = window.devicePixelRatio || 1;

    const particles: {
      x: number; y: number; vx: number; vy: number;
      size: number; opacity: number; hue: number;
    }[] = [];

    function resize() {
      if (!canvas) return;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx!.scale(dpr, dpr);
    }

    function init() {
      resize();
      const count = Math.min(60, Math.floor((canvas!.offsetWidth * canvas!.offsetHeight) / 12000));
      particles.length = 0;
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * canvas!.offsetWidth,
          y: Math.random() * canvas!.offsetHeight,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          size: Math.random() * 2.5 + 0.5,
          opacity: Math.random() * 0.35 + 0.08,
          hue: Math.random() > 0.5 ? 220 : 260,
        });
      }
    }

    function draw() {
      if (!canvas || !ctx) return;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 80%, 70%, ${p.opacity})`;
        ctx.fill();
      }

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `hsla(230, 60%, 60%, ${0.08 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animId = requestAnimationFrame(draw);
    }

    init();
    draw();
    window.addEventListener("resize", init);
    return () => {
      window.removeEventListener("resize", init);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ opacity: 0.7 }}
    />
  );
}

/* ── Interactive glow card ────────────────────────────────── */
function GlowCard({
  children,
  color,
  onClick,
  delay = 0,
}: {
  children: React.ReactNode;
  color: string;
  onClick: () => void;
  delay?: number;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 300, damping: 30 });
  const springY = useSpring(mouseY, { stiffness: 300, damping: 30 });

  const glowX = useTransform(springX, (v) => `${v}px`);
  const glowY = useTransform(springY, (v) => `${v}px`);

  const handleMouse = useCallback((e: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  }, [mouseX, mouseY]);

  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={onClick}
      onMouseMove={handleMouse}
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay, type: "spring", stiffness: 100 }}
      whileHover={{ y: -6, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="group relative h-full w-full overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.03] p-6 text-left backdrop-blur-md transition-colors duration-300 hover:border-white/[0.15]"
    >
      {/* Glow effect that follows cursor */}
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: `radial-gradient(400px circle at var(--glow-x) var(--glow-y), ${color}20, transparent 60%)`,
          // @ts-ignore
          "--glow-x": glowX,
          "--glow-y": glowY,
        } as React.CSSProperties}
      />
      {/* Top edge light */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: `linear-gradient(90deg, transparent, ${color}60, transparent)`,
        }}
      />
      <div className="relative z-10">{children}</div>
    </motion.button>
  );
}

/* ── Animated counter ─────────────────────────────────────── */
function AnimatedText({ text, delay = 0 }: { text: string; delay?: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), delay * 1000);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <AnimatePresence>
      {show && (
        <motion.span
          initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          {text}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

/* ── Data ─────────────────────────────────────────────────── */
/* Icon animation presets per module */
const iconAnimations: Record<string, { animate: Record<string, number[]| string[]>; transition: Record<string, unknown> }> = {
  "Performance & ROI": {
    animate: { y: [0, -3, 0], rotate: [0, 8, 0] },
    transition: { duration: 2.5, repeat: Infinity, ease: "easeInOut" },
  },
  "Operação & Capacidade": {
    animate: { rotate: [0, 15, -15, 0] },
    transition: { duration: 3, repeat: Infinity, ease: "easeInOut" },
  },
  "Saúde do Cliente": {
    animate: { scale: [1, 1.25, 1, 1.2, 1] },
    transition: { duration: 1.2, repeat: Infinity, ease: "easeInOut" },
  },
  "Governança de Dados": {
    animate: { scale: [1, 1.1, 1] },
    transition: { duration: 2, repeat: Infinity, ease: "easeInOut" },
  },
};

const moduleCards = [
  {
    title: "Performance & ROI",
    subtitle: "Rentabilidade e variância econômica",
    icon: TrendingUp,
    route: "/admin/testes/roi",
    color: "hsl(38, 92%, 50%)",
    gradient: "from-amber-500/20 to-orange-600/5",
  },
  {
    title: "Operação & Capacidade",
    subtitle: "Carga, disponibilidade e sobrealocação",
    icon: Users2,
    route: "/admin/testes/capacidade",
    color: "hsl(200, 75%, 50%)",
    gradient: "from-sky-500/20 to-blue-600/5",
  },
  {
    title: "Saúde do Cliente",
    subtitle: "Score, churn e benchmark",
    icon: HeartPulse,
    route: "/admin/testes/saude-cliente",
    color: "hsl(0, 72%, 51%)",
    gradient: "from-rose-500/20 to-red-600/5",
  },
  {
    title: "Governança de Dados",
    subtitle: "Cadastros, pesos e fontes",
    icon: DatabaseZap,
    route: "/admin/testes/governanca-dados",
    color: "hsl(160, 84%, 39%)",
    gradient: "from-emerald-500/20 to-green-600/5",
  },
];

/* ── Page ─────────────────────────────────────────────────── */
export default function AreaTestesOverview() {
  usePageSEO("Central Gerencial");
  const { session, loadingSession } = useAuth();
  const navigate = useNavigate();

  if (loadingSession) return <PageSkeleton variant="analiticas" />;

  if (!session?.accessToken) {
    return (
      <div className="page-gradient relative min-h-screen w-full overflow-hidden bg-[#060a12]">
        <ParticleField />
        <div className="relative z-10 mx-auto w-full max-w-[1900px] p-4 sm:p-5 md:p-8">
          <DataErrorCard
            title="Sessão não inicializada"
            message="Faça login para acessar a Central Gerencial."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="page-gradient relative min-h-screen w-full overflow-hidden bg-[#060a12]">
      {/* Particle background */}
      <ParticleField />

      {/* Ambient glow orbs */}
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          animate={{
            x: [0, 40, -20, 0],
            y: [0, -30, 20, 0],
            scale: [1, 1.2, 0.9, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -left-32 top-20 h-96 w-96 rounded-full"
          style={{ background: "radial-gradient(circle, hsla(230,80%,60%,0.08), transparent 70%)" }}
        />
        <motion.div
          animate={{
            x: [0, -50, 30, 0],
            y: [0, 40, -20, 0],
            scale: [1, 0.85, 1.15, 1],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -right-20 top-1/3 h-80 w-80 rounded-full"
          style={{ background: "radial-gradient(circle, hsla(280,70%,50%,0.06), transparent 70%)" }}
        />
        <motion.div
          animate={{
            x: [0, 30, -40, 0],
            y: [0, -20, 30, 0],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-20 left-1/3 h-72 w-72 rounded-full"
          style={{ background: "radial-gradient(circle, hsla(200,80%,55%,0.05), transparent 70%)" }}
        />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[1400px] space-y-12 px-4 py-8 sm:px-6 md:py-12 lg:py-16">
        {/* ── Hero header ────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="text-center"
        >
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.8, type: "spring", stiffness: 150 }}
            className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-lg"
          >
            <BriefcaseBusiness className="h-7 w-7 text-primary" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 15, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl"
          >
            Central{" "}
            <span className="bg-gradient-to-r from-primary via-sky-400 to-violet-400 bg-clip-text text-transparent">
              Gerencial
            </span>
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "6rem" }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="mx-auto mt-4 h-0.5 rounded-full bg-gradient-to-r from-transparent via-primary/60 to-transparent"
          />

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 0.7, y: 0 }}
            transition={{ duration: 0.5, delay: 1 }}
            className="mx-auto mt-4 max-w-md text-sm text-muted-foreground"
          >
            Acesse cada módulo para aprofundar a análise operacional.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 1.2 }}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1"
          >
            <Sparkles className="h-3 w-3 text-primary" />
            <span className="text-[11px] font-medium text-primary">hub executivo</span>
          </motion.div>
        </motion.div>

        {/* ── Module cards grid ──────────────────────────── */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {moduleCards.map((module, index) => (
            <GlowCard
              key={module.route}
              color={module.color}
              onClick={() => navigate(module.route)}
              delay={0.15 + index * 0.08}
            >
              <div className="flex items-start justify-between">
                <motion.div
                  animate={iconAnimations[module.title]?.animate}
                  transition={iconAnimations[module.title]?.transition}
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${module.gradient} border border-white/[0.06]`}
                >
                  <module.icon className="h-5 w-5" style={{ color: module.color }} />
                </motion.div>
                <ArrowRight className="h-4 w-4 text-muted-foreground/50 transition-all duration-300 group-hover:translate-x-1 group-hover:text-foreground" />
              </div>

              <p className="mt-5 text-lg font-semibold text-foreground">{module.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{module.subtitle}</p>

              {/* Bottom shimmer line */}
              <div className="mt-5 h-px w-full overflow-hidden rounded-full bg-white/[0.04]">
                <motion.div
                  className="h-full w-1/3 rounded-full"
                  style={{ background: `linear-gradient(90deg, transparent, ${module.color}40, transparent)` }}
                  animate={{ x: ["-100%", "400%"] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: index * 0.4 }}
                />
              </div>
            </GlowCard>
          ))}
        </div>
      </div>
    </div>
  );
}
