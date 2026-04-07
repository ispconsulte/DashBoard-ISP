const benefits = [
  { title: "Centralização", desc: "O essencial fica em um lugar só. Menos abas, menos perda de tempo procurando informação." },
  { title: "Padrão", desc: "Rotinas com consistência: reduz erro humano e melhora a previsibilidade do processo." },
  { title: "Segurança", desc: "Cada perfil acessa apenas o que faz sentido. Sem exposição desnecessária de rotinas sensíveis." },
  { title: "Rastreabilidade", desc: "Facilita repasse de turno e auditoria do que foi feito, com menos ruído e mais clareza." },
];

export default function BenefitsSection() {
  return (
    <div className="rounded-2xl border border-border bg-card/55 p-6">
      <div className="mx-auto max-w-4xl text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-primary">Benefícios</p>
        <h3 className="mt-2 text-2xl font-semibold text-foreground">Por que usar</h3>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
          Menos improviso, mais padrão. Um painel bonito é legal — mas o que importa é reduzir atrito no dia a dia.
        </p>
      </div>

      <div className="mx-auto mt-6 grid max-w-5xl gap-4 md:grid-cols-2">
        {benefits.map((b) => (
          <div key={b.title} className="rounded-2xl border border-border bg-muted/35 p-5 text-left transition-colors hover:bg-muted/50">
            <p className="text-sm font-semibold text-foreground">{b.title}</p>
            <p className="mt-2 text-sm text-muted-foreground">{b.desc}</p>
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        A Home é um "mapa do sistema": orienta o usuário e reforça propósito — não é um mural de recados.
      </p>
    </div>
  );
}
