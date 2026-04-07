import { motion } from "framer-motion";
import {
  FileDown, CheckCircle2, AlertTriangle, Clock, X,
  FileWarning, ChevronRight,
} from "lucide-react";
import type { PDFExportSelection } from "./ExportPDFModal";
import React from "react";

type Option = {
  key: keyof PDFExportSelection;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  borderColor: string;
};

const OPTIONS: Option[] = [
  {
    key: "includeDone",
    label: "Tarefas Concluídas",
    description: "Inclui tarefas com status concluído",
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: "text-emerald-400",
    borderColor: "border-emerald-500/25 bg-emerald-500/[0.07]",
  },
  {
    key: "includePending",
    label: "Tarefas em Andamento",
    description: "Inclui tarefas que ainda estão em progresso",
    icon: <FileDown className="h-4 w-4" />,
    color: "text-[hsl(262_83%_68%)]",
    borderColor: "border-[hsl(262_83%_58%/0.25)] bg-[hsl(262_83%_58%/0.07)]",
  },
  {
    key: "includeOverdue",
    label: "Tarefas Atrasadas",
    description: "Inclui tarefas que passaram do prazo",
    icon: <AlertTriangle className="h-4 w-4" />,
    color: "text-red-400",
    borderColor: "border-red-500/25 bg-red-500/[0.07]",
  },
  {
    key: "includeResponsible",
    label: "Coluna Responsável",
    description: "Exibe o nome do consultor responsável",
    icon: <FileDown className="h-4 w-4" />,
    color: "text-amber-400",
    borderColor: "border-amber-500/25 bg-amber-500/[0.07]",
  },
  {
    key: "includeDeadline",
    label: "Coluna Prazo",
    description: "Exibe a data limite de cada tarefa",
    icon: <Clock className="h-4 w-4" />,
    color: "text-blue-400",
    borderColor: "border-blue-500/25 bg-blue-500/[0.07]",
  },
  {
    key: "includeDuration",
    label: "Coluna Duração",
    description: "Exibe o tempo registrado em cada tarefa",
    icon: <Clock className="h-4 w-4" />,
    color: "text-white/60",
    borderColor: "border-white/[0.08] bg-white/[0.04]",
  },
];

type OptionsStepProps = {
  title: string;
  selection: PDFExportSelection;
  toggle: (key: keyof PDFExportSelection) => void;
  anyStatusSelected: boolean;
  hasIncomplete: boolean;
  incompleteCount: number;
  totalCount: number;
  durationSelected: boolean;
  exporting: boolean;
  onClose: () => void;
  onNext: () => void;
};

export default function OptionsStep({
  title, selection, toggle, anyStatusSelected, hasIncomplete, incompleteCount, totalCount,
  durationSelected, exporting, onClose, onNext,
}: OptionsStepProps) {
  return (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.18 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/[0.12] border border-emerald-500/20">
            <FileDown className="h-4.5 w-4.5 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white/90">{title}</p>
            <p className="text-[11px] text-white/40">Selecione o que incluir no relatório</p>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Fechar modal"
          className="rounded-lg p-1.5 text-white/25 transition hover:bg-white/[0.05] hover:text-white/60"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Options */}
      <div className="px-6 pb-2 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-3">Conteúdo do relatório</p>
        {OPTIONS.map((opt) => {
          const active = selection[opt.key];
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => toggle(opt.key)}
              aria-pressed={active}
              className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                active ? opt.borderColor : "border-white/[0.05] bg-white/[0.02] opacity-50"
              }`}
            >
              <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all ${
                active ? "border-transparent bg-gradient-to-br from-[hsl(262_83%_58%)] to-[hsl(234_89%_64%)]" : "border-white/20 bg-white/[0.03]"
              }`}>
                {active && <span className="h-1.5 w-1.5 rounded-sm bg-white" />}
              </span>
              <span className={`shrink-0 ${active ? opt.color : "text-white/25"}`}>{opt.icon}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold transition-colors ${active ? "text-white/85" : "text-white/35"}`}>{opt.label}</p>
                <p className="text-[10px] text-white/30 mt-0.5">{opt.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Duration info */}
      {!durationSelected && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-6 mt-2 flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/[0.06] px-4 py-2.5 text-[11px] text-blue-300/80">
          <Clock className="h-3.5 w-3.5 shrink-0 text-blue-400" />
          A coluna de duração não será incluída no PDF. Ative-a acima se necessário.
        </motion.div>
      )}

      {/* Incomplete data preview */}
      {hasIncomplete && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mx-6 mt-2 flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-4 py-2.5 text-[11px] text-amber-300/80">
          <FileWarning className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          <span>{incompleteCount} de {totalCount} tarefas possuem dados incompletos. Você poderá revisar na próxima etapa.</span>
        </motion.div>
      )}

      {/* No status warning */}
      {!anyStatusSelected && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mx-6 mt-2 flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-4 py-2.5 text-xs text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Selecione ao menos um tipo de tarefa para exportar.
        </motion.div>
      )}

      {/* Actions */}
      <div className="flex gap-2.5 px-6 py-4">
        <button onClick={onClose} className="flex-1 rounded-xl border border-white/[0.07] py-2.5 text-xs font-semibold text-white/35 transition hover:border-white/[0.12] hover:text-white/60">
          Cancelar
        </button>
        <button
          onClick={onNext}
          disabled={exporting || !anyStatusSelected}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-[hsl(262_83%_58%)] py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:opacity-90 disabled:opacity-40"
        >
          {hasIncomplete ? (
            <>
              Revisar Dados
              <ChevronRight className="h-3.5 w-3.5" />
            </>
          ) : exporting ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <>
              <FileDown className="h-3.5 w-3.5" />
              Gerar PDF
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}
