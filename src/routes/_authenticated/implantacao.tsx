import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, AlertCircle, Printer, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/implantacao")({
  head: () => ({
    meta: [
      { title: "Checklist de Implantação · Residencial São Camilo" },
      {
        name: "description",
        content:
          "Acompanhe o cadastro e a aprovação de todos os profissionais até a equipe estar pronta para iniciar as escalas mensais.",
      },
      { property: "og:title", content: "Checklist de Implantação · Residencial São Camilo" },
      {
        property: "og:description",
        content: "Situação do cadastro da equipe antes do início das escalas mensais.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Implantacao,
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
  na_escala: boolean | null;
};

const CHAVE_META = "implantacao_total_esperado";

function Implantacao() {
  const [meta, setMeta] = useState<string>("");

  useEffect(() => {
    setMeta(localStorage.getItem(CHAVE_META) ?? "");
  }, []);

  const salvarMeta = (v: string) => {
    setMeta(v);
    localStorage.setItem(CHAVE_META, v);
  };

  const { data: profissionais, isLoading, error } = useQuery({
    queryKey: ["profissionais-implantacao"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("listar_profissionais");
      if (error) throw error;
      return (data ?? []) as Profissional[];
    },
  });

  const lista = profissionais ?? [];

  const resumo = useMemo(() => {
    const aprovados = lista.filter((p) => p.aprovado);
    const pendentes = lista.filter((p) => p.status_aprovacao === "pendente");
    const recusados = lista.filter((p) => p.status_aprovacao === "recusado");
    const naEscala = aprovados.filter((p) => p.na_escala !== false);
    const semContato = aprovados.filter((p) => !p.celular);
    const semCategoria = aprovados.filter((p) => !p.funcao);
    return { aprovados, pendentes, recusados, naEscala, semContato, semCategoria };
  }, [lista]);

  const totalEsperado = Number(meta) > 0 ? Number(meta) : null;
  const progresso = totalEsperado
    ? Math.min(100, Math.round((resumo.aprovados.length / totalEsperado) * 100))
    : 0;

  const itens = [
    {
      ok: totalEsperado ? resumo.aprovados.length >= totalEsperado : resumo.aprovados.length > 0,
      titulo: "Todos os profissionais cadastrados e aprovados",
      detalhe: totalEsperado
        ? `${resumo.aprovados.length} de ${totalEsperado} previstos`
        : `${resumo.aprovados.length} aprovados (informe abaixo quantos são esperados)`,
    },
    {
      ok: resumo.pendentes.length === 0,
      titulo: "Nenhum cadastro aguardando aprovação",
      detalhe:
        resumo.pendentes.length === 0
          ? "Nada pendente"
          : `${resumo.pendentes.length} aguardando sua aprovação`,
    },
    {
      ok: resumo.semCategoria.length === 0,
      titulo: "Todos com função/categoria preenchida",
      detalhe:
        resumo.semCategoria.length === 0
          ? "Tudo preenchido"
          : `${resumo.semCategoria.length} sem função definida`,
    },
    {
      ok: resumo.semContato.length === 0,
      titulo: "Todos com celular de contato",
      detalhe:
        resumo.semContato.length === 0
          ? "Tudo preenchido"
          : `${resumo.semContato.length} sem celular cadastrado`,
    },
    {
      ok: resumo.naEscala.length > 0,
      titulo: "Equipe marcada para participar da escala",
      detalhe: `${resumo.naEscala.length} profissionais entram nos plantões`,
    },
  ];

  const pronto = itens.every((i) => i.ok);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold">Checklist de Implantação</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe quando a equipe estiver completa para começar as escalas mensais.
          </p>
        </div>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> Imprimir
        </Button>
      </div>

      {error ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Esta página está disponível apenas para administradores.
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Carregando…</CardContent>
        </Card>
      ) : (
        <>
          <Card className={pronto ? "border-primary" : undefined}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                {pronto ? (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                )}
                {pronto
                  ? "Tudo pronto para iniciar as escalas mensais"
                  : "Implantação em andamento"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 md:max-w-md">
                <div>
                  <Label htmlFor="meta">Quantos profissionais são esperados?</Label>
                  <Input
                    id="meta"
                    type="number"
                    min={0}
                    value={meta}
                    onChange={(e) => salvarMeta(e.target.value)}
                    placeholder="ex.: 24"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <span className="text-sm text-muted-foreground">
                    {resumo.aprovados.length} cadastrados e aprovados
                    {totalEsperado ? ` de ${totalEsperado}` : ""}
                  </span>
                  {totalEsperado ? <Progress value={progresso} className="mt-2" /> : null}
                </div>
              </div>

              <ul className="space-y-2">
                {itens.map((item) => (
                  <li key={item.titulo} className="flex items-start gap-3 rounded-md border p-3">
                    {item.ok ? (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    ) : (
                      <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium">{item.titulo}</p>
                      <p className="text-sm text-muted-foreground">{item.detalhe}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4" /> Situação de cada profissional
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3">Nome</th>
                    <th className="p-3">Função</th>
                    <th className="p-3">Celular</th>
                    <th className="p-3">Situação</th>
                    <th className="p-3">Escala</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="p-3 font-medium">{p.full_name}</td>
                      <td className="p-3">{p.funcao ?? "—"}</td>
                      <td className="p-3">{p.celular ?? "—"}</td>
                      <td className="p-3">
                        {p.aprovado ? (
                          <Badge>Aprovado</Badge>
                        ) : p.status_aprovacao === "recusado" ? (
                          <Badge variant="destructive">Recusado</Badge>
                        ) : (
                          <Badge variant="secondary">Pendente</Badge>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span>{p.na_escala === false ? "Não participa" : "Sim"}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="print:hidden"
                            disabled={alterarEscala.isPending}
                            onClick={() =>
                              alterarEscala.mutate({
                                userId: p.id,
                                participa: p.na_escala === false,
                              })
                            }
                          >
                            {p.na_escala === false ? "Incluir" : "Retirar"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {lista.length === 0 ? (
                    <tr>
                      <td className="p-6 text-muted-foreground" colSpan={5}>
                        Nenhum profissional cadastrado ainda.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
