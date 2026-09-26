import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, CalendarRange, HeartHandshake, Printer, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/relatorio-visitas")({
  head: () => ({
    meta: [
      { title: "Relatório de Frequência de Visitas — Residencial São Camilo" },
      { name: "description", content: "Frequência de visitas por residente, com filtros por período e destaque para quem recebe menos visitas." },
      { property: "og:title", content: "Relatório de Frequência de Visitas — Residencial São Camilo" },
      { property: "og:description", content: "Acompanhe a frequência de visitas de cada residente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RelatorioVisitas,
});

type Linha = {
  residenteId: string;
  nome: string;
  quarto: string | null;
  total: number;
  visitantesDistintos: number;
  ultimaVisita: Date | null;
  porSemana: number;
};

const PERIODOS = [
  { dias: 30, rotulo: "Últimos 30 dias" },
  { dias: 60, rotulo: "Últimos 60 dias" },
  { dias: 90, rotulo: "Últimos 90 dias" },
  { dias: 0, rotulo: "Personalizado" },
] as const;

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function RelatorioVisitas() {
  const hoje = useMemo(() => new Date(), []);
  const [periodo, setPeriodo] = useState<number>(30);
  const [inicioCustom, setInicioCustom] = useState(iso(new Date(hoje.getTime() - 30 * 86_400_000)));
  const [fimCustom, setFimCustom] = useState(iso(hoje));
  const [ordem, setOrdem] = useState<"menos" | "mais">("menos");

  const inicio = periodo === 0 ? inicioCustom : iso(new Date(hoje.getTime() - periodo * 86_400_000));
  const fim = periodo === 0 ? fimCustom : iso(hoje);
  const semanas = Math.max(
    1,
    (new Date(`${fim}T12:00:00`).getTime() - new Date(`${inicio}T12:00:00`).getTime()) / (7 * 86_400_000),
  );

  const { data, isLoading } = useQuery({
    queryKey: ["relatorio-visitas", inicio, fim],
    queryFn: async () => {
      const [{ data: residentes, error: e1 }, { data: vinculos, error: e2 }] = await Promise.all([
        supabase
          .from("residentes")
          .select("id, nome_completo, quartos(numero)")
          .eq("ativo", true)
          .order("nome_completo"),
        supabase
          .from("visitas_residentes")
          .select("residente_id, visitas!inner(id, data, visitante_id)")
          .gte("visitas.data", inicio)
          .lte("visitas.data", fim),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return { residentes: residentes ?? [], vinculos: vinculos ?? [] };
    },
  });

  const linhas = useMemo<Linha[]>(() => {
    if (!data) return [];
    const porResidente = new Map<string, { total: number; visitantes: Set<string>; ultima: Date | null }>();
    for (const v of data.vinculos) {
      const visita = v.visitas as unknown as { id: string; data: string; visitante_id: string };
      const g = porResidente.get(v.residente_id) ?? { total: 0, visitantes: new Set(), ultima: null };
      g.total += 1;
      g.visitantes.add(visita.visitante_id);
      const d = new Date(`${visita.data}T12:00:00`);
      if (!g.ultima || d > g.ultima) g.ultima = d;
      porResidente.set(v.residente_id, g);
    }
    const lista = data.residentes.map((r) => {
      const g = porResidente.get(r.id);
      const total = g?.total ?? 0;
      return {
        residenteId: r.id,
        nome: r.nome_completo,
        quarto: (r.quartos as { numero: string } | null)?.numero ?? null,
        total,
        visitantesDistintos: g?.visitantes.size ?? 0,
        ultimaVisita: g?.ultima ?? null,
        porSemana: total / semanas,
      };
    });
    lista.sort((a, b) => (ordem === "menos" ? a.total - b.total : b.total - a.total) || a.nome.localeCompare(b.nome));
    return lista;
  }, [data, semanas, ordem]);

  const media = linhas.length ? linhas.reduce((s, l) => s + l.total, 0) / linhas.length : 0;
  const limiteDestaque = Math.max(1, Math.floor(media / 2));
  const poucasVisitas = linhas.filter((l) => l.total <= limiteDestaque);
  const semVisita = linhas.filter((l) => l.total === 0);

  const periodoRotulo =
    periodo === 0
      ? `${new Date(`${inicio}T12:00:00`).toLocaleDateString("pt-BR")} a ${new Date(`${fim}T12:00:00`).toLocaleDateString("pt-BR")}`
      : PERIODOS.find((p) => p.dias === periodo)?.rotulo;

  return (
    <div className="space-y-6 max-w-5xl print:max-w-none">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Frequência de Visitas por Residente</h2>
          <p className="text-sm text-muted-foreground">{periodoRotulo}</p>
        </div>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 rounded-md bg-foreground text-background text-xs font-bold flex items-center gap-2"
        >
          <Printer className="size-4" /> Imprimir
        </button>
      </div>

      <div className="hidden print:block mb-4">
        <h1 className="text-xl font-extrabold">Relatório de Frequência de Visitas — Residencial São Camilo</h1>
        <p className="text-sm">Período: {periodoRotulo} • Gerado em {new Date().toLocaleString("pt-BR")}</p>
      </div>

      <div className="flex flex-wrap gap-2 items-center print:hidden">
        <CalendarRange className="size-4 text-muted-foreground" />
        {PERIODOS.map((p) => (
          <button
            key={p.dias}
            onClick={() => setPeriodo(p.dias)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-bold border transition-colors",
              periodo === p.dias
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {p.rotulo}
          </button>
        ))}
        {periodo === 0 && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={inicioCustom}
              onChange={(e) => setInicioCustom(e.target.value)}
              className="px-2 py-1.5 rounded-md border border-border bg-background text-xs"
            />
            <span className="text-xs text-muted-foreground">até</span>
            <input
              type="date"
              value={fimCustom}
              onChange={(e) => setFimCustom(e.target.value)}
              className="px-2 py-1.5 rounded-md border border-border bg-background text-xs"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="border border-border rounded-lg p-4 bg-surface">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Residentes ativos</p>
          <p className="text-2xl font-extrabold">{linhas.length}</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-surface">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Visitas no período</p>
          <p className="text-2xl font-extrabold">{linhas.reduce((s, l) => s + l.total, 0)}</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-surface">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Média por residente</p>
          <p className="text-2xl font-extrabold">{media.toFixed(1)}</p>
        </div>
        <div className="border border-destructive/40 rounded-lg p-4 bg-destructive/5">
          <p className="text-[10px] uppercase tracking-wider text-destructive font-bold flex items-center gap-1">
            <TrendingDown className="size-3" /> Recebem poucas visitas
          </p>
          <p className="text-2xl font-extrabold text-destructive">{poucasVisitas.length}</p>
          <p className="text-[10px] text-muted-foreground">{semVisita.length} sem nenhuma visita no período</p>
        </div>
      </div>

      {poucasVisitas.length > 0 && (
        <div className="border border-destructive/40 rounded-lg p-4 bg-destructive/5">
          <p className="text-xs font-bold text-destructive uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <HeartHandshake className="size-4" /> Atenção — menos visitas no período
          </p>
          <p className="text-sm">
            {poucasVisitas.map((l) => `${l.nome} (${l.total})`).join(" • ")}
          </p>
        </div>
      )}

      <div className="border border-border rounded-lg overflow-hidden bg-surface">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border print:hidden">
          <p className="text-xs font-bold uppercase tracking-wider">Ranking por residente</p>
          <button
            onClick={() => setOrdem(ordem === "menos" ? "mais" : "menos")}
            className="text-xs font-bold flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
          >
            {ordem === "menos" ? (
              <><ArrowUpNarrowWide className="size-3.5" /> Menos visitadas primeiro</>
            ) : (
              <><ArrowDownWideNarrow className="size-3.5" /> Mais visitadas primeiro</>
            )}
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2">Residente</th>
              <th className="px-4 py-2">Quarto</th>
              <th className="px-4 py-2 text-center">Visitas</th>
              <th className="px-4 py-2 text-center">Visitantes distintos</th>
              <th className="px-4 py-2 text-center">Média/semana</th>
              <th className="px-4 py-2">Última visita</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>
            )}
            {!isLoading && linhas.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhum residente ativo.</td></tr>
            )}
            {linhas.map((l) => {
              const destaque = l.total <= limiteDestaque;
              return (
                <tr key={l.residenteId} className={cn(destaque && "bg-destructive/5")}>
                  <td className="px-4 py-2.5 font-semibold">
                    {l.nome}
                    {destaque && (
                      <span className="ml-2 text-[9px] font-bold uppercase tracking-wider text-destructive border border-destructive/40 rounded px-1 py-0.5 align-middle">
                        poucas visitas
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{l.quarto ?? "—"}</td>
                  <td className="px-4 py-2.5 text-center font-bold">{l.total}</td>
                  <td className="px-4 py-2.5 text-center">{l.visitantesDistintos}</td>
                  <td className="px-4 py-2.5 text-center">{l.porSemana.toFixed(1)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {l.ultimaVisita ? l.ultimaVisita.toLocaleDateString("pt-BR") : "Nunca no período"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
