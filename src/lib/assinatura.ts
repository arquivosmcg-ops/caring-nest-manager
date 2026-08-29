export type CategoriaAssinatura = "enfermeiro" | "tecnico_enfermagem" | "medico";

export type DocumentoTipo = "sae" | "cuidado_diario" | "turno" | "conduta_medica";

export const CATEGORIA_ASSINATURA_LABEL: Record<string, string> = {
  enfermeiro: "Enfermeiro(a)",
  tecnico_enfermagem: "Técnico(a) de Enfermagem",
  medico: "Médico(a)",
};

export const CONSELHO_DA_CATEGORIA: Record<string, string> = {
  enfermeiro: "COREN",
  tecnico_enfermagem: "COREN",
  medico: "CRM",
};

export const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR",
  "PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
] as const;

export type Assinatura = {
  id: string;
  usuario_id: string;
  nome_profissional: string;
  categoria_profissional: string;
  numero_conselho: string | null;
  conselho_uf: string | null;
  documento_tipo: string;
  documento_id: string;
  documento_ref: Record<string, unknown> | null;
  hash_documento: string;
  metodo: string;
  created_at: string;
  certificado_tipo?: string | null;
  certificado_ac_emissor?: string | null;
  protocolo_assinatura?: string | null;
};

/** Hash SHA-256 (hex) do conteúdo do documento no momento da assinatura. */
export async function hashDocumento(conteudo: unknown): Promise<string> {
  const texto = typeof conteudo === "string" ? conteudo : JSON.stringify(conteudo);
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Carimbo textual: "Nome — Categoria — COREN 123456/SP". */
export function carimbo(a: {
  nome_profissional: string;
  categoria_profissional: string;
  numero_conselho: string | null;
  conselho_uf: string | null;
}) {
  const cat = CATEGORIA_ASSINATURA_LABEL[a.categoria_profissional] ?? a.categoria_profissional;
  const sigla = CONSELHO_DA_CATEGORIA[a.categoria_profissional] ?? "Registro";
  const conselho = a.numero_conselho
    ? `${sigla} ${a.numero_conselho}${a.conselho_uf ? `/${a.conselho_uf}` : ""}`
    : "conselho não informado";
  return `${a.nome_profissional} — ${cat} — ${conselho}`;
}

export function linhasAssinatura(a: Assinatura) {
  const icp = a.metodo === "icp_a1" || a.metodo === "icp_a3";
  const linhas = [
    carimbo(a),
    icp
      ? `Assinado digitalmente com certificado ICP-Brasil em ${new Date(a.created_at).toLocaleString("pt-BR")}`
      : `Assinado eletronicamente em ${new Date(a.created_at).toLocaleString("pt-BR")}`,
  ];
  if (icp) {
    linhas.push(
      `Certificadora: ${a.certificado_ac_emissor ?? "não informada"} — Protocolo: ${a.protocolo_assinatura ?? "—"}`,
    );
  }
  linhas.push(`Documento íntegro — hash: ${a.hash_documento.slice(0, 8)}`);
  return linhas;
}
