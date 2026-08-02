import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Activity, Pencil, Printer, CalendarDays } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import logoAsset from "@/assets/logo_instituto_maior.png.asset.json";

export const Route = createFileRoute("/_authenticated/sinais-vitais")({
  head: () => ({
    meta: [
      { title: "Sinais vitais mensais · Residencial São Camilo" },
      { name: "description", content: "Planilha mensal de sinais vitais dos residentes: registro com data, edição de dados e impressão em folha A4." },
      { property: "og:title", content: "Sinais vitais mensais · Residencial São Camilo" },
      { property: "og:description", content: "Registre, corrija e imprima os sinais vitais mês a mês." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SinaisPage,
});

type Sinal = {
  id: string;
  residente_id: string;
  registrado_em: string;
  pressao_sistolica: number | null;
  pressao_diastolica: number | null;
  temperatura: number | null;
  frequencia_cardiaca: number | null;
  saturacao: number | null;
  glicemia: number | null;
  peso: number | null;
  observacoes: string | null;
  residentes: { nome_completo: string } | null;
};

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const esc = (v: unknown) => String(v ?? "—").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));

/** valor de <input type="datetime-local"> a partir de um ISO */
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function SinalForm({
  sinal,
  residentes,
  onSubmit,
  onCancel,
  isPending,
}: {
  sinal?: Sinal;
  residentes: { id: string; nome_completo: string }[];
  onSubmit: (payload: Record<string, unknown>) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const num = (k: string) => {
      const v = fd.get(k);
      return v ? Number(v) : null;
    };
    const dataStr = String(fd.get("registrado_em") || "");
    onSubmit({
      residente_id: fd.get("residente_id"),
      registrado_em: dataStr ? new Date(dataStr).toISOString() : new Date().toISOString(),
      pressao_sistolica: num("pressao_sistolica"),
      pressao_diastolica: num("pressao_diastolica"),
      temperatura: num("temperatura"),
      frequencia_cardiaca: num("frequencia_cardiaca"),
      saturacao: num("saturacao"),
      glicemia: num("glicemia"),
      peso: num("peso"),
      observacoes: fd.get("observacoes") || null,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label>Residente *</Label>
        <Select name="residente_id" required defaultValue={sinal?.residente_id}>
          <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
          <SelectContent>
            {residentes.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome_completo}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="flex items-center gap-1"><CalendarDays className="size-3.5" /> Data do registro *</Label>
        <Input
          name="registrado_em"
          type="datetime-local"
          required
          defaultValue={toLocalInput(sinal?.registrado_em ?? new Date().toISOString())}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>PA sistólica</Label><Input name="pressao_sistolica" type="number" placeholder="120" defaultValue={sinal?.pressao_sistolica ?? ""} /></div>
        <div><Label>PA diastólica</Label><Input name="pressao_diastolica" type="number" placeholder="80" defaultValue={sinal?.pressao_diastolica ?? ""} /></div>
        <div><Label>Temperatura (°C)</Label><Input name="temperatura" type="number" step="0.1" placeholder="36.5" defaultValue={sinal?.temperatura ?? ""} /></div>
        <div><Label>FC (bpm)</Label><Input name="frequencia_cardiaca" type="number" placeholder="72" defaultValue={sinal?.frequencia_cardiaca ?? ""} /></div>
        <div><Label>Saturação (%)</Label><Input name="saturacao" type="number" placeholder="98" defaultValue={sinal?.saturacao ?? ""} /></div>
        <div><Label>Glicemia (mg/dL)</Label><Input name="glicemia" type="number" placeholder="110" defaultValue={sinal?.glicemia ?? ""} /></div>
        <div><Label>Peso (kg)</Label><Input name="peso" type="number" step="0.1" placeholder="62.4" defaultValue={sinal?.peso ?? ""} /></div>
      </div>
      <div>
        <Label>Observações</Label>
        <Input name="observacoes" defaultValue={sinal?.observacoes ?? ""} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={isPending}>{sinal ? "Salvar alterações" : "Registrar"}</Button>
      </div>
    </form>
  );
}

function SinaisPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<Sinal | null>(null);
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());
  const [residenteFiltro, setResidenteFiltro] = useState<string>("todos");

  const inicio = useMemo(() => new Date(ano, mes, 1).toISOString(), [ano, mes]);
  const fim = useMemo(() => new Date(ano, mes + 1, 1).toISOString(), [ano, mes]);

  const sinais = useQuery({
    queryKey: ["sinais-vitais", ano, mes, residenteFiltro],
    queryFn: async () => {
      let q = supabase
        .from("sinais_vitais")
        .select("*, residentes(nome_completo)")
        .gte("registrado_em", inicio)
        .lt("registrado_em", fim)
        .order("registrado_em", { ascending: false });
      if (residenteFiltro !== "todos") q = q.eq("residente_id", residenteFiltro);
      const { data, error } = await q;
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
      const { error } = await supabase.from("sinais_vitais").insert({ ...payload, registrado_por: user.user?.id } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sinais-vitais"] });
      setOpen(false);
      toast.success("Sinais vitais registrados");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, unknown> }) => {
      const { error } = await supabase.from("sinais_vitais").update(payload as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sinais-vitais"] });
      setEditando(null);
      toast.success("Registro corrigido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const imprimir = () => {
    const linhas = sinais.data ?? [];
    const nomeFiltro =
      residenteFiltro === "todos"
        ? "Todos os residentes"
        : residentes.data?.find((r) => r.id === residenteFiltro)?.nome_completo ?? "";
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
<title>Sinais vitais — ${MESES[mes]}/${ano}</title>
<style>
@page { size: A4; margin: 14mm; }
body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#111; font-size:11px; }
header { display:flex; align-items:center; gap:12px; border-bottom:2px solid #111; padding-bottom:10px; margin-bottom:12px; }
header img { height:40px; }
h1 { font-size:16px; margin:0; }
table { width:100%; border-collapse:collapse; }
th, td { border:1px solid #bbb; padding:4px 6px; font-size:10px; text-align:left; }
th { background:#f1f1f1; text-transform:uppercase; font-size:9px; letter-spacing:.05em; }
footer { margin-top:16px; font-size:9px; color:#666; border-top:1px solid #ccc; padding-top:6px; }
</style></head><body>
<header><img src="${logoAsset.url}" alt="Logo" />
<div><h1>RESIDENCIAL SÃO CAMILO</h1>
<div style="font-size:10px;color:#555">Planilha mensal de sinais vitais — ${MESES[mes]}/${ano} · ${esc(nomeFiltro)}</div></div></header>
<table><thead><tr>
<th>Data/hora</th><th>Residente</th><th>PA</th><th>Temp</th><th>FC</th><th>SpO₂</th><th>Glicemia</th><th>Peso</th><th>Observações</th>
</tr></thead><tbody>
${linhas.length === 0 ? `<tr><td colspan="9">Nenhum registro no período.</td></tr>` :
  linhas.map((s) => `<tr>
    <td>${new Date(s.registrado_em).toLocaleString("pt-BR")}</td>
    <td>${esc(s.residentes?.nome_completo)}</td>
    <td>${s.pressao_sistolica ?? "—"}/${s.pressao_diastolica ?? "—"}</td>
    <td>${esc(s.temperatura)}</td><td>${esc(s.frequencia_cardiaca)}</td>
    <td>${esc(s.saturacao)}</td><td>${esc(s.glicemia)}</td><td>${esc(s.peso)}</td>
    <td>${esc(s.observacoes)}</td></tr>`).join("")}
</tbody></table>
<footer>${linhas.length} registro(s) · Emitido em ${new Date().toLocaleString("pt-BR")}</footer>
<script>window.onload=function(){setTimeout(function(){window.print();},400);};</script>
</body></html>`;
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };

  const anos = Array.from({ length: 6 }, (_, i) => hoje.getFullYear() - 4 + i);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Mês</Label>
            <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MESES.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Ano</Label>
            <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Residente</Label>
            <Select value={residenteFiltro} onValueChange={setResidenteFiltro}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {residentes.data?.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome_completo}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={imprimir}><Printer className="size-4 mr-1" /> Imprimir A4</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="size-4 mr-1" /> Registrar sinais</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Registrar sinais vitais</DialogTitle></DialogHeader>
              <SinalForm
                residentes={residentes.data ?? []}
                onSubmit={(p) => create.mutate(p)}
                onCancel={() => setOpen(false)}
                isPending={create.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {sinais.data?.length ?? 0} registro(s) em {MESES[mes]}/{ano}
      </p>

      {sinais.data?.length === 0 ? (
        <div className="bg-surface border border-border rounded-lg p-12 text-center">
          <Activity className="size-8 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum sinal vital registrado neste mês.</p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-lg overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-black/[0.02] border-b border-border">
              <tr>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider">Data do registro</th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider">Residente</th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider">PA</th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider">Temp</th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider">FC</th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider">SpO₂</th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider">Glicemia</th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider">Peso</th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-right">Ações</th>
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
                  <td className="px-3 py-3">{s.peso ?? "—"}</td>
                  <td className="px-3 py-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => setEditando(s)}>
                      <Pencil className="size-3.5 mr-1" /> Editar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!editando} onOpenChange={(o) => !o && setEditando(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Corrigir registro de sinais vitais</DialogTitle></DialogHeader>
          {editando && (
            <SinalForm
              sinal={editando}
              residentes={residentes.data ?? []}
              onSubmit={(p) => update.mutate({ id: editando.id, payload: p })}
              onCancel={() => setEditando(null)}
              isPending={update.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
