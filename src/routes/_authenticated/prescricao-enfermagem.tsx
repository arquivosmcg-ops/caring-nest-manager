import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePerfilAtual } from "@/hooks/use-perfil";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Lock, Pencil, Printer, Save, ClipboardList, CalendarDays, Table2, PenLine } from "lucide-react";
import { DitarAudio } from "@/components/ditar-audio";
import {
  AssinaturaDialog,
  CarimboAssinatura,
  type CredencialAssinatura,
} from "@/components/assinatura-dialog";
import { hashDocumento, carimbo, type Assinatura } from "@/lib/assinatura";
import {
  DIAGNOSTICOS_ENFERMAGEM,
  MESES,
  TURNOS,
  TURNO_LABEL,
  TURNO_SIGLA,
  calcularIdade,
  diasDoMes,
  type CuidadoPlano,
  type RegistroCuidado,
  type Turno,
} from "@/lib/prescricao-enfermagem";

export const Route = createFileRoute("/_authenticated/prescricao-enfermagem")({
  head: () => ({
    meta: [
      { title: "Prescrição de Enfermagem · Residencial São Camilo" },
      {
        name: "description",
        content:
          "Checklist mensal de cuidados de enfermagem por residente, preenchido turno a turno, com grade mensal para auditoria.",
      },
      { property: "og:title", content: "Prescrição de Enfermagem · Residencial São Camilo" },
      {
        property: "og:description",
        content: "Registro diário de cuidados por turno e grade mensal imprimível.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrescricaoEnfermagemPage,
});

const esc = (v: string) =>
  v.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!);

function Chip({
  ativo,
  onClick,
  children,
  className,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
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
        className,
      )}
    >
      {children}
    </button>
  );
}

type Marcacao = { feito: boolean; observacao: string };

function PrescricaoEnfermagemPage() {
  const perfil = usePerfilAtual().data;
  const qc = useQueryClient();
  const hojeIso = new Date().toISOString().slice(0, 10);

  const [residenteId, setResidenteId] = useState<string>("");
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [modo, setModo] = useState<"hoje" | "mes">("hoje");
  const [data, setData] = useState(hojeIso);
  const [turno, setTurno] = useState<Turno>(() => {
    const h = new Date().getHours();
    return h < 12 ? "manha" : h < 18 ? "tarde" : "noite";
  });
  const [marcacoes, setMarcacoes] = useState<Record<string, Marcacao>>({});
  const [editandoDiag, setEditandoDiag] = useState(false);
  const [diagSel, setDiagSel] = useState<string[]>([]);
  const [diagOutros, setDiagOutros] = useState("");
  const [assinaturaEnf, setAssinaturaEnf] = useState("");
  const [celula, setCelula] = useState<RegistroCuidado | null>(null);
  const [assinaturaAberta, setAssinaturaAberta] = useState(false);

  const residentes = useQuery({
    queryKey: ["residentes-presc-enf"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("residentes")
        .select("id, nome_completo, data_nascimento, quartos(numero)")
        .eq("ativo", true)
        .order("nome_completo");
      if (error) throw error;
      return data ?? [];
    },
  });

  const residente = residentes.data?.find((r) => r.id === residenteId) ?? null;

  const hd = useQuery({
    queryKey: ["presc-enf-hd", residenteId],
    enabled: !!residenteId,
    queryFn: async () => {
      const { data } = await supabase
        .from("prescricoes")
        .select("hd")
        .eq("residente_id", residenteId)
        .order("ano", { ascending: false })
        .order("mes", { ascending: false })
        .limit(1);
      return data?.[0]?.hd ?? null;
    },
  });

  const plano = useQuery({
    queryKey: ["plano-cuidados", residenteId],
    enabled: !!residenteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plano_cuidados")
        .select("*")
        .eq("ativo", true)
        .or(`residente_id.is.null,residente_id.eq.${residenteId}`)
        .order("numero");
      if (error) throw error;
      const todos = (data ?? []) as unknown as CuidadoPlano[];
      const proprios = todos.filter((c) => c.residente_id === residenteId);
      return proprios.length > 0 ? proprios : todos.filter((c) => c.residente_id === null);
    },
  });

  const primeiroDia = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const ultimoDia = `${ano}-${String(mes).padStart(2, "0")}-${String(diasDoMes(mes, ano)).padStart(2, "0")}`;

  const registros = useQuery({
    queryKey: ["registros-cuidados", residenteId, mes, ano],
    enabled: !!residenteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registros_cuidados")
        .select("*")
        .eq("residente_id", residenteId)
        .gte("data", primeiroDia)
        .lte("data", ultimoDia);
      if (error) throw error;
      return (data ?? []) as unknown as RegistroCuidado[];
    },
  });

  const diagnostico = useQuery({
    queryKey: ["diag-enf", residenteId, mes, ano],
    enabled: !!residenteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diagnosticos_enfermagem")
        .select("*")
        .eq("residente_id", residenteId)
        .eq("mes", mes)
        .eq("ano", ano)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    setDiagSel((diagnostico.data?.diagnosticos as string[] | undefined) ?? []);
    setDiagOutros(diagnostico.data?.outros_texto ?? "");
    setAssinaturaEnf(diagnostico.data?.assinatura_enfermeira ?? "");
    setEditandoDiag(false);
  }, [diagnostico.data, residenteId, mes, ano]);

  const cuidadosDoTurno = useMemo(
    () => (plano.data ?? []).filter((c) => c.turnos_aplicaveis.includes(turno)),
    [plano.data, turno],
  );

  // carrega marcações existentes do dia/turno selecionado
  useEffect(() => {
    const base: Record<string, Marcacao> = {};
    for (const c of cuidadosDoTurno) {
      const r = (registros.data ?? []).find(
        (x) => x.cuidado_id === c.id && x.data === data && x.turno === turno,
      );
      base[c.id] = { feito: !!r, observacao: r?.observacao ?? "" };
    }
    setMarcacoes(base);
  }, [registros.data, cuidadosDoTurno, data, turno]);

  const feitosCount = Object.values(marcacoes).filter((m) => m.feito).length;

  const assinaturasMes = useQuery({
    queryKey: ["assinaturas-presc-enf", residenteId, mes, ano],
    enabled: !!residenteId,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("assinaturas")
        .select("*")
        .eq("documento_tipo", "prescricao_enfermagem_turno")
        .eq("documento_id", residenteId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((rows ?? []) as unknown as Assinatura[]).filter((a) => {
        const ref = (a.documento_ref ?? {}) as { data?: string };
        return !!ref.data && ref.data >= primeiroDia && ref.data <= ultimoDia;
      });
    },
  });

  const assinaturaDoTurno = (d: string, t: Turno) =>
    (assinaturasMes.data ?? []).find((a) => {
      const ref = (a.documento_ref ?? {}) as { data?: string; turno?: string };
      return ref.data === d && ref.turno === t;
    }) ?? null;

  const turnoAssinado = assinaturaDoTurno(data, turno);

  const salvarTurno = useMutation({
    mutationFn: async (cred: CredencialAssinatura) => {
      if (!residenteId) throw new Error("Selecione um residente");
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Sessão expirada");
      const nome = perfil?.fullName ?? userData.user?.email ?? "Profissional";

      const paraSalvar = cuidadosDoTurno.filter((c) => marcacoes[c.id]?.feito);
      const paraRemover = cuidadosDoTurno.filter((c) => !marcacoes[c.id]?.feito);

      if (paraSalvar.length > 0) {
        const { error } = await supabase.from("registros_cuidados").upsert(
          paraSalvar.map((c) => ({
            residente_id: residenteId,
            cuidado_id: c.id,
            data,
            turno,
            feito_em: new Date().toISOString(),
            responsavel_id: uid,
            responsavel_nome: nome,
            observacao: marcacoes[c.id]?.observacao?.trim() || null,
          })) as never,
          { onConflict: "residente_id,cuidado_id,data,turno" },
        );
        if (error) throw error;
      }
      if (paraRemover.length > 0) {
        const { error } = await supabase
          .from("registros_cuidados")
          .delete()
          .eq("residente_id", residenteId)
          .eq("data", data)
          .eq("turno", turno)
          .in(
            "cuidado_id",
            paraRemover.map((c) => c.id),
          );
        if (error) throw error;
      }

      const hash = await hashDocumento({
        tipo: "prescricao_enfermagem_turno",
        residente_id: residenteId,
        data,
        turno,
        cuidados: paraSalvar.map((c) => ({
          numero: c.numero,
          descricao: c.descricao,
          observacao: marcacoes[c.id]?.observacao?.trim() || null,
        })),
      });
      const { error: erroAss } = await supabase.rpc("registrar_assinatura", {
        _documento_tipo: "prescricao_enfermagem_turno",
        _documento_id: residenteId,
        _hash: hash,
        _pin: cred.pin ?? undefined,
        _metodo: cred.metodo,
        _documento_ref: { residente_id: residenteId, data, turno } as never,
      });
      if (erroAss) throw erroAss;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["registros-cuidados"] });
      qc.invalidateQueries({ queryKey: ["assinaturas-presc-enf"] });
      toast.success("Turno registrado e assinado eletronicamente");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const salvarDiagnostico = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("diagnosticos_enfermagem").upsert(
        {
          residente_id: residenteId,
          mes,
          ano,
          diagnosticos: diagSel,
          outros_texto: diagOutros.trim() || null,
          assinatura_enfermeira: assinaturaEnf.trim() || null,
        } as never,
        { onConflict: "residente_id,mes,ano" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["diag-enf"] });
      setEditandoDiag(false);
      toast.success("Diagnóstico de enfermagem salvo");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dias = diasDoMes(mes, ano);
  const regMap = useMemo(() => {
    const m = new Map<string, RegistroCuidado>();
    for (const r of registros.data ?? []) m.set(`${r.cuidado_id}|${r.data}|${r.turno}`, r);
    return m;
  }, [registros.data]);

  const equipeDoMes = useMemo(() => {
    const s = new Set<string>();
    for (const r of registros.data ?? []) if (r.responsavel_nome) s.add(r.responsavel_nome);
    return [...s].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [registros.data]);

  const totalPossivel = useMemo(() => {
    const hojeDia =
      new Date().getFullYear() === ano && new Date().getMonth() + 1 === mes
        ? new Date().getDate()
        : new Date(ano, mes - 1, 1) > new Date()
          ? 0
          : dias;
    return (plano.data ?? []).reduce((n, c) => n + c.turnos_aplicaveis.length * hojeDia, 0);
  }, [plano.data, dias, mes, ano]);

  const percentual =
    totalPossivel > 0 ? Math.round(((registros.data?.length ?? 0) / totalPossivel) * 100) : 0;

  const imprimir = () => {
    if (!residente) return;
    const cuidados = plano.data ?? [];
    const cab = Array.from({ length: dias }, (_, i) => `<th>${i + 1}</th>`).join("");
    const linhas = cuidados
      .map((c) => {
        const cels = Array.from({ length: dias }, (_, i) => {
          const dataIso = `${ano}-${String(mes).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
          const marcas = TURNOS.filter(
            (t) => c.turnos_aplicaveis.includes(t) && regMap.has(`${c.id}|${dataIso}|${t}`),
          )
            .map((t) => TURNO_SIGLA[t])
            .join("");
          return `<td class="${marcas ? "ok" : ""}">${marcas}</td>`;
        }).join("");
        return `<tr><td class="num">${c.numero}</td><td class="desc">${esc(c.descricao)}</td>${cels}</tr>`;
      })
      .join("");
    const diagTxt =
      [...diagSel, diagOutros.trim() ? `Outros: ${diagOutros.trim()}` : ""]
        .filter(Boolean)
        .map(esc)
        .join(" • ") || "—";
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
<title>Prescrição de Enfermagem — ${esc(residente.nome_completo)}</title>
<style>
  @page { size: A4 landscape; margin: 8mm; }
  body { font-family: Arial, sans-serif; color:#111; margin:0; font-size:8pt; }
  h1 { font-size:14pt; margin:0 0 2px; text-transform:uppercase; }
  .meta { font-size:9pt; margin-bottom:6px; }
  .diag { border:1px solid #999; padding:4px 6px; margin-bottom:6px; font-size:8pt; }
  table { width:100%; border-collapse:collapse; table-layout:fixed; }
  th, td { border:1px solid #666; text-align:center; padding:1px; font-size:6.5pt; height:16px; }
  td.desc { text-align:left; font-size:6.5pt; width:150px; }
  td.num { width:16px; font-weight:700; }
  td.ok { background:#c6f0c6; font-weight:700; }
  .ass { display:flex; gap:24px; margin-top:18px; font-size:8pt; }
  .ass div { flex:1; border-top:1px solid #111; padding-top:3px; }
</style></head><body>
  <h1>Prescrição de Enfermagem</h1>
  <div class="meta"><b>${esc(residente.nome_completo)}</b> — Nasc.: ${residente.data_nascimento ? new Date(residente.data_nascimento + "T00:00:00").toLocaleDateString("pt-BR") : "—"} • Quarto: ${esc((residente as any).quartos?.numero ?? "—")} • HD: ${esc(hd.data ?? "—")} • Ref.: ${MESES[mes - 1]}/${ano}</div>
  <div class="diag"><b>Diagnósticos de enfermagem:</b> ${diagTxt}</div>
  <table><thead><tr><th style="width:16px">#</th><th style="width:150px">Cuidado</th>${cab}</tr></thead><tbody>${linhas}</tbody></table>
  <div class="ass">
    <div>Carimbo e assinatura da Enfermeira: ${esc(assinaturaEnf || "")}</div>
    <div>Equipe de enfermagem: ${esc(equipeDoMes.join(", ") || "—")}</div>
  </div>
  <script>window.addEventListener('load', () => setTimeout(() => window.print(), 300));</script>
</body></html>`;
    const w = window.open("", "_blank", "width=1200,height=900");
    if (!w) {
      toast.error("Bloqueador de pop-ups impediu a impressão");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="space-y-6">
      {/* Seletores */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-64">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
            Residente
          </p>
          <Select value={residenteId} onValueChange={setResidenteId}>
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Selecionar residente" />
            </SelectTrigger>
            <SelectContent>
              {residentes.data?.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.nome_completo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
            Mês
          </p>
          <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESES.map((m, i) => (
                <SelectItem key={m} value={String(i + 1)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
            Ano
          </p>
          <Input
            type="number"
            value={ano}
            onChange={(e) => setAno(Number(e.target.value))}
            className="w-28"
          />
        </div>
        <div className="ml-auto flex items-center gap-1 bg-muted rounded-md p-1">
          <button
            onClick={() => setModo("hoje")}
            className={cn(
              "px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-colors",
              modo === "hoje" ? "bg-foreground text-background" : "text-muted-foreground",
            )}
          >
            <CalendarDays className="size-3.5" /> Preencher hoje
          </button>
          <button
            onClick={() => setModo("mes")}
            className={cn(
              "px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-colors",
              modo === "mes" ? "bg-foreground text-background" : "text-muted-foreground",
            )}
          >
            <Table2 className="size-3.5" /> Visualizar mês
          </button>
        </div>
      </div>

      {!residenteId ? (
        <div className="bg-surface border border-border rounded-lg p-12 text-center">
          <ClipboardList className="size-8 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Selecione um residente para abrir a prescrição de enfermagem.
          </p>
        </div>
      ) : (
        <>
          {/* Cabeçalho fixo do residente */}
          <div className="bg-surface border border-border rounded-lg p-5 grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              ["Residente", residente?.nome_completo ?? "—"],
              [
                "Data de nascimento",
                residente?.data_nascimento
                  ? `${new Date(residente.data_nascimento + "T00:00:00").toLocaleDateString("pt-BR")} (${calcularIdade(residente.data_nascimento)} anos)`
                  : "—",
              ],
              ["Quarto", (residente as any)?.quartos?.numero ?? "—"],
              ["HD", hd.data ?? "—"],
              ["Referência", `${MESES[mes - 1]}/${ano}`],
            ].map(([k, v]) => (
              <div key={k as string}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {k}
                </p>
                <p className="text-sm font-semibold mt-0.5 break-words">{v}</p>
              </div>
            ))}
          </div>

          {/* Diagnóstico de enfermagem */}
          <div className="bg-surface border border-border rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold uppercase tracking-wider">
                Diagnóstico de Enfermagem — {MESES[mes - 1]}/{ano}
              </h2>
              {editandoDiag ? (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditandoDiag(false)}>
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => salvarDiagnostico.mutate()}
                    disabled={salvarDiagnostico.isPending}
                  >
                    <Save className="size-3.5 mr-1" /> Salvar
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setEditandoDiag(true)}>
                  <Pencil className="size-3.5 mr-1" /> Editar diagnóstico
                </Button>
              )}
            </div>

            {editandoDiag ? (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {DIAGNOSTICOS_ENFERMAGEM.map((d) => (
                    <Chip
                      key={d}
                      ativo={diagSel.includes(d)}
                      onClick={() =>
                        setDiagSel((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d]))
                      }
                    >
                      {d}
                    </Chip>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Outros diagnósticos…"
                    value={diagOutros}
                    onChange={(e) => setDiagOutros(e.target.value)}
                  />
                  <DitarAudio
                    onTexto={(t) => setDiagOutros((v) => (v ? `${v.trim()} ${t}` : t))}
                  />
                </div>
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                <Lock className="size-3.5 text-muted-foreground" />
                {diagSel.length === 0 && !diagOutros ? (
                  <span className="text-xs text-muted-foreground">
                    Nenhum diagnóstico registrado para este mês.
                  </span>
                ) : (
                  <>
                    {diagSel.map((d) => (
                      <span
                        key={d}
                        className="px-3 py-1 rounded-full text-xs font-semibold bg-muted border border-border"
                      >
                        {d}
                      </span>
                    ))}
                    {diagOutros && (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-muted border border-border">
                        Outros: {diagOutros}
                      </span>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {modo === "hoje" ? (
            <div className="bg-surface border border-border rounded-lg p-5 space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Data
                  </p>
                  <Input
                    type="date"
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    className="w-44"
                  />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Turno
                  </p>
                  <div className="flex gap-1.5">
                    {TURNOS.map((t) => (
                      <Chip key={t} ativo={turno === t} onClick={() => setTurno(t)}>
                        {TURNO_LABEL[t]}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Progresso do turno
                  </p>
                  <p className="text-sm font-extrabold">
                    {feitosCount} de {cuidadosDoTurno.length} cuidados registrados
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {cuidadosDoTurno.map((c) => {
                  const m = marcacoes[c.id] ?? { feito: false, observacao: "" };
                  return (
                    <div
                      key={c.id}
                      className={cn(
                        "border rounded-lg p-3 transition-colors",
                        m.feito ? "border-primary/40 bg-primary/5" : "border-border bg-muted/40",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-xs font-mono font-bold text-muted-foreground mt-1.5 w-5">
                          {c.numero}
                        </span>
                        <p className="flex-1 text-sm font-medium leading-snug">{c.descricao}</p>
                        <Chip
                          ativo={m.feito}
                          onClick={() =>
                            setMarcacoes((s) => ({
                              ...s,
                              [c.id]: { ...m, feito: !m.feito },
                            }))
                          }
                        >
                          {m.feito ? "Feito ✓" : "Marcar feito"}
                        </Chip>
                      </div>
                      {m.feito && (
                        <div className="flex items-center gap-2 mt-2 pl-8">
                          <Input
                            placeholder="Observação rápida (opcional)"
                            value={m.observacao}
                            onChange={(e) =>
                              setMarcacoes((s) => ({
                                ...s,
                                [c.id]: { ...m, observacao: e.target.value },
                              }))
                            }
                            className="h-8 text-xs"
                          />
                          <DitarAudio
                            onTexto={(t) =>
                              setMarcacoes((s) => ({
                                ...s,
                                [c.id]: {
                                  ...m,
                                  observacao: m.observacao ? `${m.observacao.trim()} ${t}` : t,
                                },
                              }))
                            }
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
                {cuidadosDoTurno.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Nenhum cuidado previsto para este turno.
                  </p>
                )}
              </div>

              <div className="pt-2 border-t border-border space-y-3">
                {turnoAssinado ? (
                  <div className="border border-border rounded-md p-3 bg-muted/40">
                    <p className="text-xs font-bold mb-1 flex items-center gap-1.5">
                      <Lock className="size-3.5" /> Turno já assinado eletronicamente
                    </p>
                    <CarimboAssinatura assinatura={turnoAssinado} />
                    <p className="text-[11px] text-muted-foreground mt-2">
                      Uma nova assinatura sobrepõe o registro anterior e fica registrada no
                      histórico de auditoria.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Ao salvar, o turno será assinado eletronicamente por{" "}
                    <strong>{perfil?.fullName ?? "—"}</strong>, substituindo o campo manuscrito
                    “Assinatura e Carimbo”.
                  </p>
                )}
                <div className="flex justify-end">
                  <Button onClick={() => setAssinaturaAberta(true)} disabled={salvarTurno.isPending}>
                    <PenLine className="size-4 mr-1" />
                    {salvarTurno.isPending ? "Assinando…" : "Salvar e assinar turno"}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm text-muted-foreground">
                  Grade mensal somente leitura • {registros.data?.length ?? 0} registros •{" "}
                  <span className="font-bold text-foreground">{percentual}%</span> dos cuidados
                  previstos até hoje
                </p>
                <Button onClick={imprimir}>
                  <Printer className="size-4 mr-1" /> Exportar / Imprimir (A4)
                </Button>
              </div>

              <div className="bg-surface border border-border rounded-lg overflow-auto">
                <table className="text-[10px] border-collapse w-full">
                  <thead>
                    <tr className="bg-muted">
                      <th className="sticky left-0 bg-muted border border-border px-2 py-1 text-left w-8">
                        #
                      </th>
                      <th className="sticky left-8 bg-muted border border-border px-2 py-1 text-left min-w-56">
                        Cuidado
                      </th>
                      {Array.from({ length: dias }, (_, i) => (
                        <th key={i} className="border border-border px-1 py-1 w-8">
                          {i + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(plano.data ?? []).map((c) => (
                      <tr key={c.id}>
                        <td className="sticky left-0 bg-surface border border-border px-2 py-1 font-bold">
                          {c.numero}
                        </td>
                        <td className="sticky left-8 bg-surface border border-border px-2 py-1 leading-tight">
                          {c.descricao}
                        </td>
                        {Array.from({ length: dias }, (_, i) => {
                          const dataIso = `${ano}-${String(mes).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
                          const regs = TURNOS.filter((t) => c.turnos_aplicaveis.includes(t)).map(
                            (t) => ({ t, r: regMap.get(`${c.id}|${dataIso}|${t}`) }),
                          );
                          const algum = regs.some((x) => x.r);
                          return (
                            <td
                              key={i}
                              className={cn(
                                "border border-border text-center p-0",
                                algum ? "bg-green-100" : "bg-muted/30",
                              )}
                            >
                              <div className="flex justify-center gap-0.5 py-1">
                                {regs.map(({ t, r }) => (
                                  <button
                                    key={t}
                                    type="button"
                                    disabled={!r}
                                    onClick={() => r && setCelula(r)}
                                    className={cn(
                                      "text-[9px] font-bold leading-none",
                                      r
                                        ? "text-green-700 hover:underline"
                                        : "text-muted-foreground/40 cursor-default",
                                    )}
                                  >
                                    {TURNO_SIGLA[t]}
                                  </button>
                                ))}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-surface border border-border rounded-lg p-5 grid md:grid-cols-2 gap-6">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Carimbo e assinatura da Enfermeira (responsável técnica)
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={assinaturaEnf}
                      onChange={(e) => setAssinaturaEnf(e.target.value)}
                      placeholder="Nome e COREN"
                    />
                    <Button
                      variant="outline"
                      onClick={() => salvarDiagnostico.mutate()}
                      disabled={salvarDiagnostico.isPending}
                    >
                      Salvar
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Carimbo e assinatura da equipe de enfermagem
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {equipeDoMes.length === 0 ? (
                      <span className="text-xs text-muted-foreground">
                        Nenhum registro neste mês.
                      </span>
                    ) : (
                      equipeDoMes.map((n) => (
                        <span
                          key={n}
                          className="px-3 py-1 rounded-full text-xs font-semibold bg-muted border border-border"
                        >
                          {n}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={!!celula} onOpenChange={(o) => !o && setCelula(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhe do registro</DialogTitle>
          </DialogHeader>
          {celula && (
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Cuidado
                </p>
                <p>{plano.data?.find((c) => c.id === celula.cuidado_id)?.descricao}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Data / Turno
                  </p>
                  <p>
                    {new Date(celula.data + "T00:00:00").toLocaleDateString("pt-BR")} •{" "}
                    {TURNO_LABEL[celula.turno]}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Horário
                  </p>
                  <p>{new Date(celula.feito_em).toLocaleString("pt-BR")}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Responsável
                </p>
                <p>{celula.responsavel_nome ?? "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Observação
                </p>
                <p>{celula.observacao || "—"}</p>
              </div>
              {(() => {
                const a = assinaturaDoTurno(celula.data, celula.turno as Turno);
                return a ? (
                  <div className="border-t border-border pt-3">
                    <CarimboAssinatura assinatura={a} />
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AssinaturaDialog
        open={assinaturaAberta}
        onOpenChange={setAssinaturaAberta}
        titulo="Assinar registro do turno"
        descricao="Substitui o campo manuscrito “Assinatura e Carimbo” do formulário físico."
        onConfirmar={async (cred) => {
          await salvarTurno.mutateAsync(cred);
        }}
      />
    </div>
  );
}
