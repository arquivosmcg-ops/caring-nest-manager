import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function ResidenteAvatar({ path, nome }: { path: string | null; nome: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!path) { setUrl(null); return; }
    supabase.storage.from("residentes-fotos").createSignedUrl(path, 3600).then(({ data }) => {
      if (!cancelled) setUrl(data?.signedUrl ?? null);
    });
    return () => { cancelled = true; };
  }, [path]);
  if (url) {
    return <img src={url} alt={nome} className="size-9 rounded-full object-cover border border-border" />;
  }
  return (
    <div className="size-9 rounded-full bg-muted grid place-items-center text-xs font-bold">
      {nome.charAt(0)}
    </div>
  );
}

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
  foto_url: string | null;
  quartos: { numero: string } | null;
};

type QuartoOption = {
  id: string;
  numero: string;
  ala: string | null;
  capacidade: number;
  status: "ocupado" | "vago" | "manutencao";
};

function ResidentesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedQuarto, setSelectedQuarto] = useState<string | null>(null);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetFoto = () => {
    setFotoFile(null);
    if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    setFotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx 5MB)");
      return;
    }
    setFotoFile(file);
    if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    setFotoPreview(URL.createObjectURL(file));
  };

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
      const { data, error } = await supabase
        .from("quartos")
        .select("id, numero, ala, capacidade, status")
        .order("numero");
      if (error) throw error;
      return (data ?? []) as QuartoOption[];
    },
  });

  const create = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { error } = await supabase.from("residentes").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["residentes"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["dashboard-residentes"] });
      setOpen(false);
      resetFoto();
      toast.success("Residente cadastrado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    let foto_url: string | null = null;
    if (fotoFile) {
      setUploading(true);
      const ext = fotoFile.name.split(".").pop() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("residentes-fotos")
        .upload(path, fotoFile, { contentType: fotoFile.type, upsert: false });
      setUploading(false);
      if (error) { toast.error(`Falha ao enviar foto: ${error.message}`); return; }
      foto_url = path;
    }
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
      foto_url,
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
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) { setSelectedQuarto(null); resetFoto(); } else { resetFoto(); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4 mr-1" /> Novo residente</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Cadastrar residente</DialogTitle></DialogHeader>
            <form onSubmit={onSubmit} className="grid grid-cols-2 gap-4">
              <div className="col-span-2 flex items-center gap-4">
                <div className="relative">
                  {fotoPreview ? (
                    <img src={fotoPreview} alt="Prévia" className="size-20 rounded-full object-cover border-2 border-border" />
                  ) : (
                    <div className="size-20 rounded-full bg-muted grid place-items-center text-muted-foreground">
                      <Upload className="size-6" />
                    </div>
                  )}
                  {fotoPreview && (
                    <button type="button" onClick={resetFoto}
                      className="absolute -top-1 -right-1 size-5 rounded-full bg-destructive text-destructive-foreground grid place-items-center hover:brightness-110">
                      <X className="size-3" />
                    </button>
                  )}
                </div>
                <div>
                  <Label>Foto do residente</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={onFotoChange}
                    className="mt-1.5 block text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-accent"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">JPG ou PNG, até 5MB.</p>
                </div>
              </div>
              <div className="col-span-2">
                <Label>Nome completo *</Label>
                <Input name="nome_completo" required />
              </div>
              <div>
                <Label>Data de nascimento</Label>
                <Input name="data_nascimento" type="date" />
              </div>
              <div className="col-span-2">
                <Label>Quarto</Label>
                <input type="hidden" name="quarto_id" value={selectedQuarto ?? ""} />
                <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-1 border border-border rounded-md bg-surface">
                  {quartos.data?.length === 0 && (
                    <div className="col-span-full text-center text-xs text-muted-foreground py-4">
                      Nenhum quarto cadastrado.
                    </div>
                  )}
                  {quartos.data?.map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setSelectedQuarto(q.id)}
                      className={cn(
                        "text-left rounded-md border p-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-ring",
                        selectedQuarto === q.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:border-primary/50 hover:bg-black/[0.02]"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-extrabold text-sm">{q.numero}</span>
                        <span className={cn(
                          "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm",
                          q.status === "vago" && "bg-green-100 text-green-700",
                          q.status === "ocupado" && "bg-slate-100 text-slate-700",
                          q.status === "manutencao" && "bg-warning/20 text-orange-700"
                        )}>
                          {q.status}
                        </span>
                      </div>
                      <div className="mt-1.5 text-[10px] text-muted-foreground leading-tight">
                        {q.ala || "Sem ala"} · Cap. {q.capacidade}
                      </div>
                    </button>
                  ))}
                </div>
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
