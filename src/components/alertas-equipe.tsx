import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { UserCog } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAlertasEquipe, type CategoriaAlerta } from "@/hooks/use-alertas-equipe";

const ROTULOS: Record<CategoriaAlerta, string> = {
  aprovacao: "cadastro(s) aguardando aprovação",
  funcao: "profissional(is) sem função definida",
  escala_enfermagem: "enfermeira(s) fora da escala",
  escala_cuidadoras: "cuidadora(s) fora da escala",
  sem_visita: "residente(s) sem visita há +1 mês",
};

export function AlertasEquipe() {
  const { isAdmin, alertas, mapaDispensas } = useAlertasEquipe();

  const avisos = useMemo(() => {
    const ativos = alertas.filter((a) => !mapaDispensas.has(a.chave));
    const grupos = new Map<CategoriaAlerta, { nomes: string[]; to: string }>();
    for (const a of ativos) {
      const nome = a.titulo.split(" aguarda")[0].split(" está")[0];
      const g = grupos.get(a.categoria) ?? { nomes: [], to: a.to };
      g.nomes.push(nome);
      grupos.set(a.categoria, g);
    }
    return [...grupos.entries()].map(([cat, g]) => ({
      texto: `${g.nomes.length} ${ROTULOS[cat]}`,
      detalhe: g.nomes.join(", "),
      to: g.to,
    }));
  }, [alertas, mapaDispensas]);

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
              Nenhuma pendência: equipe aprovada, com função, escalas definidas e visitas em dia.
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
        <Link
          to="/alertas-equipe"
          className="block p-3 border-t border-border text-center text-xs font-bold text-primary hover:bg-muted"
        >
          Abrir Central de Alertas
        </Link>
      </PopoverContent>
    </Popover>
  );
}
