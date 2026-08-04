import { supabase } from "@/integrations/supabase/client";

let ipCache: string | null | undefined;

async function obterIp(): Promise<string | null> {
  if (ipCache !== undefined) return ipCache;
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const json = (await res.json()) as { ip?: string };
    ipCache = json.ip ?? null;
  } catch {
    ipCache = null;
  }
  return ipCache;
}

export type AcaoAuditoria = "criacao" | "edicao" | "impressao" | "visualizacao" | "alerta";

export async function registrarAuditoria(params: {
  acao: AcaoAuditoria;
  entidade: string;
  entidadeId?: string | null;
  residenteId?: string | null;
  detalhes?: Record<string, unknown>;
}) {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return;
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    await supabase.from("auditoria_prontuario").insert({
      user_id: user.id,
      user_nome: prof?.full_name ?? user.email ?? null,
      acao: params.acao,
      entidade: params.entidade,
      entidade_id: params.entidadeId ?? null,
      residente_id: params.residenteId ?? null,
      ip: await obterIp(),
      equipamento: typeof navigator !== "undefined" ? navigator.userAgent : null,
      detalhes: (params.detalhes ?? {}) as never,
    });
  } catch {
    // auditoria nunca deve quebrar o fluxo do usuário
  }
}
