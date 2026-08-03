import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Check, X, ShieldCheck, Lock, KeyRound } from "lucide-react";
import { useState } from "react";
import { SenhaForca } from "@/components/senha-forca";
import { senhaValida } from "@/lib/senha";


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
  celular: string | null;
  funcao: string | null;
  registro_profissional: string | null;
  status_aprovacao: string;
  created_at: string;
};

const funcaoLabel: Record<string, string> = { medico: "Médico", enfermeira: "Enfermeira" };

function CelularLink({ celular }: { celular: string | null }) {
  if (!celular) return <span className="text-muted-foreground">—</span>;
  return (
    <a href={`tel:${celular.replace(/\D/g, "")}`} className="font-mono text-xs underline underline-offset-2">
      {celular}
    </a>
  );
}

function EsqueciSenha({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [senhaLogin, setSenhaLogin] = useState("");
  const [nova, setNova] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nova.length < 6) return toast.error("A nova palavra-passe deve ter pelo menos 6 caracteres");
    if (nova !== confirmar) return toast.error("A confirmação não coincide com a nova palavra-passe");
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const email = userData.user?.email;
    if (!email) {
      setLoading(false);
      return toast.error("Sessão expirada. Entre novamente.");
    }
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password: senhaLogin });
    if (authError) {
      setLoading(false);
      return toast.error("Senha da sua conta incorreta");
    }
    const { data, error } = await supabase.rpc("redefinir_senha_painel", { _nova: nova });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (!data) return toast.error("Não foi possível redefinir a palavra-passe");
    setSenhaLogin(""); setNova(""); setConfirmar(""); setOpen(false);
    toast.success("Palavra-passe de administrador atualizada com sucesso!");
    onDone();
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs underline underline-offset-2 text-muted-foreground">
        Esqueci a palavra-passe
      </button>
    );
  }

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <p className="text-xs text-muted-foreground">
        Confirme a senha da sua conta de login para definir uma nova palavra-passe do painel.
      </p>
      <div>
        <Label htmlFor="senha-login">Senha da sua conta (login)</Label>
        <Input id="senha-login" type="password" required value={senhaLogin} onChange={(e) => setSenhaLogin(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="nova-reset">Nova palavra-passe do painel</Label>
        <Input id="nova-reset" type="password" required minLength={6} value={nova} onChange={(e) => setNova(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="confirmar-reset">Confirmar nova palavra-passe</Label>
        <Input id="confirmar-reset" type="password" required minLength={6} value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button type="button" disabled={loading} onClick={submit}>{loading ? "Redefinindo…" : "Redefinir"}</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
      </div>
    </div>
  );
}

function SenhaGate({ onUnlock }: { onUnlock: () => void }) {
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.rpc("verificar_senha_painel", { _senha: senha });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (!data) return toast.error("Palavra-passe incorreta");
    onUnlock();
  };

  return (
    <form onSubmit={submit} className="max-w-sm space-y-4 bg-surface border border-border rounded-lg p-6">
      <div className="flex items-center gap-2">
        <Lock className="size-5" />
        <h2 className="text-lg font-extrabold tracking-tight">Painel protegido</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Introduza a palavra-passe de administrador para abrir o painel.
      </p>
      <div>
        <Label htmlFor="senha-painel">Palavra-passe</Label>
        <Input id="senha-painel" type="password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Verificando…" : "Abrir painel"}
      </Button>
      <EsqueciSenha onDone={onUnlock} />
    </form>
  );
}


function ConfiguracoesSeguranca() {
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senhaValida(nova)) return toast.error("A nova palavra-passe não cumpre os requisitos de segurança");
    if (nova !== confirmar) return toast.error("A confirmação não coincide com a nova palavra-passe");

    setLoading(true);
    const { data, error } = await supabase.rpc("alterar_senha_painel", { _atual: atual, _nova: nova });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (!data) return toast.error("Palavra-passe atual incorreta");
    setAtual(""); setNova(""); setConfirmar("");
    toast.success("Palavra-passe de administrador atualizada com sucesso!");
  };

  return (
    <form onSubmit={submit} className="max-w-sm space-y-4 bg-surface border border-border rounded-lg p-6">
      <div className="flex items-center gap-2">
        <KeyRound className="size-5" />
        <h3 className="text-lg font-extrabold tracking-tight">Configurações de segurança</h3>
      </div>
      <div>
        <Label htmlFor="atual">Palavra-passe atual</Label>
        <Input id="atual" type="password" required value={atual} onChange={(e) => setAtual(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="nova">Nova palavra-passe</Label>
        <Input id="nova" type="password" required minLength={8} value={nova} onChange={(e) => setNova(e.target.value)} />
        <SenhaForca senha={nova} />
      </div>
      <div>
        <Label htmlFor="confirmar">Confirmar nova palavra-passe</Label>
        <Input id="confirmar" type="password" required minLength={8} value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
      </div>
      <Button type="submit" disabled={loading || !senhaValida(nova)}>{loading ? "Salvando…" : "Alterar palavra-passe"}</Button>

      <p className="text-[10px] text-muted-foreground">
        A partir da próxima abertura, o painel só abre com a nova palavra-passe.
      </p>
    </form>
  );
}

function AdminAprovacoes() {
  const qc = useQueryClient();
  const [desbloqueado, setDesbloqueado] = useState(false);

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
    enabled: !!isAdmin && desbloqueado,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, celular, funcao, registro_profissional, status_aprovacao, created_at")
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

  if (!desbloqueado) return <SenhaGate onUnlock={() => setDesbloqueado(true)} />;

  const pendentes = perfis?.filter((p) => p.status_aprovacao === "pendente") ?? [];
  const demais = perfis?.filter((p) => p.status_aprovacao !== "pendente") ?? [];

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-5" />
        <h2 className="text-xl font-extrabold tracking-tight">Painel de aprovação</h2>
        <Badge variant="secondary">{pendentes.length} pendente(s)</Badge>
      </div>

      <Tabs defaultValue="aprovacoes">
        <TabsList>
          <TabsTrigger value="aprovacoes">Aprovações</TabsTrigger>
          <TabsTrigger value="seguranca">Configurações de segurança</TabsTrigger>
        </TabsList>

        <TabsContent value="aprovacoes" className="mt-6 space-y-10">
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
                          <th className="text-left font-bold p-3">Celular</th>
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
                            <td className="p-3"><CelularLink celular={p.celular} /></td>
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
                          <td className="p-3"><CelularLink celular={p.celular} /></td>
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
        </TabsContent>

        <TabsContent value="seguranca" className="mt-6">
          <ConfiguracoesSeguranca />
        </TabsContent>
      </Tabs>
    </div>
  );
}
