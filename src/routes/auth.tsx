import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/password-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import logoAsset from "@/assets/logo_instituto_maior.png.asset.json";
import { maskCelular, somenteDigitos } from "@/lib/phone";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Acesso da equipe · Residencial São Camilo" },
      { name: "description", content: "Entre ou registre-se no sistema clínico do Residencial São Camilo: médicos e enfermeiras com aprovação do administrador." },
      { property: "og:title", content: "Acesso da equipe · Residencial São Camilo" },
      { property: "og:description", content: "Entre ou registre-se no sistema clínico do Residencial São Camilo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [registro, setRegistro] = useState("");
  const [funcao, setFuncao] = useState("");
  const [celular, setCelular] = useState("");
  const [loading, setLoading] = useState(false);
  const [recuperando, setRecuperando] = useState(false);

  const handleRecuperar = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Enviámos um link de recuperação para o seu e-mail.");
    setRecuperando(false);
  };


  const rotaPorStatus = async (userId: string) => {
    const { data: prof } = await supabase
      .from("profiles")
      .select("status_aprovacao")
      .eq("id", userId)
      .maybeSingle();
    if (prof?.status_aprovacao !== "aprovado") {
      navigate({ to: "/aguardando-aprovacao", replace: true });
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) rotaPorStatus(data.user.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (!data.user) return;
    await rotaPorStatus(data.user.id);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!funcao) return toast.error("Selecione a sua função profissional");
    if (somenteDigitos(celular).length < 10) return toast.error("Informe um número de celular válido com DDD");
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/aguardando-aprovacao`,
        data: {
          full_name: fullName,
          funcao,
          registro_profissional: registro,
          celular,
        },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message || "Não foi possível concluir o registro. Tente novamente.");
    toast.success("Registro enviado. Aguarde a aprovação do administrador.");
    navigate({ to: "/aguardando-aprovacao" });
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-surface">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-secondary text-foreground border-r border-border">
        <div className="flex items-center gap-3">
          <div className="size-9 bg-white rounded-sm grid place-items-center overflow-hidden border border-border">
            <img src={logoAsset.url} alt="Logo Residencial São Camilo" className="h-6 w-auto object-contain" />
          </div>
          <span className="font-extrabold tracking-tight text-lg uppercase">Residencial São Camilo</span>
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-extrabold tracking-tight leading-tight">
            Cuidado clínico, com clareza.
          </h1>
          <p className="text-muted-foreground max-w-md">
            Sistema integrado para gestão de residentes, medicamentos, sinais vitais,
            incidentes e rotina diária da sua ILPI. Feito para equipes que não podem
            perder tempo procurando botões.
          </p>
        </div>
        <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">
          LGPD · Prontuário Eletrônico · Multi-perfil
        </p>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12 bg-surface">

        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden flex items-center gap-2">
            <div className="size-9 bg-white rounded-sm grid place-items-center overflow-hidden border border-border">
              <img src={logoAsset.url} alt="Logo Residencial São Camilo" className="h-6 w-auto object-contain" />
            </div>
            <span className="font-extrabold tracking-tight text-lg">RESIDENCIAL SÃO CAMILO</span>
          </div>

          <div>
            <h2 className="text-2xl font-extrabold tracking-tight">Acesso da equipe</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Entre com sua conta ou registre-se para começar.
            </p>
          </div>

          <Tabs defaultValue="signin">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              {recuperando ? (
                <form onSubmit={handleRecuperar} className="space-y-4 mt-4">
                  <p className="text-sm text-muted-foreground">
                    Informe o e-mail cadastrado. Enviaremos um link para criar uma nova senha.
                  </p>
                  <div>
                    <Label htmlFor="email-rec">E-mail cadastrado</Label>
                    <Input id="email-rec" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? "Enviando..." : "Enviar link de recuperação"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setRecuperando(false)}
                    className="w-full text-xs underline underline-offset-2 text-muted-foreground"
                  >
                    Voltar para o login
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSignIn} className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="email">E-mail</Label>
                    <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="password">Senha</Label>
                    <PasswordInput id="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? "Entrando..." : "Entrar"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setRecuperando(true)}
                    className="w-full text-xs underline underline-offset-2 text-muted-foreground"
                  >
                    Esqueci minha senha
                  </button>
                </form>
              )}
            </TabsContent>


            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="name">Nome completo</Label>
                  <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="email2">E-mail</Label>
                  <Input id="email2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="password2">Senha</Label>
                  <PasswordInput id="password2" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="funcao">Função</Label>
                  <Select value={funcao} onValueChange={setFuncao}>
                    <SelectTrigger id="funcao">
                      <SelectValue placeholder="Selecione a sua função" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="medico">Médico</SelectItem>
                      <SelectItem value="enfermeira">Enfermeira</SelectItem>
                      <SelectItem value="fisioterapia">Fisioterapeuta</SelectItem>
                      <SelectItem value="psicologia">Psicólogo(a)</SelectItem>
                      <SelectItem value="nutricao">Nutricionista</SelectItem>
                      <SelectItem value="terapia_ocupacional">Terapeuta Ocupacional</SelectItem>
                      <SelectItem value="fonoaudiologia">Fonoaudiólogo(a)</SelectItem>
                      <SelectItem value="servico_social">Assistente Social</SelectItem>
                      <SelectItem value="educacao_fisica">Educador(a) Físico</SelectItem>
                      <SelectItem value="farmacia_clinica">Farmacêutico(a) Clínico</SelectItem>
                      <SelectItem value="outro">Outro profissional autorizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="registro">
                    Nº carteira profissional (CRM/COREN)
                    {funcao === "outro" && (
                      <span className="text-muted-foreground font-normal"> (opcional)</span>
                    )}
                  </Label>
                  <Input
                    id="registro"
                    required={funcao !== "outro"}
                    maxLength={40}
                    value={registro}
                    onChange={(e) => setRegistro(e.target.value)}
                    placeholder={funcao === "outro" ? "Opcional" : "Ex.: CRM-SP 123456"}
                  />
                </div>
                <div>
                  <Label htmlFor="celular">Número de celular *</Label>
                  <Input
                    id="celular"
                    type="tel"
                    inputMode="tel"
                    required
                    value={celular}
                    onChange={(e) => setCelular(maskCelular(e.target.value))}
                    placeholder="(11) 91234-5678"
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? "Criando..." : "Criar conta"}
                </Button>
                <p className="text-[10px] text-muted-foreground text-center">
                  Novas contas ficam com status <strong>pendente</strong> até a aprovação do administrador.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
