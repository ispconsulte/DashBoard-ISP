import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageHeaderCard from "@/components/PageHeaderCard";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useUsersApi } from "@/modules/users/api/useUsersApi";
import { callManageUser } from "@/modules/users/api/manageUserApi";
import { PERFIS, ALL_AREAS, PERFIL_TO_ROLE, type Perfil, type UserRow } from "@/modules/users/types";
import { normalizeBonusRole } from "@/modules/sprint6/bonusEvaluation";
import { useOnlineUsers } from "@/hooks/useUserPresence";
import {
  Users, Search, RefreshCw, Pencil, Trash2, Save, X, Shield,
  Loader2, AlertCircle, CheckCircle2, UserPlus, Mail, User,
  Eye, EyeOff, FolderOpen, Clock, ChevronDown,
  MapPin, Key, Copy, Power, Check, Building2, Wifi,
} from "lucide-react";
import { usePageSEO } from "@/hooks/usePageSEO";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/* ─── Password generator ─── */
function generatePassword(length = 14): string {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const specials = "!@#$%&*?";
  const all = upper + lower + digits + specials;
  // Ensure at least one from each
  let pw = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    specials[Math.floor(Math.random() * specials.length)],
  ];
  for (let i = pw.length; i < length; i++) {
    pw.push(all[Math.floor(Math.random() * all.length)]);
  }
  // Shuffle
  for (let i = pw.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pw[i], pw[j]] = [pw[j], pw[i]];
  }
  return pw.join("");
}

/* ─── MultiSelect Dropdown ─── */
function MultiSelectDropdown({
  label,
  icon: Icon,
  options,
  selected,
  onToggle,
  onSelectAll,
  onClearAll,
  renderOption,
  emptyText = "Nenhuma opção.",
  searchable = false,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  options: { value: string | number; label: string }[];
  selected: (string | number)[];
  onToggle: (value: string | number) => void;
  onSelectAll?: () => void;
  onClearAll?: () => void;
  renderOption?: (opt: { value: string | number; label: string }, isSelected: boolean) => React.ReactNode;
  emptyText?: string;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [openUpward, setOpenUpward] = useState(false);
  const [menuMaxHeight, setMenuMaxHeight] = useState(256);
  const [menuStyle, setMenuStyle] = useState<{ top?: number; bottom?: number; left: number; width: number }>({
    left: 0,
    width: 0,
  });
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!open) return;

    const updateMenuPosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const viewportPadding = 16;
      const preferredMaxHeight = 320;
      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
      const spaceAbove = rect.top - viewportPadding;
      const shouldOpenUpward = spaceBelow < 220 && spaceAbove > spaceBelow;
      const availableSpace = shouldOpenUpward ? spaceAbove : spaceBelow;
      const nextTop = shouldOpenUpward ? undefined : rect.bottom + 4;
      const nextBottom = shouldOpenUpward ? window.innerHeight - rect.top + 4 : undefined;

      setOpenUpward(shouldOpenUpward);
      setMenuMaxHeight(Math.max(140, Math.min(preferredMaxHeight, availableSpace)));
      setMenuStyle({
        left: Math.max(viewportPadding, rect.left),
        width: rect.width,
        top: nextTop,
        bottom: nextBottom,
      });
    };

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open]);

  const filtered = searchable && search.trim()
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const allSelected = options.length > 0 && selected.length === options.length;

  return (
    <div className="min-w-0 space-y-1.5" ref={ref}>
      <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--task-text-muted))]">
        <Icon className="h-3 w-3 shrink-0" /> {label}
        <span className="text-[hsl(var(--task-text-muted)/0.5)]">({selected.length})</span>
      </label>
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(!open)}
          className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-[hsl(var(--task-border))] bg-[hsl(var(--task-bg))] px-3 text-xs text-[hsl(var(--task-text))] transition hover:border-[hsl(var(--task-purple)/0.4)]"
        >
          <span className="min-w-0 flex-1 truncate text-left">
            {selected.length === 0
              ? "Selecionar..."
              : allSelected
                ? "Todos selecionados"
                : `${selected.length} selecionado${selected.length > 1 ? "s" : ""}`}
          </span>
          <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-[hsl(var(--task-text-muted))] transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {typeof document !== "undefined" &&
          createPortal(
            <AnimatePresence>
              {open && (
                <motion.div
                  ref={menuRef}
                  initial={{ opacity: 0, y: openUpward ? 4 : -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: openUpward ? 4 : -4 }}
                  transition={{ duration: 0.15 }}
                  style={{
                    position: "fixed",
                    left: menuStyle.left,
                    width: menuStyle.width,
                    top: menuStyle.top,
                    bottom: menuStyle.bottom,
                    maxHeight: `${menuMaxHeight}px`,
                  }}
                  className="z-[100] overflow-y-auto rounded-lg border border-[hsl(var(--task-border))] bg-[hsl(var(--task-surface))] shadow-xl shadow-black/30"
                >
                  <div className="sticky top-0 space-y-1.5 border-b border-[hsl(var(--task-border))] bg-[hsl(var(--task-surface))] p-2">
                    {searchable && (
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[hsl(var(--task-text-muted))]" />
                        <input
                          value={search}
                          onChange={e => setSearch(e.target.value)}
                          placeholder="Buscar..."
                          className="h-7 w-full rounded-md border border-[hsl(var(--task-border))] bg-[hsl(var(--task-bg))] pl-7 pr-2 text-[11px] text-[hsl(var(--task-text))] outline-none focus:border-[hsl(var(--task-purple)/0.5)] placeholder:text-[hsl(var(--task-text-muted)/0.4)]"
                          autoFocus
                        />
                      </div>
                    )}
                    {(onSelectAll || onClearAll) && options.length > 0 && (
                      <div className="flex gap-1.5">
                        {onSelectAll && !allSelected && (
                          <button
                            type="button"
                            onClick={onSelectAll}
                            className="flex-1 rounded-md border border-[hsl(var(--task-purple)/0.3)] bg-[hsl(var(--task-purple)/0.08)] px-2 py-1 text-[10px] font-semibold text-[hsl(var(--task-purple))] transition hover:bg-[hsl(var(--task-purple)/0.15)]"
                          >
                            ✓ Selecionar Todos
                          </button>
                        )}
                        {onClearAll && selected.length > 0 && (
                          <button
                            type="button"
                            onClick={onClearAll}
                            className="flex-1 rounded-md border border-rose-500/20 bg-rose-500/8 px-2 py-1 text-[10px] font-semibold text-rose-400 transition hover:bg-rose-500/15"
                          >
                            ✕ Limpar Todos
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {filtered.length === 0 && (
                    <p className="px-3 py-4 text-center text-[11px] text-[hsl(var(--task-text-muted))]">{emptyText}</p>
                  )}
                  {filtered.map(opt => {
                    const isSelected = selected.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => onToggle(opt.value)}
                        className={`flex w-full items-start gap-2 px-3 py-2.5 text-left text-[11px] transition hover:bg-[hsl(var(--task-surface-hover))] ${
                          isSelected ? "text-[hsl(var(--task-purple))]" : "text-[hsl(var(--task-text))]"
                        }`}
                      >
                        <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                          isSelected
                            ? "border-[hsl(var(--task-purple))] bg-[hsl(var(--task-purple)/0.2)]"
                            : "border-[hsl(var(--task-border-light))]"
                        }`}>
                          {isSelected && <Check className="h-2.5 w-2.5" />}
                        </div>
                        {renderOption ? renderOption(opt, isSelected) : (
                          <span className="min-w-0 flex-1 break-words pr-2 leading-4 whitespace-normal">
                            {opt.label}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>,
            document.body,
          )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════ */
/* ─── Main Component ─── */
/* ═══════════════════════════════════════════════ */
export default function UsuariosPage() {
  usePageSEO("/usuarios");
  const navigate = useNavigate();
  const { session, loadingSession } = useAuth();
  const isAdmin = session?.role === "admin" || session?.role === "gerente" || session?.role === "coordenador";
  const token = session?.accessToken;
  const api = useUsersApi(token);
  const onlineUsers = useOnlineUsers();

  useEffect(() => {
    if (!loadingSession && !session) { navigate("/login"); return; }
    if (!loadingSession && session && !isAdmin) { navigate("/"); return; }
  }, [loadingSession, session, isAdmin, navigate]);

  const [filter, setFilter] = useState("");
  const [clienteFilter, setClienteFilter] = useState<number | "all">("all");
  const [profileFilter, setProfileFilter] = useState<string>("all");
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"users">("users");

  // Edit state
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState<Partial<UserRow>>({});
  const [editAreas, setEditAreas] = useState<string[]>([]);
  const [editProjects, setEditProjects] = useState<number[]>([]);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [showEditPanel, setShowEditPanel] = useState(false);

  // Reset password state
  const [editNewPassword, setEditNewPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [copiedEditPw, setCopiedEditPw] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  // Create state
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    user_profile: "Consultor" as Perfil,
    bonus_role: "consultor" as "admin" | "gestor" | "consultor",
    seniority: null as "junior" | "pleno" | "senior" | null,
    my_coordinator: null as string | null,
    subordinate_ids: [] as string[],
    bitrix_user_id: "",
    password: "",
    cliente_id: null as number | null,
  });
  const [createAreas, setCreateAreas] = useState<string[]>(["home"]);
  const [createProjects, setCreateProjects] = useState<number[]>([]);
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedPw, setCopiedPw] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Delete
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const profileOptions = PERFIS.map((perfil) => ({ value: perfil, label: perfil }));

  const showFeedback = (type: "ok" | "error", message: string) => {
    setFeedback({ type, message });
    if (type === "ok") setTimeout(() => setFeedback(null), 4000);
  };

  /* ─── Password helpers ─── */
  const handleGeneratePassword = () => {
    const pw = generatePassword();
    setCreateForm(p => ({ ...p, password: pw }));
    setShowPassword(true);
  };

  const handleCopyPassword = async () => {
    if (createForm.password) {
      await navigator.clipboard.writeText(createForm.password);
      setCopiedPw(true);
      setTimeout(() => setCopiedPw(false), 2000);
    }
  };

  const handleCopyField = async (field: string, value: string) => {
    if (value) {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const handleCopyAll = async () => {
    const lines = [
      `Nome: ${createForm.name}`,
      `E-mail: ${createForm.email}`,
      `Perfil: ${createForm.user_profile}`,
      `Papel: ${createForm.bonus_role}`,
      `Senha: ${createForm.password}`,
    ].filter(l => !l.endsWith(": "));
    await navigator.clipboard.writeText(lines.join("\n"));
    setCopiedField("all");
    setTimeout(() => setCopiedField(null), 2000);
  };

  /* ─── Start edit ─── */
  const startEdit = useCallback(async (user: UserRow) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      user_profile: user.user_profile,
      active: user.active,
      cliente_id: user.cliente_id ?? null,
      bonus_role: user.bonus_role ?? "consultor",
      seniority: user.seniority ?? null,
      my_coordinator: user.my_coordinator ?? null,
      subordinate_ids: user.subordinate_ids ?? [],
      bitrix_user_id: user.bitrix_user_id ?? "",
    });
    setShowEditPanel(true);
    setShowCreate(false);

    if (user.auth_user_id) {
      const [areas, projects] = await Promise.all([
        api.getUserAreas(user.auth_user_id),
        api.getUserProjects(user.auth_user_id),
      ]);
      setEditAreas(areas);
      setEditProjects(projects);
    } else {
      setEditAreas([]);
      setEditProjects([]);
    }
  }, [api]);

  const cancelEdit = () => {
    setEditingUser(null);
    setEditForm({});
    setEditAreas([]);
    setEditProjects([]);
    setShowEditPanel(false);
    setEditNewPassword("");
    setShowEditPassword(false);
  };

  /* ─── Reset password ─── */
  const handleResetPassword = async () => {
    if (!editingUser || !token) return;
    if (!editNewPassword.trim() || editNewPassword.trim().length < 6) {
      showFeedback("error", "A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setResettingPassword(true);
    try {
      await callManageUser(token, {
        action: "reset_password",
        authUserId: editingUser.auth_user_id,
        newPassword: editNewPassword.trim(),
      });
      showFeedback("ok", `Senha de "${editingUser.name}" redefinida com sucesso!`);
      setEditNewPassword("");
      setShowEditPassword(false);
      setCopiedEditPw(false);
    } catch (err) {
      showFeedback("error", err instanceof Error ? err.message : "Falha ao redefinir senha.");
    } finally {
      setResettingPassword(false);
    }
  };

  const handleGenerateEditPassword = () => {
    const pw = generatePassword();
    setEditNewPassword(pw);
    setShowEditPassword(true);
  };

  const handleCopyEditPassword = async () => {
    if (editNewPassword) {
      await navigator.clipboard.writeText(editNewPassword);
      setCopiedEditPw(true);
      setTimeout(() => setCopiedEditPw(false), 2000);
    }
  };

  /* ─── Save edit ─── */
  const saveEdit = async () => {
    if (!editingUser || !session || !token) return;
    setLoadingEdit(true);
    try {
      await callManageUser(token, {
        action: "update",
        userId: editingUser.id,
        authUserId: editingUser.auth_user_id,
        payload: {
          ...editForm,
          cliente_id: editForm.cliente_id ?? null,
        },
        areas: editAreas,
        projects: editProjects,
        my_coordinator: editForm.my_coordinator ?? null,
        subordinate_ids: editForm.subordinate_ids ?? [],
      });
      showFeedback("ok", "Usuário atualizado com sucesso.");
      cancelEdit();
      api.loadUsers();
    } catch (err) {
      showFeedback("error", err instanceof Error ? err.message : "Falha ao atualizar.");
    } finally {
      setLoadingEdit(false);
    }
  };

  /* ─── Create user ─── */
  const handleCreate = async () => {
    if (!token || !session) return;
    const { name, email, user_profile, password, cliente_id, bonus_role, seniority, my_coordinator, subordinate_ids, bitrix_user_id } = createForm;
    if (!name.trim() || !email.trim()) {
      showFeedback("error", "Nome e e-mail são obrigatórios.");
      return;
    }
    if (!password.trim()) {
      showFeedback("error", "Gere ou insira uma senha para o usuário.");
      return;
    }
    setCreating(true);
    try {
      await callManageUser(token, {
        action: "create",
        email: email.trim(),
        password: password.trim(),
        name: name.trim(),
        user_profile: user_profile || "Consultor",
        role: bonus_role,
        seniority,
        my_coordinator,
        subordinate_ids,
        bitrix_user_id: bitrix_user_id.trim() || null,
        cliente_id: cliente_id ?? null,
        areas: createAreas,
        projects: createProjects,
      });

      showFeedback("ok", `Usuário "${name.trim()}" criado com sucesso!`);
      setCreateForm({
        name: "",
        email: "",
        user_profile: "Consultor",
        bonus_role: "consultor",
        seniority: null,
        my_coordinator: null,
        subordinate_ids: [],
        bitrix_user_id: "",
        password: "",
        cliente_id: null,
      });
      setCreateAreas(["home"]);
      setCreateProjects([]);
      setShowCreate(false);
      setShowPassword(false);
      api.loadUsers();
    } catch (err) {
      showFeedback("error", err instanceof Error ? err.message : "Falha ao criar usuário.");
    } finally {
      setCreating(false);
    }
  };

  /* ─── Delete user ─── */
  const handleDelete = async (user: UserRow) => {
    if (!session || !token) return;
    setDeletingId(user.id);
    try {
      await callManageUser(token, {
        action: "delete",
        authUserId: user.auth_user_id,
      });
      showFeedback("ok", "Usuário removido com sucesso.");
      setConfirmDeleteId(null);
      api.loadUsers();
    } catch (err) {
      showFeedback("error", err instanceof Error ? err.message : "Falha ao remover.");
    } finally {
      setDeletingId(null);
    }
  };

  /* ─── Deactivate / Disconnect ─── */
  const handleDeactivate = async (user: UserRow) => {
    if (!session || !token) return;
    try {
      await callManageUser(token, {
        action: "deactivate",
        userId: user.id,
        authUserId: user.auth_user_id,
      });
      showFeedback("ok", `Usuário "${user.name}" desconectado.`);
      api.loadUsers();
    } catch (err) {
      showFeedback("error", err instanceof Error ? err.message : "Falha ao desconectar.");
    }
  };


  /* ─── Filter ─── */
  const filteredUsers = useMemo(() => {
    let list = api.users;
    if (clienteFilter !== "all") {
      list = list.filter(u => u.cliente_id === clienteFilter);
    }
    if (profileFilter !== "all") {
      list = list.filter(u => u.user_profile === profileFilter);
    }
    const term = filter.trim().toLowerCase();
    if (term) {
      list = list.filter(u =>
        u.email.toLowerCase().includes(term) ||
        u.name.toLowerCase().includes(term) ||
        u.user_profile.toLowerCase().includes(term)
      );
    }
    return list;
  }, [filter, clienteFilter, profileFilter, api.users]);

  const clienteMap = useMemo(() => {
    const m = new Map<number, string>();
    api.clientes.forEach(c => m.set(c.cliente_id, c.nome));
    return m;
  }, [api.clientes]);

  const stats = useMemo(() => ({
    total: api.users.length,
    admins: api.users.filter(u => u.user_profile === "Administrador").length,
    consultors: api.users.filter(u => u.user_profile === "Consultor").length,
    active: api.users.filter(u => u.active !== false).length,
    online: onlineUsers.size,
  }), [api.users, onlineUsers]);

  const formatLoginTime = (isoString: string): string => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  /* ─── Dropdown helpers ─── */
  const areaOptions = ALL_AREAS.map(a => ({ value: a.value, label: a.label }));
  const projectOptions = useMemo(() =>
    [...api.projects]
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      .map(p => ({ value: p.id, label: p.name })),
    [api.projects]
  );
  const clienteOptions = useMemo(() =>
    api.clientes
      .filter(c => c.Ativo)
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
      .map(c => ({ value: c.cliente_id, label: c.nome })),
    [api.clientes]
  );

  const toggleInList = <T extends string | number>(val: T, list: T[], setter: (v: T[]) => void) => {
    setter(list.includes(val) ? list.filter(v => v !== val) : [...list, val]);
  };

  const subordinateOptions = useMemo(
    () => api.users
      .filter(u => u.active !== false)
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      .map(u => ({ value: u.id, label: `${u.name} · ${u.email}` })),
    [api.users]
  );

  const coordinatorOptions = useMemo(
    () => api.users
      .filter(u => u.active !== false && (normalizeBonusRole(u.bonus_role ?? u.user_profile) === "gestor" || normalizeBonusRole(u.bonus_role ?? u.user_profile) === "admin"))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      .map(u => ({ value: u.id, label: u.name, email: u.email })),
    [api.users]
  );

  const createShowsSubordinates = createForm.bonus_role === "gestor" || createForm.bonus_role === "admin" || createForm.subordinate_ids.length > 0;
  const createShowsCoordinator = createForm.bonus_role === "consultor" || Boolean(createForm.my_coordinator);
  const editShowsSubordinates =
    ((editForm.bonus_role as string) === "gestor" || (editForm.bonus_role as string) === "admin") ||
    (((editForm.subordinate_ids as string[]) ?? []).length > 0);
  const editShowsCoordinator =
    (editForm.bonus_role as string) === "consultor" ||
    Boolean(editForm.my_coordinator);

  const taskSelectTriggerClass = "h-9 w-full rounded-lg border-[hsl(var(--task-border))] bg-[hsl(var(--task-bg))] px-3 text-xs text-[hsl(var(--task-text))] outline-none focus:ring-0 focus:ring-transparent focus:border-[hsl(var(--task-purple)/0.5)] data-[placeholder]:text-[hsl(var(--task-text-muted)/0.4)]";
  const taskSelectTriggerTallClass = "h-auto min-h-10 w-full rounded-lg border-[hsl(var(--task-border))] bg-[hsl(var(--task-bg))] px-3 py-2 text-sm text-[hsl(var(--task-text))] outline-none focus:ring-0 focus:ring-transparent focus:border-[hsl(var(--task-purple)/0.5)] data-[placeholder]:text-[hsl(var(--task-text-muted)/0.4)] [&>span]:line-clamp-none [&>span]:whitespace-normal [&>span]:text-left";
  const taskSelectTriggerFilterClass = "h-10 w-full rounded-xl border-[hsl(var(--task-border))] bg-[hsl(var(--task-bg)/0.6)] px-3 text-xs text-[hsl(var(--task-text))] transition-all focus:ring-0 focus:ring-transparent focus:border-[hsl(var(--task-purple)/0.5)] focus:shadow-[0_0_0_3px_hsl(var(--task-purple)/0.08)] data-[placeholder]:text-[hsl(var(--task-text-muted)/0.4)] sm:w-48";
  const taskSelectContentClass = "rounded-lg border-[hsl(var(--task-border))] bg-[hsl(var(--task-surface))] text-[hsl(var(--task-text))] shadow-xl shadow-black/30";
  const taskSelectItemClass = "rounded-md py-2 text-xs focus:bg-[hsl(var(--task-surface-hover))] focus:text-[hsl(var(--task-text))]";

  const profileColor = (profile: string) => {
    if (profile === "Administrador") return "text-[hsl(var(--task-yellow))] bg-[hsl(var(--task-yellow)/0.1)] border-[hsl(var(--task-yellow)/0.2)]";
    if (profile === "Gerente") return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    if (profile === "Coordenador") return "text-sky-400 bg-sky-500/10 border-sky-500/20";
    if (profile === "Cliente") return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    return "text-[hsl(var(--task-purple))] bg-[hsl(var(--task-purple)/0.1)] border-[hsl(var(--task-purple)/0.2)]";
  };

  if (loadingSession || (!session && !loadingSession)) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--task-purple))]" />
      </div>
    );
  }
  if (!isAdmin) return null;

  return (
    <div className="page-gradient w-full">
      <div className="mx-auto w-full max-w-[1920px] space-y-5 p-4 sm:p-5 md:p-8">

        {/* ═══ HEADER ═══ */}
        <PageHeaderCard
          icon={Shield}
          title="Gestão de Usuários"
          subtitle="Gerencie acessos, permissões e projetos."
          actions={
            <>
              <button onClick={() => { setShowCreate(!showCreate); setShowEditPanel(false); }}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[hsl(262_83%_58%)] to-[hsl(234_89%_64%)] px-3 sm:px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-[hsl(262_83%_58%/0.3)] transition hover:shadow-[hsl(262_83%_58%/0.5)] hover:scale-[1.02] active:scale-[0.98]"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Novo Usuário</span>
                <span className="sm:hidden">Novo</span>
              </button>
              <button onClick={async () => {
                if (!token) return;
                if (!confirm("Remover todos os usuários órfãos do Auth (sem registro na tabela)?")) return;
                try {
                  const result = await callManageUser(token, { action: "cleanup_orphans" });
                  const count = (result.data as { count?: number })?.count ?? 0;
                  showFeedback("ok", `${count} usuário(s) órfão(s) removido(s).`);
                  api.loadUsers();
                } catch (err) {
                  showFeedback("error", err instanceof Error ? err.message : "Falha na limpeza.");
                }
              }}
                className="flex items-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-400 transition hover:border-amber-500/40 hover:bg-amber-500/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Limpar Órfãos</span>
              </button>
              <button onClick={() => api.loadUsers()} disabled={api.loading}
                className="flex items-center gap-1.5 rounded-xl border border-[hsl(var(--task-border))] bg-[hsl(var(--task-surface))] px-3 py-2 text-xs font-medium text-[hsl(var(--task-text-muted))] transition hover:border-[hsl(var(--task-purple)/0.4)] hover:text-[hsl(var(--task-purple))] disabled:opacity-40"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${api.loading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Atualizar</span>
              </button>
            </>
          }
        />

        {/* ═══ FEEDBACK ═══ */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: -8, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, y: -8, height: 0 }}
              className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
                feedback.type === "ok"
                  ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                  : "border border-rose-500/20 bg-rose-500/10 text-rose-300"
              }`}
            >
              {feedback.type === "ok" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
              <span className="flex-1">{feedback.message}</span>
              <button onClick={() => setFeedback(null)} className="text-white/30 hover:text-white/60"><X className="h-3.5 w-3.5" /></button>
            </motion.div>
          )}
        </AnimatePresence>


        {/* Users content */}
            {/* ═══ CREATE FORM ═══ */}
            <AnimatePresence>
              {showCreate && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-visible">
                  <div className="task-card p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-[hsl(var(--task-text))] flex items-center gap-2">
                        <UserPlus className="h-4 w-4 text-[hsl(var(--task-purple))]" />
                        Criar Novo Usuário
                      </h3>
                      <button onClick={() => setShowCreate(false)} className="text-[hsl(var(--task-text-muted))] hover:text-[hsl(var(--task-text))]"><X className="h-4 w-4" /></button>
                    </div>

                    {/* Bitrix warning */}
                    <p className="text-[10px] text-amber-400/80 leading-tight">⚠ Use o mesmo nome cadastrado no Bitrix para que o filtro de tarefas funcione corretamente.</p>

                    {/* Row 1: Name + Email */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-wider text-[hsl(var(--task-text-muted))] font-semibold">Nome *</label>
                        <div className="flex gap-1">
                          <div className="relative flex-1 min-w-0">
                            <User className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--task-text-muted))]" />
                            <input value={createForm.name} onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))} placeholder="Nome completo"
                              className="h-9 w-full rounded-lg border border-[hsl(var(--task-border))] bg-[hsl(var(--task-bg))] pl-8 pr-3 text-xs text-[hsl(var(--task-text))] outline-none focus:border-[hsl(var(--task-purple)/0.5)] placeholder:text-[hsl(var(--task-text-muted)/0.4)]" />
                          </div>
                          {createForm.name && (
                            <button type="button" onClick={() => handleCopyField("name", createForm.name)} title="Copiar nome"
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[hsl(var(--task-border))] bg-[hsl(var(--task-bg))] text-[hsl(var(--task-text-muted))] hover:border-emerald-500/40 hover:text-emerald-400 transition">
                              {copiedField === "name" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-wider text-[hsl(var(--task-text-muted))] font-semibold">E-mail *</label>
                        <div className="flex gap-1">
                          <div className="relative flex-1 min-w-0">
                            <Mail className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--task-text-muted))]" />
                            <input value={createForm.email} onChange={e => setCreateForm(p => ({ ...p, email: e.target.value }))} placeholder="usuario@email.com" type="email"
                              className="h-9 w-full rounded-lg border border-[hsl(var(--task-border))] bg-[hsl(var(--task-bg))] pl-8 pr-3 text-xs text-[hsl(var(--task-text))] outline-none focus:border-[hsl(var(--task-purple)/0.5)] placeholder:text-[hsl(var(--task-text-muted)/0.4)]" />
                          </div>
                          {createForm.email && (
                            <button type="button" onClick={() => handleCopyField("email", createForm.email)} title="Copiar e-mail"
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[hsl(var(--task-border))] bg-[hsl(var(--task-bg))] text-[hsl(var(--task-text-muted))] hover:border-emerald-500/40 hover:text-emerald-400 transition">
                              {copiedField === "email" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Row 2: Permission + Seniority + Password */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 items-end">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-wider text-[hsl(var(--task-text-muted))] font-semibold">Papel / Permissão</label>
                        <Select
                          value={createForm.user_profile}
                          onValueChange={(value) => setCreateForm(p => ({
                            ...p,
                            user_profile: value as Perfil,
                          }))}
                        >
                          <SelectTrigger className={taskSelectTriggerClass}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className={taskSelectContentClass}>
                            {profileOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value} className={taskSelectItemClass}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-wider text-[hsl(var(--task-text-muted))] font-semibold">Papel Bonificação</label>
                        <Select
                          value={createForm.bonus_role}
                          onValueChange={(value) => setCreateForm(p => ({
                            ...p,
                            bonus_role: value as "admin" | "gestor" | "consultor",
                          }))}
                        >
                          <SelectTrigger className={taskSelectTriggerClass}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className={taskSelectContentClass}>
                            <SelectItem value="consultor" className={taskSelectItemClass}>Consultor</SelectItem>
                            <SelectItem value="gestor" className={taskSelectItemClass}>Gestor / Coordenador</SelectItem>
                            <SelectItem value="admin" className={taskSelectItemClass}>Administrador</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5 lg:col-span-1">
                        <label className="text-[10px] uppercase tracking-wider text-[hsl(var(--task-text-muted))] font-semibold">Nível de Senioridade</label>
                        <Select
                          value={createForm.seniority ?? "none"}
                          onValueChange={(value) => setCreateForm(p => ({
                            ...p,
                            seniority: value === "none" ? null : value as "junior" | "pleno" | "senior",
                          }))}
                        >
                          <SelectTrigger className={taskSelectTriggerClass}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className={taskSelectContentClass}>
                            <SelectItem value="none" className={taskSelectItemClass}>Não definido</SelectItem>
                            <SelectItem value="junior" className={taskSelectItemClass}>Júnior</SelectItem>
                            <SelectItem value="pleno" className={taskSelectItemClass}>Pleno</SelectItem>
                            <SelectItem value="senior" className={taskSelectItemClass}>Sênior</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5 lg:col-span-1">
                        <label className="text-[10px] uppercase tracking-wider text-[hsl(var(--task-text-muted))] font-semibold flex items-center gap-1">
                          <Key className="h-3 w-3" /> Senha *
                        </label>
                        <div className="flex gap-1 h-9">
                          <div className="relative flex-1 min-w-0">
                            <input
                              type={showPassword ? "text" : "password"}
                              value={createForm.password}
                              onChange={e => setCreateForm(p => ({ ...p, password: e.target.value }))}
                              placeholder="Gere uma senha"
                              className="h-9 w-full rounded-lg border border-[hsl(var(--task-border))] bg-[hsl(var(--task-bg))] pl-3 pr-8 text-xs text-[hsl(var(--task-text))] outline-none focus:border-[hsl(var(--task-purple)/0.5)] placeholder:text-[hsl(var(--task-text-muted)/0.4)]"
                            />
                            <button type="button" onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-[hsl(var(--task-text-muted))] hover:text-[hsl(var(--task-text))]">
                              {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            </button>
                          </div>
                          <button type="button" onClick={handleGeneratePassword} title="Gerar senha"
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[hsl(var(--task-border))] bg-[hsl(var(--task-bg))] text-[hsl(var(--task-text-muted))] hover:border-[hsl(var(--task-purple)/0.4)] hover:text-[hsl(var(--task-purple))] transition">
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                          {createForm.password && (
                            <button type="button" onClick={handleCopyPassword} title="Copiar senha"
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[hsl(var(--task-border))] bg-[hsl(var(--task-bg))] text-[hsl(var(--task-text-muted))] hover:border-emerald-500/40 hover:text-emerald-400 transition">
                              {copiedPw ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Row 3: Cliente */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-wider text-[hsl(var(--task-text-muted))] font-semibold flex items-center gap-1">
                        <Building2 className="h-3 w-3" /> Cliente
                      </label>
                      <Select
                        value={createForm.cliente_id ? String(createForm.cliente_id) : "none"}
                        onValueChange={(value) => setCreateForm(p => ({ ...p, cliente_id: value === "none" ? null : Number(value) }))}
                      >
                        <SelectTrigger className={taskSelectTriggerClass}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className={taskSelectContentClass}>
                          <SelectItem value="none" className={taskSelectItemClass}>Nenhum cliente</SelectItem>
                          {clienteOptions.map((c) => (
                            <SelectItem key={c.value} value={String(c.value)} className={taskSelectItemClass}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-wider text-[hsl(var(--task-text-muted))] font-semibold">ID usuário Bitrix</label>
                      <input
                        value={createForm.bitrix_user_id}
                        onChange={e => setCreateForm(p => ({ ...p, bitrix_user_id: e.target.value }))}
                        placeholder="Opcional — usado para lembretes no Bitrix"
                        className="h-9 w-full rounded-lg border border-[hsl(var(--task-border))] bg-[hsl(var(--task-bg))] px-3 text-xs text-[hsl(var(--task-text))] outline-none focus:border-[hsl(var(--task-purple)/0.5)]"
                      />
                    </div>
                    </div>

                    {createShowsSubordinates && (
                      <MultiSelectDropdown
                        label="Consultores sob coordenação"
                        icon={Users}
                        options={subordinateOptions.filter(opt => opt.value !== editingUser?.id)}
                        selected={createForm.subordinate_ids}
                        onToggle={(v) => toggleInList(v as string, createForm.subordinate_ids, (vals) => setCreateForm(p => ({ ...p, subordinate_ids: vals })))}
                        onClearAll={() => setCreateForm(p => ({ ...p, subordinate_ids: [] }))}
                        searchable
                        emptyText="Nenhum consultor disponível."
                      />
                    )}

                    {createShowsCoordinator && (
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-wider text-[hsl(var(--task-text-muted))] font-semibold">Responsável / Coordenador</label>
                        <Select
                          value={createForm.my_coordinator ?? "none"}
                          onValueChange={(value) => setCreateForm(p => ({ ...p, my_coordinator: value === "none" ? null : value }))}
                        >
                          <SelectTrigger className={taskSelectTriggerTallClass}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className={taskSelectContentClass}>
                            <SelectItem value="none" className={taskSelectItemClass}>Sem responsável definido</SelectItem>
                            {coordinatorOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value} className={`${taskSelectItemClass} whitespace-normal pr-8 leading-4`}>
                                {option.label} — {option.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Row 4: Areas & Projects dropdowns */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <MultiSelectDropdown
                        label="Áreas Permitidas"
                        icon={MapPin}
                        options={areaOptions}
                        selected={createAreas}
                        onToggle={(v) => toggleInList(v as string, createAreas, setCreateAreas)}
                        onSelectAll={() => setCreateAreas(areaOptions.map(a => a.value as string))}
                        onClearAll={() => setCreateAreas([])}
                      />
                      <MultiSelectDropdown
                        label="Projetos Acessíveis"
                        icon={FolderOpen}
                        options={projectOptions}
                        selected={createProjects}
                        onToggle={(v) => toggleInList(v as number, createProjects, setCreateProjects)}
                        onSelectAll={() => setCreateProjects(projectOptions.map(p => p.value as number))}
                        onClearAll={() => setCreateProjects([])}
                        emptyText="Nenhum projeto encontrado."
                        searchable
                      />
                    </div>

                    <div className="flex justify-between gap-2">
                      {(createForm.name || createForm.email || createForm.password) && (
                        <button type="button" onClick={handleCopyAll}
                          className="flex items-center gap-1.5 rounded-lg border border-[hsl(var(--task-border))] bg-[hsl(var(--task-bg))] px-3 py-2 text-xs font-medium text-[hsl(var(--task-text-muted))] hover:border-emerald-500/40 hover:text-emerald-400 transition">
                          {copiedField === "all" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                          {copiedField === "all" ? "Copiado!" : "Copiar Tudo"}
                        </button>
                      )}
                      <div className="flex gap-2 ml-auto">
                        <button onClick={() => setShowCreate(false)}
                          className="rounded-lg border border-[hsl(var(--task-border))] px-4 py-2 text-xs font-medium text-[hsl(var(--task-text-muted))] hover:text-[hsl(var(--task-text))] transition">
                          Cancelar
                        </button>
                        <button onClick={handleCreate} disabled={creating}
                          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[hsl(262_83%_58%)] to-[hsl(234_89%_64%)] px-4 py-2 text-xs font-semibold text-white transition hover:shadow-lg disabled:opacity-50">
                          {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                          Criar Usuário
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ═══ STATS ═══ */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
            >
              {[
                { label: "Total", value: stats.total, icon: Users, color: "purple" },
                { label: "Admins", value: stats.admins, icon: Shield, color: "yellow" },
                { label: "Consultores", value: stats.consultors, icon: User, color: "blue" },
                { label: "Ativos", value: stats.active, icon: CheckCircle2, color: "green" },
                { label: "Online agora", value: stats.online, icon: Wifi, color: "teal" },
              ].map(s => (
                <div
                  key={s.label}
                  className={`task-card flex items-center gap-3 p-3 sm:p-4 min-w-0 overflow-hidden transition-all ${
                    s.color === "teal" && s.value > 0
                      ? "border border-teal-500/30 shadow-[0_0_16px_hsl(160_60%_40%/0.12)]"
                      : ""
                  }`}
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    s.color === "purple" ? "bg-[hsl(var(--task-purple)/0.15)] text-[hsl(var(--task-purple))]" :
                    s.color === "yellow" ? "bg-[hsl(var(--task-yellow)/0.15)] text-[hsl(var(--task-yellow))]" :
                    s.color === "blue" ? "bg-[hsl(220_90%_56%/0.15)] text-[hsl(220_90%_56%)]" :
                    s.color === "teal" ? "bg-teal-500/15 text-teal-400" :
                    "bg-emerald-500/15 text-emerald-400"
                  }`}>
                    <s.icon className={`h-4 w-4 ${s.color === "teal" && s.value > 0 ? "animate-pulse" : ""}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] uppercase tracking-[0.15em] text-[hsl(var(--task-text-muted))] truncate">{s.label}</p>
                    <div className="flex items-center gap-1.5">
                      <p className={`text-xl font-extrabold ${
                        s.color === "teal" && s.value > 0 ? "text-teal-400" : "text-[hsl(var(--task-text))]"
                      }`}>{s.value}</p>
                      {s.color === "teal" && s.value > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold bg-teal-500/15 text-teal-400 border border-teal-500/25">
                          <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse" />
                          ao vivo
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>


            {/* ═══ MAIN CONTENT ═══ */}
            <div className={`grid gap-5 ${showEditPanel ? "grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(460px,1fr)] items-stretch" : "grid-cols-1"}`}>
              {/* ─── USER LIST ─── */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="task-card min-w-0 overflow-hidden flex flex-col xl:h-[calc(100vh-2rem)] xl:min-h-[820px]"
              >
                {/* ── Header com busca ── */}
                <div className="p-5 pb-4 space-y-4 shrink-0">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-base font-bold text-[hsl(var(--task-text))] flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(var(--task-purple)/0.15)]">
                        <Users className="h-3.5 w-3.5 text-[hsl(var(--task-purple))]" />
                      </div>
                      Usuários Cadastrados
                      <span className="ml-1 inline-flex items-center justify-center rounded-full bg-[hsl(var(--task-purple)/0.15)] px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--task-purple))]">
                        {filteredUsers.length}
                      </span>
                    </h2>
                    {/* Legenda de status */}
                    <div className="flex items-center gap-3 text-[10px] text-[hsl(var(--task-text-muted)/0.7)]">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-teal-400 shadow-[0_0_6px_rgba(45,212,191,0.6)]" />
                        Online
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--task-text-muted)/0.3)]" />
                        Offline
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                        Inativo
                      </span>
                    </div>
                  </div>

                  {/* Search + Client filter row */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--task-text-muted)/0.5)]" />
                      <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Buscar por nome, e-mail..."
                        className="h-10 w-full rounded-xl border border-[hsl(var(--task-border))] bg-[hsl(var(--task-bg)/0.6)] pl-10 pr-3 text-xs text-[hsl(var(--task-text))] outline-none transition-all focus:border-[hsl(var(--task-purple)/0.5)] focus:bg-[hsl(var(--task-bg))] focus:shadow-[0_0_0_3px_hsl(var(--task-purple)/0.08)] placeholder:text-[hsl(var(--task-text-muted)/0.4)]" />
                    </div>
                    <Select
                      value={clienteFilter === "all" ? "all" : String(clienteFilter)}
                      onValueChange={(value) => setClienteFilter(value === "all" ? "all" : Number(value))}
                    >
                      <SelectTrigger className={taskSelectTriggerFilterClass}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={taskSelectContentClass}>
                        <SelectItem value="all" className={taskSelectItemClass}>Todos os clientes</SelectItem>
                        {clienteOptions.map((c) => (
                          <SelectItem key={c.value} value={String(c.value)} className={taskSelectItemClass}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Profile filter chips */}
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: "all", label: "Todos" },
                      ...PERFIS.map(p => ({ key: p, label: p })),
                    ].map(chip => {
                      const isActive = profileFilter === chip.key;
                      const count = chip.key === "all" ? api.users.length : api.users.filter(u => u.user_profile === chip.key).length;
                      return (
                        <button key={chip.key} onClick={() => setProfileFilter(chip.key)}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all duration-200 ${
                            isActive
                              ? "bg-[hsl(var(--task-purple)/0.2)] text-[hsl(var(--task-purple))] border border-[hsl(var(--task-purple)/0.3)] shadow-[0_0_8px_hsl(var(--task-purple)/0.15)]"
                              : "bg-[hsl(var(--task-bg)/0.5)] text-[hsl(var(--task-text-muted))] border border-[hsl(var(--task-border)/0.5)] hover:border-[hsl(var(--task-purple)/0.25)] hover:text-[hsl(var(--task-text))] hover:bg-[hsl(var(--task-bg))]"
                          }`}>
                          {chip.label}
                          <span className={`inline-flex items-center justify-center rounded-full px-1.5 min-w-[18px] h-[18px] text-[9px] font-bold ${
                            isActive 
                              ? "bg-[hsl(var(--task-purple)/0.25)] text-[hsl(var(--task-purple))]" 
                              : "bg-[hsl(var(--task-border)/0.3)] text-[hsl(var(--task-text-muted)/0.6)]"
                          }`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Divider */}
                <div className="mx-5 border-t border-[hsl(var(--task-border)/0.3)]" />

                {api.loading && api.users.length === 0 && (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--task-purple))]" />
                    <span className="ml-2 text-sm text-[hsl(var(--task-text-muted))]">Carregando...</span>
                  </div>
                )}

                {!api.loading && filteredUsers.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(var(--task-bg))] border border-[hsl(var(--task-border)/0.3)] mb-4">
                      <Users className="h-6 w-6 text-[hsl(var(--task-text-muted)/0.25)]" />
                    </div>
                    <p className="text-sm font-medium text-[hsl(var(--task-text-muted))]">
                      {api.users.length === 0 ? "Nenhum usuário encontrado." : "Nenhum resultado para o filtro."}
                    </p>
                    <p className="text-xs text-[hsl(var(--task-text-muted)/0.5)] mt-1">Tente ajustar os filtros acima.</p>
                    {api.error && (
                      <p className="text-xs text-rose-400 mt-2">{api.error}</p>
                    )}
                  </div>
                )}

                {filteredUsers.length > 0 && (
                  <div
                    className="min-h-0 flex-1 overflow-y-auto p-3 pr-2 space-y-2"
                    style={{ scrollbarWidth: "thin" }}
                  >
                    {filteredUsers.map((user, idx) => {
                      const initials = (user.name || user.email || "U")
                        .split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
                          const isSelected = editingUser?.id === user.id;
                      const normalizedEmail = String(user.email ?? "").trim().toLowerCase();
                      const presenceEntry = onlineUsers.get(normalizedEmail) ?? onlineUsers.get(String(user.email ?? "").trim());
                      const isOnline = Boolean(presenceEntry);
                      const loginTime = presenceEntry ? formatLoginTime(presenceEntry.online_at) : null;

                      return (
                        <motion.div
                          key={user.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                          className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200 group cursor-pointer ${
                            isSelected 
                              ? "bg-[hsl(var(--task-purple)/0.08)] border border-[hsl(var(--task-purple)/0.25)] shadow-[0_0_12px_hsl(var(--task-purple)/0.08)]" 
                              : "bg-[hsl(var(--task-bg)/0.3)] border border-transparent hover:bg-[hsl(var(--task-bg)/0.6)] hover:border-[hsl(var(--task-border)/0.4)]"
                          }`}
                          onClick={() => startEdit(user)}
                        >
                          <div className="relative">
                            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition-all ${
                              isSelected
                                ? "bg-gradient-to-br from-[hsl(262_83%_58%)] to-[hsl(234_89%_64%)] text-white shadow-lg shadow-[hsl(262_83%_58%/0.3)]"
                                : "bg-[hsl(var(--task-purple)/0.12)] text-[hsl(var(--task-purple))]"
                            }`}>
                              {initials}
                            </div>
                            {/* Status dot: verde pulsante = online, cinza = offline, vermelho = inativo */}
                            <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[hsl(var(--task-surface))] transition-all ${
                              user.active === false
                                ? "bg-rose-400"
                                : isOnline
                                ? "bg-teal-400 shadow-[0_0_6px_rgba(45,212,191,0.6)]"
                                : "bg-[hsl(var(--task-text-muted)/0.3)]"
                            }`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-[hsl(var(--task-text))] truncate">{user.name || "Sem nome"}</p>
                              <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[10px] font-semibold ${profileColor(user.user_profile)}`}>
                                {user.user_profile || "Consultor"}
                              </span>
                              {user.active === false ? (
                                <span className="inline-flex items-center rounded-lg border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-400">Inativo</span>
                              ) : isOnline ? (
                                <span className="inline-flex items-center gap-1 rounded-lg border border-teal-500/20 bg-teal-500/10 px-2 py-0.5 text-[10px] font-semibold text-teal-400">
                                  <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse" />
                                  Online{loginTime ? ` · desde ${loginTime}` : ""}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-lg border border-[hsl(var(--task-border)/0.4)] bg-[hsl(var(--task-bg)/0.5)] px-2 py-0.5 text-[10px] font-semibold text-[hsl(var(--task-text-muted)/0.6)]">
                                  Offline
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-[11px] text-[hsl(var(--task-text-muted)/0.7)]">
                              <span className="flex items-center gap-1.5 truncate"><Mail className="h-3 w-3 shrink-0 opacity-50" />{user.email}</span>
                              {user.cliente_id && clienteMap.get(user.cliente_id) && (
                                <span className="flex items-center gap-1.5 truncate"><Building2 className="h-3 w-3 shrink-0 opacity-50" />{clienteMap.get(user.cliente_id)}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                            <button onClick={() => startEdit(user)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-[hsl(var(--task-text-muted))] hover:bg-[hsl(var(--task-purple)/0.12)] hover:text-[hsl(var(--task-purple))] transition" title="Editar">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => handleDeactivate(user)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-[hsl(var(--task-text-muted))] hover:bg-amber-500/10 hover:text-amber-400 transition" title="Desconectar">
                              <Power className="h-3.5 w-3.5" />
                            </button>
                            {confirmDeleteId === user.id ? (
                              <div className="flex items-center gap-1">
                                <button onClick={() => handleDelete(user)} disabled={deletingId === user.id}
                                  className="flex h-8 items-center gap-1 rounded-lg bg-rose-500/20 border border-rose-500/30 px-2.5 text-[10px] font-semibold text-rose-400 hover:bg-rose-500/30 transition disabled:opacity-50">
                                  {deletingId === user.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Confirmar
                                </button>
                                <button onClick={() => setConfirmDeleteId(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[hsl(var(--task-text-muted))] hover:text-[hsl(var(--task-text))]">
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => setConfirmDeleteId(user.id)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-[hsl(var(--task-text-muted))] hover:bg-rose-500/10 hover:text-rose-400 transition" title="Excluir">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </motion.div>

              {/* ─── EDIT PANEL ─── */}
              <AnimatePresence>
                {showEditPanel && editingUser && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                    className="task-card min-w-0 overflow-hidden flex flex-col xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)] xl:min-h-[820px]"
                  >
                    {/* Fixed header */}
                    <div className="flex items-center justify-between p-5 pb-3 shrink-0">
                      <h3 className="text-sm font-bold text-[hsl(var(--task-text))] flex items-center gap-2">
                        <Pencil className="h-4 w-4 text-[hsl(var(--task-purple))]" />
                        Editar Usuário
                      </h3>
                      <button onClick={cancelEdit} className="text-[hsl(var(--task-text-muted))] hover:text-[hsl(var(--task-text))]"><X className="h-4 w-4" /></button>
                    </div>

                    {/* Scrollable body */}
                    <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 space-y-4" style={{ scrollbarWidth: "thin" }}>

                    {/* User avatar & name */}
                    <div className="flex items-center gap-3 pb-3 border-b border-[hsl(var(--task-border))]">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--task-purple)/0.15)] text-sm font-bold text-[hsl(var(--task-purple))]">
                        {(editingUser.name || "U").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[hsl(var(--task-text))]">{editingUser.name}</p>
                        <p className="text-[11px] text-[hsl(var(--task-text-muted))]">{editingUser.email}</p>
                      </div>
                    </div>

                    {/* Basic fields */}
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-wider text-[hsl(var(--task-text-muted))] font-semibold">Nome</label>
                        <input value={editForm.name ?? ""} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                          className="h-9 w-full rounded-lg border border-[hsl(var(--task-border))] bg-[hsl(var(--task-bg))] px-3 text-xs text-[hsl(var(--task-text))] outline-none focus:border-[hsl(var(--task-purple)/0.5)]" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-wider text-[hsl(var(--task-text-muted))] font-semibold">E-mail</label>
                        <input value={editForm.email ?? ""} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}
                          className="h-9 w-full rounded-lg border border-[hsl(var(--task-border))] bg-[hsl(var(--task-bg))] px-3 text-xs text-[hsl(var(--task-text))] outline-none focus:border-[hsl(var(--task-purple)/0.5)]" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase tracking-wider text-[hsl(var(--task-text-muted))] font-semibold">Perfil de acesso</label>
                          <Select
                            value={(editForm.user_profile as string) ?? "Consultor"}
                            onValueChange={(value) => setEditForm(p => ({
                              ...p,
                              user_profile: value as Perfil,
                            }))}
                          >
                            <SelectTrigger className={taskSelectTriggerClass}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className={taskSelectContentClass}>
                              {profileOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value} className={taskSelectItemClass}>{option.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase tracking-wider text-[hsl(var(--task-text-muted))] font-semibold">Papel bonificação</label>
                          <Select
                            value={(editForm.bonus_role as string) ?? "consultor"}
                            onValueChange={(value) => setEditForm(p => ({
                              ...p,
                              bonus_role: value as "admin" | "gestor" | "consultor",
                            }))}
                          >
                            <SelectTrigger className={taskSelectTriggerClass}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className={taskSelectContentClass}>
                              <SelectItem value="consultor" className={taskSelectItemClass}>Consultor</SelectItem>
                              <SelectItem value="gestor" className={taskSelectItemClass}>Gestor / Coordenador</SelectItem>
                              <SelectItem value="admin" className={taskSelectItemClass}>Administrador</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase tracking-wider text-[hsl(var(--task-text-muted))] font-semibold">Status</label>
                          <button onClick={() => setEditForm(p => ({ ...p, active: !p.active }))}
                            className={`h-9 w-full flex items-center justify-center gap-1.5 rounded-lg border text-xs font-medium transition ${
                              editForm.active
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                                : "border-rose-500/30 bg-rose-500/10 text-rose-400"
                            }`}>
                            {editForm.active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                            {editForm.active ? "Ativo" : "Inativo"}
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase tracking-wider text-[hsl(var(--task-text-muted))] font-semibold">Senioridade</label>
                          <Select
                            value={(editForm.seniority as string) ?? "none"}
                            onValueChange={(value) => setEditForm(p => ({
                              ...p,
                              seniority: value === "none" ? null : value as "junior" | "pleno" | "senior",
                            }))}
                          >
                            <SelectTrigger className={taskSelectTriggerClass}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className={taskSelectContentClass}>
                              <SelectItem value="none" className={taskSelectItemClass}>Não definido</SelectItem>
                              <SelectItem value="junior" className={taskSelectItemClass}>Júnior</SelectItem>
                              <SelectItem value="pleno" className={taskSelectItemClass}>Pleno</SelectItem>
                              <SelectItem value="senior" className={taskSelectItemClass}>Sênior</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase tracking-wider text-[hsl(var(--task-text-muted))] font-semibold">ID usuário Bitrix</label>
                          <input
                            value={(editForm.bitrix_user_id as string) ?? ""}
                            onChange={e => setEditForm(p => ({ ...p, bitrix_user_id: e.target.value }))}
                            className="h-9 w-full rounded-lg border border-[hsl(var(--task-border))] bg-[hsl(var(--task-bg))] px-3 text-xs text-[hsl(var(--task-text))] outline-none focus:border-[hsl(var(--task-purple)/0.5)]"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Cliente dropdown */}
                    <div className="pt-2 border-t border-[hsl(var(--task-border))]">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-wider text-[hsl(var(--task-text-muted))] font-semibold flex items-center gap-1">
                          <Building2 className="h-3 w-3" /> Cliente
                        </label>
                        <Select
                          value={editForm.cliente_id ? String(editForm.cliente_id) : "none"}
                          onValueChange={(value) => setEditForm(p => ({ ...p, cliente_id: value === "none" ? null : Number(value) }))}
                        >
                          <SelectTrigger className={taskSelectTriggerClass}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className={taskSelectContentClass}>
                            <SelectItem value="none" className={taskSelectItemClass}>Nenhum cliente</SelectItem>
                            {clienteOptions.map((c) => (
                              <SelectItem key={c.value} value={String(c.value)} className={taskSelectItemClass}>{c.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {editShowsSubordinates && (
                      <div className="pt-2 border-t border-[hsl(var(--task-border))]">
                        <MultiSelectDropdown
                          label="Consultores sob coordenação"
                          icon={Users}
                          options={subordinateOptions.filter(opt => opt.value !== editingUser.id)}
                          selected={(editForm.subordinate_ids as string[]) ?? []}
                          onToggle={(v) => toggleInList(v as string, (editForm.subordinate_ids as string[]) ?? [], (vals) => setEditForm(p => ({ ...p, subordinate_ids: vals })))}
                          onClearAll={() => setEditForm(p => ({ ...p, subordinate_ids: [] }))}
                          searchable
                          emptyText="Nenhum consultor disponível."
                        />
                      </div>
                    )}

                    {editShowsCoordinator && (
                      <div className="pt-2 border-t border-[hsl(var(--task-border))]">
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase tracking-wider text-[hsl(var(--task-text-muted))] font-semibold">Responsável / Coordenador</label>
                          <Select
                            value={(editForm.my_coordinator as string) ?? "none"}
                            onValueChange={(value) => setEditForm(p => ({ ...p, my_coordinator: value === "none" ? null : value }))}
                          >
                            <SelectTrigger className={taskSelectTriggerTallClass}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className={taskSelectContentClass}>
                              <SelectItem value="none" className={taskSelectItemClass}>Sem responsável definido</SelectItem>
                              {coordinatorOptions.filter(option => option.value !== editingUser.id).map((option) => (
                                <SelectItem key={option.value} value={option.value} className={`${taskSelectItemClass} whitespace-normal pr-8 leading-4`}>
                                  {option.label} — {option.email}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {/* Areas dropdown */}
                    <div className="pt-2 border-t border-[hsl(var(--task-border))]">
                      <MultiSelectDropdown
                        label="Áreas Permitidas"
                        icon={MapPin}
                        options={areaOptions}
                        selected={editAreas}
                        onToggle={(v) => toggleInList(v as string, editAreas, setEditAreas)}
                        onSelectAll={() => setEditAreas(areaOptions.map(a => a.value as string))}
                        onClearAll={() => setEditAreas([])}
                      />
                    </div>

                    {/* Projects dropdown */}
                    <div className="pt-2 border-t border-[hsl(var(--task-border))]">
                      <MultiSelectDropdown
                        label="Projetos Acessíveis"
                        icon={FolderOpen}
                        options={projectOptions}
                        selected={editProjects}
                        onToggle={(v) => toggleInList(v as number, editProjects, setEditProjects)}
                        onSelectAll={() => setEditProjects(projectOptions.map(p => p.value as number))}
                        onClearAll={() => setEditProjects([])}
                        emptyText="Nenhum projeto encontrado."
                        searchable
                      />
                    </div>

                    {/* Reset Password */}
                    <div className="pt-2 border-t border-[hsl(var(--task-border))] space-y-2">
                      <label className="text-[10px] uppercase tracking-wider text-[hsl(var(--task-text-muted))] font-semibold flex items-center gap-1">
                        <Key className="h-3 w-3" /> Redefinir Senha
                      </label>
                      <div className="flex gap-1 h-9">
                        <div className="relative flex-1 min-w-0">
                          <input
                            type={showEditPassword ? "text" : "password"}
                            value={editNewPassword}
                            onChange={e => setEditNewPassword(e.target.value)}
                            placeholder="Nova senha (min. 6 caracteres)"
                            className="h-9 w-full rounded-lg border border-[hsl(var(--task-border))] bg-[hsl(var(--task-bg))] pl-3 pr-8 text-xs text-[hsl(var(--task-text))] outline-none focus:border-[hsl(var(--task-purple)/0.5)] placeholder:text-[hsl(var(--task-text-muted)/0.4)]"
                          />
                          <button type="button" onClick={() => setShowEditPassword(!showEditPassword)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[hsl(var(--task-text-muted))] hover:text-[hsl(var(--task-text))]">
                            {showEditPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </button>
                        </div>
                        <button type="button" onClick={handleGenerateEditPassword} title="Gerar senha"
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[hsl(var(--task-border))] bg-[hsl(var(--task-bg))] text-[hsl(var(--task-text-muted))] hover:border-[hsl(var(--task-purple)/0.4)] hover:text-[hsl(var(--task-purple))] transition">
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                        {editNewPassword && (
                          <button type="button" onClick={handleCopyEditPassword} title="Copiar senha"
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[hsl(var(--task-border))] bg-[hsl(var(--task-bg))] text-[hsl(var(--task-text-muted))] hover:border-emerald-500/40 hover:text-emerald-400 transition">
                            {copiedEditPw ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        )}
                      </div>
                      {editNewPassword && (
                        <button onClick={handleResetPassword} disabled={resettingPassword}
                          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-500/20 transition disabled:opacity-50">
                          {resettingPassword ? <Loader2 className="h-3 w-3 animate-spin" /> : <Key className="h-3 w-3" />}
                          {resettingPassword ? "Redefinindo..." : "Confirmar Nova Senha"}
                        </button>
                      )}
                    </div>

                    {/* Actions */}
                    </div>

                    {/* Fixed footer */}
                    <div className="flex justify-end gap-2 p-5 pt-3 border-t border-[hsl(var(--task-border))] shrink-0">
                      <button onClick={cancelEdit}
                        className="rounded-lg border border-[hsl(var(--task-border))] px-3 py-1.5 text-xs text-[hsl(var(--task-text-muted))] hover:text-[hsl(var(--task-text))] transition">
                        Cancelar
                      </button>
                      <button onClick={saveEdit} disabled={loadingEdit}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-4 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/30 transition disabled:opacity-50">
                        {loadingEdit ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Salvar
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
    </div>
  );
}
