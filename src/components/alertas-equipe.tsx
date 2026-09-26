import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { UserCog } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePerfilAtual } from "@/hooks/use-perfil";

type Profissional = {
  id: string;
  full_name: string;
  funcao: string | null;
  status_aprovacao: string;
  aprovado: boolean;
  na_escala: boolean | null;
};

const ehEnfermeira = (p: Profissional) => (p.funcao ?? "").toLowerCase().includes("enferm");
const ehCuidadora = (p: Profissional) => (p.funcao ?? "").toLowerCase().includes("cuidador");

export function AlertasEquipe() {
  const perfil = usePerfilAtual().data;
  const isAdmin = !!perfil?.isAdmin;

  const { data } = useQuery({
    queryKey: ["alertas-equipe"],
    enabled: isAdmin,
    refetchInterval: 120_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("listar_profissionais");
      if (error) throw error;
      return (data ?? []) as Profissional[];
    },
  });

  const { data: dispensas } = useQuery({
    queryKey: ["alertas-equipe-dispensados"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alertas_equipe_dispensados")
        .select("alerta_chave");
      if (error) throw error;
      return data ?? [];
    },
  });

  const chavesDispensadas = useMemo(
    () => new Set((dispensas ?? []).map((d) => d.alerta_chave)),
    [dispensas],
  );

  const avisos = useMemo(() => {
    const lista = data ?? [];
    const pendentes = lista.filter(
      (p) => p.status_aprovacao === "pendente" && !chavesDispensadas.has(`aprovacao:${p.id}`),
    );
    const aprovados = lista.filter((p) => p.aprovado);
    const semFuncao = aprovados.filter(
      (p) => !p.funcao && !chavesDispensadas.has(`funcao:${p.id}`),
    );
    const foraEnfermagem = aprovados.filter(
      (p) => ehEnfermeira(p) && p.na_escala === false && !chavesDispensadas.has(`escala-enfermagem:${p.id}`),
    );
    const foraCuidadoras = aprovados.filter(
      (p) => ehCuidadora(p) && p.na_escala === false && !chavesDispensadas.has(`escala-cuidadoras:${p.id}`),
    );

    const itens: { texto: string; detalhe: string; to: string }[] = [];
    if (pendentes.length > 0)
      itens.push({
        texto: `${pendentes.length} cadastro(s) aguardando aprovação`,
        detalhe: pendentes.map((p) => p.full_name).join(", "),
        to: "/admin-aprovacoes",
      });
    if (semFuncao.length > 0)
      itens.push({
        texto: `${semFuncao.length} profissional(is) sem função definida`,
        detalhe: semFuncao.map((p) => p.full_name).join(", "),
        to: "/admin-usuarios",
      });
    if (foraEnfermagem.length > 0)
      itens.push({
        texto: `${foraEnfermagem.length} enfermeira(s) fora da escala`,
        detalhe: foraEnfermagem.map((p) => p.full_name).join(", "),
        to: "/implantacao",
      });
    if (foraCuidadoras.length > 0)
      itens.push({
        texto: `${foraCuidadoras.length} cuidadora(s) fora da escala`,
        detalhe: foraCuidadoras.map((p) => p.full_name).join(", "),
        to: "/implantacao",
      });
    return itens;
  }, [data]);

  if (!isAdmin) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative p-2 rounded-md hover:bg-black/5"
          title="Pendências da equipe"
          aria-label="Pendências da equipe"
        >
          <UserCog className="size-5" />
          {avisos.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold grid place-items-center">
              {avisos.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="p-3 border-b border-border">
          <p className="text-xs font-bold uppercase tracking-wider">Pendências da equipe</p>
        </div>
        <div className="max-h-80 overflow-y-auto divide-y divide-border">
          {avisos.length === 0 && (
            <p className="p-4 text-xs text-muted-foreground">
              Nenhuma pendência: equipe aprovada, com função e escalas definidas.
            </p>
          )}
          {avisos.map((a) => (
            <Link key={a.texto} to={a.to} className="block p-3 hover:bg-muted">
              <p className="text-sm font-medium">{a.texto}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground line-clamp-2">
                {a.detalhe}
              </p>
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
