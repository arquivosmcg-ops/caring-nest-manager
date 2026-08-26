import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/password-input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import logoAsset from "@/assets/logo_instituto_maior.png.asset.json";
import { SenhaForca } from "@/components/senha-forca";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Redefinir senha · Residencial São Camilo" },
      {
        name: "description",
        content:
          "Crie uma nova senha de acesso ao sistema clínico do Residencial São Camilo usando o link enviado para o seu e-mail.",
      },
      { property: "og:title", content: "Redefinir senha · Residencial São Camilo" },
      { property: "og:description", content: "Defina uma nova senha de acesso ao sistema clínico." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [pronto, setPronto] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setPronto(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setPronto(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (senha.length < 6) return toast.error("A senha deve ter pelo menos 6 caracteres");
    if (senha !== confirmar) return toast.error("A confirmação não coincide com a nova senha");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Senha atualizada com sucesso!");
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-2">
          <div className="size-9 bg-white rounded-sm grid place-items-center overflow-hidden border border-border">
            <img src={logoAsset.url} alt="Logo Residencial São Camilo" className="h-6 w-auto object-contain" />
          </div>
          <span className="font-extrabold tracking-tight text-lg">RESIDENCIAL SÃO CAMILO</span>
        </div>

        <div className="bg-surface border border-border rounded-lg p-6 space-y-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Definir nova senha</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {pronto
                ? "Escolha a nova senha de acesso à sua conta."
                : "Abra esta página pelo link enviado ao seu e-mail para redefinir a senha."}
            </p>
          </div>

          {pronto ? (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nova-senha">Nova senha</Label>
                <PasswordInput
                  id="nova-senha"
                  required
                  minLength={6}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
                <SenhaForca senha={senha} />
              </div>
              <div>
                <Label htmlFor="confirmar-senha">Confirmar nova senha</Label>
                <PasswordInput
                  id="confirmar-senha"
                  required
                  minLength={6}
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Salvando..." : "Salvar nova senha"}
              </Button>
            </form>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => navigate({ to: "/auth" })}>
              Voltar para o login
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
