export type ParsedComodatoItem = {
  pppoe: string;
  serial?: string | null;
  modelo?: string | null;
  origin: string;
  line: number;
  status: "ok" | "pendente" | "invalido";
  reason?: string;
};

export type ParsedComodatoSummary = {
  items: ParsedComodatoItem[];
  pendentes: ParsedComodatoItem[];
  logs: string[];
  totalLinhas: number;
  totalBlocos: number;
};

const RGX_INICIO = /!module config:onu_wan\./i;
const RGX_FIM = /!module config:onu_wifi\./i;
const RGX_TEM_PPPOE = /\bpppoe\s+pro\s+dis\b/i;
const RGX_PPPOE_TRECHO = /\b(?:dsp\s+)?pppoe\s+pro\s+dis\s+(\d+)\b(?=[^\n]*\bkey:)/i;

const RGX_SL_SEPARADO = /\bsl\s+(\d+)\s+(\d+)\s+(\d+)\b/i;
const RGX_SL_PO = /\bsl\s*(\d+)\s*[pP]\s*(\d+)\s*[oO0]\s*(\d+)\b/i;
const RGX_SL_COLADO = /\bsl\s*(\d{3,})\b/i;
const RGX_SERIAL = /\bFHTT[0-9A-Za-z]{4,32}\b/i;

const triadKey = (a: string, b: string, c: string) => `${a}|${b}|${c}`;

const rgxChave = (a: string, b: string, c: string) =>
  new RegExp(`\\bsl\\s*0*${a}\\b\\s*[pP]\\s*0*${b}\\b\\s*[oO0]\\s*0*${c}\\b`, "i");

const modeloValido = (token: string | null | undefined) => {
  if (!token) return false;
  const t = token.trim();
  if (/^PTV/i.test(t)) return false;
  if (!/\d/.test(t)) return false;
  return (
    /^[A-Za-z0-9]{2,}(?:-[A-Za-z0-9]{1,})+$/.test(t) ||
    /^[A-Za-z]{2,}\d{2,}[A-Za-z0-9-]*$/.test(t)
  );
};

const extrairSerialModelo = (linha: string) => {
  const serial = RGX_SERIAL.exec(linha)?.[0] ?? null;
  const mTy = /\bty\s+([A-Za-z0-9][A-Za-z0-9._/-]+)/i.exec(linha);
  if (mTy && modeloValido(mTy[1])) {
    return { serial, modelo: mTy[1] };
  }
  const mMod = /(?:modelo|model)\b\W*([A-Za-z0-9][A-Za-z0-9._/-]+)/i.exec(linha);
  if (mMod && modeloValido(mMod[1])) {
    return { serial, modelo: mMod[1] };
  }

  for (const token of linha.match(/\b([A-Za-z0-9]{2,}(?:[._/-][A-Za-z0-9]{1,})*)\b/g) ?? []) {
    if (modeloValido(token)) {
      return { serial, modelo: token };
    }
  }
  return { serial, modelo: null };
};

const localizarBlocos = (lines: string[]) => {
  const inicios = lines.map((ln, i) => (RGX_INICIO.test(ln) ? i : -1)).filter((i) => i >= 0);
  const fins = lines.map((ln, i) => (RGX_FIM.test(ln) ? i : -1)).filter((i) => i >= 0);
  const blocos: Array<[number, number]> = [];
  let j = 0;
  for (const ini of inicios) {
    while (j < fins.length && fins[j] <= ini) j += 1;
    if (j < fins.length) {
      blocos.push([ini, fins[j]]);
      j += 1;
    }
  }
  return blocos;
};

const pppoeInvalido = (s: string) => {
  const t = s.trim().toUpperCase();
  if (["0", "1", "NA", "N/A", "N/D", "--", "ZERADO"].includes(t)) return true;
  return !/^\d{2,}$/.test(t);
};

const extrairTriad = (linha: string): [string | null, string | null, string | null] => {
  const sep = RGX_SL_SEPARADO.exec(linha);
  if (sep) return [sep[1], sep[2], sep[3]];
  const po = RGX_SL_PO.exec(linha);
  if (po) return [po[1], po[2], po[3]];
  const colado = RGX_SL_COLADO.exec(linha);
  if (colado) {
    const seq = colado[1];
    if (seq.length >= 3) {
      return [seq[0], seq[1], seq.slice(2)];
    }
  }
  return [null, null, null];
};

const triadsFromLine = (linha: string): Array<[string, string, string]> => {
  if (!RGX_SERIAL.test(linha)) return [];
  const triads: Array<[string, string, string]> = [];

  const sep = linha.matchAll(new RegExp(RGX_SL_SEPARADO.source, "gi"));
  for (const m of sep) {
    if (m[1] && m[2] && m[3]) triads.push([m[1], m[2], m[3]]);
  }

  const po = linha.matchAll(new RegExp(RGX_SL_PO.source, "gi"));
  for (const m of po) {
    if (m[1] && m[2] && m[3]) triads.push([m[1], m[2], m[3]]);
  }

  const colado = linha.matchAll(new RegExp(RGX_SL_COLADO.source, "gi"));
  for (const m of colado) {
    const seq = m[1];
    if (seq && seq.length >= 3) {
      triads.push([seq[0], seq[1], seq.slice(2)]);
    }
  }

  return triads;
};

const extrairPppoeDaLinha = (linha: string) => RGX_PPPOE_TRECHO.exec(linha)?.[1] ?? null;

const numsEquivalentes = (a: string, b: string) => {
  const na = Number.parseInt(a, 10);
  const nb = Number.parseInt(b, 10);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na === nb;
  return a === b;
};

const lineHasKeyAndSerial = (linha: string, keyRegex: RegExp) => keyRegex.test(linha) && RGX_SERIAL.test(linha);

const findNearest = (list: number[], target: number, lo = 0, hi = list.length) => {
  if (!list.length || lo >= hi) return -1;
  let left = lo;
  let right = hi;
  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (list[mid] < target) left = mid + 1;
    else right = mid;
  }
  if (left <= lo) return list[lo];
  if (left >= hi) return list[hi - 1];
  const before = list[left - 1];
  const after = list[left];
  return Math.abs(before - target) <= Math.abs(after - target) ? before : after;
};

const findBlockForIndex = (index: number, blocos: Array<[number, number]>) => {
  for (const [ini, fim] of blocos) {
    if (index >= ini && index <= fim) return [ini, fim] as [number, number];
  }
  return null;
};

const buscarPppoePorRaio = (
  lines: string[],
  idxSerial: number,
  triad: [string, string, string],
  ini: number,
  fim: number,
  raio = 400
) => {
  const [a, b, c] = triad;
  for (let delta = 0; delta <= raio; delta += 1) {
    const ks = delta === 0 ? [idxSerial] : [idxSerial + delta, idxSerial - delta];
    for (const k of ks) {
      if (k < ini || k > fim) continue;
      const linha = lines[k];
      if (!RGX_TEM_PPPOE.test(linha)) continue;
      const [a2, b2, c2] = extrairTriad(linha);
      if (!a2 || !b2 || !c2) continue;
      if (!numsEquivalentes(a, a2) || !numsEquivalentes(b, b2) || !numsEquivalentes(c, c2)) continue;
      const pppoe = extrairPppoeDaLinha(linha);
      if (pppoe) return { idxPppoe: k, pppoe };
    }
  }
  return null;
};

export function parseTxtComodato(files: { name: string; text: string }[]): ParsedComodatoSummary {
  const items: ParsedComodatoItem[] = [];
  const pendentes: ParsedComodatoItem[] = [];
  const logs: string[] = [];
  let totalLinhas = 0;
  let totalBlocos = 0;
  const vistosSerial = new Set<string>();

  for (const file of files) {
    const lines = file.text.split(/\r?\n/);
    totalLinhas += lines.length;

    const blocosEncontrados = localizarBlocos(lines);
    const blocos = blocosEncontrados.length ? blocosEncontrados : ([[0, lines.length - 1]] as Array<[number, number]>);
    totalBlocos += blocos.length;

    const triadIndex = new Map<string, number[]>();
    for (let i = 0; i < lines.length; i += 1) {
      for (const triad of triadsFromLine(lines[i])) {
        const key = triadKey(triad[0], triad[1], triad[2]);
        const arr = triadIndex.get(key) ?? [];
        arr.push(i);
        triadIndex.set(key, arr);
      }
    }

    for (const idxs of triadIndex.values()) idxs.sort((a, b) => a - b);

    for (const [ini, fim] of blocos) {
      for (let idx = ini; idx <= fim; idx += 1) {
        const linha = lines[idx];
        if (!RGX_TEM_PPPOE.test(linha)) continue;

        const pppoe = extrairPppoeDaLinha(linha);
        if (!pppoe) {
          pendentes.push({
            pppoe: "N/D",
            serial: null,
            modelo: null,
            origin: `${file.name}:${idx + 1}`,
            line: idx + 1,
            status: "pendente",
            reason: "PPPoE sem trecho key:",
          });
          continue;
        }

        const [a, b, c] = extrairTriad(linha);
        if (!a || !b || !c) {
          pendentes.push({
            pppoe,
            serial: null,
            modelo: null,
            origin: `${file.name}:${idx + 1}`,
            line: idx + 1,
            status: "pendente",
            reason: "SL não encontrado",
          });
          continue;
        }

        const keyRegex = rgxChave(a, b, c);
        const triadCandidates = triadIndex.get(triadKey(a, b, c)) ?? [];

        let achadoIdx = -1;
        if (triadCandidates.length) {
          const lo = triadCandidates.findIndex((n) => n >= ini);
          const hiCandidate = triadCandidates.findIndex((n) => n > fim);
          const loIdx = lo === -1 ? triadCandidates.length : lo;
          const hiIdx = hiCandidate === -1 ? triadCandidates.length : hiCandidate;

          const local = findNearest(triadCandidates, idx, loIdx, hiIdx);
          if (local !== -1 && lineHasKeyAndSerial(lines[local], keyRegex)) {
            achadoIdx = local;
          }

          if (achadoIdx === -1) {
            const globalNearest = findNearest(triadCandidates, idx);
            if (globalNearest !== -1 && lineHasKeyAndSerial(lines[globalNearest], keyRegex)) {
              achadoIdx = globalNearest;
            }
          }
        }

        if (achadoIdx === -1) {
          for (let k = Math.max(idx + 1, ini); k <= fim; k += 1) {
            if (lineHasKeyAndSerial(lines[k], keyRegex)) {
              achadoIdx = k;
              break;
            }
          }
        }

        if (achadoIdx === -1) {
          for (let k = idx - 1; k >= ini; k -= 1) {
            if (lineHasKeyAndSerial(lines[k], keyRegex)) {
              achadoIdx = k;
              break;
            }
          }
        }

        if (achadoIdx === -1) {
          pendentes.push({
            pppoe,
            serial: null,
            modelo: null,
            origin: `${file.name}:${idx + 1}`,
            line: idx + 1,
            status: "pendente",
            reason: "Serial não localizado no bloco/global",
          });
          continue;
        }

        const { serial, modelo } = extrairSerialModelo(lines[achadoIdx]);
        if (pppoeInvalido(pppoe) || !serial || !modelo || !modeloValido(modelo)) {
          pendentes.push({
            pppoe,
            serial,
            modelo,
            origin: `${file.name}:${idx + 1}`,
            line: idx + 1,
            status: "invalido",
            reason: "PPPoE/serial/modelo inválido",
          });
          continue;
        }

        const serialKey = serial.trim().toUpperCase();
        if (vistosSerial.has(serialKey)) continue;
        vistosSerial.add(serialKey);

        items.push({
          pppoe,
          serial,
          modelo,
          origin: `${file.name}:${achadoIdx + 1}`,
          line: achadoIdx + 1,
          status: "ok",
        });
      }
    }

    for (const [tKey, idxs] of triadIndex.entries()) {
      const [a, b, c] = tKey.split("|") as [string, string, string];
      for (const idxSerial of idxs) {
        const linha = lines[idxSerial];
        const { serial, modelo } = extrairSerialModelo(linha);
        if (!serial || !modelo || !modeloValido(modelo)) continue;

        const serialKey = serial.trim().toUpperCase();
        if (vistosSerial.has(serialKey)) continue;

        const bloco = findBlockForIndex(idxSerial, blocos);
        if (!bloco) continue;
        const [ini, fim] = bloco;
        const busca = buscarPppoePorRaio(lines, idxSerial, [a, b, c], ini, fim, 400);
        if (!busca || pppoeInvalido(busca.pppoe)) continue;

        const keyRegex = rgxChave(a, b, c);
        if (!lineHasKeyAndSerial(linha, keyRegex)) continue;

        vistosSerial.add(serialKey);
        items.push({
          pppoe: busca.pppoe,
          serial,
          modelo,
          origin: `${file.name}:${idxSerial + 1}`,
          line: idxSerial + 1,
          status: "ok",
        });
      }
    }

    logs.push(`${file.name}: ${items.length} itens válidos até agora, ${pendentes.length} pendentes/inválidos.`);
  }

  return { items, pendentes, logs, totalLinhas, totalBlocos };
}
