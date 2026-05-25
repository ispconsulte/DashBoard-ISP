import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

interface CollapsibleSectionProps {
  title: string;
  icon: React.ElementType;
  summary?: string;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function CollapsibleSection({
  title,
  icon: Icon,
  summary,
  badge,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`rounded-2xl border bg-card/40 backdrop-blur-sm overflow-hidden transition-colors ${open ? "border-primary/20" : "border-border/12"}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3.5 sm:px-5 sm:py-4 text-left transition-colors hover:bg-white/[0.03] group"
      >
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-colors ${open ? "border-primary/25 bg-primary/15" : "border-primary/10 bg-primary/8"}`}>
          <Icon className={`h-4 w-4 transition-colors ${open ? "text-primary" : "text-primary/70"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={`text-sm font-semibold transition-colors ${open ? "text-foreground" : "text-foreground/80"}`}>{title}</h3>
            {badge}
          </div>
          {summary && !open && (
            <p className="text-[11px] text-muted-foreground/55 mt-0.5 truncate">{summary}</p>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-all duration-200 ${open ? "rotate-180 text-primary/60" : "text-muted-foreground/30"}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-primary/10 px-4 py-4 sm:px-5 sm:py-5">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
