import { Shield, Zap, BarChart3, Layers } from "lucide-react";

const features = [
  {
    icon: Layers,
    title: "Centralização",
    desc: "Todas as rotinas em um só lugar. Menos abas abertas, menos tempo perdido procurando informação.",
    color: "from-[hsl(270_80%_55%)] to-[hsl(234_89%_55%)]",
    glow: "hsl(270 80% 55% / 0.2)",
  },
  {
    icon: Zap,
    title: "Padronização",
    desc: "Processos com consistência que reduzem erros humanos e melhoram a previsibilidade.",
    color: "from-[hsl(250_80%_60%)] to-[hsl(270_70%_50%)]",
    glow: "hsl(250 80% 60% / 0.2)",
  },
  {
    icon: Shield,
    title: "Segurança",
    desc: "Cada perfil acessa apenas o necessário. Sem exposição desnecessária de rotinas sensíveis.",
    color: "from-[hsl(280_70%_55%)] to-[hsl(260_80%_50%)]",
    glow: "hsl(280 70% 55% / 0.2)",
  },
  {
    icon: BarChart3,
    title: "Rastreabilidade",
    desc: "Histórico completo para auditorias, repasses de turno e decisões com mais clareza.",
    color: "from-[hsl(234_89%_64%)] to-[hsl(200_90%_55%)]",
    glow: "hsl(234 89% 64% / 0.2)",
  },
];

export default function FeaturesGrid() {
  return (
    <section
      className="rounded-3xl border border-white/[0.08] p-8 md:p-10"
      style={{
        background: "linear-gradient(145deg, hsl(270 45% 13% / 0.6), hsl(234 40% 9% / 0.5))",
      }}
    >
      {/* Header */}
      <div className="mb-10 flex flex-col items-center text-center md:flex-row md:items-end md:justify-between md:text-left">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">
            <Zap className="h-3 w-3 text-[hsl(270_90%_75%)]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[hsl(270_90%_75%)]">
              Benefícios
            </span>
          </div>
          <h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">
            Por que usar o ISP Consulte
          </h2>
          <p className="mt-2 max-w-xl text-sm text-white/50">
            Menos improviso, mais padrão. O que importa é reduzir atrito no dia a dia do seu provedor.
          </p>
        </div>
      </div>

      {/* Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {features.map((f, i) => (
          <div
            key={f.title}
            className="group relative overflow-hidden rounded-2xl border border-white/[0.06] p-6 transition-all duration-500 hover:-translate-y-1 hover:border-white/[0.12] hover:shadow-2xl"
            style={{
              background: "linear-gradient(145deg, hsl(260 40% 12% / 0.8), hsl(234 40% 8% / 0.6))",
              opacity: 0,
              animation: `fadeSlideUp 0.6s ease-out ${i * 120}ms forwards`,
            }}
          >
            {/* Corner glow on hover */}
            <div
              className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
              style={{ background: f.glow }}
            />

            {/* Top accent */}
            <div className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${f.color} opacity-0 transition-opacity duration-500 group-hover:opacity-100`} />

            <div className="relative z-10">
              <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${f.color} shadow-lg transition-transform duration-300 group-hover:scale-110`}>
                <f.icon className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-base font-bold text-white/90">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/45">{f.desc}</p>

            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
