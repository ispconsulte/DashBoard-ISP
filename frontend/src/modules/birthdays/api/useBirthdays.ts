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
};

export type BirthdaysResponse = {
  birthdays: BirthdayPerson[];
  total: number;
  syncedAt: string;
};

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
  };
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
