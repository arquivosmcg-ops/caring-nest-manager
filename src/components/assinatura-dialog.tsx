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

export type CredencialAssinatura = { metodo: "pin" | "senha"; pin?: string };

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
  const [modo, setModo] = useState<"pin" | "senha">("pin");
  const [pin, setPin] = useState("");
  const [novoPin, setNovoPin] = useState("");
  const [senha, setSenha] = useState("");
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

  useEffect(() => {
    if (!open) {
      setPin("");
      setSenha("");
      setNovoPin("");
      setEnviando(false);
    } else {
      setCategoria(perfil?.categoriaAssinatura ?? "");
      setUf(perfil?.conselhoUf ?? "");
      setModo(temPin.data ? "pin" : "senha");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, temPin.data]);

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
      if (modo === "senha") {
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

            {modo === "pin" && temPin.data ? (
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
                <button
                  type="button"
                  className="text-xs text-primary font-semibold mt-2"
                  onClick={() => setModo("senha")}
                >
                  Usar a senha da minha conta
                </button>
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
                {temPin.data && (
                  <button
                    type="button"
                    className="text-xs text-primary font-semibold mt-2"
                    onClick={() => setModo("pin")}
                  >
                    Usar PIN
                  </button>
                )}
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
  assinatura: Parameters<typeof carimbo>[0] & { created_at: string; hash_documento: string };
}) {
  return (
    <div className="text-xs leading-tight">
      <p className="font-bold">{carimbo(assinatura)}</p>
      <p className="text-muted-foreground">
        Assinado eletronicamente em {new Date(assinatura.created_at).toLocaleString("pt-BR")}
      </p>
      <p className="text-muted-foreground">
        Documento íntegro — hash: {assinatura.hash_documento.slice(0, 8)}
      </p>
    </div>
  );
}
