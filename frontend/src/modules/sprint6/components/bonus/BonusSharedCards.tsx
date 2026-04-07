import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Eye,
  Wallet,
  Radar,
  Star,
  Clock,
} from "lucide-react";
import type { BonusConsultantCard } from "@/modules/sprint6/hooks/useBonusRealData";
import { isUnavailableValue, money } from "./BonusHelpers";

/* ── Section Card ──────────────────────────────────────────────────── */
export function SectionCard({
  title,
  icon: Icon,
  children,
  badge,
  compact = false,
}: {
  title: string;
  icon: typeof Radar;
  children: React.ReactNode;
  badge?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/12 bg-card/40 backdrop-blur-sm overflow-hidden h-full">
      <div className="flex items-center justify-between gap-2 border-b border-border/8 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-3.5 w-3.5 text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        {badge}
      </div>
      <div className={compact ? "p-3.5 sm:p-4" : "p-4 sm:p-5"}>{children}</div>
    </div>
  );
}

/* ── Hero KPI ──────────────────────────────────────────────────────── */
const heroKpiColors = {
  primary: { icon: "text-primary", iconBg: "bg-primary/15", border: "border-primary/20", bg: "bg-primary/[0.06]", value: "text-primary" },
  blue: { icon: "text-blue-400", iconBg: "bg-blue-500/15", border: "border-blue-500/15", bg: "bg-blue-500/[0.04]", value: "text-foreground" },
  emerald: { icon: "text-emerald-400", iconBg: "bg-emerald-500/15", border: "border-emerald-500/15", bg: "bg-emerald-500/[0.04]", value: "text-foreground" },
  amber: { icon: "text-amber-400", iconBg: "bg-amber-500/15", border: "border-amber-500/15", bg: "bg-amber-500/[0.04]", value: "text-foreground" },
  red: { icon: "text-red-400", iconBg: "bg-red-500/15", border: "border-red-500/15", bg: "bg-red-500/[0.04]", value: "text-foreground" },
  cyan: { icon: "text-cyan-400", iconBg: "bg-cyan-500/15", border: "border-cyan-500/15", bg: "bg-cyan-500/[0.04]", value: "text-foreground" },
  gray: { icon: "text-muted-foreground/40", iconBg: "bg-muted/20", border: "border-border/10", bg: "bg-muted/5", value: "text-muted-foreground/50" },
};

export function HeroKpi({
  icon: Icon,
  label,
  value,
  color = "primary",
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  color?: keyof typeof heroKpiColors;
}) {
  const c = heroKpiColors[color];
  return (
    <div className={`rounded-lg sm:rounded-xl border p-2.5 sm:p-3 md:p-3.5 backdrop-blur-sm ${c.border} ${c.bg}`}>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className={`flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-md sm:rounded-lg ${c.iconBg}`}>
          <Icon className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${c.icon}`} />
        </div>
        <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">{label}</p>
      </div>
      <p className={`mt-1 sm:mt-2 text-base sm:text-xl font-bold leading-tight md:text-2xl ${c.value}`}>{value}</p>
    </div>
  );
}

/* ── Metric Tile ───────────────────────────────────────────────────── */
export function MetricTile({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: typeof Star;
  color: "emerald" | "amber" | "red" | "blue" | "purple" | "gray";
}) {
  const colors = {
    emerald: { icon: "text-emerald-400", bg: "bg-emerald-500/10" },
    amber: { icon: "text-amber-400", bg: "bg-amber-500/10" },
    red: { icon: "text-red-400", bg: "bg-red-500/10" },
    blue: { icon: "text-blue-400", bg: "bg-blue-500/10" },
    purple: { icon: "text-purple-400", bg: "bg-purple-500/10" },
    gray: { icon: "text-muted-foreground/40", bg: "bg-muted/10" },
  };
  const c = colors[color];
  const noData = isUnavailableValue(value);

  return (
    <div className="rounded-xl border border-border/10 bg-card/25 p-3.5">
      <div className="flex items-center gap-2">
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${c.bg}`}>
          <Icon className={`h-3.5 w-3.5 ${c.icon}`} />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>
      <p className={`mt-2 ${noData ? "text-sm text-muted-foreground/50 italic" : "text-xl font-bold text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

/* ── Insight Row ───────────────────────────────────────────────────── */
export function InsightRow({
  name,
  score,
  payout,
  icon: Icon,
  color,
  hideMonetary = false,
}: {
  name: string;
  score: number;
  payout: number;
  icon: typeof TrendingUp;
  color: "emerald" | "red";
  hideMonetary?: boolean;
}) {
  const isGood = color === "emerald";
  const colorCls = isGood
    ? { icon: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/10" }
    : { icon: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/10" };

  return (
    <div className={`flex items-center justify-between gap-3 rounded-xl border ${colorCls.border} bg-card/20 p-3`}>
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${colorCls.bg}`}>
          <Icon className={`h-4 w-4 ${colorCls.icon}`} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{name}</p>
          <p className="text-xs text-muted-foreground">{score}%</p>
        </div>
      </div>
      {!hideMonetary && <p className="shrink-0 text-sm font-bold text-foreground">{money(payout)}</p>}
    </div>
  );
}

export function EmptyInsight({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border/8 bg-card/20 p-6 text-center">
      <Eye className="h-5 w-5 text-muted-foreground/30" />
      <p className="mt-2 text-xs text-muted-foreground/60">{text}</p>
    </div>
  );
}

/* ── Score Distribution ────────────────────────────────────────────── */
export function ScoreDistribution({ consultants }: { consultants: BonusConsultantCard[] }) {
  const high = consultants.filter((c) => c.score >= 80).length;
  const mid = consultants.filter((c) => c.score >= 60 && c.score < 80).length;
  const low = consultants.filter((c) => c.score < 60).length;
  const total = consultants.length || 1;

  const bars = [
    { label: "Alto (≥80%)", count: high, pct: (high / total) * 100, color: "bg-emerald-500", text: "text-emerald-400", icon: TrendingUp, delay: 0 },
    { label: "Médio (60-79%)", count: mid, pct: (mid / total) * 100, color: "bg-amber-500", text: "text-amber-400", icon: Target, delay: 0.1 },
    { label: "Baixo (<60%)", count: low, pct: (low / total) * 100, color: "bg-red-500", text: "text-red-400", icon: TrendingDown, delay: 0.2 },
  ];

  return (
    <div className="space-y-4">
      {bars.map((bar) => {
        const BarIcon = bar.icon;
        return (
          <div key={bar.label}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <BarIcon className={`h-3.5 w-3.5 ${bar.text}`} />
                <p className="text-xs text-muted-foreground">{bar.label}</p>
              </div>
              <p className={`text-sm font-bold ${bar.text}`}>{bar.count}</p>
            </div>
            <div className="h-2.5 w-full rounded-full bg-card/40 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(bar.pct, bar.count > 0 ? 8 : 0)}%` }}
                transition={{ duration: 0.6, ease: "easeOut", delay: bar.delay }}
                className={`h-full rounded-full ${bar.color}/60`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Financial Tile ────────────────────────────────────────────────── */
export function FinancialTile({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: "blue" | "orange" | "emerald" | "red" | "purple";
}) {
  const colorMap = {
    blue: "border-blue-500/15 bg-blue-500/[0.06]",
    orange: "border-orange-500/15 bg-orange-500/[0.06]",
    emerald: "border-emerald-500/15 bg-emerald-500/[0.06]",
    red: "border-red-500/15 bg-red-500/[0.06]",
    purple: "border-purple-500/15 bg-purple-500/[0.06]",
  };

  return (
    <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground/60">{sub}</p>
    </div>
  );
}

/* ── Score Weight ──────────────────────────────────────────────────── */
export function ScoreWeight({ label, weight }: { label: string; weight: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-2 flex-1 rounded-full bg-card/40 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${weight}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="h-full rounded-full bg-primary/50"
        />
      </div>
      <p className="shrink-0 text-xs text-muted-foreground">
        <strong className="text-foreground">{weight}%</strong> {label}
      </p>
    </div>
  );
}

/* ── Micro Badge ───────────────────────────────────────────────────── */
export function MicroBadge({ label, color }: { label: string; color: "blue" | "emerald" | "red" | "amber" | "gray" }) {
  const colorMap = {
    blue: "border-blue-500/15 bg-blue-500/10 text-blue-300",
    emerald: "border-emerald-500/15 bg-emerald-500/10 text-emerald-300",
    red: "border-red-500/15 bg-red-500/10 text-red-300",
    amber: "border-amber-500/15 bg-amber-500/10 text-amber-300",
    gray: "border-border/15 bg-muted/10 text-muted-foreground",
  };

  return (
    <span className={`inline-flex rounded-lg border px-2 py-0.5 text-[11px] font-medium ${colorMap[color]}`}>
      {label}
    </span>
  );
}

/* ── Detail Tile (used in expanded ranking card) ───────────────────── */
export function DetailTile({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Clock }) {
  const noData = isUnavailableValue(value);
  return (
    <div className="rounded-xl border border-border/8 bg-card/20 p-3">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground/50" />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>
      <p className={`mt-1.5 text-sm ${noData ? "italic text-muted-foreground/60" : "font-bold text-foreground"}`}>{value}</p>
    </div>
  );
}
