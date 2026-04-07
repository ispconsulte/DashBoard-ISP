import { Activity, Database, ListChecks, ShieldCheck } from "lucide-react";

const stats = [
  {
    icon: Activity,
    title: "Alta Eficiência",
    desc: "Processos otimizados para máxima produtividade no dia a dia.",
    value: "100%",
    color: "from-[hsl(270_80%_55%)] to-[hsl(234_89%_55%)]",
    glow: "hsl(270 80% 55% / 0.25)",
  },
  {
    icon: Database,
    title: "Controle de Dados",
    desc: "Informações organizadas e acessíveis em tempo real.",
    value: "Real-time",
    color: "from-[hsl(270_70%_50%)] to-[hsl(280_70%_55%)]",
    glow: "hsl(280 70% 55% / 0.25)",
  },
  {
    icon: ListChecks,
    title: "Gestão de Tarefas",
    desc: "Acompanhe demandas, prazos e entregas de forma visual.",
    value: "100%",
    color: "from-[hsl(250_80%_60%)] to-[hsl(270_80%_55%)]",
    glow: "hsl(250 80% 60% / 0.25)",
  },
  {
    icon: ShieldCheck,
    title: "Resultados Confiáveis",
    desc: "Rastreabilidade e padrão para decisões mais seguras.",
    value: "100%",
    color: "from-[hsl(234_89%_64%)] to-[hsl(260_80%_55%)]",
    glow: "hsl(234 89% 64% / 0.25)",
  },
];

export default function StatsCards() {
  return (
    <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s, i) => (
        <div
          key={s.title}
          className="group relative overflow-hidden rounded-2xl border border-white/[0.08] p-6 transition-all duration-500 hover:-translate-y-2 hover:border-white/[0.15] hover:shadow-2xl"
          style={{
            background: "linear-gradient(145deg, hsl(270 50% 14% / 0.8), hsl(234 45% 10% / 0.6))",
            opacity: 0,
            animation: `fadeSlideUp 0.6s ease-out ${i * 150}ms forwards`,
          }}
        >
          {/* Corner glow on hover */}
          <div
            className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
            style={{ background: s.glow }}
          />

          {/* Top accent */}
          <div className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${s.color} opacity-50 transition-opacity duration-500 group-hover:opacity-100`} />

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${s.color} shadow-lg transition-transform duration-300 group-hover:scale-110`}>
                <s.icon className="h-5 w-5 text-white" />
              </div>
              <span className={`text-lg font-bold bg-gradient-to-r ${s.color} bg-clip-text text-transparent`}>
                {s.value}
              </span>
            </div>
            <p className="text-sm font-bold text-white/90">{s.title}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-white/40">{s.desc}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
