import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, ClipboardCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/checklists")({
  component: ChecklistsPage,
});

type Turno = "manha" | "tarde" | "noite";

type Item = {
  id: string;
  tarefa: string;
  turno: Turno;
  concluido: boolean;
  data: string;
  residentes: { nome_completo: string; quartos: { numero: string } | null } | null;
};

function ChecklistsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const itens = useQuery({
    queryKey: ["checklists", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_itens")
        .select("*, residentes(nome_completo, quartos(numero))")
        .eq("data", today)
        .order("turno");
      if (error) throw error;
      return (data ?? []) as unknown as Item[];
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
      const { error } = await supabase.from("checklist_itens").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checklists"] });
      setOpen(false);
      toast.success("Tarefa adicionada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, concluido }: { id: string; concluido: boolean }) => {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase.from("checklist_itens").update({
        concluido,
        concluido_em: concluido ? new Date().toISOString() : null,
        concluido_por: concluido ? user.user?.id : null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklists"] }),
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    create.mutate({
      residente_id: fd.get("residente_id"),
      turno: fd.get("turno"),
      tarefa: fd.get("tarefa"),
      data: today,
    });
  };

  const turnos: { key: Turno; label: string }[] = [
    { key: "manha", label: "Manhã" },
    { key: "tarde", label: "Tarde" },
    { key: "noite", label: "Noite" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Checklists de hoje — {new Date().toLocaleDateString("pt-BR")}
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4 mr-1" /> Nova tarefa</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Adicionar tarefa</DialogTitle></DialogHeader>
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
              <div>
                <Label>Turno *</Label>
                <Select name="turno" defaultValue="manha" required>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manha">Manhã</SelectItem>
                    <SelectItem value="tarde">Tarde</SelectItem>
                    <SelectItem value="noite">Noite</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tarefa *</Label>
                <Input name="tarefa" required placeholder="Banho, alimentação, higiene bucal..." />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={create.isPending}>Adicionar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {itens.data?.length === 0 ? (
        <div className="bg-surface border border-border rounded-lg p-12 text-center">
          <ClipboardCheck className="size-8 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhuma tarefa de checklist para hoje.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {turnos.map((t) => {
            const items = itens.data?.filter((i) => i.turno === t.key) ?? [];
            const done = items.filter((i) => i.concluido).length;
            return (
              <div key={t.key} className="bg-surface border border-border rounded-lg p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-extrabold uppercase tracking-wider">{t.label}</h3>
                  <span className="text-[10px] font-mono font-bold bg-black text-white px-2 py-0.5 rounded-sm">
                    {done}/{items.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {items.length === 0 && <p className="text-xs text-muted-foreground">Sem tarefas.</p>}
                  {items.map((i) => (
                    <label key={i.id} className={cn(
                      "flex items-start gap-3 p-3 rounded border border-border cursor-pointer transition-colors",
                      i.concluido ? "bg-green-50 border-green-200" : "bg-muted hover:bg-black/[0.03]"
                    )}>
                      <Checkbox
                        checked={i.concluido}
                        onCheckedChange={(v) => toggle.mutate({ id: i.id, concluido: !!v })}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-xs font-bold", i.concluido && "line-through text-muted-foreground")}>{i.tarefa}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {i.residentes?.nome_completo}
                          {i.residentes?.quartos?.numero && ` • ${i.residentes.quartos.numero}`}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
