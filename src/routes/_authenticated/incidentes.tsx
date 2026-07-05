import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/incidentes")({
  component: IncidentesPage,
});

type Incidente = {
  id: string;
  tipo: string;
  severidade: "leve" | "moderado" | "grave";
  descricao: string;
  acao_tomada: string | null;
  resolvido: boolean;
  ocorrido_em: string;
  residentes: { nome_completo: string; quartos: { numero: string } | null } | null;
};

function IncidentesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const incidentes = useQuery({
    queryKey: ["incidentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incidentes")
        .select("*, residentes(nome_completo, quartos(numero))")
        .order("ocorrido_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Incidente[];
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
      const { error } = await supabase.from("incidentes").insert({ ...payload, registrado_por: user.user?.id } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["incidentes"] });
      qc.invalidateQueries({ queryKey: ["dashboard-incidentes"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setOpen(false);
      toast.success("Incidente registrado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resolve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("incidentes").update({ resolvido: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["incidentes"] });
      toast.success("Incidente resolvido");
    },
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    create.mutate({
      residente_id: fd.get("residente_id"),
      tipo: fd.get("tipo"),
      severidade: fd.get("severidade") || "leve",
      descricao: fd.get("descricao"),
      acao_tomada: fd.get("acao_tomada") || null,
    });
  };

  const sevStyle = {
    leve: "border-slate-300 bg-slate-50",
    moderado: "border-warning bg-warning/10",
    grave: "border-primary bg-primary/5",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{incidentes.data?.length ?? 0} incidente(s)</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4 mr-1" /> Registrar incidente</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Registrar incidente</DialogTitle></DialogHeader>
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
                <div>
                  <Label>Tipo *</Label>
                  <Input name="tipo" required placeholder="Queda, mal-estar..." />
                </div>
                <div>
                  <Label>Severidade</Label>
                  <Select name="severidade" defaultValue="leve">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="leve">Leve</SelectItem>
                      <SelectItem value="moderado">Moderado</SelectItem>
                      <SelectItem value="grave">Grave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Descrição *</Label>
                <Textarea name="descricao" required rows={3} />
              </div>
              <div>
                <Label>Ação tomada</Label>
                <Textarea name="acao_tomada" rows={2} />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={create.isPending}>Registrar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {incidentes.data?.length === 0 ? (
        <div className="bg-surface border border-border rounded-lg p-12 text-center">
          <AlertTriangle className="size-8 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum incidente registrado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {incidentes.data?.map((i) => (
            <div key={i.id} className={cn("border-l-4 rounded-lg p-5 bg-surface border border-border", sevStyle[i.severidade])}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm",
                      i.severidade === "grave" && "bg-primary text-primary-foreground",
                      i.severidade === "moderado" && "bg-warning/30 text-orange-800",
                      i.severidade === "leve" && "bg-slate-200 text-slate-700",
                    )}>{i.severidade}</span>
                    <span className="font-bold">{i.tipo}</span>
                    {i.resolvido && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-sm font-bold flex items-center gap-1"><CheckCircle2 className="size-3" /> RESOLVIDO</span>}
                  </div>
                  <p className="text-sm mt-1">
                    <b>{i.residentes?.nome_completo}</b>
                    {i.residentes?.quartos?.numero && <span className="text-muted-foreground font-mono ml-1">• Quarto {i.residentes.quartos.numero}</span>}
                  </p>
                  <p className="text-sm mt-2 text-foreground/80">{i.descricao}</p>
                  {i.acao_tomada && <p className="text-xs mt-2 text-muted-foreground"><b>Ação:</b> {i.acao_tomada}</p>}
                  <p className="text-[10px] text-muted-foreground mt-2 font-mono">{new Date(i.ocorrido_em).toLocaleString("pt-BR")}</p>
                </div>
                {!i.resolvido && (
                  <Button size="sm" variant="outline" onClick={() => resolve.mutate(i.id)}>Marcar resolvido</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
