import { motion } from "framer-motion";
import { Crown, Medal } from "lucide-react";
import type { BonusConsultantCard } from "@/modules/sprint6/hooks/useBonusRealData";
import { initials, money } from "./BonusHelpers";

export function Podium({ consultants, hideMonetary = false }: { consultants: BonusConsultantCard[]; hideMonetary?: boolean }) {
  const order = [1, 0, 2];

  if (!consultants.length) {
    return (
      <div className="rounded-xl border border-border/10 bg-card/25 p-8 text-center text-sm text-muted-foreground">
        Ainda não existe base suficiente para formar o ranking.
      </div>
    );
  }

  return (
    <div className="flex items-end justify-center gap-3 pt-4 sm:gap-5">
      {order.map((positionIndex) => {
        const consultant = consultants[positionIndex];
        if (!consultant) return <div key={positionIndex} className="w-24 sm:w-32" />;

        const isFirst = positionIndex === 0;
        const palette = isFirst
          ? {
              avatarBg: "bg-gradient-to-br from-amber-500/25 to-amber-600/10 border-amber-400/25",
              accent: "text-amber-300",
              barBg: "from-amber-500/15 to-amber-500/[0.03]",
              barBorder: "border-amber-500/20",
              glow: "shadow-[0_0_30px_rgba(245,158,11,0.12)]",
              icon: Crown,
            }
          : positionIndex === 1
          ? {
              avatarBg: "bg-gradient-to-br from-slate-400/20 to-slate-500/5 border-slate-400/20",
              accent: "text-slate-300",
              barBg: "from-slate-400/12 to-slate-400/[0.02]",
              barBorder: "border-slate-400/15",
              glow: "",
              icon: Medal,
            }
          : {
              avatarBg: "bg-gradient-to-br from-orange-500/20 to-orange-600/5 border-orange-400/18",
              accent: "text-orange-300",
              barBg: "from-orange-500/10 to-orange-500/[0.02]",
              barBorder: "border-orange-400/15",
              glow: "",
              icon: Medal,
            };

        const PodiumIcon = palette.icon;
        const height = isFirst ? 140 : positionIndex === 1 ? 110 : 90;

        return (
          <motion.div
            key={consultant.name}
            initial={{ opacity: 0, y: 35 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: positionIndex * 0.1 }}
            className="flex flex-col items-center"
          >
            <motion.div
              className={`mb-2 flex items-center justify-center rounded-full border text-sm font-bold text-white ${palette.avatarBg} ${isFirst ? "h-12 w-12" : "h-10 w-10"}`}
            >
              {initials(consultant.name)}
            </motion.div>
            <p className="max-w-[90px] truncate text-center text-xs font-semibold text-foreground sm:max-w-[120px] sm:text-sm">
              {consultant.name}
            </p>
            {!hideMonetary && <p className={`mt-0.5 text-xs font-bold ${palette.accent}`}>{money(consultant.payout)}</p>}
            <p className="text-[10px] text-muted-foreground">{consultant.score}%</p>
            <div
              className={`mt-2.5 flex w-20 flex-col items-center rounded-t-2xl border bg-gradient-to-b pt-3 sm:w-28 ${palette.barBg} ${palette.barBorder} ${palette.glow}`}
              style={{ height }}
            >
              <PodiumIcon className={`h-5 w-5 ${palette.accent}`} />
              <span className="mt-2 text-2xl font-black text-white/10">#{positionIndex + 1}</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
