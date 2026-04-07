import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { analyzeIntegrity, type TaskIntegrityInfo } from "./pdfIntegrity";
import OptionsStep from "./PDFOptionsStep";
import VerificationStep from "./PDFVerificationStep";
import { useScrollLock } from "@/hooks/useScrollLock";

export type PDFExportSelection = {
  includeDone: boolean;
  includePending: boolean;
  includeOverdue: boolean;
  includeResponsible: boolean;
  includeDeadline: boolean;
  includeDuration: boolean;
};

export type { TaskIntegrityInfo } from "./pdfIntegrity";

type IncompleteAction = "include" | "exclude" | "only-incomplete";

type Props = {
  onClose: () => void;
  onExport: (selection: PDFExportSelection, incompleteAction?: IncompleteAction) => Promise<void>;
  title?: string;
  taskIntegrityData?: TaskIntegrityInfo[];
};

export default function ExportPDFModal({ onClose, onExport, title = "Exportar PDF", taskIntegrityData = [] }: Props) {
  const [selection, setSelection] = useState<PDFExportSelection>({
    includeDone: true,
    includePending: true,
    includeOverdue: true,
    includeResponsible: true,
    includeDeadline: true,
    includeDuration: false,
  });
  const [exporting, setExporting] = useState(false);
  const [step, setStep] = useState<"options" | "verification">("options");

  useScrollLock(true);

  const toggle = useCallback(
    (key: keyof PDFExportSelection) => setSelection((prev) => ({ ...prev, [key]: !prev[key] })),
    []
  );

  const integrity = useMemo(
    () => analyzeIntegrity(taskIntegrityData, selection),
    [taskIntegrityData, selection]
  );

  const hasIncomplete = integrity.incompleteCount > 0;

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleNext = useCallback(() => {
    if (hasIncomplete) {
      setStep("verification");
    } else {
      handleExport("include");
    }
  }, [hasIncomplete]);

  const handleExport = useCallback(async (action: IncompleteAction) => {
    setExporting(true);
    try {
      await onExport(selection, action);
    } finally {
      setExporting(false);
      onClose();
    }
  }, [selection, onExport, onClose]);

  const anyStatusSelected = selection.includeDone || selection.includePending || selection.includeOverdue;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.93, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.93, y: 16 }}
          transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-white/[0.08] shadow-2xl scrollbar-thin scrollbar-thumb-white/10"
          style={{
            background: "linear-gradient(145deg, hsl(270 50% 13%), hsl(234 45% 8%))",
            boxShadow: "0 32px 64px -16px hsl(262 83% 20% / 0.55), 0 0 0 1px hsl(262 83% 58% / 0.08)",
          }}
        >
          {/* Top accent */}
          <div className="h-[2px] w-full bg-gradient-to-r from-emerald-500 via-[hsl(262_83%_58%)] to-transparent opacity-60" />

          <AnimatePresence mode="wait">
            {step === "options" ? (
              <OptionsStep
                key="options"
                title={title}
                selection={selection}
                toggle={toggle}
                anyStatusSelected={anyStatusSelected}
                hasIncomplete={hasIncomplete}
                incompleteCount={integrity.incompleteCount}
                totalCount={integrity.total}
                durationSelected={selection.includeDuration}
                exporting={exporting}
                onClose={onClose}
                onNext={handleNext}
              />
            ) : (
              <VerificationStep
                key="verification"
                integrity={integrity}
                durationSelected={selection.includeDuration}
                exporting={exporting}
                onBack={() => setStep("options")}
                onExport={handleExport}
              />
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
