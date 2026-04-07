import { useState, useEffect, useCallback, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, LogIn, ArrowRight, BarChart3, Zap, Users, Layers, TrendingUp, ShieldAlert, X } from "lucide-react";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { usePageSEO } from "@/hooks/usePageSEO";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";

/* ── Feature cards data ── */
const FEATURE_CARDS = [
  { icon: BarChart3, title: "Inteligência Analítica", desc: "Dashboards executivos com indicadores-chave para decisões estratégicas em tempo real." },
  { icon: Zap, title: "Performance Operacional", desc: "Automação e visibilidade total para maximizar a eficiência da sua operação." },
  { icon: Users, title: "Consultoria de Excelência", desc: "Expertise dedicada ao crescimento sustentável de provedores de alta performance." },
  { icon: Layers, title: "Plataforma Unificada", desc: "Gestão centralizada com governança, controle e rastreabilidade em cada processo." },
  { icon: TrendingUp, title: "Escala com Confiança", desc: "Infraestrutura robusta e estratégia orientada a dados para expandir com segurança." },
];

/* ── Full-page animated background ── */
function AnimatedBackground() {
  return (
    <div className="login-bg" aria-hidden="true">
      <div className="login-bg__nebula" />
      {/* Particles */}
      {Array.from({ length: 65 }).map((_, i) => (
        <div
          key={i}
          className="login-bg__particle"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 10}s`,
            animationDuration: `${4 + Math.random() * 6}s`,
            width: `${0.8 + Math.random() * 2.2}px`,
            height: `${0.8 + Math.random() * 2.2}px`,
          }}
        />
      ))}
      {/* Shooting stars */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={`shoot-${i}`}
          className="login-bg__shooting-star"
          style={{
            top: `${10 + Math.random() * 40}%`,
            left: `${Math.random() * 60}%`,
            animationDelay: `${i * 4 + Math.random() * 3}s`,
            animationDuration: `${1.5 + Math.random() * 1}s`,
          }}
        />
      ))}
      {/* Rings */}
      <div className="login-bg__ring login-bg__ring--1" />
      <div className="login-bg__ring login-bg__ring--2" />
      <div className="login-bg__ring login-bg__ring--3" />
      <div className="login-bg__ring login-bg__ring--4" />
      {/* Orbiting dots */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className={`login-bg__dot login-bg__dot--${i}`} />
      ))}
      {/* Scanline */}
      <div className="login-bg__scanline" />
      {/* Grid */}
      <div className="login-bg__grid" />
    </div>
  );
}

/* ── Hero (Left) ── */
function HeroSection() {
  const [cardIndex, setCardIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCardIndex((prev) => (prev + 1) % FEATURE_CARDS.length);
    }, 12000);
    return () => clearInterval(interval);
  }, []);

  const card = FEATURE_CARDS[cardIndex];
  const CardIcon = card.icon;

  return (
    <div className="login-hero">
      {/* Logo glow */}
      <div className="login-hero__glow" />
      <div className="login-hero__glow login-hero__glow--2" />

      <div className="login-hero__content">
        <motion.img
          src="/resouce/ISP-Consulte-v3-branco.png"
          alt="ISP Consulte"
          className="login-hero__logo"
          initial={{ opacity: 0, scale: 0.7, filter: "blur(12px)" }}
          animate={{
            opacity: 1,
            scale: [1, 1.03, 1],
            filter: "blur(0px)",
          }}
          transition={{
            opacity: { duration: 0.8 },
            filter: { duration: 0.8 },
            scale: { duration: 5, repeat: Infinity, ease: "easeInOut" },
          }}
        />

        {/* Feature card */}
        <div className="login-hero__card-area">
          <AnimatePresence mode="wait">
            <motion.div
              key={cardIndex}
              className="login-hero__fcard"
              initial={{ opacity: 0, y: 40, scale: 0.85, filter: "blur(10px)", rotateX: 12 }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)", rotateX: 0 }}
              exit={{ opacity: 0, y: -24, scale: 0.92, filter: "blur(6px)", rotateX: -6 }}
              transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.div
                className="login-hero__fcard-icon"
                animate={{
                  y: [0, -4, 0],
                  rotate: [0, -3, 3, 0],
                  scale: [1, 1.06, 1],
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <CardIcon size={21} strokeWidth={1.8} />
              </motion.div>
              <div className="login-hero__fcard-text">
                <motion.p
                  className="login-hero__fcard-title"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15, duration: 0.4 }}
                >
                  {card.title}
                </motion.p>
                <motion.p
                  className="login-hero__fcard-desc"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25, duration: 0.4 }}
                >
                  {card.desc}
                </motion.p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ── Login Page ── */
export default function LoginPage() {
  usePageSEO("/login");
  const navigate = useNavigate();
  const { login } = useAuth();
  const isMobile = useIsMobile();
  const [rememberMe, setRememberMe] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showForgotModal, setShowForgotModal] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setError("Informe um e-mail válido.");
      return;
    }
    if (!password || password.length < 4) {
      setError("A senha deve ter pelo menos 4 caracteres.");
      return;
    }
    setSubmitting(true);
    const result = await login({ email, password });
    setSubmitting(false);
    if (result.success) {
      navigate("/");
    } else {
      setError(result.message || "Credenciais inválidas.");
    }
  };

  return (
    <div className="login-page">
      <div className="login-page__background" aria-hidden="true">
        <AnimatedBackground />
        <div className="login-page__background-overlay" />
      </div>

      <div className="login-page__foreground">
        <HeroSection />

        <div className="login-form-panel">
          <div className="login-form-panel__inner">
            <motion.div
              className="login-heading"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.4 }}
            >
              <h1 className="login-heading__title">Bem-vindo de volta</h1>
              <p className="login-heading__subtitle">
                Entre com suas credenciais para acessar o painel.
              </p>
            </motion.div>

            {error && (
              <motion.div
                className="login-error"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                {error}
              </motion.div>
            )}

            <motion.form
              className="login-form"
              onSubmit={handleSubmit}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.4 }}
            >
              <div className="login-field">
                <label htmlFor="email">E-mail</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                />
              </div>

              <div className="login-field">
                <label htmlFor="password">Senha</label>
                <div className="login-password-wrap">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="login-eye-btn"
                    onClick={() => setShowPassword((p) => !p)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="login-remember">
                <label className="login-remember-label">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="login-remember-checkbox"
                  />
                  <span>Lembrar credenciais</span>
                </label>
              </div>

              <button type="submit" disabled={submitting} className="login-submit-btn">
                {submitting ? (
                  <span className="login-spinner" />
                ) : (
                  <LogIn size={17} />
                )}
                <span>Entrar</span>
                {!submitting && <ArrowRight size={15} className="login-submit-arrow" />}
              </button>
            </motion.form>

            <motion.p
              className="login-forgot"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <button
                type="button"
                className="login-forgot-link"
                onClick={() => setShowForgotModal(true)}
              >
                Esqueci minha senha
              </button>
            </motion.p>

            {/* Forgot password modal */}
            <AnimatePresence>
              {showForgotModal && (
                <motion.div
                  className="fixed inset-0 z-[200] flex items-center justify-center p-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={() => setShowForgotModal(false)}
                  />
                  <motion.div
                    className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[hsl(233_36%_12%/0.97)] p-6 shadow-2xl backdrop-blur-xl"
                    initial={{ scale: 0.92, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.92, opacity: 0, y: 20 }}
                    transition={{ type: "spring", damping: 22, stiffness: 300 }}
                  >
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="absolute right-3 top-3 rounded-lg p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white/70"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <div className="flex flex-col items-center text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 ring-1 ring-amber-400/20">
                        <ShieldAlert className="h-6 w-6 text-amber-400" />
                      </div>
                      <h3 className="mt-4 text-lg font-bold text-white">Recuperação de acesso</h3>
                      <p className="mt-2 text-sm leading-relaxed text-white/50">
                        Para recuperar o acesso, entre em contato com seu <strong className="text-white/70">gerente</strong> ou <strong className="text-white/70">consultor responsável</strong>.
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowForgotModal(false)}
                        className="mt-5 w-full rounded-xl bg-white/[0.07] px-4 py-2.5 text-sm font-semibold text-white/70 transition hover:bg-white/[0.12] hover:text-white"
                      >
                        Entendi
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Global footer */}
      <footer className="login-footer login-footer--global">
        <p>
          © {new Date().getFullYear()}{" "}
          <span className="login-footer__brand">ISP Consulte</span>. Todos os
          direitos reservados.
        </p>
      </footer>
    </div>
  );
}
