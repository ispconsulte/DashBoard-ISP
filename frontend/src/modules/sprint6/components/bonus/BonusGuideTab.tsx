import {
  Wallet,
  Gauge,
  Crown,
  Zap,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import { SectionCard } from "./BonusSharedCards";

/**
 * Aba "Como funciona" — visível apenas para o responsável geral pela bonificação.
 * Linguagem simples, direta e com exemplos. Sem termos técnicos.
 */

function Example({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 flex items-start gap-2 rounded-lg border border-primary/15 bg-primary/[0.06] px-3 py-2">
      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" />
      <p className="text-[12.5px] leading-relaxed text-muted-foreground/85">
        <span className="font-semibold text-primary/90">Exemplo: </span>
        {children}
      </p>
    </div>
  );
}

function Q({ children }: { children: React.ReactNode }) {
  return <p className="text-[13.5px] leading-relaxed text-muted-foreground/85">{children}</p>;
}

function B({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-foreground">{children}</span>;
}

export function BonusGuideTab() {
  return (
    <div className="space-y-4">
      {/* Intro curta */}
      <div className="rounded-2xl border border-primary/15 bg-[linear-gradient(135deg,hsl(234_89%_64%/0.10),transparent_60%)] p-5">
        <h2 className="text-[15px] font-bold text-foreground">Entenda esta tela em 1 minuto</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground/75">
          Aqui vai, de um jeito simples, de onde vem cada número. Sem complicação.
        </p>
      </div>

      {/* 1. Por que aparece valor sem nota */}
      <SectionCard title="Por que aparece valor mesmo sem nota do coordenador?" icon={Wallet} compact>
        <div className="space-y-2.5">
          <Q>
            Porque a tela <B>nunca fica vazia</B>. Se um coordenador ainda não deu nota,
            o sistema calcula sozinho usando o trabalho da pessoa: tarefas no prazo, atrasos,
            horas e saúde dos clientes.
          </Q>
          <Q>
            Quando o coordenador avalia, esse número fica <B>mais preciso</B>. Antes disso,
            é uma <B>prévia automática</B>.
          </Q>
          <Example>
            João ainda não foi avaliado, mas entrega quase tudo no prazo. A tela mostra uma
            prévia de <B>75%</B> com base no trabalho dele — não fica zerado.
          </Example>
        </div>
      </SectionCard>

      {/* 2. Como calcula o score */}
      <SectionCard title="Como o score (a nota de 0 a 100%) é calculado" icon={Gauge} compact>
        <div className="space-y-3">
          <Q><B>Quando o coordenador avalia</B>, a nota é uma mistura de:</Q>
          <div className="rounded-xl border border-border/15 bg-card/40 p-3 text-[13px]">
            <ul className="space-y-1 text-muted-foreground/85">
              <li>• Tarefas no prazo (o sistema vê sozinho) — <B>25%</B></li>
              <li>• Qualidade técnica (nota do coordenador) — <B>25%</B></li>
              <li>• Postura no dia a dia (nota do coordenador) — <B>30%</B></li>
              <li>• Relacionamento (nota do coordenador) — <B>20%</B></li>
            </ul>
          </div>
          <Q><B>Quando ninguém avaliou ainda</B>, a nota usa só o que o sistema mede sozinho:
            prazo, atrasos, horas bem usadas e saúde dos clientes.</Q>
          <Example>
            Maria recebeu nota alta do coordenador em qualidade e postura, e entrega no prazo.
            Resultado: score por volta de <B>85%</B>.
          </Example>
        </div>
      </SectionCard>

      {/* 3. Score médio e payout do topo */}
      <SectionCard title="Os números grandes lá em cima (Score médio e Payout)" icon={Wallet} compact>
        <div className="space-y-2.5">
          <Q><B>Score médio:</B> é a média das notas de todo mundo. Mostra como a equipe está, no geral.</Q>
          <Q><B>Payout (R$):</B> a nota vira dinheiro, proporcional ao teto do nível da pessoa.</Q>
          <Example>
            Nível com teto de <B>R$ 2.000</B> e score de <B>80%</B> → bônus de <B>R$ 1.600</B>
            {" "}(80% de 2.000).
          </Example>
          <Q><B>Payout Total:</B> soma o bônus de todos + a parte de receita (comercial),
            que é automática. Por isso o total nunca zera só porque falta uma avaliação.</Q>
        </div>
      </SectionCard>

      {/* 4. Sinais rápidos */}
      <SectionCard title="Os sinais rápidos (em alta / precisa de atenção)" icon={Zap} compact>
        <div className="space-y-2.5">
          <Q><B>Em destaque:</B> precisa de <B>nota ≥ 75%</B> E <B>pelo menos 60% das entregas no prazo</B>.
            As duas coisas juntas.</Q>
          <Q><B>Precisa de atenção:</B> quem está com nota <B>abaixo de 60%</B>.</Q>
          <Example>
            Pedro tem score <B>84%</B>, mas só entrega <B>40%</B> no prazo. Ele <B>não</B> entra no
            destaque — o prazo ainda está baixo.
          </Example>
        </div>
      </SectionCard>

      {/* 5. Ranking */}
      <SectionCard title="Como o ranking é ordenado" icon={Crown} compact>
        <Q>
          Primeiro pela <B>nota</B> (maior para menor). Se empatar, vale o <B>maior bônus</B>.
          Se ainda empatar, vale quem <B>registrou mais horas</B>.
        </Q>
      </SectionCard>

      {/* Fecho */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-500/15 bg-amber-500/[0.05] p-4">
        <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        <p className="text-[13px] leading-relaxed text-muted-foreground/85">
          <B>Resumindo:</B> nenhum número aqui depende só dos coordenadores. O sistema sempre
          junta o que mede sozinho (prazo, horas, atrasos e clientes) com as notas dos coordenadores
          quando elas existem. Assim a tela é sempre útil.
        </p>
      </div>
    </div>
  );
}
