import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer, FileText, BellRing } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import logoAsset from "@/assets/logo_instituto_maior.png.asset.json";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EvolucaoMultiprofissional } from "@/components/evolucao-multi";
import { useAlertasAtivos } from "@/components/alertas-sino";
import { numeroProntuario, idadeEmAnos } from "@/lib/multiprofissional";


export const Route = createFileRoute("/_authenticated/prontuario")({
  head: () => ({
    meta: [
      { title: "Prontuário do residente · Residencial São Camilo" },
      { name: "description", content: "Prontuário completo por residente: dados pessoais, endereço, prescrições, sinais vitais, incidentes e rotina diária, pronto para impressão." },
      { property: "og:title", content: "Prontuário do residente · Residencial São Camilo" },
      { property: "og:description", content: "Consulte e imprima o prontuário completo de cada residente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProntuarioPage,
});

const fmtData = (v?: string | null) => (v ? new Date(v).toLocaleDateString("pt-BR") : "—");
const fmtDataHora = (v?: string | null) => (v ? new Date(v).toLocaleString("pt-BR") : "—");
const esc = (v: unknown) =>
  String(v ?? "—").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));

function ProntuarioPage() {
  const [selecionado, setSelecionado] = useState<string | null>(null);

  const residentes = useQuery({
    queryKey: ["residentes-prontuario"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("residentes")
        .select("id, nome_completo")
        .eq("ativo", true)
        .order("nome_completo");
      if (error) throw error;
      return data ?? [];
    },
  });

  const prontuario = useQuery({
    queryKey: ["prontuario", selecionado],
    enabled: !!selecionado,
    queryFn: async () => {
      const [res, meds, sinais, incs, checks] = await Promise.all([
        supabase.from("residentes").select("*, quartos(numero, ala)").eq("id", selecionado!).maybeSingle(),
        supabase.from("medicamentos").select("*").eq("residente_id", selecionado!).order("nome"),
        supabase.from("sinais_vitais").select("*").eq("residente_id", selecionado!).order("registrado_em", { ascending: false }).limit(60),
        supabase.from("incidentes").select("*").eq("residente_id", selecionado!).order("ocorrido_em", { ascending: false }).limit(60),
        supabase.from("checklist_itens").select("*").eq("residente_id", selecionado!).order("data", { ascending: false }).limit(60),
      ]);
      return {
        residente: res.data as Record<string, unknown> | null,
        medicamentos: (meds.data ?? []) as Record<string, unknown>[],
        sinais: (sinais.data ?? []) as Record<string, unknown>[],
        incidentes: (incs.data ?? []) as Record<string, unknown>[],
        checklists: (checks.data ?? []) as Record<string, unknown>[],
      };
    },
  });

  const imprimir = async () => {
    const d = prontuario.data;
    if (!d?.residente) return;
    const r = d.residente as any;
    let fotoTag = "";
    if (r.foto_url) {
      const { data } = await supabase.storage.from("residentes-fotos").createSignedUrl(r.foto_url, 3600);
      if (data?.signedUrl) fotoTag = `<img class="foto" src="${data.signedUrl}" alt="Foto" />`;
    }
    const endereco = [r.endereco_logradouro, r.endereco_numero, r.endereco_complemento, r.endereco_bairro,
      [r.endereco_cidade, r.endereco_estado].filter(Boolean).join("/"), r.endereco_cep]
      .filter(Boolean).join(", ");

    const linha = (k: string, v: unknown) => `<div class="item"><span>${k}</span><strong>${esc(v)}</strong></div>`;

    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
<title>Prontuário — ${esc(r.nome_completo)}</title>
<style>
@page { size: A4; margin: 16mm; }
* { box-sizing: border-box; }
body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#111; font-size:11px; }
header { display:flex; align-items:center; gap:12px; border-bottom:2px solid #111; padding-bottom:10px; margin-bottom:14px; }
header img.logo { height:40px; }
h1 { font-size:16px; margin:0; letter-spacing:-.3px; }
h2 { font-size:12px; text-transform:uppercase; letter-spacing:.08em; margin:18px 0 6px; border-bottom:1px solid #ccc; padding-bottom:3px; }
.grid { display:grid; grid-template-columns:repeat(3,1fr); gap:6px 14px; }
.item span { display:block; font-size:9px; text-transform:uppercase; color:#666; letter-spacing:.06em; }
.item strong { font-size:11px; font-weight:600; }
.foto { width:90px; height:90px; object-fit:cover; border:1px solid #ccc; border-radius:4px; float:right; margin-left:12px; }
table { width:100%; border-collapse:collapse; margin-top:4px; }
th, td { border:1px solid #bbb; padding:4px 6px; text-align:left; font-size:10px; }
th { background:#f1f1f1; text-transform:uppercase; font-size:9px; letter-spacing:.05em; }
footer { margin-top:20px; font-size:9px; color:#666; border-top:1px solid #ccc; padding-top:6px; }
</style></head><body>
<header>
  <img class="logo" src="${logoAsset.url}" alt="Logo" />
  <div><h1>RESIDENCIAL SÃO CAMILO</h1><div style="font-size:10px;color:#555">Prontuário do residente</div></div>
</header>
${fotoTag}
<h2>Identificação</h2>
<div class="grid">
  ${linha("Nome completo", r.nome_completo)}
  ${linha("Nascimento", fmtData(r.data_nascimento))}
  ${linha("Admissão", fmtData(r.data_admissao))}
  ${linha("RG", r.rg)}
  ${linha("CPF", r.cpf)}
  ${linha("Convênio", r.convenio)}
  ${linha("Quarto", r.quartos?.numero)}
  ${linha("Ala", r.quartos?.ala)}
  ${linha("Status", r.status)}
</div>
<h2>Endereço</h2>
<div>${esc(endereco || "—")}</div>
<h2>Contatos</h2>
<div>${esc(r.contatos)}</div>
<h2>Saúde</h2>
<div class="grid" style="grid-template-columns:1fr 1fr">
  ${linha("Alergias", r.alergias)}
  ${linha("Dieta", r.dieta)}
</div>
<div style="margin-top:6px"><span style="font-size:9px;text-transform:uppercase;color:#666">Histórico médico</span><div>${esc(r.historico_medico)}</div></div>
<div style="margin-top:6px"><span style="font-size:9px;text-transform:uppercase;color:#666">Observações</span><div>${esc(r.observacoes)}</div></div>

<h2>Medicações</h2>
${d.medicamentos.length === 0 ? "<div>Nenhuma medicação registrada.</div>" : `<table>
<thead><tr><th>Medicação</th><th>Dose</th><th>Via</th><th>Horários</th><th>Obs.</th></tr></thead>
<tbody>${d.medicamentos.map((m: any) => `<tr><td>${esc(m.nome)}</td><td>${esc(m.dosagem)}</td><td>${esc(m.via)}</td><td>${esc((m.horarios ?? []).join(", "))}</td><td>${esc(m.observacoes)}</td></tr>`).join("")}</tbody></table>`}

<h2>Sinais vitais (últimos registros)</h2>
${d.sinais.length === 0 ? "<div>Nenhum registro.</div>" : `<table>
<thead><tr><th>Data</th><th>PA</th><th>Temp</th><th>FC</th><th>SpO₂</th><th>Glicemia</th><th>Peso</th><th>Obs.</th></tr></thead>
<tbody>${d.sinais.map((s: any) => `<tr><td>${fmtDataHora(s.registrado_em)}</td><td>${s.pressao_sistolica ?? "—"}/${s.pressao_diastolica ?? "—"}</td><td>${esc(s.temperatura)}</td><td>${esc(s.frequencia_cardiaca)}</td><td>${esc(s.saturacao)}</td><td>${esc(s.glicemia)}</td><td>${esc(s.peso)}</td><td>${esc(s.observacoes)}</td></tr>`).join("")}</tbody></table>`}

<h2>Incidentes</h2>
${d.incidentes.length === 0 ? "<div>Nenhum incidente.</div>" : `<table>
<thead><tr><th>Data</th><th>Tipo</th><th>Severidade</th><th>Descrição</th><th>Ação tomada</th><th>Resolvido</th></tr></thead>
<tbody>${d.incidentes.map((i: any) => `<tr><td>${fmtDataHora(i.ocorrido_em)}</td><td>${esc(i.tipo)}</td><td>${esc(i.severidade)}</td><td>${esc(i.descricao)}</td><td>${esc(i.acao_tomada)}</td><td>${i.resolvido ? "Sim" : "Não"}</td></tr>`).join("")}</tbody></table>`}

<h2>Rotina diária (checklists)</h2>
${d.checklists.length === 0 ? "<div>Nenhum item.</div>" : `<table>
<thead><tr><th>Data</th><th>Turno</th><th>Tarefa</th><th>Concluído</th></tr></thead>
<tbody>${d.checklists.map((c: any) => `<tr><td>${fmtData(c.data)}</td><td>${esc(c.turno)}</td><td>${esc(c.tarefa)}</td><td>${c.concluido ? "Sim" : "Não"}</td></tr>`).join("")}</tbody></table>`}

<footer>Emitido em ${new Date().toLocaleString("pt-BR")} · Documento confidencial — uso clínico interno (LGPD)</footer>
<script>window.onload = function(){ setTimeout(function(){ window.print(); }, 400); };</script>
</body></html>`;

    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };

  const r = prontuario.data?.residente as any;

  return (
    <div className="grid lg:grid-cols-[260px_1fr] gap-6">
      <aside className="bg-surface border border-border rounded-lg p-3 h-fit max-h-[70vh] overflow-y-auto">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 pb-2">Residentes</p>
        {residentes.data?.map((res) => (
          <button
            key={res.id}
            onClick={() => setSelecionado(res.id)}
            className={cn(
              "w-full text-left px-2 py-2 rounded-md text-sm transition-colors",
              selecionado === res.id ? "bg-foreground text-background font-bold" : "hover:bg-black/5"
            )}
          >
            {res.nome_completo}
          </button>
        ))}
        {residentes.data?.length === 0 && (
          <p className="text-xs text-muted-foreground px-2">Nenhum residente ativo.</p>
        )}
      </aside>

      <section className="space-y-6">
        {!selecionado ? (
          <div className="bg-surface border border-border rounded-lg p-12 text-center">
            <FileText className="size-8 mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Selecione um residente para ver o prontuário completo.</p>
          </div>
        ) : prontuario.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando prontuário…</p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold tracking-tight">{r?.nome_completo}</h2>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Quarto {r?.quartos?.numero ?? "—"} · Nascimento {fmtData(r?.data_nascimento)}
                </p>
              </div>
              <Button onClick={imprimir}><Printer className="size-4 mr-1" /> Imprimir prontuário (A4)</Button>
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              {[
                ["RG", r?.rg], ["CPF", r?.cpf], ["Convênio", r?.convenio],
                ["Admissão", fmtData(r?.data_admissao)], ["Alergias", r?.alergias], ["Dieta", r?.dieta],
              ].map(([k, v]) => (
                <div key={k as string} className="bg-surface border border-border rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</p>
                  <p className="text-sm font-bold">{(v as string) || "—"}</p>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              {[
                ["Medicações", prontuario.data?.medicamentos.length ?? 0],
                ["Sinais vitais", prontuario.data?.sinais.length ?? 0],
                ["Incidentes", prontuario.data?.incidentes.length ?? 0],
                ["Itens de rotina", prontuario.data?.checklists.length ?? 0],
              ].map(([k, v]) => (
                <div key={k as string} className="bg-surface border border-border rounded-lg p-4 flex items-baseline justify-between">
                  <span className="text-sm font-medium">{k}</span>
                  <span className="text-2xl font-extrabold">{v as number}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
