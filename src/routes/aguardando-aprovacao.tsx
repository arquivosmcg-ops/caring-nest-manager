import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Clock, LogOut, RefreshCw } from "lucide-react";
import logoAsset from "@/assets/logo_instituto_maior.png.asset.json";

export const Route = createFileRoute("/aguardando-aprovacao")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Aguardando aprovação · Residencial São Camilo" },
      { name: "description", content: "Sua conta foi registrada e aguarda liberação do administrador do Residencial São Camilo." },
      { property: "og:title", content: "Aguardando aprovação · Residencial São Camilo" },
      { property: "og:description", content: "Sua conta foi registrada e aguarda liberação do administrador." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AguardandoPage,
});

function AguardandoPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);
  const [nome, setNome] = useState<string>("");

  const verificar = async () => {
    setChecking(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      navigate({ to: "/auth", replace: true });
      return;
    }
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name, status_aprovacao")
      .eq("id", userData.user.id)
      .maybeSingle();
    setNome(prof?.full_name ?? "");
    setChecking(false);
    if (prof?.status_aprovacao === "aprovado") navigate({ to: "/dashboard", replace: true });
  };

  useEffect(() => {
    verificar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sair = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen grid place-items-center bg-foreground text-background p-6">
      <div className="w-full max-w-lg text-center space-y-8">
        <div className="flex items-center justify-center gap-2">
          <div className="size-10 bg-white rounded-sm grid place-items-center overflow-hidden border border-border/20">
            <img src={logoAsset.url} alt="Logo Residencial São Camilo" className="h-6 w-auto object-contain" />
          </div>
          <span className="font-extrabold tracking-tight text-lg">RESIDENCIAL SÃO CAMILO</span>
        </div>

        <div className="size-20 mx-auto rounded-full bg-background/10 grid place-items-center">
          <Clock className="size-9 animate-pulse" />
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl font-extrabold tracking-tight leading-tight">
            Obrigado pelo registro{nome ? `, ${nome.split(" ")[0]}` : ""}!
          </h1>
          <p className="text-background/70">
            A sua conta está aguardando a aprovação do administrador.
          </p>
          <p className="text-xs text-background/50 font-mono uppercase tracking-widest">
            Status: pendente
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          <Button variant="secondary" onClick={verificar} disabled={checking}>
            <RefreshCw className={checking ? "size-4 animate-spin" : "size-4"} />
            {checking ? "Verificando..." : "Verificar novamente"}
          </Button>
          <Button variant="ghost" onClick={sair} className="text-background hover:bg-background/10">
            <LogOut className="size-4" />
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
}
