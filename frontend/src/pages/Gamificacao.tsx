import { useMemo } from "react";
import PageHeaderCard from "@/components/PageHeaderCard";
import { motion } from "framer-motion";
import { Trophy, Medal, Flame, Target, Zap, Star, TrendingUp, Award, Crown } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useTasks } from "@/modules/tasks/api/useTasks";
import { useSharedTasks } from "@/contexts/SharedTasksContext";
import { parseDateValue } from "@/modules/tasks/utils";
import { usePageSEO } from "@/hooks/usePageSEO";

function getTaskStatusKey(t: Record<string, any>): string {
  const statusRaw = String(t.status ?? t.situacao ?? "").toLowerCase();
  const isDone = ["5", "done", "concluido", "concluído", "completed", "finalizado"].includes(statusRaw);
  if (isDone) return "done";
  const deadline = parseDateValue(t.deadline) ?? parseDateValue(t.due_date) ?? parseDateValue(t.dueDate);
  if (deadline && deadline < new Date()) return "overdue";
  return "pending";
}

/** Returns true if the task was finished on or before the deadline (same day counts) */
function wasFinishedOnTime(t: Record<string, any>): boolean {
  const statusRaw = String(t.status ?? t.situacao ?? "").toLowerCase();
  const isDone = ["5", "done", "concluido", "concluído", "completed", "finalizado"].includes(statusRaw);
  if (!isDone) return false;

  const deadline = parseDateValue(t.deadline) ?? parseDateValue(t.due_date) ?? parseDateValue(t.dueDate);
  if (!deadline) return true; // sem prazo = considera no prazo

  // Closed date pode indicar quando foi concluída
  const closedRaw = t.closed_date ?? t.closedDate ?? t.data_conclusao ?? null;
  const closedDate = closedRaw ? parseDateValue(String(closedRaw)) : null;

  const checkDate = closedDate ?? new Date();

  // Normaliza para comparar apenas a data (sem hora)
  const deadlineDay = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
  const closedDay = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate());

  return closedDay <= deadlineDay;
}

type ConsultantScore = {
  name: string;
  done: number;
  onTime: number;
  overdue: number;
  total: number;
  points: number;
  streak: number;
  level: number;
  badges: string[];
};

const BADGE_DEFS: Record<string, { icon: React.ElementType; label: string; color: string; description: string }> = {
  speed: { icon: Zap, label: "Velocista", color: "hsl(38 92% 50%)", description: "10+ tarefas no prazo" },
  master: { icon: Star, label: "Mestre", color: "hsl(280 70% 55%)", description: "50+ tarefas concluídas" },
  fire: { icon: Flame, label: "Em Chamas", color: "hsl(0 84% 60%)", description: "Streak de 5+" },
  target: { icon: Target, label: "Pontaria", color: "hsl(160 84% 39%)", description: "90%+ no prazo" },
  rising: { icon: TrendingUp, label: "Ascendente", color: "hsl(234 89% 64%)", description: "20+ tarefas" },
};

const LEVEL_NAMES = ["Bronze", "Prata", "Ouro", "Platina", "Diamante"];
const LEVEL_COLORS = ["hsl(30 50% 50%)", "hsl(0 0% 70%)", "hsl(45 90% 55%)", "hsl(200 50% 70%)", "hsl(234 89% 64%)"];

function getLevel(points: number) {
  if (points >= 500) return 4;
  if (points >= 300) return 3;
  if (points >= 150) return 2;
  if (points >= 50) return 1;
  return 0;
}

function getLevelProgress(points: number) {
  const thresholds = [0, 50, 150, 300, 500];
  const level = getLevel(points);
  if (level >= 4) return 100;
  const current = points - thresholds[level];
  const needed = thresholds[level + 1] - thresholds[level];
  return Math.min(100, Math.round((current / needed) * 100));
}

/** Animated floating trophy — reduced glow intensity */
function TrophyAnimation() {
  return (
    <motion.div
      className="relative flex items-center justify-center"
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.2, type: "spring", stiffness: 120, damping: 10 }}
    >
      {/* Outer glow ring — softer */}
      <motion.div
        className="absolute rounded-full"
        style={{ width: 120, height: 120, background: "radial-gradient(circle, hsl(45 90% 55% / 0.08), transparent 70%)" }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.15, 0.4] }}
        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
      />
      {/* Floating trophy */}
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
        className="relative z-10"
      >
        <motion.div
          className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/15 to-yellow-600/8 border border-amber-400/15 backdrop-blur-sm"
          animate={{ rotate: [0, 2, -2, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
        >
          <Trophy className="h-8 w-8 text-amber-400" />
        </motion.div>
        {/* Sparkle particles — fewer, softer */}
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute h-1 w-1 rounded-full bg-amber-400/60"
            style={{
              top: `${25 + Math.sin(i * 2) * 25}%`,
              left: `${25 + Math.cos(i * 2) * 30}%`,
            }}
            animate={{
              scale: [0, 1, 0],
              opacity: [0, 0.6, 0],
              y: [0, -8, -16],
            }}
            transition={{
              repeat: Infinity,
              duration: 2.5,
              delay: i * 0.6,
              ease: "easeOut",
            }}
          />
        ))}
      </motion.div>
    </motion.div>
  );
}

export default function Gamificacao() {
  usePageSEO("/gamificacao");
  const { session } = useAuth();
  // Reuse shared 180d tasks and filter to 90d client-side
  const shared = useSharedTasks();
  const ownTasks = useTasks({ accessToken: session?.accessToken, period: "90d", skip: !!shared });
  const allTasks = shared ? shared.tasks : ownTasks.tasks;
  const tasks = useMemo(() => {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    return allTasks.filter((t) => {
      const inserted = t.inserted_at ? new Date(String(t.inserted_at)) : null;
      return !inserted || inserted >= cutoff;
    });
  }, [allTasks]);

  const ranking = useMemo<ConsultantScore[]>(() => {
    const byConsultant = new Map<string, { done: number; onTime: number; overdue: number; total: number }>();

    tasks.forEach((t) => {
      const name = String(t.responsible_name ?? t.consultant ?? t.owner ?? t.responsavel ?? "Desconhecido").trim();
      if (!name || name === "Desconhecido") return;
      if (!byConsultant.has(name)) byConsultant.set(name, { done: 0, onTime: 0, overdue: 0, total: 0 });
      const entry = byConsultant.get(name)!;
      const status = getTaskStatusKey(t);
      entry.total++;
      if (status === "done") {
        entry.done++;
        // Conta no prazo apenas se concluída até o dia do vencimento (inclusive)
        if (wasFinishedOnTime(t)) entry.onTime++;
      } else if (status === "overdue") {
        entry.overdue++;
      }
    });

    return Array.from(byConsultant.entries())
      .map(([name, s]) => {
        const points = s.done * 10 + s.onTime * 5 - s.overdue * 3;
        const streak = Math.min(s.done, 10);
        const badges: string[] = [];
        if (s.onTime >= 10) badges.push("speed");
        if (s.done >= 50) badges.push("master");
        if (streak >= 5) badges.push("fire");
        if (s.total > 0 && s.onTime / s.total >= 0.9) badges.push("target");
        if (s.total >= 20) badges.push("rising");
        return { name, ...s, points: Math.max(0, points), streak, level: getLevel(Math.max(0, points)), badges };
      })
      .sort((a, b) => b.points - a.points);
  }, [tasks]);

  const topThree = ranking.slice(0, 3);
  const pageBackground = {
    background: [
      "radial-gradient(circle at top left, hsl(234 89% 64% / 0.13), transparent 24%)",
      "radial-gradient(circle at top center, hsl(45 90% 55% / 0.08), transparent 18%)",
      "radial-gradient(circle at bottom right, hsl(160 84% 39% / 0.07), transparent 22%)",
      "linear-gradient(180deg, hsl(222 47% 5%) 0%, hsl(228 42% 6%) 38%, hsl(222 47% 5%) 100%)",
    ].join(", "),
  } as const;
  const glassPanelStyle = {
    border: "1px solid hsl(234 89% 64% / 0.08)",
    background:
      "linear-gradient(180deg, hsl(222 40% 8% / 0.78), hsl(222 40% 8% / 0.42))",
  } as const;
  const rankingVisibleRowsHeight = "calc(6 * 6rem + 5 * 0.625rem)";

  return (
    <div className="w-full min-h-[calc(100vh-3.5rem)]" style={pageBackground}>
      <div className="mx-auto w-full max-w-[1900px] space-y-5 p-4 sm:p-5 md:p-8">
        <PageHeaderCard
          icon={Trophy}
          title="Ranking de Produtividade"
          subtitle="Últimos 90 dias com foco em entregas no prazo, consistência operacional e evolução dos consultores."
          actions={
            <>
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 min-w-[150px]">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Consultores</p>
                <p className="mt-1 text-xl font-bold text-foreground">{ranking.length}</p>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 min-w-[190px]">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Lider</p>
                <p className="mt-1 truncate text-sm font-semibold text-amber-300">{ranking[0]?.name ?? "Sem dados"}</p>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 min-w-[150px]">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Top Score</p>
                <p className="mt-1 text-xl font-bold text-primary">{ranking[0]?.points ?? 0} pts</p>
              </div>
            </>
          }
        />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.12fr)_minmax(360px,0.88fr)] xl:items-stretch">
          <div className="min-w-0">

            {topThree.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="rounded-[28px] p-5 sm:p-6 lg:p-7 backdrop-blur-xl xl:h-[calc(100%_-_0px)] flex flex-col"
                style={glassPanelStyle}
              >
                <div className="mb-6 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-foreground sm:text-lg">Pódio do período</h2>
                    <p className="mt-1 text-xs text-white/40 sm:text-sm">Distribuição destacada para preencher melhor a área principal em telas largas.</p>
                  </div>
                  <Trophy className="hidden h-5 w-5 text-amber-400 sm:block" />
                </div>

                <div className="flex items-end justify-start gap-3 overflow-x-auto px-1 pb-1 pt-2 sm:justify-center sm:gap-5 lg:gap-8">
                  {[1, 0, 2].map((podiumIdx) => {
                    const person = topThree[podiumIdx];
                    if (!person) return <div key={podiumIdx} className="w-24 sm:w-36 lg:w-44" />;
                    const isFirst = podiumIdx === 0;

                    const podiumHeights = [176, 144, 118];

                    const medalConfigs = [
                      {
                        avatarGradient: "linear-gradient(135deg, hsl(45 90% 55%), hsl(38 92% 40%))",
                        avatarSize: "h-16 w-16 lg:h-20 lg:w-20",
                        barBg: "linear-gradient(180deg, hsl(45 90% 55% / 0.16), hsl(45 90% 55% / 0.04))",
                        barBorder: "1px solid hsl(45 90% 55% / 0.25)",
                        medalEl: <Crown key="g" className="h-7 w-7 lg:h-8 lg:w-8" style={{ color: "hsl(45 90% 55%)" }} />,
                        rankColor: "hsl(45 90% 55%)",
                        glow: "0 0 24px hsl(45 90% 55% / 0.18)",
                      },
                      {
                        avatarGradient: "linear-gradient(135deg, hsl(0 0% 80%), hsl(0 0% 55%))",
                        avatarSize: "h-12 w-12 lg:h-16 lg:w-16",
                        barBg: "linear-gradient(180deg, hsl(0 0% 70% / 0.12), hsl(0 0% 70% / 0.03))",
                        barBorder: "1px solid hsl(0 0% 70% / 0.20)",
                        medalEl: <Medal key="s" className="h-6 w-6 lg:h-7 lg:w-7" style={{ color: "hsl(0 0% 75%)" }} />,
                        rankColor: "hsl(0 0% 75%)",
                        glow: "0 0 18px hsl(0 0% 70% / 0.12)",
                      },
                      {
                        avatarGradient: "linear-gradient(135deg, hsl(25 70% 55%), hsl(20 65% 38%))",
                        avatarSize: "h-12 w-12 lg:h-16 lg:w-16",
                        barBg: "linear-gradient(180deg, hsl(25 70% 45% / 0.12), hsl(25 70% 45% / 0.03))",
                        barBorder: "1px solid hsl(25 70% 45% / 0.20)",
                        medalEl: <Medal key="b" className="h-5 w-5 lg:h-6 lg:w-6" style={{ color: "hsl(25 70% 55%)" }} />,
                        rankColor: "hsl(25 70% 55%)",
                        glow: "0 0 18px hsl(25 70% 45% / 0.12)",
                      },
                    ];

                    const mc = medalConfigs[podiumIdx];

                    return (
                      <motion.div
                        key={podiumIdx}
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.35 + podiumIdx * 0.14, type: "spring", stiffness: 100 }}
                        className="flex min-w-[108px] flex-col items-center sm:min-w-[136px] lg:min-w-[172px]"
                      >
                        {isFirst && (
                          <motion.div
                            animate={{ y: [0, -3, 0] }}
                            transition={{ repeat: Infinity, duration: 3 }}
                            className="mb-1"
                          >
                            <Crown className="h-5 w-5 text-amber-400" />
                          </motion.div>
                        )}
                        <div
                          className={`mb-2 flex items-center justify-center rounded-full ${mc.avatarSize} text-sm font-bold text-white`}
                          style={{
                            background: mc.avatarGradient,
                            boxShadow: mc.glow,
                          }}
                        >
                          {person.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                        </div>
                        <p className="max-w-[100px] truncate text-center text-xs font-bold text-foreground sm:max-w-[120px] sm:text-sm lg:max-w-[150px]">
                          {person.name}
                        </p>
                        <p className="text-xs font-semibold sm:text-sm" style={{ color: mc.rankColor }}>{person.points} pts</p>
                        <motion.div
                          className="mt-3 flex w-24 flex-col items-center justify-start rounded-t-2xl pt-4 sm:w-32 lg:w-40"
                          style={{
                            height: podiumHeights[podiumIdx],
                            background: mc.barBg,
                            border: mc.barBorder,
                            boxShadow: mc.glow,
                          }}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.6 + podiumIdx * 0.12, duration: 0.5 }}
                        >
                          {mc.medalEl}
                          <span className="mt-2 text-2xl font-black lg:text-3xl" style={{ color: `${mc.rankColor.replace(")", " / 0.2)")}` }}>
                            #{podiumIdx + 1}
                          </span>
                        </motion.div>
                      </motion.div>
                    );
                  })}
                </div>

                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-6 border-t border-white/[0.06] pt-5">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Award className="h-4 w-4 text-primary" />
                  Conquistas Disponíveis
                  </h3>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 2xl:grid-cols-3">
                    {Object.entries(BADGE_DEFS).map(([key, def], i) => (
                      <motion.div
                        key={key}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.6 + i * 0.06 }}
                        whileHover={{ scale: 1.02 }}
                        className="flex items-center gap-3 rounded-2xl p-3.5 cursor-default"
                        style={{
                          border: "1px solid hsl(234 89% 64% / 0.06)",
                          background: "hsl(222 40% 8% / 0.34)",
                        }}
                      >
                        <def.icon className="h-5 w-5 shrink-0" style={{ color: def.color }} />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground">{def.label}</p>
                          <p className="text-[11px] text-muted-foreground">{def.description}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="min-w-0">
            <div className="rounded-[28px] p-5 sm:p-6 backdrop-blur-xl xl:sticky xl:top-5" style={glassPanelStyle}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground sm:text-base">Ranking Completo</h3>
                  <p className="mt-1 text-xs text-white/40">Leitura mais distribuída para desktop, sem comprimir o conteúdo no centro da tela.</p>
                </div>
                <Badge variant="outline" className="shrink-0 border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-white/55">
                  {ranking.length} consultores
                </Badge>
              </div>
              {/* Scrollable ranking list — max 6 visible items */}
              <div
                className="space-y-2.5 overflow-y-auto pr-1"
                style={{
                  maxHeight: rankingVisibleRowsHeight,
                  scrollbarWidth: "thin",
                  scrollbarColor: "hsl(234 89% 64% / 0.15) transparent",
                }}
              >
              {ranking.map((person, i) => {
                const levelColor = LEVEL_COLORS[person.level];
                const levelName = LEVEL_NAMES[person.level];
                return (
                  <motion.div
                    key={person.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.1 + i * 0.04 }}
                    className="grid min-h-24 gap-3 rounded-2xl p-3.5 transition-colors hover:bg-card/30 cursor-default sm:grid-cols-[auto_auto_minmax(0,1fr)_auto] sm:items-center"
                    style={{ border: "1px solid hsl(234 89% 64% / 0.06)", background: "hsl(222 40% 8% / 0.34)" }}
                  >
                    <div className="flex items-center gap-3 sm:contents">
                      <span className={`w-8 text-center text-lg font-black ${i < 3 ? "text-amber-400" : "text-muted-foreground"}`}>
                        {i + 1}
                      </span>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: `linear-gradient(135deg, ${levelColor}, hsl(234 89% 64%))` }}>
                        {person.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">{person.name}</p>
                        <Badge variant="outline" className="text-[9px] border-border/15" style={{ color: levelColor, borderColor: `${levelColor}25` }}>
                          {levelName}
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <span className="text-[11px] text-muted-foreground"><span className="font-semibold text-emerald-400">{person.done}</span> concluídas</span>
                        <span className="text-[11px] text-muted-foreground"><span className="font-semibold text-red-400">{person.overdue}</span> atrasadas</span>
                        <div className="flex min-w-[150px] flex-1 items-center gap-2">
                          <Progress value={getLevelProgress(person.points)} className="h-1.5 w-full max-w-[220px] bg-muted/50" />
                          <span className="text-[10px] text-white/35">{getLevelProgress(person.points)}%</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 sm:justify-end">
                      {person.badges.map((b) => {
                        const def = BADGE_DEFS[b];
                        if (!def) return null;
                        return (
                          <div
                            key={b}
                            className="flex h-7 w-7 items-center justify-center rounded-lg"
                            style={{ background: `${def.color}12` }}
                            title={def.description}
                          >
                            <def.icon className="h-3.5 w-3.5" style={{ color: def.color }} />
                          </div>
                        );
                      })}
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-sm font-bold text-primary">{person.points}</p>
                      <p className="text-[10px] text-muted-foreground">pts</p>
                    </div>
                  </motion.div>
                );
              })}
              {ranking.length === 0 && (
                <div className="flex flex-col items-center py-10 text-muted-foreground">
                  <Trophy className="h-10 w-10 mb-3 opacity-20" />
                  <p className="text-sm">Nenhum dado de ranking disponível</p>
                </div>
              )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
