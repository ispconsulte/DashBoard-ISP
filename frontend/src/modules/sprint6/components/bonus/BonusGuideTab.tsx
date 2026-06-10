import {
  Wallet,
  Gauge,
  Crown,
  Zap,
  HelpCircle,
  Sparkles,
  Layers,
} from "lucide-react";
import { CollapsibleSection } from "./CollapsibleSection";

/**
 * Aba "Como funciona" — visível apenas para o responsável geral pela bonificação.
 * Cada tópico é um dropdown (accordion): o usuário abre só o que quiser ler.
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
    <div className="space-y-3">
      {/* 1. Por que aparece valor sem nota */}
      <CollapsibleSection
        title="Por que aparece valor mesmo sem nota do coordenador?"
        icon={Wallet}
        summary="A tela nunca fica vazia — o sistema calcula sozinho"
      >
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
      </CollapsibleSection>

      {/* 2. Como calcula o score */}
      <CollapsibleSection
        title="Como o score (a nota de 0 a 100%) é calculado"
        icon={Gauge}
        summary="Mistura trabalho no prazo + notas do coordenador"
      >
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
      </CollapsibleSection>

      {/* 2b. Composição do score (quando ninguém avaliou) */}
      <CollapsibleSection
        title="A barra de composição (Entregas, Atraso, Aproveitamento, Saúde)"
        icon={Layers}
        summary="O que cada pedaço da barra significa na prévia automática"
      >
        <div className="space-y-3">
          <Q>
            Quando ainda <B>não há nota do coordenador</B>, abrimos a nota automática em 4 pedaços.
            Cada um tem um peso e contribui com uma parte dos pontos:
          </Q>
          <div className="space-y-2">
            <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.05] p-3">
              <p className="text-[13px] font-semibold text-foreground">Entregas no prazo · <span className="text-emerald-300">peso 38%</span></p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground/80">Quantas tarefas foram concluídas dentro do prazo. É o que mais pesa.</p>
            </div>
            <div className="rounded-xl border border-sky-500/15 bg-sky-500/[0.05] p-3">
              <p className="text-[13px] font-semibold text-foreground">Risco de atraso · <span className="text-sky-300">peso 22%</span></p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground/80">Quanto menos tarefas atrasadas, maior a contribuição.</p>
            </div>
            <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.05] p-3">
              <p className="text-[13px] font-semibold text-foreground">Aproveitamento · <span className="text-amber-300">peso 20%</span></p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground/80">Compara as horas registradas com a capacidade disponível da pessoa.</p>
            </div>
            <div className="rounded-xl border border-purple-500/15 bg-purple-500/[0.05] p-3">
              <p className="text-[13px] font-semibold text-foreground">Saúde da carteira · <span className="text-purple-300">peso 20%</span></p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground/80">Avalia a saúde dos clientes ligados à pessoa.</p>
            </div>
          </div>
          <Q>
            Cada fração mostra a <B>contribuição</B> (ex.: "15 de 38 pts") e a <B>eficiência</B>
            {" "}(o quão perto do máximo aquele fator está). Somando os 4, chega-se à nota da prévia.
          </Q>
          <Example>
            Entregas 15 + Atraso 12 + Aproveitamento 12 + Saúde 13 = <B>52 pts → 51%</B> de prévia.
          </Example>
        </div>
      </CollapsibleSection>

      {/* 3. Score médio e payout do topo */}
      <CollapsibleSection
        title="Os números grandes lá em cima (Score médio e Payout)"
        icon={Wallet}
        summary="Média da equipe e a nota virando dinheiro"
      >
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
      </CollapsibleSection>

      {/* 4. Sinais rápidos */}
      <CollapsibleSection
        title="Os sinais rápidos (em alta / precisa de atenção)"
        icon={Zap}
        summary="Quem se destaca e quem precisa de atenção"
      >
        <div className="space-y-2.5">
          <Q><B>Em destaque:</B> precisa de <B>nota ≥ 75%</B> E <B>pelo menos 60% das entregas no prazo</B>.
            As duas coisas juntas.</Q>
          <Q><B>Precisa de atenção:</B> quem está com nota <B>abaixo de 60%</B>.</Q>
          <Example>
            Pedro tem score <B>84%</B>, mas só entrega <B>40%</B> no prazo. Ele <B>não</B> entra no
            destaque — o prazo ainda está baixo.
          </Example>
        </div>
      </CollapsibleSection>

      {/* 5. Ranking */}
      <CollapsibleSection
        title="Como o ranking é ordenado"
        icon={Crown}
        summary="Nota → bônus → horas registradas"
      >
        <Q>
          Primeiro pela <B>nota</B> (maior para menor). Se empatar, vale o <B>maior bônus</B>.
          Se ainda empatar, vale quem <B>registrou mais horas</B>.
        </Q>
      </CollapsibleSection>

      {/* Fecho (sempre visível) */}
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
