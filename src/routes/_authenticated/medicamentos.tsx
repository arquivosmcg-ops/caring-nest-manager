import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pill } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/medicamentos")({
  component: MedicamentosPage,
});

type Medicamento = {
  id: string;
  nome: string;
  dosagem: string;
  via: string | null;
  horarios: string[];
  observacoes: string | null;
  ativo: boolean;
  residente_id: string;
  residentes: { nome_completo: string; quartos: { numero: string } | null } | null;
};

function MedicamentosPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const meds = useQuery({
    queryKey: ["medicamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medicamentos")
        .select("*, residentes(nome_completo, quartos(numero))")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as Medicamento[];
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
      const { error } = await supabase.from("medicamentos").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["medicamentos"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setOpen(false);
      toast.success("Medicamento prescrito");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const administrar = useMutation({
    mutationFn: async (m: Medicamento) => {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase.from("administracoes").insert({
        medicamento_id: m.id,
        residente_id: m.residente_id,
        administrado_por: user.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Administração registrada"),
    onError: (e: Error) => toast.error(e.message),
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const horariosStr = String(fd.get("horarios") ?? "");
    const horarios = horariosStr.split(",").map((s) => s.trim()).filter(Boolean);
    create.mutate({
      residente_id: fd.get("residente_id"),
      nome: fd.get("nome"),
      dosagem: fd.get("dosagem"),
      via: fd.get("via") || null,
      horarios,
      observacoes: fd.get("observacoes") || null,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{meds.data?.length ?? 0} prescrição(ões) ativa(s)</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4 mr-1" /> Nova prescrição</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Prescrever medicamento</DialogTitle></DialogHeader>
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
                  <Label>Medicamento *</Label>
                  <Input name="nome" required placeholder="Losartana" />
                </div>
                <div>
                  <Label>Dosagem *</Label>
                  <Input name="dosagem" required placeholder="50mg" />
                </div>
              </div>
              <div>
                <Label>Via</Label>
                <Input name="via" placeholder="VO, SC, IM, IV..." />
              </div>
              <div>
                <Label>Horários (separados por vírgula)</Label>
                <Input name="horarios" placeholder="08:00, 14:00, 20:00" />
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea name="observacoes" rows={2} />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={create.isPending}>Prescrever</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {meds.data?.length === 0 ? (
        <div className="bg-surface border border-border rounded-lg p-12 text-center">
          <Pill className="size-8 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhuma prescrição cadastrada.</p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-black/[0.02] border-b border-border">
              <tr>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Residente</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Medicamento</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Dosagem</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Via</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Horários</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {meds.data?.map((m) => (
                <tr key={m.id} className="hover:bg-black/[0.01]">
                  <td className="px-4 py-3 text-sm font-bold">
                    {m.residentes?.nome_completo}
                    {m.residentes?.quartos?.numero && <span className="ml-1 text-[10px] text-muted-foreground font-mono">({m.residentes.quartos.numero})</span>}
                  </td>
                  <td className="px-4 py-3 text-sm">{m.nome}</td>
                  <td className="px-4 py-3 text-sm font-mono">{m.dosagem}</td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{m.via ?? "—"}</td>
                  <td className="px-4 py-3 text-xs font-mono">{m.horarios.join(", ") || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => administrar.mutate(m)}>Administrar</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
