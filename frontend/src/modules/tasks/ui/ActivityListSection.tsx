import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, X } from "lucide-react";

interface ActivityListSectionProps {
  total: number;
  children: ReactNode;
  summary?: ReactNode;
}

export function ActivityListSection({ total, children, summary }: ActivityListSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAbout, setShowAbout] = useState(false);
  const countText = total === 1 ? "1 tarefa encontrada" : `${total} tarefas encontradas`;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.45 }}
      className="relative rounded-2xl border border-[hsl(var(--task-border))] bg-[hsl(var(--task-surface)/0.32)] p-3 shadow-sm sm:p-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1 text-left transition hover:bg-[hsl(var(--task-surface-hover)/0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--task-yellow)/0.5)]"
          aria-expanded={isExpanded}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[hsl(var(--task-border))] bg-[hsl(var(--task-bg)/0.5)] text-[hsl(var(--task-text-muted))]">
            <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-0" : "-rotate-90"}`} />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-bold text-[hsl(var(--task-text))]">Lista de Atividades</span>
            <span className="block text-xs font-normal text-[hsl(var(--task-text-muted))]">{countText}</span>
          </span>
        </button>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {summary && <div className="text-[11px] text-[hsl(var(--task-text-muted)/0.75)]">{summary}</div>}
          <button
            type="button"
            onClick={() => setShowAbout(true)}
            className="rounded-lg border border-[hsl(var(--task-border))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--task-text))] transition hover:border-[hsl(var(--task-yellow)/0.45)] hover:bg-[hsl(var(--task-yellow)/0.08)]"
          >
            Sobre
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showAbout && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="absolute inset-x-3 top-20 z-20 overflow-hidden rounded-2xl border border-[hsl(var(--task-border))] bg-[hsl(var(--task-bg)/0.98)] backdrop-blur-sm sm:inset-x-4 sm:top-16"
          >
            <div className="flex items-center justify-between border-b border-[hsl(var(--task-border)/0.55)] px-4 py-3">
              <h4 className="text-sm font-bold text-[hsl(var(--task-text))] sm:text-base">Como esta lista é organizada</h4>
              <button
                type="button"
                onClick={() => setShowAbout(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[hsl(var(--task-text-muted))] transition hover:bg-[hsl(var(--task-surface-hover))] hover:text-[hsl(var(--task-text))]"
                aria-label="Fechar informações sobre a lista"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 px-4 py-3 text-xs leading-relaxed text-[hsl(var(--task-text-muted))] sm:text-[13px]">
              <p>
                A <strong className="text-[hsl(var(--task-text))]">Lista de Atividades</strong> prioriza tarefas mais críticas no topo.
              </p>
              <ul className="list-disc space-y-1 pl-4 marker:text-[hsl(var(--task-yellow))]">
                <li><strong className="text-rose-400">Atrasadas</strong> aparecem primeiro.</li>
                <li>Depois vêm tarefas em andamento com prazo mais próximo.</li>
                <li>Tarefas concluídas ficam ao final da ordenação.</li>
              </ul>
              <p>Os filtros (prazo, responsável, projeto e período) refinam a lista antes da ordenação final.</p>
              <p>
                Se uma atividade com horas registradas não aparecer aqui imediatamente, o sistema pode ainda estar atualizando os dados. Clique em atualizar e confira novamente. Verifique também se a atividade possui projeto/organização, responsável, data/prazo e horas registradas. Se após algumas horas ela ainda não aparecer, envie o nome ou ID da tarefa, junto com a data, para o time de desenvolvimento verificar.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="mt-3 overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
