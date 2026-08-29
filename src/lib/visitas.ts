export const GRAUS_PARENTESCO = [
  "Filho(a)",
  "Cônjuge",
  "Neto(a)",
  "Irmão/Irmã",
  "Amigo(a)",
  "Outro",
] as const;

export type Visitante = {
  id: string;
  nome: string;
  documento: string | null;
  grau_parentesco_padrao: string | null;
};

export type Visita = {
  id: string;
  visitante_id: string;
  data: string;
  horario_entrada: string;
  horario_saida: string | null;
  grau_parentesco: string | null;
  recebido_por: string | null;
  recebido_por_nome: string | null;
  observacoes: string | null;
  sintomas_gripais: boolean | null;
  temperatura: number | null;
  ciente_normas: boolean;
  assinatura_visitante: string | null;
  visitantes: { nome: string; documento: string | null } | null;
  visitas_residentes: { residente_id: string; residentes: { nome_completo: string } | null }[];
};

export type ConfigVisitas = {
  triagem_ativa: boolean;
  termo_ativo: boolean;
  normas_texto: string;
  alerta_horas: number;
};

export const hojeISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

/** ISO (timestamptz) -> valor de <input type="datetime-local"> */
export function paraInputLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/** valor de <input type="datetime-local"> -> ISO */
export function deInputLocal(valor: string): string | null {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function horaCurta(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function dataCurta(data: string): string {
  const [a, m, d] = data.split("-");
  return `${d}/${m}/${a}`;
}

export function duracao(entrada: string, saida: string | null): string {
  if (!saida) return "Em andamento";
  const ms = new Date(saida).getTime() - new Date(entrada).getTime();
  if (ms < 0) return "—";
  const min = Math.round(ms / 60000);
  const h = Math.floor(min / 60);
  return h > 0 ? `${h}h ${String(min % 60).padStart(2, "0")}min` : `${min}min`;
}

export function horasAberta(entrada: string): number {
  return (Date.now() - new Date(entrada).getTime()) / 3600000;
}

export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
