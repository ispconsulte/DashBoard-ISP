import jsPDF from "jspdf";

/* ── Types ──────────────────────────────────────────────────────────── */
export type BonusPdfData = {
  consultantName: string;
  evaluatorName: string;
  monthLabel: string; // e.g. "03/2026"
  overallScore: number;
  payoutAmount: number;
  hideMonetary?: boolean;
  metrics: {
    onTimeRate: number;
    hardSkill: number;
    softSkill: number;
    peopleSkill: number;
  };
  evaluations: Array<{
    category: string;
    subtopic: string;
    score: number;
    justificativa: string;
    pontosMelhoria: string;
  }>;
};

/* ── Sanitize for Helvetica (Latin-1 only) ──────────────────────────── */
function san(text: string): string {
  if (!text) return "";
  return text
    .replace(/[\u0080-\u009F]/g, "")
    .replace(/[\uFFFD]/g, "?")
    .replace(/[^\x20-\x7E\xA0-\xFF\u2013\u2014\u2018\u2019\u201C\u201D\u2026]/g, "")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...")
    .trim();
}

/* ── Color palette ──────────────────────────────────────────────────── */
const BG = [18, 16, 42] as const;
const BG_CARD = [28, 26, 56] as const;
const ACCENT = [99, 102, 241] as const;
const TEXT_BRIGHT: [number, number, number] = [240, 240, 255];
const TEXT_MID: [number, number, number] = [200, 200, 230];
const TEXT_DIM: [number, number, number] = [150, 150, 180];

function scoreRgb(score: number): [number, number, number] {
  if (score >= 80) return [34, 197, 94];
  if (score >= 50) return [250, 204, 21];
  return [239, 68, 68];
}

/* ── Helpers ────────────────────────────────────────────────────────── */
function drawBg(doc: jsPDF) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setFillColor(...BG);
  doc.rect(0, 0, w, h, "F");
}

function money(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

function getNow() {
  return new Date().toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

async function loadLogo(): Promise<string | null> {
  try {
    const res = await fetch("/resouce/ISP-Consulte-v3-branco.png");
    const blob = await res.blob();
    return new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function drawFooter(doc: jsPDF, pageW: number, now: string) {
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_DIM);
  doc.text(san(`ISP Consulte — ${now}`), 14, pageH - 6);
  doc.text(`Pagina ${doc.getCurrentPageInfo().pageNumber}`, pageW - 14, pageH - 6, { align: "right" });
}

function ensureSpace(doc: jsPDF, y: number, need: number, margin = 14): number {
  const avail = doc.internal.pageSize.getHeight() - margin - y;
  if (need > avail && y > margin + 30) {
    doc.addPage();
    drawBg(doc);
    return margin;
  }
  return y;
}

/* ═══════════════════════════════════════════════════════════════════════
 * COVER PAGE
 * ═══════════════════════════════════════════════════════════════════════ */
function drawCover(doc: jsPDF, data: BonusPdfData, logo: string | null, now: string) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const cx = W / 2;
  drawBg(doc);

  // Top accent bar
  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, W, 3, "F");

  // Logo
  if (logo) {
    try {
      const lh = 20;
      const lw = lh * 3.6;
      doc.addImage(logo, "PNG", (W - lw) / 2, 24, lw, lh);
    } catch { /* noop */ }
  }

  // Title
  doc.setFontSize(26);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_BRIGHT);
  doc.text(san("Relatorio de Bonificacao"), cx, 66, { align: "center" });

  // Accent line
  doc.setFillColor(...ACCENT);
  doc.roundedRect(cx - 30, 72, 60, 1.5, 0.5, 0.5, "F");

  // Period
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT_MID);
  doc.text(san(`Periodo: ${data.monthLabel}`), cx, 82, { align: "center" });

  // Collaborator card
  const cardY = 96;
  const cardW = 160;
  const cardH = 36;
  const cardX = (W - cardW) / 2;
  doc.setFillColor(...BG_CARD);
  doc.roundedRect(cardX, cardY, cardW, cardH, 4, 4, "F");
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.3);
  doc.roundedRect(cardX, cardY, cardW, cardH, 4, 4, "S");

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT_DIM);
  doc.text("Colaborador", cardX + 10, cardY + 10);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_BRIGHT);
  doc.text(san(data.consultantName), cardX + 10, cardY + 20);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT_DIM);
  doc.text(san(`Avaliado por: ${data.evaluatorName}`), cardX + 10, cardY + 28);

  // ── Hero score ──
  const heroY = cardY + cardH + 16;
  const scoreClr = scoreRgb(data.overallScore);

  // Score circle
  const circleR = 18;
  doc.setFillColor(scoreClr[0], scoreClr[1], scoreClr[2]);
  doc.circle(cx, heroY + circleR, circleR, "F");
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(`${data.overallScore}%`, cx, heroY + circleR + 5, { align: "center" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT_DIM);
  doc.text("Nota Geral", cx, heroY + circleR * 2 + 8, { align: "center" });

  if (!data.hideMonetary) {
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT_BRIGHT);
    doc.text(san(money(data.payoutAmount)), cx, heroY + circleR * 2 + 17, { align: "center" });
  }

  // ── Metric cards ──
  const metricsY = heroY + circleR * 2 + (data.hideMonetary ? 18 : 26);
  const metrics = [
    { label: "Entregas no prazo", value: `${data.metrics.onTimeRate}%`, color: [59, 130, 246] as number[] },
    { label: "Tecnicas", value: `${data.metrics.hardSkill}/100`, color: [250, 204, 21] as number[] },
    { label: "Comportamentais", value: `${data.metrics.softSkill}/100`, color: [34, 197, 94] as number[] },
    { label: "Interpessoais", value: `${data.metrics.peopleSkill}/100`, color: [139, 92, 246] as number[] },
  ];

  const mCardW = 34;
  const mGap = 6;
  const mTotalW = metrics.length * mCardW + (metrics.length - 1) * mGap;
  const mStartX = (W - mTotalW) / 2;

  metrics.forEach((m, i) => {
    const mx = mStartX + i * (mCardW + mGap);
    doc.setFillColor(m.color[0], m.color[1], m.color[2]);
    doc.roundedRect(mx, metricsY, mCardW, 24, 3, 3, "F");

    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(san(m.value), mx + mCardW / 2, metricsY + 11, { align: "center" });

    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(230, 230, 255);
    doc.text(san(m.label), mx + mCardW / 2, metricsY + 19, { align: "center" });
  });

  // ── Introductory message ──
  const introY = metricsY + 32;
  const introMessages = [
    "Este relatorio reflete o nosso compromisso com o seu crescimento. Cada avaliacao e uma oportunidade de evoluir juntos, como equipe.",
    "Acreditamos que crescer e um processo coletivo. Este documento foi preparado para reconhecer conquistas e apontar caminhos de evolucao.",
    "Nosso objetivo com este relatorio e fortalecer a parceria e o desenvolvimento continuo. Valorizamos cada passo da sua trajetoria conosco.",
  ];
  // Pick message based on month to vary across reports
  const msgIndex = (Number(data.monthLabel.split("/")[0]) || 0) % introMessages.length;
  const introText = introMessages[msgIndex];

  const introBoxW = 150;
  const introBoxX = (W - introBoxW) / 2;
  doc.setFillColor(BG_CARD[0], BG_CARD[1], BG_CARD[2]);
  doc.roundedRect(introBoxX, introY, introBoxW, 18, 3, 3, "F");
  doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.setLineWidth(0.2);
  doc.roundedRect(introBoxX, introY, introBoxW, 18, 3, 3, "S");

  doc.setFontSize(7.8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(TEXT_MID[0], TEXT_MID[1], TEXT_MID[2]);
  const lines = doc.splitTextToSize(san(introText), introBoxW - 12);
  doc.text(lines, cx, introY + 6, { align: "center", lineHeightFactor: 1.5 });

  // Bottom accent
  doc.setFillColor(...ACCENT);
  doc.rect(0, H - 3, W, 3, "F");
  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 160);
  doc.text(san("Relatorio gerado pela ISP Consulte. Todos os direitos reservados."), cx, H - 8, { align: "center" });
}

/* ═══════════════════════════════════════════════════════════════════════
 * EVALUATIONS PAGE(S)
 * ═══════════════════════════════════════════════════════════════════════ */
function drawEvaluations(doc: jsPDF, data: BonusPdfData, logo: string | null, now: string) {
  const W = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentW = W - margin * 2;

  doc.addPage();
  drawBg(doc);

  // Page header
  doc.setFillColor(24, 22, 60);
  doc.rect(0, 0, W, 22, "F");
  doc.setFillColor(...ACCENT);
  doc.rect(0, 22, W, 0.8, "F");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_MID);
  doc.text(san("Detalhamento das Avaliacoes"), margin, 14);

  if (logo) {
    try {
      const h = 12;
      const w = h * 3.6;
      doc.addImage(logo, "PNG", W - w - 10, (22 - h) / 2, w, h);
    } catch { /* noop */ }
  }

  let y = 30;

  // Group by category
  const groups = new Map<string, typeof data.evaluations>();
  data.evaluations.forEach((e) => {
    if (!groups.has(e.category)) groups.set(e.category, []);
    groups.get(e.category)!.push(e);
  });

  for (const [category, items] of groups) {
    // Category header
    y = ensureSpace(doc, y, 18, margin);
    if (y <= margin + 2) {
      // New page was added, redraw header
      doc.setFillColor(24, 22, 60);
      doc.rect(0, 0, W, 22, "F");
      doc.setFillColor(...ACCENT);
      doc.rect(0, 22, W, 0.8, "F");
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...TEXT_MID);
      doc.text(san("Detalhamento das Avaliacoes (cont.)"), margin, 14);
      if (logo) {
        try {
          const h = 12;
          const w = h * 3.6;
          doc.addImage(logo, "PNG", W - w - 10, (22 - h) / 2, w, h);
        } catch { /* noop */ }
      }
      y = 30;
    }

    // Category avg
    const avg = items.length > 0
      ? Math.round(items.reduce((s, e) => s + e.score, 0) / items.length * 10)
      : 0;

    doc.setFillColor(...BG_CARD);
    doc.roundedRect(margin, y, contentW, 10, 2, 2, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT_BRIGHT);
    doc.text(san(category), margin + 4, y + 6.5);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_DIM);
    doc.text(san(`Media: ${avg}/100`), W - margin - 4, y + 6.5, { align: "right" });
    y += 14;

    // Each subtopic
    for (const item of items) {
      const hasJust = !!item.justificativa.trim();
      const hasPontos = !!item.pontosMelhoria.trim();
      const textLines = hasJust || hasPontos ? 1 : 0;
      const rowH = 12 + textLines * 14;

      y = ensureSpace(doc, y, rowH, margin);
      if (y <= margin + 2) {
        drawBg(doc);
        doc.setFillColor(24, 22, 60);
        doc.rect(0, 0, W, 22, "F");
        doc.setFillColor(...ACCENT);
        doc.rect(0, 22, W, 0.8, "F");
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...TEXT_MID);
        doc.text(san("Detalhamento das Avaliacoes (cont.)"), margin, 14);
        y = 30;
      }

      // Score dot
      const sClr = scoreRgb(item.score * 10);
      doc.setFillColor(sClr[0], sClr[1], sClr[2]);
      doc.circle(margin + 3, y + 4, 1.5, "F");

      // Subtopic name
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...TEXT_BRIGHT);
      doc.text(san(item.subtopic), margin + 8, y + 5);

      // Score badge
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(sClr[0], sClr[1], sClr[2]);
      doc.text(`${item.score}/10`, W - margin - 4, y + 5, { align: "right" });

      y += 8;

      // Justificativa
      if (hasJust) {
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...TEXT_DIM);
        const justText = san(item.justificativa).substring(0, 120);
        doc.text(justText, margin + 8, y + 3);
        y += 6;
      }

      // Pontos de melhoria
      if (hasPontos) {
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(180, 160, 200);
        const pontosText = san(item.pontosMelhoria).substring(0, 120);
        doc.text(san(`Melhoria: ${pontosText}`), margin + 8, y + 3);
        y += 6;
      }

      y += 3;

      // Separator
      doc.setDrawColor(50, 48, 80);
      doc.setLineWidth(0.15);
      doc.line(margin + 8, y, W - margin, y);
      y += 3;
    }

    y += 4;
  }

  drawFooter(doc, W, now);
}

/* ═══════════════════════════════════════════════════════════════════════
 * PUBLIC EXPORT
 * ═══════════════════════════════════════════════════════════════════════ */
export async function exportBonusReportPdf(data: BonusPdfData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const now = getNow();
  const logo = await loadLogo();

  // Page 1: Cover
  drawCover(doc, data, logo, now);
  drawFooter(doc, doc.internal.pageSize.getWidth(), now);

  // Page 2+: Evaluation details
  if (data.evaluations.length > 0) {
    drawEvaluations(doc, data, logo, now);
  }

  const fileName = san(`relatorio-bonus-${data.consultantName.split(" ")[0]}-${data.monthLabel.replace("/", "-")}.pdf`);
  doc.save(fileName || "relatorio-bonus.pdf");
}
