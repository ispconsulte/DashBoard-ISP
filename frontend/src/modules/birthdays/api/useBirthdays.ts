import { useQuery } from "@tanstack/react-query";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase";

export type BirthdayPerson = {
  bitrixUserId: string;
  name: string;
  month: number;
  day: number;
  year: number;
  birthDate: string;
  displayDate: string;
  daysUntil: number;
  nextDate: string;
  isToday: boolean;
  taskCycleYear: number;
  taskCycleMonth: number;
  taskEligible: boolean;
  taskStatus: "not_created" | "pending" | "processing" | "created" | "error";
  taskId: string | null;
  taskError: string | null;
  taskUpdatedAt: string | null;
};

export type BirthdayAutomationState = {
  last_completed_cycle?: string | null;
  last_started_at?: string | null;
  last_finished_at?: string | null;
  last_success_at?: string | null;
  last_status?: "running" | "success" | "partial" | "error" | "noop" | null;
  last_summary?: Record<string, unknown>;
} | null;

export type BirthdaysResponse = {
  birthdays: BirthdayPerson[];
  total: number;
  syncedAt: string;
  automation: {
    state: BirthdayAutomationState;
    recentRuns: Array<Record<string, unknown>>;
  };
};

export type CreateBirthdayTaskResponse = {
  ok: boolean;
  employee: string;
  cycle: string;
  taskId: string | null;
  result: "created" | "already_exists" | "already_running";
  forcedEarly: boolean;
};

export class BirthdayTaskRequestError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = "BirthdayTaskRequestError";
  }
}

export async function fetchBirthdays(accessToken: string): Promise<BirthdaysResponse> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/bitrix-birthdays`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON_KEY,
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || "Não foi possível carregar os aniversários.");
  }

  return {
    birthdays: Array.isArray(payload?.birthdays) ? payload.birthdays : [],
    total: Number(payload?.total ?? 0),
    syncedAt: String(payload?.syncedAt ?? ""),
    automation: {
      state: payload?.automation?.state ?? null,
      recentRuns: Array.isArray(payload?.automation?.recentRuns) ? payload.automation.recentRuns : [],
    },
  };
}

export async function createBirthdayTask(
  accessToken: string,
  person: Pick<BirthdayPerson, "bitrixUserId" | "taskCycleYear" | "taskCycleMonth">,
  forceEarly = false,
): Promise<CreateBirthdayTaskResponse> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/create-birthday-reminders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      action: "manual_create",
      bitrix_user_id: person.bitrixUserId,
      cycle_year: person.taskCycleYear,
      cycle_month: person.taskCycleMonth,
      force_early: forceEarly,
    }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new BirthdayTaskRequestError(
      payload?.error || "Não foi possível criar a tarefa de aniversário.",
      response.status,
      payload?.code,
    );
  }
  return payload as CreateBirthdayTaskResponse;
}

export function useBirthdays(accessToken?: string) {
  return useQuery({
    queryKey: ["bitrix-birthdays"],
    queryFn: () => fetchBirthdays(accessToken ?? ""),
    enabled: Boolean(accessToken),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
}
