import type { PDFExportSelection } from "./ExportPDFModal";

export type IntegrityResult = {
  noTitle: number;
  noProject: number;
  noDuration: number;
  noDeadline: number;
  noConsultant: number;
  total: number;
  incompleteCount: number;
};

export type TaskIntegrityInfo = {
  title: string;
  project: string;
  consultant: string;
  deadlineLabel: string;
  durationLabel: string;
  statusKey: string;
};

const EMPTY_MARKERS = [
  "sem título", "sem projeto", "sem consultor", "sem prazo",
  "sem registro", "sem status", "tarefa sem título", "projeto indefinido", "",
];

export function isFieldEmpty(value: string): boolean {
  return EMPTY_MARKERS.includes(value.trim().toLowerCase()) || value.trim() === "" || value.trim() === "—";
}

export function analyzeIntegrity(
  data: TaskIntegrityInfo[],
  selection: PDFExportSelection
): IntegrityResult {
  let noTitle = 0, noProject = 0, noDuration = 0, noDeadline = 0, noConsultant = 0;
  const incompleteIds = new Set<number>();

  data.forEach((t, idx) => {
    let incomplete = false;
    if (isFieldEmpty(t.title)) { noTitle++; incomplete = true; }
    if (isFieldEmpty(t.project)) { noProject++; incomplete = true; }
    if (selection.includeDuration && isFieldEmpty(t.durationLabel)) { noDuration++; incomplete = true; }
    if (selection.includeDeadline && isFieldEmpty(t.deadlineLabel)) { noDeadline++; incomplete = true; }
    if (selection.includeResponsible && isFieldEmpty(t.consultant)) { noConsultant++; incomplete = true; }
    if (incomplete) incompleteIds.add(idx);
  });

  return { noTitle, noProject, noDuration, noDeadline, noConsultant, total: data.length, incompleteCount: incompleteIds.size };
}
