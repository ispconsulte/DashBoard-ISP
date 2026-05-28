import type { ElapsedTimeRecord, TaskView } from "./types";

export const normalizeComparableText = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

type TaskMatchesConsultantFilterInput = {
  task: TaskView;
  selectedConsultant: string;
  entries?: ElapsedTimeRecord[];
  userNames?: Record<string, string>;
};

export function taskMatchesConsultantFilter({
  task,
  selectedConsultant,
  entries = [],
  userNames = {},
}: TaskMatchesConsultantFilterInput) {
  if (selectedConsultant === "all") return true;

  const selected = normalizeComparableText(selectedConsultant);
  if (!selected) return true;

  const responsible = normalizeComparableText(task.consultant);
  if (responsible === selected) return true;

  return entries.some((entry) => {
    const userName = userNames[String(entry.user_id ?? "")];
    return normalizeComparableText(userName) === selected;
  });
}
