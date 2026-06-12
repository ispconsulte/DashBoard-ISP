import type { TaskView } from "./types";

export const normalizeComparableText = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

type TaskMatchesConsultantFilterInput = {
  task: TaskView;
  selectedConsultant: string;
};

export function taskMatchesConsultantFilter({
  task,
  selectedConsultant,
}: TaskMatchesConsultantFilterInput) {
  if (selectedConsultant === "all") return true;

  const selected = normalizeComparableText(selectedConsultant);
  if (!selected) return true;

  return normalizeComparableText(task.consultant) === selected;
}
