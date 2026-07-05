import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, BedDouble, AlertTriangle, Pill } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

type Residente = {
  id: string;
  nome_completo: string;
  data_nascimento: string | null;
  status: "estavel" | "observacao" | "critico";
  quartos: { numero: string } | null;
};

type Incidente = {
  id: string;
  tipo: string;
  severidade: "leve" | "moderado" | "grave";
  ocorrido_em: string;
  residentes: { nome_completo: string; quartos: { numero: string } | null } | null;
};

function calcAge(dob: string | null): number | null {
  if (!dob) return null;
  const b = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return age;
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 60000;
  if (diff < 60) return `Há ${Math.floor(diff)} min`;
  if (diff < 60 * 24) return `Há ${Math.floor(diff / 60)}h`;
  return `Há ${Math.floor(diff / (60 * 24))}d`;
}

function DashboardPage() {
  const stats = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [{ count: residentesAtivos }, { data: quartos }, { count: incidentesHoje }, { count: medicamentosAtivos }] = await Promise.all([
        supabase.from("residentes").select("*", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("quartos").select("status"),
        supabase.from("incidentes").select("*", { count: "exact", head: true }).gte("ocorrido_em", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
        supabase.from("medicamentos").select("*", { count: "exact", head: true }).eq("ativo", true),
      ]);
      const totalQ = quartos?.length ?? 0;
      const ocupados = quartos?.filter((q) => q.status === "ocupado").length ?? 0;
      const ocupacao = totalQ ? Math.round((ocupados / totalQ) * 100) : 0;
      return {
        residentesAtivos: residentesAtivos ?? 0,
        ocupacao,
        totalQuartos: totalQ,
        incidentesHoje: incidentesHoje ?? 0,
        medicamentosAtivos: medicamentosAtivos ?? 0,
      };
    },
  });

  const residentes = useQuery({
    queryKey: ["dashboard-residentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("residentes")
        .select("id, nome_completo, data_nascimento, status, quartos(numero)")
        .eq("ativo", true)
        .order("status", { ascending: false })
        .limit(6);
      if (error) throw error;
      return (data ?? []) as unknown as Residente[];
    },
  });

  const incidentes = useQuery({
    queryKey: ["dashboard-incidentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incidentes")
        .select("id, tipo, severidade, ocorrido_em, residentes(nome_completo, quartos(numero))")
        .order("ocorrido_em", { ascending: false })
        .limit(4);
      if (error) throw error;
      return (data ?? []) as unknown as Incidente[];
    },
  });

  const s = stats.data;

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Residentes Ativos" value={s?.residentesAtivos ?? "—"} icon={Users} hint="Total no sistema" />
        <KpiCard label="Ocupação" value={`${s?.ocupacao ?? 0}%`} icon={BedDouble} hint={`${s?.totalQuartos ?? 0} quartos`} progress={s?.ocupacao} />
        <KpiCard label="Incidentes Hoje" value={s?.incidentesHoje ?? 0} icon={AlertTriangle} hint="Últimas 24h" accent="warning" />
        <KpiCard label="Medicamentos Ativos" value={s?.medicamentosAtivos ?? 0} icon={Pill} hint="Prescrições vigentes" accent="primary" />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-extrabold text-lg">Residentes em Foco</h2>
            <Link to="/residentes" className="text-xs font-bold underline">Ver todos</Link>
          </div>
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-black/[0.02] border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Residente</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Quarto</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {residentes.data?.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Nenhum residente cadastrado. <Link to="/residentes" className="underline font-bold">Cadastrar agora</Link>
                  </td></tr>
                )}
                {residentes.data?.map((r) => {
                  const age = calcAge(r.data_nascimento);
                  return (
                    <tr key={r.id} className="hover:bg-black/[0.01]">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-full bg-muted grid place-items-center text-xs font-bold">
                            {r.nome_completo.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold">{r.nome_completo}</p>
                            {age !== null && <p className="text-[10px] text-muted-foreground">{age} anos</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm font-mono">{r.quartos?.numero ?? "—"}</td>
                      <td className="px-4 py-4"><StatusBadge status={r.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="bg-surface border border-border rounded-lg p-5">
            <h3 className="text-sm font-extrabold mb-4">INCIDENTES RECENTES</h3>
            <div className="space-y-4">
              {incidentes.data?.length === 0 && (
                <p className="text-xs text-muted-foreground">Sem incidentes registrados.</p>
              )}
              {incidentes.data?.map((i) => (
                <div key={i.id} className={cn(
                  "border-l-2 pl-3",
                  i.severidade === "grave" ? "border-primary" : i.severidade === "moderado" ? "border-warning" : "border-slate-300"
                )}>
                  <p className={cn(
                    "text-[10px] font-bold uppercase",
                    i.severidade === "grave" ? "text-primary" : "text-muted-foreground"
                  )}>{i.tipo} — {i.severidade}</p>
                  <p className="text-xs font-medium mt-1">
                    {i.residentes?.nome_completo}
                    {i.residentes?.quartos?.numero && ` • Quarto ${i.residentes.quartos.numero}`}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1 italic font-mono">{timeAgo(i.ocorrido_em)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, hint, accent, progress }: {
  label: string; value: React.ReactNode; icon: React.ComponentType<{ className?: string }>;
  hint?: string; accent?: "warning" | "primary"; progress?: number;
}) {
  return (
    <div className={cn(
      "bg-surface border border-border p-5 rounded-lg",
      accent === "warning" && "border-l-4 border-l-warning",
      accent === "primary" && "border-l-4 border-l-primary bg-primary/[0.02]"
    )}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="text-3xl font-extrabold mt-1">{value}</p>
      {progress !== undefined && (
        <div className="h-1.5 w-full bg-black/5 rounded-full mt-3">
          <div className="h-full bg-foreground rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      {hint && !progress && <p className="mt-2 text-[10px] text-muted-foreground font-bold">{hint}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: "estavel" | "observacao" | "critico" }) {
  const map = {
    estavel: "bg-green-100 text-green-700",
    observacao: "bg-orange-100 text-orange-700",
    critico: "bg-primary/10 text-primary",
  };
  const label = { estavel: "ESTÁVEL", observacao: "OBSERVAÇÃO", critico: "CRÍTICO" };
  return <span className={cn("px-2 py-0.5 text-[10px] font-bold rounded-sm", map[status])}>{label[status]}</span>;
}
