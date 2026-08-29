import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TextareaDitavel } from "@/components/ditar-audio";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Boxes, Plus, Trash2, ChevronDown, ChevronRight, AlertTriangle, PackageCheck, Truck } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePerfilAtual } from "@/hooks/use-perfil";

export const Route = createFileRoute("/_authenticated/recebimento-itens")({
  head: () => ({
    meta: [
      { title: "Recebimento de Itens e Materiais — Residencial São Camilo" },
      {
        name: "description",
        content:
          "Registro de itens de higiene, equipamentos e materiais médicos recebidos para os residentes, com controle de posse e retirada.",
      },
      { property: "og:title", content: "Recebimento de Itens e Materiais — Residencial São Camilo" },
      {
        property: "og:description",
        content: "Controle de entrada de itens, equipamentos em aluguel/empréstimo e retiradas por convênio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RecebimentoItensPage,
});

type Origem = "convenio" | "familiar" | "fornecedor" | "correios" | "outro";
type Categoria = "higiene" | "equipamento" | "material_medico" | "outro";
type TipoPosse = "aluguel" | "emprestimo" | "consignacao" | "proprio_doacao";
type StatusPosse = "em_uso" | "retirado";
type MotivoRetirada = "fim_contrato" | "convenio_solicitou" | "troca_equipamento" | "obito_saida" | "outro";

type Retirada = {
  id: string;
  data_retirada: string;
  retirado_por: string;
  entregue_por_nome: string | null;
  motivo: MotivoRetirada;
  motivo_outro_texto: string | null;
  observacoes: string | null;
};

type ItemDetalhe = {
  id: string;
  recebimento_id: string;
  categoria: Categoria;
  descricao: string;
  quantidade: number;
  numero_serie: string | null;
  tipo_posse: TipoPosse;
  data_prevista_retirada: string | null;
  status_posse: StatusPosse;
  data_retirada: string | null;
  retirada_id: string | null;
  retiradas_itens: Retirada | null;
};

type Registro = {
  id: string;
  residente_id: string;
  data_recebimento: string;
  recebido_por: string;
  origem: Origem;
  nome_convenio: string | null;
  nome_familiar: string | null;
  nome_fornecedor: string | null;
  origem_correios: "governo" | "outros" | null;
  origem_outro_texto: string | null;
  observacoes: string | null;
  residentes: { nome_completo: string } | null;
  recebimentos_itens_detalhe: ItemDetalhe[];
};

const ORIGENS: { v: Origem; label: string }[] = [
  { v: "convenio", label: "Convênio/plano de saúde" },
  { v: "familiar", label: "Trazido por familiar" },
  { v: "fornecedor", label: "Fornecedor/loja" },
  { v: "correios", label: "Correios" },
  { v: "outro", label: "Outro" },
];

const CATEGORIAS: { v: Categoria; label: string }[] = [
  { v: "higiene", label: "Higiene pessoal" },
  { v: "equipamento", label: "Equipamento/Mobilidade" },
  { v: "material_medico", label: "Material médico" },
  { v: "outro", label: "Outro" },
];

const POSSES: { v: TipoPosse; label: string }[] = [
  { v: "aluguel", label: "Aluguel" },
  { v: "emprestimo", label: "Empréstimo" },
  { v: "consignacao", label: "Consignação" },
  { v: "proprio_doacao", label: "Próprio da instituição/Doação" },
];

const MOTIVOS: { v: MotivoRetirada; label: string }[] = [
  { v: "fim_contrato", label: "Fim do contrato/aluguel" },
  { v: "convenio_solicitou", label: "Convênio solicitou devolução" },
  { v: "troca_equipamento", label: "Troca por outro equipamento" },
  { v: "obito_saida", label: "Óbito/saída do residente" },
  { v: "outro", label: "Outro" },
];

const exigeRetirada = (t: TipoPosse) => t !== "proprio_doacao";

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

type ItemForm = {
  key: string;
  categoria: Categoria;
  descricao: string;
  quantidade: string;
  numeroSerie: string;
  tipoPosse: TipoPosse;
  dataPrevista: string;
};

const novoItem = (): ItemForm => ({
  key: crypto.randomUUID(),
  categoria: "higiene",
  descricao: "",
  quantidade: "1",
  numeroSerie: "",
  tipoPosse: "proprio_doacao",
  dataPrevista: "",
});

const dataBR = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR") : "—");

function detalheOrigem(r: Registro) {
  switch (r.origem) {
    case "convenio":
      return `Convênio: ${r.nome_convenio ?? "—"}`;
    case "familiar":
      return `Familiar: ${r.nome_familiar ?? "—"}`;
    case "fornecedor":
      return `Fornecedor: ${r.nome_fornecedor ?? "—"}`;
    case "correios":
      return `Correios: ${r.origem_correios === "governo" ? "Governo" : "Outros"}`;
    default:
      return r.origem_outro_texto ?? "Outro";
  }
}

function RecebimentoItensPage() {
  const qc = useQueryClient();
  const { data: perfil } = usePerfilAtual();

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
    queryKey: ["recebimentos-itens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recebimentos_itens" as never)
        .select("*, residentes(nome_completo), recebimentos_itens_detalhe(*, retiradas_itens(*))")
        .order("data_recebimento", { ascending: false })
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Registro[];
    },
  });

  const [aba, setAba] = useState<"recebimento" | "retirada">("recebimento");

  // ---- formulário de recebimento ----
  const [residenteId, setResidenteId] = useState("");
  const [dataRecebimento, setDataRecebimento] = useState(hoje());
  const [recebidoPor, setRecebidoPor] = useState("");
  const [origem, setOrigem] = useState<Origem>("convenio");
  const [nomeConvenio, setNomeConvenio] = useState("");
  const [nomeFamiliar, setNomeFamiliar] = useState("");
  const [nomeFornecedor, setNomeFornecedor] = useState("");
  const [origemCorreios, setOrigemCorreios] = useState<"governo" | "outros">("governo");
  const [origemOutro, setOrigemOutro] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<ItemForm[]>([novoItem()]);

  const atualizarItem = (key: string, patch: Partial<ItemForm>) =>
    setItens((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const limpar = () => {
    setResidenteId("");
    setDataRecebimento(hoje());
    setRecebidoPor("");
    setOrigem("convenio");
    setNomeConvenio("");
    setNomeFamiliar("");
    setNomeFornecedor("");
    setOrigemCorreios("governo");
    setOrigemOutro("");
    setObservacoes("");
    setItens([novoItem()]);
  };

  const criar = useMutation({
    mutationFn: async () => {
      if (!residenteId) throw new Error("Selecione o residente");
      if (!recebidoPor.trim()) throw new Error("Informe quem recebeu a entrega");
      if (origem === "convenio" && !nomeConvenio.trim()) throw new Error("Informe o nome do convênio");
      if (origem === "familiar" && !nomeFamiliar.trim()) throw new Error("Informe o nome do familiar");
      if (origem === "fornecedor" && !nomeFornecedor.trim()) throw new Error("Informe o nome do fornecedor");
      if (origem === "outro" && !origemOutro.trim()) throw new Error("Descreva a origem da entrega");
      const validos = itens.filter((i) => i.descricao.trim());
      if (validos.length === 0) throw new Error("Adicione ao menos um item com descrição");

      const { data: user } = await supabase.auth.getUser();
      const { data: cab, error } = await supabase
        .from("recebimentos_itens" as never)
        .insert({
          residente_id: residenteId,
          data_recebimento: dataRecebimento,
          recebido_por: recebidoPor.trim(),
          registrado_por: user.user?.id ?? null,
          origem,
          nome_convenio: origem === "convenio" ? nomeConvenio.trim() : null,
          nome_familiar: origem === "familiar" ? nomeFamiliar.trim() : null,
          nome_fornecedor: origem === "fornecedor" ? nomeFornecedor.trim() : null,
          origem_correios: origem === "correios" ? origemCorreios : null,
          origem_outro_texto: origem === "outro" ? origemOutro.trim() : null,
          observacoes: observacoes.trim() || null,
        } as never)
        .select("id")
        .single();
      if (error) throw error;

      const recebimentoId = (cab as unknown as { id: string }).id;
      const { error: e2 } = await supabase.from("recebimentos_itens_detalhe" as never).insert(
        validos.map((i) => ({
          recebimento_id: recebimentoId,
          categoria: i.categoria,
          descricao: i.descricao.trim(),
          quantidade: Number(i.quantidade) || 1,
          numero_serie: i.numeroSerie.trim() || null,
          tipo_posse: i.tipoPosse,
          data_prevista_retirada: exigeRetirada(i.tipoPosse) ? i.dataPrevista || null : null,
          status_posse: "em_uso",
        })) as never,
      );
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recebimentos-itens"] });
      limpar();
      toast.success("Recebimento registrado");
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível registrar"),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recebimentos_itens" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recebimentos-itens"] });
      toast.success("Registro excluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ---- itens em aberto ----
  const emAberto = useMemo(() => {
    const lista: { item: ItemDetalhe; registro: Registro }[] = [];
    for (const r of registros.data ?? []) {
      for (const i of r.recebimentos_itens_detalhe ?? []) {
        if (exigeRetirada(i.tipo_posse) && i.status_posse === "em_uso") lista.push({ item: i, registro: r });
      }
    }
    return lista.sort((a, b) =>
      (a.item.data_prevista_retirada ?? "9999").localeCompare(b.item.data_prevista_retirada ?? "9999"),
    );
  }, [registros.data]);

  const vencido = (i: ItemDetalhe) =>
    !!i.data_prevista_retirada && i.status_posse === "em_uso" && i.data_prevista_retirada < hoje();

  // ---- formulário de retirada ----
  const [selecionados, setSelecionados] = useState<Record<string, boolean>>({});
  const [buscaRetirada, setBuscaRetirada] = useState("");
  const [fResRetirada, setFResRetirada] = useState("todos");
  const [dataRetirada, setDataRetirada] = useState(hoje());
  const [retiradoPor, setRetiradoPor] = useState("");
  const [motivo, setMotivo] = useState<MotivoRetirada>("fim_contrato");
  const [motivoOutro, setMotivoOutro] = useState("");
  const [obsRetirada, setObsRetirada] = useState("");

  const candidatos = useMemo(() => {
    const termo = buscaRetirada.trim().toLowerCase();
    return emAberto.filter(({ item, registro }) => {
      if (fResRetirada !== "todos" && registro.residente_id !== fResRetirada) return false;
      if (termo && !item.descricao.toLowerCase().includes(termo)) return false;
      return true;
    });
  }, [emAberto, buscaRetirada, fResRetirada]);

  const totalSelecionados = Object.values(selecionados).filter(Boolean).length;

  const registrarRetirada = useMutation({
    mutationFn: async () => {
      const ids = Object.entries(selecionados).filter(([, v]) => v).map(([k]) => k);
      if (ids.length === 0) throw new Error("Selecione ao menos um item");
      if (!retiradoPor.trim()) throw new Error("Informe quem retirou o item");
      if (motivo === "outro" && !motivoOutro.trim()) throw new Error("Descreva o motivo da retirada");

      const { data: user } = await supabase.auth.getUser();
      const { data: ret, error } = await supabase
        .from("retiradas_itens" as never)
        .insert({
          data_retirada: dataRetirada,
          retirado_por: retiradoPor.trim(),
          entregue_por: user.user?.id ?? null,
          entregue_por_nome: perfil?.fullName ?? user.user?.email ?? null,
          motivo,
          motivo_outro_texto: motivo === "outro" ? motivoOutro.trim() : null,
          observacoes: obsRetirada.trim() || null,
        } as never)
        .select("id")
        .single();
      if (error) throw error;
      const retiradaId = (ret as unknown as { id: string }).id;

      const { error: e2 } = await supabase
        .from("recebimentos_itens_detalhe" as never)
        .update({ status_posse: "retirado", data_retirada: dataRetirada, retirada_id: retiradaId } as never)
        .in("id", ids);
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recebimentos-itens"] });
      setSelecionados({});
      setRetiradoPor("");
      setMotivo("fim_contrato");
      setMotivoOutro("");
      setObsRetirada("");
      setDataRetirada(hoje());
      toast.success("Retirada registrada");
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível registrar a retirada"),
  });

  // ---- filtros do histórico ----
  const [fResidente, setFResidente] = useState("todos");
  const [fDe, setFDe] = useState("");
  const [fAte, setFAte] = useState("");
  const [fCategoria, setFCategoria] = useState("todas");
  const [fOrigem, setFOrigem] = useState("todas");
  const [fPosse, setFPosse] = useState("todas");
  const [fStatus, setFStatus] = useState("todos");

  const filtrados = useMemo(() => {
    return (registros.data ?? []).filter((r) => {
      if (fResidente !== "todos" && r.residente_id !== fResidente) return false;
      if (fDe && r.data_recebimento < fDe) return false;
      if (fAte && r.data_recebimento > fAte) return false;
      if (fOrigem !== "todas" && r.origem !== fOrigem) return false;
      const itensR = r.recebimentos_itens_detalhe ?? [];
      if (fCategoria !== "todas" && !itensR.some((i) => i.categoria === fCategoria)) return false;
      if (fPosse !== "todas" && !itensR.some((i) => i.tipo_posse === fPosse)) return false;
      if (fStatus === "em_uso" && !itensR.some((i) => exigeRetirada(i.tipo_posse) && i.status_posse === "em_uso"))
        return false;
      if (fStatus === "retirado" && !itensR.some((i) => i.status_posse === "retirado")) return false;
      return true;
    });
  }, [registros.data, fResidente, fDe, fAte, fCategoria, fOrigem, fPosse, fStatus]);

  const [expandido, setExpandido] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-8">
      {/* Painel de itens em aberto */}
      {emAberto.length > 0 && (
        <section className="bg-surface border border-border rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <PackageCheck className="size-5" />
              <h2 className="font-extrabold text-lg">Itens em aberto na ILPI ({emAberto.length})</h2>
            </div>
            <Button size="sm" className="gap-2" onClick={() => setAba("retirada")}>
              <Truck className="size-4" /> Registrar retirada
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {emAberto.map(({ item, registro }) => (
              <div
                key={item.id}
                className={cn(
                  "border rounded-md p-3 space-y-1",
                  vencido(item) ? "border-primary bg-primary/5" : "border-border",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-sm">{item.descricao}</p>
                  {vencido(item) && <AlertTriangle className="size-4 text-primary shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground">{registro.residentes?.nome_completo ?? "—"}</p>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {POSSES.find((p) => p.v === item.tipo_posse)?.label}
                </p>
                {item.numero_serie && (
                  <p className="text-[11px] font-mono text-muted-foreground">Série: {item.numero_serie}</p>
                )}
                <p className={cn("text-[11px] font-bold", vencido(item) && "text-primary")}>
                  Retirada prevista: {dataBR(item.data_prevista_retirada)}
                  {vencido(item) && " — vencida"}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Sub-abas */}
      <div className="flex gap-2">
        <Chip active={aba === "recebimento"} onClick={() => setAba("recebimento")}>Registrar recebimento</Chip>
        <Chip active={aba === "retirada"} onClick={() => setAba("retirada")}>Registrar retirada</Chip>
      </div>

      {aba === "recebimento" && (
        <section className="bg-surface border border-border rounded-lg p-6 space-y-6">
          <div className="flex items-center gap-2">
            <Boxes className="size-5" />
            <h2 className="font-extrabold text-lg">Registrar recebimento</h2>
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
              <Label htmlFor="data-receb">Data do recebimento</Label>
              <Input id="data-receb" type="date" value={dataRecebimento} onChange={(e) => setDataRecebimento(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="receb-por">Recebido por</Label>
              <Input
                id="receb-por"
                value={recebidoPor}
                onChange={(e) => setRecebidoPor(e.target.value)}
                placeholder="Nome de quem recebeu"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Origem / entregue por</Label>
            <div className="flex flex-wrap gap-2">
              {ORIGENS.map((o) => (
                <Chip key={o.v} active={origem === o.v} onClick={() => setOrigem(o.v)}>{o.label}</Chip>
              ))}
            </div>
            {origem === "convenio" && (
              <div className="space-y-1.5 pt-2 max-w-md">
                <Label htmlFor="nome-convenio">Nome do convênio</Label>
                <Input id="nome-convenio" value={nomeConvenio} onChange={(e) => setNomeConvenio(e.target.value)} />
              </div>
            )}
            {origem === "familiar" && (
              <div className="space-y-1.5 pt-2 max-w-md">
                <Label htmlFor="nome-familiar">Nome do familiar</Label>
                <Input id="nome-familiar" value={nomeFamiliar} onChange={(e) => setNomeFamiliar(e.target.value)} />
              </div>
            )}
            {origem === "fornecedor" && (
              <div className="space-y-1.5 pt-2 max-w-md">
                <Label htmlFor="nome-fornecedor">Nome do fornecedor</Label>
                <Input id="nome-fornecedor" value={nomeFornecedor} onChange={(e) => setNomeFornecedor(e.target.value)} />
              </div>
            )}
            {origem === "correios" && (
              <div className="space-y-2 pt-2">
                <Label>Origem</Label>
                <div className="flex gap-2">
                  <Chip active={origemCorreios === "governo"} onClick={() => setOrigemCorreios("governo")}>Governo</Chip>
                  <Chip active={origemCorreios === "outros"} onClick={() => setOrigemCorreios("outros")}>Outros</Chip>
                </div>
              </div>
            )}
            {origem === "outro" && (
              <div className="space-y-1.5 pt-2 max-w-md">
                <Label htmlFor="origem-outro">Descreva a origem</Label>
                <Input id="origem-outro" value={origemOutro} onChange={(e) => setOrigemOutro(e.target.value)} />
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-muted-foreground">Itens recebidos</h3>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setItens((p) => [...p, novoItem()])}>
                <Plus className="size-4" /> Adicionar item
              </Button>
            </div>

            {itens.map((item, idx) => (
              <div key={item.key} className="border border-border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                    Item {idx + 1}
                  </span>
                  {itens.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setItens((p) => p.filter((i) => i.key !== item.key))}
                      className="text-muted-foreground hover:text-primary p-1"
                      title="Remover item"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIAS.map((c) => (
                      <Chip
                        key={c.v}
                        active={item.categoria === c.v}
                        onClick={() => atualizarItem(item.key, { categoria: c.v })}
                      >
                        {c.label}
                      </Chip>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-1.5 md:col-span-2">
                    <Label>Descrição do item</Label>
                    <Input
                      value={item.descricao}
                      onChange={(e) => atualizarItem(item.key, { descricao: e.target.value })}
                      placeholder="Ex.: Cadeira de rodas dobrável"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Quantidade</Label>
                    <Input
                      type="number"
                      min={1}
                      value={item.quantidade}
                      onChange={(e) => atualizarItem(item.key, { quantidade: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nº de série / identificação</Label>
                    <Input
                      value={item.numeroSerie}
                      onChange={(e) => atualizarItem(item.key, { numeroSerie: e.target.value })}
                      placeholder="Opcional"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Tipo de posse</Label>
                  <div className="flex flex-wrap gap-2">
                    {POSSES.map((p) => (
                      <Chip
                        key={p.v}
                        active={item.tipoPosse === p.v}
                        onClick={() => atualizarItem(item.key, { tipoPosse: p.v })}
                      >
                        {p.label}
                      </Chip>
                    ))}
                  </div>
                  {exigeRetirada(item.tipoPosse) ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      <div className="space-y-1.5">
                        <Label>Data prevista de retirada (opcional)</Label>
                        <Input
                          type="date"
                          value={item.dataPrevista}
                          onChange={(e) => atualizarItem(item.key, { dataPrevista: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Status do item</Label>
                        <p className="text-sm font-bold pt-2">
                          Em uso{" "}
                          <span className="font-normal text-xs text-muted-foreground">
                            (atualizado pelo registro de retirada)
                          </span>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground pt-1">
                      Item permanece definitivamente na ILPI — sem controle de retirada.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obs-itens">Observações</Label>
            <TextareaDitavel
              id="obs-itens"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex.: equipamento com pequena avaria, entrega parcial…"
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={() => criar.mutate()} disabled={criar.isPending} className="gap-2">
              <Plus className="size-4" />
              Registrar recebimento
            </Button>
          </div>
        </section>
      )}

      {aba === "retirada" && (
        <section className="bg-surface border border-border rounded-lg p-6 space-y-6">
          <div className="flex items-center gap-2">
            <Truck className="size-5" />
            <h2 className="font-extrabold text-lg">Registrar retirada de item</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Filtrar por residente</Label>
              <Select value={fResRetirada} onValueChange={setFResRetirada}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {residentes.data?.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome_completo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="busca-item">Buscar item</Label>
              <Input
                id="busca-item"
                value={buscaRetirada}
                onChange={(e) => setBuscaRetirada(e.target.value)}
                placeholder="Ex.: cilindro de oxigênio"
              />
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-muted-foreground">
              Itens disponíveis para retirada ({totalSelecionados} selecionado{totalSelecionados === 1 ? "" : "s"})
            </h3>
            {candidatos.length === 0 ? (
              <p className="border border-border rounded-md px-4 py-8 text-center text-sm text-muted-foreground">
                Nenhum item em aluguel, empréstimo ou consignação em aberto.
              </p>
            ) : (
              <div className="space-y-2">
                {candidatos.map(({ item, registro }) => (
                  <label
                    key={item.id}
                    className={cn(
                      "flex items-start gap-3 border rounded-md p-3 cursor-pointer",
                      selecionados[item.id] ? "border-foreground bg-foreground/5" : "border-border",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={!!selecionados[item.id]}
                      onChange={(e) => setSelecionados((p) => ({ ...p, [item.id]: e.target.checked }))}
                    />
                    <div className="min-w-0">
                      <p className="font-bold text-sm">{item.descricao}</p>
                      <p className="text-xs text-muted-foreground">
                        {registro.residentes?.nome_completo ?? "—"} •{" "}
                        {POSSES.find((p) => p.v === item.tipo_posse)?.label} • Recebido em{" "}
                        {dataBR(registro.data_recebimento)}
                        {item.numero_serie && ` • Série ${item.numero_serie}`}
                      </p>
                      <p className={cn("text-[11px]", vencido(item) ? "text-primary font-bold" : "text-muted-foreground")}>
                        Retirada prevista: {dataBR(item.data_prevista_retirada)}
                        {vencido(item) && " — vencida"}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="data-retirada">Data da retirada</Label>
              <Input id="data-retirada" type="date" value={dataRetirada} onChange={(e) => setDataRetirada(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="retirado-por">Retirado por</Label>
              <Input
                id="retirado-por"
                value={retiradoPor}
                onChange={(e) => setRetiradoPor(e.target.value)}
                placeholder="Pessoa/empresa que veio buscar"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Entregue por</Label>
              <Input value={perfil?.fullName ?? "Usuário logado"} readOnly className="bg-black/[0.03]" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Motivo da retirada</Label>
            <div className="flex flex-wrap gap-2">
              {MOTIVOS.map((m) => (
                <Chip key={m.v} active={motivo === m.v} onClick={() => setMotivo(m.v)}>{m.label}</Chip>
              ))}
            </div>
            {motivo === "outro" && (
              <div className="space-y-1.5 pt-2 max-w-md">
                <Label htmlFor="motivo-outro">Descreva o motivo</Label>
                <Input id="motivo-outro" value={motivoOutro} onChange={(e) => setMotivoOutro(e.target.value)} />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obs-retirada">Observações</Label>
            <TextareaDitavel
              id="obs-retirada"
              value={obsRetirada}
              onChange={(e) => setObsRetirada(e.target.value)}
              placeholder="Ex.: equipamento retirado com avaria já existente…"
            />
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => registrarRetirada.mutate()}
              disabled={registrarRetirada.isPending || totalSelecionados === 0}
              className="gap-2"
            >
              <Truck className="size-4" />
              Registrar retirada
            </Button>
          </div>
        </section>
      )}

      {/* Histórico */}
      <section className="space-y-4">
        <h2 className="font-extrabold text-lg">Histórico de recebimentos</h2>

        <div className="bg-surface border border-border rounded-lg p-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-3">
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
            <Label className="text-[10px] uppercase">Categoria</Label>
            <Select value={fCategoria} onValueChange={setFCategoria}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {CATEGORIAS.map((c) => <SelectItem key={c.v} value={c.v}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase">Origem</Label>
            <Select value={fOrigem} onValueChange={setFOrigem}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {ORIGENS.map((o) => <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase">Tipo de posse</Label>
            <Select value={fPosse} onValueChange={setFPosse}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todos</SelectItem>
                {POSSES.map((p) => <SelectItem key={p.v} value={p.v}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase">Status</Label>
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="em_uso">Em uso</SelectItem>
                <SelectItem value="retirado">Retirado</SelectItem>
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
            const aberto = !!expandido[r.id];
            const itensR = r.recebimentos_itens_detalhe ?? [];
            return (
              <div key={r.id} className="bg-surface border border-border rounded-lg">
                <div className="flex items-center gap-3 p-4">
                  <button
                    onClick={() => setExpandido((p) => ({ ...p, [r.id]: !aberto }))}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={aberto ? "Recolher" : "Expandir"}
                  >
                    {aberto ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{r.residentes?.nome_completo ?? "—"}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {dataBR(r.data_recebimento)} • {detalheOrigem(r)} • Recebido por {r.recebido_por} •{" "}
                      {itensR.length} {itensR.length === 1 ? "item" : "itens"}
                    </p>
                  </div>
                  {itensR.some((i) => vencido(i)) && (
                    <span className="text-[10px] font-extrabold uppercase text-primary flex items-center gap-1">
                      <AlertTriangle className="size-3" /> Retirada vencida
                    </span>
                  )}
                  <button
                    onClick={() => remover.mutate(r.id)}
                    className="text-muted-foreground hover:text-primary p-1"
                    title="Excluir registro"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>

                {aberto && (
                  <div className="border-t border-border p-4 space-y-3">
                    {r.observacoes && (
                      <p className="text-xs italic text-muted-foreground">Obs.: {r.observacoes}</p>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead className="bg-black/[0.02] border-b border-border">
                          <tr>
                            {["Categoria", "Descrição", "Qtd.", "Nº série", "Posse", "Situação"].map((h) => (
                              <th key={h} className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {itensR.map((i) => {
                            const ret = i.retiradas_itens;
                            return (
                              <tr key={i.id} className={cn("align-top", vencido(i) && "bg-primary/5")}>
                                <td className="px-3 py-2">{CATEGORIAS.find((c) => c.v === i.categoria)?.label}</td>
                                <td className="px-3 py-2 font-medium">{i.descricao}</td>
                                <td className="px-3 py-2 font-mono">{i.quantidade}</td>
                                <td className="px-3 py-2 font-mono text-xs">{i.numero_serie ?? "—"}</td>
                                <td className="px-3 py-2 text-xs">{POSSES.find((p) => p.v === i.tipo_posse)?.label}</td>
                                <td className="px-3 py-2 text-xs">
                                  {!exigeRetirada(i.tipo_posse) ? (
                                    <span className="text-muted-foreground">Permanece na ILPI</span>
                                  ) : i.status_posse === "retirado" ? (
                                    <div className="space-y-0.5">
                                      <p className="font-bold">Retirado em {dataBR(i.data_retirada)}</p>
                                      {ret && (
                                        <>
                                          <p>Retirado por: {ret.retirado_por}</p>
                                          <p>Entregue por: {ret.entregue_por_nome ?? "—"}</p>
                                          <p>
                                            Motivo:{" "}
                                            {ret.motivo === "outro"
                                              ? ret.motivo_outro_texto ?? "Outro"
                                              : MOTIVOS.find((m) => m.v === ret.motivo)?.label}
                                          </p>
                                          {ret.observacoes && (
                                            <p className="italic text-muted-foreground">Obs.: {ret.observacoes}</p>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  ) : (
                                    <span className={cn(vencido(i) && "text-primary font-bold")}>
                                      Em uso • prevista {dataBR(i.data_prevista_retirada)}
                                      {vencido(i) && " (vencida)"}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
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
