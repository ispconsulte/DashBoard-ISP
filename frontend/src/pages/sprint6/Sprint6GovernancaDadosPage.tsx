import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  DatabaseZap,
  FileCog,
  Link2,
  Settings2,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePageSEO } from "@/hooks/usePageSEO";

import { ManualClientKpisForm } from "@/modules/sprint6/components/ManualClientKpisForm";
import { ManualContractedHoursForm } from "@/modules/sprint6/components/ManualContractedHoursForm";
import { ManualHealthWeightsForm } from "@/modules/sprint6/components/ManualHealthWeightsForm";
import { ManualProjectFinancialsForm } from "@/modules/sprint6/components/ManualProjectFinancialsForm";
import { ManualUserCapacityForm } from "@/modules/sprint6/components/ManualUserCapacityForm";
import {
  INTEGRATION_REGISTRY,
  getIntegrationStats,
  type IntegrationStatus,
} from "@/modules/sprint6/integrations/registry";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

const statusConfig: Record<IntegrationStatus, { label: string; icon: typeof BadgeCheck; className: string }> = {
  active: {
    label: "Ativo",
    icon: BadgeCheck,
    className: "bg-green-500/10 text-green-400 border-green-500/20",
  },
  prepared: {
    label: "Preparado",
    icon: Clock3,
    className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  pending: {
    label: "Pendente",
    icon: Sparkles,
    className: "bg-muted/30 text-muted-foreground border-border/20",
  },
};

function SectionCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/15 bg-card/50 backdrop-blur-sm overflow-hidden">
      <div className="border-b border-border/10 px-5 py-4">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function Sprint6GovernancaDadosPage() {
  usePageSEO("Governanca de Dados");
  const [tab, setTab] = useState("cadastros");
  const [page, setPage] = useState(1);
  const stats = useMemo(() => getIntegrationStats(), []);
  const pageSize = 5;
  const totalPages = Math.max(1, Math.ceil(INTEGRATION_REGISTRY.length / pageSize));
  const pagedIntegrations = useMemo(
    () => INTEGRATION_REGISTRY.slice((page - 1) * pageSize, page * pageSize),
    [page],
  );

  return (
    <div className="page-gradient w-full">
      <div className="mx-auto w-full max-w-[1900px] space-y-5 p-4 sm:p-5 md:p-8">
        {/* ── Hero Header ──────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative overflow-hidden rounded-2xl border border-white/[0.07] p-5 sm:p-6 lg:p-7"
          style={{ background: "linear-gradient(145deg, hsl(222 40% 9% / 0.92), hsl(228 36% 8% / 0.72))" }}
        >
          <motion.div
            className="pointer-events-none absolute inset-y-0 right-0 w-[40%]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, delay: 0.3 }}
            style={{ background: "radial-gradient(circle at center, hsl(160 84% 39% / 0.10), transparent 65%)" }}
          />
          <div className="relative flex items-center gap-4 min-w-0">
            <motion.div
              className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-500/10 shrink-0"
              animate={{ boxShadow: ["0 0 10px hsl(160 84% 39% / 0.08)", "0 0 24px hsl(160 84% 39% / 0.25)", "0 0 10px hsl(160 84% 39% / 0.08)"], scale: [1, 1.06, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
                <DatabaseZap className="h-5 w-5 text-emerald-400" />
              </motion.div>
            </motion.div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-foreground tracking-tight sm:text-2xl">Governança de Dados</h1>
              <p className="text-xs text-white/40 mt-0.5 leading-relaxed">Completar base, ajustar pesos e enxergar de onde cada painel lê</p>
            </div>
          </div>
        </motion.div>

        <motion.div {...fadeUp} transition={{ duration: 0.35 }}>
          <Tabs value={tab} onValueChange={setTab} className="space-y-5">
            <TabsList className="grid h-auto w-full grid-cols-1 gap-2 rounded-2xl bg-card/35 p-2 md:grid-cols-2">
              <TabsTrigger value="cadastros" className="rounded-xl py-3 text-sm">
                <Settings2 className="mr-2 h-4 w-4" />
                Cadastros Operacionais
              </TabsTrigger>
              <TabsTrigger value="fontes" className="rounded-xl py-3 text-sm">
                <Link2 className="mr-2 h-4 w-4" />
                Fontes & Integracoes
              </TabsTrigger>
            </TabsList>

            <TabsContent value="cadastros" className="space-y-6">
              <Accordion type="single" collapsible className="space-y-4">
                <AccordionItem value="hours" className="rounded-2xl border border-border/15 bg-card/45 px-0">
                  <AccordionTrigger className="px-5 py-4 text-left hover:no-underline">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Horas Contratadas por Projeto</p>
                      <p className="mt-1 text-xs text-muted-foreground">Base usada para variancia de consumo.</p>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-5 pb-5">
                    <ManualContractedHoursForm />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="financials" className="rounded-2xl border border-border/15 bg-card/45 px-0">
                  <AccordionTrigger className="px-5 py-4 text-left hover:no-underline">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Financeiro dos Projetos</p>
                      <p className="mt-1 text-xs text-muted-foreground">Receita e custo para ativar ROI.</p>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-5 pb-5">
                    <ManualProjectFinancialsForm />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="capacity" className="rounded-2xl border border-border/15 bg-card/45 px-0">
                  <AccordionTrigger className="px-5 py-4 text-left hover:no-underline">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Capacidade do Time</p>
                      <p className="mt-1 text-xs text-muted-foreground">Disponibilidade mensal, senioridade e departamento.</p>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-5 pb-5">
                    <ManualUserCapacityForm />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="kpis" className="rounded-2xl border border-border/15 bg-card/45 px-0">
                  <AccordionTrigger className="px-5 py-4 text-left hover:no-underline">
                    <div>
                      <p className="text-sm font-semibold text-foreground">KPIs e Benchmarks de Clientes</p>
                      <p className="mt-1 text-xs text-muted-foreground">EBITDA, churn, NPS e comparativo da carteira.</p>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-5 pb-5">
                    <ManualClientKpisForm />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="weights" className="rounded-2xl border border-border/15 bg-card/45 px-0">
                  <AccordionTrigger className="px-5 py-4 text-left hover:no-underline">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Pesos do Health Score</p>
                      <p className="mt-1 text-xs text-muted-foreground">Ajuste fino da regra de saude.</p>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-5 pb-5">
                    <ManualHealthWeightsForm />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </TabsContent>

            <TabsContent value="fontes" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <SummaryStat label="Conexoes ativas" value={stats.active} status="active" />
                <SummaryStat label="Preparadas" value={stats.prepared} status="prepared" />
                <SummaryStat label="Pendentes" value={stats.pending} status="pending" />
              </div>

              <SectionCard
                title="Mapa de Fontes"
                description="Inventario resumido das bases que alimentam os paineis."
              >
                <div className="space-y-3">
                  {pagedIntegrations.map((entry) => {
                    const config = statusConfig[entry.status];
                    const StatusIcon = config.icon;
                    return (
                      <div
                        key={entry.id}
                        className="rounded-xl border border-border/15 bg-card/35 px-4 py-4"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-foreground">{entry.name}</p>
                              <Badge variant="outline" className={`text-[10px] ${config.className}`}>
                                <StatusIcon className="mr-1 h-3 w-3" />
                                {config.label}
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">
                                <FileCog className="mr-1 h-3 w-3" />
                                {entry.category}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{entry.description}</p>
                            <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                              <span>Fonte: {entry.source}</span>
                              {entry.hookOrService && <span>Hook: {entry.hookOrService}</span>}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {entry.consumers.map((consumer) => (
                              <Badge key={consumer} variant="outline" className="text-[10px] bg-primary/5 text-primary/80">
                                {consumer}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        {entry.pendingDeps.length > 0 && (
                          <div className="mt-3 rounded-lg border border-amber-500/10 bg-amber-500/[0.04] px-3 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-300/90">
                              Dependencias pendentes
                            </p>
                            <div className="mt-1 space-y-1">
                              {entry.pendingDeps.map((dependency) => (
                                <p key={dependency} className="text-[11px] text-amber-200/70">
                                  {dependency}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      Pagina {page} de {totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                        disabled={page === 1}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/20 bg-card/35 text-muted-foreground transition-all hover:bg-card/60 hover:text-foreground disabled:opacity-40"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                        disabled={page === totalPages}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/20 bg-card/35 text-muted-foreground transition-all hover:bg-card/60 hover:text-foreground disabled:opacity-40"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </SectionCard>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  status,
}: {
  label: string;
  value: number;
  status: IntegrationStatus;
}) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="rounded-2xl border border-border/15 bg-card/50 p-4 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${config.className}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      </div>
      <p className="mt-3 text-3xl font-bold text-foreground">{value}</p>
    </div>
  );
}
