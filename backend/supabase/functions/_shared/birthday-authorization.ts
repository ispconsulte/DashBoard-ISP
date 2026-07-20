const INTERNAL_BIRTHDAY_ROLES = new Set([
  "admin",
  "administrador",
  "gerente",
  "gestor",
  "coordenador",
  "consultor",
]);

type BirthdayViewer = {
  role?: unknown;
  user_profile?: unknown;
  active?: boolean | null;
} | null;

function normalizedRole(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export function canViewBirthdays(user: BirthdayViewer) {
  if (!user || user.active === false) return false;

  const role = normalizedRole(user.role);
  const profile = normalizedRole(user.user_profile);
  // `user_profile` controls application access. `role` is the bonus-program
  // role and is only a legacy fallback for rows without a profile.
  const effectiveRole = profile || role;

  return INTERNAL_BIRTHDAY_ROLES.has(effectiveRole);
}
