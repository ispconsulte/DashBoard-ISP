export type ApiResult<T> = {
  ok: boolean;
  error?: string;
  data?: T;
};

export type ComodatoStatus = {
  contratoId: string;
  contrato: Record<string, unknown>;
  radusuario: Record<string, unknown>;
  comodatos: Record<string, unknown>[];
  patrimonio?: Record<string, unknown> | null;
  messages?: string[];
};

export type ComodatoLaunchResult = {
  status?: "inserted" | "already_exists";
  contratoId: string;
  numeroSerie: string;
  payloadEnviado: Record<string, unknown>;
  patrimonioUsado: Record<string, unknown>;
  respostaIXC: Record<string, unknown>;
};
