export const MIN_CUSTOM_FILTER_DATE = "2000-01-01";

type DateField = "from" | "to";

type DateCommit = {
  dateFrom?: string;
  dateTo?: string;
};

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const isCompleteCustomDate = (value: string): boolean => {
  const match = value.match(DATE_ONLY_RE);
  if (!match) return false;
  if (value < MIN_CUSTOM_FILTER_DATE) return false;

  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  return (
    parsed.getFullYear() === Number(year) &&
    parsed.getMonth() === Number(month) - 1 &&
    parsed.getDate() === Number(day)
  );
};

export const getCustomDateCommit = (
  field: DateField,
  nextValue: string,
  currentFrom: string,
  currentTo: string
): DateCommit => {
  if (!nextValue) return field === "from" ? { dateFrom: "" } : { dateTo: "" };
  if (!isCompleteCustomDate(nextValue)) return {};

  if (field === "from") {
    return {
      dateFrom: nextValue,
      ...(currentTo && currentTo < nextValue ? { dateTo: "" } : {}),
    };
  }

  if (currentFrom && nextValue < currentFrom) return {};
  return { dateTo: nextValue };
};
