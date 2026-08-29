import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { usePerfilAtual } from "@/hooks/use-perfil";
import { useCertificadoAtual } from "@/hooks/use-certificado";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/password-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ShieldCheck, Trash2, AlertTriangle } from "lucide-react";
import {
  PROVEDOR_ICP,
  lerCertificadoA1,
  statusValidade,
  type MetadadosCertificado,
  type TipoCertificado,
} from "@/lib/certificado-icp";
import { CATEGORIA_ASSINATURA_LABEL } from "@/lib/assinatura";

export const Route = createFileRoute("/_authenticated/perfil")({
  component: PerfilPage,
  head: () => ({
    meta: [
      { title: "Meu Perfil e Certificado Digital | Instituto Maior" },
      {
        name: "description",
        content:
          "Gerencie seus dados profissionais e cadastre o certificado digital ICP-Brasil (A1 ou A3) usado nas assinaturas de documentos clínicos.",
      },
      { property: "og:title", content: "Meu Perfil e Certificado Digital" },
      {
        property: "og:description",
        content: "Cadastro de certificado ICP-Brasil para assinatura de documentos clínicos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function PerfilPage() {
  const perfil = usePerfilAtual().data;
  const certificado = useCertificadoAtual();
  const qc = useQueryClient();

  const [tipo, setTipo] = useState<TipoCertificado>("A1");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [senha, setSenha] = useState("");
  const [lidos, setLidos] = useState<MetadadosCertificado | null>(null);
  const [acManual, setAcManual] = useState("");
  const [validadeManual, setValidadeManual] = useState("");
  const [lendo, setLendo] = useState(false);

  const lerArquivo = async () => {
    if (!arquivo) return toast.error("Selecione o arquivo .pfx ou .p12");
    if (!senha) return toast.error("Informe a senha do certificado");
    setLendo(true);
    try {
      const { metadados } = await lerCertificadoA1(arquivo, senha);
      setLidos(metadados);
      toast.success("Certificado lido neste dispositivo. Nada foi enviado ao servidor.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLendo(false);
      setSenha("");
    }
  };

  const salvar = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new Error("Sessão expirada");

      const registro =
        tipo === "A1"
          ? lidos
          : {
              tipo: "A3" as const,
              titular: perfil?.fullName ?? null,
              ac_emissora: acManual.trim() || null,
              numero_serie: null,
              valido_de: null,
              valido_ate: validadeManual ? new Date(validadeManual).toISOString() : null,
            };
      if (!registro) throw new Error("Leia o arquivo do certificado antes de salvar");

      const { error } = await supabase.from("certificados_digitais" as never).upsert(
        {
          usuario_id: user.id,
          tipo: registro.tipo,
          titular: registro.titular,
          ac_emissora: registro.ac_emissora,
          numero_serie: registro.numero_serie,
          valido_de: registro.valido_de,
          valido_ate: registro.valido_ate,
          provedor: tipo === "A3" ? PROVEDOR_ICP.nome : null,
        } as never,
        { onConflict: "usuario_id" } as never,
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["certificado-digital"] });
      setArquivo(null);
      setLidos(null);
      toast.success("Certificado digital cadastrado");
    },
    onError: (e) => toast.error((e as Error).message || "Não foi possível salvar"),
  });

  const remover = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("certificados_digitais" as never)
        .delete()
        .eq("id", certificado.data!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["certificado-digital"] });
      toast.success("Certificado removido do perfil");
    },
  });

  const atual = certificado.data;
  const status = statusValidade(atual?.valido_ate);

  return (
    <AppShell>
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Meu Perfil</h1>
          <p className="text-sm text-muted-foreground">
            {perfil?.fullName}
            {perfil?.categoriaAssinatura
              ? ` — ${CATEGORIA_ASSINATURA_LABEL[perfil.categoriaAssinatura]}`
              : ""}
            {perfil?.registroProfissional ? ` — ${perfil.registroProfissional}` : ""}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4" /> Certificado Digital (ICP-Brasil)
            </CardTitle>
            <CardDescription>
              Usado para assinar documentos clínicos com validade jurídica. O arquivo do
              certificado e a senha nunca são armazenados no sistema.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {atual && (
              <div className="rounded-md border border-border p-3 space-y-1 bg-muted/40">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-sm">
                    Certificado {atual.tipo} — {atual.titular ?? "titular não informado"}
                  </p>
                  <Badge
                    variant={
                      status.nivel === "vencido"
                        ? "destructive"
                        : status.nivel === "alerta"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {status.texto}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Autoridade Certificadora: {atual.ac_emissora ?? "não informada"}
                </p>
                {atual.numero_serie && (
                  <p className="text-xs text-muted-foreground">Série: {atual.numero_serie}</p>
                )}
                {(status.nivel === "alerta" || status.nivel === "vencido") && (
                  <p className="text-xs text-destructive flex items-center gap-1 pt-1">
                    <AlertTriangle className="size-3.5" /> Renove seu certificado junto à AC para
                    não interromper as assinaturas.
                  </p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => remover.mutate()}
                >
                  <Trash2 className="size-4 mr-1" /> Remover certificado
                </Button>
              </div>
            )}

            <div className="space-y-3 border-t border-border pt-4">
              <div>
                <Label>Tipo de certificado</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as TipoCertificado)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A1">A1 — arquivo digital (.pfx / .p12)</SelectItem>
                    <SelectItem value="A3">A3 — token, cartão físico ou nuvem</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {tipo === "A1" ? (
                <>
                  <div>
                    <Label htmlFor="cert-arquivo">Arquivo do certificado</Label>
                    <Input
                      id="cert-arquivo"
                      type="file"
                      accept=".pfx,.p12"
                      onChange={(e) => {
                        setArquivo(e.target.files?.[0] ?? null);
                        setLidos(null);
                      }}
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      O arquivo é lido apenas neste dispositivo para extrair a certificadora e a
                      validade. Ele não é enviado nem guardado — será pedido novamente a cada
                      assinatura.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="cert-senha">Senha do certificado</Label>
                    <PasswordInput
                      id="cert-senha"
                      autoComplete="off"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" onClick={lerArquivo} disabled={lendo}>
                    {lendo ? "Lendo…" : "Ler dados do certificado"}
                  </Button>

                  {lidos && (
                    <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs space-y-1">
                      <p className="font-semibold">Dados extraídos</p>
                      <p>Titular: {lidos.titular ?? "—"}</p>
                      <p>Autoridade Certificadora: {lidos.ac_emissora ?? "—"}</p>
                      <p>
                        Validade:{" "}
                        {lidos.valido_ate
                          ? new Date(lidos.valido_ate).toLocaleDateString("pt-BR")
                          : "—"}{" "}
                        ({statusValidade(lidos.valido_ate).texto})
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Certificados A3 não ficam salvos no sistema. A assinatura acontece no provedor
                    externo ICP-Brasil, que acessa o token, cartão ou certificado em nuvem no
                    momento da assinatura.
                    {PROVEDOR_ICP.configurado
                      ? ` Provedor ativo: ${PROVEDOR_ICP.nome}.`
                      : " Nenhum provedor está configurado ainda — quando as credenciais da API forem cadastradas, o fluxo A3 é ativado automaticamente."}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="ac-manual">Autoridade Certificadora</Label>
                      <Input
                        id="ac-manual"
                        placeholder="Ex.: Certisign, Serasa, Soluti"
                        value={acManual}
                        onChange={(e) => setAcManual(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="validade-manual">Validade do certificado</Label>
                      <Input
                        id="validade-manual"
                        type="date"
                        value={validadeManual}
                        onChange={(e) => setValidadeManual(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              <Button
                onClick={() => salvar.mutate()}
                disabled={salvar.isPending || (tipo === "A1" && !lidos)}
              >
                Salvar certificado
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
