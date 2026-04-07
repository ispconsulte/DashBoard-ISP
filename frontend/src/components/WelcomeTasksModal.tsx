import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowRight, AlarmClockCheck, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { storage } from "@/modules/shared/storage";

const STORAGE_PREFIX = "welcome-tasks-seen:";

export default function WelcomeTasksModal({ userEmail }: { userEmail: string }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!userEmail) return;
    const key = `${STORAGE_PREFIX}${userEmail}`;
    if (storage.get<string | null>(key, null)) return;
    const timer = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(timer);
  }, [userEmail]);

  const dismiss = () => {
    if (userEmail) storage.set(`${STORAGE_PREFIX}${userEmail}`, "1");
    setOpen(false);
  };

  const goToTasks = () => {
    dismiss();
    navigate("/tarefas?filterOverdue=true");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) dismiss(); }}>
      <DialogContent
        className={[
          "w-[92vw] max-w-[440px] p-0 overflow-hidden",
          "border border-white/[0.08]",
          "bg-[linear-gradient(165deg,hsl(228_33%_14%/0.98),hsl(233_36%_8%/0.99))]",
          "shadow-[0_30px_100px_hsl(240_60%_3%/0.75)]",
          "backdrop-blur-xl",
          "rounded-2xl sm:rounded-3xl",
          /* override DialogContent max-h so it never scrolls internally */
          "max-h-[95vh]",
        ].join(" ")}
      >
        <DialogTitle className="sr-only">Boas-vindas às tarefas</DialogTitle>

        {/* ── Decorative glows ── */}
        <motion.div
          className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[80%] -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: "radial-gradient(ellipse at center, hsl(var(--primary) / 0.28), hsl(190 100% 60% / 0.08) 50%, transparent 75%)" }}
          animate={{ opacity: [0.5, 0.85, 0.5], scale: [0.96, 1.04, 0.96] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="pointer-events-none absolute -right-10 top-6 h-28 w-28 rounded-full"
          style={{ background: "radial-gradient(circle, hsl(200 100% 70% / 0.1), transparent 68%)" }}
          animate={{ y: [0, -10, 0], opacity: [0.25, 0.55, 0.25] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="pointer-events-none absolute left-6 top-12"
          animate={{ y: [0, -5, 0], opacity: [0.12, 0.35, 0.12], rotate: [0, 12, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
        >
          <Sparkles className="h-3.5 w-3.5 text-cyan-300/50" />
        </motion.div>

        {/* Top/bottom border shine */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />

        {/* ── Content ── */}
        <div className="relative flex flex-col items-center px-5 py-8 text-center sm:px-8 sm:py-10">
          {/* Icon */}
          <motion.div
            initial={{ y: 12, opacity: 0, scale: 0.92 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.4, ease: "easeOut" }}
            className="flex h-16 w-16 items-center justify-center sm:h-20 sm:w-20"
          >
            <div className="relative flex items-center justify-center">
              <motion.div
                className="absolute h-12 w-12 rounded-full border border-cyan-300/25 sm:h-14 sm:w-14"
                animate={{ scale: [1, 1.3, 1], opacity: [0.15, 0.45, 0.15] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
              />
              <motion.div
                className="absolute h-14 w-14 rounded-full border border-primary/15 sm:h-16 sm:w-16"
                animate={{ scale: [0.92, 1.18, 0.92], opacity: [0.1, 0.3, 0.1] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut", delay: 0.25 }}
              />
              <motion.div
                className="absolute h-8 w-8 rounded-full bg-cyan-400/10 blur-md sm:h-9 sm:w-9"
                animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.3, 0.65, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                animate={{ rotate: [0, 10, -8, 6, -4, 0], scale: [1, 1.05, 1] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              >
                <AlarmClockCheck className="h-8 w-8 text-cyan-300 drop-shadow-[0_0_14px_hsl(190_100%_70%/0.5)] sm:h-9 sm:w-9" />
              </motion.div>
            </div>
          </motion.div>

          {/* Headline */}
          <motion.h2
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.18, duration: 0.38, ease: "easeOut" }}
            className="mt-4 max-w-[320px] text-[1.4rem] font-extrabold leading-tight tracking-tight sm:mt-5 sm:text-[1.75rem]"
          >
            <span className="bg-gradient-to-br from-white via-white/95 to-white/70 bg-clip-text text-transparent">
              Hora de organizar
            </span>
            <br />
            <span className="bg-gradient-to-r from-cyan-300 via-cyan-200 to-primary bg-clip-text text-transparent drop-shadow-[0_0_16px_hsl(190_100%_70%/0.25)]">
              o seu dia!
            </span>
          </motion.h2>

          {/* Body text */}
          <motion.p
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.28, duration: 0.38, ease: "easeOut" }}
            className="mt-4 max-w-[360px] rounded-xl border border-white/[0.06] bg-white/[0.035] px-5 py-4 text-[13px] leading-relaxed text-white/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:mt-5 sm:px-6 sm:py-5 sm:text-sm"
          >
            Confira suas pendências e priorize o que precisa da sua atenção hoje. Se precisar,{" "}
            <span className="font-semibold text-white/80">conte com seu time</span>.{" "}
            <span className="font-bold text-cyan-300/90">Juntos, crescemos mais fortes</span>.
          </motion.p>

          {/* Buttons */}
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.32, ease: "easeOut" }}
            className="mt-6 flex w-full max-w-xs flex-col gap-2.5 sm:mt-7 sm:flex-row sm:gap-3"
          >
            <Button
              size="lg"
              onClick={goToTasks}
              className="group relative h-12 flex-1 gap-2 overflow-hidden rounded-xl border border-white/10 bg-[linear-gradient(135deg,hsl(var(--primary)),hsl(248_80%_62%))] px-5 text-[13px] font-bold text-white shadow-[0_10px_32px_hsl(var(--primary)/0.3)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_44px_hsl(var(--primary)/0.45)] hover:brightness-110 sm:h-[50px] sm:text-sm"
            >
              <motion.div
                className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                initial={{ x: "-100%" }}
                animate={{ x: "200%" }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", repeatDelay: 2 }}
              />
              <span className="relative truncate">Ver minhas tarefas</span>
              <span className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15 transition-all group-hover:bg-white/25">
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
              </span>
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={dismiss}
              className="h-12 rounded-xl border border-white/10 bg-white/[0.04] px-5 text-[13px] font-semibold text-white/45 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.08] hover:text-white/70 sm:h-[50px] sm:w-[100px] sm:text-sm"
            >
              Depois
            </Button>
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
