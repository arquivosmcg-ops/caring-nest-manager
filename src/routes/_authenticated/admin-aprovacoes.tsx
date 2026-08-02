import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  email: string | null;
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
        .select("id, full_name, email, funcao, registro_profissional, status_aprovacao, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Perfil[];
    },
  });

  const decidir = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "aprovado" | "recusado" }) => {
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
    <div className="space-y-10">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-5" />
        <h2 className="text-xl font-extrabold tracking-tight">Painel de aprovação</h2>
        <Badge variant="secondary">{pendentes.length} pendente(s)</Badge>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <>
          <section className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Aguardando aprovação
            </h3>
            {pendentes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum cadastro aguardando aprovação.</p>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden bg-surface">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left font-bold p-3">Nome</th>
                      <th className="text-left font-bold p-3">E-mail</th>
                      <th className="text-left font-bold p-3">Função</th>
                      <th className="text-left font-bold p-3">Carteira profissional</th>
                      <th className="text-right font-bold p-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendentes.map((p) => (
                      <tr key={p.id} className="border-t border-border">
                        <td className="p-3 font-bold">{p.full_name}</td>
                        <td className="p-3 text-muted-foreground">{p.email ?? "—"}</td>
                        <td className="p-3">{p.funcao ? funcaoLabel[p.funcao] ?? p.funcao : "—"}</td>
                        <td className="p-3 font-mono text-xs">{p.registro_profissional ?? "—"}</td>
                        <td className="p-3">
                          <div className="flex justify-end gap-2">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" disabled={decidir.isPending}>
                                  <Check className="size-4" /> Aprovar
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Confirmar aprovação</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem a certeza que pretende <strong>aprovar</strong> o acesso
                                    de <strong>{p.full_name}</strong>? Esta pessoa poderá entrar no
                                    sistema imediatamente.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    disabled={decidir.isPending}
                                    onClick={() => decidir.mutate({ id: p.id, status: "aprovado" })}
                                  >
                                    Sim, aprovar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="outline" disabled={decidir.isPending}>
                                  <X className="size-4" /> Recusar
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Confirmar recusa</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem a certeza que pretende <strong>recusar</strong> o acesso
                                    de <strong>{p.full_name}</strong>? Esta pessoa não conseguirá
                                    entrar no sistema.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-white hover:bg-destructive/90"
                                    disabled={decidir.isPending}
                                    onClick={() => decidir.mutate({ id: p.id, status: "recusado" })}
                                  >
                                    Sim, recusar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Demais contas
            </h3>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  {demais.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="p-3 font-medium">{p.full_name}</td>
                      <td className="p-3 text-muted-foreground">{p.email ?? "—"}</td>
                      <td className="p-3">{p.funcao ? funcaoLabel[p.funcao] ?? p.funcao : "—"}</td>
                      <td className="p-3 font-mono text-xs">{p.registro_profissional ?? "—"}</td>
                      <td className="p-3">
                        <Badge variant={p.status_aprovacao === "aprovado" ? "default" : "destructive"}>
                          {p.status_aprovacao}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        {p.status_aprovacao !== "aprovado" && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm">
                                <Check className="size-4" /> Aprovar
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar aprovação</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem a certeza que pretende <strong>aprovar</strong> o acesso
                                  de <strong>{p.full_name}</strong>?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  disabled={decidir.isPending}
                                  onClick={() => decidir.mutate({ id: p.id, status: "aprovado" })}
                                >
                                  Sim, aprovar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
