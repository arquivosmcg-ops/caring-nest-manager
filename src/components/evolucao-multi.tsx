import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Printer, Plus, Pencil, Paperclip, BellRing, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePerfilAtual } from "@/hooks/use-perfil";
import { registrarAuditoria } from "@/lib/auditoria";
import { iconeDaCategoria, idadeEmAnos, numeroProntuario } from "@/lib/multiprofissional";
import logoAsset from "@/assets/logo_instituto_maior.png.asset.json";

type Evolucao = {
  id: string;
  residente_id: string;
  autor_id: string;
  autor_nome: string;
  categoria: string;
  conselho_numero: string | null;
  texto: string;
  anexos: { nome: string; path: string }[];
  assinatura: string | null;
  editado_em: string | null;
  created_at: string;
};

const fmtData = (v?: string | null) => (v ? new Date(v).toLocaleDateString("pt-BR") : "—");
const fmtHora = (v?: string | null) =>
  v ? new Date(v).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";
const esc = (v: unknown) =>
  String(v ?? "—").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);

export function EvolucaoMultiprofissional({
  residente,
}: {
  residente: Record<string, any> | null | undefined;
}) {
  const qc = useQueryClient();
  const perfil = usePerfilAtual().data;
  const residenteId = residente?.id as string | undefined;

  const [aberto, setAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [categoria, setCategoria] = useState("");
  const [conselho, setConselho] = useState("");
  const [emitirAlerta, setEmitirAlerta] = useState(false);
  const [mensagemAlerta, setMensagemAlerta] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);

  const [fCategoria, setFCategoria] = useState("todas");
  const [fProfissional, setFProfissional] = useState("todos");
  const [fDe, setFDe] = useState("");
  const [fAte, setFAte] = useState("");

  const categorias = useQuery({
    queryKey: ["categorias-profissionais"],
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorias_profissionais")
        .select("chave, nome, icone")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const config = useQuery({
    queryKey: ["config-evolucao"],
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from("config_evolucao").select("prazo_edicao_minutos").maybeSingle();
      return data?.prazo_edicao_minutos ?? 1440;
    },
  });

  const evolucoes = useQuery({
    queryKey: ["evolucoes-multi", residenteId],
    enabled: !!residenteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evolucoes_multi")
        .select("*")
        .eq("residente_id", residenteId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      await registrarAuditoria({
        acao: "visualizacao",
        entidade: "evolucoes_multi",
        residenteId: residenteId!,
      });
      return (data ?? []) as unknown as Evolucao[];
    },
  });

  const nomeCategoria = (chave: string) =>
    categorias.data?.find((c) => c.chave === chave)?.nome ?? chave;
  const iconeCategoria = (chave: string) =>
    iconeDaCategoria(categorias.data?.find((c) => c.chave === chave)?.icone);

  const profissionais = useMemo(() => {
    const set = new Map<string, string>();
    (evolucoes.data ?? []).forEach((e) => set.set(e.autor_id, e.autor_nome || "Profissional"));
    return [...set.entries()];
  }, [evolucoes.data]);

  const lista = useMemo(() => {
    return (evolucoes.data ?? []).filter((e) => {
      if (fCategoria !== "todas" && e.categoria !== fCategoria) return false;
      if (fProfissional !== "todos" && e.autor_id !== fProfissional) return false;
      const d = new Date(e.created_at);
      if (fDe && d < new Date(`${fDe}T00:00:00`)) return false;
      if (fAte && d > new Date(`${fAte}T23:59:59`)) return false;
      return true;
    });
  }, [evolucoes.data, fCategoria, fProfissional, fDe, fAte]);

  const podeEditar = (e: Evolucao) => {
    if (!perfil || e.autor_id !== perfil.userId) return false;
    const limite = (config.data ?? 1440) * 60 * 1000;
    return Date.now() - new Date(e.created_at).getTime() <= limite;
  };

  const podeRegistrar = !!perfil && (perfil.isMultiprofissional || perfil.isEquipeClinica);

  const limparForm = () => {
    setEditandoId(null);
    setTexto("");
    setEmitirAlerta(false);
    setMensagemAlerta("");
    setArquivos([]);
  };

  const abrirNovo = () => {
    limparForm();
    setCategoria(
      categorias.data?.find((c) => c.chave === perfil?.funcao)?.chave ?? (categoria || ""),
    );
    setConselho(perfil?.registroProfissional ?? "");
    setAberto(true);
  };

  const abrirEdicao = (e: Evolucao) => {
    setEditandoId(e.id);
    setTexto(e.texto);
    setCategoria(e.categoria);
    setConselho(e.conselho_numero ?? "");
    setEmitirAlerta(false);
    setMensagemAlerta("");
    setArquivos([]);
    setAberto(true);
  };

  const salvar = useMutation({
    mutationFn: async () => {
      if (!residenteId) throw new Error("Selecione uma residente");
      if (!categoria) throw new Error("Selecione a categoria profissional");
      if (texto.trim().length < 5) throw new Error("Escreva a evolução");
      if (emitirAlerta && mensagemAlerta.trim().length < 3)
        throw new Error("Escreva a mensagem resumida do alerta");

      const anexos: { nome: string; path: string }[] = [];
      for (const f of arquivos) {
        const path = `${residenteId}/${crypto.randomUUID()}-${f.name.replace(/[^\w.\-]/g, "_")}`;
        const { error } = await supabase.storage.from("evolucoes-anexos").upload(path, f);
        if (error) throw error;
        anexos.push({ nome: f.name, path });
      }

      if (editandoId) {
        const anterior = evolucoes.data?.find((e) => e.id === editandoId);
        const { error } = await supabase
          .from("evolucoes_multi")
          .update({
            texto,
            categoria,
            conselho_numero: conselho || null,
            anexos: [...(anterior?.anexos ?? []), ...anexos] as never,
          })
          .eq("id", editandoId);
        if (error) throw error;
        await registrarAuditoria({
          acao: "edicao",
          entidade: "evolucoes_multi",
          entidadeId: editandoId,
          residenteId,
        });
        return editandoId;
      }

      const { data, error } = await supabase
        .from("evolucoes_multi")
        .insert({
          residente_id: residenteId,
          autor_id: perfil!.userId,
          autor_nome: perfil!.fullName,
          categoria,
          conselho_numero: conselho || null,
          texto,
          anexos: anexos as never,
          assinatura: `${perfil!.fullName} · ${nomeCategoria(categoria)}${conselho ? ` · ${conselho}` : ""}`,
        })
        .select("id")
        .single();
      if (error) throw error;

      await registrarAuditoria({
        acao: "criacao",
        entidade: "evolucoes_multi",
        entidadeId: data.id,
        residenteId,
      });

      if (emitirAlerta) {
        const { error: errAlerta } = await supabase.from("alertas_clinicos").insert({
          residente_id: residenteId,
          evolucao_id: data.id,
          emitido_por: perfil!.userId,
          emitido_por_nome: perfil!.fullName,
          categoria,
          mensagem: mensagemAlerta,
        });
        if (errAlerta) throw errAlerta;
        await registrarAuditoria({
          acao: "alerta",
          entidade: "alertas_clinicos",
          entidadeId: data.id,
          residenteId,
          detalhes: { mensagem: mensagemAlerta },
        });
      }
      return data.id;
    },
    onSuccess: () => {
      toast.success(editandoId ? "Evolução atualizada" : "Evolução registrada");
      setAberto(false);
      limparForm();
      qc.invalidateQueries({ queryKey: ["evolucoes-multi", residenteId] });
      qc.invalidateQueries({ queryKey: ["alertas-clinicos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cabecalhoHtml = () => {
    const r = residente ?? {};
    const linha = (k: string, v: unknown) =>
      `<div class="item"><span>${k}</span><strong>${esc(v)}</strong></div>`;
    return `<header>
  <img class="logo" src="${logoAsset.url}" alt="Logo" />
  <div><h1>RESIDENCIAL SÃO CAMILO</h1><div class="sub">Evolução Multiprofissional</div></div>
</header>
<div class="grid">
  ${linha("Residente", r["nome_completo"])}
  ${linha("Nº prontuário", numeroProntuario(r["id"]))}
  ${linha("Quarto", r["quartos"]?.numero)}
  ${linha("Nascimento", fmtData(r["data_nascimento"]))}
  ${linha("Idade", idadeEmAnos(r["data_nascimento"]))}
  ${linha("Internação", fmtData(r["data_admissao"]))}
  ${linha("Convênio", r["convenio"])}
</div>`;
  };

  const estilos = `@page { size: A4; margin: 18mm; }
* { box-sizing: border-box; }
body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#111; font-size:12px; line-height:1.5; }
header { display:flex; align-items:center; gap:12px; border-bottom:2px solid #111; padding-bottom:10px; margin-bottom:14px; }
header img.logo { height:40px; }
h1 { font-size:16px; margin:0; letter-spacing:-.3px; }
.sub { font-size:10px; color:#555; text-transform:uppercase; letter-spacing:.08em; }
.grid { display:grid; grid-template-columns:repeat(3,1fr); gap:6px 14px; margin-bottom:14px; }
.item span { display:block; font-size:9px; text-transform:uppercase; color:#666; letter-spacing:.06em; }
.item strong { font-size:11px; font-weight:600; }
.evo { border-top:1px solid #ccc; padding-top:10px; margin-top:14px; page-break-inside:avoid; }
.evo .meta { font-size:10px; color:#555; text-transform:uppercase; letter-spacing:.05em; margin-bottom:6px; }
.evo .texto { white-space:pre-wrap; }
.assin { margin-top:14px; border-top:1px solid #111; padding-top:6px; font-size:10px; }
footer { margin-top:24px; font-size:9px; color:#666; border-top:1px solid #ccc; padding-top:6px; }`;

  const abrirJanela = (corpo: string, titulo: string) => {
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" /><title>${esc(titulo)}</title><style>${estilos}</style></head><body>${corpo}
<footer>Emitido em ${new Date().toLocaleString("pt-BR")} · Documento confidencial — uso clínico interno (LGPD)</footer>
<script>window.onload=function(){setTimeout(function(){window.print();},400);};</script></body></html>`;
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };

  const blocoEvolucao = (e: Evolucao) => `<div class="evo">
  <div class="meta">${fmtData(e.created_at)} às ${fmtHora(e.created_at)} · ${esc(nomeCategoria(e.categoria))}</div>
  <div class="texto">${esc(e.texto)}</div>
  <div class="assin">
    ${esc(e.autor_nome)}<br/>
    ${esc(nomeCategoria(e.categoria))}${e.conselho_numero ? ` · Conselho: ${esc(e.conselho_numero)}` : ""}<br/>
    ${fmtData(e.created_at)} · ${fmtHora(e.created_at)}
  </div>
</div>`;

  const imprimirUma = async (e: Evolucao) => {
    abrirJanela(cabecalhoHtml() + blocoEvolucao(e), `Evolução — ${residente?.["nome_completo"] ?? ""}`);
    await registrarAuditoria({
      acao: "impressao",
      entidade: "evolucoes_multi",
      entidadeId: e.id,
      residenteId: residenteId ?? null,
    });
  };

  const imprimirHistorico = async () => {
    if (lista.length === 0) return toast.error("Nenhuma evolução para imprimir");
    abrirJanela(
      cabecalhoHtml() + [...lista].reverse().map(blocoEvolucao).join(""),
      `Histórico de evoluções — ${residente?.["nome_completo"] ?? ""}`,
    );
    await registrarAuditoria({
      acao: "impressao",
      entidade: "evolucoes_multi_historico",
      residenteId: residenteId ?? null,
      detalhes: { total: lista.length },
    });
  };

  const baixarAnexo = async (path: string) => {
    const { data } = await supabase.storage.from("evolucoes-anexos").createSignedUrl(path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  if (!residente) {
    return (
      <div className="bg-surface border border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
        Selecione uma residente para ver as evoluções multiprofissionais.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-extrabold uppercase tracking-wider">Evolução Multiprofissional</h3>
          <p className="text-xs text-muted-foreground">
            {lista.length} registro(s) · prontuário {numeroProntuario(residente["id"])} ·{" "}
            {idadeEmAnos(residente["data_nascimento"])}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={imprimirHistorico}>
            <Printer className="size-4 mr-1" /> Imprimir histórico
          </Button>
          {podeRegistrar && (
            <Button size="sm" onClick={abrirNovo}>
              <Plus className="size-4 mr-1" /> Nova evolução
            </Button>
          )}
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg p-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Categoria</Label>
          <Select value={fCategoria} onValueChange={setFCategoria}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as categorias</SelectItem>
              {categorias.data?.map((c) => (
                <SelectItem key={c.chave} value={c.chave}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Profissional</Label>
          <Select value={fProfissional} onValueChange={setFProfissional}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {profissionais.map(([id, nome]) => (
                <SelectItem key={id} value={id}>{nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">De</Label>
          <Input type="date" value={fDe} onChange={(e) => setFDe(e.target.value)} />
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Até</Label>
          <Input type="date" value={fAte} onChange={(e) => setFAte(e.target.value)} />
        </div>
      </div>

      {aberto && (
        <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold">{editandoId ? "Editar evolução" : "Nova evolução"}</h4>
            <button onClick={() => { setAberto(false); limparForm(); }} className="text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Categoria profissional</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {categorias.data?.map((c) => (
                    <SelectItem key={c.chave} value={c.chave}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nº do conselho profissional</Label>
              <Input value={conselho} onChange={(e) => setConselho(e.target.value)} placeholder="Ex.: CREFITO-3 12345" />
            </div>
          </div>
          <div>
            <Label>Evolução</Label>
            <Textarea rows={7} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Descreva a avaliação, conduta e orientações…" />
          </div>
          <div>
            <Label className="flex items-center gap-2 text-sm">
              <Paperclip className="size-4" /> Anexar documentos ou imagens (opcional)
            </Label>
            <Input type="file" multiple onChange={(e) => setArquivos(Array.from(e.target.files ?? []))} />
          </div>
          <div className="rounded-md border border-border p-3 space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox checked={emitirAlerta} onCheckedChange={(v) => setEmitirAlerta(v === true)} />
              Emitir alerta aos demais profissionais
            </label>
            {emitirAlerta && (
              <Input
                value={mensagemAlerta}
                onChange={(e) => setMensagemAlerta(e.target.value)}
                maxLength={160}
                placeholder="Mensagem resumida do alerta"
              />
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Assinatura digital: <strong>{perfil?.fullName}</strong>
            {categoria ? ` · ${nomeCategoria(categoria)}` : ""}
            {conselho ? ` · ${conselho}` : ""}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setAberto(false); limparForm(); }}>Cancelar</Button>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
              {salvar.isPending ? "Salvando…" : "Salvar evolução"}
            </Button>
          </div>
        </div>
      )}

      {evolucoes.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando evoluções…</p>
      ) : lista.length === 0 ? (
        <div className="bg-surface border border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
          Nenhuma evolução multiprofissional registrada com estes filtros.
        </div>
      ) : (
        <ol className="relative border-l border-border ml-3 space-y-4">
          {lista.map((e) => {
            const Icone = iconeCategoria(e.categoria);
            return (
              <li key={e.id} className="ml-5">
                <span className="absolute -left-[13px] grid place-items-center size-6 rounded-full bg-foreground text-background">
                  <Icone className="size-3" />
                </span>
                <div className="bg-surface border border-border rounded-lg p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold">{nomeCategoria(e.categoria)}</p>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
                        {fmtData(e.created_at)} · {fmtHora(e.created_at)} · {e.autor_nome}
                        {e.conselho_numero ? ` · ${e.conselho_numero}` : ""}
                        {e.editado_em ? " · editada" : ""}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {podeEditar(e) && (
                        <Button variant="ghost" size="sm" onClick={() => abrirEdicao(e)} title="Editar">
                          <Pencil className="size-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => imprimirUma(e)} title="Imprimir evolução">
                        <Printer className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="mt-2 text-sm whitespace-pre-wrap">{e.texto}</p>
                  {e.anexos?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {e.anexos.map((a) => (
                        <button
                          key={a.path}
                          onClick={() => baixarAnexo(a.path)}
                          className="text-xs underline text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
                          <Paperclip className="size-3" /> {a.nome}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="mt-3 pt-2 border-t border-border text-[11px] text-muted-foreground">
                    Assinado digitalmente por {e.assinatura ?? e.autor_nome}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export function AlertaResidenteBadge({ ativo }: { ativo: boolean }) {
  if (!ativo) return null;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold text-primary")}>
      <BellRing className="size-3" /> alerta
    </span>
  );
}
