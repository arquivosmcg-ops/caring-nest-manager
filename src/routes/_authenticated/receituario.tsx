import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePerfilAtual } from "@/hooks/use-perfil";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  FileSignature,
  Plus,
  Trash2,
  Printer,
  Search,
  History,
  PenLine,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DitarAudio } from "@/components/ditar-audio";
import {
  AssinaturaDialog,
  type CredencialAssinatura,
} from "@/components/assinatura-dialog";
import { hashDocumento, carimbo, linhasAssinatura, CONSELHO_DA_CATEGORIA, type Assinatura } from "@/lib/assinatura";
import {
  FORMAS_FARMACEUTICAS,
  TURNOS_RECEITA,
  VIAS,
  descricaoDuracao,
  descricaoFrequencia,
  itemVazio,
  normalizar,
  type ItemReceita,
  type MedicamentoBase,
} from "@/lib/receituario";

export const Route = createFileRoute("/_authenticated/receituario")({
  head: () => ({
    meta: [
      { title: "Receituário Médico · Residencial São Camilo" },
      {
        name: "description",
        content:
          "Emissão de receituário médico com busca assistida de medicamentos, assinatura digital ICP-Brasil e histórico por residente.",
      },
      { property: "og:title", content: "Receituário Médico · Residencial São Camilo" },
      {
        property: "og:description",
        content: "Receituário digital com busca de medicamentos e assinatura eletrônica do médico.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReceituarioPage,
});

function Chip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all active:scale-95",
        ativo
          ? "bg-primary text-primary-foreground border-primary shadow-sm"
          : "bg-surface text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** Busca assistida (autocomplete) na base local de medicamentos. */
function BuscaMedicamento({
  onSelecionar,
  onCadastroManual,
}: {
  onSelecionar: (m: MedicamentoBase) => void;
  onCadastroManual: (termo: string) => void;
}) {
  const [termo, setTermo] = useState("");
  const [aberto, setAberto] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const busca = useQuery({
    queryKey: ["medicamentos-base", termo],
    enabled: termo.trim().length >= 2,
    queryFn: async () => {
      const t = termo.trim();
      const { data, error } = await supabase
        .from("medicamentos_base")
        .select("*")
        .or(`nome_comercial.ilike.%${t}%,principio_ativo.ilike.%${t}%`)
        .order("nome_comercial")
        .limit(25);
      if (error) throw error;
      return (data ?? []) as MedicamentoBase[];
    },
  });

  const resultados = useMemo(() => {
    const lista = busca.data ?? [];
    const n = normalizar(termo);
    return [...lista].sort((a, b) => {
      const ap = normalizar(a.nome_comercial).startsWith(n) ? 0 : 1;
      const bp = normalizar(b.nome_comercial).startsWith(n) ? 0 : 1;
      return ap - bp || a.nome_comercial.localeCompare(b.nome_comercial);
    });
  }, [busca.data, termo]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={termo}
          onChange={(e) => {
            setTermo(e.target.value);
            setAberto(true);
          }}
          onFocus={() => setAberto(true)}
          onBlur={() => {
            blurTimer.current = setTimeout(() => setAberto(false), 150);
          }}
          placeholder="Buscar medicamento (nome comercial ou princípio ativo)…"
          className="pl-9"
        />
      </div>
      {aberto && termo.trim().length >= 2 && (
        <div className="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto bg-surface border border-border rounded-md shadow-lg">
          {busca.isLoading && (
            <p className="px-3 py-2 text-xs text-muted-foreground">Buscando…</p>
          )}
          {!busca.isLoading && resultados.length === 0 && (
            <div className="p-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                Nenhum medicamento encontrado para “{termo}”.
              </p>
              <Button
                size="sm"
                variant="outline"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onCadastroManual(termo.trim());
                  setTermo("");
                  setAberto(false);
                  if (blurTimer.current) clearTimeout(blurTimer.current);
                }}
              >
                <Plus className="size-3.5 mr-1" /> Cadastrar manualmente
              </Button>
            </div>
          )}
          {resultados.map((m) => (
            <button
              key={m.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelecionar(m);
                setTermo("");
                setAberto(false);
              }}
              className="w-full text-left px-3 py-2 hover:bg-black/[0.04] border-b border-border last:border-0"
            >
              <p className="text-sm font-bold">
                {m.nome_comercial}
                {m.apresentacao ? ` — ${m.apresentacao}` : ""}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {[m.principio_ativo, m.forma_farmaceutica, m.laboratorio, m.embalagem]
                  .filter(Boolean)
                  .join(" • ")}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CadastroManualDialog({
  termo,
  onClose,
  onCriado,
}: {
  termo: string | null;
  onClose: () => void;
  onCriado: (m: MedicamentoBase) => void;
}) {
  const perfil = usePerfilAtual().data;
  const [nome, setNome] = useState("");
  const [ativo, setAtivo] = useState("");
  const [apresentacao, setApresentacao] = useState("");
  const [forma, setForma] = useState("");
  const [lab, setLab] = useState("");
  const [embalagem, setEmbalagem] = useState("");
  const [salvando, setSalvando] = useState(false);

  const aberto = termo !== null;
  useMemo(() => {
    if (termo !== null) {
      setNome(termo);
      setAtivo("");
      setApresentacao("");
      setForma("");
      setLab("");
      setEmbalagem("");
    }
  }, [termo]);

  const salvar = async () => {
    if (!nome.trim()) return toast.error("Informe o nome do medicamento");
    setSalvando(true);
    const { data, error } = await supabase
      .from("medicamentos_base")
      .insert({
        nome_comercial: nome.trim(),
        principio_ativo: ativo.trim() || null,
        apresentacao: apresentacao.trim() || null,
        forma_farmaceutica: forma.trim() || null,
        laboratorio: lab.trim() || null,
        embalagem: embalagem.trim() || null,
        origem: "manual",
        criado_por: perfil?.userId ?? null,
      })
      .select("*")
      .single();
    setSalvando(false);
    if (error) return toast.error(error.message);
    toast.success("Medicamento cadastrado na base da instituição");
    onCriado(data as MedicamentoBase);
    onClose();
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Cadastrar medicamento manualmente</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome comercial *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Princípio ativo</Label>
              <Input value={ativo} onChange={(e) => setAtivo(e.target.value)} />
            </div>
            <div>
              <Label>Apresentação / concentração</Label>
              <Input
                value={apresentacao}
                onChange={(e) => setApresentacao(e.target.value)}
                placeholder="500 mg"
              />
            </div>
            <div>
              <Label>Forma farmacêutica</Label>
              <Input
                list="formas-farmaceuticas"
                value={forma}
                onChange={(e) => setForma(e.target.value)}
                placeholder="Comprimido"
              />
            </div>
            <div>
              <Label>Laboratório</Label>
              <Input value={lab} onChange={(e) => setLab(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Embalagem</Label>
            <Input
              value={embalagem}
              onChange={(e) => setEmbalagem(e.target.value)}
              placeholder="Caixa com 30 comprimidos"
            />
          </div>
          <Button onClick={salvar} disabled={salvando} className="w-full">
            Salvar e usar na receita
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReceituarioPage() {
  const perfil = usePerfilAtual().data;
  const queryClient = useQueryClient();
  const hoje = new Date().toISOString().slice(0, 10);

  const [residenteId, setResidenteId] = useState<string | null>(null);
  const [buscaResidente, setBuscaResidente] = useState("");
  const [dataEmissao, setDataEmissao] = useState(hoje);
  const [itens, setItens] = useState<ItemReceita[]>([itemVazio()]);
  const [observacoes, setObservacoes] = useState("");
  const [assinaturaAberta, setAssinaturaAberta] = useState(false);
  const [cadastroManual, setCadastroManual] = useState<string | null>(null);
  const [itemDestino, setItemDestino] = useState<string | null>(null);
  const [verReceita, setVerReceita] = useState<any | null>(null);
  const [filtroData, setFiltroData] = useState("");
  const [filtroMed, setFiltroMed] = useState("");

  const residentes = useQuery({
    queryKey: ["residentes-receituario"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("residentes")
        .select("id, nome_completo, data_nascimento, alergias, quartos(numero)")
        .eq("ativo", true)
        .order("nome_completo");
      if (error) throw error;
      return data ?? [];
    },
  });

  const residente = residentes.data?.find((r) => r.id === residenteId) ?? null;
  const listaResidentes = (residentes.data ?? []).filter((r) =>
    normalizar(r.nome_completo).includes(normalizar(buscaResidente)),
  );

  const historico = useQuery({
    queryKey: ["receituarios", residenteId],
    enabled: !!residenteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receituarios")
        .select("*, receituario_itens(*)")
        .eq("residente_id", residenteId!)
        .order("data_emissao", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const assinaturas = useQuery({
    queryKey: ["assinaturas-receituario", residenteId, historico.data?.length],
    enabled: !!residenteId && !!historico.data?.length,
    queryFn: async () => {
      const ids = (historico.data ?? []).map((r: any) => r.id);
      const { data, error } = await supabase
        .from("assinaturas")
        .select("*")
        .eq("documento_tipo", "receituario")
        .in("documento_id", ids);
      if (error) throw error;
      return (data ?? []) as unknown as Assinatura[];
    },
  });

  const assinaturaDe = (id: string) =>
    (assinaturas.data ?? []).find((a) => a.documento_id === id) ?? null;

  const historicoFiltrado = (historico.data ?? []).filter((r: any) => {
    if (filtroData && r.data_emissao !== filtroData) return false;
    if (filtroMed) {
      const alvo = normalizar(filtroMed);
      const bate = (r.receituario_itens ?? []).some(
        (i: any) =>
          normalizar(i.nome_medicamento ?? "").includes(alvo) ||
          normalizar(i.principio_ativo ?? "").includes(alvo),
      );
      if (!bate) return false;
    }
    return true;
  });

  const atualizarItem = (uid: string, patch: Partial<ItemReceita>) =>
    setItens((prev) => prev.map((i) => (i.uid === uid ? { ...i, ...patch } : i)));

  const aplicarBase = (uid: string, m: MedicamentoBase) =>
    atualizarItem(uid, {
      nome_medicamento: m.nome_comercial,
      principio_ativo: m.principio_ativo ?? "",
      apresentacao: m.apresentacao ?? "",
      forma_farmaceutica: m.forma_farmaceutica ?? "",
      laboratorio: m.laboratorio ?? "",
      quantidade_dispensar: m.embalagem ?? "",
    });

  const conselhoMedico = perfil?.registroProfissional
    ? `${CONSELHO_DA_CATEGORIA[perfil.categoriaAssinatura ?? ""] ?? "Registro"} ${perfil.registroProfissional}${perfil.conselhoUf ? `/${perfil.conselhoUf}` : ""}`
    : "conselho não informado";

  const gerar = useMutation({
    mutationFn: async (cred: CredencialAssinatura) => {
      const validos = itens.filter((i) => i.nome_medicamento.trim());
      const { data: rec, error } = await supabase
        .from("receituarios")
        .insert({
          residente_id: residenteId!,
          medico_id: perfil!.userId,
          medico_nome: perfil!.fullName,
          medico_conselho: perfil!.registroProfissional,
          medico_uf: perfil!.conselhoUf,
          data_emissao: dataEmissao,
          status: "assinado",
          observacoes: observacoes.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      const receituarioId = (rec as { id: string }).id;

      const { error: erroItens } = await supabase.from("receituario_itens").insert(
        validos.map((i, idx) => ({
          receituario_id: receituarioId,
          ordem: idx + 1,
          nome_medicamento: i.nome_medicamento.trim(),
          principio_ativo: i.principio_ativo.trim() || null,
          apresentacao: i.apresentacao.trim() || null,
          forma_farmaceutica: i.forma_farmaceutica.trim() || null,
          laboratorio: i.laboratorio.trim() || null,
          posologia: i.posologia.trim() || null,
          via: i.via || null,
          turnos: i.se_necessario ? [] : i.turnos,
          se_necessario: i.se_necessario,
          duracao_tipo: i.duracao_tipo,
          data_inicio: i.duracao_tipo === "determinado" ? (i.data_inicio ?? dataEmissao) : null,
          numero_dias: i.duracao_tipo === "determinado" ? i.numero_dias : null,
          quantidade_dispensar: i.quantidade_dispensar.trim() || null,
          orientacoes: i.orientacoes.trim() || null,
        })),
      );
      if (erroItens) throw erroItens;

      const hash = await hashDocumento({
        residente_id: residenteId,
        data_emissao: dataEmissao,
        medico: perfil!.fullName,
        itens: validos.map((i) => ({
          nome: i.nome_medicamento,
          apresentacao: i.apresentacao,
          posologia: i.posologia,
          via: i.via,
          turnos: i.turnos,
          se_necessario: i.se_necessario,
          duracao_tipo: i.duracao_tipo,
          numero_dias: i.numero_dias,
        })),
        observacoes,
      });
      const evidencia = cred.assinarCertificado ? await cred.assinarCertificado(hash) : undefined;
      const { error: erroAss } = await supabase.rpc("registrar_assinatura", {
        _documento_tipo: "receituario",
        _documento_id: receituarioId,
        _hash: hash,
        _pin: cred.pin ?? undefined,
        _documento_ref: { residente_id: residenteId, data_emissao: dataEmissao } as never,
        _metodo: cred.metodo,
        _certificado: (evidencia ?? undefined) as never,
      } as never);
      if (erroAss) throw erroAss;
    },
    onSuccess: () => {
      toast.success("Receituário assinado e registrado");
      setItens([itemVazio()]);
      setObservacoes("");
      queryClient.invalidateQueries({ queryKey: ["receituarios", residenteId] });
      queryClient.invalidateQueries({ queryKey: ["assinaturas-receituario"] });
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível gerar o receituário"),
  });

  const abrirAssinatura = () => {
    if (!residenteId) return toast.error("Selecione a residente");
    if (!perfil) return toast.error("Médico responsável não identificado");
    if (!itens.some((i) => i.nome_medicamento.trim()))
      return toast.error("Adicione ao menos um medicamento");
    setAssinaturaAberta(true);
  };

  const imprimir = (r: any) => {
    const a = assinaturaDe(r.id);
    const esc = (v: unknown) => String(v ?? "").replace(/[<>&]/g, (c) => `&#${c.charCodeAt(0)};`);
    const nasc = residente?.data_nascimento
      ? residente.data_nascimento.split("-").reverse().join("/")
      : "—";
    const itensHtml = (r.receituario_itens ?? [])
      .slice()
      .sort((x: any, y: any) => (x.ordem ?? 0) - (y.ordem ?? 0))
      .map(
        (i: any, idx: number) => `
        <div class="item">
          <p class="nome">${idx + 1}. ${esc(i.nome_medicamento)}${i.apresentacao ? ` — ${esc(i.apresentacao)}` : ""}${
            i.forma_farmaceutica ? ` (${esc(i.forma_farmaceutica)})` : ""
          }</p>
          ${i.principio_ativo ? `<p class="sub">Princípio ativo: ${esc(i.principio_ativo)}${i.laboratorio ? ` — Lab.: ${esc(i.laboratorio)}` : ""}</p>` : ""}
          <p>${esc(i.posologia)}${i.via ? ` — via ${esc(i.via)}` : ""} — ${esc(
            descricaoFrequencia({ turnos: i.turnos ?? [], se_necessario: !!i.se_necessario }),
          )} — ${esc(descricaoDuracao(i))}</p>
          ${i.quantidade_dispensar ? `<p class="sub">Quantidade a dispensar: ${esc(i.quantidade_dispensar)}</p>` : ""}
          ${i.orientacoes ? `<p class="sub">Orientações: ${esc(i.orientacoes)}</p>` : ""}
        </div>`,
      )
      .join("");
    const rodape = a
      ? `<div class="ass">${linhasAssinatura(a as never)
          .map((l, i) => `<p>${i === 0 ? `<b>${esc(l)}</b>` : esc(l)}</p>`)
          .join("")}</div>`
      : `<div class="ass"><p>Receituário sem assinatura eletrônica registrada.</p>
         <p style="margin-top:26px">_______________________________________</p>
         <p><b>${esc(r.medico_nome)}</b> — ${esc(r.medico_conselho ?? "")}${r.medico_uf ? `/${esc(r.medico_uf)}` : ""}</p></div>`;
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
<title>Receituário — ${esc(residente?.nome_completo)}</title>
<style>
  @page { size: A4; margin: 15mm; }
  body { font-family: Arial, sans-serif; color:#111; font-size:11pt; }
  h1 { font-size:15pt; text-transform:uppercase; margin:0; text-align:center; }
  .cab { text-align:center; border-bottom:2px solid #111; padding-bottom:6px; margin-bottom:10px; }
  .dados { border:1px solid #999; padding:8px; margin-bottom:12px; font-size:10pt; }
  .item { border-bottom:1px dashed #999; padding:8px 0; }
  .nome { font-weight:bold; font-size:11.5pt; margin:0 0 2px; }
  .sub { color:#444; font-size:9.5pt; margin:1px 0; }
  .ass { margin-top:26px; border-top:1px solid #111; padding-top:8px; font-size:9pt; text-align:center; }
  p { margin:2px 0; }
</style></head><body>
<div class="cab">
  <h1>Receituário Médico</h1>
  <p>Residencial São Camilo — Instituição de Longa Permanência para Idosos</p>
</div>
<div class="dados">
  <p><b>Residente:</b> ${esc(residente?.nome_completo)} &nbsp;•&nbsp; <b>Nascimento:</b> ${nasc} &nbsp;•&nbsp; <b>Quarto:</b> ${esc(
    (residente as any)?.quartos?.numero ?? "—",
  )}</p>
  <p><b>Alergias:</b> ${esc(residente?.alergias || "não informadas")}</p>
  <p><b>Médico responsável:</b> ${esc(r.medico_nome)} — ${esc(r.medico_conselho ?? "")}${r.medico_uf ? `/${esc(r.medico_uf)}` : ""}</p>
  <p><b>Data de emissão:</b> ${String(r.data_emissao).split("-").reverse().join("/")}</p>
</div>
${itensHtml}
${r.observacoes ? `<div class="dados" style="margin-top:12px"><b>Observações:</b> ${esc(r.observacoes)}</div>` : ""}
${rodape}
<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),300));</script>
</body></html>`;
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) return toast.error("Bloqueador de pop-ups impediu a impressão");
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="grid lg:grid-cols-[260px_1fr] gap-6 pb-24">
      <datalist id="formas-farmaceuticas">
        {FORMAS_FARMACEUTICAS.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>

      <aside className="bg-surface border border-border rounded-lg p-3 h-fit max-h-[70vh] overflow-y-auto">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 pb-2">
          Residentes
        </p>
        <Input
          value={buscaResidente}
          onChange={(e) => setBuscaResidente(e.target.value)}
          placeholder="Buscar…"
          className="mb-2 h-8 text-sm"
        />
        {listaResidentes.map((res) => (
          <button
            key={res.id}
            onClick={() => setResidenteId(res.id)}
            className={cn(
              "w-full text-left px-2 py-2 rounded-md text-sm transition-colors truncate",
              residenteId === res.id ? "bg-foreground text-background font-bold" : "hover:bg-black/5",
            )}
          >
            {res.nome_completo}
          </button>
        ))}
      </aside>

      <div className="space-y-4 min-w-0">
        <div className="flex items-center gap-2">
          <FileSignature className="size-5" />
          <h1 className="text-xl font-extrabold tracking-tight">Receituário Médico</h1>
        </div>

        {!residenteId ? (
          <div className="bg-surface border border-border rounded-lg p-10 text-center text-sm text-muted-foreground">
            Selecione uma residente para emitir o receituário.
          </div>
        ) : (
          <>
            {/* 1. Cabeçalho do receituário */}
            <div className="bg-surface border border-border rounded-lg p-4 grid sm:grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                  Residente
                </p>
                <p className="font-bold truncate">{residente?.nome_completo}</p>
                <p className="text-xs text-muted-foreground">
                  Quarto {(residente as any)?.quartos?.numero ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                  Médico responsável
                </p>
                <p className="font-bold truncate">{perfil?.fullName ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{conselhoMedico}</p>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                  Data de emissão
                </Label>
                <Input
                  type="date"
                  value={dataEmissao}
                  onChange={(e) => setDataEmissao(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-[11px] text-muted-foreground">
              <Info className="size-3.5 mt-0.5 shrink-0" />
              <p>
                A busca de medicamentos é um recurso de <b>preenchimento assistido</b> (base local da
                instituição, ampliável por cadastro manual). Não substitui a avaliação clínica: confira
                nome, apresentação, concentração e posologia antes de emitir a receita.
              </p>
            </div>

            {/* 2 e 3. Itens da receita */}
            {itens.map((item, idx) => (
              <div key={item.uid} className="bg-surface border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm">Medicamento {idx + 1}</p>
                  {itens.length > 1 && (
                    <button
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setItens((prev) => prev.filter((i) => i.uid !== item.uid))}
                      title="Remover medicamento"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>

                <BuscaMedicamento
                  onSelecionar={(m) => aplicarBase(item.uid, m)}
                  onCadastroManual={(t) => {
                    setItemDestino(item.uid);
                    setCadastroManual(t);
                  }}
                />

                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <Label>Nome do medicamento *</Label>
                    <Input
                      value={item.nome_medicamento}
                      onChange={(e) => atualizarItem(item.uid, { nome_medicamento: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Princípio ativo</Label>
                    <Input
                      value={item.principio_ativo}
                      onChange={(e) => atualizarItem(item.uid, { principio_ativo: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Apresentação / concentração</Label>
                    <Input
                      value={item.apresentacao}
                      onChange={(e) => atualizarItem(item.uid, { apresentacao: e.target.value })}
                      placeholder="500 mg"
                    />
                  </div>
                  <div>
                    <Label>Forma farmacêutica</Label>
                    <Input
                      list="formas-farmaceuticas"
                      value={item.forma_farmaceutica}
                      onChange={(e) =>
                        atualizarItem(item.uid, { forma_farmaceutica: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Laboratório</Label>
                    <Input
                      value={item.laboratorio}
                      onChange={(e) => atualizarItem(item.uid, { laboratorio: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Posologia</Label>
                    <Input
                      value={item.posologia}
                      onChange={(e) => atualizarItem(item.uid, { posologia: e.target.value })}
                      placeholder="1 comprimido"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                    Via de administração
                  </Label>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {VIAS.map((v) => (
                      <Chip
                        key={v}
                        ativo={item.via === v}
                        onClick={() => atualizarItem(item.uid, { via: item.via === v ? "" : v })}
                      >
                        {v}
                      </Chip>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                    Frequência
                  </Label>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {TURNOS_RECEITA.map((t) => (
                      <Chip
                        key={t.key}
                        ativo={!item.se_necessario && item.turnos.includes(t.key)}
                        onClick={() =>
                          atualizarItem(item.uid, {
                            se_necessario: false,
                            turnos: item.turnos.includes(t.key)
                              ? item.turnos.filter((x) => x !== t.key)
                              : [...item.turnos, t.key],
                          })
                        }
                      >
                        {t.label} ({t.sigla})
                      </Chip>
                    ))}
                    <Chip
                      ativo={item.se_necessario}
                      onClick={() =>
                        atualizarItem(item.uid, {
                          se_necessario: !item.se_necessario,
                          turnos: [],
                        })
                      }
                    >
                      Se necessário (SN)
                    </Chip>
                  </div>
                </div>

                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                      Duração do tratamento
                    </Label>
                    <div className="flex gap-1.5 mt-1.5">
                      <Chip
                        ativo={item.duracao_tipo === "continuo"}
                        onClick={() =>
                          atualizarItem(item.uid, {
                            duracao_tipo: "continuo",
                            numero_dias: null,
                            data_inicio: null,
                          })
                        }
                      >
                        Uso contínuo
                      </Chip>
                      <Chip
                        ativo={item.duracao_tipo === "determinado"}
                        onClick={() =>
                          atualizarItem(item.uid, {
                            duracao_tipo: "determinado",
                            data_inicio: item.data_inicio ?? dataEmissao,
                            numero_dias: item.numero_dias ?? 7,
                          })
                        }
                      >
                        Por tempo determinado
                      </Chip>
                    </div>
                  </div>
                  {item.duracao_tipo === "determinado" && (
                    <>
                      <div>
                        <Label>Início</Label>
                        <Input
                          type="date"
                          value={item.data_inicio ?? dataEmissao}
                          onChange={(e) => atualizarItem(item.uid, { data_inicio: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Quantidade de dias</Label>
                        <Input
                          type="number"
                          min={1}
                          className="w-32"
                          value={item.numero_dias ?? ""}
                          onChange={(e) =>
                            atualizarItem(item.uid, {
                              numero_dias: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <Label>Quantidade a dispensar</Label>
                    <Input
                      value={item.quantidade_dispensar}
                      onChange={(e) =>
                        atualizarItem(item.uid, { quantidade_dispensar: e.target.value })
                      }
                      placeholder="1 caixa com 30 comprimidos"
                    />
                  </div>
                  <div>
                    <Label>Orientações adicionais</Label>
                    <div className="flex items-start gap-2">
                      <textarea
                        rows={2}
                        value={item.orientacoes}
                        onChange={(e) => atualizarItem(item.uid, { orientacoes: e.target.value })}
                        placeholder="Tomar após as refeições"
                        className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background"
                      />
                      <DitarAudio
                        onTexto={(t) =>
                          atualizarItem(item.uid, {
                            orientacoes: item.orientacoes ? `${item.orientacoes.trim()} ${t}` : t,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <Button
              variant="outline"
              onClick={() => setItens((prev) => [...prev, itemVazio()])}
              className="w-full"
            >
              <Plus className="size-4 mr-1" /> Adicionar medicamento
            </Button>

            <div className="bg-surface border border-border rounded-lg p-4 space-y-2">
              <Label>Observações da receita</Label>
              <div className="flex items-start gap-2">
                <textarea
                  rows={2}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background"
                />
                <DitarAudio
                  onTexto={(t) => setObservacoes((p) => (p ? `${p.trim()} ${t}` : t))}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Ao gerar, o receituário é assinado digitalmente (certificado ICP-Brasil, PIN ou senha) e
                fica bloqueado para edição. Correções exigem a emissão de uma nova receita.
              </p>
              <Button onClick={abrirAssinatura} disabled={gerar.isPending} className="w-full">
                <PenLine className="size-4 mr-1" />
                {gerar.isPending ? "Gerando…" : "Gerar receituário"}
              </Button>
            </div>

            {/* 4. Histórico */}
            <div className="bg-surface border border-border rounded-lg p-4">
              <p className="font-bold text-sm mb-3 flex items-center gap-2">
                <History className="size-4" /> Histórico de receituários
              </p>
              <div className="flex flex-wrap gap-3 mb-3">
                <div>
                  <Label className="text-[10px] uppercase text-muted-foreground font-bold">Data</Label>
                  <Input
                    type="date"
                    value={filtroData}
                    onChange={(e) => setFiltroData(e.target.value)}
                  />
                </div>
                <div className="flex-1 min-w-[180px]">
                  <Label className="text-[10px] uppercase text-muted-foreground font-bold">
                    Medicamento
                  </Label>
                  <Input
                    value={filtroMed}
                    onChange={(e) => setFiltroMed(e.target.value)}
                    placeholder="Filtrar por medicamento…"
                  />
                </div>
                {(filtroData || filtroMed) && (
                  <button
                    className="text-xs font-semibold text-primary self-end pb-2"
                    onClick={() => {
                      setFiltroData("");
                      setFiltroMed("");
                    }}
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
              {historicoFiltrado.length ? (
                <div className="space-y-2">
                  {historicoFiltrado.map((r: any) => {
                    const a = assinaturaDe(r.id);
                    return (
                      <div
                        key={r.id}
                        className="border border-border rounded-md px-3 py-2 flex flex-wrap justify-between items-center gap-2"
                      >
                        <button className="text-left min-w-0" onClick={() => setVerReceita(r)}>
                          <p className="text-sm font-semibold">
                            {String(r.data_emissao).split("-").reverse().join("/")} •{" "}
                            {(r.receituario_itens ?? []).length} medicamento(s)
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {a ? carimbo(a) : `${r.medico_nome} — ${r.status}`}
                          </p>
                        </button>
                        <Button size="sm" variant="outline" onClick={() => imprimir(r)}>
                          <Printer className="size-3.5 mr-1" /> Imprimir
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum receituário encontrado.</p>
              )}
            </div>
          </>
        )}
      </div>

      <CadastroManualDialog
        termo={cadastroManual}
        onClose={() => {
          setCadastroManual(null);
          setItemDestino(null);
        }}
        onCriado={(m) => {
          if (itemDestino) aplicarBase(itemDestino, m);
        }}
      />

      <Dialog open={!!verReceita} onOpenChange={(o) => !o && setVerReceita(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Receituário de{" "}
              {verReceita ? String(verReceita.data_emissao).split("-").reverse().join("/") : ""}
            </DialogTitle>
          </DialogHeader>
          {verReceita && (
            <div className="space-y-3 text-sm">
              {(verReceita.receituario_itens ?? [])
                .slice()
                .sort((a: any, b: any) => (a.ordem ?? 0) - (b.ordem ?? 0))
                .map((i: any) => (
                  <div key={i.id} className="border border-border rounded-md p-3">
                    <p className="font-bold">
                      {i.nome_medicamento}
                      {i.apresentacao ? ` — ${i.apresentacao}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[i.principio_ativo, i.forma_farmaceutica, i.laboratorio]
                        .filter(Boolean)
                        .join(" • ")}
                    </p>
                    <p className="mt-1">
                      {i.posologia}
                      {i.via ? ` — via ${i.via}` : ""} —{" "}
                      {descricaoFrequencia({
                        turnos: i.turnos ?? [],
                        se_necessario: !!i.se_necessario,
                      })}{" "}
                      — {descricaoDuracao(i)}
                    </p>
                    {i.quantidade_dispensar && (
                      <p className="text-xs text-muted-foreground">
                        Dispensar: {i.quantidade_dispensar}
                      </p>
                    )}
                    {i.orientacoes && <p className="text-xs">Orientações: {i.orientacoes}</p>}
                  </div>
                ))}
              {verReceita.observacoes && (
                <p className="text-xs text-muted-foreground">Obs.: {verReceita.observacoes}</p>
              )}
              <Button variant="outline" onClick={() => imprimir(verReceita)}>
                <Printer className="size-4 mr-1" /> Imprimir / PDF
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AssinaturaDialog
        open={assinaturaAberta}
        onOpenChange={setAssinaturaAberta}
        titulo="Assinar receituário"
        descricao="O receituário será assinado digitalmente e bloqueado para edição."
        onConfirmar={async (cred) => {
          await gerar.mutateAsync(cred);
        }}
      />
    </div>
  );
}
