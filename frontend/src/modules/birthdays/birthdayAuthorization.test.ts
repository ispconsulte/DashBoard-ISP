import { describe, expect, it } from "vitest";
import { canViewBirthdays } from "../../../../backend/supabase/functions/_shared/birthday-authorization";

describe("autorização de leitura dos aniversários", () => {
  it.each(["admin", "administrador", "gerente", "gestor", "coordenador", "consultor"])(
    "permite o papel interno %s",
    (role) => {
      expect(canViewBirthdays({ role, active: true })).toBe(true);
    },
  );

  it("usa o perfil legado quando o papel não está preenchido", () => {
    expect(canViewBirthdays({ role: null, user_profile: "Consultor", active: true })).toBe(true);
  });

  it("prioriza o perfil de acesso sobre o papel da bonificação", () => {
    expect(canViewBirthdays({ role: "consultor", user_profile: "Administrador", active: true })).toBe(true);
    expect(canViewBirthdays({ role: "consultor", user_profile: "Cliente", active: true })).toBe(false);
  });

  it.each([
    null,
    { role: "cliente", active: true },
    { role: "consultor", active: false },
    { role: "desconhecido", active: true },
  ])("bloqueia clientes, inativos e papéis desconhecidos", (user) => {
    expect(canViewBirthdays(user)).toBe(false);
  });
});
