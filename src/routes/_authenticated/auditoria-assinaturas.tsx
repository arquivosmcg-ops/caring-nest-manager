import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShieldCheck, Printer } from "lucide-react";
import { carimbo, type Assinatura } from "@/lib/assinatura";

export const Route = createFileRoute("/_authenticated/auditoria-assinaturas")({
  head: () => ({
    meta: [
      { title: "Auditoria de Assinaturas · Residencial São Camilo" },
      {
        name: "description",
        content:
          "Registro de todas as assinaturas eletrônicas do prontuário: data, profissional, método, protocolo e hash de integridade.",
      },
      { property: "og:title", content: "Auditoria de Assinaturas · Residencial São Camilo" },
      {
        property: "og:description",
        content: "Histórico auditável de assinaturas eletrônicas, gov.br e ICP-Brasil.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuditoriaAssinaturasPage,
});

const METODO_LABEL: Record<string, string> = {
  pin: "PIN",
  senha: "Senha da conta",
  icp_a1: "ICP-Brasil A1",
  icp_a3: "ICP-Brasil A3",
  govbr: "gov.br",
};

const DOCUMENTO_LABEL: Record<string, string> = {
  sae: "SAE",
  evolucao_multi: "Evolução Multiprofissional",
  receituario: "Receituário Médico",
  prescricao_enfermagem_turno: "Prescrição de Enfermagem",
  cuidado_diario: "Cuidado diário",
  turno: "Turno",
  conduta_medica: "Conduta médica",
};

function AuditoriaAssinaturasPage() {
  const [busca, setBusca] = useState("");
  const [metodo, setMetodo] = useState("todos");
  const [tipo, setTipo] = useState("todos");

  const assinaturas = useQuery({
    queryKey: ["auditoria-assinaturas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assinaturas")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as Assinatura[];
    },
  });

  const linhas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (assinaturas.data ?? []).filter((a) => {
      if (metodo !== "todos" && a.metodo !== metodo) return false;
      if (tipo !== "todos" && a.documento_tipo !== tipo) return false;
      if (!termo) return true;
      return (
        a.nome_profissional.toLowerCase().includes(termo) ||
        (a.protocolo_assinatura ?? "").toLowerCase().includes(termo) ||
        a.hash_documento.toLowerCase().includes(termo)
      );
    });
  }, [assinaturas.data, busca, metodo, tipo]);

  const imprimir = () => {
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const linhasHtml = linhas
      .map(
        (a) => `<tr>
          <td>${esc(new Date(a.created_at).toLocaleString("pt-BR"))}</td>
          <td>${esc(carimbo(a))}</td>
          <td>${esc(DOCUMENTO_LABEL[a.documento_tipo] ?? a.documento_tipo)}</td>
          <td>${esc(METODO_LABEL[a.metodo] ?? a.metodo)}</td>
          <td>${esc(a.protocolo_assinatura ?? "—")}</td>
          <td>${esc(a.hash_documento.slice(0, 12))}</td>
        </tr>`,
      )
      .join("");
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
      <title>Auditoria de Assinaturas</title>
      <style>
        @page { size: A4 landscape; margin: 12mm; }
        body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; }
        h1 { font-size: 15px; margin: 0 0 8px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #999; padding: 4px 6px; text-align: left; vertical-align: top; }
        th { background: #eee; }
      </style></head><body>
      <h1>Auditoria de Assinaturas Eletrônicas</h1>
      <p>Emitido em ${new Date().toLocaleString("pt-BR")} — ${linhas.length} registro(s)</p>
      <table><thead><tr>
        <th>Data e hora</th><th>Profissional</th><th>Documento</th>
        <th>Método</th><th>Protocolo</th><th>Hash</th>
      </tr></thead><tbody>${linhasHtml}</tbody></table>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-bold flex items-center gap-2">
          <ShieldCheck className="size-5" /> Auditoria de Assinaturas
        </h1>
        <span className="text-xs text-muted-foreground">{linhas.length} registro(s)</span>
        <Button variant="outline" size="sm" className="ml-auto" onClick={imprimir}>
          <Printer className="size-4 mr-1" /> Imprimir
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Input
          placeholder="Buscar por profissional, protocolo ou hash"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <Select value={metodo} onValueChange={setMetodo}>
          <SelectTrigger>
            <SelectValue placeholder="Método" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os métodos</SelectItem>
            {Object.entries(METODO_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger>
            <SelectValue placeholder="Documento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os documentos</SelectItem>
            {Object.entries(DOCUMENTO_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="px-3 py-2">Data e hora</th>
              <th className="px-3 py-2">Profissional</th>
              <th className="px-3 py-2">Documento</th>
              <th className="px-3 py-2">Método</th>
              <th className="px-3 py-2">Protocolo</th>
              <th className="px-3 py-2">Hash</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((a) => (
              <tr key={a.id} className="border-b border-border/60 last:border-0">
                <td className="px-3 py-2 whitespace-nowrap">
                  {new Date(a.created_at).toLocaleString("pt-BR")}
                </td>
                <td className="px-3 py-2">{carimbo(a)}</td>
                <td className="px-3 py-2">
                  {DOCUMENTO_LABEL[a.documento_tipo] ?? a.documento_tipo}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {METODO_LABEL[a.metodo] ?? a.metodo}
                  {a.certificado_ac_emissor ? (
                    <span className="block text-[10px] text-muted-foreground">
                      {a.certificado_ac_emissor}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{a.protocolo_assinatura ?? "—"}</td>
                <td className="px-3 py-2 font-mono text-xs">{a.hash_documento.slice(0, 12)}</td>
              </tr>
            ))}
            {!assinaturas.isLoading && linhas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Nenhuma assinatura encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
