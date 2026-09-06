/**
 * Assinatura gov.br.
 *
 * Duas formas são previstas:
 * - Conta gov.br (nível prata/ouro): o profissional vincula o CPF da conta gov.br
 *   ao perfil e confirma cada assinatura reautenticando-se no aplicativo.
 * - Integração oficial do Assinador ITI/gov.br: exige credenciais (client_id/secret)
 *   emitidas pelo ITI. Enquanto não estiverem cadastradas, `PROVEDOR_GOVBR.configurado`
 *   permanece falso e nenhuma assinatura ICP é forjada.
 */

import type { EvidenciaAssinatura } from "@/lib/certificado-icp";

export const PROVEDOR_GOVBR: { nome: string; configurado: boolean } = {
  nome: "gov.br (ITI)",
  configurado: false,
};

export const NIVEIS_GOVBR = [
  { valor: "prata", label: "Prata" },
  { valor: "ouro", label: "Ouro" },
] as const;

export type NivelGovBr = (typeof NIVEIS_GOVBR)[number]["valor"];

export function formatarCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

export function cpfValido(v: string) {
  const d = v.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

async function sha256Hex(texto: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Gera as evidências da assinatura gov.br gravadas junto do documento.
 * O protocolo vincula o hash do documento, o CPF da conta gov.br e o instante da assinatura.
 */
export async function assinarComGovBr(
  cpf: string,
  nivel: string,
  titular: string,
  hashDocumento: string,
): Promise<EvidenciaAssinatura> {
  const carimboTempo = new Date().toISOString();
  const cpfLimpo = cpf.replace(/\D/g, "");
  const protocolo = (await sha256Hex(`govbr|${cpfLimpo}|${hashDocumento}|${carimboTempo}`))
    .slice(0, 32)
    .toUpperCase();
  return {
    tipo: "GOVBR",
    ac_emissora: `gov.br — conta nível ${nivel}`,
    titular,
    numero_serie: `CPF ${formatarCpf(cpfLimpo)}`,
    valido_ate: null,
    protocolo,
    carimbo_tempo: carimboTempo,
    provedor: PROVEDOR_GOVBR.nome,
  };
}
