import { motion } from "framer-motion";
import {
  UserRound,
  Briefcase,
  Crown,
  Target,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { BonusConsultantCard } from "@/modules/sprint6/hooks/useBonusRealData";
import { money } from "./BonusHelpers";
import { staggerContainer, staggerItem } from "./BonusAnimations";

/* ── Role config ──────────────────────────────────────────────────── */
type GapStatus = "connected" | "partial" | "pending";

interface CategoryIndicator {
  label: string;
  meta: string;
  status: GapStatus;
  source: string;
  reason: string;
}

interface RoleCategoryData {
  role: string;
  maxBonus: string;
  icon: typeof UserRound;
  iconColor: string;
  indicators: CategoryIndicator[];
}

const LEVEL_TO_ROLE: Record<string, string> = {
  junior: "Consultor Júnior",
  pleno: "Consultor Pleno",
  senior: "Consultor Sênior",
};

const ROLE_COLORS: Record<string, { border: string; bg: string; accent: string; badge: string }> = {
  "Consultor Júnior": { border: "border-teal-500/15", bg: "bg-teal-500/[0.04]", accent: "text-teal-400", badge: "border-teal-500/20 bg-teal-500/10 text-teal-300" },
  "Consultor Pleno": { border: "border-blue-500/15", bg: "bg-blue-500/[0.04]", accent: "text-blue-400", badge: "border-blue-500/20 bg-blue-500/10 text-blue-300" },
  "Consultor Sênior": { border: "border-purple-500/15", bg: "bg-purple-500/[0.04]", accent: "text-purple-400", badge: "border-purple-500/20 bg-purple-500/10 text-purple-300" },
  "SDR / BDR": { border: "border-pink-500/15", bg: "bg-pink-500/[0.04]", accent: "text-pink-400", badge: "border-pink-500/20 bg-pink-500/10 text-pink-300" },
  CRO: { border: "border-emerald-500/15", bg: "bg-emerald-500/[0.04]", accent: "text-emerald-400", badge: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" },
};

const DEFAULT_ROLE_COLORS = { border: "border-border/15", bg: "bg-card/30", accent: "text-muted-foreground", badge: "border-border/15 bg-card/30 text-muted-foreground" };

/* ── Helpers ───────────────────────────────────────────────────────── */
function statusIcon(status: GapStatus) {
  if (status === "connected") return CheckCircle2;
  if (status === "partial") return AlertCircle;
  return XCircle;
}
function statusColor(status: GapStatus) {
  if (status === "connected") return "text-emerald-400";
  if (status === "partial") return "text-amber-400";
  return "text-red-400";
}

/* ── Category Card ─────────────────────────────────────────────────── */
function CategoryCard({
  category,
  consultants,
}: {
  category: RoleCategoryData;
  consultants: BonusConsultantCard[];
}) {
  const colors = ROLE_COLORS[category.role] ?? DEFAULT_ROLE_COLORS;
  const RoleIcon = category.icon;

  const connected = category.indicators.filter((i) => i.status === "connected").length;
  const partial = category.indicators.filter((i) => i.status === "partial").length;
  const total = category.indicators.length;
  const progressPct = total > 0 ? Math.round(((connected + partial * 0.5) / total) * 100) : 0;

  // Role-matched consultants
  const roleName = category.role;
  const matchedConsultants = consultants.filter((c) => LEVEL_TO_ROLE[c.level] === roleName);
  const avgScore = matchedConsultants.length > 0
    ? Math.round(matchedConsultants.reduce((s, c) => s + c.score, 0) / matchedConsultants.length)
    : null;
  const totalPayout = matchedConsultants.reduce((s, c) => s + c.payout, 0);

  return (
    <div className={`rounded-2xl border ${colors.border} ${colors.bg} overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3.5 border-b border-border/8">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${colors.bg} border ${colors.border}`}>
            <RoleIcon className={`h-4.5 w-4.5 ${colors.accent}`} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">{category.role}</p>
            <p className="text-xs text-muted-foreground">Teto: {category.maxBonus}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {matchedConsultants.length > 0 && (
            <Badge variant="outline" className={`text-[11px] ${colors.badge}`}>
              {matchedConsultants.length} consultor{matchedConsultants.length > 1 ? "es" : ""}
            </Badge>
          )}
        </div>
      </div>

      {/* Progress + stats */}
      <div className="px-4 py-3 space-y-3">
        {/* Coverage bar */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground">Cobertura de indicadores</p>
            <span className="text-xs font-bold text-foreground">{connected}/{total} implementados</span>
          </div>
          <div className="h-2 w-full rounded-full bg-card/40 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="h-full rounded-full bg-primary/60"
            />
          </div>
        </div>

        {/* Score/payout summary for matched consultants */}
        {matchedConsultants.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-border/8 bg-card/20 p-2.5 text-center">
              <p className="text-lg font-bold text-foreground">{avgScore}%</p>
              <p className="text-[10px] text-muted-foreground">Score médio</p>
            </div>
            <div className="rounded-xl border border-primary/12 bg-primary/[0.05] p-2.5 text-center">
              <p className="text-lg font-bold text-primary">{money(totalPayout)}</p>
              <p className="text-[10px] text-muted-foreground">Payout total</p>
            </div>
          </div>
        )}

        {/* Indicators list */}
        <div className="space-y-1">
          {category.indicators.map((ind) => {
            const StatusIcon = statusIcon(ind.status);
            return (
              <div key={ind.label} className="flex items-center gap-2 py-1">
                <StatusIcon className={`h-3 w-3 shrink-0 ${statusColor(ind.status)}`} />
                <span className="text-xs text-foreground flex-1 min-w-0 truncate">{ind.label}</span>
                <span className="text-[10px] text-muted-foreground/60 shrink-0">{ind.meta}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Main Section ──────────────────────────────────────────────────── */
interface BonusCategoriesSectionProps {
  gapData: RoleCategoryData[];
  consultants: BonusConsultantCard[];
}

export function BonusCategoriesSection({ gapData, consultants }: BonusCategoriesSectionProps) {
  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
      {gapData.map((category) => (
        <motion.div key={category.role} variants={staggerItem}>
          <CategoryCard category={category} consultants={consultants} />
        </motion.div>
      ))}
    </motion.div>
  );
}
