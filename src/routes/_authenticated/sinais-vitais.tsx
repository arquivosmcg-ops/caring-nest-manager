import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Activity } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sinais-vitais")({
  component: SinaisPage,
});

type Sinal = {
  id: string;
  registrado_em: string;
  pressao_sistolica: number | null;
  pressao_diastolica: number | null;
  temperatura: number | null;
  frequencia_cardiaca: number | null;
  saturacao: number | null;
  glicemia: number | null;
  observacoes: string | null;
  residentes: { nome_completo: string } | null;
};

function SinaisPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const sinais = useQuery({
    queryKey: ["sinais-vitais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sinais_vitais")
        .select("*, residentes(nome_completo)")
        .order("registrado_em", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as Sinal[];
    },
  });

  const residentes = useQuery({
    queryKey: ["residentes-simple"],
    queryFn: async () => {
      const { data } = await supabase.from("residentes").select("id, nome_completo").eq("ativo", true).order("nome_completo");
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase.from("sinais_vitais").insert({ ...payload, registrado_por: user.user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sinais-vitais"] });
      setOpen(false);
      toast.success("Sinais vitais registrados");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const num = (k: string) => {
      const v = fd.get(k);
      return v ? Number(v) : null;
    };
    create.mutate({
      residente_id: fd.get("residente_id"),
      pressao_sistolica: num("pressao_sistolica"),
      pressao_diastolica: num("pressao_diastolica"),
      temperatura: num("temperatura"),
      frequencia_cardiaca: num("frequencia_cardiaca"),
      saturacao: num("saturacao"),
      glicemia: num("glicemia"),
      observacoes: fd.get("observacoes") || null,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{sinais.data?.length ?? 0} registro(s) recentes</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4 mr-1" /> Registrar sinais</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Registrar sinais vitais</DialogTitle></DialogHeader>
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <Label>Residente *</Label>
                <Select name="residente_id" required>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {residentes.data?.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome_completo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>PA sistólica</Label><Input name="pressao_sistolica" type="number" placeholder="120" /></div>
                <div><Label>PA diastólica</Label><Input name="pressao_diastolica" type="number" placeholder="80" /></div>
                <div><Label>Temperatura (°C)</Label><Input name="temperatura" type="number" step="0.1" placeholder="36.5" /></div>
                <div><Label>FC (bpm)</Label><Input name="frequencia_cardiaca" type="number" placeholder="72" /></div>
                <div><Label>Saturação (%)</Label><Input name="saturacao" type="number" placeholder="98" /></div>
                <div><Label>Glicemia (mg/dL)</Label><Input name="glicemia" type="number" placeholder="110" /></div>
              </div>
              <div>
                <Label>Observações</Label>
                <Input name="observacoes" />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={create.isPending}>Registrar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {sinais.data?.length === 0 ? (
        <div className="bg-surface border border-border rounded-lg p-12 text-center">
          <Activity className="size-8 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum sinal vital registrado.</p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-black/[0.02] border-b border-border">
              <tr>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider">Data</th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider">Residente</th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider">PA</th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider">Temp</th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider">FC</th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider">SpO₂</th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider">Glicemia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono text-xs">
              {sinais.data?.map((s) => (
                <tr key={s.id} className="hover:bg-black/[0.01]">
                  <td className="px-3 py-3 text-muted-foreground">{new Date(s.registrado_em).toLocaleString("pt-BR")}</td>
                  <td className="px-3 py-3 font-sans text-sm font-bold">{s.residentes?.nome_completo}</td>
                  <td className="px-3 py-3">{s.pressao_sistolica && s.pressao_diastolica ? `${s.pressao_sistolica}/${s.pressao_diastolica}` : "—"}</td>
                  <td className="px-3 py-3">{s.temperatura ? `${s.temperatura}°C` : "—"}</td>
                  <td className="px-3 py-3">{s.frequencia_cardiaca ?? "—"}</td>
                  <td className="px-3 py-3">{s.saturacao ? `${s.saturacao}%` : "—"}</td>
                  <td className="px-3 py-3">{s.glicemia ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
