import { useEffect, useMemo, useState } from "react";
import {
  Crown, Pencil, Trash2,
  ChevronDown, ChevronUp, Search, AlertTriangle, Check, X, User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { usePageSEO } from "@/hooks/usePageSEO";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { supabaseExt as supabase } from "@/lib/supabase";
import { supabaseRest, safeJson } from "@/modules/users/api/supabaseRest";
import { toast } from "sonner";
import { notifyError } from "@/lib/friendlyError";
import { BonusPaymentManagerCard } from "@/modules/sprint6/components/bonus/BonusPaymentManagerCard";

/* ── Types ─────────────────────────────────────────────────────── */
interface EvalRow {
  id: string;
  user_id: string | null;
  evaluator_user_id: string | null;
  period_key: string;
  score_1_10: number | null;
  status: string | null;
  created_at: string;
  category: string | null;
}

interface UserOption { id: string; name: string; email?: string; }

/* ── Helpers ────────────────────────────────────────────────────── */
function statusBadge(status: string | null) {
  if (status === "submitted") return { label: "Enviado", cls: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" };
  if (status === "draft") return { label: "Rascunho", cls: "border-amber-500/20 bg-amber-500/10 text-amber-300" };
  return { label: "Pendente", cls: "border-border/20 bg-card/30 text-muted-foreground/75" };
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

function fmtPeriodShort(key: string | null | undefined) {
  if (!key) return "—";
  const [year, month] = key.split("-");
  if (!year || !month) return key;
  const label = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" }).format(new Date(`${year}-${month}-01`));
  return `${label.replace(".", "")}/${year}`;
}

function fmtPeriodLong(key: string | null | undefined) {
  if (!key) return "—";
  const [year, month] = key.split("-");
  if (!year || !month) return key;
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(new Date(`${year}-${month}-01`));
  return `${label} de ${year}`;
}

function fmtCategory(cat: string | null | undefined) {
  if (!cat) return "—";
  if (cat === "soft_skill") return "Soft skill (habilidades comportamentais)";
  if (cat === "hard_skill_manual") return "Hard skill manual (habilidade técnica avaliada manualmente)";
  if (cat === "people_skill") return "People skill (relacionamento e colaboração)";
  return cat;
}

const EVALS_PER_PAGE = 8;

/* ── Shared Select classes ──────────────────────────────────────── */
const SEL_TRIGGER = "h-9 rounded-xl border-border/15 bg-card/40 text-xs text-foreground hover:bg-card/55 focus:ring-0 focus:ring-offset-0 focus:border-primary/30 data-[placeholder]:text-muted-foreground/45";
const SEL_TRIGGER_SM = "mt-1 h-9 w-full rounded-xl border-border/15 bg-card/40 text-sm text-foreground hover:bg-card/55 focus:ring-0 focus:ring-offset-0 focus:border-primary/30";
const SEL_CONTENT = "rounded-xl border border-border/15 bg-[hsl(222_47%_11%)] shadow-2xl shadow-black/40 z-50";
const SEL_ITEM = "text-xs text-muted-foreground/70 hover:text-foreground hover:bg-white/[0.05] rounded-lg cursor-pointer focus:bg-white/[0.05] focus:text-foreground";

/* ── UserAccordion ──────────────────────────────────────────────── */
function UserAccordion({
  userId, userName, evals, canEdit, onEdit, onDelete,
}: {
  userId: string;
  userName: string;
  evals: EvalRow[];
  canEdit: boolean;
  onEdit: (r: EvalRow) => void;
  onDelete: (r: EvalRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [evPage, setEvPage] = useState(1);

  const pendingCount = evals.filter((r) => !r.status || r.status === "pending").length;
  const latestPeriod = evals.map((r) => r.period_key).filter(Boolean).sort().reverse()[0];

  /* flat list for pagination */
  const flat = useMemo(() => evals.slice().sort((a, b) => {
    const pd = (b.period_key ?? "").localeCompare(a.period_key ?? "");
    if (pd !== 0) return pd;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  }), [evals]);

  const totalEvPages = Math.max(1, Math.ceil(flat.length / EVALS_PER_PAGE));
  const pagedFlat = flat.slice((evPage - 1) * EVALS_PER_PAGE, evPage * EVALS_PER_PAGE);

  /* group paged items by period for display */
  const pagedByPeriod = useMemo(() => {
    const map = new Map<string, EvalRow[]>();
    for (const ev of pagedFlat) {
      const k = ev.period_key ?? "sem-período";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(ev);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [pagedFlat]);

  return (
    <div className="rounded-xl border border-border/12 bg-card/25 overflow-hidden">
      {/* header row */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-card/40 transition-colors"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/15 bg-card/40">
          <User className="h-4 w-4 text-muted-foreground/60" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{userName}</p>
          <p className="text-[11px] text-muted-foreground/50 mt-0.5">
            {evals.length} avaliação{evals.length !== 1 ? "ões" : ""}
            {pendingCount > 0 && <span className="ml-2 text-amber-400/80">{pendingCount} pendente{pendingCount !== 1 ? "s" : ""}</span>}
            {latestPeriod && <span className="ml-2 text-muted-foreground/35">· último: {fmtPeriodShort(latestPeriod)}</span>}
          </p>
        </div>
        <div className="shrink-0 text-muted-foreground/40">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {/* expanded content */}
      {open && (
        <div className="border-t border-border/10 px-4 pb-4 pt-3 space-y-4">
          {pagedByPeriod.map(([periodKey, periodEvals]) => (
            <div key={periodKey}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/45 mb-2">
                {fmtPeriodLong(periodKey)}
              </p>
              <div className="space-y-2">
                {periodEvals.map((ev) => {
                  const { label, cls } = statusBadge(ev.status);
                  const score = ev.score_1_10;
                  return (
                    <div key={ev.id} className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-border/10 bg-card/30 px-3 py-2.5">
                      <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40 font-medium">Categoria</p>
                          <p className="text-foreground/75 mt-0.5 leading-snug">{fmtCategory(ev.category)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40 font-medium">Nota</p>
                          <p className="mt-0.5 font-bold">
                            {score != null
                              ? <span className={score >= 8 ? "text-emerald-400" : score >= 5 ? "text-amber-400" : "text-red-400"}>{score}/10</span>
                              : <span className="text-muted-foreground/35">—</span>}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40 font-medium">Status</p>
                          <Badge variant="outline" className={`mt-0.5 text-[10px] ${cls}`}>{label}</Badge>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40 font-medium">Criado em</p>
                          <p className="text-muted-foreground/55 mt-0.5">{fmtDate(ev.created_at)}</p>
                        </div>
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => onEdit(ev)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/12 bg-card/30 text-muted-foreground/55 hover:bg-card/60 hover:text-foreground transition-colors"
                            title="Editar"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(ev)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-red-500/15 bg-red-500/[0.05] text-red-400/65 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {totalEvPages > 1 && (
            <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground/45">
              <span>{(evPage - 1) * EVALS_PER_PAGE + 1}–{Math.min(evPage * EVALS_PER_PAGE, flat.length)} de {flat.length}</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={evPage === 1}
                  onClick={() => setEvPage((p) => p - 1)}
                  className="rounded-lg border border-border/12 bg-card/30 px-3 py-1 hover:bg-card/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Anterior
                </button>
                <span className="px-2 py-1">{evPage} / {totalEvPages}</span>
                <button
                  type="button"
                  disabled={evPage === totalEvPages}
                  onClick={() => setEvPage((p) => p + 1)}
                  className="rounded-lg border border-border/12 bg-card/30 px-3 py-1 hover:bg-card/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const USERS_PAGE_SIZE = 15;

/* ── Page ───────────────────────────────────────────────────────── */
export default function AdminBonificacaoPage() {
  usePageSEO("Gestão de Bonificação | Dashboard ISP");
  const { session } = useAuth();
  const token = session?.accessToken;

  /* data */
  const [rows, setRows] = useState<EvalRow[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  /* filters */
  const [filterPeriod, setFilterPeriod] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [usersPage, setUsersPage] = useState(1);

  /* edit */
  const [editRow, setEditRow] = useState<EvalRow | null>(null);
  const [editScore, setEditScore] = useState("");
  const [editStatus, setEditStatus] = useState("draft");
  const [editPeriod, setEditPeriod] = useState("");
  const [editConfirm, setEditConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  /* delete */
  const [deleteRow, setDeleteRow] = useState<EvalRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* ── load ── */
  const load = async () => {
    if (!token) return;
    setLoading(true);
    setDataError(null);
    try {
      const [evRes, usRaw] = await Promise.all([
        supabase
          .from("bonus_internal_evaluations")
          .select("id,user_id,evaluator_user_id,period_key,score_1_10,status,created_at,category")
          .order("created_at", { ascending: false }),
        supabaseRest("users?select=id,name,email&order=name.asc", token).then(safeJson),
      ]);
      if (evRes.error) throw evRes.error;
      const usData: { id: string; name: string; email?: string }[] = Array.isArray(usRaw) ? usRaw : [];
      setRows((evRes.data ?? []).map((r) => ({
        ...r,
        user_id: r.user_id != null ? String(r.user_id) : null,
        evaluator_user_id: r.evaluator_user_id != null ? String(r.evaluator_user_id) : null,
      })) as EvalRow[]);
      setUsers(usData.map((u) => ({ id: String(u.id), name: String(u.name ?? u.id), email: u.email ?? undefined })));
    } catch (e: unknown) {
      // Detalhe técnico apenas no log; banner exibe mensagem amigável mapeada.
      setDataError(notifyError(e, { context: "admin-bonus-load", toast: false }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [token]);

  const userNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of users) m.set(u.id, u.name);
    return m;
  }, [users]);

  const periodOptions = useMemo(() => {
    const s = new Set(rows.map((r) => r.period_key).filter(Boolean));
    return Array.from(s).sort().reverse();
  }, [rows]);

  /* ── filtered flat list ── */
  const filtered = useMemo(() => {
    let result = rows;
    if (filterPeriod) result = result.filter((r) => r.period_key === filterPeriod);
    if (filterStatus) result = result.filter((r) => (r.status ?? "") === filterStatus);
    if (filterSearch) {
      const term = filterSearch.toLowerCase();
      result = result.filter((r) => (userNameById.get(r.user_id ?? "") ?? "").toLowerCase().includes(term));
    }
    return result;
  }, [rows, filterPeriod, filterStatus, filterSearch, userNameById]);

  /* ── group by user ── */
  const userGroups = useMemo(() => {
    const map = new Map<string, EvalRow[]>();
    for (const ev of filtered) {
      const uid = ev.user_id ?? "__unknown__";
      if (!map.has(uid)) map.set(uid, []);
      map.get(uid)!.push(ev);
    }
    return Array.from(map.entries()).sort((a, b) => {
      const na = userNameById.get(a[0]) ?? a[0];
      const nb = userNameById.get(b[0]) ?? b[0];
      return na.localeCompare(nb, "pt-BR");
    });
  }, [filtered, userNameById]);

  const pendingCount = useMemo(() => rows.filter((r) => !r.status || r.status === "pending").length, [rows]);

  /* users pagination */
  const totalUsersPages = Math.max(1, Math.ceil(userGroups.length / USERS_PAGE_SIZE));
  const pagedUserGroups = userGroups.slice((usersPage - 1) * USERS_PAGE_SIZE, usersPage * USERS_PAGE_SIZE);

  /* reset page on filter change */
  useEffect(() => { setUsersPage(1); }, [filterPeriod, filterStatus, filterSearch]);

  /* ── edit ── */
  function openEdit(row: EvalRow) {
    setEditRow(row);
    setEditScore(row.score_1_10 != null ? String(row.score_1_10) : "");
    setEditStatus(row.status ?? "draft");
    setEditPeriod(row.period_key ?? "");
    setEditConfirm(false);
  }

  async function saveEdit() {
    if (!editRow) return;
    const scoreVal = editScore !== "" ? Number(editScore) : null;
    if (scoreVal != null && (scoreVal < 1 || scoreVal > 10)) { toast.error("Nota deve ser entre 1 e 10"); return; }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("bonus_internal_evaluations")
        .update({ score_1_10: scoreVal, status: editStatus, period_key: editPeriod, updated_at: new Date().toISOString() })
        .eq("id", editRow.id);
      if (error) throw error;
      toast.success("Avaliação atualizada");
      setEditRow(null);
      void load();
    } catch (e: unknown) {
      notifyError(e, { context: "admin-bonus-save", hint: "save" });
    } finally {
      setSaving(false);
    }
  }

  /* ── delete ── */
  async function confirmDelete() {
    if (!deleteRow) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("bonus_internal_evaluations").delete().eq("id", deleteRow.id);
      if (error) throw error;
      toast.success("Avaliação excluída");
      setDeleteRow(null);
      void load();
    } catch (e: unknown) {
      notifyError(e, { context: "admin-bonus-delete", hint: "save" });
    } finally {
      setDeleting(false);
    }
  }

  const canEdit = session?.bonusRole === "admin" || session?.isPaymentManager === true;

  /* ── render ── */
  return (
    <div className="page-gradient w-full">
      <div className="mx-auto w-full max-w-[1800px] space-y-6 p-4 sm:p-5 md:p-6 lg:p-8">

        {/* ── Page header ── */}
        <div
          className="relative overflow-hidden rounded-2xl border border-border/10"
          style={{ background: "linear-gradient(135deg, hsl(260 30% 11%) 0%, hsl(262 35% 15%) 40%, hsl(270 25% 12%) 100%)" }}
        >
          <div className="relative flex items-center gap-3.5 p-4 sm:p-5 md:px-6 md:py-5">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/20 shrink-0 shadow-lg shadow-black/20"
              style={{ background: "linear-gradient(145deg, hsl(45 80% 30% / 0.5), hsl(45 60% 20% / 0.4))" }}
            >
              <Crown className="h-5 w-5 text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">Gestão de Bonificação</h1>
              <p className="mt-0.5 text-xs text-muted-foreground/55">Responsável e administração de avaliações</p>
            </div>
          </div>
        </div>

        {/* ── Section 1: Responsável pela Bonificação ── */}
        <BonusPaymentManagerCard users={users} />

        {/* ── Section 2: Avaliações por Consultor ── */}
        <div className="rounded-2xl border border-border/12 bg-card/35 overflow-hidden">

          {/* header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 border-b border-border/10">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 shrink-0">
                <Crown className="h-4 w-4 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Avaliações por Consultor</p>
                {!loading && !dataError && (
                  <p className="text-xs text-muted-foreground/55 mt-0.5">
                    {userGroups.length} consultor{userGroups.length !== 1 ? "es" : ""} · {filtered.length} avaliações · {pendingCount} pendentes
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* filters */}
          <div className="grid gap-2 p-4 sm:p-5 grid-cols-1 sm:grid-cols-3 border-b border-border/10">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/45" />
              <Input
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                placeholder="Buscar consultor..."
                className="h-9 pl-9 rounded-xl border-border/15 bg-card/40 text-xs"
              />
            </div>
            <Select value={filterPeriod} onValueChange={(v) => setFilterPeriod(v === "__all__" ? "" : v)}>
              <SelectTrigger className={SEL_TRIGGER}>
                <SelectValue placeholder="Todos os períodos" />
              </SelectTrigger>
              <SelectContent className={SEL_CONTENT}>
                <SelectItem value="__all__" className={SEL_ITEM}>Todos os períodos</SelectItem>
                {periodOptions.map((p) => (
                  <SelectItem key={p} value={p} className={SEL_ITEM}>{fmtPeriodShort(p)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v === "__all__" ? "" : v)}>
              <SelectTrigger className={SEL_TRIGGER}>
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent className={SEL_CONTENT}>
                <SelectItem value="__all__" className={SEL_ITEM}>Todos os status</SelectItem>
                <SelectItem value="submitted" className={SEL_ITEM}>Enviado</SelectItem>
                <SelectItem value="draft" className={SEL_ITEM}>Rascunho</SelectItem>
                <SelectItem value="pending" className={SEL_ITEM}>Pendente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* body */}
          {loading ? (
            <div className="p-5 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
            </div>
          ) : dataError ? (
            <div className="flex items-center gap-3 p-6 text-sm text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {dataError}
            </div>
          ) : userGroups.length === 0 ? (
            <div className="p-10 text-center space-y-1.5">
              <p className="text-sm font-semibold text-foreground/60">Nenhuma avaliação encontrada</p>
              <p className="text-xs text-muted-foreground/40">Ajuste os filtros ou aguarde o lançamento de avaliações pela equipe.</p>
            </div>
          ) : (
            <>
              <div className="p-4 sm:p-5 space-y-2">
                {pagedUserGroups.map(([uid, evals]) => (
                  <UserAccordion
                    key={uid}
                    userId={uid}
                    userName={userNameById.get(uid) ?? `ID ${uid}`}
                    evals={evals}
                    canEdit={canEdit}
                    onEdit={openEdit}
                    onDelete={setDeleteRow}
                  />
                ))}
              </div>

              {totalUsersPages > 1 && (
                <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-t border-border/10 text-xs text-muted-foreground/45">
                  <span>
                    Consultores {(usersPage - 1) * USERS_PAGE_SIZE + 1}–{Math.min(usersPage * USERS_PAGE_SIZE, userGroups.length)} de {userGroups.length}
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={usersPage === 1}
                      onClick={() => setUsersPage((p) => p - 1)}
                      className="rounded-lg border border-border/12 bg-card/30 px-3 py-1.5 hover:bg-card/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      Anterior
                    </button>
                    <span className="px-2 py-1.5">{usersPage} / {totalUsersPages}</span>
                    <button
                      type="button"
                      disabled={usersPage === totalUsersPages}
                      onClick={() => setUsersPage((p) => p + 1)}
                      className="rounded-lg border border-border/12 bg-card/30 px-3 py-1.5 hover:bg-card/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      Próxima
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Edit dialog ── */}
      <Dialog open={!!editRow && !editConfirm} onOpenChange={(o) => { if (!o) setEditRow(null); }}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Editar Avaliação</DialogTitle>
            <DialogDescription className="sr-only">Edite os campos da avaliação selecionada.</DialogDescription>
          </DialogHeader>
          {editRow && (
            <div className="space-y-4 py-1">
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-border/10 bg-card/20 p-3 text-xs">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/45 mb-0.5">Consultor</p>
                  <p className="text-foreground/80">{userNameById.get(editRow.user_id ?? "") ?? editRow.user_id ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/45 mb-0.5">Avaliador</p>
                  <p className="text-foreground/80">{userNameById.get(editRow.evaluator_user_id ?? "") ?? editRow.evaluator_user_id ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/45 mb-0.5">Criado em</p>
                  <p className="text-foreground/80">{fmtDate(editRow.created_at)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/45 mb-0.5">Categoria</p>
                  <p className="text-foreground/80 leading-snug">{fmtCategory(editRow.category)}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground/55 uppercase tracking-wider">Período</label>
                  <Input value={editPeriod} onChange={(e) => setEditPeriod(e.target.value)} className="mt-1 h-9 rounded-xl text-sm border-border/15 bg-card/40 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary/40" placeholder="ex: 2026-05" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground/55 uppercase tracking-wider">Nota (1–10)</label>
                  <Input type="number" min={1} max={10} value={editScore} onChange={(e) => setEditScore(e.target.value)} className="mt-1 h-9 rounded-xl text-sm border-border/15 bg-card/40 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary/40" placeholder="1 a 10" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground/55 uppercase tracking-wider">Status</label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger className={SEL_TRIGGER_SM}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={SEL_CONTENT}>
                      <SelectItem value="draft" className={SEL_ITEM}>Rascunho</SelectItem>
                      <SelectItem value="submitted" className={SEL_ITEM}>Enviado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setEditRow(null)}>
              <X className="h-3.5 w-3.5 mr-1.5" /> Cancelar
            </Button>
            <Button size="sm" className="rounded-xl gap-1.5" onClick={() => setEditConfirm(true)}>
              <Check className="h-3.5 w-3.5" /> Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* edit confirm */}
      <Dialog open={editConfirm} onOpenChange={setEditConfirm}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Confirmar alteração</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground/65">Deseja salvar as alterações nesta avaliação?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setEditConfirm(false)}>Cancelar</Button>
            <Button size="sm" className="rounded-xl gap-1.5" disabled={saving} onClick={() => { setEditConfirm(false); void saveEdit(); }}>
              <Check className="h-3.5 w-3.5" /> {saving ? "Salvando…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete dialog ── */}
      <Dialog open={!!deleteRow} onOpenChange={(o) => { if (!o) setDeleteRow(null); }}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-4 w-4" /> Excluir avaliação
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground/65">Tem certeza que deseja excluir esta avaliação? Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setDeleteRow(null)}>Cancelar</Button>
            <Button variant="destructive" size="sm" className="rounded-xl gap-1.5" disabled={deleting} onClick={() => void confirmDelete()}>
              <Trash2 className="h-3.5 w-3.5" /> {deleting ? "Excluindo…" : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
