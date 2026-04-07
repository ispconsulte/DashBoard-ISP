import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserRound,
  DollarSign,
  Info,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ShieldAlert,
  ChevronDown,
} from "lucide-react";
import { staggerContainer, staggerItem, fadeUp } from "./BonusAnimations";
import { SectionCard, ScoreWeight } from "./BonusSharedCards";
import { money } from "./BonusHelpers";

type GapStatus = "connected" | "partial" | "pending";

interface GapIndicator {
  label: string;
  meta: string;
  status: GapStatus;
  source: string;
  reason: string;
}

interface GapSectionData {
  role: string;
  maxBonus: string;
  icon: typeof UserRound;
  iconColor: string;
  indicators: GapIndicator[];
}

interface GapSummary {
  implemented: number;
  partial: number;
  blocked: number;
  total: number;
  progressed: number;
}

interface BonusReferenciaTabProps {
  gapData: GapSectionData[];
  gapSummary: GapSummary;
  commercialSnapshot: any;
}

/* ── Profile Card ──────────────────────────────────────────────────── */
function ProfileCoverageCard({ section }: { section: GapSectionData }) {
  const [open, setOpen] = useState(false);
  const connected = section.indicators.filter((i) => i.status === "connected").length;
  const partial = section.indicators.filter((i) => i.status === "partial").length;
  const total = section.indicators.length;
  const progressPct = total > 0 ? Math.round(((connected + partial * 0.5) / total) * 100) : 0;
  const SectionIcon = section.icon;

  const statusCfg = {
    connected: { icon: CheckCircle2, color: "text-emerald-400" },
    partial: { icon: AlertCircle, color: "text-amber-400" },
    pending: { icon: XCircle, color: "text-red-400/60" },
  } as const;

  return (
    <div className="rounded-xl border border-border/12 bg-card/35 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 p-3.5 text-left transition-colors hover:bg-card/50"
      >
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${section.iconColor.replace("text-", "bg-").replace(/\d00/, "500/10")}`}>
          <SectionIcon className={`h-4 w-4 ${section.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-foreground truncate">{section.role}</p>
            <span className="text-[10px] text-muted-foreground shrink-0">{section.maxBonus}</span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="h-1.5 flex-1 rounded-full bg-card/30 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary/60 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-[10px] font-medium text-muted-foreground shrink-0">{connected}/{total} OK</span>
          </div>
        </div>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/8 px-3.5 pb-3 pt-2 space-y-1">
              {section.indicators.map((ind) => {
                const cfg = statusCfg[ind.status];
                const StatusIcon = cfg.icon;
                return (
                  <div key={ind.label} className="flex items-center gap-2 py-1">
                    <StatusIcon className={`h-3 w-3 shrink-0 ${cfg.color}`} />
                    <span className="text-[11px] text-foreground flex-1 truncate">{ind.label}</span>
                    <span className="text-[10px] text-muted-foreground/60 shrink-0">{ind.meta}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function BonusReferenciaTab({ gapData, gapSummary, commercialSnapshot }: BonusReferenciaTabProps) {
  return (
    <div className="space-y-4">
      {/* CRO / Receita rules summary */}
      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid gap-4">
        <motion.div variants={staggerItem}>
          <SectionCard title="CRO / Receita" icon={DollarSign}>
            <div className="space-y-3">
              <div className="rounded-xl border border-border/10 bg-card/25 p-3">
                <p className="text-xs font-semibold text-foreground mb-2">Score RevOps</p>
                <div className="space-y-2">
                  <ScoreWeight label="Margem" weight={40} />
                  <ScoreWeight label="ROI positivo" weight={35} />
                  <ScoreWeight label="Carteira saudável" weight={25} />
                </div>
              </div>
              <div className="rounded-xl border border-border/10 bg-card/25 p-3">
                <p className="text-xs font-semibold text-foreground mb-1">Bônus Estratégico Anual</p>
                <p className="text-xs text-muted-foreground">MRR ≥ <strong className="text-foreground">R$300k</strong> + Margem ≥ <strong className="text-foreground">30%</strong> → <strong className="text-foreground">R$10.000</strong></p>
              </div>
              {commercialSnapshot && (
                <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] p-2.5">
                  <div className="flex items-start gap-2">
                    <Info className="h-3.5 w-3.5 shrink-0 text-amber-400 mt-0.5" />
                    <p className="text-[11px] text-amber-300/80">
                      {commercialSnapshot.source_provenance === "calculated"
                        ? "Snapshot gerencial com base financeira. CRM comercial não ingerido."
                        : "Snapshot comercial persistido. MRR/NRR ainda parciais."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        </motion.div>
      </motion.div>

      {/* Profile Coverage Cards */}
      <motion.div {...fadeUp} transition={{ duration: 0.35 }}>
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert className="h-4 w-4 shrink-0 text-orange-400" />
          <p className="text-xs font-semibold text-foreground">Cobertura por Perfil</p>
          <span className="text-[11px] text-muted-foreground ml-auto">{gapSummary.progressed}/{gapSummary.total} indicadores com base</span>
        </div>
      </motion.div>

      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {gapData.map((section) => (
          <motion.div key={section.role} variants={staggerItem}>
            <ProfileCoverageCard section={section} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
