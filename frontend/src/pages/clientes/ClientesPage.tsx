import { useState, useMemo, useEffect, useCallback } from "react";
import PageHeaderCard from "@/components/PageHeaderCard";
import { motion } from "framer-motion";
import { Search, Filter, Plus, MoreVertical, Contact, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePageSEO } from "@/hooks/usePageSEO";
import { supabaseExt } from "@/lib/supabase";
import PageSkeleton from "@/components/ui/PageSkeleton";
import ClienteEditModal from "./ClienteEditModal";
import DataErrorCard from "@/components/ui/DataErrorCard";
import EmptyState from "@/components/ui/EmptyState";
import { useAuth } from "@/modules/auth/hooks/useAuth";

interface Cliente {
  cliente_id: number;
  nome: string;
  tipo_horas: string;
  horas_hg_contratadas: number | null;
  Ativo: boolean;
  horas_contratadas: number;
  horas_consumidas: number;
  logo_url: string | null;
  cidade: string | null;
  projetos_quantidade: number;
  status: string | null;
  created_at: string | null;
}

const AVATAR_COLORS = [
  "hsl(210 60% 50%)", "hsl(160 60% 40%)", "hsl(38 80% 50%)", "hsl(280 50% 50%)",
  "hsl(340 60% 50%)", "hsl(200 70% 45%)", "hsl(25 80% 50%)", "hsl(0 65% 50%)",
  "hsl(120 40% 45%)", "hsl(270 55% 55%)", "hsl(50 70% 50%)", "hsl(15 70% 50%)",
];

const statusStyle: Record<string, string> = {
  Ativo: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  Inativo: "bg-red-500/15 text-red-400 border-red-500/20",
  Suspenso: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  Cancelado: "bg-red-500/15 text-red-400 border-red-500/20",
};

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

export default function ClientesPage() {
  const AUTO_REFRESH_MS = 5 * 60 * 1000;
  usePageSEO("Clientes — Área de Testes");
  const { session, loadingSession } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "ativo" | "inativo">("all");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);

  const fetchClientes = useCallback(async () => {
    if (!session?.accessToken) {
      setClientes([]);
      setLoading(false);
      setError("Sessão ainda não foi inicializada para consultar clientes e projetos relacionados.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: clientesData, error: err } = await (supabaseExt as any)
        .from("clientes")
        .select("*")
        .order("nome", { ascending: true });
      if (err) throw err;

      const { data: projectsData } = await (supabaseExt as any)
        .from("projects")
        .select("cliente_id")
        .not("cliente_id", "is", null);

      const countMap: Record<number, number> = {};
      (projectsData ?? []).forEach((p: { cliente_id: number }) => {
        countMap[p.cliente_id] = (countMap[p.cliente_id] || 0) + 1;
      });

      const enriched = (clientesData ?? []).map((c: Cliente) => ({
        ...c,
        projetos_quantidade: countMap[c.cliente_id] || 0,
      }));

      setClientes(enriched);
    } catch (e: any) {
      console.error("Erro ao carregar clientes:", e);
      setError(e.message || "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void fetchClientes();
    }, AUTO_REFRESH_MS);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void fetchClientes();
      }
    };

    window.addEventListener("focus", handleVisibility);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleVisibility);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchClientes]);

  const handleOpenEdit = (c: Cliente) => {
    setEditingCliente(c);
    setEditModalOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingCliente(null);
    setEditModalOpen(true);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clientes.filter((c) => {
      const displayStatus = (c.status || (c.Ativo ? "Ativo" : "Inativo")).toLowerCase();
      const matchesSearch = !q ||
        c.nome.toLowerCase().includes(q) ||
        (c.cidade ?? "").toLowerCase().includes(q) ||
        displayStatus.includes(q);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "ativo" && displayStatus === "ativo") ||
        (statusFilter === "inativo" && displayStatus !== "ativo");
      return matchesSearch && matchesStatus;
    });
  }, [search, clientes, statusFilter]);

  const pageBackground = {
    background: [
      "radial-gradient(circle at top left, hsl(234 89% 64% / 0.12), transparent 22%)",
      "radial-gradient(circle at top right, hsl(200 75% 50% / 0.08), transparent 18%)",
      "radial-gradient(circle at bottom right, hsl(160 84% 39% / 0.07), transparent 24%)",
      "linear-gradient(180deg, hsl(222 47% 5%) 0%, hsl(228 43% 6%) 42%, hsl(222 47% 5%) 100%)",
    ].join(", "),
  } as const;

  const getInitials = (name: string) =>
    name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  const getColor = (id: number) => AVATAR_COLORS[id % AVATAR_COLORS.length];

  if (loadingSession || loading) return <PageSkeleton variant="analiticas" />;

  if (!session?.accessToken) {
    return (
      <div className="page-gradient w-full">
        <div className="mx-auto w-full max-w-[1900px] p-4 sm:p-5 md:p-8">
          <DataErrorCard
            title="Sessão ainda não inicializada"
            message="Página Cliente depende da sessão autenticada para carregar clientes, status e contagem de projetos."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-[calc(100vh-3.5rem)]" style={pageBackground}>
      <div className="mx-auto w-full max-w-[1900px] space-y-6 p-4 sm:p-5 md:p-8">

        <PageHeaderCard
          icon={Contact}
          title="Clientes"
          subtitle="Gestão centralizada de carteira, contratos e projetos vinculados."
          actions={
            <Button
              size="sm"
              className="h-10 gap-2 rounded-xl text-sm font-medium shadow-[0_14px_28px_-14px_hsl(234_89%_64%/0.7)] shrink-0"
              onClick={handleOpenCreate}
            >
              <Plus className="h-4 w-4" />
              Novo Cliente
            </Button>
          }
        />

        {/* ── Error ── */}
        {error && (
          <motion.div {...fadeUp}>
            <DataErrorCard compact title="Erro ao carregar clientes" message={error} onRetry={fetchClientes} />
          </motion.div>
        )}

        {/* ── Search & filter bar ── */}
        <motion.div
          {...fadeUp}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3 sm:p-4"
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.05]">
                <Filter className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Filtros</p>
                <p className="text-xs text-white/35">Busque e refine a lista de clientes.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="relative min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
              <Input
                placeholder="Buscar cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 rounded-xl text-sm bg-white/[0.03] border-white/[0.07]"
              />
              </div>

              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | "ativo" | "inativo")}>
                <SelectTrigger className="h-9 rounded-xl border-white/[0.07] bg-white/[0.03] text-xs text-white/80">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="border-white/[0.07] bg-[hsl(222_40%_10%)] text-foreground">
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="ativo">Somente ativos</SelectItem>
                  <SelectItem value="inativo">Inativos e outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </motion.div>

        {/* ── Empty state ── */}
        {!error && clientes.length === 0 && (
          <EmptyState
            variant="users"
            message="Nenhum cliente disponível para exibição."
            hint="Verifique se a tabela clientes possui registros ativos e se os projetos estão vinculados com cliente_id."
          />
        )}

        {/* ── Client Cards Grid ── */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.35, delay: 0.15 }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3"
        >
          {filtered.map((c, i) => {
            const color = getColor(c.cliente_id);
            const displayStatus = c.status || (c.Ativo ? "Ativo" : "Inativo");
            const horasContratadasCliente = Number(c.horas_contratadas || 0);
            const horasConsumidasCliente = Number(c.horas_consumidas || 0);
            const consumoPercent = horasContratadasCliente > 0
              ? Math.min(100, Math.round((horasConsumidasCliente / horasContratadasCliente) * 100))
              : 0;

            return (
              <motion.div
                key={c.cliente_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(0.02 * i, 0.3) }}
              >
                <div className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 space-y-4 transition-all duration-200 hover:border-white/[0.12] hover:bg-white/[0.035]">

                  {/* Identity row */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="h-12 w-12 shrink-0 rounded-xl border-[1.5px] overflow-hidden" style={{ borderColor: color }}>
                        {c.logo_url ? (
                          <AvatarImage
                            src={c.logo_url}
                            alt={c.nome}
                            className="h-full w-full object-cover object-center"
                            style={{ imageRendering: "auto" }}
                          />
                        ) : null}
                        <AvatarFallback
                          className="flex h-full w-full items-center justify-center rounded-none text-xs font-bold text-white"
                          style={{ background: `linear-gradient(135deg, ${color}, hsl(234 89% 64%))` }}
                        >
                          {getInitials(c.nome)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-foreground leading-tight">{c.nome}</p>
                          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 leading-4 shrink-0 ${statusStyle[displayStatus] || "border-border/40 text-foreground"}`}>
                            {displayStatus}
                          </Badge>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-white/35">
                          {c.cidade || "Sem cidade"}{c.tipo_horas ? ` · ${c.tipo_horas}` : ""}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="rounded-lg p-1.5 text-white/30 transition-colors outline-none hover:bg-white/[0.06] hover:text-white/60 focus:outline-none">
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[140px] bg-card border-white/[0.06] rounded-xl shadow-xl shadow-black/30">
                        <DropdownMenuItem onClick={() => handleOpenEdit(c)} className="gap-2 text-xs rounded-lg focus:bg-white/[0.06] focus:text-foreground">
                          <Pencil className="h-3.5 w-3.5" /> Editar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Hours consumption bar */}
                  <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3.5 py-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-[10px] uppercase tracking-wider text-white/30">Consumo</p>
                      <p className="text-xs text-white/50">
                        <span className="font-semibold text-foreground">{Math.round(horasConsumidasCliente)}h</span>
                        <span className="text-white/25"> / {Math.round(horasContratadasCliente)}h</span>
                      </p>
                    </div>
                    <div className="mt-2 flex items-center gap-2.5">
                      <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full bg-[linear-gradient(90deg,hsl(234_89%_64%),hsl(200_75%_50%))]"
                          style={{ width: `${consumoPercent}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-foreground tabular-nums w-8 text-right">{consumoPercent}%</span>
                    </div>
                  </div>

                  {/* Metadata row */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                    <span className="text-white/30">
                      Projetos <span className="font-medium text-foreground">{c.projetos_quantidade}</span>
                    </span>
                    {c.horas_hg_contratadas != null && (
                      <span className="text-white/30">
                        HG <span className="font-medium text-foreground">{Math.round(c.horas_hg_contratadas)}h</span>
                      </span>
                    )}
                    {c.created_at && (
                      <span className="text-white/30">
                        Desde <span className="font-medium text-foreground">{new Date(c.created_at).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })}</span>
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      <ClienteEditModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        cliente={editingCliente}
        onSaved={fetchClientes}
      />
    </div>
  );
}
