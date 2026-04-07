import { useState, useRef, KeyboardEvent } from "react";
import PageHeaderCard from "@/components/PageHeaderCard";
import { motion, AnimatePresence } from "framer-motion";
import { usePageSEO } from "@/hooks/usePageSEO";
import {
  Video,
  Calendar,
  Link2,
  Copy,
  Check,
  ExternalLink,
  Clock,
  Wrench,
  ChevronRight,
  Info,
  FileText,
  X,
  Plus,
  Zap,
  Sparkles,
  Users,
} from "lucide-react";

interface MeetFormState {
  title: string;
  date: string;
  time: string;
  duration: string;
  description: string;
}

function buildGoogleMeetUrl(form: MeetFormState, guests: string[]): string {
  const base = "https://calendar.google.com/calendar/render?action=TEMPLATE";
  const params = new URLSearchParams();
  if (form.title) params.set("text", form.title);
  if (form.description) params.set("details", form.description);
  if (form.date && form.time) {
    const start = new Date(`${form.date}T${form.time}:00`);
    const durationMs = (Number(form.duration) || 60) * 60 * 1000;
    const end = new Date(start.getTime() + durationMs);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    params.set("dates", `${fmt(start)}/${fmt(end)}`);
  }
  params.set("add", "meet");
  guests.filter(Boolean).forEach((email) => params.append("add", email));
  return `${base}&${params.toString()}`;
}

const DURATION_OPTIONS = [
  { label: "30 min", value: "30", color: "hsl(200 90% 55%)" },
  { label: "1 hora", value: "60", color: "hsl(234 89% 64%)" },
];

const QUICK_TITLES = [
  "Alinhamento semanal",
  "Review de projeto",
  "Reunião com cliente",
  "Retrospectiva",
];

function EmailChip({ email, onRemove }: { email: string; onRemove: () => void }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.15 }}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
      style={{
        background: "hsl(234 89% 64% / 0.15)",
        boxShadow: "0 0 0 1px hsl(234 89% 64% / 0.3)",
        color: "hsl(234 89% 80%)",
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: "hsl(234 89% 64%)" }}
      />
      {email}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 rounded-full p-0.5 transition-all hover:bg-white/10"
        style={{ color: "hsl(234 89% 64% / 0.6)" }}
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </motion.span>
  );
}

export default function FerramentasPage() {
  usePageSEO("/ferramentas");

  const today = new Date().toISOString().split("T")[0];
  const nowTime = new Date().toTimeString().slice(0, 5);

  const [form, setForm] = useState<MeetFormState>({
    title: "Reunião Meet",
    date: today,
    time: nowTime,
    duration: "60",
    description: "",
  });
  const [guests, setGuests] = useState<string[]>([]);
  const [guestInput, setGuestInput] = useState("");
  const [guestError, setGuestError] = useState("");
  const [copied, setCopied] = useState(false);
  const guestInputRef = useRef<HTMLInputElement>(null);

  const set = (field: keyof MeetFormState) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const meetUrl = buildGoogleMeetUrl(form, guests);

  const handleCopy = () => {
    navigator.clipboard.writeText(meetUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const addGuest = (value: string) => {
    const emails = value.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean);
    const valid: string[] = [];
    const invalid: string[] = [];
    emails.forEach(e => {
      if (isValidEmail(e) && !guests.includes(e)) valid.push(e);
      else if (!isValidEmail(e)) invalid.push(e);
    });
    if (valid.length) setGuests(prev => [...prev, ...valid]);
    if (invalid.length) {
      setGuestError(`E-mail inválido: ${invalid[0]}`);
      setTimeout(() => setGuestError(""), 3000);
    }
    setGuestInput("");
  };

  const handleGuestKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (["Enter", ",", ";", "Tab"].includes(e.key)) {
      e.preventDefault();
      if (guestInput.trim()) addGuest(guestInput);
    } else if (e.key === "Backspace" && !guestInput && guests.length > 0) {
      setGuests(prev => prev.slice(0, -1));
    }
  };

  const removeGuest = (idx: number) => setGuests(prev => prev.filter((_, i) => i !== idx));

  const activeDuration = DURATION_OPTIONS.find(o => o.value === form.duration);

  return (
    <div className="page-gradient w-full">
      <div className="mx-auto w-full max-w-[1900px] space-y-6 overflow-x-hidden p-4 sm:p-5 md:p-8">

        <PageHeaderCard
          icon={Wrench}
          title="Criador de reuniões (Google Meet)"
          subtitle="Crie reuniões no Google Meet com pauta, horário e participantes em um único fluxo"
        />

        {/* ── Two-column layout ── */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">

          {/* LEFT — Main Form Card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="overflow-hidden rounded-3xl"
            style={{
              background: "hsl(222 40% 8%)",
              boxShadow: "0 0 0 1px hsl(234 89% 64% / 0.08), 0 24px 48px hsl(222 47% 3% / 0.6)",
            }}
          >
            {/* Card header with gradient bar */}
            <div
              className="relative overflow-hidden px-6 py-5"
              style={{ borderBottom: "1px solid hsl(222 25% 12%)" }}
            >
              <div
                className="absolute inset-0"
                style={{ background: "linear-gradient(135deg, hsl(234 89% 64% / 0.06), transparent)" }}
              />
              <div className="relative flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ background: "hsl(234 89% 64% / 0.15)", boxShadow: "0 0 0 1px hsl(234 89% 64% / 0.2)" }}
                >
                  <Calendar className="h-4.5 w-4.5" style={{ color: "hsl(234 89% 70%)" }} />
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: "hsl(210 40% 94%)" }}>
                    Reunião Meet
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: "hsl(215 20% 48%)" }}>
                    Preencha os dados e gere o link da reunião
                  </p>
                </div>
                <div className="ml-auto">
                  <Sparkles className="h-4 w-4" style={{ color: "hsl(234 89% 64% / 0.4)" }} />
                </div>
              </div>
            </div>

            {/* Form body */}
            <div className="space-y-5 p-6">

              {/* Title + quick suggestions */}
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest" style={{ color: "hsl(215 20% 48%)" }}>
                  Título da reunião
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => set("title")(e.target.value)}
                  placeholder="Ex: Alinhamento mensal — Cliente ISP"
                  className="w-full rounded-xl px-4 py-3 text-sm transition-all outline-none"
                  style={{
                    background: "hsl(222 40% 11%)",
                    boxShadow: "0 0 0 1px hsl(222 25% 16%)",
                    color: "hsl(210 40% 92%)",
                  }}
                  onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 2px hsl(234 89% 64% / 0.4)")}
                  onBlur={(e) => (e.currentTarget.style.boxShadow = "0 0 0 1px hsl(222 25% 16%)")}
                />
                {/* Quick-fill suggestions */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {QUICK_TITLES.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => set("title")(t)}
                      className="rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all hover:opacity-80"
                      style={{
                        background: "hsl(222 30% 13%)",
                        boxShadow: "0 0 0 1px hsl(222 25% 18%)",
                        color: "hsl(215 20% 50%)",
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date + Time in 2 cols */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Data", type: "date", field: "date" as const },
                  { label: "Horário", type: "time", field: "time" as const },
                ].map(({ label, type, field }) => (
                  <div key={field}>
                    <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest" style={{ color: "hsl(215 20% 48%)" }}>
                      {label}
                    </label>
                    <input
                      type={type}
                      value={form[field]}
                      onChange={(e) => set(field)(e.target.value)}
                      className="w-full rounded-xl px-4 py-3 text-sm transition-all outline-none"
                      style={{
                        background: "hsl(222 40% 11%)",
                        boxShadow: "0 0 0 1px hsl(222 25% 16%)",
                        color: "hsl(210 40% 92%)",
                        colorScheme: "dark",
                      }}
                      onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 2px hsl(234 89% 64% / 0.4)")}
                      onBlur={(e) => (e.currentTarget.style.boxShadow = "0 0 0 1px hsl(222 25% 16%)")}
                    />
                  </div>
                ))}
              </div>

              {/* Duration — pill selector with colored active */}
              <div>
                <label className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest" style={{ color: "hsl(215 20% 48%)" }}>
                  <Clock className="h-3 w-3" /> Duração
                  {activeDuration && (
                    <span className="ml-auto text-[11px] font-semibold normal-case tracking-normal"
                      style={{ color: activeDuration.color }}>
                      {activeDuration.label} selecionado
                    </span>
                  )}
                </label>
                <div
                  className="flex rounded-xl p-1 gap-1"
                  style={{ background: "hsl(222 40% 11%)", boxShadow: "0 0 0 1px hsl(222 25% 15%)" }}
                >
                  {DURATION_OPTIONS.map((opt) => {
                    const active = form.duration === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => set("duration")(opt.value)}
                        className="flex-1 rounded-lg py-2.5 text-xs font-bold transition-all"
                        style={
                          active
                            ? {
                                background: `linear-gradient(135deg, ${opt.color}, ${opt.color.replace(")", " / 0.7)")})`,
                                color: "hsl(0 0% 100%)",
                                boxShadow: `0 2px 12px ${opt.color.replace(")", " / 0.4)")}`,
                              }
                            : { color: "hsl(215 20% 45%)" }
                        }
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Aviso limites Google Meet */}
              <div
                className="mt-2 rounded-xl p-3.5 space-y-2"
                style={{
                  background: "hsl(38 80% 50% / 0.07)",
                  boxShadow: "0 0 0 1px hsl(38 80% 50% / 0.18)",
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Info className="h-3.5 w-3.5 shrink-0" style={{ color: "hsl(38 90% 65%)" }} />
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "hsl(38 90% 65%)" }}>
                    Limites Google Meet (conta gratuita)
                  </p>
                </div>
                <ul className="space-y-1.5 pl-1">
                  {[
                    { icon: "👥", text: "Reuniões em grupo (3+): máximo de ", bold: "60 minutos" },
                    { icon: "👤", text: "Chamadas individuais (1 a 1): até ", bold: "24 horas" },
                    { icon: "🧑‍🤝‍🧑", text: "Limite de participantes: até ", bold: "100 pessoas" },
                  ].map(({ icon, text, bold }) => (
                    <li key={bold} className="flex items-start gap-2 text-[11px]" style={{ color: "hsl(38 60% 70% / 0.85)" }}>
                      <span className="text-sm leading-none mt-0.5">{icon}</span>
                      <span>{text}<strong style={{ color: "hsl(38 90% 72%)" }}>{bold}</strong></span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Guests — chip input */}
              <div>
                <label className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest" style={{ color: "hsl(215 20% 48%)" }}>
                  <Users className="h-3 w-3" /> Convidados
                  {guests.length > 0 && (
                    <span className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold normal-case tracking-normal"
                      style={{ background: "hsl(234 89% 64% / 0.15)", color: "hsl(234 89% 75%)" }}>
                      {guests.length} convidado{guests.length > 1 ? "s" : ""}
                    </span>
                  )}
                </label>

                {/* Chip container + input */}
                <div
                  className="flex min-h-[3rem] flex-wrap gap-1.5 rounded-xl px-3 py-2.5 cursor-text"
                  style={{
                    background: "hsl(222 40% 11%)",
                    boxShadow: "0 0 0 1px hsl(222 25% 16%)",
                  }}
                  onClick={() => guestInputRef.current?.focus()}
                >
                  <AnimatePresence>
                    {guests.map((g, i) => (
                      <EmailChip key={g} email={g} onRemove={() => removeGuest(i)} />
                    ))}
                  </AnimatePresence>
                  <input
                    ref={guestInputRef}
                    type="text"
                    value={guestInput}
                    onChange={e => { setGuestInput(e.target.value); setGuestError(""); }}
                    onKeyDown={handleGuestKeyDown}
                    onBlur={() => { if (guestInput.trim()) addGuest(guestInput); }}
                    onPaste={e => {
                      const text = e.clipboardData.getData("text");
                      if (text.includes(",") || text.includes(";") || text.includes("\n")) {
                        e.preventDefault();
                        addGuest(text);
                      }
                    }}
                    placeholder={guests.length === 0 ? "Digite o e-mail e pressione Enter ou vírgula..." : "Adicionar mais..."}
                    className="min-w-[180px] flex-1 bg-transparent text-sm outline-none"
                    style={{ color: "hsl(210 40% 88%)" }}
                  />
                </div>
                <AnimatePresence>
                  {guestError && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="mt-1.5 text-[11px]"
                      style={{ color: "hsl(0 84% 60%)" }}
                    >
                      {guestError}
                    </motion.p>
                  )}
                </AnimatePresence>
                <p className="mt-1.5 text-[10px]" style={{ color: "hsl(215 20% 38%)" }}>
                  Pressione <kbd className="rounded px-1 py-0.5 text-[9px]" style={{ background: "hsl(222 30% 16%)", color: "hsl(215 20% 55%)" }}>Enter</kbd> ou <kbd className="rounded px-1 py-0.5 text-[9px]" style={{ background: "hsl(222 30% 16%)", color: "hsl(215 20% 55%)" }}>,</kbd> para adicionar. Cole vários e-mails separados por vírgula.
                </p>
              </div>

              {/* Description */}
              <div>
                <label className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest" style={{ color: "hsl(215 20% 48%)" }}>
                  <FileText className="h-3 w-3" /> Pauta / Descrição
                  <span className="ml-1 rounded-full px-2 py-0.5 text-[9px]" style={{ background: "hsl(222 30% 15%)", color: "hsl(215 20% 42%)" }}>opcional</span>
                </label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => set("description")(e.target.value)}
                  placeholder={"1. Apresentação do relatório\n2. Próximas entregas\n3. Dúvidas"}
                  className="w-full resize-none rounded-xl px-4 py-3 text-sm transition-all outline-none"
                  style={{
                    background: "hsl(222 40% 11%)",
                    boxShadow: "0 0 0 1px hsl(222 25% 16%)",
                    color: "hsl(210 40% 92%)",
                  }}
                  onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 2px hsl(234 89% 64% / 0.4)")}
                  onBlur={(e) => (e.currentTarget.style.boxShadow = "0 0 0 1px hsl(222 25% 16%)")}
                />
              </div>
            </div>

            {/* URL preview strip */}
            <div
              className="mx-6 mb-5 overflow-hidden rounded-xl"
              style={{ background: "hsl(222 40% 10%)", boxShadow: "0 0 0 1px hsl(222 25% 13%)" }}
            >
              <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid hsl(222 25% 12%)" }}>
                <Link2 className="h-3 w-3 shrink-0" style={{ color: "hsl(234 89% 64% / 0.5)" }} />
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "hsl(215 20% 38%)" }}>
                  Link gerado
                </span>
              </div>
              <p className="select-all truncate px-3 py-2.5 font-mono text-[11px]" style={{ color: "hsl(215 20% 52%)" }}>
                {meetUrl}
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3 px-6 pb-6">
              <a
                href={meetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-all hover:opacity-90 active:scale-95"
                style={{
                  background: "linear-gradient(135deg, hsl(234 89% 58%), hsl(270 70% 54%))",
                  color: "hsl(0 0% 100%)",
                  boxShadow: "0 4px 20px hsl(234 89% 64% / 0.4), 0 0 0 1px hsl(234 89% 64% / 0.2)",
                }}
              >
                <Calendar className="h-4 w-4" />
                Abrir no Google Calendar
                <ChevronRight className="h-4 w-4 opacity-70" />
              </a>

              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all hover:opacity-80 active:scale-95"
                style={{
                  background: copied ? "hsl(160 60% 40% / 0.15)" : "hsl(222 30% 14%)",
                  boxShadow: copied
                    ? "0 0 0 1px hsl(160 60% 40% / 0.4)"
                    : "0 0 0 1px hsl(222 25% 18%)",
                  color: copied ? "hsl(160 60% 65%)" : "hsl(215 20% 58%)",
                }}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copiado!" : "Copiar link"}
              </button>
            </div>
          </motion.div>

          {/* RIGHT — Side panel */}
          <div className="flex flex-col gap-4">

            {/* Instant Meet banner */}
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="relative overflow-hidden rounded-2xl px-5 py-5"
              style={{
                background: "linear-gradient(135deg, hsl(160 60% 35% / 0.15), hsl(160 60% 35% / 0.06))",
                boxShadow: "0 0 0 1px hsl(160 60% 40% / 0.2)",
              }}
            >
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl"
                style={{ background: "hsl(160 60% 40% / 0.12)" }} />
              <div className="flex items-start gap-3.5">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background: "hsl(160 60% 40% / 0.18)",
                    boxShadow: "0 0 0 1px hsl(160 60% 40% / 0.3)",
                  }}
                >
                  <Video className="h-5 w-5" style={{ color: "hsl(160 60% 60%)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold" style={{ color: "hsl(210 40% 92%)" }}>
                    Reunião instantânea
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed" style={{ color: "hsl(215 20% 50%)" }}>
                    Abra um Meet sem precisar agendar
                  </p>
                  <a
                    href="https://meet.google.com/new"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition-all hover:opacity-80 active:scale-95"
                    style={{
                      background: "hsl(160 60% 38% / 0.25)",
                      boxShadow: "0 0 0 1px hsl(160 60% 40% / 0.35)",
                      color: "hsl(160 60% 65%)",
                    }}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Abrir Meet agora
                  </a>
                </div>
              </div>
            </motion.div>

            {/* Summary card */}
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.22 }}
              className="rounded-2xl p-5"
              style={{
                background: "hsl(222 40% 8%)",
                boxShadow: "0 0 0 1px hsl(222 25% 13%)",
              }}
            >
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest" style={{ color: "hsl(215 20% 40%)" }}>
                Resumo da reunião
              </p>
              <div className="space-y-2.5">
                {[
                  { icon: "📋", label: "Título", value: form.title || "—" },
                  {
                    icon: "📅",
                    label: "Data/Hora",
                    value: form.date && form.time
                      ? `${new Date(form.date + "T12:00:00").toLocaleDateString("pt-BR")} às ${form.time}`
                      : "—",
                  },
                  {
                    icon: "⏱️",
                    label: "Duração",
                    value: DURATION_OPTIONS.find(o => o.value === form.duration)?.label ?? "—",
                  },
                  {
                    icon: "👥",
                    label: "Convidados",
                    value: guests.length > 0 ? `${guests.length} pessoa${guests.length > 1 ? "s" : ""}` : "Nenhum",
                  },
                ].map(({ icon, label, value }) => (
                  <div key={label} className="flex items-start gap-2.5">
                    <span className="text-base">{icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold" style={{ color: "hsl(215 20% 40%)" }}>{label}</p>
                      <p className="truncate text-[12px] font-medium" style={{ color: "hsl(210 40% 80%)" }}>{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Tips card */}
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="rounded-2xl p-5"
              style={{
                background: "hsl(234 50% 8% / 0.6)",
                boxShadow: "0 0 0 1px hsl(234 89% 64% / 0.06)",
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Info className="h-3.5 w-3.5 shrink-0" style={{ color: "hsl(234 89% 64% / 0.5)" }} />
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "hsl(215 20% 40%)" }}>
                  Como funciona
                </p>
              </div>
              <ol className="space-y-2">
                {[
                  "Preencha o título e a data",
                  "Adicione os convidados por e-mail",
                  "Clique em 'Abrir no Google Calendar'",
                  "Salve o evento — o Google gera o Meet automaticamente",
                ].map((tip, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span
                      className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
                      style={{ background: "hsl(234 89% 64% / 0.15)", color: "hsl(234 89% 70%)" }}
                    >
                      {i + 1}
                    </span>
                    <p className="text-[11px] leading-relaxed" style={{ color: "hsl(215 20% 46%)" }}>{tip}</p>
                  </li>
                ))}
              </ol>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

