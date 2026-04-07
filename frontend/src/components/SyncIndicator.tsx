import { RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  syncing: boolean;
};

export default function SyncIndicator({ syncing }: Props) {
  return (
    <AnimatePresence>
      {syncing && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="fixed top-3 right-3 z-50 flex items-center gap-2 rounded-full px-3.5 py-1.5 border border-white/10 shadow-xl backdrop-blur-xl"
          style={{
            background: "linear-gradient(135deg, hsl(262 83% 58% / 0.85), hsl(234 89% 64% / 0.85))",
          }}
        >
          <RefreshCw className="h-3.5 w-3.5 text-white animate-spin" />
          <span className="text-[11px] font-semibold text-white/90">Sincronizando…</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
