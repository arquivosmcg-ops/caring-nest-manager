import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, BedDouble } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/quartos")({
  component: QuartosPage,
});

type Quarto = {
  id: string;
  numero: string;
  ala: string | null;
  capacidade: number;
  status: "ocupado" | "vago" | "manutencao";
  observacoes: string | null;
};

function QuartosPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const quartos = useQuery({
    queryKey: ["quartos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("quartos").select("*").order("numero");
      if (error) throw error;
      return (data ?? []) as Quarto[];
    },
  });

  const create = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { error } = await supabase.from("quartos").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quartos"] });
      qc.invalidateQueries({ queryKey: ["quartos-livres"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setOpen(false);
      toast.success("Quarto cadastrado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Quarto["status"] }) => {
      const { error } = await supabase.from("quartos").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quartos"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    create.mutate({
      numero: fd.get("numero"),
      ala: fd.get("ala") || null,
      capacidade: Number(fd.get("capacidade")) || 1,
      status: fd.get("status") || "vago",
      observacoes: fd.get("observacoes") || null,
    });
  };

  const statusColor = {
    vago: "bg-green-100 text-green-700 border-green-200",
    ocupado: "bg-slate-100 text-slate-700 border-slate-200",
    manutencao: "bg-warning/20 text-orange-700 border-warning/30",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {quartos.data?.length ?? 0} quarto(s) cadastrados
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4 mr-1" /> Novo quarto</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Cadastrar quarto</DialogTitle></DialogHeader>
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <Label>Número *</Label>
                <Input name="numero" required placeholder="ex: A-102" />
              </div>
              <div>
                <Label>Ala</Label>
                <Input name="ala" placeholder="ex: Ala Norte" />
              </div>
              <div>
                <Label>Capacidade</Label>
                <Input name="capacidade" type="number" min={1} defaultValue={1} />
              </div>
              <div>
                <Label>Status</Label>
                <Select name="status" defaultValue="vago">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vago">Vago</SelectItem>
                    <SelectItem value="ocupado">Ocupado</SelectItem>
                    <SelectItem value="manutencao">Manutenção</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={create.isPending}>Cadastrar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {quartos.data?.length === 0 ? (
        <div className="bg-surface border border-border rounded-lg p-12 text-center">
          <BedDouble className="size-8 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum quarto cadastrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {quartos.data?.map((q) => (
            <div key={q.id} className={cn("bg-surface border rounded-lg p-5", statusColor[q.status])}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-lg font-extrabold">{q.numero}</p>
                  <p className="text-[10px] uppercase tracking-wider mt-0.5">{q.ala || "—"}</p>
                </div>
                <span className="text-[10px] font-bold uppercase">{q.status}</span>
              </div>
              <p className="text-xs mt-3">Capacidade: <b>{q.capacidade}</b></p>
              <Select value={q.status} onValueChange={(v) => updateStatus.mutate({ id: q.id, status: v as Quarto["status"] })}>
                <SelectTrigger className="mt-3 h-8 text-xs bg-white/60"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vago">Vago</SelectItem>
                  <SelectItem value="ocupado">Ocupado</SelectItem>
                  <SelectItem value="manutencao">Manutenção</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
