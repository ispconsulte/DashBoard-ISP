import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

type Variant = "tarefas" | "analiticas" | "usuarios" | "default";

interface PageSkeletonProps {
  variant?: Variant;
}

/** Skeleton placeholders shown while page data loads — prevents blank flash */
export default function PageSkeleton({ variant = "default" }: PageSkeletonProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="w-full space-y-5 p-5 md:p-8 max-w-[1900px] mx-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32 bg-white/[0.04]" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-24 bg-white/[0.04]" />
          <Skeleton className="h-9 w-24 rounded-xl bg-white/[0.04]" />
        </div>
      </div>

      {/* Filter bar */}
      <Skeleton className="h-12 w-full rounded-xl bg-white/[0.04]" />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl bg-white/[0.04]" />
        ))}
      </div>

      {/* Main content area */}
      {variant === "tarefas" && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-2xl bg-white/[0.04]" />
            ))}
          </div>
          <Skeleton className="h-[400px] rounded-2xl bg-white/[0.04]" />
        </>
      )}

      {variant === "analiticas" && (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <Skeleton className="h-72 rounded-2xl bg-white/[0.04]" />
            <Skeleton className="h-72 rounded-2xl bg-white/[0.04]" />
          </div>
          <Skeleton className="h-48 rounded-2xl bg-white/[0.04]" />
        </>
      )}

      {variant === "usuarios" && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl bg-white/[0.04]" />
          ))}
        </div>
      )}

      {variant === "default" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64 rounded-2xl bg-white/[0.04]" />
          <Skeleton className="h-64 rounded-2xl bg-white/[0.04]" />
        </div>
      )}
    </motion.div>
  );
}
