import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, X, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin-aprovacoes")({
  head: () => ({
    meta: [
      { title: "Aprovações de acesso · Residencial São Camilo" },
      { name: "description", content: "Tela administrativa para aprovar ou recusar o acesso de médicos e enfermeiras ao sistema." },
      { property: "og:title", content: "Aprovações de acesso · Residencial São Camilo" },
      { property: "og:description", content: "Aprove ou recuse novos cadastros da equipe clínica." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminAprovacoes,
});

type Perfil = {
  id: string;
  full_name: string;
  funcao: string | null;
  registro_profissional: string | null;
  status_aprovacao: string;
  created_at: string;
};

const funcaoLabel: Record<string, string> = { medico: "Médico", enfermeira: "Enfermeira" };

function AdminAprovacoes() {
  const qc = useQueryClient();

  const { data: isAdmin, isLoading: loadingRole } = useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
  });

  const { data: perfis, isLoading } = useQuery({
    queryKey: ["perfis-aprovacao"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, funcao, registro_profissional, status_aprovacao, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Perfil[];
    },
  });

  const decidir = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "aprovado" | "rejeitado" }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("profiles")
        .update({
          status_aprovacao: status,
          aprovado: status === "aprovado",
          aprovado_em: new Date().toISOString(),
          aprovado_por: userData.user?.id ?? null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.status === "aprovado" ? "Acesso liberado" : "Acesso recusado");
      qc.invalidateQueries({ queryKey: ["perfis-aprovacao"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loadingRole) return <p className="text-sm text-muted-foreground">Verificando permissões…</p>;

  if (!isAdmin) {
    return (
      <div className="max-w-md space-y-2">
        <h2 className="text-xl font-extrabold tracking-tight">Área restrita</h2>
        <p className="text-sm text-muted-foreground">
          Apenas administradores podem gerenciar aprovações de acesso.
        </p>
      </div>
    );
  }

  const pendentes = perfis?.filter((p) => p.status_aprovacao === "pendente") ?? [];
  const demais = perfis?.filter((p) => p.status_aprovacao !== "pendente") ?? [];

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-5" />
        <h2 className="text-xl font-extrabold tracking-tight">Aprovações de acesso</h2>
        <Badge variant="secondary">{pendentes.length} pendente(s)</Badge>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <>
          <section className="space-y-3">
            {pendentes.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum cadastro aguardando aprovação.</p>
            )}
            {pendentes.map((p) => (
              <div key={p.id} className="flex items-center gap-4 border border-border rounded-lg p-4 bg-surface">
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{p.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.funcao ? funcaoLabel[p.funcao] ?? p.funcao : "Função não informada"}
                    {p.registro_profissional ? ` · ${p.registro_profissional}` : ""}
                  </p>
                </div>
                <Button size="sm" onClick={() => decidir.mutate({ id: p.id, status: "aprovado" })}>
                  <Check className="size-4" /> Aprovar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => decidir.mutate({ id: p.id, status: "rejeitado" })}
                >
                  <X className="size-4" /> Recusar
                </Button>
              </div>
            ))}
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Demais contas
            </h3>
            {demais.map((p) => (
              <div key={p.id} className="flex items-center gap-4 border border-border rounded-lg p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.funcao ? funcaoLabel[p.funcao] ?? p.funcao : "—"}
                    {p.registro_profissional ? ` · ${p.registro_profissional}` : ""}
                  </p>
                </div>
                <Badge variant={p.status_aprovacao === "aprovado" ? "default" : "destructive"}>
                  {p.status_aprovacao}
                </Badge>
                {p.status_aprovacao === "rejeitado" && (
                  <Button size="sm" onClick={() => decidir.mutate({ id: p.id, status: "aprovado" })}>
                    <Check className="size-4" /> Aprovar
                  </Button>
                )}
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
