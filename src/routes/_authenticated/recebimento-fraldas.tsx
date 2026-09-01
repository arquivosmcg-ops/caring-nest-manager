import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TextareaDitavel } from "@/components/ditar-audio";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronRight, Package, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/recebimento-fraldas")({
  head: () => ({
    meta: [
      { title: "Recebimento de Fraldas — Residencial São Camilo" },
      { name: "description", content: "Registro e histórico de entregas de fraldas e absorventes por residente." },
      { property: "og:title", content: "Recebimento de Fraldas — Residencial São Camilo" },
      { property: "og:description", content: "Registro e histórico de entregas de fraldas e absorventes por residente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RecebimentoFraldasPage,
});

type Forma = "familiar" | "fornecedor" | "correios";
type Tipo = "tradicional" | "calcinha_pant" | "absorvente";

type ItemDb = {
  id: string;
  produto: string | null;
  marca: string;
  tipo: Tipo;
  quantidade_fardos: number;
  unidades_por_fardo: number;
  total_unidades: number;
};

type ProdutoBase = {
  id: string;
  nome_produto: string;
  unidades_padrao_por_pacote: number;
  marca_sugerida: string | null;
  tipo_sugerido: Tipo;
};

type Registro = {
  id: string;
  residente_id: string;
  data_entrega: string;
  recebido_por: string;
  forma_entrega: Forma;
  nome_familiar: string | null;
  nome_fornecedor: string | null;
  origem_correios: "governo" | "outros" | null;
  observacoes: string | null;
  residentes: { nome_completo: string } | null;
  recebimentos_fraldas_itens: ItemDb[];
};

type ItemForm = {
  uid: string;
  produtoSel: string; // nome do produto da lista ou "__outros__"
  produtoOutro: string;
  marca: string;
  tipo: Tipo;
  fardos: string;
  unidades: string;
};

const OUTROS = "__outros__";

const FORMAS: { v: Forma; label: string }[] = [
  { v: "familiar", label: "Trazido por familiar" },
  { v: "fornecedor", label: "Entregue por fornecedor" },
  { v: "correios", label: "Entregue pelos Correios" },
];

const TIPOS: { v: Tipo; label: string }[] = [
  { v: "tradicional", label: "Fralda tradicional" },
  { v: "calcinha_pant", label: "Calcinha/Pant" },
  { v: "absorvente", label: "Absorvente" },
];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-bold border transition-colors",
        active
          ? "bg-foreground text-background border-foreground"
          : "bg-surface text-muted-foreground border-border hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

const hoje = () => new Date().toISOString().slice(0, 10);
const novoItem = (): ItemForm => ({
  uid: crypto.randomUUID(),
  produtoSel: "",
  produtoOutro: "",
  marca: "",
  tipo: "tradicional",
  fardos: "",
  unidades: "",
});

function RecebimentoFraldasPage() {
  const qc = useQueryClient();

  const residentes = useQuery({
    queryKey: ["residentes-simple"],
    queryFn: async () => {
      const { data } = await supabase
        .from("residentes")
        .select("id, nome_completo")
        .eq("ativo", true)
        .order("nome_completo");
      return data ?? [];
    },
  });

  const registros = useQuery({
    queryKey: ["recebimentos-fraldas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recebimentos_fraldas" as never)
        .select("*, residentes(nome_completo), recebimentos_fraldas_itens(*)")
        .order("data_entrega", { ascending: false })
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Registro[];
    },
  });

  const produtos = useQuery({
    queryKey: ["produtos-fraldas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos_fraldas" as never)
        .select("id, nome_produto, unidades_padrao_por_pacote, marca_sugerida, tipo_sugerido")
        .eq("ativo", true)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as unknown as ProdutoBase[];
    },
  });

  // ---- formulário (cabeçalho) ----
  const [residenteId, setResidenteId] = useState("");
  const [dataEntrega, setDataEntrega] = useState(hoje());
  const [recebidoPor, setRecebidoPor] = useState("");
  const [forma, setForma] = useState<Forma>("familiar");
  const [nomeFamiliar, setNomeFamiliar] = useState("");
  const [nomeFornecedor, setNomeFornecedor] = useState("");
  const [origemCorreios, setOrigemCorreios] = useState<"governo" | "outros">("governo");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<ItemForm[]>([novoItem()]);

  const setItem = (uid: string, patch: Partial<ItemForm>) =>
    setItens((prev) => prev.map((i) => (i.uid === uid ? { ...i, ...patch } : i)));

  const totalItem = (i: ItemForm) => (Number(i.fardos) || 0) * (Number(i.unidades) || 0);
  const totalGeral = itens.reduce((s, i) => s + totalItem(i), 0);

  const marcasConhecidas = useMemo(
    () =>
      Array.from(
        new Set((registros.data ?? []).flatMap((r) => r.recebimentos_fraldas_itens.map((i) => i.marca)).filter(Boolean)),
      ).sort(),
    [registros.data],
  );

  const limpar = () => {
    setResidenteId("");
    setDataEntrega(hoje());
    setRecebidoPor("");
    setForma("familiar");
    setNomeFamiliar("");
    setNomeFornecedor("");
    setOrigemCorreios("governo");
    setObservacoes("");
    setItens([novoItem()]);
  };

  const criar = useMutation({
    mutationFn: async () => {
      if (!residenteId) throw new Error("Selecione o residente");
      if (!recebidoPor.trim()) throw new Error("Informe quem recebeu a entrega");
      if (forma === "familiar" && !nomeFamiliar.trim()) throw new Error("Informe o nome do familiar");
      if (forma === "fornecedor" && !nomeFornecedor.trim()) throw new Error("Informe o nome do fornecedor");
      if (itens.length === 0) throw new Error("Adicione ao menos um item");
      itens.forEach((i, idx) => {
        if (!i.marca.trim()) throw new Error(`Informe a marca do item ${idx + 1}`);
        if (totalItem(i) <= 0) throw new Error(`Informe fardos e unidades do item ${idx + 1}`);
      });

      const { data: user } = await supabase.auth.getUser();
      const { data: header, error } = await supabase
        .from("recebimentos_fraldas" as never)
        .insert({
          residente_id: residenteId,
          data_entrega: dataEntrega,
          recebido_por: recebidoPor.trim(),
          registrado_por: user.user?.id ?? null,
          forma_entrega: forma,
          nome_familiar: forma === "familiar" ? nomeFamiliar.trim() : null,
          nome_fornecedor: forma === "fornecedor" ? nomeFornecedor.trim() : null,
          origem_correios: forma === "correios" ? origemCorreios : null,
          observacoes: observacoes.trim() || null,
        } as never)
        .select("id")
        .single();
      if (error) throw error;

      const recebimentoId = (header as unknown as { id: string }).id;
      const { error: errItens } = await supabase.from("recebimentos_fraldas_itens" as never).insert(
        itens.map((i) => ({
          recebimento_id: recebimentoId,
          marca: i.marca.trim(),
          tipo: i.tipo,
          quantidade_fardos: Number(i.fardos) || 0,
          unidades_por_fardo: Number(i.unidades) || 0,
        })) as never,
      );
      if (errItens) throw errItens;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recebimentos-fraldas"] });
      limpar();
      toast.success("Entrega registrada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recebimentos_fraldas" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recebimentos-fraldas"] });
      toast.success("Registro excluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ---- filtros ----
  const [fResidente, setFResidente] = useState("todos");
  const [fDe, setFDe] = useState("");
  const [fAte, setFAte] = useState("");
  const [fForma, setFForma] = useState("todas");
  const [fMarca, setFMarca] = useState("");
  const [fTipo, setFTipo] = useState("todos");
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});

  const filtrados = useMemo(() => {
    return (registros.data ?? []).filter((r) => {
      if (fResidente !== "todos" && r.residente_id !== fResidente) return false;
      if (fDe && r.data_entrega < fDe) return false;
      if (fAte && r.data_entrega > fAte) return false;
      if (fForma !== "todas" && r.forma_entrega !== fForma) return false;
      const its = r.recebimentos_fraldas_itens ?? [];
      if (fTipo !== "todos" && !its.some((i) => i.tipo === fTipo)) return false;
      if (fMarca && !its.some((i) => i.marca.toLowerCase().includes(fMarca.toLowerCase()))) return false;
      return true;
    });
  }, [registros.data, fResidente, fDe, fAte, fForma, fMarca, fTipo]);

  const totalRegistro = (r: Registro) =>
    (r.recebimentos_fraldas_itens ?? []).reduce((s, i) => s + (i.total_unidades ?? 0), 0);
  const totalPeriodo = filtrados.reduce((s, r) => s + totalRegistro(r), 0);

  const detalheForma = (r: Registro) =>
    r.forma_entrega === "familiar"
      ? `Familiar: ${r.nome_familiar ?? "—"}`
      : r.forma_entrega === "fornecedor"
        ? `Fornecedor: ${r.nome_fornecedor ?? "—"}`
        : `Correios: ${r.origem_correios === "governo" ? "Governo" : "Outros"}`;

  return (
    <div className="space-y-8">
      <section className="bg-surface border border-border rounded-lg p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Package className="size-5" />
          <h2 className="font-extrabold text-lg">Registrar entrega</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Residente</Label>
            <Select value={residenteId} onValueChange={setResidenteId}>
              <SelectTrigger><SelectValue placeholder="Selecione o residente" /></SelectTrigger>
              <SelectContent>
                {residentes.data?.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.nome_completo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="data-entrega">Data da entrega</Label>
            <Input id="data-entrega" type="date" value={dataEntrega} onChange={(e) => setDataEntrega(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="recebido-por">Recebido por</Label>
            <Input
              id="recebido-por"
              value={recebidoPor}
              onChange={(e) => setRecebidoPor(e.target.value)}
              placeholder="Nome de quem recebeu"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Forma de entrega</Label>
          <div className="flex flex-wrap gap-2">
            {FORMAS.map((f) => (
              <Chip key={f.v} active={forma === f.v} onClick={() => setForma(f.v)}>{f.label}</Chip>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            A forma de entrega vale para todos os itens deste registro. Se a mesma entrega vier de origens diferentes,
            crie um registro separado para cada forma de entrega.
          </p>
          {forma === "familiar" && (
            <div className="space-y-1.5 pt-2 max-w-md">
              <Label htmlFor="nome-familiar">Nome do familiar</Label>
              <Input id="nome-familiar" value={nomeFamiliar} onChange={(e) => setNomeFamiliar(e.target.value)} />
            </div>
          )}
          {forma === "fornecedor" && (
            <div className="space-y-1.5 pt-2 max-w-md">
              <Label htmlFor="nome-fornecedor">Nome do fornecedor</Label>
              <Input id="nome-fornecedor" value={nomeFornecedor} onChange={(e) => setNomeFornecedor(e.target.value)} />
            </div>
          )}
          {forma === "correios" && (
            <div className="space-y-2 pt-2">
              <Label>Origem</Label>
              <div className="flex gap-2">
                <Chip active={origemCorreios === "governo"} onClick={() => setOrigemCorreios("governo")}>Governo</Chip>
                <Chip active={origemCorreios === "outros"} onClick={() => setOrigemCorreios("outros")}>Outros</Chip>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-muted-foreground">Itens da entrega</h3>

          <datalist id="marcas-conhecidas">
            {marcasConhecidas.map((m) => <option key={m} value={m} />)}
          </datalist>

          {itens.map((item, idx) => (
            <div key={item.uid} className="border border-border rounded-lg p-4 space-y-4 bg-black/[0.01]">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Item {idx + 1}</p>
                {itens.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setItens((prev) => prev.filter((i) => i.uid !== item.uid))}
                    className="text-muted-foreground hover:text-primary p-1"
                    title="Remover item"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor={`marca-${item.uid}`}>Marca</Label>
                  <Input
                    id={`marca-${item.uid}`}
                    list="marcas-conhecidas"
                    value={item.marca}
                    onChange={(e) => setItem(item.uid, { marca: e.target.value })}
                    placeholder="Ex.: Tena, Bigfral…"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`fardos-${item.uid}`}>Quantidade de fardos</Label>
                  <Input
                    id={`fardos-${item.uid}`}
                    type="number"
                    min={0}
                    value={item.fardos}
                    onChange={(e) => setItem(item.uid, { fardos: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`unidades-${item.uid}`}>Unidades por fardo</Label>
                  <Input
                    id={`unidades-${item.uid}`}
                    type="number"
                    min={0}
                    value={item.unidades}
                    onChange={(e) => setItem(item.uid, { unidades: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`total-${item.uid}`}>Total de unidades</Label>
                  <Input id={`total-${item.uid}`} readOnly value={totalItem(item)} className="bg-muted font-bold" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tipo</Label>
                <div className="flex flex-wrap gap-2">
                  {TIPOS.map((t) => (
                    <Chip key={t.v} active={item.tipo === t.v} onClick={() => setItem(item.uid, { tipo: t.v })}>
                      {t.label}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between flex-wrap gap-3">
            <Button type="button" variant="outline" className="gap-2" onClick={() => setItens((p) => [...p, novoItem()])}>
              <Plus className="size-4" />
              Adicionar outro item
            </Button>
            <div className="bg-foreground text-background px-4 py-2 rounded-md text-sm font-extrabold">
              Total geral: {totalGeral.toLocaleString("pt-BR")} unidades
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="obs">Observações</Label>
          <TextareaDitavel
            id="obs"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Ex.: fardo violado, produto vencendo em breve…"
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={() => criar.mutate()} disabled={criar.isPending} className="gap-2">
            <Plus className="size-4" />
            Registrar entrega
          </Button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-extrabold text-lg">Histórico de recebimentos</h2>
          <div className="bg-foreground text-background px-4 py-2 rounded-md text-sm font-extrabold">
            Total no período: {totalPeriodo.toLocaleString("pt-BR")} unidades
          </div>
        </div>

        <div className="bg-surface border border-border rounded-lg p-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase">Residente</Label>
            <Select value={fResidente} onValueChange={setFResidente}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {residentes.data?.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome_completo}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase">De</Label>
            <Input type="date" value={fDe} onChange={(e) => setFDe(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase">Até</Label>
            <Input type="date" value={fAte} onChange={(e) => setFAte(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase">Forma</Label>
            <Select value={fForma} onValueChange={setFForma}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {FORMAS.map((f) => <SelectItem key={f.v} value={f.v}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase">Marca</Label>
            <Input value={fMarca} onChange={(e) => setFMarca(e.target.value)} placeholder="Buscar marca" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase">Tipo</Label>
            <Select value={fTipo} onValueChange={setFTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {TIPOS.map((t) => <SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3">
          {filtrados.length === 0 && (
            <p className="bg-surface border border-border rounded-lg px-4 py-10 text-center text-sm text-muted-foreground">
              Nenhum recebimento encontrado.
            </p>
          )}

          {filtrados.map((r) => {
            const aberto = !!abertos[r.id];
            const its = r.recebimentos_fraldas_itens ?? [];
            return (
              <div key={r.id} className="bg-surface border border-border rounded-lg overflow-hidden">
                <div className="flex items-start gap-3 p-4">
                  <button
                    type="button"
                    onClick={() => setAbertos((p) => ({ ...p, [r.id]: !aberto }))}
                    className="mt-0.5 text-muted-foreground hover:text-foreground"
                    aria-label={aberto ? "Recolher itens" : "Expandir itens"}
                  >
                    {aberto ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  </button>

                  <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <p className="font-mono text-sm">
                        {new Date(`${r.data_entrega}T12:00:00`).toLocaleDateString("pt-BR")}
                      </p>
                      <p className="font-bold">{r.residentes?.nome_completo ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{FORMAS.find((f) => f.v === r.forma_entrega)?.label}</p>
                      <p className="text-[11px] text-muted-foreground">{detalheForma(r)}</p>
                    </div>
                    <div>
                      <p className="text-sm">{its.length} {its.length === 1 ? "item" : "itens"}</p>
                      <p className="text-[11px] text-muted-foreground">Recebido por {r.recebido_por}</p>
                    </div>
                    <div className="md:text-right">
                      <p className="font-mono font-extrabold">{totalRegistro(r).toLocaleString("pt-BR")} un.</p>
                      {r.observacoes && (
                        <p className="text-[11px] text-muted-foreground italic">{r.observacoes}</p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => remover.mutate(r.id)}
                    className="text-muted-foreground hover:text-primary p-1"
                    title="Excluir registro"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>

                {aberto && (
                  <div className="border-t border-border overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead className="bg-black/[0.02] border-b border-border">
                        <tr>
                          {["Marca", "Tipo", "Fardos", "Un./fardo", "Total"].map((h) => (
                            <th key={h} className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {its.map((i) => (
                          <tr key={i.id}>
                            <td className="px-3 py-2">{i.marca}</td>
                            <td className="px-3 py-2">{TIPOS.find((t) => t.v === i.tipo)?.label}</td>
                            <td className="px-3 py-2 font-mono">{i.quantidade_fardos}</td>
                            <td className="px-3 py-2 font-mono">{i.unidades_por_fardo}</td>
                            <td className="px-3 py-2 font-mono font-bold">{i.total_unidades}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
