import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { LogIn, LogOut, Pencil, Plus } from "lucide-react";
import { deInputLocal, duracao, paraInputLocal } from "@/lib/visitas";

export const Route = createFileRoute("/_authenticated/saidas-temporarias")({
  head: () => ({
    meta: [
      { title: "Saídas Temporárias — Residencial São Camilo" },
      {
        name: "description",
        content: "Registro de saídas temporárias dos residentes com acompanhante, motivo e horário de retorno.",
      },
      { property: "og:title", content: "Saídas Temporárias — Residencial São Camilo" },
      {
        property: "og:description",
        content: "Controle de saídas e retornos dos residentes da ILPI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SaidasPage,
});

type Saida = {
  id: string;
  residente_id: string;
  saida_em: string;
  acompanhante: string;
  motivo: string;
  retorno_em: string | null;
  observacoes: string | null;
  registrado_por_nome: string | null;
  residentes: { nome_completo: string } | null;
};

type Form = {
  id: string | null;
  residente_id: string;
  saida: string;
  acompanhante: string;
  motivo: string;
  retorno: string;
  observacoes: string;
};

const vazio = (): Form => ({
  id: null,
  residente_id: "",
  saida: paraInputLocal(new Date().toISOString()),
  acompanhante: "",
  motivo: "",
  retorno: "",
  observacoes: "",
});

const dataHora = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");

function SaidasPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);
  const [retornando, setRetornando] = useState<Saida | null>(null);
  const [retornoValor, setRetornoValor] = useState("");
  const [fResidente, setFResidente] = useState("todos");

  const residentes = useQuery({
    queryKey: ["residentes-simple"],
    queryFn: async () => {
      const { data } = await supabase.from("residentes").select("id, nome_completo").eq("ativo", true).order("nome_completo");
      return data ?? [];
    },
  });

  const saidas = useQuery({
    queryKey: ["saidas-temporarias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saidas_temporarias")
        .select("*, residentes(nome_completo)")
        .order("saida_em", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Saida[];
    },
  });

  const invalidar = () => qc.invalidateQueries({ queryKey: ["saidas-temporarias"] });

  const salvar = useMutation({
    mutationFn: async (f: Form) => {
      if (!f.residente_id) throw new Error("Selecione o residente");
      const saida = deInputLocal(f.saida);
      if (!saida) throw new Error("Informe data e hora da saída");
      if (!f.acompanhante.trim()) throw new Error("Informe o acompanhante");
      if (!f.motivo.trim()) throw new Error("Informe o motivo");
      const retorno = f.retorno ? deInputLocal(f.retorno) : null;
      if (retorno && new Date(retorno) < new Date(saida)) throw new Error("O retorno não pode ser antes da saída");
      const dados = {
        residente_id: f.residente_id,
        saida_em: saida,
        acompanhante: f.acompanhante.trim(),
        motivo: f.motivo.trim(),
        retorno_em: retorno,
        observacoes: f.observacoes.trim() || null,
      };
      if (f.id) {
        const { error } = await supabase.from("saidas_temporarias").update(dados).eq("id", f.id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { data: p } = u.user
          ? await supabase.from("profiles").select("full_name").eq("id", u.user.id).maybeSingle()
          : { data: null };
        const { error } = await supabase
          .from("saidas_temporarias")
          .insert({ ...dados, registrado_por: u.user?.id ?? null, registrado_por_nome: p?.full_name ?? null });
        if (error) throw error;
      }
      return !!f.id;
    },
    onSuccess: (corrigido) => {
      toast.success(corrigido ? "Registro corrigido" : "Saída registrada");
      setForm(null);
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const registrarRetorno = useMutation({
    mutationFn: async ({ s, quando }: { s: Saida; quando: string }) => {
      if (new Date(quando) < new Date(s.saida_em)) throw new Error("O retorno não pode ser antes da saída");
      const { error } = await supabase.from("saidas_temporarias").update({ retorno_em: quando }).eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Retorno registrado");
      setRetornando(null);
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fora = useMemo(() => (saidas.data ?? []).filter((s) => !s.retorno_em), [saidas.data]);
  const historico = useMemo(
    () => (saidas.data ?? []).filter((s) => fResidente === "todos" || s.residente_id === fResidente),
    [saidas.data, fResidente],
  );

  const abrirEdicao = (s: Saida) =>
    setForm({
      id: s.id,
      residente_id: s.residente_id,
      saida: paraInputLocal(s.saida_em),
      acompanhante: s.acompanhante,
      motivo: s.motivo,
      retorno: s.retorno_em ? paraInputLocal(s.retorno_em) : "",
      observacoes: s.observacoes ?? "",
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <LogOut className="size-5" />
          <h2 className="text-xl font-extrabold tracking-tight">Saídas Temporárias</h2>
        </div>
        <Button className="gap-2" onClick={() => setForm(vazio())}>
          <Plus className="size-4" /> Registrar saída
        </Button>
      </div>

      <section className="bg-surface border border-border rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-muted-foreground">
          Fora da casa agora ({fora.length})
        </h3>
        {fora.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todos os residentes estão na casa.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {fora.map((s) => (
              <div key={s.id} className="border border-primary/40 bg-primary/5 rounded-lg p-3 space-y-2">
                <p className="font-bold">{s.residentes?.nome_completo ?? "—"}</p>
                <p className="text-xs text-muted-foreground">
                  Saiu {dataHora(s.saida_em)} com {s.acompanhante} — {s.motivo}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="gap-1"
                    onClick={() => {
                      setRetornando(s);
                      setRetornoValor(paraInputLocal(new Date().toISOString()));
                    }}
                  >
                    <LogIn className="size-4" /> Registrar retorno
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => abrirEdicao(s)}>
                    <Pencil className="size-4" /> Corrigir
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="font-extrabold text-lg">Histórico de saídas</h3>
          <div className="w-64">
            <Select value={fResidente} onValueChange={setFResidente}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os residentes</SelectItem>
                {residentes.data?.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.nome_completo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="border border-border rounded-lg overflow-x-auto bg-surface">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left font-bold p-3">Residente</th>
                <th className="text-left font-bold p-3">Saída</th>
                <th className="text-left font-bold p-3">Acompanhante</th>
                <th className="text-left font-bold p-3">Motivo</th>
                <th className="text-left font-bold p-3">Retorno</th>
                <th className="text-left font-bold p-3">Tempo fora</th>
                <th className="text-right font-bold p-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {historico.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhuma saída registrada.</td>
                </tr>
              )}
              {historico.map((s) => (
                <tr key={s.id} className={cn("border-t border-border", !s.retorno_em && "bg-primary/5")}>
                  <td className="p-3 font-bold">{s.residentes?.nome_completo ?? "—"}</td>
                  <td className="p-3 whitespace-nowrap">{dataHora(s.saida_em)}</td>
                  <td className="p-3">{s.acompanhante}</td>
                  <td className="p-3">
                    {s.motivo}
                    {s.observacoes && <p className="text-[11px] italic text-muted-foreground">{s.observacoes}</p>}
                  </td>
                  <td className="p-3 whitespace-nowrap">{s.retorno_em ? dataHora(s.retorno_em) : "Fora da casa"}</td>
                  <td className="p-3 whitespace-nowrap">{s.retorno_em ? duracao(s.saida_em, s.retorno_em) : "—"}</td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" className="gap-1" onClick={() => abrirEdicao(s)}>
                      <Pencil className="size-4" /> Corrigir
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id ? "Corrigir saída" : "Registrar saída temporária"}</DialogTitle>
            <DialogDescription>Informe quem acompanha o residente e o motivo da saída.</DialogDescription>
          </DialogHeader>
          {form && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Residente</Label>
                <Select value={form.residente_id} onValueChange={(v) => setForm({ ...form, residente_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o residente" /></SelectTrigger>
                  <SelectContent>
                    {residentes.data?.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.nome_completo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-saida">Data e hora da saída</Label>
                <Input id="s-saida" type="datetime-local" value={form.saida} onChange={(e) => setForm({ ...form, saida: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-acomp">Acompanhante</Label>
                <Input id="s-acomp" value={form.acompanhante} onChange={(e) => setForm({ ...form, acompanhante: e.target.value })} placeholder="Nome e parentesco" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-motivo">Motivo</Label>
                <Input id="s-motivo" value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} placeholder="Ex.: consulta médica, passeio com a família" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-retorno">Data e hora do retorno (deixe vazio se ainda não voltou)</Label>
                <Input id="s-retorno" type="datetime-local" value={form.retorno} onChange={(e) => setForm({ ...form, retorno: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-obs">Observações</Label>
                <Input id="s-obs" value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} placeholder="Ex.: levou medicação do almoço" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
            <Button disabled={salvar.isPending} onClick={() => form && salvar.mutate(form)}>
              {form?.id ? "Salvar correções" : "Registrar saída"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!retornando} onOpenChange={(o) => !o && setRetornando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar retorno</DialogTitle>
            <DialogDescription>
              {retornando?.residentes?.nome_completo} — saiu {dataHora(retornando?.saida_em ?? null)}
            </DialogDescription>
          </DialogHeader>
          <Input type="datetime-local" value={retornoValor} onChange={(e) => setRetornoValor(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRetornando(null)}>Cancelar</Button>
            <Button
              disabled={registrarRetorno.isPending}
              onClick={() => {
                const quando = deInputLocal(retornoValor);
                if (!retornando || !quando) return toast.error("Informe data e hora do retorno");
                registrarRetorno.mutate({ s: retornando, quando });
              }}
            >
              Confirmar retorno
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
