export const TURNOS = ["manha", "tarde", "noite"] as const;
export type Turno = (typeof TURNOS)[number];

export const TURNO_LABEL: Record<Turno, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
};

export const TURNO_SIGLA: Record<Turno, string> = { manha: "M", tarde: "T", noite: "N" };

export const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export const DIAGNOSTICOS_ENFERMAGEM = [
  "Risco de queda",
  "Risco de infecção",
  "Dor crônica",
  "Risco de glicemia instável",
  "Mobilidade física prejudicada",
  "Troca gasosa prejudicada",
  "Constipação",
  "Déficit no autocuidado: banho / higiene / alimenta-se",
  "Integridade da pele prejudicada",
  "Risco para integridade da pele prejudicada",
  "Perfusão tissular periférica ineficaz",
  "Insônia",
  "Risco de aspiração",
];

export type CuidadoPlano = {
  id: string;
  residente_id: string | null;
  numero: number;
  descricao: string;
  turnos_aplicaveis: Turno[];
  ativo: boolean;
};

export type RegistroCuidado = {
  id: string;
  residente_id: string;
  cuidado_id: string;
  data: string;
  turno: Turno;
  feito_em: string;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  observacao: string | null;
};

export function diasDoMes(mes: number, ano: number) {
  return new Date(ano, mes, 0).getDate();
}

export function calcularIdade(nasc?: string | null) {
  if (!nasc) return null;
  const d = new Date(nasc + "T00:00:00");
  const hoje = new Date();
  let idade = hoje.getFullYear() - d.getFullYear();
  const m = hoje.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < d.getDate())) idade--;
  return idade;
}
