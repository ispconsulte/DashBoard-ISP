import { motion } from "framer-motion";
import {
  CheckCircle2, AlertTriangle, Clock, Users, Calendar,
  ShieldAlert, FileWarning, Filter,
} from "lucide-react";
import type { IntegrityResult } from "./pdfIntegrity";
import React from "react";

type IncompleteAction = "include" | "exclude" | "only-incomplete";

type VerificationStepProps = {
  integrity: IntegrityResult;
  durationSelected: boolean;
  exporting: boolean;
  onBack: () => void;
  onExport: (action: IncompleteAction) => void;
};

export default function VerificationStep({
  integrity, durationSelected, exporting, onBack, onExport,
}: VerificationStepProps) {
  const issues: { label: string; count: number; icon: React.ReactNode }[] = [];
  if (integrity.noTitle > 0) issues.push({ label: "tarefas sem título", count: integrity.noTitle, icon: <FileWarning className="h-3.5 w-3.5" /> });
  if (integrity.noProject > 0) issues.push({ label: "tarefas sem projeto", count: integrity.noProject, icon: <FileWarning className="h-3.5 w-3.5" /> });
  if (integrity.noConsultant > 0) issues.push({ label: "tarefas sem responsável", count: integrity.noConsultant, icon: <Users className="h-3.5 w-3.5" /> });
  if (integrity.noDeadline > 0) issues.push({ label: "tarefas sem prazo", count: integrity.noDeadline, icon: <Calendar className="h-3.5 w-3.5" /> });
  if (integrity.noDuration > 0) issues.push({ label: "tarefas sem duração registrada", count: integrity.noDuration, icon: <Clock className="h-3.5 w-3.5" /> });

  const completeCount = integrity.total - integrity.incompleteCount;

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.18 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/[0.12] border border-amber-500/20">
            <ShieldAlert className="h-4.5 w-4.5 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white/90">Verificação de Dados</p>
            <p className="text-[11px] text-white/40">Revise antes de gerar o relatório</p>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="px-6 pb-3">
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
          <div className="flex items-start gap-3 mb-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-300">
                {integrity.incompleteCount} {integrity.incompleteCount === 1 ? "tarefa possui" : "tarefas possuem"} dados incompletos
              </p>
              <p className="text-[11px] text-white/40 mt-1">
                Relatórios com campos em branco podem parecer incompletos ao cliente. Escolha como deseja proceder.
              </p>
            </div>
          </div>

          {/* Issue list */}
          <div className="space-y-1.5 mt-3">
            {issues.map((issue, idx) => (
              <div key={idx} className="flex items-center gap-2 text-[11px]">
                <span className="text-amber-400/70">{issue.icon}</span>
                <span className="text-white/60">
                  <span className="font-bold text-amber-300">{issue.count}</span> {issue.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Duration note */}
        {durationSelected && integrity.noDuration > 0 && (
          <div className="mt-2 rounded-xl border border-blue-500/15 bg-blue-500/[0.05] px-4 py-2.5 text-[11px] text-blue-300/70 flex items-start gap-2">
            <Clock className="h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-400" />
            <span>
              A coluna de duração aparece vazia quando o registro de horas ainda não foi implementado para essas tarefas. Considere desativar essa coluna se não for relevante.
            </span>
          </div>
        )}

        {/* Stats */}
        <div className="mt-3 flex gap-2">
          <div className="flex-1 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3 text-center">
            <p className="text-lg font-bold text-emerald-400">{completeCount}</p>
            <p className="text-[10px] text-white/40">Completas</p>
          </div>
          <div className="flex-1 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3 text-center">
            <p className="text-lg font-bold text-amber-400">{integrity.incompleteCount}</p>
            <p className="text-[10px] text-white/40">Incompletas</p>
          </div>
          <div className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-center">
            <p className="text-lg font-bold text-white/70">{integrity.total}</p>
            <p className="text-[10px] text-white/40">Total</p>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-6 pb-4 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-2">Como deseja proceder?</p>

        <button
          onClick={() => onExport("exclude")}
          disabled={exporting || completeCount === 0}
          className="flex w-full items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] px-4 py-3 text-left transition hover:bg-emerald-500/[0.14] disabled:opacity-40"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-300">Gerar apenas com tarefas completas</p>
            <p className="text-[10px] text-white/35 mt-0.5">{completeCount} tarefas serão incluídas no relatório</p>
          </div>
          {exporting && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-300/30 border-t-emerald-300" />}
        </button>

        <button
          onClick={() => onExport("include")}
          disabled={exporting}
          className="flex w-full items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-left transition hover:bg-amber-500/[0.12] disabled:opacity-40"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-300">Gerar com todas as tarefas</p>
            <p className="text-[10px] text-white/35 mt-0.5">Inclui as {integrity.incompleteCount} tarefas com dados incompletos</p>
          </div>
        </button>

        <button
          onClick={() => onExport("only-incomplete")}
          disabled={exporting}
          className="flex w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-left transition hover:bg-white/[0.06] disabled:opacity-40"
        >
          <Filter className="h-4 w-4 shrink-0 text-white/50" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white/60">Gerar apenas com tarefas incompletas</p>
            <p className="text-[10px] text-white/35 mt-0.5">Para revisão interna — {integrity.incompleteCount} tarefas</p>
          </div>
        </button>

        <button onClick={onBack} className="w-full rounded-xl border border-white/[0.07] py-2.5 text-xs font-semibold text-white/35 transition hover:border-white/[0.12] hover:text-white/60 mt-1">
          ← Voltar às opções
        </button>
      </div>
    </motion.div>
  );
}
