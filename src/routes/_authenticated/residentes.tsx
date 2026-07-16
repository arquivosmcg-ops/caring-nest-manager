import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Upload, X, Wand2, Pencil, Check, FilePen, Printer } from "lucide-react";
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

const LOWER_PARTICLES = new Set(["de", "da", "do", "dos", "das", "e", "di", "du"]);
function normalizeNome(raw: string): string {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned) return cleaned;
  return cleaned
    .toLocaleLowerCase("pt-BR")
    .split(" ")
    .map((word, i) => {
      if (i > 0 && LOWER_PARTICLES.has(word)) return word;
      return word.charAt(0).toLocaleUpperCase("pt-BR") + word.slice(1);
    })
    .join(" ");
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
  rg: string | null;
  cpf: string | null;
  convenio: string | null;
  observacoes: string | null;
  data_admissao: string | null;
  contatos: string | null;
  endereco_cep: string | null;
  endereco_logradouro: string | null;
  endereco_numero: string | null;
  endereco_complemento: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_estado: string | null;
  quartos: { numero: string } | null;
};

type QuartoOption = {
  id: string;
  numero: string;
  ala: string | null;
  capacidade: number;
  status: "ocupado" | "vago" | "manutencao";
};

type ResidenteFormValues = {
  nome_completo: string;
  data_nascimento: string | null;
  quarto_id: string | null;
  status: "estavel" | "observacao" | "critico";
  alergias: string | null;
  dieta: string | null;
  historico_medico: string | null;
  rg: string | null;
  cpf: string | null;
  convenio: string | null;
  observacoes: string | null;
  data_admissao: string | null;
  contatos: string | null;
  endereco_cep: string | null;
  endereco_logradouro: string | null;
  endereco_numero: string | null;
  endereco_complemento: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_estado: string | null;
};



function ResidenteForm({
  residente,
  quartos,
  onSubmit,
  onCancel,
  isPending,
  submitLabel,
}: {
  residente?: Residente | null;
  quartos: QuartoOption[] | undefined;
  onSubmit: (values: ResidenteFormValues, fotoFile: File | null) => void | Promise<void>;
  onCancel: () => void;
  isPending: boolean;
  submitLabel: string;
}) {
  const [selectedQuarto, setSelectedQuarto] = useState<string | null>(residente?.quarto_id ?? null);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [existingFotoUrl, setExistingFotoUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    if (!residente?.foto_url) { setExistingFotoUrl(null); return; }
    supabase.storage.from("residentes-fotos").createSignedUrl(residente.foto_url, 3600).then(({ data }) => {
      if (!cancelled) setExistingFotoUrl(data?.signedUrl ?? null);
    });
    return () => { cancelled = true; };
  }, [residente?.foto_url]);

  const resetFoto = () => {
    setFotoFile(null);
    if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    setFotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  useEffect(() => {
    setSelectedQuarto(residente?.quarto_id ?? null);
    resetFoto();
  }, [residente?.id]);

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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSubmit({
      nome_completo: fd.get("nome_completo") as string,
      data_nascimento: (fd.get("data_nascimento") as string) || null,
      quarto_id: selectedQuarto,
      status: (fd.get("status") as "estavel" | "observacao" | "critico") || "estavel",
      alergias: (fd.get("alergias") as string) || null,
      dieta: (fd.get("dieta") as string) || null,
      historico_medico: (fd.get("historico_medico") as string) || null,
      rg: (fd.get("rg") as string) || null,
      cpf: (fd.get("cpf") as string) || null,
      convenio: (fd.get("convenio") as string) || null,
      observacoes: (fd.get("observacoes") as string) || null,
      data_admissao: (fd.get("data_admissao") as string) || null,
      contatos: (fd.get("contatos") as string) || null,
      endereco_cep: (fd.get("endereco_cep") as string) || null,
      endereco_logradouro: (fd.get("endereco_logradouro") as string) || null,
      endereco_numero: (fd.get("endereco_numero") as string) || null,
      endereco_complemento: (fd.get("endereco_complemento") as string) || null,
      endereco_bairro: (fd.get("endereco_bairro") as string) || null,
      endereco_cidade: (fd.get("endereco_cidade") as string) || null,
      endereco_estado: (fd.get("endereco_estado") as string) || null,
    }, fotoFile);
  };


  const displayPreview = fotoPreview || existingFotoUrl;

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
      <div className="col-span-2 flex items-center gap-4">
        <div className="relative">
          {displayPreview ? (
            <img src={displayPreview} alt="Prévia" className="size-20 rounded-full object-cover border-2 border-border" />
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
        <Input name="nome_completo" required defaultValue={residente?.nome_completo ?? ""} />
      </div>
      <div>
        <Label>Data de nascimento</Label>
        <Input name="data_nascimento" type="date" defaultValue={residente?.data_nascimento ?? ""} />
      </div>
      <div className="col-span-2">
        <Label>Quarto</Label>
        <input type="hidden" name="quarto_id" value={selectedQuarto ?? ""} />
        <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-1 border border-border rounded-md bg-surface">
          {quartos?.length === 0 && (
            <div className="col-span-full text-center text-xs text-muted-foreground py-4">
              Nenhum quarto cadastrado.
            </div>
          )}
          {quartos?.map((q) => (
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
        <Select name="status" defaultValue={residente?.status ?? "estavel"}>
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
        <Input name="contato_emergencia_nome" defaultValue={residente?.contato_emergencia_nome ?? ""} />
      </div>
      <div>
        <Label>Contato emergência — telefone</Label>
        <Input name="contato_emergencia_telefone" defaultValue={residente?.contato_emergencia_telefone ?? ""} />
      </div>
      <div>
        <Label>Alergias</Label>
        <Input name="alergias" defaultValue={residente?.alergias ?? ""} />
      </div>
      <div>
        <Label>Dieta</Label>
        <Input name="dieta" defaultValue={residente?.dieta ?? ""} />
      </div>
      <div>
        <Label>RG</Label>
        <Input name="rg" defaultValue={residente?.rg ?? ""} />
      </div>
      <div>
        <Label>CPF</Label>
        <Input name="cpf" defaultValue={residente?.cpf ?? ""} />
      </div>
      <div className="col-span-2">
        <Label>Convênio</Label>
        <Input name="convenio" defaultValue={residente?.convenio ?? ""} />
      </div>
      <div className="col-span-2">
        <Label>Histórico médico resumido</Label>
        <Textarea name="historico_medico" rows={3} defaultValue={residente?.historico_medico ?? ""} />
      </div>
      <div className="col-span-2">
        <Label>Observações</Label>
        <Textarea name="observacoes" rows={3} defaultValue={residente?.observacoes ?? ""} />
      </div>
      <div className="col-span-2 flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={isPending}>{submitLabel}</Button>
      </div>
    </form>
  );
}

function ResidentesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingResidente, setEditingResidente] = useState<Residente | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNome, setEditingNome] = useState("");

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
      toast.success("Residente cadastrado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fixNomes = useMutation({
    mutationFn: async () => {
      const list = residentes.data ?? [];
      const updates = list
        .map((r) => ({ id: r.id, novo: normalizeNome(r.nome_completo) }))
        .filter((u) => u.novo && u.novo !== list.find((r) => r.id === u.id)!.nome_completo);
      for (const u of updates) {
        const { error } = await supabase
          .from("residentes")
          .update({ nome_completo: u.novo })
          .eq("id", u.id);
        if (error) throw error;
      }
      return updates.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["residentes"] });
      qc.invalidateQueries({ queryKey: ["dashboard-residentes"] });
      if (count === 0) toast.info("Todos os nomes já estão padronizados");
      else toast.success(`${count} nome(s) corrigido(s)`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateNome = useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const { error } = await supabase.from("residentes").update({ nome_completo: nome }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["residentes"] });
      qc.invalidateQueries({ queryKey: ["dashboard-residentes"] });
      setEditingId(null);
      toast.success("Nome atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateResidente = useMutation({
    mutationFn: async ({ id, values, fotoFile, existingFotoUrl }: { id: string; values: ResidenteFormValues; fotoFile: File | null; existingFotoUrl: string | null }) => {
      let foto_url = existingFotoUrl;
      if (fotoFile) {
        const ext = fotoFile.name.split(".").pop() || "jpg";
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("residentes-fotos")
          .upload(path, fotoFile, { contentType: fotoFile.type, upsert: false });
        if (error) throw error;
        foto_url = path;
      }
      const { error } = await supabase.from("residentes").update({ ...values, foto_url }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["residentes"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["dashboard-residentes"] });
      setEditingResidente(null);
      toast.success("Residente atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startEdit = (id: string, nome: string) => { setEditingId(id); setEditingNome(nome); };
  const cancelEdit = () => { setEditingId(null); setEditingNome(""); };
  const saveEdit = () => {
    const trimmed = editingNome.trim();
    if (!trimmed) { toast.error("O nome não pode ficar vazio"); return; }
    if (!editingId) return;
    updateNome.mutate({ id: editingId, nome: trimmed });
  };

  const handleCreate = async (values: ResidenteFormValues, fotoFile: File | null) => {
    let foto_url: string | null = null;
    if (fotoFile) {
      const ext = fotoFile.name.split(".").pop() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("residentes-fotos")
        .upload(path, fotoFile, { contentType: fotoFile.type, upsert: false });
      if (error) { toast.error(`Falha ao enviar foto: ${error.message}`); return; }
      foto_url = path;
    }
    create.mutate({ ...values, foto_url });
  };

  const handleEdit = (values: ResidenteFormValues, fotoFile: File | null) => {
    if (!editingResidente) return;
    updateResidente.mutate({ id: editingResidente.id, values, fotoFile, existingFotoUrl: editingResidente.foto_url });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {residentes.data?.length ?? 0} residente(s) no sistema
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => fixNomes.mutate()}
            disabled={fixNomes.isPending || !residentes.data?.length}
            title="Padroniza capitalização e remove espaços extras nos nomes"
          >
            <Wand2 className="size-4 mr-1" /> Corrigir nomes
          </Button>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); }}>
            <DialogTrigger asChild>
              <Button><Plus className="size-4 mr-1" /> Novo residente</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Cadastrar residente</DialogTitle></DialogHeader>
              <ResidenteForm
                key="create"
                quartos={quartos.data}
                onSubmit={handleCreate}
                onCancel={() => setOpen(false)}
                isPending={create.isPending}
                submitLabel="Cadastrar"
              />
            </DialogContent>
          </Dialog>
          <Dialog open={editingResidente !== null} onOpenChange={(v) => { if (!v) setEditingResidente(null); }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Editar residente</DialogTitle></DialogHeader>
              {editingResidente && (
                <ResidenteForm
                  key={editingResidente.id}
                  residente={editingResidente}
                  quartos={quartos.data}
                  onSubmit={handleEdit}
                  onCancel={() => setEditingResidente(null)}
                  isPending={updateResidente.isPending}
                  submitLabel="Salvar"
                />
              )}
            </DialogContent>
          </Dialog>
        </div>
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
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {residentes.data?.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                Nenhum residente. Clique em <b>Novo residente</b> para começar.
              </td></tr>
            )}
            {residentes.data?.map((r) => (
              <tr key={r.id} className="hover:bg-black/[0.01]">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <ResidenteAvatar path={r.foto_url} nome={r.nome_completo} />
                    {editingId === r.id ? (
                      <div className="flex items-center gap-1.5 flex-1">
                        <Input
                          autoFocus
                          value={editingNome}
                          onChange={(e) => setEditingNome(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); saveEdit(); }
                            if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
                          }}
                          className="h-8 text-sm font-bold"
                        />
                        <Button size="icon" variant="ghost" className="size-7" onClick={saveEdit} disabled={updateNome.isPending} title="Salvar">
                          <Check className="size-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="size-7" onClick={cancelEdit} disabled={updateNome.isPending} title="Cancelar">
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 group">
                        <span className="text-sm font-bold">{r.nome_completo}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-6 opacity-60 hover:opacity-100"
                          onClick={() => startEdit(r.id, r.nome_completo)}
                          title="Editar nome"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      </div>
                    )}
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
                <td className="px-4 py-4">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    onClick={() => setEditingResidente(r)}
                    title="Editar cadastro"
                  >
                    <FilePen className="size-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
