import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Stethoscope } from "lucide-react";
import { EvolucaoMultiprofissional } from "@/components/evolucao-multi";

export const Route = createFileRoute("/_authenticated/evolucao-multi")({
  head: () => ({
    meta: [
      { title: "Evolução Multiprofissional · Residencial São Camilo" },
      {
        name: "description",
        content:
          "Registros de evolução da equipe multiprofissional: fisioterapia, nutrição, psicologia, fonoaudiologia e mais, por residente.",
      },
      { property: "og:title", content: "Evolução Multiprofissional · Residencial São Camilo" },
      {
        property: "og:description",
        content: "Histórico clínico multiprofissional por residente, com anexos e assinatura.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EvolucaoMultiPage,
});

function EvolucaoMultiPage() {
  const [selecionado, setSelecionado] = useState<string | null>(null);

  const residentes = useQuery({
    queryKey: ["residentes-evolucao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("residentes")
        .select("id, nome_completo, data_nascimento, quarto_id")
        .eq("ativo", true)
        .order("nome_completo");
      if (error) throw error;
      return data ?? [];
    },
  });

  const residente = residentes.data?.find((r) => r.id === selecionado) ?? null;

  return (
    <div className="grid lg:grid-cols-[260px_1fr] gap-6">
      <aside className="bg-surface border border-border rounded-lg p-3 h-fit max-h-[70vh] overflow-y-auto">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 pb-2">
          Residentes
        </p>
        {residentes.data?.map((res) => (
          <button
            key={res.id}
            onClick={() => setSelecionado(res.id)}
            className={cn(
              "w-full text-left px-2 py-2 rounded-md text-sm transition-colors truncate",
              selecionado === res.id ? "bg-foreground text-background font-bold" : "hover:bg-black/5",
            )}
          >
            {res.nome_completo}
          </button>
        ))}
        {residentes.data?.length === 0 && (
          <p className="text-xs text-muted-foreground px-2">Nenhum residente ativo.</p>
        )}
      </aside>

      <section>
        {!selecionado ? (
          <div className="bg-surface border border-border rounded-lg p-12 text-center">
            <Stethoscope className="size-8 mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Selecione um residente para registrar ou consultar evoluções multiprofissionais.
            </p>
          </div>
        ) : (
          <EvolucaoMultiprofissional residente={residente} />
        )}
      </section>
    </div>
  );
}
