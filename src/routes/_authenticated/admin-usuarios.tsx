import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ShieldCheck, ShieldMinus, ShieldPlus, Search, History, Trash2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { excluirProfissional } from "@/lib/admin-usuarios.functions";

export const Route = createFileRoute("/_authenticated/admin-usuarios")({
  head: () => ({
    meta: [
      { title: "Gerenciar Administradores · Residencial São Camilo" },
      {
        name: "description",
        content:
          "Conceda ou remova privilégios de administrador aos profissionais cadastrados, com confirmação e histórico de auditoria.",
      },
      { property: "og:title", content: "Gerenciar Administradores · Residencial São Camilo" },
      {
        property: "og:description",
        content: "Controle de perfis administrativos da equipe do Residencial São Camilo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminUsuarios,
});

type Profissional = {
  id: string;
  full_name: string;
  email: string | null;
  celular: string | null;
  funcao: string | null;
  registro_profissional: string | null;
  status_aprovacao: string;
  aprovado: boolean;
  created_at: string;
  roles: string[];
};

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  gerente: "Gerente",
  enfermeiro: "Enfermeiro(a)",
  cuidador: "Cuidador(a)",
  familia: "Família",
  multiprofissional: "Multiprofissional",
};

const funcaoFallback: Record<string, string> = {
  medico: "Médico",
  enfermeira: "Enfermeira",
  outro: "Outro profissional",
};

function dataBr(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

async function obterIp(): Promise<string | null> {
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const json = (await res.json()) as { ip?: string };
    return json.ip ?? null;
  } catch {
    return null;
  }
}

function AdminUsuarios() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroPerfil, setFiltroPerfil] = useState("todos");
  const [ordem, setOrdem] = useState<"nome" | "profissao">("nome");

  const { data: meuId } = useQuery({
    queryKey: ["meu-user-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });

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

  const { data: categorias } = useQuery({
    queryKey: ["categorias-profissionais"],
    queryFn: async () => {
      const { data } = await supabase
        .from("categorias_profissionais")
        .select("chave, nome")
        .eq("ativo", true);
      return data ?? [];
    },
  });

  const catLabel = (chave: string | null) => {
    if (!chave) return "—";
    return categorias?.find((c) => c.chave === chave)?.nome ?? funcaoFallback[chave] ?? chave;
  };

  const { data: profissionais, isLoading } = useQuery({
    queryKey: ["profissionais-admin"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("listar_profissionais");
      if (error) throw error;
      return (data ?? []) as Profissional[];
    },
  });

  const { data: auditoria } = useQuery({
    queryKey: ["auditoria-privilegios"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auditoria_prontuario")
        .select("id, user_nome, created_at, ip, equipamento, detalhes")
        .eq("entidade", "privilegios_admin")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const alterar = useMutation({
    mutationFn: async ({ userId, tornar }: { userId: string; tornar: boolean }) => {
      const { error } = await supabase.rpc("definir_admin", {
        _user_id: userId,
        _tornar: tornar,
        _ip: (await obterIp()) ?? undefined,
        _equipamento: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(
        v.tornar
          ? "Privilégios de administrador concedidos com sucesso"
          : "Privilégios de administrador removidos com sucesso",
      );
      qc.invalidateQueries({ queryKey: ["profissionais-admin"] });
      qc.invalidateQueries({ queryKey: ["auditoria-privilegios"] });
      qc.invalidateQueries({ queryKey: ["perfil-atual"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lista = useMemo(() => {
    let l = profissionais ?? [];
    const q = busca.trim().toLowerCase();
    if (q) l = l.filter((p) => p.full_name?.toLowerCase().includes(q));
    if (filtroCategoria !== "todas") l = l.filter((p) => (p.funcao ?? "") === filtroCategoria);
    if (filtroPerfil !== "todos") l = l.filter((p) => p.roles?.includes(filtroPerfil));
    return [...l].sort((a, b) =>
      ordem === "nome"
        ? (a.full_name ?? "").localeCompare(b.full_name ?? "", "pt-BR")
        : catLabel(a.funcao).localeCompare(catLabel(b.funcao), "pt-BR"),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profissionais, busca, filtroCategoria, filtroPerfil, ordem, categorias]);

  const categoriasPresentes = useMemo(() => {
    const set = new Set((profissionais ?? []).map((p) => p.funcao).filter(Boolean) as string[]);
    return [...set];
  }, [profissionais]);

  if (loadingRole) return <p className="text-sm text-muted-foreground">Verificando permissões…</p>;

  if (!isAdmin) {
    return (
      <div className="max-w-md space-y-2">
        <h2 className="text-xl font-extrabold tracking-tight">Área restrita</h2>
        <p className="text-sm text-muted-foreground">
          Apenas administradores podem gerenciar privilégios administrativos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-5" />
        <h2 className="text-xl font-extrabold tracking-tight">Gerenciar Administradores</h2>
      </div>

      <Tabs defaultValue="profissionais">
        <TabsList>
          <TabsTrigger value="profissionais">Profissionais</TabsTrigger>
          <TabsTrigger value="auditoria">Histórico de auditoria</TabsTrigger>
        </TabsList>

        <TabsContent value="profissionais" className="mt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="busca">Pesquisar por nome</Label>
              <div className="relative">
                <Search className="size-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="busca"
                  className="pl-8"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Nome do profissional"
                />
              </div>
            </div>
            <div>
              <Label>Categoria profissional</Label>
              <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {categoriasPresentes.map((c) => (
                    <SelectItem key={c} value={c}>{catLabel(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Perfil</Label>
              <Select value={filtroPerfil} onValueChange={setFiltroPerfil}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {Object.entries(roleLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ordenar por</Label>
              <Select value={ordem} onValueChange={(v) => setOrdem(v as "nome" | "profissao")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nome">Nome</SelectItem>
                  <SelectItem value="profissao">Profissão</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : lista.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum profissional encontrado.</p>
          ) : (
            <div className="border border-border rounded-lg overflow-x-auto bg-surface">
              <table className="w-full text-sm min-w-[900px]">
                <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left font-bold p-3">Nome completo</th>
                    <th className="text-left font-bold p-3">Categoria</th>
                    <th className="text-left font-bold p-3">Conselho</th>
                    <th className="text-left font-bold p-3">E-mail</th>
                    <th className="text-left font-bold p-3">Situação</th>
                    <th className="text-left font-bold p-3">Perfil atual</th>
                    <th className="text-left font-bold p-3">Cadastro</th>
                    <th className="text-right font-bold p-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((p) => {
                    const ehAdmin = p.roles?.includes("admin");
                    const souEu = p.id === meuId;
                    return (
                      <tr
                        key={p.id}
                        className={`border-t border-border ${ehAdmin ? "bg-primary/5" : ""}`}
                      >
                        <td className="p-3 font-bold">
                          {p.full_name}
                          {souEu && <span className="ml-2 text-[10px] text-muted-foreground">(você)</span>}
                        </td>
                        <td className="p-3">{catLabel(p.funcao)}</td>
                        <td className="p-3 font-mono text-xs">{p.registro_profissional ?? "—"}</td>
                        <td className="p-3 text-muted-foreground">{p.email ?? "—"}</td>
                        <td className="p-3">
                          <Badge variant={p.aprovado ? "default" : "secondary"}>
                            {p.aprovado ? "Ativo" : "Inativo"}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {(p.roles ?? []).map((r) => (
                              <Badge key={r} variant={r === "admin" ? "default" : "outline"}>
                                {roleLabels[r] ?? r}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground">{dataBr(p.created_at)}</td>
                        <td className="p-3 text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant={ehAdmin ? "outline" : "default"}
                                disabled={alterar.isPending || souEu}
                                title={souEu ? "Não é possível alterar os seus próprios privilégios" : undefined}
                              >
                                {ehAdmin ? <ShieldMinus className="size-4" /> : <ShieldPlus className="size-4" />}
                                {ehAdmin ? "Remover privilégios" : "Tornar administrador"}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  {ehAdmin ? "Remover privilégios de administrador" : "Conceder privilégios de administrador"}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  {ehAdmin ? (
                                    <>
                                      Tem a certeza que pretende <strong>remover</strong> os privilégios de
                                      administrador de <strong>{p.full_name}</strong>? A conta permanece ativa
                                      e mantém as permissões da sua categoria profissional.
                                    </>
                                  ) : (
                                    <>
                                      Tem a certeza que pretende tornar <strong>{p.full_name}</strong> um
                                      administrador? As permissões atuais são mantidas e as permissões
                                      administrativas são adicionadas.
                                    </>
                                  )}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  disabled={alterar.isPending}
                                  onClick={() => alterar.mutate({ userId: p.id, tornar: !ehAdmin })}
                                >
                                  Sim, confirmar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="auditoria" className="mt-6 space-y-3">
          <div className="flex items-center gap-2">
            <History className="size-4" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Alterações de privilégios
            </h3>
          </div>
          {!auditoria || auditoria.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma alteração registada.</p>
          ) : (
            <div className="border border-border rounded-lg overflow-x-auto bg-surface">
              <table className="w-full text-sm min-w-[800px]">
                <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left font-bold p-3">Data e hora</th>
                    <th className="text-left font-bold p-3">Operação</th>
                    <th className="text-left font-bold p-3">Responsável</th>
                    <th className="text-left font-bold p-3">Utilizador afetado</th>
                    <th className="text-left font-bold p-3">IP</th>
                    <th className="text-left font-bold p-3">Equipamento</th>
                  </tr>
                </thead>
                <tbody>
                  {auditoria.map((a) => {
                    const d = (a.detalhes ?? {}) as { operacao?: string; usuario_alvo_nome?: string };
                    return (
                      <tr key={a.id} className="border-t border-border">
                        <td className="p-3 whitespace-nowrap">
                          {new Date(a.created_at).toLocaleString("pt-BR")}
                        </td>
                        <td className="p-3">
                          <Badge variant={d.operacao === "promocao" ? "default" : "destructive"}>
                            {d.operacao === "promocao" ? "Promoção" : "Revogação"}
                          </Badge>
                        </td>
                        <td className="p-3">{a.user_nome ?? "—"}</td>
                        <td className="p-3 font-bold">{d.usuario_alvo_nome ?? "—"}</td>
                        <td className="p-3 font-mono text-xs">{a.ip ?? "—"}</td>
                        <td className="p-3 text-xs text-muted-foreground max-w-[280px] truncate">
                          {a.equipamento ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
