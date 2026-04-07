// ── Sprint 6.0 — Shared page header for test sub-pages ─────────────
import { BriefcaseBusiness } from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import type { LucideIcon } from "lucide-react";

interface Props {
  title: string;
  description: string;
  icon: LucideIcon;
  /** Extra actions on the right side of the header */
  actions?: React.ReactNode;
  badgeLabel?: string | null;
}

export function Sprint6PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  badgeLabel = "Sprint 6.0",
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col sm:flex-row items-start gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] shrink-0 backdrop-blur-sm">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground tracking-tight">{title}</h1>
              {badgeLabel ? (
                <Badge variant="outline" className="bg-primary/10 text-primary text-[10px]">
                  <BriefcaseBusiness className="h-3 w-3 mr-1" />
                  {badgeLabel}
                </Badge>
              ) : null}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{description}</p>
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>
    </motion.div>
  );
}
