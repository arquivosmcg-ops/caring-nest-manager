import { Check, X } from "lucide-react";
import { forcaSenha, regrasSenha } from "@/lib/senha";
import { cn } from "@/lib/utils";

const rotulo = { fraca: "Fraca", media: "Média", forte: "Forte" } as const;

export function SenhaForca({ senha }: { senha: string }) {
  if (!senha) return null;
  const { nivel, pontos } = forcaSenha(senha);
  const barra =
    nivel === "fraca" ? "bg-destructive" : nivel === "media" ? "bg-amber-500" : "bg-emerald-600";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
          <div className={cn("h-full transition-all", barra)} style={{ width: `${(pontos / 6) * 100}%` }} />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {rotulo[nivel]}
        </span>
      </div>
      <ul className="space-y-0.5">
        {regrasSenha(senha).map((r) => (
          <li
            key={r.label}
            className={cn(
              "flex items-center gap-1.5 text-[11px]",
              r.ok ? "text-emerald-700" : "text-muted-foreground",
            )}
          >
            {r.ok ? <Check className="size-3" /> : <X className="size-3" />}
            {r.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
