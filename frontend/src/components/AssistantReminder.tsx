import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, FileText, AlertTriangle } from "lucide-react";
import assistantAvatar from "@/assets/assistant-avatar.png";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import type { AccessArea } from "@/modules/auth/hooks/useAuth";
import WeeklyReportModal from "@/components/WeeklyReportModal";
import type { TaskView } from "@/modules/tasks/types";
import { type TaskStatusKey } from "@/modules/tasks/utils";
import type { StatusAlert } from "@/hooks/useTaskStatusAlerts";
import { storage } from "@/modules/shared/storage";

/* ─── Messages by role category ─── */

type MessageItem = {
  text: string;
  cta: string;
  link: string;
  isReport?: boolean;
  isAlert?: boolean;
  requiredArea?: AccessArea;
};

const STAFF_MESSAGES: MessageItem[] = [
  { text: "Lembre-se de revisar suas tarefas e, se precisar de ajuda, acione nossa equipe! Juntos, somos mais fortes! 💪", cta: "Ver Tarefas", link: "/tarefas", requiredArea: "tarefas" },
  { text: "Que tal dar uma olhada nas suas analíticas? Acompanhar os números ajuda a tomar decisões mais inteligentes! 📊", cta: "Ver Analíticas", link: "/analiticas", requiredArea: "analiticas" },
  { text: "Você sabia que pode exportar relatórios em PDF? Mantenha sua equipe informada com dados atualizados! 📄", cta: "Ver Ferramentas", link: "/ferramentas", requiredArea: "ferramentas" },
  { text: "Confira o ranking de produtividade! Veja quem está se destacando e motive a equipe! 🏆", cta: "Ver Ranking", link: "/gamificacao", requiredArea: "gamificacao" },
  { text: "Mantenha suas tarefas em dia! Tarefas organizadas = menos estresse e mais resultados. 🎯", cta: "Ver Tarefas", link: "/tarefas", requiredArea: "tarefas" },
  { text: "Verifique os prazos das tarefas da sua equipe. Antecipar atrasos é a chave para entregas de qualidade! ⏰", cta: "Ver Tarefas", link: "/tarefas", requiredArea: "tarefas" },
  { text: "Já verificou as integrações hoje? Manter tudo conectado garante que nada fique para trás! 🔗", cta: "Ver Integrações", link: "/integracoes", requiredArea: "integracoes" },
  { text: "Acompanhe as horas alocadas nos projetos. Entender o investimento de tempo é essencial para o planejamento! ⏱️", cta: "Ver Analíticas", link: "/analiticas", requiredArea: "analiticas" },
  { text: "Dica: use o calendário para ter uma visão geral dos prazos da semana. Organização faz toda a diferença! 📅", cta: "Ver Calendário", link: "/calendario", requiredArea: "calendario" },
  { text: "Precisa de ajuda? Nossa equipe de suporte está sempre pronta para auxiliar você! 🤝", cta: "Abrir Suporte", link: "/suporte", requiredArea: "suporte" },
  { text: "Bora tirar um relatório semanal? Veja o progresso de todos os projetos em um só lugar! 📋", cta: "Gerar Relatório", link: "__weekly_report__", isReport: true, requiredArea: "tarefas" },
];

const CLIENT_MESSAGES: MessageItem[] = [
  { text: "O sistema evolui em parceria! Compartilhe suas sugestões de melhorias ou relate problemas ao seu consultor. Juntos somos mais fortes! 🤝", cta: "Falar com Suporte", link: "/suporte", requiredArea: "suporte" },
  { text: "Acompanhe o progresso das suas tarefas em tempo real! Tudo atualizado automaticamente para sua comodidade. ✅", cta: "Ver Tarefas", link: "/tarefas", requiredArea: "tarefas" },
  { text: "Sua opinião é muito importante para nós! Conte ao seu consultor como podemos melhorar ainda mais. 💡", cta: "Falar com Suporte", link: "/suporte", requiredArea: "suporte" },
  { text: "Estamos sempre trabalhando para entregar o melhor resultado. Confira as últimas atualizações! 🚀", cta: "Ver Tarefas", link: "/tarefas", requiredArea: "tarefas" },
  { text: "Ficou com dúvida? Fale com nosso suporte — estamos aqui para ajudar você a alcançar os melhores resultados! 💬", cta: "Falar com Suporte", link: "/suporte", requiredArea: "suporte" },
  { text: "Transparência é nosso compromisso! Acompanhe cada etapa do seu projeto diretamente no painel. 🔍", cta: "Ver Tarefas", link: "/tarefas", requiredArea: "tarefas" },
  { text: "Obrigado por confiar na ISP Consulte! Seu sucesso é o nosso sucesso. Estamos juntos nessa jornada! 🌟", cta: "Ver Tarefas", link: "/tarefas", requiredArea: "tarefas" },
];

type NotifTask = {
  title?: string;
  project?: string;
  statusKey?: string;
  deadlineDate?: Date | null;
  deadlineIsSoon?: boolean;
  consultant?: string;
};

const INTERVAL_MS = 5 * 60 * 1000;
const AUTO_DISMISS_MS = 15_000; // 15 seconds — enough to read, not too long
const DISMISS_KEY = "assistant-reminder-dismissed";

type Props = {
  notifTasks?: NotifTask[];
  statusAlert?: StatusAlert | null;
  onDismissAlert?: () => void;
};

export default function AssistantReminder({ notifTasks, statusAlert, onDismissAlert }: Props) {
  const { session, canAccess } = useAuth();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [messageIdx, setMessageIdx] = useState(0);
  const [showReport, setShowReport] = useState(false);
  const [activeAlert, setActiveAlert] = useState<MessageItem | null>(null);

  const role = session?.role;
  const isClient = role === "cliente";

  const messages = useMemo(() => {
    const pool = isClient ? CLIENT_MESSAGES : STAFF_MESSAGES;
    return pool.filter((msg) => !msg.requiredArea || canAccess(msg.requiredArea));
  }, [isClient, canAccess]);

  const reportTasks = useMemo<TaskView[]>(() => {
    if (!notifTasks) return [];
    return notifTasks.map((t) => ({
      title: t.title || "Tarefa",
      description: "",
      project: t.project || "Sem projeto",
      consultant: t.consultant || "",
      statusKey: (t.statusKey || "unknown") as TaskStatusKey,
      durationLabel: "",
      deadlineDate: t.deadlineDate || null,
      deadlineLabel: "",
      deadlineColor: "",
      deadlineIsSoon: t.deadlineIsSoon || false,
      raw: {} as any,
    }));
  }, [notifTasks]);

  // When a statusAlert arrives, immediately show it via the assistant
  useEffect(() => {
    if (statusAlert && statusAlert.count > 0) {
      const isAdminRole = role === "admin" || role === "gerente" || role === "coordenador";
      setActiveAlert({
        text: statusAlert.message,
        cta: "Ver Tarefas",
        link: isAdminRole
          ? "/tarefas?notifSource=assistant&notifPeriod=all&notifStatus=overdue"
          : "/tarefas?notifSource=assistant&notifScope=mine&notifPeriod=all&notifStatus=overdue",
        isAlert: true,
      });
      setVisible(true);
    }
  }, [statusAlert]);

  const show = useCallback(() => {
    if (messages.length === 0) return;
    const lastDismissed = storage.get<string | null>(DISMISS_KEY, null);
    if (lastDismissed) {
      const elapsed = Date.now() - Number(lastDismissed);
      if (elapsed < INTERVAL_MS) return;
    }
    setActiveAlert(null); // clear any alert, show regular message
    setMessageIdx(Math.floor(Math.random() * messages.length));
    setVisible(true);
  }, [messages.length]);

  const dismiss = useCallback(() => {
    setVisible(false);
    setActiveAlert(null);
    onDismissAlert?.();
    storage.set(DISMISS_KEY, String(Date.now()));
  }, [onDismissAlert]);

  const handleCta = useCallback(
    (msg: MessageItem) => {
      dismiss();
      if (msg.isReport) {
        setShowReport(true);
      } else {
        navigate(msg.link);
      }
    },
    [dismiss, navigate]
  );

  // Show/hide cycle
  useEffect(() => {
    const initialTimer = setTimeout(show, 30_000);
    const interval = setInterval(show, INTERVAL_MS);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [show]);

  // Auto-dismiss after AUTO_DISMISS_MS
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [visible, dismiss]);

  if (!session || messages.length === 0) return null;

  const currentMsg = activeAlert || messages[messageIdx % messages.length];
  if (!currentMsg) return null;
  const label = activeAlert ? "ISP Alerta" : isClient ? "ISP Parceiro" : "ISP Assistente";

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="fixed bottom-6 left-4 right-4 z-50 sm:left-6 sm:right-auto sm:w-[340px]"
          >
            <div
              className="relative overflow-hidden rounded-2xl border shadow-2xl"
              style={{
                borderColor: activeAlert ? "hsl(30 90% 50% / 0.15)" : "hsl(0 0% 100% / 0.08)",
                background: activeAlert
                  ? "linear-gradient(145deg, hsl(30 50% 14%), hsl(10 45% 10%))"
                  : "linear-gradient(145deg, hsl(262 50% 16%), hsl(234 45% 10%))",
                boxShadow: activeAlert
                  ? "0 20px 50px -12px hsl(30 83% 30% / 0.5)"
                  : "0 20px 50px -12px hsl(262 83% 20% / 0.5)",
              }}
            >
              <div
                className="h-[2px] w-full opacity-60"
                style={{
                  background: activeAlert
                    ? "linear-gradient(to right, hsl(30 90% 50%), hsl(45 90% 55%), transparent)"
                    : "linear-gradient(to right, hsl(var(--primary)), hsl(262 83% 58%), transparent)",
                }}
              />

              <button
                onClick={dismiss}
                className="absolute top-3 right-3 rounded-lg p-1 text-white/20 transition hover:bg-white/[0.06] hover:text-white/50"
              >
                <X className="h-3.5 w-3.5" />
              </button>

              <div className="flex gap-3 p-4">
                <div className="shrink-0">
                  <div
                    className="h-12 w-12 rounded-full border-2 overflow-hidden flex items-center justify-center"
                    style={{
                      borderColor: activeAlert ? "hsl(30 90% 50% / 0.4)" : "hsl(262 83% 58% / 0.4)",
                      background: activeAlert
                        ? "linear-gradient(135deg, hsl(30 90% 50% / 0.3), hsl(10 89% 50% / 0.2))"
                        : "linear-gradient(135deg, hsl(262 83% 58% / 0.3), hsl(234 89% 64% / 0.2))",
                    }}
                  >
                    {activeAlert ? (
                      <AlertTriangle className="h-6 w-6 text-amber-400" />
                    ) : (
                      <img
                        src={assistantAvatar}
                        alt="Assistente"
                        className="h-10 w-10 rounded-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          e.currentTarget.parentElement!.innerHTML = '<span style="font-size:24px">🤖</span>';
                        }}
                      />
                    )}
                  </div>
                  <div className="relative -mt-3 ml-8">
                    <div
                      className="h-3.5 w-3.5 rounded-full border-2"
                      style={{
                        backgroundColor: activeAlert ? "hsl(30 90% 50%)" : "hsl(142 76% 36%)",
                        borderColor: activeAlert ? "hsl(10 45% 10%)" : "hsl(234 45% 10%)",
                      }}
                    />
                  </div>
                </div>

                <div className="flex-1 min-w-0 pt-0.5">
                  <p
                    className="text-[11px] font-bold uppercase tracking-wider mb-1"
                    style={{ color: activeAlert ? "hsl(30 90% 60% / 0.8)" : "hsl(var(--primary) / 0.7)" }}
                  >
                    {label}
                  </p>
                  <p className="text-[13px] leading-relaxed text-white/75 whitespace-pre-line">
                    {currentMsg.text}
                  </p>

                  <button
                    type="button"
                    onClick={() => handleCta(currentMsg)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold text-white/90 transition hover:bg-white/[0.08]"
                    style={{
                      background: activeAlert
                        ? "linear-gradient(135deg, hsl(30 90% 50% / 0.2), hsl(45 90% 55% / 0.15))"
                        : "linear-gradient(135deg, hsl(262 83% 58% / 0.2), hsl(234 89% 64% / 0.15))",
                      border: activeAlert
                        ? "1px solid hsl(30 90% 50% / 0.2)"
                        : "1px solid hsl(262 83% 58% / 0.2)",
                    }}
                  >
                    {currentMsg.isReport ? <FileText className="h-3 w-3" /> : null}
                    {currentMsg.cta}
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>

              <motion.div
                className="h-[2px]"
                style={{ backgroundColor: activeAlert ? "hsl(30 90% 50% / 0.4)" : "hsl(var(--primary) / 0.4)" }}
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: AUTO_DISMISS_MS / 1000, ease: "linear" }}
              />

              <motion.div
                className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full opacity-[0.04]"
                style={{
                  background: activeAlert
                    ? "radial-gradient(circle, hsl(30 90% 50%), transparent)"
                    : "radial-gradient(circle, hsl(262 83% 58%), transparent)",
                }}
                animate={{ scale: [1, 1.3, 1], opacity: [0.04, 0.08, 0.04] }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <WeeklyReportModal
        open={showReport}
        onClose={() => setShowReport(false)}
        tasks={reportTasks}
        userName={session.name}
      />
    </>
  );
}
