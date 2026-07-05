import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/residentes")({
  component: ResidentesPage,
});

type Residente = {
  id: string;
  nome_completo: string;
  data_nascimento: string | null;
  status: "estavel" | "observacao" | "critico";
  contato_emergencia_nome: string | null;
  contato_emergencia_telefone: string | null;
  alergias: string | null;
  dieta: string | null;
  historico_medico: string | null;
  ativo: boolean;
  quarto_id: string | null;
  quartos: { numero: string } | null;
};

function ResidentesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const residentes = useQuery({
    queryKey: ["residentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("residentes")
        .select("*, quartos(numero)")
        .order("nome_completo");
      if (error) throw error;
      return (data ?? []) as unknown as Residente[];
    },
  });

  const quartos = useQuery({
    queryKey: ["quartos-livres"],
    queryFn: async () => {
      const { data } = await supabase.from("quartos").select("id, numero").order("numero");
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { error } = await supabase.from("residentes").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["residentes"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["dashboard-residentes"] });
      setOpen(false);
      toast.success("Residente cadastrado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    create.mutate({
      nome_completo: fd.get("nome_completo"),
      data_nascimento: fd.get("data_nascimento") || null,
      quarto_id: fd.get("quarto_id") || null,
      contato_emergencia_nome: fd.get("contato_emergencia_nome") || null,
      contato_emergencia_telefone: fd.get("contato_emergencia_telefone") || null,
      alergias: fd.get("alergias") || null,
      dieta: fd.get("dieta") || null,
      historico_medico: fd.get("historico_medico") || null,
      status: fd.get("status") || "estavel",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {residentes.data?.length ?? 0} residente(s) no sistema
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4 mr-1" /> Novo residente</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Cadastrar residente</DialogTitle></DialogHeader>
            <form onSubmit={onSubmit} className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Nome completo *</Label>
                <Input name="nome_completo" required />
              </div>
              <div>
                <Label>Data de nascimento</Label>
                <Input name="data_nascimento" type="date" />
              </div>
              <div>
                <Label>Quarto</Label>
                <Select name="quarto_id">
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {quartos.data?.map((q) => <SelectItem key={q.id} value={q.id}>{q.numero}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select name="status" defaultValue="estavel">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="estavel">Estável</SelectItem>
                    <SelectItem value="observacao">Observação</SelectItem>
                    <SelectItem value="critico">Crítico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Contato emergência — nome</Label>
                <Input name="contato_emergencia_nome" />
              </div>
              <div>
                <Label>Contato emergência — telefone</Label>
                <Input name="contato_emergencia_telefone" />
              </div>
              <div>
                <Label>Alergias</Label>
                <Input name="alergias" />
              </div>
              <div>
                <Label>Dieta</Label>
                <Input name="dieta" />
              </div>
              <div className="col-span-2">
                <Label>Histórico médico resumido</Label>
                <Textarea name="historico_medico" rows={3} />
              </div>
              <div className="col-span-2 flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={create.isPending}>Cadastrar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-black/[0.02] border-b border-border">
            <tr>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Residente</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Quarto</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Alergias</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Contato</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {residentes.data?.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                Nenhum residente. Clique em <b>Novo residente</b> para começar.
              </td></tr>
            )}
            {residentes.data?.map((r) => (
              <tr key={r.id} className="hover:bg-black/[0.01]">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-full bg-muted grid place-items-center text-xs font-bold">
                      {r.nome_completo.charAt(0)}
                    </div>
                    <span className="text-sm font-bold">{r.nome_completo}</span>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm font-mono">{r.quartos?.numero ?? "—"}</td>
                <td className="px-4 py-4">
                  <span className={cn(
                    "px-2 py-0.5 text-[10px] font-bold rounded-sm",
                    r.status === "estavel" && "bg-green-100 text-green-700",
                    r.status === "observacao" && "bg-orange-100 text-orange-700",
                    r.status === "critico" && "bg-primary/10 text-primary",
                  )}>{r.status.toUpperCase()}</span>
                </td>
                <td className="px-4 py-4 text-xs text-muted-foreground">{r.alergias || "—"}</td>
                <td className="px-4 py-4 text-xs">
                  {r.contato_emergencia_nome ? (
                    <div>
                      <p className="font-medium">{r.contato_emergencia_nome}</p>
                      <p className="text-muted-foreground font-mono">{r.contato_emergencia_telefone}</p>
                    </div>
                  ) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
