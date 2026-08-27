import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pill, Printer, Trash2, Search, ChevronDown, ClipboardCheck, Ban } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import logoAsset from "@/assets/logo_instituto_maior.png.asset.json";
import { AdministracaoDiariaDialog } from "@/components/administracao-diaria";
import { TURNOS_MED, calcularDataFim, isoDate, rotuloDuracao, type MedicamentoPrescrito } from "@/lib/medicamentos";

export const Route = createFileRoute("/_authenticated/medicamentos")({
  component: PrescricaoPage,
});

type Residente = {
  id: string;
  nome_completo: string;
  data_nascimento: string | null;
  alergias: string | null;
  historico_medico: string | null;
  quartos: { numero: string; ala: string | null } | null;
};

type Prescricao = {
  id: string;
  residente_id: string;
  mes: number;
  ano: number;
  medico_nome: string | null;
  crm: string | null;
  alergias: string | null;
  hd: string | null;
  andar: string | null;
};

type Medicamento = MedicamentoPrescrito;

const DIAS_SEMANA = [
  { key: "todos", label: "Todos os dias" },
  { key: "seg", label: "Segunda-feira" },
  { key: "ter", label: "Terça-feira" },
  { key: "qua", label: "Quarta-feira" },
  { key: "qui", label: "Quinta-feira" },
  { key: "sex", label: "Sexta-feira" },
  { key: "sab", label: "Sábado" },
  { key: "dom", label: "Domingo" },
];

const WEEKDAY_INDEX: Record<string, number> = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function daysInMonth(mes: number, ano: number) {
  return new Date(ano, mes, 0).getDate();
}

function matchingDays(mes: number, ano: number, dias: string[]): number[] {
  const total = daysInMonth(mes, ano);
  const all = Array.from({ length: total }, (_, i) => i + 1);
  if (dias.includes("todos") || dias.length === 0) return all;
  const idxs = new Set(dias.map((d) => WEEKDAY_INDEX[d]).filter((n) => n !== undefined));
  return all.filter((d) => idxs.has(new Date(ano, mes - 1, d).getDay()));
}

function PrescricaoPage() {
  const today = new Date();
  const [mes, setMes] = useState(today.getMonth() + 1);
  const [ano, setAno] = useState(today.getFullYear());
  const [residenteId, setResidenteId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  const residentes = useQuery({
    queryKey: ["residentes-prescricao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("residentes")
        .select("id, nome_completo, data_nascimento, alergias, historico_medico, quartos(numero, ala)")
        .eq("ativo", true)
        .order("nome_completo");
      if (error) throw error;
      return (data ?? []) as unknown as Residente[];
    },
  });

  useEffect(() => {
    if (!residenteId && residentes.data && residentes.data.length > 0) {
      setResidenteId(residentes.data[0].id);
    }
  }, [residentes.data, residenteId]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return residentes.data ?? [];
    return (residentes.data ?? []).filter((r) => r.nome_completo.toLowerCase().includes(q));
  }, [residentes.data, busca]);

  const residente = residentes.data?.find((r) => r.id === residenteId) ?? null;

  return (
    <div className="grid grid-cols-[280px_1fr] gap-6 min-h-[calc(100vh-10rem)]">
      <aside className="bg-surface border border-border rounded-lg flex flex-col overflow-hidden">
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="size-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar residente" className="pl-8 h-9" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtrados.length === 0 ? (
            <p className="text-xs text-muted-foreground p-4 text-center">Nenhum residente</p>
          ) : filtrados.map((r) => (
            <button
              key={r.id}
              onClick={() => setResidenteId(r.id)}
              className={`w-full text-left px-3 py-2 border-b border-border/60 text-sm hover:bg-black/[0.03] ${residenteId === r.id ? "bg-black/[0.05] font-bold" : ""}`}
            >
              <div className="truncate">{r.nome_completo}</div>
              {r.quartos?.numero && <div className="text-[10px] font-mono text-muted-foreground">Quarto {r.quartos.numero}</div>}
            </button>
          ))}
        </div>
      </aside>

      <section className="min-w-0">
        {residente ? (
          <PlanilhaPrescricao residente={residente} mes={mes} ano={ano} onMes={setMes} onAno={setAno} />
        ) : (
          <div className="bg-surface border border-border rounded-lg p-12 text-center">
            <Pill className="size-8 mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Selecione uma residente à esquerda.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function PlanilhaPrescricao({
  residente, mes, ano, onMes, onAno,
}: { residente: Residente; mes: number; ano: number; onMes: (v: number) => void; onAno: (v: number) => void }) {
  const qc = useQueryClient();
  const total = daysInMonth(mes, ano);

  const prescricaoQ = useQuery({
    queryKey: ["prescricao", residente.id, mes, ano],
    queryFn: async () => {
      const { data: found, error } = await supabase
        .from("prescricoes")
        .select("*")
        .eq("residente_id", residente.id)
        .eq("mes", mes).eq("ano", ano)
        .maybeSingle();
      if (error) throw error;
      if (found) return found as Prescricao;

      // Busca a prescrição anterior mais recente para replicar automaticamente
      const { data: anteriores } = await supabase
        .from("prescricoes")
        .select("*")
        .eq("residente_id", residente.id)
        .or(`ano.lt.${ano},and(ano.eq.${ano},mes.lt.${mes})`)
        .order("ano", { ascending: false })
        .order("mes", { ascending: false })
        .limit(1);
      const anterior = (anteriores?.[0] ?? null) as Prescricao | null;

      const { data: created, error: err2 } = await supabase
        .from("prescricoes")
        .insert({
          residente_id: residente.id,
          mes,
          ano,
          alergias: anterior?.alergias ?? residente.alergias,
          hd: anterior?.hd ?? residente.historico_medico,
          medico_nome: anterior?.medico_nome ?? null,
          crm: anterior?.crm ?? null,
          andar: anterior?.andar ?? null,
        })
        .select("*")
        .single();
      if (err2) throw err2;
      const nova = created as Prescricao;

      if (anterior) {
        const { data: medsAnt } = await supabase
          .from("medicamentos")
          .select("*")
          .eq("prescricao_id", anterior.id)
          .eq("ativo", true)
          .order("numero", { ascending: true });
        const lista = (medsAnt ?? []) as unknown as Medicamento[];
        if (lista.length > 0) {
          const novos = lista.map((m, i) => {
            const horario = m.horarios?.[0] ?? "";
            const map: Record<string, string> = {};
            matchingDays(mes, ano, m.dias_semana ?? []).forEach((d) => (map[String(d)] = horario));
            return {
              prescricao_id: nova.id,
              residente_id: residente.id,
              nome: m.nome,
              dosagem: m.dosagem,
              via: m.via,
              horarios: m.horarios ?? [],
              dias_semana: m.dias_semana ?? [],
              dias_do_mes: map,
              numero: m.numero ?? i + 1,
            };
          });
          await supabase.from("medicamentos").insert(novos as never);
        }
      }
      return nova;
    },
  });


  const prescricao = prescricaoQ.data;

  const medsQ = useQuery({
    queryKey: ["prescricao-meds", prescricao?.id],
    enabled: !!prescricao,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medicamentos")
        .select("*")
        .eq("prescricao_id", prescricao!.id)
        .eq("ativo", true)
        .order("numero", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Medicamento[];
    },
  });

  const updateHeader = useMutation({
    mutationFn: async (patch: Partial<Prescricao>) => {
      const { error } = await supabase.from("prescricoes").update(patch).eq("id", prescricao!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prescricao", residente.id, mes, ano] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMed = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Medicamento> }) => {
      const { error } = await supabase.from("medicamentos").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prescricao-meds", prescricao?.id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMed = useMutation({
    mutationFn: async ({ med, modo }: { med: Medicamento; modo: "mes" | "definitivo" }) => {
      if (modo === "mes") {
        const { error } = await supabase.from("medicamentos").update({ ativo: false }).eq("id", med.id);
        if (error) throw error;
        return;
      }
      // Elimina definitivamente: este mês e todos os meses seguintes
      const { data: futuras } = await supabase
        .from("prescricoes")
        .select("id")
        .eq("residente_id", residente.id)
        .or(`ano.gt.${ano},and(ano.eq.${ano},mes.gte.${mes})`);
      const ids = (futuras ?? []).map((p) => p.id);
      const { error } = await supabase
        .from("medicamentos")
        .delete()
        .eq("residente_id", residente.id)
        .eq("nome", med.nome)
        .in("prescricao_id", ids.length ? ids : [med.prescricao_id ?? med.id]);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["prescricao-meds", prescricao?.id] });
      toast.success(vars.modo === "mes" ? "Medicamento removido deste mês" : "Medicamento eliminado definitivamente");
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const [addOpen, setAddOpen] = useState(false);
  const createMed = useMutation({
    mutationFn: async (payload: {
      nome: string; dosagem: string; via: string | null; horario: string; dias_semana: string[];
    }) => {
      const dias = matchingDays(mes, ano, payload.dias_semana);
      const map: Record<string, string> = {};
      dias.forEach((d) => (map[String(d)] = payload.horario));
      const numero = (medsQ.data?.length ?? 0) + 1;
      const { error } = await supabase.from("medicamentos").insert({
        prescricao_id: prescricao!.id,
        residente_id: residente.id,
        nome: payload.nome,
        dosagem: payload.dosagem,
        via: payload.via,
        horarios: payload.horario ? [payload.horario] : [],
        dias_semana: payload.dias_semana,
        dias_do_mes: map,
        numero,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prescricao-meds", prescricao?.id] });
      setAddOpen(false);
      toast.success("Medicamento adicionado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (prescricaoQ.isLoading || !prescricao) {
    return <div className="p-8 text-sm text-muted-foreground">Carregando planilha…</div>;
  }

  const dataNasc = residente.data_nascimento
    ? new Date(residente.data_nascimento + "T00:00:00").toLocaleDateString("pt-BR")
    : "";

  const anos = Array.from({ length: 6 }, (_, i) => today().getFullYear() - 2 + i);

  const doPrint = () => printPlanilha(residente, prescricao, medsQ.data ?? [], mes, ano);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Select value={String(mes)} onValueChange={(v) => onMes(Number(v))}>
            <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{MESES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(ano)} onValueChange={(v) => onAno(Number(v))}>
            <SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setAddOpen(true)} size="sm"><Plus className="size-4 mr-1" /> Novo medicamento</Button>
          <Button onClick={doPrint} size="sm" variant="outline"><Printer className="size-4 mr-1" /> Imprimir</Button>
        </div>
      </div>

      {/* Header planilha */}
      <div className="bg-surface border border-border rounded-lg p-4 grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
        <HeaderField label="Residente" value={residente.nome_completo} readOnly />
        <HeaderField label="Data de Nascimento" value={dataNasc} readOnly />
        <HeaderField label="Quarto" value={residente.quartos?.numero ?? ""} readOnly />
        <HeaderField
          label="Andar"
          value={prescricao.andar ?? ""}
          onSave={(v) => updateHeader.mutate({ andar: v })}
        />
        <HeaderField label="Mês/Ano" value={`${MESES[mes - 1]} / ${ano}`} readOnly />

        <HeaderField label="Médico" value={prescricao.medico_nome ?? ""} onSave={(v) => updateHeader.mutate({ medico_nome: v })} />
        <HeaderField label="CRM" value={prescricao.crm ?? ""} onSave={(v) => updateHeader.mutate({ crm: v })} />
        <HeaderField label="Alergias" value={prescricao.alergias ?? ""} onSave={(v) => updateHeader.mutate({ alergias: v })} className="md:col-span-2" />
        <HeaderField label="HD (Histórico de Doenças)" value={prescricao.hd ?? ""} onSave={(v) => updateHeader.mutate({ hd: v })} />
      </div>

      {/* Tabela planilha */}
      <div className="bg-surface border border-border rounded-lg overflow-x-auto">
        <table className="text-[11px] border-collapse w-full min-w-max">
          <thead className="bg-black/[0.03] border-b border-border sticky top-0">
            <tr>
              <Th className="w-10">Nº</Th>
              <Th className="w-56 text-left">Medicação</Th>
              <Th className="w-20">Dose</Th>
              <Th className="w-16">Via</Th>
              <Th className="w-20">Horário</Th>
              {Array.from({ length: total }, (_, i) => i + 1).map((d) => (
                <Th key={d} className="w-9">{d}</Th>
              ))}
              <Th className="w-10"></Th>
            </tr>
          </thead>
          <tbody>
            {(medsQ.data ?? []).length === 0 ? (
              <tr><td colSpan={6 + total} className="text-center text-muted-foreground py-8 text-xs">Nenhum medicamento nesta prescrição. Clique em "Novo medicamento".</td></tr>
            ) : medsQ.data!.map((m, idx) => (
              <MedRow
                key={m.id}
                med={m}
                idx={idx}
                total={total}
                mes={mes}
                ano={ano}
                onPatch={(patch) => updateMed.mutate({ id: m.id, patch })}
                onDelete={(modo) => deleteMed.mutate({ med: m, modo })}
              />
            ))}
          </tbody>
        </table>
      </div>

      <AddMedDialog open={addOpen} onOpenChange={setAddOpen} onSubmit={(v) => createMed.mutate(v)} loading={createMed.isPending} />
    </div>
  );
}

function today() { return new Date(); }

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider border border-border/80 ${className ?? ""}`}>{children}</th>;
}

function HeaderField({
  label, value, onSave, readOnly, className,
}: { label: string; value: string; onSave?: (v: string) => void; readOnly?: boolean; className?: string }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <div className={className}>
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => { if (!readOnly && onSave && local !== value) onSave(local); }}
        readOnly={readOnly}
        className={`h-8 mt-1 text-xs ${readOnly ? "bg-muted/40" : ""}`}
      />
    </div>
  );
}

function MedRow({
  med, idx, total, mes, ano, onPatch, onDelete,
}: {
  med: Medicamento; idx: number; total: number; mes: number; ano: number;
  onPatch: (patch: Partial<Medicamento>) => void; onDelete: (modo: "mes" | "definitivo") => void;
}) {
  const [nome, setNome] = useState(med.nome);
  const [dose, setDose] = useState(med.dosagem);
  const [via, setVia] = useState(med.via ?? "");
  const [horario, setHorario] = useState(med.horarios?.[0] ?? "");
  const [dias, setDias] = useState<Record<string, string>>(med.dias_do_mes ?? {});

  useEffect(() => setNome(med.nome), [med.nome]);
  useEffect(() => setDose(med.dosagem), [med.dosagem]);
  useEffect(() => setVia(med.via ?? ""), [med.via]);
  useEffect(() => setHorario(med.horarios?.[0] ?? ""), [med.horarios]);
  useEffect(() => setDias(med.dias_do_mes ?? {}), [med.dias_do_mes]);

  const persistDias = (next: Record<string, string>) => {
    setDias(next);
    onPatch({ dias_do_mes: next });
  };

  const onHorarioBlur = () => {
    const patch: Partial<Medicamento> = { horarios: horario ? [horario] : [] };
    // Apply auto-fill: overwrite dias_do_mes for the days matching dias_semana with the new horario
    const targets = matchingDays(mes, ano, med.dias_semana);
    const next = { ...dias };
    targets.forEach((d) => (next[String(d)] = horario));
    patch.dias_do_mes = next;
    setDias(next);
    onPatch(patch);
  };

  return (
    <tr className="hover:bg-black/[0.02]">
      <td className="px-1 py-1 text-center border border-border/60 font-mono text-[11px]">{med.numero ?? idx + 1}</td>
      <td className="border border-border/60">
        <input value={nome} onChange={(e) => setNome(e.target.value)} onBlur={() => nome !== med.nome && onPatch({ nome })}
          className="w-full px-2 py-1 bg-transparent focus:bg-white focus:outline focus:outline-1 focus:outline-primary text-[11px]" />
      </td>
      <td className="border border-border/60">
        <input value={dose} onChange={(e) => setDose(e.target.value)} onBlur={() => dose !== med.dosagem && onPatch({ dosagem: dose })}
          className="w-full px-2 py-1 bg-transparent focus:bg-white focus:outline focus:outline-1 focus:outline-primary text-center text-[11px] font-mono" />
      </td>
      <td className="border border-border/60">
        <input value={via} onChange={(e) => setVia(e.target.value)} onBlur={() => via !== (med.via ?? "") && onPatch({ via: via || null })}
          className="w-full px-2 py-1 bg-transparent focus:bg-white focus:outline focus:outline-1 focus:outline-primary text-center text-[11px] font-mono uppercase" />
      </td>
      <td className="border border-border/60">
        <input value={horario} onChange={(e) => setHorario(e.target.value)} onBlur={onHorarioBlur}
          placeholder="08:00"
          className="w-full px-2 py-1 bg-transparent focus:bg-white focus:outline focus:outline-1 focus:outline-primary text-center text-[11px] font-mono" />
      </td>
      {Array.from({ length: total }, (_, i) => i + 1).map((d) => {
        const key = String(d);
        const v = dias[key] ?? "";
        return (
          <td key={d} className="border border-border/60 p-0">
            <input
              value={v}
              onChange={(e) => setDias({ ...dias, [key]: e.target.value })}
              onBlur={(e) => {
                const val = e.target.value;
                if (val !== (med.dias_do_mes?.[key] ?? "")) {
                  const next = { ...dias, [key]: val };
                  if (!val) delete next[key];
                  persistDias(next);
                }
              }}
              className="w-full h-full px-0.5 py-1 bg-transparent focus:bg-primary/5 focus:outline focus:outline-1 focus:outline-primary text-center text-[10px] font-mono"
            />
          </td>
        );
      })}
      <td className="border border-border/60 text-center">
        <Popover>
          <PopoverTrigger asChild>
            <button className="text-muted-foreground hover:text-primary p-1" title="Excluir">
              <Trash2 className="size-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 p-2 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-1">Excluir medicamento</p>
            <Button variant="outline" size="sm" className="w-full justify-start text-xs" onClick={() => onDelete("mes")}>
              Remover apenas deste mês
            </Button>
            <Button variant="destructive" size="sm" className="w-full justify-start text-xs" onClick={() => onDelete("definitivo")}>
              Eliminar definitivamente
            </Button>
            <p className="text-[10px] text-muted-foreground px-1">
              "Definitivamente" apaga este mês e os meses seguintes.
            </p>
          </PopoverContent>
        </Popover>
      </td>

    </tr>
  );
}

function AddMedDialog({
  open, onOpenChange, onSubmit, loading,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; loading: boolean;
  onSubmit: (v: { nome: string; dosagem: string; via: string | null; horario: string; dias_semana: string[] }) => void;
}) {
  const [nome, setNome] = useState("");
  const [dose, setDose] = useState("");
  const [via, setVia] = useState("");
  const [horario, setHorario] = useState("");
  const [dias, setDias] = useState<string[]>(["todos"]);

  useEffect(() => {
    if (open) { setNome(""); setDose(""); setVia(""); setHorario(""); setDias(["todos"]); }
  }, [open]);

  const toggle = (key: string) => {
    if (key === "todos") { setDias(["todos"]); return; }
    const next = dias.filter((d) => d !== "todos");
    setDias(next.includes(key) ? next.filter((d) => d !== key) : [...next, key]);
  };

  const label = dias.includes("todos")
    ? "Todos os dias"
    : dias.length === 0
      ? "Selecione..."
      : dias.map((k) => DIAS_SEMANA.find((d) => d.key === k)?.label).filter(Boolean).join(", ");

  const submit = () => {
    if (!nome.trim() || !dose.trim()) { toast.error("Nome e dose são obrigatórios"); return; }
    onSubmit({ nome: nome.trim(), dosagem: dose.trim(), via: via.trim() || null, horario: horario.trim(), dias_semana: dias });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo medicamento</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Losartana" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Dose *</Label>
              <Input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="50mg" />
            </div>
            <div>
              <Label>Via</Label>
              <Input value={via} onChange={(e) => setVia(e.target.value)} placeholder="VO" />
            </div>
          </div>
          <div>
            <Label>Dia da Semana</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between font-normal">
                  <span className="truncate text-left">{label}</span>
                  <ChevronDown className="size-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2">
                {DIAS_SEMANA.map((d) => (
                  <label key={d.key} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer">
                    <Checkbox checked={dias.includes(d.key)} onCheckedChange={() => toggle(d.key)} />
                    <span className="text-sm">{d.label}</span>
                  </label>
                ))}
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label>Horário (será aplicado aos dias selecionados)</Label>
            <Input value={horario} onChange={(e) => setHorario(e.target.value)} placeholder="08:00" />
            <p className="text-[11px] text-muted-foreground mt-1">
              O horário informado será replicado automaticamente para todos os dias correspondentes no mês. Você pode editar qualquer célula depois.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>Adicionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function printPlanilha(residente: Residente, prescricao: Prescricao, meds: Medicamento[], mes: number, ano: number) {
  const total = daysInMonth(mes, ano);
  const days = Array.from({ length: total }, (_, i) => i + 1);
  const esc = (s: string | null | undefined) => (s ?? "").toString().replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
  const dataNasc = residente.data_nascimento ? new Date(residente.data_nascimento + "T00:00:00").toLocaleDateString("pt-BR") : "—";
  const logoUrl = `${window.location.origin}${logoAsset.url}`;

  const rows = meds.map((m, i) => {
    const cells = days.map((d) => `<td>${esc(m.dias_do_mes?.[String(d)] ?? "")}</td>`).join("");
    return `<tr>
      <td class="c">${m.numero ?? i + 1}</td>
      <td class="l">${esc(m.nome)}</td>
      <td class="c">${esc(m.dosagem)}</td>
      <td class="c">${esc(m.via)}</td>
      <td class="c">${esc(m.horarios?.[0] ?? "")}</td>
      ${cells}
    </tr>`;
  }).join("");

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
<title>Prescrição Médica — ${esc(residente.nome_completo)}</title>
<style>
  @page { size: A4 landscape; margin: 8mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #111; margin: 0; padding: 0; }
  header { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 8px; }
  header .logo { background: #fff; border: 1px solid #ccc; padding: 4px; width: 54px; height: 54px; display: grid; place-items: center; }
  header .logo img { max-width: 100%; max-height: 100%; }
  header h1 { font-size: 18px; margin: 0; letter-spacing: 0.5px; }
  header p { margin: 0; font-size: 11px; color: #555; text-transform: uppercase; letter-spacing: 1px; }
  .head-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px 8px; font-size: 10px; margin-bottom: 8px; }
  .head-grid .f { border: 1px solid #999; padding: 2px 4px; }
  .head-grid .f b { display: block; text-transform: uppercase; font-size: 8px; color: #555; letter-spacing: 0.5px; }
  table.plan { width: 100%; border-collapse: collapse; font-size: 8.5px; }
  table.plan th, table.plan td { border: 1px solid #666; padding: 2px 3px; text-align: center; }
  table.plan th { background: #eee; font-size: 8px; text-transform: uppercase; }
  table.plan td.l { text-align: left; }
  table.plan td.c { text-align: center; font-family: ui-monospace, monospace; }
  table.plan td { height: 22px; }
  footer { margin-top: 14px; display: flex; justify-content: space-between; font-size: 10px; }
  footer .sig { border-top: 1px solid #000; padding-top: 4px; width: 30%; text-align: center; }
</style></head><body>
  <header>
    <div class="logo"><img src="${logoUrl}" alt="Logo"/></div>
    <div>
      <h1>Residencial São Camilo</h1>
      <p>Ficha de Prescrição Médica — ${MESES[mes - 1]} / ${ano}</p>
    </div>
  </header>

  <div class="head-grid">
    <div class="f"><b>Residente</b>${esc(residente.nome_completo)}</div>
    <div class="f"><b>Data de Nascimento</b>${dataNasc}</div>
    <div class="f"><b>Quarto</b>${esc(residente.quartos?.numero)}</div>
    <div class="f"><b>Andar</b>${esc(prescricao.andar)}</div>
    <div class="f"><b>Mês/Ano</b>${MESES[mes - 1]} / ${ano}</div>
    <div class="f"><b>Médico</b>${esc(prescricao.medico_nome)}</div>
    <div class="f"><b>CRM</b>${esc(prescricao.crm)}</div>
    <div class="f" style="grid-column: span 2"><b>Alergias</b>${esc(prescricao.alergias)}</div>
    <div class="f"><b>HD</b>${esc(prescricao.hd)}</div>
  </div>

  <table class="plan">
    <thead>
      <tr>
        <th style="width:22px">Nº</th>
        <th style="width:160px">Medicação</th>
        <th style="width:44px">Dose</th>
        <th style="width:34px">Via</th>
        <th style="width:44px">Horário</th>
        ${days.map((d) => `<th>${d}</th>`).join("")}
      </tr>
    </thead>
    <tbody>${rows || `<tr><td colspan="${5 + total}" style="padding:16px; color:#666">Sem medicamentos cadastrados.</td></tr>`}</tbody>
  </table>

  <footer>
    <div class="sig">Enfermeiro(a) Responsável</div>
    <div class="sig">Médico(a) Responsável</div>
    <div class="sig">Gerência</div>
  </footer>

  <script>window.onload = () => { setTimeout(() => window.print(), 200); };</script>
</body></html>`;

  const w = window.open("", "_blank", "width=1200,height=800");
  if (!w) { toast.error("Bloqueado pelo navegador. Permita pop-ups."); return; }
  w.document.write(html);
  w.document.close();
}
