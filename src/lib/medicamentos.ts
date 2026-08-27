export const TURNOS_MED = [
  { key: "manha", label: "Manhã", sigla: "M" },
  { key: "tarde", label: "Tarde", sigla: "T" },
  { key: "noite", label: "Noite", sigla: "N" },
] as const;

export type TurnoMed = (typeof TURNOS_MED)[number]["key"];

export type MedicamentoPrescrito = {
  id: string;
  prescricao_id: string | null;
  residente_id: string;
  numero: number | null;
  nome: string;
  dosagem: string;
  via: string | null;
  horarios: string[];
  dias_semana: string[];
  dias_do_mes: Record<string, string>;
  ativo: boolean;
  turnos: string[];
  duracao_tipo: "continuo" | "determinado";
  data_inicio: string | null;
  numero_dias: number | null;
  data_fim: string | null;
  se_necessario: boolean;
  status: "ativo" | "suspenso" | "encerrado";
  suspenso_em: string | null;
};

export type AdministracaoMed = {
  id: string;
  medicamento_id: string;
  residente_id: string;
  data: string;
  turno: TurnoMed | null;
  administrado: boolean;
  motivo: string | null;
  registrado_por_nome: string | null;
  horario: string;
};

/** Data local (sem fuso) no formato YYYY-MM-DD */
export function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseISO(s: string) {
  return new Date(s + "T00:00:00");
}

export function somaDias(iso: string, dias: number) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + dias);
  return isoDate(d);
}

export function calcularDataFim(dataInicio: string, numeroDias: number) {
  return somaDias(dataInicio, Math.max(1, numeroDias) - 1);
}

/** O medicamento está válido (prescrição vigente) na data informada? */
export function vigenteNaData(med: Pick<MedicamentoPrescrito, "status" | "duracao_tipo" | "data_inicio" | "data_fim">, dataIso: string) {
  if (med.status === "suspenso") return false;
  if (med.duracao_tipo !== "determinado") return true;
  if (med.data_inicio && dataIso < med.data_inicio) return false;
  if (med.data_fim && dataIso > med.data_fim) return false;
  return true;
}

/** Dias restantes até o fim do tratamento (inclui o dia atual). null se contínuo. */
export function diasRestantes(med: Pick<MedicamentoPrescrito, "duracao_tipo" | "data_fim">, hojeIso: string) {
  if (med.duracao_tipo !== "determinado" || !med.data_fim) return null;
  const diff = Math.round((parseISO(med.data_fim).getTime() - parseISO(hojeIso).getTime()) / 86400000);
  return diff + 1;
}

export function rotuloDuracao(med: MedicamentoPrescrito, hojeIso: string) {
  if (med.status === "suspenso") return "Suspenso";
  if (med.duracao_tipo !== "determinado") return "Uso contínuo";
  const rest = diasRestantes(med, hojeIso);
  if (rest === null) return "Uso contínuo";
  if (rest <= 0) return "Encerrado";
  if (rest === 1) return "Termina hoje";
  return `Termina em ${rest} dias`;
}

export function turnoLabel(t: string) {
  return TURNOS_MED.find((x) => x.key === t)?.label ?? t;
}
