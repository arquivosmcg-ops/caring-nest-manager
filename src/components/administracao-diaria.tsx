import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, X, Clock, Pill } from "lucide-react";
import { usePerfilAtual } from "@/hooks/use-perfil";
import {
  TURNOS_MED,
  isoDate,
  vigenteNaData,
  rotuloDuracao,
  turnoLabel,
  type AdministracaoMed,
  type MedicamentoPrescrito,
  type TurnoMed,
} from "@/lib/medicamentos";

export function AdministracaoDiariaDialog({
  open,
  onOpenChange,
  residenteId,
  residenteNome,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  residenteId: string;
  residenteNome: string;
}) {
  const qc = useQueryClient();
  const perfil = usePerfilAtual();
  const [data, setData] = useState(isoDate(new Date()));

  const mes = Number(data.slice(5, 7));
  const ano = Number(data.slice(0, 4));

  const medsQ = useQuery({
    queryKey: ["adm-meds", residenteId, mes, ano],
    enabled: open,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("medicamentos")
        .select("*, prescricoes!inner(mes, ano)")
        .eq("residente_id", residenteId)
        .eq("ativo", true)
        .eq("prescricoes.mes", mes)
        .eq("prescricoes.ano", ano)
        .order("numero", { ascending: true });
      if (error) throw error;
      return (rows ?? []) as unknown as MedicamentoPrescrito[];
    },
  });

  const admQ = useQuery({
    queryKey: ["adm-registros", residenteId, data],
    enabled: open,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("administracoes_medicamento")
        .select("*")
        .eq("residente_id", residenteId)
        .eq("data", data)
        .order("horario", { ascending: true });
      if (error) throw error;
      return (rows ?? []) as unknown as AdministracaoMed[];
    },
  });

  const registrar = useMutation({
    mutationFn: async (v: {
      medicamento_id: string;
      turno: TurnoMed | null;
      administrado: boolean;
      motivo: string | null;
      horario?: string;
      existenteId?: string;
    }) => {
      const payload = {
        medicamento_id: v.medicamento_id,
        residente_id: residenteId,
        data,
        turno: v.turno,
        administrado: v.administrado,
        motivo: v.motivo,
        registrado_por: perfil.data?.userId ?? null,
        registrado_por_nome: perfil.data?.fullName ?? null,
        horario: v.horario ?? new Date().toISOString(),
      };
      if (v.existenteId) {
        const { error } = await supabase
          .from("administracoes_medicamento")
          .update(payload as never)
          .eq("id", v.existenteId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("administracoes_medicamento").insert(payload as never);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["adm-registros", residenteId, data] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const { fixos, sn } = useMemo(() => {
    const lista = (medsQ.data ?? []).filter((m) => vigenteNaData(m, data));
    return {
      fixos: lista.filter((m) => !m.se_necessario),
      sn: lista.filter((m) => m.se_necessario),
    };
  }, [medsQ.data, data]);

  const regDe = (medId: string, turno: TurnoMed | null) =>
    (admQ.data ?? []).find((a) => a.medicamento_id === medId && a.turno === turno) ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Administração diária — {residenteNome}</DialogTitle>
        </DialogHeader>

        <div className="flex items-end gap-3">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Data</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="h-9 w-44" />
          </div>
          <p className="text-xs text-muted-foreground pb-2">
            Registos guardam automaticamente o utilizador e a hora exata.
          </p>
        </div>

        <section className="space-y-3">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Medicamentos da grade fixa</h3>
          {medsQ.isLoading ? (
            <p className="text-sm text-muted-foreground">A carregar…</p>
          ) : fixos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum medicamento ativo nesta data.</p>
          ) : (
            fixos.map((m) => (
              <div key={m.id} className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="text-sm font-bold">
                    {m.nome} <span className="font-normal text-muted-foreground">{m.dosagem}{m.via ? ` · ${m.via}` : ""}</span>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted">
                    {rotuloDuracao(m, data)}
                  </span>
                </div>
                <div className="space-y-2">
                  {(m.turnos?.length ? m.turnos : TURNOS_MED.map((t) => t.key)).map((t) => (
                    <LinhaTurno
                      key={t}
                      turno={t as TurnoMed}
                      registro={regDe(m.id, t as TurnoMed)}
                      onSalvar={(administrado, motivo, existenteId) =>
                        registrar.mutate({ medicamento_id: m.id, turno: t as TurnoMed, administrado, motivo, existenteId })
                      }
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Se necessário (SN)</h3>
          {sn.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum medicamento SN vigente.</p>
          ) : (
            sn.map((m) => (
              <BlocoSN
                key={m.id}
                med={m}
                data={data}
                registos={(admQ.data ?? []).filter((a) => a.medicamento_id === m.id && a.turno === null)}
                onRegistrar={(horario, motivo) =>
                  registrar.mutate({ medicamento_id: m.id, turno: null, administrado: true, motivo, horario })
                }
              />
            ))
          )}
        </section>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LinhaTurno({
  turno,
  registro,
  onSalvar,
}: {
  turno: TurnoMed;
  registro: AdministracaoMed | null;
  onSalvar: (administrado: boolean, motivo: string | null, existenteId?: string) => void;
}) {
  const [motivo, setMotivo] = useState(registro?.motivo ?? "");
  const mostrarMotivo = registro !== null && registro.administrado === false;

  return (
    <div className="flex items-start gap-3 flex-wrap bg-black/[0.02] rounded p-2">
      <span className="text-xs font-bold w-16 pt-1.5">{turnoLabel(turno)}</span>
      <div className="flex gap-1">
        <Button
          size="sm"
          variant={registro?.administrado === true ? "default" : "outline"}
          className="h-7 text-xs"
          onClick={() => onSalvar(true, null, registro?.id)}
        >
          <Check className="size-3 mr-1" /> Administrado
        </Button>
        <Button
          size="sm"
          variant={registro?.administrado === false ? "destructive" : "outline"}
          className="h-7 text-xs"
          onClick={() => onSalvar(false, motivo.trim() || null, registro?.id)}
        >
          <X className="size-3 mr-1" /> Não administrado
        </Button>
      </div>
      {mostrarMotivo && (
        <Input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          onBlur={() => onSalvar(false, motivo.trim() || null, registro?.id)}
          placeholder="Motivo (recusou, jejum, em falta…)"
          className="h-7 text-xs flex-1 min-w-48"
        />
      )}
      {registro && (
        <span className="text-[10px] text-muted-foreground pt-2">
          {registro.registrado_por_nome ?? "—"} · {new Date(registro.horario).toLocaleString("pt-BR")}
        </span>
      )}
    </div>
  );
}

function BlocoSN({
  med,
  data,
  registos,
  onRegistrar,
}: {
  med: MedicamentoPrescrito;
  data: string;
  registos: AdministracaoMed[];
  onRegistrar: (horario: string, motivo: string | null) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [quando, setQuando] = useState("");
  const [motivo, setMotivo] = useState("");

  const abrir = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setQuando(now.toISOString().slice(0, 16));
    setMotivo("");
    setAberto(true);
  };

  return (
    <div className="border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-sm font-bold flex items-center gap-2">
          <Pill className="size-4 text-primary" />
          {med.nome} <span className="font-normal text-muted-foreground">{med.dosagem}{med.via ? ` · ${med.via}` : ""}</span>
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">SN — Se necessário</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted">{rotuloDuracao(med, data)}</span>
          <Button size="sm" className="h-7 text-xs" onClick={abrir}><Clock className="size-3 mr-1" /> Registar administração agora</Button>
        </div>
      </div>

      {aberto && (
        <div className="flex items-end gap-2 flex-wrap bg-black/[0.02] rounded p-2">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Data e hora</Label>
            <Input type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} className="h-8 text-xs w-52" />
          </div>
          <div className="flex-1 min-w-48">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Motivo</Label>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="dor, febre…" className="h-8 text-xs" />
          </div>
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              if (!quando) { toast.error("Informe a data e hora"); return; }
              onRegistrar(new Date(quando).toISOString(), motivo.trim() || null);
              setAberto(false);
              toast.success("Administração registada");
            }}
          >
            Guardar
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setAberto(false)}>Cancelar</Button>
        </div>
      )}

      {registos.length > 0 && (
        <ul className="text-[11px] text-muted-foreground space-y-0.5">
          {registos.map((r) => (
            <li key={r.id}>
              • {new Date(r.horario).toLocaleString("pt-BR")} — {r.motivo ?? "sem motivo registado"} ({r.registrado_por_nome ?? "—"})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
