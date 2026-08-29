/**
 * Certificado digital ICP-Brasil.
 *
 * Regras de segurança adotadas:
 * - O arquivo A1 (.pfx/.p12) NUNCA é enviado ao servidor nem armazenado.
 * - A senha do certificado NUNCA é armazenada: é pedida a cada assinatura.
 * - Do certificado guardamos apenas metadados (AC emissora, titular, série, validade).
 * - Certificados A3 (token/cartão/nuvem) dependem de um provedor externo de
 *   assinatura ICP-Brasil, plugado em `PROVEDOR_ICP` quando as credenciais existirem.
 */

export type TipoCertificado = "A1" | "A3";

export type MetadadosCertificado = {
  tipo: TipoCertificado;
  titular: string | null;
  ac_emissora: string | null;
  numero_serie: string | null;
  valido_de: string | null;
  valido_ate: string | null;
};

export type CertificadoCadastrado = MetadadosCertificado & {
  id: string;
  usuario_id: string;
  provedor: string | null;
  provedor_ref: string | null;
};

/** Dados gravados junto da assinatura (tabela `assinaturas`). */
export type EvidenciaAssinatura = {
  tipo: TipoCertificado;
  ac_emissora: string | null;
  titular: string | null;
  numero_serie: string | null;
  valido_ate: string | null;
  protocolo: string;
  carimbo_tempo: string;
  provedor: string | null;
};

/**
 * Provedor externo de assinatura ICP-Brasil (BirdID, Clicksign, Certillion...).
 * Enquanto as credenciais não forem cadastradas, o fluxo A3 fica indisponível
 * e o app orienta o profissional — nenhuma assinatura falsa é gerada.
 */
export const PROVEDOR_ICP: { nome: string | null; configurado: boolean } = {
  nome: null,
  configurado: false,
};

const DIAS = 24 * 60 * 60 * 1000;

export function diasParaVencer(validoAte: string | null | undefined): number | null {
  if (!validoAte) return null;
  return Math.floor((new Date(validoAte).getTime() - Date.now()) / DIAS);
}

export function statusValidade(validoAte: string | null | undefined) {
  const d = diasParaVencer(validoAte);
  if (d === null) return { nivel: "desconhecido" as const, texto: "Validade não informada" };
  if (d < 0) return { nivel: "vencido" as const, texto: `Vencido há ${Math.abs(d)} dia(s)` };
  if (d <= 30) return { nivel: "alerta" as const, texto: `Vence em ${d} dia(s)` };
  return { nivel: "ok" as const, texto: `Válido por mais ${d} dia(s)` };
}

function nomeDoSujeito(attrs: Array<{ shortName?: string; name?: string; value?: unknown }>) {
  const cn = attrs.find((a) => a.shortName === "CN" || a.name === "commonName");
  const o = attrs.find((a) => a.shortName === "O" || a.name === "organizationName");
  return String((cn?.value ?? o?.value ?? "") || "") || null;
}

type CertificadoLido = {
  metadados: MetadadosCertificado;
  /** Objeto forge do certificado + chave, usados apenas em memória. */
  interno: { cert: unknown; key: unknown };
};

/** Lê um .pfx/.p12 localmente no navegador e extrai os metadados. */
export async function lerCertificadoA1(arquivo: File, senha: string): Promise<CertificadoLido> {
  const forge = (await import("node-forge")).default;
  const buffer = await arquivo.arrayBuffer();
  const binario = forge.util.createBuffer(new Uint8Array(buffer));
  let p12;
  try {
    const asn1 = forge.asn1.fromDer(binario);
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, senha);
  } catch {
    throw new Error("Não foi possível abrir o certificado. Verifique o arquivo e a senha.");
  }

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
  const keyBags =
    p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
      forge.pki.oids.pkcs8ShroudedKeyBag
    ] ?? [];
  const cert = certBags.map((b) => b.cert).find(Boolean);
  const key = keyBags.map((b) => b.key).find(Boolean);
  if (!cert) throw new Error("Certificado não encontrado no arquivo enviado.");

  return {
    metadados: {
      tipo: "A1",
      titular: nomeDoSujeito(cert.subject.attributes as never),
      ac_emissora: nomeDoSujeito(cert.issuer.attributes as never),
      numero_serie: cert.serialNumber ?? null,
      valido_de: cert.validity.notBefore?.toISOString() ?? null,
      valido_ate: cert.validity.notAfter?.toISOString() ?? null,
    },
    interno: { cert, key },
  };
}

/**
 * Assina o hash do documento com o certificado A1, em memória, no navegador
 * (PKCS#7 destacado). Devolve as evidências que ficam gravadas na assinatura.
 */
export async function assinarComA1(
  arquivo: File,
  senha: string,
  hashDocumento: string,
): Promise<EvidenciaAssinatura> {
  const forge = (await import("node-forge")).default;
  const { metadados, interno } = await lerCertificadoA1(arquivo, senha);
  if (!interno.key) throw new Error("Chave privada não encontrada no certificado.");

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(hashDocumento, "utf8");
  p7.addCertificate(interno.cert as never);
  p7.addSigner({
    key: interno.key as never,
    certificate: interno.cert as never,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date().toISOString() },
    ],
  });
  p7.sign({ detached: true });

  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  const protocolo = forge.md.sha256
    .create()
    .update(der)
    .digest()
    .toHex()
    .slice(0, 32)
    .toUpperCase();

  return {
    ...metadados,
    protocolo,
    carimbo_tempo: new Date().toISOString(),
    provedor: null,
  };
}
