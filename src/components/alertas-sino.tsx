import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export type AlertaClinico = {
  id: string;
  residente_id: string;
  emitido_por_nome: string;
  categoria: string;
  mensagem: string;
  status: string;
  created_at: string;
};

export function useAlertasAtivos() {
  return useQuery({
    queryKey: ["alertas-clinicos"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alertas_clinicos")
        .select("id, residente_id, emitido_por_nome, categoria, mensagem, status, created_at")
        .neq("status", "resolvido")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) return [] as AlertaClinico[];
      return (data ?? []) as AlertaClinico[];
    },
  });
}

const fmt = (v: string) => new Date(v).toLocaleString("pt-BR");

export function AlertasSino() {
  const qc = useQueryClient();
  const alertas = useAlertasAtivos();
  const lista = alertas.data ?? [];
  const novos = lista.filter((a) => a.status === "novo").length;

  const atualizar = async (id: string, status: "visualizado" | "resolvido") => {
    const patch =
      status === "resolvido"
        ? { status, resolvido_em: new Date().toISOString() }
        : { status, visualizado_em: new Date().toISOString() };
    const { error } = await supabase.from("alertas_clinicos").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["alertas-clinicos"] });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-md hover:bg-black/5" title="Alertas clínicos">
          <Bell className="size-5" />
          {novos > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold grid place-items-center">
              {novos}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="p-3 border-b border-border">
          <p className="text-xs font-bold uppercase tracking-wider">Alertas clínicos</p>
        </div>
        <div className="max-h-80 overflow-y-auto divide-y divide-border">
          {lista.length === 0 && (
            <p className="p-4 text-xs text-muted-foreground">Nenhum alerta ativo.</p>
          )}
          {lista.map((a) => (
            <div key={a.id} className="p-3 space-y-1">
              <p className="text-sm font-medium">{a.mensagem}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {a.emitido_por_nome} · {a.categoria} · {fmt(a.created_at)} · {a.status}
              </p>
              <div className="flex gap-1 pt-1">
                {a.status === "novo" && (
                  <Button size="sm" variant="outline" onClick={() => atualizar(a.id, "visualizado")}>
                    Marcar visto
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => atualizar(a.id, "resolvido")}>
                  Encerrar
                </Button>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
