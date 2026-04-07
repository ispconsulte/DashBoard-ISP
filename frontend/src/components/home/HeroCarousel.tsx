import { useState, useEffect } from "react";

const slides = [
  {
    id: "s1",
    kicker: "VISÃO GERAL",
    title: "O que é este painel",
    desc: "Um ponto único para entender o fluxo do sistema e acessar o que importa no seu perfil.",
    points: ["Visão rápida do que fazer agora", "Menos troca de contexto", "Decisões com mais clareza"],
    gradient: "from-primary/70 via-background to-background",
  },
  {
    id: "s2",
    kicker: "PADRÃO",
    title: "Fluxos guiados",
    desc: "Processos com a mesma lógica e a mesma saída, para reduzir variação e erro.",
    points: ["Rotinas padronizadas por módulo", "Treinamento mais rápido", "Manutenção mais simples"],
    gradient: "from-emerald-500/60 via-background to-background",
  },
  {
    id: "s3",
    kicker: "SEGURANÇA",
    title: "Acesso por perfil",
    desc: "Cada usuário vê apenas o necessário para o seu trabalho, com rastreabilidade e controle.",
    points: ["Permissões por perfil", "Menos confusão para novos usuários", "Mais segurança operacional"],
    gradient: "from-amber-400/60 via-background to-background",
  },
];

export default function HeroCarousel() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setActive((p) => (p + 1) % slides.length), 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="hero-showcase relative overflow-hidden rounded-2xl">
      <div className="relative h-[22rem] md:h-[26rem]">
        {slides.map((slide, idx) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-opacity duration-700 ${idx === active ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          >
            {/* Background gradient */}
            <div
              className={`hero-showcase__bg absolute -inset-[18px] scale-105 bg-gradient-to-br ${slide.gradient} hero-hue-rotate`}
              aria-hidden="true"
            />

            {/* Content panel */}
            <div className="hero-showcase__panel relative z-10 mx-auto mt-12 w-[min(680px,calc(100%-3rem))] rounded-xl bg-background/50 p-8 text-center backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">
                {slide.kicker}
              </p>
              <p className="mt-2 text-3xl font-semibold text-foreground md:text-4xl">
                {slide.title}
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                {slide.desc}
              </p>

              <div className="mx-auto mt-5 grid max-w-md gap-2 text-left text-sm text-muted-foreground">
                {slide.points.map((p) => (
                  <div key={p} className="flex items-start gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{p}</span>
                  </div>
                ))}
              </div>

              <p className="mt-6 text-sm text-muted-foreground">
                Você está na visão geral do sistema. Algumas ações aparecem apenas para perfis autorizados.
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Dots */}
      <div className="hero-showcase__dots relative z-10 flex justify-center gap-2 pb-4">
        {slides.map((slide, idx) => (
          <button
            key={slide.id}
            type="button"
            onClick={() => setActive(idx)}
            className={`h-2.5 w-2.5 rounded-full transition-all duration-300 ${idx === active ? "bg-primary scale-125" : "bg-muted-foreground/30 hover:bg-muted-foreground/50"}`}
            aria-label={`Slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
