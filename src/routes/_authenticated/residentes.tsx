import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TextareaDitavel } from "@/components/ditar-audio";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Upload, X, Wand2, Pencil, Check, FilePen, Printer, Trash2, ListOrdered } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { GRAUS_PARENTESCO } from "@/lib/visitas";
import { maskCelular } from "@/lib/phone";


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

export function calcularIdade(data: string | null): number | null {
  if (!data) return null;
  const [y, m, d] = data.split("-").map(Number);
  if (!y || !m || !d) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - y;
  const mesAtual = hoje.getMonth() + 1;
  if (mesAtual < m || (mesAtual === m && hoje.getDate() < d)) idade--;
  return idade;
}

export const Route = createFileRoute("/_authenticated/residentes")({
  component: ResidentesPage,
});

type OrigemProcedencia = "residencia" | "outra_instituicao";
type EstadoCivil = "solteiro" | "casado" | "viuvo" | "divorciado" | "uniao_estavel";
type MotivoRescisao = "obito" | "transferencia" | "volta_residencia";

const ORIGENS: { key: OrigemProcedencia; label: string }[] = [
  { key: "residencia", label: "Residência (própria/familiar)" },
  { key: "outra_instituicao", label: "Outra instituição" },
];
const ESTADOS_CIVIS: { key: EstadoCivil; label: string }[] = [
  { key: "solteiro", label: "Solteiro(a)" },
  { key: "casado", label: "Casado(a)" },
  { key: "viuvo", label: "Viúvo(a)" },
  { key: "divorciado", label: "Divorciado(a)" },
  { key: "uniao_estavel", label: "União estável" },
];
const MOTIVOS_RESCISAO: { key: MotivoRescisao; label: string }[] = [
  { key: "obito", label: "Óbito" },
  { key: "transferencia", label: "Transferência para outra instituição" },
  { key: "volta_residencia", label: "Volta à residência (familiar/própria)" },
];
const PARENTESCOS = [...GRAUS_PARENTESCO] as string[];

function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full border text-xs font-bold transition-colors",
        ativo
          ? "border-primary bg-primary/10 text-primary"
          : "border-border hover:border-primary/50 hover:bg-black/[0.02]",
      )}
    >
      {children}
    </button>
  );
}

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
  origem_procedencia: OrigemProcedencia | null;
  origem_procedencia_instituicao: string | null;
  estado_civil: EstadoCivil | null;
  numero_filhos_vivos: number | null;
  altura_cm: number | null;
  peso_kg: number | null;
  responsavel_principal_nome: string | null;
  responsavel_principal_parentesco: string | null;
  responsavel_principal_parentesco_outro: string | null;
  responsavel_principal_telefone: string | null;
  data_rescisao_contrato: string | null;
  motivo_rescisao: MotivoRescisao | null;
  instituicao_destino: string | null;
  observacoes_rescisao: string | null;
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
  origem_procedencia: OrigemProcedencia | null;
  origem_procedencia_instituicao: string | null;
  estado_civil: EstadoCivil | null;
  numero_filhos_vivos: number | null;
  altura_cm: number | null;
  peso_kg: number | null;
  responsavel_principal_nome: string | null;
  responsavel_principal_parentesco: string | null;
  responsavel_principal_parentesco_outro: string | null;
  responsavel_principal_telefone: string | null;
  data_rescisao_contrato: string | null;
  motivo_rescisao: MotivoRescisao | null;
  instituicao_destino: string | null;
  observacoes_rescisao: string | null;
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
  const [origem, setOrigem] = useState<OrigemProcedencia | null>(residente?.origem_procedencia ?? null);
  const [estadoCivil, setEstadoCivil] = useState<EstadoCivil | null>(residente?.estado_civil ?? null);
  const [parentesco, setParentesco] = useState<string | null>(residente?.responsavel_principal_parentesco ?? null);
  const [telefone, setTelefone] = useState(residente?.responsavel_principal_telefone ?? "");
  const [dataRescisao, setDataRescisao] = useState(residente?.data_rescisao_contrato ?? "");
  const [motivoRescisao, setMotivoRescisao] = useState<MotivoRescisao | null>(residente?.motivo_rescisao ?? null);
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
    if (dataRescisao && !motivoRescisao) {
      toast.error("Informe o motivo da rescisão");
      return;
    }
    const num = (k: string) => {
      const v = (fd.get(k) as string) || "";
      return v.trim() === "" ? null : Number(v);
    };
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
      origem_procedencia: origem,
      origem_procedencia_instituicao:
        origem === "outra_instituicao" ? (fd.get("origem_procedencia_instituicao") as string) || null : null,
      estado_civil: estadoCivil,
      numero_filhos_vivos: num("numero_filhos_vivos"),
      altura_cm: num("altura_cm"),
      peso_kg: num("peso_kg"),
      responsavel_principal_nome: (fd.get("responsavel_principal_nome") as string) || null,
      responsavel_principal_parentesco: parentesco,
      responsavel_principal_parentesco_outro:
        parentesco === "Outro" ? (fd.get("responsavel_principal_parentesco_outro") as string) || null : null,
      responsavel_principal_telefone: telefone.trim() || null,
      data_rescisao_contrato: dataRescisao || null,
      motivo_rescisao: dataRescisao ? motivoRescisao : null,
      instituicao_destino:
        dataRescisao && motivoRescisao === "transferencia" ? (fd.get("instituicao_destino") as string) || null : null,
      observacoes_rescisao: dataRescisao ? (fd.get("observacoes_rescisao") as string) || null : null,
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
        <Label>Data de admissão</Label>
        <Input name="data_admissao" type="date" defaultValue={residente?.data_admissao ?? ""} />
      </div>
      <div className="col-span-2">
        <Label>Contatos</Label>
        <TextareaDitavel name="contatos" rows={2} placeholder="Telefones, e-mails, familiares..." defaultValue={residente?.contatos ?? ""} />
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

      <fieldset className="col-span-2 border border-border rounded-md p-4 space-y-3">
        <legend className="px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Perfil social e antropometria</legend>
        <div>
          <Label>Origem de procedência</Label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {ORIGENS.map((o) => (
              <Chip key={o.key} ativo={origem === o.key} onClick={() => setOrigem(origem === o.key ? null : o.key)}>
                {o.label}
              </Chip>
            ))}
          </div>
        </div>
        {origem === "outra_instituicao" && (
          <div>
            <Label>Nome da instituição de origem</Label>
            <Input name="origem_procedencia_instituicao" defaultValue={residente?.origem_procedencia_instituicao ?? ""} />
          </div>
        )}
        <div>
          <Label>Estado civil</Label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {ESTADOS_CIVIS.map((o) => (
              <Chip key={o.key} ativo={estadoCivil === o.key} onClick={() => setEstadoCivil(estadoCivil === o.key ? null : o.key)}>
                {o.label}
              </Chip>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Filhos vivos</Label>
            <Input name="numero_filhos_vivos" type="number" min={0} defaultValue={residente?.numero_filhos_vivos ?? ""} />
          </div>
          <div>
            <Label>Altura (cm)</Label>
            <Input name="altura_cm" type="number" step="0.1" min={0} defaultValue={residente?.altura_cm ?? ""} />
          </div>
          <div>
            <Label>Peso (kg)</Label>
            <Input name="peso_kg" type="number" step="0.1" min={0} defaultValue={residente?.peso_kg ?? ""} />
          </div>
        </div>
      </fieldset>

      <fieldset className="col-span-2 border border-border rounded-md p-4 space-y-3">
        <legend className="px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Responsável principal</legend>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Nome do responsável</Label>
            <Input name="responsavel_principal_nome" defaultValue={residente?.responsavel_principal_nome ?? ""} />
          </div>
          <div>
            <Label>Telefone de contato</Label>
            <Input
              name="responsavel_principal_telefone"
              value={telefone}
              onChange={(e) => setTelefone(maskCelular(e.target.value))}
              placeholder="(00) 00000-0000"
            />
          </div>
        </div>
        <div>
          <Label>Parentesco/relação</Label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {PARENTESCOS.map((p) => (
              <Chip key={p} ativo={parentesco === p} onClick={() => setParentesco(parentesco === p ? null : p)}>
                {p}
              </Chip>
            ))}
          </div>
        </div>
        {parentesco === "Outro" && (
          <div>
            <Label>Especifique a relação</Label>
            <Input
              name="responsavel_principal_parentesco_outro"
              defaultValue={residente?.responsavel_principal_parentesco_outro ?? ""}
            />
          </div>
        )}
      </fieldset>

      <fieldset className="col-span-2 border border-border rounded-md p-4 space-y-3">
        <legend className="px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Rescisão de contrato</legend>
        <p className="text-[11px] text-muted-foreground">
          Preencha apenas quando o residente deixar a instituição. Ao salvar com data de rescisão, o cadastro passa a
          <b> inativo</b> e a vaga do quarto é liberada — todo o histórico é preservado.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Data de rescisão</Label>
            <Input type="date" value={dataRescisao} onChange={(e) => setDataRescisao(e.target.value)} />
          </div>
        </div>
        {dataRescisao && (
          <>
            <div>
              <Label>Motivo da rescisão *</Label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {MOTIVOS_RESCISAO.map((m) => (
                  <Chip key={m.key} ativo={motivoRescisao === m.key} onClick={() => setMotivoRescisao(m.key)}>
                    {m.label}
                  </Chip>
                ))}
              </div>
            </div>
            {motivoRescisao === "transferencia" && (
              <div>
                <Label>Nome da instituição de destino</Label>
                <Input name="instituicao_destino" defaultValue={residente?.instituicao_destino ?? ""} />
              </div>
            )}
            <div>
              <Label>Observações da rescisão</Label>
              <TextareaDitavel name="observacoes_rescisao" rows={2} defaultValue={residente?.observacoes_rescisao ?? ""} />
            </div>
          </>
        )}
      </fieldset>



      <fieldset className="col-span-2 border border-border rounded-md p-4 space-y-3">
        <legend className="px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Endereço</legend>
        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-1">
            <Label>CEP</Label>
            <Input name="endereco_cep" defaultValue={residente?.endereco_cep ?? ""} />
          </div>
          <div className="col-span-3">
            <Label>Logradouro</Label>
            <Input name="endereco_logradouro" defaultValue={residente?.endereco_logradouro ?? ""} />
          </div>
          <div className="col-span-1">
            <Label>Número</Label>
            <Input name="endereco_numero" defaultValue={residente?.endereco_numero ?? ""} />
          </div>
          <div className="col-span-3">
            <Label>Complemento</Label>
            <Input name="endereco_complemento" defaultValue={residente?.endereco_complemento ?? ""} />
          </div>
          <div className="col-span-2">
            <Label>Bairro</Label>
            <Input name="endereco_bairro" defaultValue={residente?.endereco_bairro ?? ""} />
          </div>
          <div className="col-span-1">
            <Label>Cidade</Label>
            <Input name="endereco_cidade" defaultValue={residente?.endereco_cidade ?? ""} />
          </div>
          <div className="col-span-1">
            <Label>Estado</Label>
            <Input name="endereco_estado" maxLength={2} defaultValue={residente?.endereco_estado ?? ""} />
          </div>
        </div>
      </fieldset>

      <div className="col-span-2">
        <Label>Histórico médico resumido</Label>
        <TextareaDitavel name="historico_medico" rows={3} defaultValue={residente?.historico_medico ?? ""} />
      </div>
      <div className="col-span-2">
        <Label>Observações</Label>
        <TextareaDitavel name="observacoes" rows={3} defaultValue={residente?.observacoes ?? ""} />
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
  const [deleting, setDeleting] = useState<Residente | null>(null);
  const [mostrarInativos, setMostrarInativos] = useState(false);

  const todosResidentes = useQuery({
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

  const residentes = {
    ...todosResidentes,
    data: mostrarInativos
      ? todosResidentes.data
      : todosResidentes.data?.filter((r) => r.ativo),
  };


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

  const removeResidente = useMutation({
    mutationFn: async (r: Residente) => {
      const { error } = await supabase.from("residentes").delete().eq("id", r.id);
      if (error) throw error;
      if (r.foto_url) {
        await supabase.storage.from("residentes-fotos").remove([r.foto_url]);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["residentes"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["dashboard-residentes"] });
      setDeleting(null);
      toast.success("Registro de residente eliminado");
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

  const printFicha = async (r: Residente) => {
    let fotoImg = "";
    if (r.foto_url) {
      const { data } = await supabase.storage.from("residentes-fotos").createSignedUrl(r.foto_url, 3600);
      if (data?.signedUrl) fotoImg = `<img src="${data.signedUrl}" alt="foto" />`;
    }
    const enderecoLinha1 = [r.endereco_logradouro, r.endereco_numero].filter(Boolean).join(", ");
    const enderecoLinha2 = [r.endereco_complemento, r.endereco_bairro].filter(Boolean).join(" — ");
    const enderecoLinha3 = [
      [r.endereco_cidade, r.endereco_estado].filter(Boolean).join("/"),
      r.endereco_cep ? `CEP ${r.endereco_cep}` : null,
    ].filter(Boolean).join(" — ");
    const enderecoFull = [enderecoLinha1, enderecoLinha2, enderecoLinha3].filter(Boolean).join("<br/>") || "—";
    const dataNasc = r.data_nascimento ? new Date(r.data_nascimento).toLocaleDateString("pt-BR") : "—";
    const dataAdm = r.data_admissao ? new Date(r.data_admissao).toLocaleDateString("pt-BR") : "—";
    const esc = (v: string | null | undefined) => (v ?? "—").toString().replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));
    const nl2br = (v: string | null | undefined) => esc(v).replace(/\n/g, "<br/>");
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
<title>Ficha — ${esc(r.nome_completo)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  * { box-sizing: border-box; }
  body { font-family: Inter, Arial, sans-serif; color: #111; margin: 0; font-size: 11pt; line-height: 1.45; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #c8102e; padding-bottom: 12px; margin-bottom: 18px; }
  .header h1 { margin: 0; font-size: 18pt; font-weight: 800; letter-spacing: -0.01em; }
  .header .sub { font-size: 9pt; color: #666; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; }
  .top { display: grid; grid-template-columns: 110px 1fr; gap: 18px; margin-bottom: 20px; }
  .top img { width: 110px; height: 110px; object-fit: cover; border: 1px solid #ddd; border-radius: 6px; }
  .top .placeholder { width: 110px; height: 110px; border: 1px dashed #bbb; border-radius: 6px; display:flex; align-items:center; justify-content:center; color:#999; font-size: 10pt; }
  .name { font-size: 16pt; font-weight: 800; margin: 0 0 4px; }
  .status { display: inline-block; font-size: 8pt; font-weight: 800; padding: 2px 8px; border-radius: 3px; text-transform: uppercase; letter-spacing: 0.05em; }
  .st-estavel { background:#dcfce7; color:#166534; }
  .st-observacao { background:#ffedd5; color:#9a3412; }
  .st-critico { background:#fee2e2; color:#991b1b; }
  section { margin-bottom: 16px; page-break-inside: avoid; }
  h2 { font-size: 10pt; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin: 0 0 8px; color: #c8102e; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px 20px; }
  .field { display: flex; gap: 6px; }
  .field .k { font-weight: 700; color: #555; min-width: 110px; }
  .block { white-space: pre-wrap; }
  .footer { position: fixed; bottom: 8mm; left: 18mm; right: 18mm; font-size: 8pt; color: #888; text-align: center; border-top: 1px solid #eee; padding-top: 6px; }
</style></head><body>
  <div class="header">
    <div>
      <h1>Ficha do Residente</h1>
      <div class="sub">Residencial São Camilo</div>
    </div>
    <div class="sub">Emitido em ${new Date().toLocaleDateString("pt-BR")}</div>
  </div>

  <div class="top">
    ${fotoImg || '<div class="placeholder">Sem foto</div>'}
    <div>
      <p class="name">${esc(r.nome_completo)}</p>
      <span class="status st-${r.status}">${r.status.toUpperCase()}</span>
      <div class="grid" style="margin-top:10px">
        <div class="field"><span class="k">Nascimento:</span><span>${dataNasc}</span></div>
        <div class="field"><span class="k">Admissão:</span><span>${dataAdm}</span></div>
        <div class="field"><span class="k">RG:</span><span>${esc(r.rg)}</span></div>
        <div class="field"><span class="k">CPF:</span><span>${esc(r.cpf)}</span></div>
        <div class="field"><span class="k">Quarto:</span><span>${esc(r.quartos?.numero ?? null)}</span></div>
        <div class="field"><span class="k">Convênio:</span><span>${esc(r.convenio)}</span></div>
      </div>
    </div>
  </div>

  <section>
    <h2>Endereço</h2>
    <div>${enderecoFull}</div>
  </section>

  <section>
    <h2>Contatos</h2>
    <div class="block">${nl2br(r.contatos)}</div>
  </section>

  <section>
    <h2>Saúde</h2>
    <div class="grid">
      <div class="field"><span class="k">Alergias:</span><span>${esc(r.alergias)}</span></div>
      <div class="field"><span class="k">Dieta:</span><span>${esc(r.dieta)}</span></div>
    </div>
  </section>

  <section>
    <h2>Histórico médico</h2>
    <div class="block">${nl2br(r.historico_medico)}</div>
  </section>

  <section>
    <h2>Observações</h2>
    <div class="block">${nl2br(r.observacoes)}</div>
  </section>

  <div class="footer">Documento confidencial — uso interno do Residencial São Camilo.</div>
  <script>window.addEventListener('load', () => setTimeout(() => window.print(), 300));</script>
</body></html>`;
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) { toast.error("Bloqueador de pop-ups impediu a impressão"); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const printListagem = () => {
    const esc = (v: string | null | undefined) =>
      (v ?? "—").toString().replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));
    const lista = [...(residentes.data ?? [])].sort((a, b) =>
      a.nome_completo.localeCompare(b.nome_completo, "pt-BR"),
    );
    if (lista.length === 0) { toast.error("Nenhuma residente para listar"); return; }
    const linhas = lista
      .map((r, i) => {
        const idade = calcularIdade(r.data_nascimento);
        return `<tr><td class="num">${i + 1}</td><td class="nome">${esc(r.nome_completo)}</td><td>${idade ?? "—"}</td><td class="mono">${esc(r.quartos?.numero ?? null)}</td><td>${esc(r.convenio)}</td></tr>`;
      })
      .join("");
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
<title>Listagem de residentes</title>
<style>
  @page { size: A4 portrait; margin: 15mm; }
  body { font-family: Inter, Arial, sans-serif; color:#111; margin:0; font-size:10.5pt; }
  h1 { font-size:16pt; margin:0 0 2px; }
  .sub { font-size:9pt; color:#666; text-transform:uppercase; letter-spacing:.08em; font-weight:700; }
  header { border-bottom:3px solid #8B0000; padding-bottom:10px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:flex-end; }
  table { width:100%; border-collapse:collapse; }
  th { text-align:left; font-size:8.5pt; text-transform:uppercase; letter-spacing:.06em; border-bottom:1.5px solid #333; padding:6px 6px; }
  td { padding:6px; border-bottom:1px solid #e5e5e5; }
  tr { page-break-inside:avoid; }
  .num { width:28px; color:#888; }
  .nome { font-weight:700; }
  .mono { font-family:ui-monospace, monospace; }
  footer { margin-top:12px; font-size:8pt; color:#888; text-align:center; }
</style></head><body>
  <header>
    <div><h1>Listagem de Residentes</h1><div class="sub">Residencial São Camilo</div></div>
    <div class="sub">${lista.length} residentes • ${new Date().toLocaleDateString("pt-BR")}</div>
  </header>
  <table>
    <thead><tr><th></th><th>Nome</th><th>Idade</th><th>Quarto</th><th>Convênio</th></tr></thead>
    <tbody>${linhas}</tbody>
  </table>
  <footer>Documento confidencial — uso interno do Residencial São Camilo.</footer>
  <script>window.addEventListener('load', () => setTimeout(() => window.print(), 300));</script>
</body></html>`;
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) { toast.error("Bloqueador de pop-ups impediu a impressão"); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {residentes.data?.length ?? 0} residente(s) {mostrarInativos ? "listados" : "ativos"}
          </p>
          <label className="mt-1 flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={mostrarInativos}
              onChange={(e) => setMostrarInativos(e.target.checked)}
              className="size-3.5 accent-current"
            />
            Mostrar inativos (ex-residentes)
          </label>
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
          <Button
            variant="outline"
            onClick={printListagem}
            disabled={!residentes.data?.length}
            title="Imprimir listagem alfabética (A4)"
          >
            <ListOrdered className="size-4 mr-1" /> Imprimir listagem
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
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Contatos</th>
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
                        <button
                          type="button"
                          className="text-sm font-bold text-left underline-offset-2 hover:underline"
                          onClick={() => setEditingResidente(r)}
                          title="Abrir cadastro da residente"
                        >
                          {r.nome_completo}
                        </button>
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
                  {r.ativo ? (
                    <span className={cn(
                      "px-2 py-0.5 text-[10px] font-bold rounded-sm",
                      r.status === "estavel" && "bg-green-100 text-green-700",
                      r.status === "observacao" && "bg-orange-100 text-orange-700",
                      r.status === "critico" && "bg-primary/10 text-primary",
                    )}>{r.status.toUpperCase()}</span>
                  ) : (
                    <span
                      className="px-2 py-0.5 text-[10px] font-bold rounded-sm bg-slate-200 text-slate-600"
                      title={r.data_rescisao_contrato ? `Rescisão em ${new Date(r.data_rescisao_contrato + "T00:00:00").toLocaleDateString("pt-BR")}` : undefined}
                    >
                      INATIVO
                    </span>
                  )}
                </td>

                <td className="px-4 py-4 text-xs text-muted-foreground">{r.alergias || "—"}</td>
                <td className="px-4 py-4 text-xs">
                  {r.contatos ? (
                    <p className="whitespace-pre-line line-clamp-3">{r.contatos}</p>
                  ) : "—"}
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      onClick={() => setEditingResidente(r)}
                      title="Editar cadastro"
                    >
                      <FilePen className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      onClick={() => printFicha(r)}
                      title="Imprimir ficha (A4)"
                    >
                      <Printer className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 text-primary hover:bg-primary/10"
                      onClick={() => setDeleting(r)}
                      title="Eliminar registro"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </td>

              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AlertDialog open={deleting !== null} onOpenChange={(v) => { if (!v) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar registro de residente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é definitiva. Todo o histórico de <b>{deleting?.nome_completo}</b> (prescrições,
              sinais vitais, evoluções, incidentes e checklists) será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeResidente.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (deleting) removeResidente.mutate(deleting); }}
              disabled={removeResidente.isPending}
            >
              {removeResidente.isPending ? "Eliminando…" : "Eliminar definitivamente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
