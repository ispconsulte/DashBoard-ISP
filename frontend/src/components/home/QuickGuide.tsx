import { Rocket } from "lucide-react";

const steps = [
  {
    num: "01",
    label: "Escolha seu módulo",
    desc: "Entre no menu lateral e vá direto no que você usa: comodato, cadastros, integrações ou tarefas.",
  },
  {
    num: "02",
    label: "Siga o fluxo recomendado",
    desc: "O sistema te guia para reduzir erro e retrabalho. Menos dúvidas e mais execução.",
  },
  {
    num: "03",
    label: "Registre e acompanhe",
    desc: "Tudo que é rotina precisa de rastreabilidade: resultado consistente, histórico e menos ruído.",
  },
];

export default function QuickGuide() {
  return (
    <section
      className="rounded-3xl border border-white/[0.08] p-8 md:p-10"
      style={{
        background: "linear-gradient(145deg, hsl(270 45% 13% / 0.6), hsl(234 40% 9% / 0.5))",
      }}
    >
      {/* Header */}
      <div className="mb-10 text-center">
        <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">
          <Rocket className="h-3 w-3 text-[hsl(270_90%_75%)]" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[hsl(270_90%_75%)]">
            Primeiros passos
          </span>
        </div>
        <h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">
          Guia rápido para começar
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-white/50">
          Use a página inicial como um mapa: entenda o fluxo, acesse seu módulo e siga o passo a passo.
        </p>
      </div>

      <div className="relative grid gap-5 md:grid-cols-3">

        {steps.map((s, i) => (
          <div
            key={s.num}
            className="group relative overflow-hidden rounded-2xl border border-white/[0.06] p-7 text-center transition-all duration-500 hover:-translate-y-2 hover:border-white/[0.12] hover:shadow-2xl hover:shadow-[hsl(270_80%_55%/0.1)]"
            style={{
              background: "linear-gradient(145deg, hsl(260 40% 12% / 0.8), hsl(234 40% 8% / 0.6))",
              opacity: 0,
              animation: `fadeSlideUp 0.6s ease-out ${i * 150}ms forwards`,
            }}
          >
            {/* Number badge */}
            <div className="relative z-10 mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[hsl(270_80%_55%)] to-[hsl(234_89%_55%)] text-lg font-bold text-white shadow-xl shadow-[hsl(270_80%_55%/0.3)] transition-transform duration-300 group-hover:scale-110">
              {s.num}
            </div>
            <h3 className="text-base font-bold text-white/90">{s.label}</h3>
            <p className="mt-3 text-sm leading-relaxed text-white/45">{s.desc}</p>
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-white/30">
        A Página Inicial é o mapa do sistema — orienta o usuário e reforça o propósito de cada módulo.
      </p>
    </section>
  );
}
