import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BellOff, BellRing, CheckCircle2, HeartHandshake, RotateCcw, ShieldAlert, UserCheck, UserCog, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePerfilAtual } from "@/hooks/use-perfil";
import { useAlertasEquipe, type AlertaEquipe, type CategoriaAlerta } from "@/hooks/use-alertas-equipe";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/alertas-equipe")({
  head: () => ({
    meta: [
      { title: "Central de Alertas da Equipe — Residencial São Camilo" },
      { name: "description", content: "Central de alertas administrativos: aprovações pendentes, funções não definidas, escalas e visitas em atraso." },
      { property: "og:title", content: "Central de Alertas da Equipe — Residencial São Camilo" },
      { property: "og:description", content: "Visualize, filtre e dispense pendências da equipe e dos residentes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CentralAlertasEquipe,
});

const CATEGORIAS: { valor: CategoriaAlerta; rotulo: string; icone: typeof UserCheck }[] = [
  { valor: "aprovacao", rotulo: "Aprovação pendente", icone: UserCheck },
  { valor: "funcao", rotulo: "Função não definida", icone: UserCog },
  { valor: "escala_enfermagem", rotulo: "Fora da escala de enfermagem", icone: ShieldAlert },
  { valor: "escala_cuidadoras", rotulo: "Fora da escala de cuidadoras", icone: Users },
  { valor: "sem_visita", rotulo: "Residente sem visita +1 mês", icone: HeartHandshake },
];

function CentralAlertasEquipe() {
  const perfil = usePerfilAtual().data;
  const { isAdmin, alertas, mapaDispensas } = useAlertasEquipe();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaAlerta | "todas">("todas");
  const [filtroStatus, setFiltroStatus] = useState<"pendentes" | "dispensados" | "todos">("pendentes");
  const [busca, setBusca] = useState("");

  const visiveis = useMemo(() => {
    return alertas.filter((a) => {
      const dispensado = mapaDispensas.has(a.chave);
      if (filtroStatus === "pendentes" && dispensado) return false;
      if (filtroStatus === "dispensados" && !dispensado) return false;
      if (filtroCategoria !== "todas" && a.categoria !== filtroCategoria) return false;
      if (busca && !a.titulo.toLowerCase().includes(busca.toLowerCase())) return false;
      return true;
    });
  }, [alertas, mapaDispensas, filtroCategoria, filtroStatus, busca]);

  const contagemPendentes = useMemo(
    () => alertas.filter((a) => !mapaDispensas.has(a.chave)).length,
    [alertas, mapaDispensas],
  );

  const dispensar = useMutation({
    mutationFn: async (alerta: AlertaEquipe) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("alertas_equipe_dispensados").insert({
        alerta_chave: alerta.chave,
        dispensado_por: userData.user?.id,
        dispensado_por_nome: perfil?.fullName ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alertas-equipe-dispensados"] });
      toast.success("Alerta dispensado");
    },
    onError: () => toast.error("Não foi possível dispensar o alerta"),
  });

  const reverter = useMutation({
    mutationFn: async (chave: string) => {
      const { error } = await supabase
        .from("alertas_equipe_dispensados")
        .delete()
        .eq("alerta_chave", chave);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alertas-equipe-dispensados"] });
      toast.success("Alerta reativado");
    },
    onError: () => toast.error("Não foi possível reativar o alerta"),
  });

  if (perfil && !isAdmin) {
    return (
      <div className="max-w-lg mx-auto text-center py-16 space-y-3">
        <ShieldAlert className="size-10 mx-auto text-muted-foreground" />
        <p className="font-bold">Acesso restrito a administradores</p>
        <button
          onClick={() => navigate({ to: "/dashboard" })}
          className="text-sm text-primary font-semibold underline"
        >
          Voltar ao Painel Geral
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Central de Alertas</h2>
          <p className="text-sm text-muted-foreground">
            {contagemPendentes} pendência(s) ativa(s) • {mapaDispensas.size} dispensada(s)
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {(["todas", ...CATEGORIAS.map((c) => c.valor)] as const).map((c) => (
          <button
            key={c}
            onClick={() => setFiltroCategoria(c as CategoriaAlerta | "todas")}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-bold border transition-colors",
              filtroCategoria === c
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {c === "todas" ? "Todas" : CATEGORIAS.find((x) => x.valor === c)?.rotulo}
          </button>
        ))}
        <div className="flex gap-1 ml-auto">
          {(["pendentes", "dispensados", "todos"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFiltroStatus(s)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-bold",
                filtroStatus === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {s === "pendentes" ? "Pendentes" : s === "dispensados" ? "Dispensados" : "Todos"}
            </button>
          ))}
        </div>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome…"
          className="px-3 py-1.5 rounded-md border border-border bg-background text-sm w-full sm:w-56"
        />
      </div>

      <div className="space-y-2">
        {visiveis.length === 0 && (
          <div className="border border-dashed border-border rounded-lg p-10 text-center">
            <CheckCircle2 className="size-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {filtroStatus === "dispensados"
                ? "Nenhum alerta dispensado neste filtro."
                : "Nenhuma pendência neste filtro. Tudo em dia!"}
            </p>
          </div>
        )}
        {visiveis.map((a) => {
          const cat = CATEGORIAS.find((c) => c.valor === a.categoria)!;
          const dispensado = mapaDispensas.get(a.chave);
          return (
            <div
              key={a.chave}
              className={cn(
                "border border-border rounded-lg p-4 flex flex-wrap items-center gap-3 bg-surface",
                dispensado && "opacity-60",
              )}
            >
              <div className="size-9 rounded-md bg-muted grid place-items-center shrink-0">
                <cat.icone className="size-4" />
              </div>
              <div className="flex-1 min-w-52">
                <p className="text-sm font-bold">{a.titulo}</p>
                <p className="text-xs text-muted-foreground">{a.detalhe}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                  {cat.rotulo}
                  {dispensado &&
                    ` • Dispensado por ${dispensado.dispensado_por_nome ?? "admin"} em ${new Date(dispensado.dispensado_em).toLocaleString("pt-BR")}`}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Link
                  to={a.to}
                  className="px-3 py-1.5 rounded-md border border-border text-xs font-bold hover:bg-muted"
                >
                  Resolver
                </Link>
                {dispensado ? (
                  <button
                    onClick={() => reverter.mutate(a.chave)}
                    disabled={reverter.isPending}
                    className="px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 border border-border hover:bg-muted"
                  >
                    <RotateCcw className="size-3.5" /> Reativar
                  </button>
                ) : (
                  <button
                    onClick={() => dispensar.mutate(a)}
                    disabled={dispensar.isPending}
                    className="px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 bg-muted hover:bg-muted/70"
                  >
                    <BellOff className="size-3.5" /> Dispensar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <BellRing className="size-3.5" />
        Alertas dispensados deixam de aparecer no sino do topo, mas ficam registrados aqui e podem ser reativados.
      </p>
    </div>
  );
}
