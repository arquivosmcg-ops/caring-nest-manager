/**
 * Receituário médico — tipos e utilidades.
 *
 * IMPORTANTE (aviso clínico): a busca de medicamentos é uma funcionalidade de
 * BUSCA E PREENCHIMENTO ASSISTIDO, alimentada por uma base local (`medicamentos_base`)
 * com os itens mais usados na instituição, ampliável por cadastro manual e,
 * futuramente, por integração com base externa (ANVISA/CMED ou API comercial).
 * NÃO é fonte de decisão clínica: o médico é responsável por conferir e validar
 * nome, apresentação, concentração e posologia antes de emitir a receita.
 */

export type MedicamentoBase = {
  id: string;
  nome_comercial: string;
  principio_ativo: string | null;
  apresentacao: string | null;
  forma_farmaceutica: string | null;
  laboratorio: string | null;
  embalagem: string | null;
  origem: string;
};

export type ItemReceita = {
  uid: string;
  nome_medicamento: string;
  principio_ativo: string;
  apresentacao: string;
  forma_farmaceutica: string;
  laboratorio: string;
  posologia: string;
  via: string;
  turnos: string[];
  se_necessario: boolean;
  duracao_tipo: "continuo" | "determinado";
  data_inicio: string | null;
  numero_dias: number | null;
  quantidade_dispensar: string;
  orientacoes: string;
};

export const VIAS = [
  "Oral",
  "Sublingual",
  "Injetável (IM)",
  "Injetável (EV)",
  "Subcutânea",
  "Tópica",
  "Inalatória",
  "Oftálmica",
  "Otológica",
  "Nasal",
  "Retal",
  "Enteral (sonda)",
] as const;

export const FORMAS_FARMACEUTICAS = [
  "Comprimido",
  "Comprimido revestido",
  "Cápsula",
  "Solução oral",
  "Solução oral (gotas)",
  "Suspensão oral",
  "Xarope",
  "Solução injetável",
  "Suspensão injetável",
  "Pomada",
  "Creme",
  "Solução tópica",
  "Aerossol inalatório",
  "Spray nasal",
  "Supositório",
  "Adesivo transdérmico",
] as const;

export const TURNOS_RECEITA = [
  { key: "manha", label: "Manhã", sigla: "M" },
  { key: "tarde", label: "Tarde", sigla: "T" },
  { key: "noite", label: "Noite", sigla: "N" },
] as const;

export function itemVazio(): ItemReceita {
  return {
    uid: crypto.randomUUID(),
    nome_medicamento: "",
    principio_ativo: "",
    apresentacao: "",
    forma_farmaceutica: "",
    laboratorio: "",
    posologia: "",
    via: "Oral",
    turnos: [],
    se_necessario: false,
    duracao_tipo: "continuo",
    data_inicio: null,
    numero_dias: null,
    quantidade_dispensar: "",
    orientacoes: "",
  };
}

export function descricaoDuracao(i: {
  duracao_tipo: string;
  numero_dias: number | null;
  data_inicio: string | null;
}) {
  if (i.duracao_tipo !== "determinado") return "Uso contínuo";
  const inicio = i.data_inicio ? ` a partir de ${i.data_inicio.split("-").reverse().join("/")}` : "";
  return `Por ${i.numero_dias ?? 0} dia(s)${inicio}`;
}

export function descricaoFrequencia(i: { turnos: string[]; se_necessario: boolean }) {
  if (i.se_necessario) return "Se necessário (SN)";
  if (!i.turnos.length) return "—";
  return i.turnos
    .map((t) => TURNOS_RECEITA.find((x) => x.key === t)?.label ?? t)
    .join(" / ");
}

/** Normaliza texto para busca sem acento e sem caixa. */
export function normalizar(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
