import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, Cake } from "lucide-react";
import { toast } from "sonner";
import { calcularIdade } from "./residentes";

export const Route = createFileRoute("/_authenticated/aniversariantes")({
  component: AniversariantesPage,
  head: () => ({
    meta: [
      { title: "Aniversariantes do mês | Residencial São Camilo" },
      {
        name: "description",
        content:
          "Lista mensal de residentes aniversariantes do Residencial São Camilo, pronta para impressão em folha A4 para mural.",
      },
      { property: "og:title", content: "Aniversariantes do mês | Residencial São Camilo" },
      {
        property: "og:description",
        content: "Lista mensal de residentes aniversariantes, pronta para impressão em mural.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

type Aniversariante = {
  id: string;
  nome_completo: string;
  data_nascimento: string | null;
  quartos: { numero: string } | null;
};

function AniversariantesPage() {
  const [mes, setMes] = useState(String(new Date().getMonth() + 1));

  const residentes = useQuery({
    queryKey: ["aniversariantes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("residentes")
        .select("id, nome_completo, data_nascimento, quartos(numero)")
        .order("nome_completo");
      if (error) throw error;
      return (data ?? []) as unknown as Aniversariante[];
    },
  });

  const lista = (residentes.data ?? [])
    .filter((r) => r.data_nascimento && Number(r.data_nascimento.split("-")[1]) === Number(mes))
    .sort((a, b) => {
      const da = Number(a.data_nascimento!.split("-")[2]);
      const db = Number(b.data_nascimento!.split("-")[2]);
      return da - db || a.nome_completo.localeCompare(b.nome_completo, "pt-BR");
    });

  const nomeMes = MESES[Number(mes) - 1];

  const imprimir = () => {
    if (lista.length === 0) {
      toast.error("Nenhuma aniversariante neste mês");
      return;
    }
    const esc = (v: string) => v.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));
    const linhas = lista
      .map((r) => {
        const dia = String(Number(r.data_nascimento!.split("-")[2])).padStart(2, "0");
        const idade = calcularIdade(r.data_nascimento);
        return `<li><span class="dia">${dia}</span><span class="nome">${esc(r.nome_completo)}</span><span class="idade">${idade !== null ? `${idade + 1} anos` : ""}</span></li>`;
      })
      .join("");
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
<title>Aniversariantes de ${nomeMes}</title>
<style>
  @page { size: A4 portrait; margin: 14mm; }
  body { font-family: Inter, Arial, sans-serif; color:#111; margin:0; }
  header { text-align:center; border-bottom:5px solid #8B0000; padding-bottom:10px; margin-bottom:18px; }
  h1 { font-size:40pt; margin:0; letter-spacing:-0.02em; text-transform:uppercase; }
  .mes { font-size:30pt; font-weight:800; color:#8B0000; margin-top:2px; }
  ul { list-style:none; padding:0; margin:0; }
  li { display:flex; align-items:baseline; gap:14px; padding:9px 0; border-bottom:1px dashed #ccc; page-break-inside:avoid; }
  .dia { font-size:22pt; font-weight:800; color:#8B0000; min-width:52px; }
  .nome { font-size:26pt; font-weight:700; flex:1; line-height:1.15; }
  .idade { font-size:16pt; color:#555; white-space:nowrap; }
  footer { margin-top:16px; text-align:center; font-size:11pt; color:#666; }
</style></head><body>
  <header>
    <h1>Aniversariantes</h1>
    <div class="mes">${nomeMes}</div>
  </header>
  <ul>${linhas}</ul>
  <footer>Residencial São Camilo</footer>
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
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {lista.length} aniversariante(s) em {nomeMes}
        </p>
        <div className="flex items-center gap-2">
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES.map((m, i) => (
                <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={imprimir} disabled={lista.length === 0}>
            <Printer className="size-4 mr-1" /> Imprimir mural (A4)
          </Button>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg p-8">
        <div className="text-center border-b-4 border-primary pb-4 mb-6">
          <h2 className="text-4xl font-extrabold uppercase tracking-tight">Aniversariantes</h2>
          <p className="text-3xl font-extrabold text-primary mt-1">{nomeMes}</p>
        </div>

        {residentes.isLoading && (
          <p className="text-center text-sm text-muted-foreground py-10">Carregando…</p>
        )}

        {!residentes.isLoading && lista.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Cake className="size-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhuma residente faz aniversário em {nomeMes}.</p>
          </div>
        )}

        <ul className="divide-y divide-dashed divide-border">
          {lista.map((r) => {
            const dia = String(Number(r.data_nascimento!.split("-")[2])).padStart(2, "0");
            const idade = calcularIdade(r.data_nascimento);
            return (
              <li key={r.id} className="flex items-baseline gap-5 py-3">
                <span className="text-2xl font-extrabold text-primary w-14 shrink-0">{dia}</span>
                <span className="text-2xl font-bold flex-1 leading-tight">{r.nome_completo}</span>
                {r.quartos?.numero && (
                  <span className="text-sm font-mono text-muted-foreground">Q. {r.quartos.numero}</span>
                )}
                {idade !== null && (
                  <span className="text-base text-muted-foreground whitespace-nowrap">{idade + 1} anos</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
