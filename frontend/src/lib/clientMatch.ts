/**
 * Helpers de correspondência entre nomes de cliente e itens vinculáveis
 * (projetos, collabs, grupos de trabalho).
 *
 * Comparação segura:
 *  - case-insensitive
 *  - ignora acentos
 *  - ignora espaços extras
 *  - tolera separadores comuns ("-", "<>", "|", "·", "/")
 *
 * Reutilizado pela Página do Cliente (auto-detecção) e pelo modal de
 * criação/edição (aviso de vínculo sem relação aparente).
 */

/** Normaliza para comparação: minúsculas, sem acentos, separadores → espaço, espaços colapsados. */
export function normalizeForMatch(value: string | null | undefined): string {
  if (!value) return "";
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .replace(/<>|[-|·/\\]+/g, " ") // separadores comuns viram espaço
    .replace(/[^a-z0-9\s]/g, " ") // demais símbolos viram espaço
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Indica se um item (projeto/collab/grupo) parece relacionado ao cliente.
 *
 * Verdadeiro quando, após normalização, o nome do item começa com o nome do
 * cliente, contém o nome do cliente como sequência de palavras, ou todas as
 * palavras significativas do cliente aparecem no item.
 *
 * Exemplos (cliente "Digital Net"):
 *  - "Digital Net - Discovery Comercial" → true
 *  - "Digital Net <> Reestruturação do ERP" → true
 *  - "Projeto interno RevOps" → false
 */
export function isRelatedToClient(
  itemName: string | null | undefined,
  clientName: string | null | undefined,
): boolean {
  const item = normalizeForMatch(itemName);
  const client = normalizeForMatch(clientName);
  if (!item || !client) return false;
  if (item === client) return true;

  // O item contém o nome completo do cliente (caso comum: "cliente - sufixo").
  if (item.includes(client)) return true;

  // Forma colapsada (sem espaços): "Digital Net" ↔ "DigitalNet" (em ambos os sentidos).
  // Exige que o menor lado cubra a maior parte do maior, evitando casar fragmentos
  // curtos ("Net" ⊄ "Digital Net").
  const collapsedClient = client.replace(/\s+/g, "");
  const collapsedItem = item.replace(/\s+/g, "");
  if (collapsedClient.length >= 5 && collapsedItem.length >= 5) {
    const [shorter, longer] = collapsedClient.length <= collapsedItem.length
      ? [collapsedClient, collapsedItem]
      : [collapsedItem, collapsedClient];
    if (longer.includes(shorter) && shorter.length / longer.length >= 0.6) return true;
  }

  // Todas as palavras significativas do cliente presentes no item.
  const clientWords = client.split(" ").filter((w) => w.length >= 2);
  if (clientWords.length === 0) return false;
  const itemWords = new Set(item.split(" "));
  return clientWords.every((w) => itemWords.has(w));
}

/**
 * Versão CONSERVADORA para auto-detecção de organizações de um cliente.
 *
 * Respeita a estrutura "DONO <> ESCOPO" / "DONO - ESCOPO": o item pertence ao
 * lado ESQUERDO (o dono). Assim "New Wave <> ISP Consulte" pertence à "New Wave",
 * NÃO à "ISP Consulte" — evitando puxar clientes alheios só porque o nome contém
 * "<> ISP Consulte".
 *
 * Regra:
 *  - Se houver separador "<>" (ou "-"/"|"), considera apenas o lado esquerdo
 *    como dono e exige que o cliente case com esse lado.
 *  - Sem separador, cai no match padrão (isRelatedToClient).
 *  - Não auto-vincula quando o cliente aparece só do lado direito (escopo).
 */
export function isOrgOfClient(
  itemName: string | null | undefined,
  clientName: string | null | undefined,
): boolean {
  const rawItem = String(itemName ?? "");
  const client = normalizeForMatch(clientName);
  if (!normalizeForMatch(rawItem) || !client) return false;

  // Detecta o separador dono<>escopo (prioriza "<>", depois "|", depois " - ").
  const sepMatch = rawItem.match(/\s*<>\s*|\s*\|\s*|\s+-\s+/);
  if (sepMatch && sepMatch.index !== undefined) {
    const left = normalizeForMatch(rawItem.slice(0, sepMatch.index));
    if (!left) return false;
    // O cliente precisa casar com o LADO ESQUERDO (dono) do nome.
    return isRelatedToClient(left, client);
  }

  // Sem separador estruturado: usa o match padrão.
  return isRelatedToClient(rawItem, client);
}
