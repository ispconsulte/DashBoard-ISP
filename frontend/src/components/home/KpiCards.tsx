import { memo } from "react";
import { Users, Clock, Package, ListTodo } from "lucide-react";

const kpis = [
  {
    label: "Total de Clientes",
    value: "1.174",
    desc: "Clientes ativos na base",
    change: "+12,95%",
    up: true,
    icon: Users,
    iconBg: "bg-primary/20",
    iconColor: "text-primary",
  },
  {
    label: "Horas Operacionais",
    value: "89.011",
    desc: "Acumulado no período",
    change: "+8,12%",
    up: true,
    icon: Clock,
    iconBg: "bg-emerald-500/20",
    iconColor: "text-emerald-400",
  },
  {
    label: "Comodatos Ativos",
    value: "7.415",
    desc: "Equipamentos em campo",
    change: "-5,18%",
    up: false,
    icon: Package,
    iconBg: "bg-amber-500/20",
    iconColor: "text-amber-400",
  },
  {
    label: "Taxa de Conclusão",
    value: "10,87%",
    desc: "Tarefas finalizadas",
    change: "+25,45%",
    up: true,
    icon: ListTodo,
    iconBg: "bg-violet-500/20",
    iconColor: "text-violet-400",
  },
];

function KpiCardsInner() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((k) => (
        <div
          key={k.label}
          className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/80 p-5 transition-colors hover:border-border"
        >
          {/* subtle glow */}
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/5 blur-2xl transition-opacity group-hover:opacity-100 opacity-0" />

          <div className="relative flex items-start justify-between">
            <div className={`grid h-10 w-10 place-items-center rounded-lg ${k.iconBg}`}>
              <k.icon className={`h-5 w-5 ${k.iconColor}`} />
            </div>
            <span
              className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
                k.up
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-destructive/15 text-destructive"
              }`}
            >
              {k.up ? "↑" : "↓"} {k.change}
            </span>
          </div>

          <p className="mt-4 text-2xl font-bold text-foreground">{k.value}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{k.label}</p>
          <p className="mt-1 text-[0.7rem] text-muted-foreground/70">{k.desc}</p>
        </div>
      ))}
    </div>
  );
}

export default memo(KpiCardsInner);
