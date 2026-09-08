import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePerfilAtual } from "@/hooks/use-perfil";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/password-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { PenLine, ShieldCheck } from "lucide-react";
import {
  CATEGORIA_ASSINATURA_LABEL,
  CONSELHO_DA_CATEGORIA,
  UFS,
  carimbo,
} from "@/lib/assinatura";
import {
  PROVEDOR_ICP,
  assinarComA1,
  statusValidade,
  type EvidenciaAssinatura,
} from "@/lib/certificado-icp";
import { useCertificadoAtual } from "@/hooks/use-certificado";
import { PROVEDOR_GOVBR, assinarComGovBr } from "@/lib/govbr";

export type CredencialAssinatura = {
  metodo: "pin" | "senha" | "icp_a1" | "icp_a3" | "govbr";
  pin?: string;
  /** Para ICP-Brasil: assina o hash do documento no momento em que ele é conhecido. */
  assinarCertificado?: (hashDocumento: string) => Promise<EvidenciaAssinatura>;
};

export function AssinaturaDialog({
  open,
  onOpenChange,
  titulo = "Confirmar assinatura",
  descricao,
  onConfirmar,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  titulo?: string;
  descricao?: string;
  onConfirmar: (c: CredencialAssinatura) => Promise<void>;
}) {
  const perfil = usePerfilAtual().data;
  const qc = useQueryClient();
  const [modo, setModo] = useState<"pin" | "senha" | "icp" | "govbr">("pin");
  const [pin, setPin] = useState("");
  const [novoPin, setNovoPin] = useState("");
  const [senha, setSenha] = useState("");
  const [arquivoA1, setArquivoA1] = useState<File | null>(null);
  const [senhaCert, setSenhaCert] = useState("");
  const [categoria, setCategoria] = useState("");
  const [uf, setUf] = useState("");
  const [salvandoDados, setSalvandoDados] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const temPin = useQuery({
    queryKey: ["tenho-pin-assinatura"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("tenho_pin_assinatura");
      if (error) throw error;
      return !!data;
    },
  });

  const certificado = useCertificadoAtual();

  useEffect(() => {
    if (!open) {
      setPin("");
      setSenha("");
      setNovoPin("");
      setArquivoA1(null);
      setSenhaCert("");
      setEnviando(false);
    } else {
      setCategoria(perfil?.categoriaAssinatura ?? "");
      setUf(perfil?.conselhoUf ?? "");
      setModo(
        certificado.data
          ? certificado.data.tipo === "GOVBR"
            ? "govbr"
            : "icp"
          : temPin.data
            ? "pin"
            : "senha",
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, temPin.data, certificado.data]);

  const precisaDados = !perfil?.categoriaAssinatura;

  const salvarDados = async () => {
    if (!categoria) return toast.error("Selecione a categoria profissional");
    setSalvandoDados(true);
    const { error } = await supabase
      .from("profiles")
      .update({ categoria_assinatura: categoria, conselho_uf: uf || null })
      .eq("id", perfil!.userId);
    setSalvandoDados(false);
    if (error) return toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["perfil-atual"] });
    toast.success("Dados de assinatura salvos");
  };

  const criarPin = async () => {
    if (!/^[0-9]{4,6}$/.test(novoPin)) return toast.error("O PIN deve ter de 4 a 6 dígitos");
    const { error } = await supabase.rpc("definir_pin_assinatura", { _pin: novoPin });
    if (error) return toast.error(error.message);
    setNovoPin("");
    await temPin.refetch();
    setModo("pin");
    toast.success("PIN de assinatura cadastrado");
  };

  const confirmar = async () => {
    if (!perfil) return;
    setEnviando(true);
    try {
      if (modo === "govbr") {
        try {
          const cert = certificado.data;
          if (!cert || cert.tipo !== "GOVBR") {
            throw new Error("Vincule a sua conta gov.br no Meu Perfil antes de assinar.");
          }
          const { data: userData } = await supabase.auth.getUser();
          const email = userData.user?.email;
          if (!email) throw new Error("Sessão expirada. Entre novamente para assinar.");
          if (!senha) throw new Error("Confirme a sua identidade com a senha da conta.");
          const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
          if (error) throw new Error("Senha incorreta. A validação gov.br não foi concluída.");
          const cpf = (cert.numero_serie ?? "").replace(/\D/g, "");
          if (cpf.length !== 11) {
            throw new Error("O CPF da conta gov.br está incompleto no seu perfil.");
          }
          const nivel = (cert.ac_emissora ?? "").includes("ouro") ? "ouro" : "prata";
          setErroGovbr(null);
          await onConfirmar({
            metodo: "govbr",
            assinarCertificado: (hash) =>
              assinarComGovBr(cpf, nivel, cert.titular ?? perfil.fullName, hash),
          });
        } catch (e) {
          const msg = (e as Error).message || "Não foi possível validar a assinatura gov.br.";
          setErroGovbr(msg);
          throw new Error(msg);
        }
      } else if (modo === "icp") {

        const cert = certificado.data;
        if (!cert) throw new Error("Nenhum certificado digital cadastrado no seu perfil");
        if (cert.tipo === "A3") {
          if (!PROVEDOR_ICP.configurado) {
            throw new Error(
              "Assinatura A3 exige um provedor ICP-Brasil configurado. Use PIN ou senha por enquanto.",
            );
          }
          throw new Error("Provedor de assinatura A3 indisponível no momento.");
        }
        if (!arquivoA1) throw new Error("Selecione o arquivo do certificado (.pfx/.p12)");
        if (!senhaCert) throw new Error("Informe a senha do certificado");
        const arquivo = arquivoA1;
        const segredo = senhaCert;
        // Valida arquivo + senha antes de gravar o documento.
        await assinarComA1(arquivo, segredo, "verificacao");
        await onConfirmar({
          metodo: "icp_a1",
          assinarCertificado: (hash) => assinarComA1(arquivo, segredo, hash),
        });
      } else if (modo === "senha") {
        const { data: userData } = await supabase.auth.getUser();
        const email = userData.user?.email;
        if (!email) throw new Error("Sessão expirada");
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw new Error("Senha incorreta");
        await onConfirmar({ metodo: "senha" });
      } else {
        if (!/^[0-9]{4,6}$/.test(pin)) throw new Error("Informe o PIN de 4 a 6 dígitos");
        await onConfirmar({ metodo: "pin", pin });
      }
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEnviando(false);
      setSenhaCert("");
    }
  };

  const sigla = CONSELHO_DA_CATEGORIA[perfil?.categoriaAssinatura ?? ""] ?? "Registro";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="size-4" /> {titulo}
          </DialogTitle>
          <DialogDescription>
            {descricao ??
              "A assinatura eletrônica substitui o campo manuscrito de assinatura e carimbo."}
          </DialogDescription>
        </DialogHeader>

        {precisaDados ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Complete os seus dados de assinatura para continuar.
            </p>
            <div>
              <Label>Categoria profissional</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORIA_ASSINATURA_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nº do conselho</Label>
                <Input value={perfil?.registroProfissional ?? "—"} disabled />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Alterável apenas pelo administrador.
                </p>
              </div>
              <div>
                <Label>UF do conselho</Label>
                <Select value={uf} onValueChange={setUf}>
                  <SelectTrigger>
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {UFS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={salvarDados} disabled={salvandoDados} className="w-full">
              Salvar dados de assinatura
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="border border-border rounded-md p-3 bg-muted/40 text-sm">
              <p className="font-bold">{perfil?.fullName}</p>
              <p className="text-muted-foreground text-xs">
                {CATEGORIA_ASSINATURA_LABEL[perfil!.categoriaAssinatura!]} •{" "}
                {perfil?.registroProfissional
                  ? `${sigla} ${perfil.registroProfissional}${perfil.conselhoUf ? `/${perfil.conselhoUf}` : ""}`
                  : "conselho não informado"}
              </p>
            </div>

            {modo === "govbr" ? (
              <div className="space-y-3">
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs space-y-1">
                  <p className="font-semibold flex items-center gap-1">
                    <ShieldCheck className="size-3.5" /> Assinatura gov.br
                  </p>
                  <p className="text-muted-foreground">
                    Conta: {certificado.data?.numero_serie ?? "CPF não informado"}
                  </p>
                  <p className="text-muted-foreground">
                    {certificado.data?.ac_emissora ?? "conta gov.br"}
                  </p>
                  {!PROVEDOR_GOVBR.configurado && (
                    <p className="text-muted-foreground">
                      Assinatura eletrônica com registro de protocolo. A integração oficial do
                      Assinador ITI é ativada quando as credenciais forem cadastradas.
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="senha-govbr">Confirme com a senha da sua conta</Label>
                  <PasswordInput
                    id="senha-govbr"
                    autoComplete="current-password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="text-xs text-primary font-semibold"
                  onClick={() => setModo(temPin.data ? "pin" : "senha")}
                >
                  Assinar sem gov.br (PIN ou senha)
                </button>
              </div>
            ) : modo === "icp" ? (
              <div className="space-y-3">
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs space-y-1">
                  <p className="font-semibold flex items-center gap-1">
                    <ShieldCheck className="size-3.5" /> Certificado ICP-Brasil{" "}
                    {certificado.data?.tipo}
                  </p>
                  <p className="text-muted-foreground">
                    Certificadora: {certificado.data?.ac_emissora ?? "não informada"}
                  </p>
                  <p className="text-muted-foreground">
                    {statusValidade(certificado.data?.valido_ate).texto}
                  </p>
                </div>

                {certificado.data?.tipo === "A1" ? (
                  <>
                    <div>
                      <Label htmlFor="arquivo-a1">Arquivo do certificado (.pfx / .p12)</Label>
                      <Input
                        id="arquivo-a1"
                        type="file"
                        accept=".pfx,.p12"
                        onChange={(e) => setArquivoA1(e.target.files?.[0] ?? null)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="senha-cert">Senha do certificado</Label>
                      <PasswordInput
                        id="senha-cert"
                        autoComplete="off"
                        value={senhaCert}
                        onChange={(e) => setSenhaCert(e.target.value)}
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">
                        O arquivo e a senha são usados apenas neste dispositivo, no momento da
                        assinatura, e nunca são armazenados.
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Certificado A3 (token/cartão/nuvem): a assinatura ocorre no provedor externo
                    ICP-Brasil.{" "}
                    {PROVEDOR_ICP.configurado
                      ? `Provedor: ${PROVEDOR_ICP.nome}.`
                      : "Nenhum provedor está configurado ainda — use PIN ou senha até a integração ser ativada."}
                  </p>
                )}

                <button
                  type="button"
                  className="text-xs text-primary font-semibold"
                  onClick={() => setModo(temPin.data ? "pin" : "senha")}
                >
                  Assinar sem certificado (PIN ou senha)
                </button>
              </div>
            ) : modo === "pin" && temPin.data ? (
              <div>
                <Label htmlFor="pin-assinatura">PIN de assinatura</Label>
                <PasswordInput
                  id="pin-assinatura"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••"
                />
                <div className="flex flex-col items-start gap-1 mt-2">
                  <button
                    type="button"
                    className="text-xs text-primary font-semibold"
                    onClick={() => setModo("senha")}
                  >
                    Usar a senha da minha conta
                  </button>
                  {certificado.data && certificado.data.tipo !== "GOVBR" && (
                    <button
                      type="button"
                      className="text-xs text-primary font-semibold"
                      onClick={() => setModo("icp")}
                    >
                      Assinar com certificado digital (ICP-Brasil)
                    </button>
                  )}
                  {certificado.data?.tipo === "GOVBR" && (
                    <button
                      type="button"
                      className="text-xs text-primary font-semibold"
                      onClick={() => setModo("govbr")}
                    >
                      Assinar com a conta gov.br
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <Label htmlFor="senha-assinatura">Senha da conta</Label>
                <PasswordInput
                  id="senha-assinatura"
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
                <div className="flex flex-col items-start gap-1 mt-2">
                  {temPin.data && (
                    <button
                      type="button"
                      className="text-xs text-primary font-semibold"
                      onClick={() => setModo("pin")}
                    >
                      Usar PIN
                    </button>
                  )}
                  {certificado.data && certificado.data.tipo !== "GOVBR" && (
                    <button
                      type="button"
                      className="text-xs text-primary font-semibold"
                      onClick={() => setModo("icp")}
                    >
                      Assinar com certificado digital (ICP-Brasil)
                    </button>
                  )}
                  {certificado.data?.tipo === "GOVBR" && (
                    <button
                      type="button"
                      className="text-xs text-primary font-semibold"
                      onClick={() => setModo("govbr")}
                    >
                      Assinar com a conta gov.br
                    </button>
                  )}
                </div>
              </div>
            )}

            {!temPin.data && (
              <div className="border-t border-border pt-3">
                <Label htmlFor="novo-pin">Cadastrar um PIN (4 a 6 dígitos)</Label>
                <div className="flex gap-2 mt-1">
                  <PasswordInput
                    id="novo-pin"
                    inputMode="numeric"
                    maxLength={6}
                    value={novoPin}
                    onChange={(e) => setNovoPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••"
                  />
                  <Button variant="outline" onClick={criarPin}>
                    Criar PIN
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  O PIN agiliza a assinatura em tablets compartilhados da unidade.
                </p>
              </div>
            )}

            <Button onClick={confirmar} disabled={enviando} className="w-full">
              <ShieldCheck className="size-4 mr-1" />
              {enviando ? "Assinando…" : "Confirmar assinatura"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function CarimboAssinatura({
  assinatura,
}: {
  assinatura: Parameters<typeof carimbo>[0] & {
    created_at: string;
    hash_documento: string;
    metodo?: string;
    certificado_ac_emissor?: string | null;
    protocolo_assinatura?: string | null;
  };
}) {
  const icp = assinatura.metodo === "icp_a1" || assinatura.metodo === "icp_a3";
  const govbr = assinatura.metodo === "govbr";
  return (
    <div className="text-xs leading-tight">
      <p className="font-bold">{carimbo(assinatura)}</p>
      <p className="text-muted-foreground">
        {icp
          ? "Assinado digitalmente com certificado ICP-Brasil em "
          : govbr
            ? "Assinado eletronicamente com a conta gov.br em "
            : "Assinado eletronicamente em "}
        {new Date(assinatura.created_at).toLocaleString("pt-BR")}
      </p>
      {(icp || govbr) && (
        <p className="text-muted-foreground">
          {govbr ? "Emissor" : "Certificadora"}:{" "}
          {assinatura.certificado_ac_emissor ?? "não informada"} — Protocolo:{" "}
          {assinatura.protocolo_assinatura ?? "—"}
        </p>
      )}

      <p className="text-muted-foreground">
        Documento íntegro — hash: {assinatura.hash_documento.slice(0, 8)}
      </p>
    </div>
  );
}
