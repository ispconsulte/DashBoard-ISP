import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  /** Actions rendered on the right side */
  actions?: React.ReactNode;
}

/**
 * Unified premium header card used across all dashboard pages.
 * Matches the Analytics page header design: gradient card, animated icon, responsive layout.
 */
export default function PageHeaderCard({ icon: Icon, title, subtitle, actions }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="relative overflow-hidden rounded-2xl border border-white/[0.07]"
      style={{
        background:
          "linear-gradient(135deg, hsl(260 30% 11%) 0%, hsl(262 35% 15%) 40%, hsl(270 25% 12%) 100%)",
      }}
    >
      <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 p-4 sm:p-5 md:px-6 md:py-5">
        {/* Identity group */}
        <div className="flex items-center gap-3.5 flex-1 min-w-0">
          <motion.div
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] shrink-0 backdrop-blur-sm shadow-lg shadow-black/30"
            style={{
              background: "linear-gradient(145deg, hsl(262 60% 25% / 0.5), hsl(262 40% 18% / 0.4))",
            }}
            animate={{
              boxShadow: [
                "0 0 12px 0px hsl(262 83% 58% / 0.1)",
                "0 0 20px 2px hsl(262 83% 58% / 0.2)",
                "0 0 12px 0px hsl(262 83% 58% / 0.1)",
              ],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <motion.div
              animate={{ rotate: [0, -8, 8, -4, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", repeatDelay: 2 }}
            >
              <Icon className="h-5 w-5 text-primary" />
            </motion.div>
          </motion.div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground tracking-tight leading-tight">
              {title}
            </h1>
            <p className="mt-0.5 text-xs sm:text-sm text-white/35 line-clamp-2">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Actions group */}
        {actions && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {actions}
          </div>
        )}
      </div>
    </motion.div>
  );
}
