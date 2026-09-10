import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePerfilAtual } from "@/hooks/use-perfil";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TextareaDitavel } from "@/components/ditar-audio";
import { cn } from "@/lib/utils";
import { AlertTriangle, CalendarDays, Copy, FileSpreadsheet, Plus, Printer, Repeat, Trash2 } from "lucide-react";
import {
  type Afastamento,
  type EscalaConfig,
  type Turno,
  DIAS_SEMANA,
  SETORES,
  STATUS_TURNO,
  TIPOS_AFASTAMENTO,
  TIPOS_ESCALA,
  TURNOS,
  addDias,
  coberturaDoDia,
  corStatus,
  corTurno,
  dataCurta,
  duracaoHoras,
  faltaCobertura,
  fimMes,
  horasNoMes,
  inicioMes,
  inicioSemana,
  intervaloDias,
  iso,
  nomeSetor,
  nomeStatus,
  nomeTurno,
  parseISO,
  validarTurno,
} from "@/lib/escala";

export const Route = createFileRoute("/_authenticated/escala")({
  head: () => ({
    meta: [
      { title: "Escala de Trabalho — Residencial São Camilo" },
      {
        name: "description",
        content:
          "Planeamento e controlo dos turnos da equipa da ILPI, com cobertura mínima 24h, validações CLT e impressão da escala.",
      },
      { property: "og:title", content: "Escala de Trabalho — Residencial São Camilo" },
      {
        property: "og:description",
        content: "Grade de plantões por colaborador, deteção de conflitos, afastamentos e exportação em PDF.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EscalaPage,
});

type Colaborador = { id: string; full_name: string; funcao: string | null };

const VAZIO = {
  id: "",
  colaborador_id: "",
  setor: "enfermagem",
  cargo: "",
  data: iso(new Date()),
  turno: "manha",
  hora_inicio: "07:00",
  hora_fim: "13:00",
  tipo_escala: "12x36",
  status: "confirmado",
  observacoes: "",
};

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
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

function EscalaPage() {
  const qc = useQueryClient();
  const perfil = usePerfilAtual().data;
  const podeEditar = !!perfil && (perfil.isAdmin || perfil.roles.includes("gerente"));

  const [aba, setAba] = useState<"escala" | "afastamentos" | "historico">("escala");
  const [categoria, setCategoria] = useState<"enfermagem" | "cuidados_diretos" | "outros">(
    "enfermagem",
  );
  const nomeCategoria =
    categoria === "enfermagem"
      ? "Enfermagem"
      : categoria === "cuidados_diretos"
        ? "Cuidadoras"
        : "Outros setores";
  const [visao, setVisao] = useState<"semanal" | "quinzenal" | "mensal">("semanal");
  const [ancora, setAncora] = useState(iso(new Date()));
  const [busca, setBusca] = useState("");
  const [fSetor, setFSetor] = useState("todos");
  const [fTurno, setFTurno] = useState("todos");
  const [fStatus, setFStatus] = useState("todos");

  const de = visao === "mensal" ? inicioMes(ancora) : inicioSemana(ancora);
  const ate =
    visao === "mensal" ? fimMes(ancora) : addDias(de, visao === "semanal" ? 6 : 13);
  const dias = useMemo(() => intervaloDias(de, ate), [de, ate]);

  const config = useQuery({
    queryKey: ["escala-config"],
    queryFn: async () => {
      const { data } = await supabase.from("escala_config").select("*").maybeSingle();
      return (data ?? {
        min_manha: 2,
        min_tarde: 2,
        min_noite: 2,
        limite_horas_mensal: 220,
        interjornada_horas: 11,
      }) as EscalaConfig;
    },
  });

  const colaboradores = useQuery({
    queryKey: ["escala-colaboradores"],
    enabled: podeEditar,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("listar_profissionais");
      if (error) throw error;
      return (data ?? [])
        .filter((p) => (p as { na_escala?: boolean }).na_escala !== false)
        .map((p) => ({
          id: p.id,
          full_name: p.full_name,
          funcao: p.funcao,
        })) as Colaborador[];
    },
  });

  const turnosQ = useQuery({
    queryKey: ["escala-turnos", de, ate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("escala_turnos")
        .select(
          "id, colaborador_id, colaborador_nome, setor, cargo, data, hora_inicio, hora_fim, tipo_escala, turno, status, observacoes",
        )
        .gte("data", addDias(de, -7))
        .lte("data", addDias(ate, 7))
        .order("data");
      if (error) throw error;
      return (data ?? []) as Turno[];
    },
  });

  const afastamentosQ = useQuery({
    queryKey: ["escala-afastamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("escala_afastamentos")
        .select("id, colaborador_id, tipo, data_inicio, data_fim, observacoes")
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Afastamento[];
    },
  });

  const historico = useQuery({
    queryKey: ["escala-historico"],
    enabled: aba === "historico",
    queryFn: async () => {
      const { data } = await supabase
        .from("escala_historico")
        .select("id, acao, user_nome, detalhes, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const todosTurnos = turnosQ.data ?? [];
  const cfg = config.data ?? {
    min_manha: 2,
    min_tarde: 2,
    min_noite: 2,
    limite_horas_mensal: 220,
    interjornada_horas: 11,
  };

  const visiveis = useMemo(() => {
    return todosTurnos.filter((t) => {
      if (!podeEditar && t.colaborador_id !== perfil?.userId) return false;
      if (t.data < de || t.data > ate) return false;
      if (categoria === "outros") {
        if (t.setor === "enfermagem" || t.setor === "cuidados_diretos") return false;
        if (fSetor !== "todos" && t.setor !== fSetor) return false;
      } else if (t.setor !== categoria) return false;
      if (fTurno !== "todos" && t.turno !== fTurno) return false;
      if (fStatus !== "todos" && t.status !== fStatus) return false;
      if (busca.trim() && !(t.colaborador_nome ?? "").toLowerCase().includes(busca.trim().toLowerCase()))
        return false;
      return true;
    });
  }, [todosTurnos, podeEditar, perfil?.userId, de, ate, fSetor, fTurno, fStatus, busca]);

  const linhas = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of visiveis) map.set(t.colaborador_id, t.colaborador_nome ?? "Colaborador");
    if (podeEditar) {
      for (const c of colaboradores.data ?? []) {
        const bateBusca =
          !busca.trim() || c.full_name.toLowerCase().includes(busca.trim().toLowerCase());
        if (bateBusca && !map.has(c.id)) map.set(c.id, c.full_name);
      }
    }
    return [...map.entries()]
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [visiveis, colaboradores.data, podeEditar, busca]);

  /* ---------------- mutations ---------------- */

  async function registrarHistorico(acao: string, turnoId: string | null, detalhes: Record<string, unknown>) {
    await supabase.from("escala_historico").insert({
      turno_id: turnoId,
      acao,
      user_id: perfil?.userId ?? null,
      user_nome: perfil?.fullName ?? null,
      detalhes: detalhes as never,
    });
  }

  const salvar = useMutation({
    mutationFn: async (payload: typeof VAZIO & { repetirSemanas: number }) => {
      const nome =
        colaboradores.data?.find((c) => c.id === payload.colaborador_id)?.full_name ?? null;
      const base = {
        colaborador_id: payload.colaborador_id,
        colaborador_nome: nome,
        setor: payload.setor,
        cargo: payload.cargo || null,
        hora_inicio: payload.hora_inicio,
        hora_fim: payload.hora_fim,
        tipo_escala: payload.tipo_escala,
        turno: payload.turno,
        status: payload.status,
        observacoes: payload.observacoes || null,
        criado_por: perfil?.userId ?? null,
      };
      if (payload.id) {
        const { error } = await supabase
          .from("escala_turnos")
          .update({ ...base, data: payload.data })
          .eq("id", payload.id);
        if (error) throw error;
        await registrarHistorico("edicao", payload.id, { ...base, data: payload.data });
        return;
      }
      const datas: string[] = [];
      const repeticoes = Math.max(1, payload.repetirSemanas);
      for (let i = 0; i < repeticoes; i++) datas.push(addDias(payload.data, i * 7));
      const { data, error } = await supabase
        .from("escala_turnos")
        .insert(datas.map((d) => ({ ...base, data: d })))
        .select("id");
      if (error) throw error;
      await registrarHistorico("criacao", data?.[0]?.id ?? null, {
        colaborador: nome,
        datas,
        turno: payload.turno,
      });
    },
    onSuccess: () => {
      toast.success("Escala guardada");
      qc.invalidateQueries({ queryKey: ["escala-turnos"] });
      qc.invalidateQueries({ queryKey: ["escala-historico"] });
      setDialogTurno(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (t: Turno) => {
      const { error } = await supabase.from("escala_turnos").delete().eq("id", t.id);
      if (error) throw error;
      await registrarHistorico("exclusao", t.id, {
        colaborador: t.colaborador_nome,
        data: t.data,
        turno: t.turno,
      });
    },
    onSuccess: () => {
      toast.success("Turno eliminado");
      qc.invalidateQueries({ queryKey: ["escala-turnos"] });
      setDetalhe(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mover = useMutation({
    mutationFn: async (p: { turno: Turno; colaboradorId: string; data: string }) => {
      const nome =
        colaboradores.data?.find((c) => c.id === p.colaboradorId)?.full_name ??
        p.turno.colaborador_nome;
      const trocou = p.colaboradorId !== p.turno.colaborador_id;
      const { error } = await supabase
        .from("escala_turnos")
        .update({
          colaborador_id: p.colaboradorId,
          colaborador_nome: nome,
          data: p.data,
          status: trocou ? "trocado" : p.turno.status,
        })
        .eq("id", p.turno.id);
      if (error) throw error;
      await registrarHistorico(trocou ? "troca" : "remarcacao", p.turno.id, {
        de: { colaborador: p.turno.colaborador_nome, data: p.turno.data },
        para: { colaborador: nome, data: p.data },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["escala-turnos"] });
      qc.invalidateQueries({ queryKey: ["escala-historico"] });
      toast.success("Turno realocado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicarPeriodo = useMutation({
    mutationFn: async () => {
      const tamanho = dias.length;
      const origem = todosTurnos.filter((t) => t.data >= de && t.data <= ate);
      if (!origem.length) throw new Error("Não há turnos no período atual para duplicar");
      const novos = origem.map((t) => ({
        colaborador_id: t.colaborador_id,
        colaborador_nome: t.colaborador_nome,
        setor: t.setor,
        cargo: t.cargo,
        data: addDias(t.data, tamanho),
        hora_inicio: t.hora_inicio,
        hora_fim: t.hora_fim,
        tipo_escala: t.tipo_escala,
        turno: t.turno,
        status: "pendente",
        observacoes: t.observacoes,
        criado_por: perfil?.userId ?? null,
      }));
      const { error } = await supabase.from("escala_turnos").insert(novos);
      if (error) throw error;
      await registrarHistorico("duplicacao", null, { de, ate, total: novos.length });
    },
    onSuccess: () => {
      toast.success("Período duplicado (turnos criados como pendentes)");
      qc.invalidateQueries({ queryKey: ["escala-turnos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const salvarAfastamento = useMutation({
    mutationFn: async (p: { colaborador_id: string; tipo: string; data_inicio: string; data_fim: string; observacoes: string }) => {
      const { error } = await supabase.from("escala_afastamentos").insert({
        colaborador_id: p.colaborador_id,
        tipo: p.tipo,
        data_inicio: p.data_inicio,
        data_fim: p.data_fim,
        observacoes: p.observacoes || null,
        criado_por: perfil?.userId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Afastamento registado");
      qc.invalidateQueries({ queryKey: ["escala-afastamentos"] });
      setDialogAfast(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluirAfastamento = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("escala_afastamentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["escala-afastamentos"] });
      toast.success("Afastamento removido");
    },
  });

  /* ---------------- dialogs ---------------- */

  const [dialogTurno, setDialogTurno] = useState<(typeof VAZIO & { repetirSemanas: number }) | null>(null);
  const [detalhe, setDetalhe] = useState<Turno | null>(null);
  const [dialogAfast, setDialogAfast] = useState(false);
  const [afastForm, setAfastForm] = useState({
    colaborador_id: "",
    tipo: "ferias",
    data_inicio: iso(new Date()),
    data_fim: iso(new Date()),
    observacoes: "",
  });

  const conflitosForm = useMemo(() => {
    if (!dialogTurno || !dialogTurno.colaborador_id) return [];
    return validarTurno(
      {
        id: dialogTurno.id,
        colaborador_id: dialogTurno.colaborador_id,
        colaborador_nome: null,
        setor: dialogTurno.setor,
        cargo: dialogTurno.cargo,
        data: dialogTurno.data,
        hora_inicio: dialogTurno.hora_inicio,
        hora_fim: dialogTurno.hora_fim,
        tipo_escala: dialogTurno.tipo_escala,
        turno: dialogTurno.turno,
        status: dialogTurno.status,
        observacoes: dialogTurno.observacoes,
      },
      todosTurnos,
      afastamentosQ.data ?? [],
      cfg,
    );
  }, [dialogTurno, todosTurnos, afastamentosQ.data, cfg]);

  const bloqueado = conflitosForm.some((c) => c.tipo === "sobreposicao" || c.tipo === "afastamento");

  function abrirNovo(colaboradorId?: string, data?: string) {
    if (!podeEditar) return;
    setDialogTurno({
      ...VAZIO,
      colaborador_id: colaboradorId ?? "",
      data: data ?? ancora,
      repetirSemanas: 1,
    });
  }

  function aplicarTurnoPreset(chave: string) {
    const t = TURNOS.find((x) => x.chave === chave);
    setDialogTurno((d) =>
      d ? { ...d, turno: chave, hora_inicio: t?.inicio ?? d.hora_inicio, hora_fim: t?.fim ?? d.hora_fim } : d,
    );
  }

  /* ---------------- drag & drop ---------------- */
  const [arrastando, setArrastando] = useState<Turno | null>(null);

  function soltar(colaboradorId: string, data: string) {
    if (!arrastando || !podeEditar) return;
    if (arrastando.colaborador_id === colaboradorId && arrastando.data === data) return;
    mover.mutate({ turno: arrastando, colaboradorId, data });
    setArrastando(null);
  }

  /* ---------------- exportação Excel ---------------- */
  async function exportarExcel() {
    const XLSX = await import("xlsx");
    const registros = [...visiveis]
      .sort((a, b) => (a.data === b.data ? a.hora_inicio.localeCompare(b.hora_inicio) : a.data.localeCompare(b.data)))
      .map((t) => {
        const dt = parseISO(t.data);
        return {
          Data: dataCurta(t.data),
          "Dia da semana": DIAS_SEMANA[dt.getDay()],
          Colaborador: t.colaborador_nome ?? "",
          Cargo: t.cargo ?? "",
          Setor: nomeSetor(t.setor),
          Turno: nomeTurno(t.turno),
          Início: t.hora_inicio.slice(0, 5),
          Fim: t.hora_fim.slice(0, 5),
          Horas: duracaoHoras(t.hora_inicio, t.hora_fim),
          "Tipo de escala": TIPOS_ESCALA.find((x) => x.chave === t.tipo_escala)?.nome ?? t.tipo_escala,
          Status: nomeStatus(t.status),
          Observações: t.observacoes ?? "",
        };
      });

    if (!registros.length) {
      toast.error("Não há turnos no período para exportar");
      return;
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(registros);
    ws["!cols"] = [
      { wch: 11 }, { wch: 14 }, { wch: 30 }, { wch: 18 }, { wch: 18 },
      { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 7 }, { wch: 16 },
      { wch: 12 }, { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Escala");

    // aba resumo por colaborador
    const resumo = linhas
      .map((l) => {
        const meus = visiveis.filter((t) => t.colaborador_id === l.id);
        return {
          Colaborador: l.nome,
          Plantões: meus.length,
          "Total de horas": meus.reduce((s, t) => s + duracaoHoras(t.hora_inicio, t.hora_fim), 0),
        };
      })
      .filter((r) => r.Plantões > 0);
    if (resumo.length) {
      const ws2 = XLSX.utils.json_to_sheet(resumo);
      ws2["!cols"] = [{ wch: 30 }, { wch: 10 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, ws2, "Resumo");
    }

    XLSX.writeFile(wb, `escala-${de}-a-${ate}.xlsx`);
    toast.success("Planilha da escala gerada");
  }

  /* ---------------- impressão ---------------- */
  function imprimir() {
    const linhasHtml = linhas
      .map((l) => {
        const cells = dias
          .map((d) => {
            const its = visiveis.filter((t) => t.colaborador_id === l.id && t.data === d);
            return `<td>${its
              .map((t) => `${nomeTurno(t.turno)}<br/><small>${t.hora_inicio.slice(0, 5)}–${t.hora_fim.slice(0, 5)}</small>`)
              .join("<hr/>")}</td>`;
          })
          .join("");
        return `<tr><th class="nome">${l.nome}</th>${cells}</tr>`;
      })
      .join("");
    const head = dias
      .map((d) => {
        const dt = parseISO(d);
        return `<th>${DIAS_SEMANA[dt.getDay()]}<br/>${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}</th>`;
      })
      .join("");
    const w = window.open("", "_blank", "width=1200,height=800");
    if (!w) return;
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
<title>Escala de Trabalho</title><style>
@page { size: A4 landscape; margin: 10mm; }
body { font-family: system-ui, sans-serif; color: #111; }
h1 { font-size: 16pt; margin: 0 0 2mm; }
p.sub { font-size: 9pt; margin: 0 0 4mm; color: #555; }
table { border-collapse: collapse; width: 100%; font-size: 7.5pt; }
th, td { border: 1px solid #999; padding: 2px 3px; text-align: center; vertical-align: top; }
th.nome { text-align: left; width: 40mm; font-size: 8pt; }
hr { border: 0; border-top: 1px dashed #bbb; margin: 1px 0; }
</style></head><body>
<h1>Escala de Trabalho — Residencial São Camilo</h1>
<p class="sub">Período: ${dataCurta(de)} a ${dataCurta(ate)} — emitido em ${new Date().toLocaleString("pt-BR")}</p>
<table><thead><tr><th class="nome">Colaborador</th>${head}</tr></thead><tbody>${linhasHtml}</tbody></table>
</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }

  /* ---------------- render ---------------- */

  const alertasCobertura = dias
    .map((d) => ({ dia: d, faltas: faltaCobertura(visiveis, d, cfg) }))
    .filter((x) => x.faltas.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Chip active={aba === "escala"} onClick={() => setAba("escala")}>Escala</Chip>
        <Chip active={aba === "afastamentos"} onClick={() => setAba("afastamentos")}>Afastamentos</Chip>
        <Chip active={aba === "historico"} onClick={() => setAba("historico")}>Histórico</Chip>
      </div>

      {aba === "escala" && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Chip active={visao === "semanal"} onClick={() => setVisao("semanal")}>Semanal</Chip>
            <Chip active={visao === "quinzenal"} onClick={() => setVisao("quinzenal")}>Quinzenal</Chip>
            <Chip active={visao === "mensal"} onClick={() => setVisao("mensal")}>Mensal</Chip>
            <div className="flex items-center gap-1 ml-2">
              <Button variant="outline" size="sm" onClick={() => setAncora(addDias(ancora, visao === "mensal" ? -30 : visao === "quinzenal" ? -14 : -7))}>
                ◀
              </Button>
              <span className="text-xs font-bold px-2 whitespace-nowrap">
                {dataCurta(de)} – {dataCurta(ate)}
              </span>
              <Button variant="outline" size="sm" onClick={() => setAncora(addDias(ancora, visao === "mensal" ? 30 : visao === "quinzenal" ? 14 : 7))}>
                ▶
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAncora(iso(new Date()))}>Hoje</Button>
            </div>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={imprimir}>
                <Printer className="size-4 mr-1" /> Imprimir / PDF
              </Button>
              <Button variant="outline" size="sm" onClick={exportarExcel}>
                <FileSpreadsheet className="size-4 mr-1" /> Exportar Excel
              </Button>
              {podeEditar && (
                <>
                  <Button variant="outline" size="sm" onClick={() => duplicarPeriodo.mutate()} disabled={duplicarPeriodo.isPending}>
                    <Copy className="size-4 mr-1" /> Duplicar período
                  </Button>
                  <Button size="sm" onClick={() => abrirNovo()}>
                    <Plus className="size-4 mr-1" /> Novo turno
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label>Buscar colaborador</Label>
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome…" />
            </div>
            <div className="space-y-1.5">
              <Label>Setor</Label>
              <Select value={fSetor} onValueChange={setFSetor}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {SETORES.map((s) => <SelectItem key={s.chave} value={s.chave}>{s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Turno</Label>
              <Select value={fTurno} onValueChange={setFTurno}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {TURNOS.map((s) => <SelectItem key={s.chave} value={s.chave}>{s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={fStatus} onValueChange={setFStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {STATUS_TURNO.map((s) => <SelectItem key={s.chave} value={s.chave}>{s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {alertasCobertura.length > 0 && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs space-y-1">
              <p className="font-bold flex items-center gap-2 text-destructive">
                <AlertTriangle className="size-4" /> Cobertura mínima não atingida
              </p>
              {alertasCobertura.slice(0, 8).map((a) => (
                <p key={a.dia} className="text-muted-foreground">
                  {dataCurta(a.dia)}:{" "}
                  {a.faltas.map((f) => `${f.nome} ${f.atual}/${f.minimo}`).join(" • ")}
                </p>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2 text-[10px]">
            {TURNOS.map((t) => (
              <span key={t.chave} className={cn("px-2 py-1 rounded border font-bold", t.cor)}>{t.nome}</span>
            ))}
          </div>

          <div className="overflow-x-auto border border-border rounded-lg bg-surface">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-muted">
                  <th className="sticky left-0 bg-muted text-left p-2 font-bold min-w-[180px]">Colaborador</th>
                  {dias.map((d) => {
                    const falta = faltaCobertura(visiveis, d, cfg).length > 0;
                    const dt = parseISO(d);
                    return (
                      <th key={d} className={cn("p-2 font-bold min-w-[92px]", falta && "text-destructive")}>
                        {DIAS_SEMANA[dt.getDay()]}
                        <br />
                        {String(dt.getDate()).padStart(2, "0")}/{String(dt.getMonth() + 1).padStart(2, "0")}
                      </th>
                    );
                  })}
                  <th className="p-2 font-bold">Horas/mês</th>
                </tr>
              </thead>
              <tbody>
                {linhas.length === 0 && (
                  <tr>
                    <td colSpan={dias.length + 2} className="p-6 text-center text-muted-foreground">
                      Nenhum turno no período.
                    </td>
                  </tr>
                )}
                {linhas.map((l) => {
                  const horas = horasNoMes(todosTurnos, l.id, ancora);
                  const excedeu = horas > cfg.limite_horas_mensal;
                  const perto = !excedeu && horas > cfg.limite_horas_mensal * 0.9;
                  return (
                    <tr key={l.id} className="border-t border-border align-top">
                      <th className="sticky left-0 bg-surface text-left p-2 font-bold">{l.nome}</th>
                      {dias.map((d) => {
                        const its = visiveis.filter((t) => t.colaborador_id === l.id && t.data === d);
                        const af = (afastamentosQ.data ?? []).find(
                          (a) => a.colaborador_id === l.id && a.data_inicio <= d && a.data_fim >= d,
                        );
                        return (
                          <td
                            key={d}
                            onDragOver={(e) => podeEditar && e.preventDefault()}
                            onDrop={() => soltar(l.id, d)}
                            onDoubleClick={() => abrirNovo(l.id, d)}
                            className={cn("p-1 border-l border-border/60", af && "bg-muted/60")}
                          >
                            {af && !its.length && (
                              <span className="text-[9px] text-muted-foreground font-bold uppercase">
                                {TIPOS_AFASTAMENTO.find((x) => x.chave === af.tipo)?.nome ?? af.tipo}
                              </span>
                            )}
                            {its.map((t) => (
                              <button
                                key={t.id}
                                draggable={podeEditar}
                                onDragStart={() => setArrastando(t)}
                                onClick={() => setDetalhe(t)}
                                className={cn(
                                  "w-full text-left rounded border px-1.5 py-1 mb-1 font-bold",
                                  corTurno(t.turno),
                                  t.status === "cancelado" && "opacity-50 line-through",
                                  af && "ring-2 ring-destructive",
                                )}
                                title={af ? "Conflito: colaborador afastado" : nomeTurno(t.turno)}
                              >
                                <span className="flex items-center gap-1">
                                  <span className={cn("size-1.5 rounded-full", corStatus(t.status))} />
                                  {nomeTurno(t.turno)}
                                </span>
                                <span className="block text-[9px] font-medium opacity-80">
                                  {t.hora_inicio.slice(0, 5)}–{t.hora_fim.slice(0, 5)}
                                </span>
                              </button>
                            ))}
                          </td>
                        );
                      })}
                      <td className={cn("p-2 text-center font-bold", excedeu && "text-destructive", perto && "text-amber-600")}>
                        {horas.toFixed(0)}h
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {coberturaDoDia(visiveis, iso(new Date()), cfg).map((c) => (
              <div key={c.faixa} className="rounded-lg border border-border bg-surface p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                  Cobertura hoje — {c.nome}
                </p>
                <p className={cn("text-2xl font-extrabold", c.atual < c.minimo && "text-destructive")}>
                  {c.atual}
                  <span className="text-sm text-muted-foreground font-bold"> / {c.minimo}</span>
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      {aba === "afastamentos" && (
        <div className="space-y-4">
          {podeEditar && (
            <Button size="sm" onClick={() => setDialogAfast(true)}>
              <Plus className="size-4 mr-1" /> Registar afastamento
            </Button>
          )}
          <div className="space-y-2">
            {(afastamentosQ.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum afastamento registado.</p>
            )}
            {(afastamentosQ.data ?? []).map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
                <CalendarDays className="size-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">
                    {colaboradores.data?.find((c) => c.id === a.colaborador_id)?.full_name ??
                      todosTurnos.find((t) => t.colaborador_id === a.colaborador_id)?.colaborador_nome ??
                      "Colaborador"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {TIPOS_AFASTAMENTO.find((x) => x.chave === a.tipo)?.nome ?? a.tipo} •{" "}
                    {dataCurta(a.data_inicio)} a {dataCurta(a.data_fim)}
                    {a.observacoes ? ` • ${a.observacoes}` : ""}
                  </p>
                </div>
                {podeEditar && (
                  <Button variant="ghost" size="sm" onClick={() => excluirAfastamento.mutate(a.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {aba === "historico" && (
        <div className="space-y-2">
          {(historico.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Sem alterações registadas.</p>
          )}
          {(historico.data ?? []).map((h) => (
            <div key={h.id} className="rounded-lg border border-border bg-surface p-3 text-xs">
              <p className="font-bold uppercase tracking-wider">{h.acao}</p>
              <p className="text-muted-foreground">
                {h.user_nome ?? "—"} • {new Date(h.created_at).toLocaleString("pt-BR")}
              </p>
              <pre className="mt-1 whitespace-pre-wrap break-words text-[10px] text-muted-foreground">
                {JSON.stringify(h.detalhes)}
              </pre>
            </div>
          ))}
        </div>
      )}

      {/* Dialog criar/editar */}
      <Dialog open={!!dialogTurno} onOpenChange={(o) => !o && setDialogTurno(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialogTurno?.id ? "Editar turno" : "Novo turno"}</DialogTitle>
            <DialogDescription>
              As validações de sobreposição, interjornada, afastamentos e limite mensal são aplicadas automaticamente.
            </DialogDescription>
          </DialogHeader>
          {dialogTurno && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Colaborador</Label>
                  <Select
                    value={dialogTurno.colaborador_id}
                    onValueChange={(v) => setDialogTurno({ ...dialogTurno, colaborador_id: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {(colaboradores.data ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Cargo / função</Label>
                  <Input
                    value={dialogTurno.cargo}
                    onChange={(e) => setDialogTurno({ ...dialogTurno, cargo: e.target.value })}
                    placeholder="Ex.: Técnica de enfermagem"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Setor</Label>
                  <Select value={dialogTurno.setor} onValueChange={(v) => setDialogTurno({ ...dialogTurno, setor: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SETORES.map((s) => <SelectItem key={s.chave} value={s.chave}>{s.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo de escala</Label>
                  <Select value={dialogTurno.tipo_escala} onValueChange={(v) => setDialogTurno({ ...dialogTurno, tipo_escala: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPOS_ESCALA.map((s) => <SelectItem key={s.chave} value={s.chave}>{s.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Data</Label>
                  <Input type="date" value={dialogTurno.data} onChange={(e) => setDialogTurno({ ...dialogTurno, data: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Turno</Label>
                  <Select value={dialogTurno.turno} onValueChange={aplicarTurnoPreset}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TURNOS.map((s) => <SelectItem key={s.chave} value={s.chave}>{s.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Hora início</Label>
                  <Input type="time" value={dialogTurno.hora_inicio} onChange={(e) => setDialogTurno({ ...dialogTurno, hora_inicio: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Hora fim</Label>
                  <Input type="time" value={dialogTurno.hora_fim} onChange={(e) => setDialogTurno({ ...dialogTurno, hora_fim: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={dialogTurno.status} onValueChange={(v) => setDialogTurno({ ...dialogTurno, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_TURNO.map((s) => <SelectItem key={s.chave} value={s.chave}>{s.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {!dialogTurno.id && (
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1"><Repeat className="size-3.5" /> Repetir por (semanas)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={26}
                      value={dialogTurno.repetirSemanas}
                      onChange={(e) => setDialogTurno({ ...dialogTurno, repetirSemanas: Number(e.target.value) || 1 })}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Observações</Label>
                <TextareaDitavel
                  value={dialogTurno.observacoes}
                  onChange={(e) => setDialogTurno({ ...dialogTurno, observacoes: e.target.value })}
                  placeholder="Observações do plantão"
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Duração: <strong>{duracaoHoras(dialogTurno.hora_inicio, dialogTurno.hora_fim).toFixed(1)}h</strong>
              </p>

              {conflitosForm.length > 0 && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs space-y-1">
                  {conflitosForm.map((c, i) => (
                    <p key={i} className="flex items-start gap-2 text-destructive">
                      <AlertTriangle className="size-3.5 mt-0.5 shrink-0" /> {c.mensagem}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogTurno(null)}>Cancelar</Button>
            <Button
              disabled={!dialogTurno?.colaborador_id || bloqueado || salvar.isPending}
              onClick={() => dialogTurno && salvar.mutate(dialogTurno)}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog detalhe */}
      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detalhe?.colaborador_nome ?? "Turno"}</DialogTitle>
            <DialogDescription>
              {detalhe && `${dataCurta(detalhe.data)} • ${nomeTurno(detalhe.turno)} • ${detalhe.hora_inicio.slice(0, 5)}–${detalhe.hora_fim.slice(0, 5)}`}
            </DialogDescription>
          </DialogHeader>
          {detalhe && (
            <div className="space-y-2 text-sm">
              <p><strong>Setor:</strong> {nomeSetor(detalhe.setor)}</p>
              <p><strong>Cargo:</strong> {detalhe.cargo ?? "—"}</p>
              <p><strong>Tipo de escala:</strong> {detalhe.tipo_escala}</p>
              <p><strong>Status:</strong> {nomeStatus(detalhe.status)}</p>
              <p><strong>Duração:</strong> {duracaoHoras(detalhe.hora_inicio, detalhe.hora_fim).toFixed(1)}h</p>
              {detalhe.observacoes && <p><strong>Observações:</strong> {detalhe.observacoes}</p>}
            </div>
          )}
          {podeEditar && detalhe && (
            <DialogFooter className="flex-wrap gap-2">
              <Button variant="destructive" onClick={() => excluir.mutate(detalhe)}>
                <Trash2 className="size-4 mr-1" /> Eliminar
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setDialogTurno({
                    id: detalhe.id,
                    colaborador_id: detalhe.colaborador_id,
                    setor: detalhe.setor,
                    cargo: detalhe.cargo ?? "",
                    data: detalhe.data,
                    turno: detalhe.turno,
                    hora_inicio: detalhe.hora_inicio.slice(0, 5),
                    hora_fim: detalhe.hora_fim.slice(0, 5),
                    tipo_escala: detalhe.tipo_escala,
                    status: detalhe.status,
                    observacoes: detalhe.observacoes ?? "",
                    repetirSemanas: 1,
                  });
                  setDetalhe(null);
                }}
              >
                Editar
              </Button>
              <Button
                onClick={() => {
                  setDialogTurno({
                    id: detalhe.id,
                    colaborador_id: "",
                    setor: detalhe.setor,
                    cargo: detalhe.cargo ?? "",
                    data: detalhe.data,
                    turno: detalhe.turno,
                    hora_inicio: detalhe.hora_inicio.slice(0, 5),
                    hora_fim: detalhe.hora_fim.slice(0, 5),
                    tipo_escala: detalhe.tipo_escala,
                    status: "trocado",
                    observacoes: detalhe.observacoes ?? "",
                    repetirSemanas: 1,
                  });
                  setDetalhe(null);
                }}
              >
                Trocar plantão
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog afastamento */}
      <Dialog open={dialogAfast} onOpenChange={setDialogAfast}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registar afastamento</DialogTitle>
            <DialogDescription>Períodos de férias, atestado ou licença bloqueiam a escalação.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Colaborador</Label>
              <Select value={afastForm.colaborador_id} onValueChange={(v) => setAfastForm({ ...afastForm, colaborador_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(colaboradores.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={afastForm.tipo} onValueChange={(v) => setAfastForm({ ...afastForm, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_AFASTAMENTO.map((s) => <SelectItem key={s.chave} value={s.chave}>{s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Início</Label>
                <Input type="date" value={afastForm.data_inicio} onChange={(e) => setAfastForm({ ...afastForm, data_inicio: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Fim</Label>
                <Input type="date" value={afastForm.data_fim} onChange={(e) => setAfastForm({ ...afastForm, data_fim: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Input value={afastForm.observacoes} onChange={(e) => setAfastForm({ ...afastForm, observacoes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAfast(false)}>Cancelar</Button>
            <Button
              disabled={!afastForm.colaborador_id || afastForm.data_fim < afastForm.data_inicio}
              onClick={() => salvarAfastamento.mutate(afastForm)}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
