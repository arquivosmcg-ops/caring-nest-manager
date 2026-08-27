import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const excluirProfissional = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        ip: z.string().optional(),
        equipamento: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId) {
      throw new Error("Não é possível eliminar a sua própria conta");
    }

    const { data: souAdmin } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!souAdmin) throw new Error("Apenas administradores podem eliminar profissionais");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: alvo } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", data.userId)
      .maybeSingle();
    if (!alvo) throw new Error("Utilizador não encontrado");

    const { data: alvoAdmin } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (alvoAdmin) {
      throw new Error(
        "Remova primeiro os privilégios de administrador antes de eliminar esta conta",
      );
    }

    const { data: eu } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) {
      throw new Error(
        "Não foi possível eliminar: esta conta possui registos clínicos associados que não podem ser apagados.",
      );
    }

    await supabaseAdmin.from("auditoria_prontuario").insert({
      user_id: context.userId,
      user_nome: eu?.full_name ?? null,
      acao: "exclusao",
      entidade: "privilegios_admin",
      entidade_id: data.userId,
      ip: data.ip ?? null,
      equipamento: data.equipamento ?? null,
      detalhes: {
        operacao: "exclusao_conta",
        usuario_alvo_id: data.userId,
        usuario_alvo_nome: alvo.full_name,
        usuario_alvo_email: alvo.email,
      },
    });

    return { ok: true };
  });
