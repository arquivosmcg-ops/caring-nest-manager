import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePerfilAtual } from "@/hooks/use-perfil";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ChevronDown, ClipboardList, Save, History, PenLine, Printer, FileWarning } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SAE_SECOES, resumoSecao, type SaeValores, type SaeCampo } from "@/lib/sae-schema";
import { DitarAudio } from "@/components/ditar-audio";
import { AssinaturaDialog, CarimboAssinatura, type CredencialAssinatura } from "@/components/assinatura-dialog";
import { hashDocumento, carimbo, type Assinatura } from "@/lib/assinatura";

export const Route = createFileRoute("/_authenticated/sae")({
  head: () => ({
    meta: [
      { title: "SAE · Residencial São Camilo" },
      {
        name: "description",
        content:
          "Sistematização da Assistência de Enfermagem: formulário digital por residente, com histórico de evoluções e assinatura do profissional.",
      },
      { property: "og:title", content: "SAE · Residencial São Camilo" },
      {
        property: "og:description",
        content: "Formulário digital de SAE por residente, com histórico em linha do tempo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SaePage,
});

const TURNOS = ["manha", "tarde", "noite"] as const;
const TURNO_LABEL: Record<string, string> = { manha: "Manhã", tarde: "Tarde", noite: "Noite" };

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

function CampoRender({
  campo,
  valor,
  onChange,
}: {
  campo: SaeCampo;
  valor: string | string[] | number | undefined;
  onChange: (v: string | string[] | number | undefined) => void;
}) {
  if (campo.tipo === "chips") {
    const sel = Array.isArray(valor) ? valor : valor ? [String(valor)] : [];
    return (
      <div className="space-y-1.5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {campo.label}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {campo.opcoes.map((op) => {
            const ativo = sel.includes(op);
            return (
              <Chip
                key={op}
                ativo={ativo}
                onClick={() => {
                  if (campo.multi) {
                    onChange(ativo ? sel.filter((s) => s !== op) : [...sel, op]);
                  } else {
                    onChange(ativo ? undefined : op);
                  }
                }}
              >
                {op}
              </Chip>
            );
          })}
        </div>
      </div>
    );
  }
  if (campo.tipo === "textarea") {
    const atual = (valor as string) ?? "";
    return (
      <div className="space-y-1.5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {campo.label}
        </p>
        <div className="flex items-start gap-2">
          <textarea
            rows={3}
            value={atual}
            onChange={(e) => onChange(e.target.value)}
            className="w-full text-sm border border-border rounded-md px-3 py-2 bg-surface"
          />
          <DitarAudio onTexto={(t) => onChange(atual ? `${atual.trim()} ${t}` : t)} />
        </div>
      </div>
    );
  }
  const atual = (valor as string) ?? "";
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {campo.label}
        {campo.tipo === "numero" && campo.unidade ? ` (${campo.unidade})` : ""}
      </p>
      <div className="flex items-center gap-2">
        <input
          type={campo.tipo === "numero" ? "number" : "text"}
          value={atual}
          onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
          className="w-full text-sm border border-border rounded-md px-3 py-2 bg-surface"
        />
        {campo.tipo === "texto" && (
          <DitarAudio onTexto={(t) => onChange(atual ? `${atual.trim()} ${t}` : t)} />
        )}
      </div>
    </div>
  );
}

function SaePage() {
  const perfil = usePerfilAtual().data;
  const queryClient = useQueryClient();
  const hoje = new Date().toISOString().slice(0, 10);

  const [residenteId, setResidenteId] = useState<string | null>(null);
  const [data, setData] = useState(hoje);
  const [turno, setTurno] = useState<string>("");
  const [valores, setValores] = useState<SaeValores>({});
  const [evolucao, setEvolucao] = useState("");
  const [aberta, setAberta] = useState<string | null>(SAE_SECOES[0]?.id ?? null);
  const [verRegistro, setVerRegistro] = useState<any | null>(null);
  const [assinaturaAberta, setAssinaturaAberta] = useState(false);
  const [retificaDe, setRetificaDe] = useState<any | null>(null);
  const [motivoRetificacao, setMotivoRetificacao] = useState("");

  const residentes = useQuery({
    queryKey: ["residentes-sae"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("residentes")
        .select("id, nome_completo, data_nascimento, historico_medico, quartos(numero)")
        .eq("ativo", true)
        .order("nome_completo");
      if (error) throw error;
      return data ?? [];
    },
  });

  const residente = residentes.data?.find((r) => r.id === residenteId) ?? null;

  const hd = useQuery({
    queryKey: ["sae-hd", residenteId],
    enabled: !!residenteId,
    queryFn: async () => {
      const { data } = await supabase
        .from("prescricoes")
        .select("hd, ano, mes")
        .eq("residente_id", residenteId!)
        .order("ano", { ascending: false })
        .order("mes", { ascending: false })
        .limit(1);
      return data?.[0]?.hd ?? null;
    },
  });

  const historico = useQuery({
    queryKey: ["sae-historico", residenteId],
    enabled: !!residenteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sae_registros")
        .select("*")
        .eq("residente_id", residenteId!)
        .order("data", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const assinaturas = useQuery({
    queryKey: ["assinaturas-sae", residenteId, historico.data?.length],
    enabled: !!residenteId && !!historico.data?.length,
    queryFn: async () => {
      const ids = (historico.data ?? []).map((r: any) => r.id);
      const { data, error } = await supabase
        .from("assinaturas")
        .select("*")
        .eq("documento_tipo", "sae")
        .in("documento_id", ids)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Assinatura[];
    },
  });

  const assinaturaDe = (registroId: string) =>
    (assinaturas.data ?? []).find((a) => a.documento_id === registroId) ?? null;

  const salvar = useMutation({
    mutationFn: async (cred: CredencialAssinatura) => {
      const payload = {
        residente_id: residenteId!,
        autor_id: perfil!.userId,
        autor_nome: perfil!.fullName,
        autor_registro: perfil!.registroProfissional,
        data,
        turno: turno as "manha" | "tarde" | "noite",
        secoes: valores as never,
        evolucao: evolucao || null,
        assinatura: `${perfil!.fullName}${perfil!.registroProfissional ? ` — ${perfil!.registroProfissional}` : ""}`,
        retifica_id: retificaDe?.id ?? null,
        motivo_retificacao: retificaDe ? motivoRetificacao.trim() || null : null,
      };
      const { data: inserido, error } = await supabase
        .from("sae_registros")
        .insert(payload as never)
        .select("id")
        .single();
      if (error) throw error;

      const hash = await hashDocumento({
        residente_id: payload.residente_id,
        data: payload.data,
        turno: payload.turno,
        secoes: valores,
        evolucao: payload.evolucao,
        retifica_id: payload.retifica_id,
      });
      const { error: erroAss } = await supabase.rpc("registrar_assinatura", {
        _documento_tipo: "sae",
        _documento_id: (inserido as { id: string }).id,
        _hash: hash,
        _pin: cred.pin ?? undefined,
        _documento_ref: { residente_id: residenteId, data, turno } as never,
        _metodo: cred.metodo,
      });
      if (erroAss) throw erroAss;
    },
    onSuccess: () => {
      toast.success("Evolução de SAE assinada eletronicamente");
      setValores({});
      setEvolucao("");
      setRetificaDe(null);
      setMotivoRetificacao("");
      queryClient.invalidateQueries({ queryKey: ["sae-historico", residenteId] });
      queryClient.invalidateQueries({ queryKey: ["assinaturas-sae"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const idade = useMemo(() => {
    if (!residente?.data_nascimento) return null;
    const [a, m, d] = residente.data_nascimento.split("-").map(Number);
    const hojeD = new Date();
    let i = hojeD.getFullYear() - a;
    if (hojeD.getMonth() + 1 < m || (hojeD.getMonth() + 1 === m && hojeD.getDate() < d)) i--;
    return i;
  }, [residente]);

  const handleSalvar = () => {
    if (!residenteId) return toast.error("Selecione um residente");
    if (!data) return toast.error("Informe a data do registro");
    if (!turno) return toast.error("Selecione o turno");
    if (!perfil) return toast.error("Profissional responsável não identificado");
    if (retificaDe && !motivoRetificacao.trim())
      return toast.error("Informe o motivo da retificação");
    setAssinaturaAberta(true);
  };

  const imprimirRegistro = (r: any) => {
    const a = assinaturaDe(r.id);
    const secoesHtml = SAE_SECOES.map((secao) => {
      const vals = (r.secoes ?? {})[secao.id] ?? {};
      const campos = secao.campos.filter((c) => {
        const v = vals[c.id];
        return Array.isArray(v) ? v.length > 0 : v !== undefined && v !== "" && v !== null;
      });
      if (!campos.length) return "";
      const itens = campos
        .map(
          (c) =>
            `<p><span class="lbl">${c.label}:</span> <b>${
              Array.isArray(vals[c.id]) ? (vals[c.id] as string[]).join(", ") : String(vals[c.id])
            }</b></p>`,
        )
        .join("");
      return `<div class="sec"><h2>${secao.titulo}</h2>${itens}</div>`;
    }).join("");
    const rodape = a
      ? `<div class="ass"><p><b>${carimbo(a)}</b></p>
         <p>Assinado eletronicamente em ${new Date(a.created_at).toLocaleString("pt-BR")}</p>
         <p>Documento íntegro — hash: ${a.hash_documento.slice(0, 8)}</p></div>`
      : `<div class="ass"><p>Registro sem assinatura eletrônica.</p></div>`;
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
<title>SAE — ${residente?.nome_completo ?? ""}</title>
<style>
  @page { size: A4; margin: 12mm; }
  body { font-family: Arial, sans-serif; color:#111; font-size:10pt; }
  h1 { font-size:14pt; text-transform:uppercase; margin:0 0 4px; }
  h2 { font-size:9pt; text-transform:uppercase; margin:0 0 4px; }
  .sec { border:1px solid #999; padding:6px; margin-bottom:6px; }
  .lbl { color:#555; }
  .ass { margin-top:20px; border-top:1px solid #111; padding-top:6px; font-size:9pt; }
  p { margin:1px 0; }
</style></head><body>
<h1>Sistematização da Assistência de Enfermagem</h1>
<p><b>${residente?.nome_completo ?? ""}</b> — ${String(r.data).split("-").reverse().join("/")} • ${TURNO_LABEL[r.turno] ?? r.turno}</p>
${r.retifica_id ? `<p><b>Retificação</b> de registro anterior${r.motivo_retificacao ? ` — motivo: ${r.motivo_retificacao}` : ""}</p>` : ""}
${secoesHtml}
${r.evolucao ? `<div class="sec"><h2>Evolução de enfermagem</h2><p>${String(r.evolucao).replace(/\n/g, "<br/>")}</p></div>` : ""}
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
      <aside className="bg-surface border border-border rounded-lg p-3 h-fit max-h-[70vh] overflow-y-auto">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 pb-2">
          Residentes
        </p>
        {residentes.data?.map((res) => (
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

      <section className="space-y-4">
        {!residente ? (
          <div className="bg-surface border border-border rounded-lg p-12 text-center text-muted-foreground">
            <ClipboardList className="size-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Selecione uma residente para iniciar a SAE.</p>
          </div>
        ) : (
          <>
            <div className="sticky top-20 z-10 bg-surface border border-border rounded-lg p-4 shadow-sm">
              <div className="grid sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Residente</p>
                  <p className="font-bold truncate">{residente.nome_completo}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Nascimento</p>
                  <p className="font-medium">
                    {residente.data_nascimento
                      ? `${residente.data_nascimento.split("-").reverse().join("/")}${idade !== null ? ` (${idade}a)` : ""}`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Quarto</p>
                  <p className="font-medium">{(residente as any).quartos?.numero ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">HD</p>
                  <p className="font-medium truncate">{hd.data || residente.historico_medico || "—"}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-4 mt-4 pt-4 border-t border-border">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Data</p>
                  <input
                    type="date"
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    className="text-sm border border-border rounded-md px-3 py-2 bg-background"
                  />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Turno</p>
                  <div className="flex gap-1.5">
                    {TURNOS.map((t) => (
                      <Chip key={t} ativo={turno === t} onClick={() => setTurno(turno === t ? "" : t)}>
                        {TURNO_LABEL[t]}
                      </Chip>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {SAE_SECOES.map((secao) => {
              const preenchidos = resumoSecao(secao, valores);
              const open = aberta === secao.id;
              return (
                <div key={secao.id} className="bg-surface border border-border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setAberta(open ? null : secao.id)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-black/[0.02]"
                  >
                    <span className="font-bold text-sm">{secao.titulo}</span>
                    <span className="flex items-center gap-2">
                      {preenchidos > 0 && (
                        <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          {preenchidos} preenchido(s)
                        </span>
                      )}
                      <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
                    </span>
                  </button>
                  {open && (
                    <div className="px-4 pb-4 grid md:grid-cols-2 gap-4 border-t border-border pt-4">
                      {secao.campos.map((campo) => (
                        <div key={campo.id} className={campo.tipo === "chips" || campo.tipo === "textarea" ? "md:col-span-2" : ""}>
                          <CampoRender
                            campo={campo}
                            valor={valores[secao.id]?.[campo.id]}
                            onChange={(v) =>
                              setValores((prev) => {
                                const sec = { ...(prev[secao.id] ?? {}) };
                                if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) {
                                  delete sec[campo.id];
                                } else {
                                  sec[campo.id] = v;
                                }
                                return { ...prev, [secao.id]: sec };
                              })
                            }
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="bg-surface border border-border rounded-lg p-4 space-y-2">
              <p className="font-bold text-sm">12. Evolução de Enfermagem</p>
              <p className="text-[11px] text-muted-foreground">
                {data.split("-").reverse().join("/")} • {TURNO_LABEL[turno] ?? "turno não definido"} •{" "}
                {perfil?.fullName ?? "—"}
              </p>
              <div className="flex items-start gap-2">
                <textarea
                  rows={7}
                  value={evolucao}
                  onChange={(e) => setEvolucao(e.target.value)}
                  placeholder="Descreva a evolução do plantão… ou use o microfone para ditar"
                  className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background"
                />
                <DitarAudio
                  onTexto={(t) => setEvolucao((prev) => (prev ? `${prev.trim()} ${t}` : t))}
                />
              </div>
            </div>

            <div className="bg-surface border border-border rounded-lg p-4 space-y-2">
              <p className="font-bold text-sm">13. Assinatura eletrônica</p>
              <p className="text-xs text-muted-foreground">
                Ao salvar, será solicitada a confirmação de identidade (PIN ou senha). A assinatura
                eletrônica substitui o campo manuscrito “Assinatura e Carimbo Enfermeira” e bloqueia
                o registro para edição.
              </p>
              <p className="text-sm font-semibold">
                {perfil?.fullName ?? "—"}
                {perfil?.registroProfissional ? ` — ${perfil.registroProfissional}` : ""}
              </p>
              {retificaDe && (
                <div className="border border-amber-500/40 bg-amber-500/10 rounded-md p-3 space-y-2">
                  <p className="text-xs font-bold flex items-center gap-1.5">
                    <FileWarning className="size-3.5" /> Retificação do registro de{" "}
                    {String(retificaDe.data).split("-").reverse().join("/")} •{" "}
                    {TURNO_LABEL[retificaDe.turno] ?? retificaDe.turno}
                  </p>
                  <input
                    value={motivoRetificacao}
                    onChange={(e) => setMotivoRetificacao(e.target.value)}
                    placeholder="Motivo da retificação"
                    className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background"
                  />
                  <button
                    className="text-xs font-semibold text-muted-foreground underline"
                    onClick={() => {
                      setRetificaDe(null);
                      setMotivoRetificacao("");
                    }}
                  >
                    Cancelar retificação
                  </button>
                </div>
              )}
            </div>

            <div className="bg-surface border border-border rounded-lg p-4">
              <p className="font-bold text-sm mb-3 flex items-center gap-2">
                <History className="size-4" /> Histórico de SAE
              </p>
              {historico.data?.length ? (
                <div className="space-y-2">
                  {historico.data.map((r: any) => {
                    const a = assinaturaDe(r.id);
                    return (
                      <button
                        key={r.id}
                        onClick={() => setVerRegistro(r)}
                        className="w-full text-left border border-border rounded-md px-3 py-2 hover:bg-black/[0.03] flex justify-between items-center gap-3"
                      >
                        <span className="text-sm font-semibold">
                          {String(r.data).split("-").reverse().join("/")} • {TURNO_LABEL[r.turno] ?? r.turno}
                          {r.retifica_id && (
                            <span className="ml-2 text-[10px] uppercase font-bold text-amber-700">
                              retificação
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground truncate max-w-[55%] flex items-center gap-1 justify-end">
                          {a ? <PenLine className="size-3" /> : null}
                          {a ? carimbo(a) : r.autor_nome}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum registro de SAE para esta residente.</p>
              )}
            </div>

            <div className="fixed bottom-0 right-0 left-64 bg-surface/95 backdrop-blur border-t border-border px-8 py-3 flex justify-end z-20">
              <button
                onClick={handleSalvar}
                disabled={salvar.isPending}
                className="bg-primary text-primary-foreground px-6 py-3 rounded-md font-bold text-sm flex items-center gap-2 shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-60"
              >
                <Save className="size-4" />
                {salvar.isPending ? "Assinando…" : "Salvar e assinar"}
              </button>
            </div>
          </>
        )}
      </section>

      <Dialog open={!!verRegistro} onOpenChange={(o) => !o && setVerRegistro(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              SAE — {verRegistro ? String(verRegistro.data).split("-").reverse().join("/") : ""} •{" "}
              {verRegistro ? (TURNO_LABEL[verRegistro.turno] ?? verRegistro.turno) : ""}
            </DialogTitle>
          </DialogHeader>
          {verRegistro && (
            <div className="space-y-4 text-sm">
              <p className="text-xs text-muted-foreground">
                Registrado por {verRegistro.autor_nome}
                {verRegistro.autor_registro ? ` — ${verRegistro.autor_registro}` : ""} em{" "}
                {new Date(verRegistro.created_at).toLocaleString("pt-BR")}
              </p>
              {SAE_SECOES.map((secao) => {
                const vals = (verRegistro.secoes ?? {})[secao.id] ?? {};
                const campos = secao.campos.filter((c) => {
                  const v = vals[c.id];
                  return Array.isArray(v) ? v.length > 0 : v !== undefined && v !== "" && v !== null;
                });
                if (!campos.length) return null;
                return (
                  <div key={secao.id} className="border border-border rounded-md p-3">
                    <p className="font-bold text-xs uppercase tracking-wider mb-2">{secao.titulo}</p>
                    <div className="space-y-1">
                      {campos.map((c) => (
                        <p key={c.id}>
                          <span className="text-muted-foreground">{c.label}:</span>{" "}
                          <strong>
                            {Array.isArray(vals[c.id]) ? (vals[c.id] as string[]).join(", ") : String(vals[c.id])}
                          </strong>
                        </p>
                      ))}
                    </div>
                  </div>
                );
              })}
              {verRegistro.evolucao && (
                <div className="border border-border rounded-md p-3">
                  <p className="font-bold text-xs uppercase tracking-wider mb-2">Evolução de enfermagem</p>
                  <p className="whitespace-pre-wrap">{verRegistro.evolucao}</p>
                </div>
              )}
              {(() => {
                const a = assinaturaDe(verRegistro.id);
                return a ? (
                  <div className="border-t border-border pt-3">
                    <CarimboAssinatura assinatura={a} />
                  </div>
                ) : verRegistro.assinatura ? (
                  <p className="text-xs italic text-muted-foreground">
                    Assinado: {verRegistro.assinatura}
                  </p>
                ) : null;
              })()}

              <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                <button
                  onClick={() => imprimirRegistro(verRegistro)}
                  className="text-xs font-bold border border-border rounded-md px-3 py-2 flex items-center gap-1.5 hover:bg-black/[0.03]"
                >
                  <Printer className="size-3.5" /> Imprimir (A4)
                </button>
                <button
                  onClick={() => {
                    setValores((verRegistro.secoes ?? {}) as SaeValores);
                    setEvolucao(verRegistro.evolucao ?? "");
                    setData(verRegistro.data);
                    setTurno(verRegistro.turno);
                    setRetificaDe(verRegistro);
                    setMotivoRetificacao("");
                    setVerRegistro(null);
                    toast.info("Preencha as correções e assine a retificação");
                  }}
                  className="text-xs font-bold border border-border rounded-md px-3 py-2 flex items-center gap-1.5 hover:bg-black/[0.03]"
                >
                  <FileWarning className="size-3.5" /> Criar retificação
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AssinaturaDialog
        open={assinaturaAberta}
        onOpenChange={setAssinaturaAberta}
        titulo={retificaDe ? "Assinar retificação da SAE" : "Assinar evolução de SAE"}
        descricao="Substitui o campo “Assinatura e Carimbo Enfermeira”. Após assinado, o registro não pode ser editado."
        onConfirmar={async (cred) => {
          await salvar.mutateAsync(cred);
        }}
      />
    </div>
  );
}
