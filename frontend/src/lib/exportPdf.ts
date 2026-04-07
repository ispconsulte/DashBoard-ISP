import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type TaskRow = {
  title: string;
  project: string;
  consultant: string;
  statusLabel: string;
  deadlineLabel: string;
  durationLabel: string;
};

type ExportOptions = {
  title?: string;
  subtitle?: string;
  fileName?: string;
  tasks: TaskRow[];
  generatedBy?: string;
  stats?: {
    total: number;
    done: number;
    overdue: number;
    pending: number;
    totalHours?: string;
  };
};

/* ═══════════════════════════════════════════════
 * SHARED HELPERS
 * ═══════════════════════════════════════════════ */

/** Sanitize text for jsPDF (Helvetica only supports Latin-1 / WinAnsi).
 *  Strips characters outside that range so they don't render as garbled glyphs. */
function sanitizeText(text: string): string {
  if (!text) return text;
  // Replace common Unicode artifacts with readable equivalents
  return text
    .replace(/[\u0080-\u009F]/g, "") // C1 control chars
    .replace(/[\uFFFD]/g, "?")       // replacement char
    // Keep only printable Latin-1 + common punctuation
    .replace(/[^\x20-\x7E\xA0-\xFF\u2013\u2014\u2018\u2019\u201C\u201D\u2026]/g, "")
    // Normalize dashes and quotes to ASCII equivalents
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...")
    .trim();
}

function ensureSpace(doc: jsPDF, currentY: number, neededHeight: number, margin = 14): number {
  const pageH = doc.internal.pageSize.getHeight();
  const available = pageH - margin - currentY;
  if (neededHeight > available && currentY > margin + 32) {
    doc.addPage();
    drawPageBg(doc);
    return margin;
  }
  return currentY;
}

async function loadLogoBase64(): Promise<string | null> {
  try {
    const response = await fetch("/resouce/ISP-Consulte-v3-branco.png");
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function drawPageBg(doc: jsPDF) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFillColor(18, 16, 42);
  doc.rect(0, 0, pageW, pageH, "F");
}

function drawFooter(doc: jsPDF, pageW: number, now: string, generatedBy?: string) {
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 180);
  const footer = generatedBy
    ? `ISP Consulte — Gerado por ${generatedBy} em ${now}`
    : `ISP Consulte — ${now}`;
  doc.text(footer, 14, pageH - 6);
  doc.text(`Página ${doc.getCurrentPageInfo().pageNumber}`, pageW - 14, pageH - 6, { align: "right" });
}

const HEADER_H = 22;

function drawPageHeader(doc: jsPDF, logo: string | null, pageW: number, reportTitle: string) {
  doc.setFillColor(24, 22, 60);
  doc.rect(0, 0, pageW, HEADER_H, "F");
  doc.setFillColor(99, 102, 241);
  doc.rect(0, HEADER_H, pageW, 0.8, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(200, 200, 230);
  doc.text(reportTitle, 14, HEADER_H / 2 + 2);
  if (logo) {
    try {
      const h = 12;
      const w = h * 3.6;
      doc.addImage(logo, "PNG", pageW - w - 10, (HEADER_H - h) / 2, w, h);
    } catch {}
  } else {
    doc.setFontSize(9);
    doc.setTextColor(180, 180, 210);
    doc.text("ISP Consulte", pageW - 14, HEADER_H / 2 + 2, { align: "right" });
  }
}

function drawBarChart(
  doc: jsPDF, x: number, y: number, width: number, height: number,
  data: { label: string; value: number; color: number[] }[], title: string
) {
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const barGap = 4;
  const labelH = 12;
  const chartH = height - labelH - 10;
  const barW = (width - barGap * (data.length + 1)) / data.length;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(200, 200, 230);
  doc.text(title, x, y + 6);

  const titleYEnd = y + 10;

  data.forEach((d, i) => {
    const bx = x + barGap + i * (barW + barGap);
    const bh = (d.value / maxVal) * (chartH - 4);
    const by = titleYEnd + 4 + (chartH - 4 - bh);
    doc.setFillColor(d.color[0], d.color[1], d.color[2]);
    doc.roundedRect(bx, by, barW, bh, 1, 1, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(d.color[0], d.color[1], d.color[2]);
    doc.text(String(d.value), bx + barW / 2, by - 2.5, { align: "center" });
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(160, 160, 190);
    const maxLabelLen = Math.max(12, Math.floor(barW / 1.4));
    const label = d.label.length > maxLabelLen ? d.label.slice(0, maxLabelLen - 1) + "…" : d.label;
    doc.text(label, bx + barW / 2, y + 10 + chartH + 6, { align: "center" });
  });
}

function drawDonutChart(
  doc: jsPDF, cx: number, cy: number, r: number,
  data: { label: string; value: number; color: number[] }[]
) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return;

  const inner = r * 0.55;
  let startAngle = -Math.PI / 2;
  data.forEach((d) => {
    const sliceAngle = (d.value / total) * 2 * Math.PI;
    doc.setFillColor(d.color[0], d.color[1], d.color[2]);
    const steps = Math.max(40, Math.ceil(sliceAngle * 80));
    for (let s = 0; s < steps; s++) {
      const a1 = startAngle + (s / steps) * sliceAngle;
      const a2 = startAngle + ((s + 1) / steps) * sliceAngle;
      const ox1 = cx + r * Math.cos(a1), oy1 = cy + r * Math.sin(a1);
      const ox2 = cx + r * Math.cos(a2), oy2 = cy + r * Math.sin(a2);
      const ix1 = cx + inner * Math.cos(a1), iy1 = cy + inner * Math.sin(a1);
      const ix2 = cx + inner * Math.cos(a2), iy2 = cy + inner * Math.sin(a2);
      doc.triangle(ox1, oy1, ox2, oy2, ix1, iy1, "F");
      doc.triangle(ix1, iy1, ox2, oy2, ix2, iy2, "F");
    }
    startAngle += sliceAngle;
  });

  const legendX = cx + r + 6;
  data.forEach((d, i) => {
    const ly = cy - r + i * 11 + 2;
    doc.setFillColor(d.color[0], d.color[1], d.color[2]);
    doc.roundedRect(legendX, ly, 4, 4, 0.5, 0.5, "F");
    doc.setFontSize(7.5);
    doc.setTextColor(180, 180, 210);
    const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
    doc.text(`${d.label} (${pct}%)`, legendX + 6, ly + 3.5);
  });
}

function drawClientHoursBar(
  doc: jsPDF, x: number, y: number, width: number,
  used: number, contracted: number, label: string
) {
  const pct = contracted > 0 ? Math.min(100, Math.round((used / contracted) * 100)) : 0;
  const color: [number, number, number] =
    pct >= 90 ? [239, 68, 68] : pct >= 70 ? [250, 204, 21] : [34, 197, 94];

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 180, 210);
  const shortLabel = label.length > 24 ? label.slice(0, 23) + "…" : label;
  doc.text(shortLabel, x, y + 4);

  const bx = x + 48;
  const bw = width - 48 - 28;
  doc.setFillColor(40, 38, 70);
  doc.roundedRect(bx, y, bw, 4, 0.8, 0.8, "F");
  if (pct > 0) {
    doc.setFillColor(...color);
    doc.roundedRect(bx, y, (pct / 100) * bw, 4, 0.8, 0.8, "F");
  }

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(color[0], color[1], color[2]);
  const hoursText = contracted > 0
    ? `${Math.round(used)}h / ${Math.round(contracted)}h (${pct}%)`
    : `${Math.round(used)}h`;
  doc.text(hoursText, bx + bw + 3, y + 3.5);
}

function getNow() {
  return new Date().toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/* ═══════════════════════════════════════════════
 * PAGE 1: Executive Cover Page
 * ═══════════════════════════════════════════════ */
function drawCoverPage(
  doc: jsPDF, logo: string | null, pageW: number, pageH: number,
  reportTitle: string, now: string, generatedBy?: string,
  stats?: ExportOptions["stats"], tasks?: TaskRow[]
) {
  drawPageBg(doc);

  // Decorative gradient bar at top
  doc.setFillColor(99, 102, 241);
  doc.rect(0, 0, pageW, 3, "F");

  // Logo — large centered
  if (logo) {
    try {
      const logoH = 22;
      const logoW = logoH * 3.6;
      doc.addImage(logo, "PNG", (pageW - logoW) / 2, 26, logoW, logoH);
    } catch {}
  }

  const centerX = pageW / 2;

  // Report title
  doc.setFontSize(30);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(reportTitle, centerX, 72, { align: "center" });

  // Decorative line under title
  const lineW = 60;
  doc.setFillColor(99, 102, 241);
  doc.roundedRect(centerX - lineW / 2, 78, lineW, 1.5, 0.5, 0.5, "F");

  // Metadata
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 180, 210);
  doc.text(now, centerX, 88, { align: "center" });
  if (generatedBy) {
    doc.text(`Gerado por ${generatedBy}`, centerX, 97, { align: "center" });
  }

  // Stats cards (mini summary)
  if (stats) {
    const cardY = 114;
    const cards = [
      { label: "Total", value: String(stats.total), color: [80, 85, 140] as number[] },
      { label: "Concluídas", value: String(stats.done), color: [34, 197, 94] as number[] },
      { label: "Em Andamento", value: String(stats.pending), color: [250, 204, 21] as number[] },
      { label: "Atrasadas", value: String(stats.overdue), color: [239, 68, 68] as number[] },
    ];
    if (stats.totalHours) {
      cards.push({ label: "Horas", value: stats.totalHours, color: [139, 92, 246] });
    }
    const cardW = 40;
    const gap = 6;
    const totalW = cards.length * cardW + (cards.length - 1) * gap;
    const startX = (pageW - totalW) / 2;

    cards.forEach((card, i) => {
      const x = startX + i * (cardW + gap);
      doc.setFillColor(card.color[0], card.color[1], card.color[2]);
      doc.roundedRect(x, cardY, cardW, 26, 3, 3, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text(card.value, x + cardW / 2, cardY + 13, { align: "center" });
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(230, 230, 255);
      doc.text(card.label, x + cardW / 2, cardY + 22, { align: "center" });
    });

    // Insights box — bigger fonts
    if (stats.total > 0) {
      const completionPct = Math.round((stats.done / stats.total) * 100);
      const avgTasksPerProject = tasks
        ? (() => {
            const projects = new Set(tasks.map(t => t.project).filter(Boolean));
            return projects.size > 0 ? Math.round(stats.total / projects.size) : 0;
          })()
        : 0;

      const insightY = cardY + 40;
      doc.setFillColor(28, 26, 56);
      doc.roundedRect(centerX - 95, insightY, 190, 38, 4, 4, "F");
      doc.setDrawColor(99, 102, 241);
      doc.setLineWidth(0.3);
      doc.roundedRect(centerX - 95, insightY, 190, 38, 4, 4, "S");

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(220, 220, 240);
      doc.text("Insights do Relatório", centerX, insightY + 9, { align: "center" });

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(180, 180, 210);

      const insights: string[] = [];
      insights.push(`Taxa de conclusão geral: ${completionPct}%`);
      if (stats.overdue > 0) {
        insights.push(`${stats.overdue} tarefa${stats.overdue > 1 ? "s" : ""} atrasada${stats.overdue > 1 ? "s" : ""} requer${stats.overdue > 1 ? "em" : ""} atenção imediata`);
      } else {
        insights.push("Nenhuma tarefa atrasada — excelente desempenho!");
      }
      if (avgTasksPerProject > 0) {
        const projectCount = tasks ? new Set(tasks.map(t => t.project).filter(Boolean)).size : 0;
        insights.push(`Média de ${avgTasksPerProject} tarefas por projeto (${projectCount} projetos)`);
      }

      insights.forEach((line, i) => {
        doc.text(`• ${line}`, centerX - 82, insightY + 17 + i * 7);
      });
    }
  }

  // Bottom decoration
  doc.setFillColor(99, 102, 241);
  doc.rect(0, pageH - 3, pageW, 3, "F");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 160);
  doc.text("Relatório gerado pelo time da ISP Consulte. Todos os direitos reservados.", centerX, pageH - 8, { align: "center" });
}

/* ═══════════════════════════════════════════════
 * TABLE START Y — below header
 * ═══════════════════════════════════════════════ */
const TABLE_START_Y = HEADER_H + 8;

/* ═══════════════════════════════════════════════
 * EXPORT: Tasks PDF (enhanced)
 * ═══════════════════════════════════════════════ */
export async function exportTasksPDF({
  title = "Relatório de Tarefas",
  subtitle,
  fileName = "relatorio-tarefas.pdf",
  tasks,
  stats,
  generatedBy,
}: ExportOptions) {
  const projectNames = new Set(tasks.map(t => t.project).filter(Boolean));
  const dynamicTitle = projectNames.size === 1
    ? `Relatório — ${[...projectNames][0]}`
    : title;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const now = getNow();
  const logo = await loadLogoBase64();

  // ── PAGE 1: Cover ──
  drawCoverPage(doc, logo, pageW, pageH, dynamicTitle, now, generatedBy, stats, tasks);

  // Group tasks by project for per-project sections
  const projectGroups = new Map<string, TaskRow[]>();
  tasks.forEach((t) => {
    const pName = t.project || "Sem projeto";
    if (!projectGroups.has(pName)) projectGroups.set(pName, []);
    projectGroups.get(pName)!.push(t);
  });
  const sortedProjects = Array.from(projectGroups.entries())
    .sort((a, b) => b[1].length - a[1].length);

  // ── PAGE 2: Charts / Visual Summary ──
  doc.addPage();
  drawPageBg(doc);
  drawPageHeader(doc, logo, pageW, dynamicTitle);

  // Section title
  let yPos = TABLE_START_Y;
  yPos += 2;

  if (stats) {
    const hasAnyTask = stats.done > 0 || stats.pending > 0 || stats.overdue > 0;

    if (hasAnyTask) {
      // Donut + Bar chart
      const chartSectionH = 44;
      yPos = ensureSpace(doc, yPos, chartSectionH);

      const chartData = [
        { label: "Concluído", value: stats.done, color: [34, 197, 94] },
        { label: "Andamento", value: stats.pending, color: [250, 204, 21] },
        { label: "Atrasado", value: stats.overdue, color: [239, 68, 68] },
      ];
      doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(200, 200, 230);
      doc.text("Distribuição por Status", 14, yPos + 4);
      drawDonutChart(doc, 50, yPos + 22, 14, chartData);

      // Bar chart — top 4 consultants
      const consultantCounts = new Map<string, number>();
      tasks.forEach((t) => {
        const c = t.consultant || "Não atribuído";
        consultantCounts.set(c, (consultantCounts.get(c) ?? 0) + 1);
      });
      const topConsultants = Array.from(consultantCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map((e, i) => ({
          label: e[0].length > 26 ? e[0].slice(0, 25) + "…" : e[0],
          value: e[1],
          color: [[59, 130, 246], [139, 92, 246], [34, 197, 94], [250, 204, 21]][i % 4],
        }));

      if (topConsultants.length > 0) {
        drawBarChart(doc, 115, yPos, pageW - 129, 38, topConsultants, "Tarefas por Responsável");
      }

      yPos += chartSectionH + 2;

      // Productivity pulse — show up to 10 projects
      const projectCounts = new Map<string, { done: number; pending: number; overdue: number }>();
      tasks.forEach((t) => {
        const p = t.project || "Sem projeto";
        const cur = projectCounts.get(p) ?? { done: 0, pending: 0, overdue: 0 };
        if (t.statusLabel === "Concluído") cur.done++;
        else if (t.statusLabel === "Atrasado") cur.overdue++;
        else cur.pending++;
        projectCounts.set(p, cur);
      });

      const productivityData = Array.from(projectCounts.entries())
        .map(([name, s]) => {
          const total = s.done + s.pending + s.overdue;
          const pct = total > 0 ? Math.round((s.done / total) * 100) : 0;
          return [name, s, pct] as [string, typeof s, number];
        })
        .sort((a, b) => {
          const totalB = b[1].done + b[1].pending + b[1].overdue;
          const totalA = a[1].done + a[1].pending + a[1].overdue;
          return totalB - totalA;
        })
        .slice(0, 8);

      if (productivityData.length > 0) {
        const rowH = 9;
        const sectionH = 16 + productivityData.length * rowH + 6;
        yPos = ensureSpace(doc, yPos, sectionH);

        doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(200, 200, 230);
        doc.text("Pulso de Produtividade — % Conclusão por Projeto", 14, yPos + 4);

        const startY = yPos + 10;
        const labelW = 72;
        const barMaxW = pageW - 28 - labelW - 30;

        productivityData.forEach(([name, s, pct], i) => {
          const ry = startY + i * rowH;
          if (i % 2 === 0) {
            doc.setFillColor(28, 26, 56);
            doc.roundedRect(12, ry - 1, pageW - 24, rowH, 1, 1, "F");
          }
          doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(180, 180, 210);
          const shortName = name.length > 38 ? name.slice(0, 37) + "…" : name;
          doc.text(shortName, 14, ry + rowH * 0.55);
          const bx = 14 + labelW;
          const bh = rowH * 0.45;
          const by = ry + rowH * 0.2;
          doc.setFillColor(40, 38, 70); doc.roundedRect(bx, by, barMaxW, bh, 1, 1, "F");
          if (pct > 0) {
            const fillW = (pct / 100) * barMaxW;
            const color: [number, number, number] = pct >= 80 ? [34, 197, 94] : pct >= 50 ? [250, 204, 21] : [239, 68, 68];
            doc.setFillColor(...color);
            doc.roundedRect(bx, by, fillW, bh, 1, 1, "F");
          }
          doc.setFontSize(8); doc.setFont("helvetica", "bold");
          const pctColor: [number, number, number] = pct >= 80 ? [34, 160, 80] : pct >= 50 ? [180, 150, 20] : [220, 50, 50];
          doc.setTextColor(...pctColor);
          doc.text(`${pct}%`, bx + barMaxW + 4, ry + rowH * 0.6);
        });

        yPos += sectionH;
      }
    }
  }

  drawFooter(doc, pageW, now, generatedBy);

  // ── PAGES 3+: Tasks grouped by project ──
  if (sortedProjects.length > 1) {
    // Multiple projects — one section per project
    sortedProjects.forEach(([projectName, projectTasks]) => {
      doc.addPage();
      drawPageBg(doc);
      drawPageHeader(doc, logo, pageW, dynamicTitle);

      let py = TABLE_START_Y;

      // Project title bar
      doc.setFillColor(30, 27, 75);
      doc.roundedRect(14, py, pageW - 28, 14, 2, 2, "F");
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(projectName, 20, py + 9);

      // Mini stats for this project
      const pDone = projectTasks.filter(t => t.statusLabel === "Concluído").length;
      const pOverdue = projectTasks.filter(t => t.statusLabel === "Atrasado").length;
      const pPct = projectTasks.length > 0 ? Math.round((pDone / projectTasks.length) * 100) : 0;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(180, 180, 210);
      const miniStats = `${projectTasks.length} tarefas · ${pDone} concluídas · ${pOverdue} atrasadas · ${pPct}% conclusão`;
      doc.text(miniStats, pageW - 20, py + 9, { align: "right" });

      py += 20;

      // Table for this project
      const tableBody = projectTasks.map((t) => [
        sanitizeText(t.title), sanitizeText(t.consultant), t.statusLabel, t.deadlineLabel, t.durationLabel,
      ]);

      autoTable(doc, {
        startY: py,
        head: [["Tarefa", "Responsável", "Status", "Prazo", "Duração"]],
        body: tableBody,
        theme: "grid",
        styles: { fontSize: 8.5, cellPadding: 3.5, textColor: [200, 200, 230], lineColor: [50, 48, 80], lineWidth: 0.15, fillColor: [22, 20, 48] },
        headStyles: {
          fillColor: [24, 22, 60], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5, halign: "center", cellPadding: 4,
        },
        alternateRowStyles: { fillColor: [28, 26, 56] },
        columnStyles: {
          0: { cellWidth: "auto", fontStyle: "bold", halign: "left" },
          1: { halign: "center", cellWidth: 42 },
          2: { halign: "center", cellWidth: 30 },
          3: { halign: "center", cellWidth: 26 },
          4: { halign: "center", cellWidth: 22 },
        },
        margin: { left: 14, right: 14, top: TABLE_START_Y },
        willDrawPage: (data: any) => {
          if (data.pageNumber > 1) drawPageBg(doc);
          drawPageHeader(doc, logo, pageW, dynamicTitle);
        },
        didDrawPage: () => drawFooter(doc, pageW, now, generatedBy),
        didParseCell: (data: any) => {
          if (data.section === "body" && data.column.index === 2) {
            const val = String(data.cell.raw ?? "").toLowerCase();
            if (val.includes("conclu") || val === "done") {
              data.cell.styles.textColor = [34, 160, 80]; data.cell.styles.fontStyle = "bold";
            } else if (val.includes("atras") || val === "overdue") {
              data.cell.styles.textColor = [220, 50, 50]; data.cell.styles.fontStyle = "bold";
            } else if (val.includes("andamento") || val === "pending" || val.includes("em andamento")) {
              data.cell.styles.textColor = [250, 204, 21]; data.cell.styles.fontStyle = "bold";
            }
          }
        },
      });

      drawFooter(doc, pageW, now, generatedBy);
    });
  } else {
    // Single project or all tasks — one big table
    doc.addPage();
    drawPageBg(doc);
    drawPageHeader(doc, logo, pageW, dynamicTitle);

    const tableBody = tasks.map((t) => [
      sanitizeText(t.title), sanitizeText(t.project), sanitizeText(t.consultant), t.statusLabel, t.deadlineLabel, t.durationLabel,
    ]);

    autoTable(doc, {
      startY: TABLE_START_Y,
      head: [["Tarefa", "Projeto", "Responsável", "Status", "Prazo", "Duração"]],
      body: tableBody,
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 3.5, textColor: [200, 200, 230], lineColor: [50, 48, 80], lineWidth: 0.15, fillColor: [22, 20, 48] },
      headStyles: {
        fillColor: [24, 22, 60], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5, halign: "center", cellPadding: 4,
      },
      alternateRowStyles: { fillColor: [28, 26, 56] },
      columnStyles: {
        0: { cellWidth: "auto", fontStyle: "bold", halign: "left" },
        1: { halign: "center", cellWidth: 38 },
        2: { halign: "center", cellWidth: 42 },
        3: { halign: "center", cellWidth: 30 },
        4: { halign: "center", cellWidth: 26 },
        5: { halign: "center", cellWidth: 22 },
      },
      margin: { left: 14, right: 14, top: TABLE_START_Y },
      willDrawPage: (data: any) => {
        if (data.pageNumber > 1) drawPageBg(doc);
        drawPageHeader(doc, logo, pageW, dynamicTitle);
      },
      didDrawPage: () => drawFooter(doc, pageW, now, generatedBy),
      didParseCell: (data: any) => {
        if (data.section === "body" && data.column.index === 3) {
          const val = String(data.cell.raw ?? "").toLowerCase();
          if (val.includes("conclu") || val === "done") {
            data.cell.styles.textColor = [34, 160, 80]; data.cell.styles.fontStyle = "bold";
          } else if (val.includes("atras") || val === "overdue") {
            data.cell.styles.textColor = [220, 50, 50]; data.cell.styles.fontStyle = "bold";
          } else if (val.includes("andamento") || val === "pending" || val.includes("em andamento")) {
            data.cell.styles.textColor = [250, 204, 21]; data.cell.styles.fontStyle = "bold";
          }
        }
      },
    });

    drawFooter(doc, pageW, now, generatedBy);
  }

  doc.save(fileName);
}

/* ═══════════════════════════════════════════════
 * EXPORT: Client PDF
 * ═══════════════════════════════════════════════ */

type ClientExportOptions = {
  clientName: string;
  generatedBy?: string;
  period?: string;
  fileName?: string;
  projects: Array<{
    name: string;
    totalTasks: number;
    doneTasks: number;
    overdueTasks: number;
    hours: number;
    hoursContracted: number;
  }>;
};

export async function exportClientPDF({
  clientName,
  period,
  generatedBy,
  fileName,
  projects,
}: ClientExportOptions) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const now = getNow();
  const logo = await loadLogoBase64();
  const safeFileName = fileName ?? `relatorio-${clientName.toLowerCase().replace(/[^a-z0-9]/g, "-")}.pdf`;

  const reportTitle = `Relatório — ${clientName}`;

  // Totals
  const totalTasks = projects.reduce((s, p) => s + p.totalTasks, 0);
  const totalDone = projects.reduce((s, p) => s + p.doneTasks, 0);
  const totalOver = projects.reduce((s, p) => s + p.overdueTasks, 0);
  const totalHours = projects.reduce((s, p) => s + p.hours, 0);
  const totalContr = projects.reduce((s, p) => s + (p.hoursContracted || 0), 0);

  // ── PAGE 1: Cover ──
  drawCoverPage(doc, logo, pageW, pageH, reportTitle, now, generatedBy, {
    total: totalTasks, done: totalDone, overdue: totalOver,
    pending: totalTasks - totalDone - totalOver,
    totalHours: `${Math.round(totalHours)}h`,
  });

  // ── PAGE 2: Charts ──
  doc.addPage();
  drawPageBg(doc);
  drawPageHeader(doc, logo, pageW, reportTitle);

  let yPos = TABLE_START_Y;
  yPos += 2;

  // Cards
  const cards = [
    { label: "Projetos", value: String(projects.length), color: [99, 102, 241] as [number, number, number] },
    { label: "Tarefas", value: String(totalTasks), color: [59, 130, 246] as [number, number, number] },
    { label: "Concluídas", value: String(totalDone), color: [34, 197, 94] as [number, number, number] },
    { label: "Atrasadas", value: String(totalOver), color: [239, 68, 68] as [number, number, number] },
    { label: "Horas usadas", value: `${Math.round(totalHours)}h`, color: [139, 92, 246] as [number, number, number] },
  ];

  const cardW = (pageW - 28 - 4 * 4) / 5;
  cards.forEach((card, i) => {
    const x = 14 + i * (cardW + 4);
    doc.setFillColor(...card.color);
    doc.roundedRect(x, yPos, cardW, 16, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text(card.value, x + cardW / 2, yPos + 8, { align: "center" });
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(card.label, x + cardW / 2, yPos + 13, { align: "center" });
  });
  yPos += 22;

  // Donut
  yPos = ensureSpace(doc, yPos, 52);
  const completionData = [
    { label: "Concluídas", value: totalDone, color: [34, 197, 94] },
    { label: "Andamento", value: totalTasks - totalDone - totalOver, color: [250, 204, 21] },
    { label: "Atrasadas", value: totalOver, color: [239, 68, 68] },
  ];
  doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(200, 200, 230);
  doc.text("Status das Tarefas", 14, yPos + 4);
  drawDonutChart(doc, 50, yPos + 26, 16, completionData);
  yPos += 52;

  // Hours progress bars
  if (totalContr > 0) {
    const hoursH = 6 + projects.length * 8 + 4;
    yPos = ensureSpace(doc, yPos, hoursH);
    doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(200, 200, 230);
    doc.text("Consumo de Horas Contratadas", 14, yPos);
    yPos += 6;
    projects.forEach((p) => {
      yPos = ensureSpace(doc, yPos, 10);
      drawClientHoursBar(doc, 14, yPos, pageW - 28, p.hours, p.hoursContracted, p.name);
      yPos += 8;
    });
  }

  drawFooter(doc, pageW, now, generatedBy);

  // ── PAGE 3: Projects table ──
  doc.addPage();
  drawPageBg(doc);
  drawPageHeader(doc, logo, pageW, reportTitle);

  const tableBody = projects.map((p) => {
    const completion = p.totalTasks > 0 ? Math.round((p.doneTasks / p.totalTasks) * 100) : 0;
    const hoursLeft = p.hoursContracted > 0 ? Math.round(p.hoursContracted - p.hours) : "—";
    return [
      p.name, String(p.totalTasks), String(p.doneTasks), String(p.overdueTasks),
      `${Math.round(p.hours)}h`,
      p.hoursContracted > 0 ? `${p.hoursContracted}h` : "—",
      typeof hoursLeft === "number" ? `${hoursLeft}h` : "—",
      `${completion}%`,
    ];
  });

  autoTable(doc, {
    startY: TABLE_START_Y,
    head: [["Projeto", "Tarefas", "Concluídas", "Atrasadas", "Horas Usadas", "Contratadas", "Restam", "Conclusão"]],
    body: tableBody,
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 2.5, textColor: [200, 200, 230], lineColor: [50, 48, 80], lineWidth: 0.2, fillColor: [22, 20, 48] },
    headStyles: { fillColor: [30, 27, 75], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
    alternateRowStyles: { fillColor: [28, 26, 56] },
    columnStyles: {
      0: { cellWidth: "auto", fontStyle: "bold" },
      1: { halign: "center", cellWidth: 18 },
      2: { halign: "center", cellWidth: 22 },
      3: { halign: "center", cellWidth: 20 },
      4: { halign: "center", cellWidth: 22 },
      5: { halign: "center", cellWidth: 22 },
      6: { halign: "center", cellWidth: 18 },
      7: { halign: "center", cellWidth: 20 },
    },
    margin: { left: 14, right: 14, top: TABLE_START_Y },
    willDrawPage: (data: any) => {
      if (data.pageNumber > 1) drawPageBg(doc);
      drawPageHeader(doc, logo, pageW, reportTitle);
    },
    didDrawPage: () => drawFooter(doc, pageW, now, generatedBy),
  });

  drawFooter(doc, pageW, now, generatedBy);

  doc.save(safeFileName);
}

/* ═══════════════════════════════════════════════
 * EXPORT: Analytics PDF
 * ═══════════════════════════════════════════════ */

type AnalyticsExportOptions = {
  generatedBy?: string;
  userName?: string;
  period?: string;
  fileName?: string;
  projects: Array<{
    name: string;
    totalTasks: number;
    doneTasks: number;
    overdueTasks: number;
    hours: number;
    hoursContracted?: number;
  }>;
  totals: {
    projects: number;
    tasks: number;
    done: number;
    overdue: number;
    hours: number;
  };
};

export async function exportAnalyticsPDF({
  userName,
  period,
  fileName = "relatorio-analiticas.pdf",
  projects,
  totals,
  generatedBy,
}: AnalyticsExportOptions) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const now = getNow();
  const logo = await loadLogoBase64();
  const reportTitle = "Relatório de Analíticas";

  // ── PAGE 1: Cover ──
  drawCoverPage(doc, logo, pageW, pageH, reportTitle, now, generatedBy, {
    total: totals.tasks, done: totals.done, overdue: totals.overdue,
    pending: totals.tasks - totals.done - totals.overdue,
    totalHours: `${Math.round(totals.hours)}h`,
  });

  // ── PAGE 2: Charts ──
  doc.addPage();
  drawPageBg(doc);
  drawPageHeader(doc, logo, pageW, reportTitle);

  let yPos = TABLE_START_Y;
  yPos += 2;

  // Cards
  const cards = [
    { label: "Projetos", value: String(totals.projects), color: [99, 102, 241] },
    { label: "Tarefas", value: String(totals.tasks), color: [59, 130, 246] },
    { label: "Concluídas", value: String(totals.done), color: [34, 197, 94] },
    { label: "Atrasadas", value: String(totals.overdue), color: [239, 68, 68] },
    { label: "Horas", value: `${Math.round(totals.hours)}h`, color: [139, 92, 246] },
  ];

  const cardW = (pageW - 28 - 4 * 4) / 5;
  cards.forEach((card, i) => {
    const x = 14 + i * (cardW + 4);
    doc.setFillColor(card.color[0], card.color[1], card.color[2]);
    doc.roundedRect(x, yPos, cardW, 16, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(card.value, x + cardW / 2, yPos + 8, { align: "center" });
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(card.label, x + cardW / 2, yPos + 13, { align: "center" });
  });
  yPos += 22;

  // Donut
  yPos = ensureSpace(doc, yPos, 50);
  const completionData2 = [
    { label: "Concluídas", value: totals.done, color: [34, 197, 94] },
    { label: "Pendentes", value: totals.tasks - totals.done - totals.overdue, color: [250, 204, 21] },
    { label: "Atrasadas", value: totals.overdue, color: [239, 68, 68] },
  ];
  doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(200, 200, 230);
  doc.text("Status Geral", 14, yPos + 4);
  drawDonutChart(doc, 50, yPos + 26, 16, completionData2);

  drawFooter(doc, pageW, now, generatedBy);

  // ── PAGE 3: Projects table ──
  doc.addPage();
  drawPageBg(doc);
  drawPageHeader(doc, logo, pageW, reportTitle);

  const tableBody2 = projects.map((p) => {
    const completion = p.totalTasks > 0 ? Math.round((p.doneTasks / p.totalTasks) * 100) : 0;
    return [p.name, String(p.totalTasks), String(p.doneTasks), String(p.overdueTasks), `${Math.round(p.hours)}h`, `${completion}%`];
  });

  autoTable(doc, {
    startY: TABLE_START_Y,
    head: [["Projeto", "Tarefas", "Concluídas", "Atrasadas", "Horas", "Conclusão"]],
    body: tableBody2,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 3, textColor: [200, 200, 230], lineColor: [50, 48, 80], lineWidth: 0.2, fillColor: [22, 20, 48] },
    headStyles: { fillColor: [30, 27, 75], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
    alternateRowStyles: { fillColor: [28, 26, 56] },
    columnStyles: {
      0: { cellWidth: "auto", fontStyle: "bold" },
      1: { halign: "center", cellWidth: 20 },
      2: { halign: "center", cellWidth: 22 },
      3: { halign: "center", cellWidth: 22 },
      4: { halign: "center", cellWidth: 20 },
      5: { halign: "center", cellWidth: 22 },
    },
    margin: { left: 14, right: 14, top: TABLE_START_Y },
    willDrawPage: (data: any) => {
      if (data.pageNumber > 1) drawPageBg(doc);
      drawPageHeader(doc, logo, pageW, reportTitle);
    },
    didDrawPage: () => drawFooter(doc, pageW, now, generatedBy),
  });

  drawFooter(doc, pageW, now, generatedBy);

  doc.save(fileName);
}
