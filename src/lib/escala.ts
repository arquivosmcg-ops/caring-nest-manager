export const SETORES = [
  { chave: "enfermagem", nome: "Enfermagem" },
  { chave: "cuidados_diretos", nome: "Cuidados diretos" },
  { chave: "cozinha", nome: "Cozinha" },
  { chave: "limpeza", nome: "Limpeza" },
  { chave: "administracao", nome: "Administração" },
] as const;

export const TIPOS_ESCALA = [
  { chave: "12x36", nome: "12x36" },
  { chave: "24x72", nome: "24x72" },
  { chave: "6x1", nome: "6x1" },
  { chave: "5x2", nome: "5x2" },
  { chave: "noturno", nome: "Plantão noturno" },
  { chave: "diarista", nome: "Diarista" },
] as const;

export const TURNOS = [
  { chave: "manha", nome: "Manhã", inicio: "07:00", fim: "13:00", cor: "bg-amber-100 text-amber-900 border-amber-300" },
  { chave: "tarde", nome: "Tarde", inicio: "13:00", fim: "19:00", cor: "bg-sky-100 text-sky-900 border-sky-300" },
  { chave: "noite", nome: "Noite", inicio: "19:00", fim: "07:00", cor: "bg-indigo-100 text-indigo-900 border-indigo-300" },
  { chave: "diurno12", nome: "Plantão 12h diurno", inicio: "07:00", fim: "19:00", cor: "bg-emerald-100 text-emerald-900 border-emerald-300" },
  { chave: "noturno12", nome: "Plantão 12h noturno", inicio: "19:00", fim: "07:00", cor: "bg-violet-100 text-violet-900 border-violet-300" },
  { chave: "24h", nome: "Plantão 24h", inicio: "07:00", fim: "07:00", cor: "bg-rose-100 text-rose-900 border-rose-300" },
] as const;

export const STATUS_TURNO = [
  { chave: "confirmado", nome: "Confirmado", cor: "bg-emerald-600" },
  { chave: "pendente", nome: "Pendente", cor: "bg-amber-500" },
  { chave: "trocado", nome: "Trocado", cor: "bg-sky-600" },
  { chave: "cancelado", nome: "Cancelado", cor: "bg-muted-foreground" },
] as const;

export const TIPOS_AFASTAMENTO = [
  { chave: "ferias", nome: "Férias" },
  { chave: "atestado", nome: "Atestado médico" },
  { chave: "licenca", nome: "Licença" },
  { chave: "folga", nome: "Folga programada" },
] as const;

export type Turno = {
  id: string;
  colaborador_id: string;
  colaborador_nome: string | null;
  setor: string;
  cargo: string | null;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  tipo_escala: string;
  turno: string;
  status: string;
  observacoes: string | null;
};

export type Afastamento = {
  id: string;
  colaborador_id: string;
  tipo: string;
  data_inicio: string;
  data_fim: string;
  observacoes: string | null;
};

export type EscalaConfig = {
  min_manha: number;
  min_tarde: number;
  min_noite: number;
  limite_horas_mensal: number;
  interjornada_horas: number;
};

export const nomeTurno = (c: string) => TURNOS.find((t) => t.chave === c)?.nome ?? c;
export const corTurno = (c: string) =>
  TURNOS.find((t) => t.chave === c)?.cor ?? "bg-muted text-foreground border-border";
export const nomeSetor = (c: string) => SETORES.find((s) => s.chave === c)?.nome ?? c;
export const nomeStatus = (c: string) => STATUS_TURNO.find((s) => s.chave === c)?.nome ?? c;
export const corStatus = (c: string) => STATUS_TURNO.find((s) => s.chave === c)?.cor ?? "bg-muted";

/** ISO date helpers (local, sem fuso) */
export function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function parseISO(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}
export function addDias(s: string, n: number) {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}
export function inicioSemana(s: string) {
  const d = parseISO(s);
  d.setDate(d.getDate() - d.getDay());
  return iso(d);
}
export function inicioMes(s: string) {
  const d = parseISO(s);
  return iso(new Date(d.getFullYear(), d.getMonth(), 1));
}
export function fimMes(s: string) {
  const d = parseISO(s);
  return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}
export function intervaloDias(de: string, ate: string) {
  const out: string[] = [];
  let cur = de;
  let guard = 0;
  while (cur <= ate && guard++ < 400) {
    out.push(cur);
    cur = addDias(cur, 1);
  }
  return out;
}
export const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export function rotuloDia(s: string) {
  const d = parseISO(s);
  return `${DIAS_SEMANA[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}
export function dataCurta(s: string) {
  const d = parseISO(s);
  return d.toLocaleDateString("pt-BR");
}

/** minutos desde 00:00 */
function min(h: string) {
  const [hh, mm] = h.slice(0, 5).split(":").map(Number);
  return (hh ?? 0) * 60 + (mm ?? 0);
}
/** duração em horas considerando virada de dia */
export function duracaoHoras(inicio: string, fim: string) {
  let d = min(fim) - min(inicio);
  if (d <= 0) d += 24 * 60;
  return d / 60;
}
/** início/fim absolutos em minutos desde a meia-noite do dia do turno */
export function janelaAbsoluta(t: { data: string; hora_inicio: string; hora_fim: string }) {
  const base = parseISO(t.data).getTime() / 60000;
  const ini = base + min(t.hora_inicio);
  return { ini, fim: ini + duracaoHoras(t.hora_inicio, t.hora_fim) * 60 };
}

export function sobrepoe(a: Turno, b: Turno) {
  const ja = janelaAbsoluta(a);
  const jb = janelaAbsoluta(b);
  return ja.ini < jb.fim && jb.ini < ja.fim;
}

export function horasNoMes(turnos: Turno[], colaboradorId: string, mesISO: string) {
  const de = inicioMes(mesISO);
  const ate = fimMes(mesISO);
  return turnos
    .filter(
      (t) =>
        t.colaborador_id === colaboradorId &&
        t.status !== "cancelado" &&
        t.data >= de &&
        t.data <= ate,
    )
    .reduce((s, t) => s + duracaoHoras(t.hora_inicio, t.hora_fim), 0);
}

export function afastadoEm(afastamentos: Afastamento[], colaboradorId: string, data: string) {
  return afastamentos.find(
    (a) => a.colaborador_id === colaboradorId && a.data_inicio <= data && a.data_fim >= data,
  );
}

export type Conflito = { tipo: string; mensagem: string };

/** Valida um turno (novo ou editado) contra os demais e as regras CLT/afastamentos. */
export function validarTurno(
  novo: Turno,
  todos: Turno[],
  afastamentos: Afastamento[],
  config: EscalaConfig,
): Conflito[] {
  const out: Conflito[] = [];
  const outros = todos.filter((t) => t.id !== novo.id && t.colaborador_id === novo.colaborador_id && t.status !== "cancelado");

  if (outros.some((t) => sobrepoe(novo, t))) {
    out.push({ tipo: "sobreposicao", mensagem: "Colaborador já escalado em horário sobreposto." });
  }

  const jn = janelaAbsoluta(novo);
  const perto = outros.filter((t) => Math.abs(parseISO(t.data).getTime() / 60000 - parseISO(novo.data).getTime() / 60000) <= 3 * 1440);
  for (const t of perto) {
    const jt = janelaAbsoluta(t);
    if (jt.fim <= jn.ini && (jn.ini - jt.fim) / 60 < config.interjornada_horas) {
      out.push({
        tipo: "interjornada",
        mensagem: `Intervalo interjornada menor que ${config.interjornada_horas}h em relação ao plantão de ${dataCurta(t.data)}.`,
      });
      break;
    }
    if (jn.fim <= jt.ini && (jt.ini - jn.fim) / 60 < config.interjornada_horas) {
      out.push({
        tipo: "interjornada",
        mensagem: `Intervalo interjornada menor que ${config.interjornada_horas}h em relação ao plantão de ${dataCurta(t.data)}.`,
      });
      break;
    }
  }

  const af = afastadoEm(afastamentos, novo.colaborador_id, novo.data);
  if (af) {
    out.push({
      tipo: "afastamento",
      mensagem: `Colaborador em ${TIPOS_AFASTAMENTO.find((x) => x.chave === af.tipo)?.nome ?? af.tipo} de ${dataCurta(af.data_inicio)} a ${dataCurta(af.data_fim)}.`,
    });
  }

  const horas =
    horasNoMes(todos.filter((t) => t.id !== novo.id), novo.colaborador_id, novo.data) +
    duracaoHoras(novo.hora_inicio, novo.hora_fim);
  if (horas > config.limite_horas_mensal) {
    out.push({
      tipo: "horas",
      mensagem: `Limite mensal excedido: ${horas.toFixed(0)}h de ${config.limite_horas_mensal}h.`,
    });
  }

  // 7 dias consecutivos sem descanso semanal
  let consecutivos = 1;
  for (let i = 1; i <= 7; i++) {
    const dia = addDias(novo.data, -i);
    if (outros.some((t) => t.data === dia)) consecutivos++;
    else break;
  }
  for (let i = 1; i <= 7; i++) {
    const dia = addDias(novo.data, i);
    if (outros.some((t) => t.data === dia)) consecutivos++;
    else break;
  }
  if (consecutivos >= 7) {
    out.push({ tipo: "descanso", mensagem: `${consecutivos} dias consecutivos de trabalho — descanso semanal obrigatório.` });
  }

  return out;
}

/** Cobertura mínima por dia (manhã/tarde/noite). */
export function coberturaDoDia(turnos: Turno[], data: string, config: EscalaConfig) {
  const doDia = turnos.filter((t) => t.data === data && t.status !== "cancelado");
  const cobre = (faixa: "manha" | "tarde" | "noite") =>
    doDia.filter((t) => {
      if (t.turno === faixa) return true;
      if (faixa === "noite") return t.turno === "noturno12" || t.turno === "24h";
      return t.turno === "diurno12" || t.turno === "24h";
    }).length;
  return [
    { faixa: "manha" as const, nome: "Manhã", atual: cobre("manha"), minimo: config.min_manha },
    { faixa: "tarde" as const, nome: "Tarde", atual: cobre("tarde"), minimo: config.min_tarde },
    { faixa: "noite" as const, nome: "Noite", atual: cobre("noite"), minimo: config.min_noite },
  ];
}

export function faltaCobertura(turnos: Turno[], data: string, config: EscalaConfig) {
  return coberturaDoDia(turnos, data, config).filter((c) => c.atual < c.minimo);
}
