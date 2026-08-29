import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePerfilAtual } from "@/hooks/use-perfil";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { TextareaDitavel } from "@/components/ditar-audio";
import { AssinaturaVisitante } from "@/components/assinatura-visitante";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { AlertTriangle, DoorOpen, LogOut, Settings, Users } from "lucide-react";
import {
  GRAUS_PARENTESCO,
  type ConfigVisitas,
  type Visita,
  type Visitante,
  dataCurta,
  deInputLocal,
  duracao,
  hojeISO,
  horaCurta,
  horasAberta,
  normalizar,
  paraInputLocal,
} from "@/lib/visitas";

export const Route = createFileRoute("/_authenticated/visitas")({
  head: () => ({
    meta: [
      { title: "Controle de Visitas — Residencial São Camilo" },
      {
        name: "description",
        content:
          "Registro de entrada e saída de visitantes da ILPI, vinculado aos residentes visitados, com triagem e histórico.",
      },
      { property: "og:title", content: "Controle de Visitas — Residencial São Camilo" },
      {
        property: "og:description",
        content: "Registro de entrada e saída de visitantes da ILPI com triagem, termo de ciência e histórico.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VisitasPage,
});

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-bold border transition-colors",
        active
          ? "bg-foreground text-background border-foreground"
          : "bg-surface text-muted-foreground border-border hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function VisitasPage() {
  const qc = useQueryClient();
  const perfil = usePerfilAtual().data;

  const config = useQuery({
    queryKey: ["config-visitas"],
    queryFn: async () => {
      const { data } = await supabase.from("config_visitas").select("*").maybeSingle();
      return (data ?? {
        triagem_ativa: true,
        termo_ativo: true,
        normas_texto: "",
        alerta_horas: 4,
      }) as ConfigVisitas;
    },
  });

  const residentes = useQuery({
    queryKey: ["residentes-simple"],
    queryFn: async () => {
      const { data } = await supabase
        .from("residentes")
        .select("id, nome_completo")
        .eq("ativo", true)
        .order("nome_completo");
      return data ?? [];
    },
  });

  const visitantes = useQuery({
    queryKey: ["visitantes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("visitantes")
        .select("id, nome, documento, grau_parentesco_padrao")
        .order("nome");
      return (data ?? []) as Visitante[];
    },
  });

  const visitas = useQuery({
    queryKey: ["visitas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visitas")
        .select(
          "*, visitantes(nome, documento), visitas_residentes(residente_id, residentes(nome_completo))",
        )
        .order("data", { ascending: false })
        .order("horario_entrada", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Visita[];
    },
  });

  // ------- formulário -------
  const [residentesSel, setResidentesSel] = useState<string[]>([]);
  const [buscaResidente, setBuscaResidente] = useState("");
  const [nomeVisitante, setNomeVisitante] = useState("");
  const [documento, setDocumento] = useState("");
  const [grau, setGrau] = useState<string>("Filho(a)");
  const [grauOutro, setGrauOutro] = useState("");
  const [data, setData] = useState(hojeISO());
  const [entrada, setEntrada] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [sintomas, setSintomas] = useState<boolean | null>(null);
  const [temperatura, setTemperatura] = useState("");
  const [ciente, setCiente] = useState(false);
  const [assinatura, setAssinatura] = useState<string | null>(null);
  const [normasAbertas, setNormasAbertas] = useState(false);
  const [confirmarDupla, setConfirmarDupla] = useState<Visita | null>(null);

  const sugestoes = useMemo(() => {
    const termo = normalizar(nomeVisitante);
    if (termo.length < 2) return [];
    return (visitantes.data ?? [])
      .filter((v) => normalizar(v.nome).includes(termo) && normalizar(v.nome) !== termo)
      .slice(0, 6);
  }, [nomeVisitante, visitantes.data]);

  const residentesFiltrados = useMemo(() => {
    const termo = normalizar(buscaResidente);
    const lista = residentes.data ?? [];
    return termo ? lista.filter((r) => normalizar(r.nome_completo).includes(termo)) : lista;
  }, [buscaResidente, residentes.data]);

  const limpar = () => {
    setResidentesSel([]);
    setBuscaResidente("");
    setNomeVisitante("");
    setDocumento("");
    setGrau("Filho(a)");
    setGrauOutro("");
    setData(hojeISO());
    setEntrada("");
    setObservacoes("");
    setSintomas(null);
    setTemperatura("");
    setCiente(false);
    setAssinatura(null);
  };

  const aplicarSugestao = (v: Visitante) => {
    setNomeVisitante(v.nome);
    if (v.documento) setDocumento(v.documento);
    if (v.grau_parentesco_padrao) {
      if ((GRAUS_PARENTESCO as readonly string[]).includes(v.grau_parentesco_padrao)) {
        setGrau(v.grau_parentesco_padrao);
        setGrauOutro("");
      } else {
        setGrau("Outro");
        setGrauOutro(v.grau_parentesco_padrao);
      }
    }
  };

  const grauFinal = grau === "Outro" ? grauOutro.trim() || "Outro" : grau;

  const registrar = useMutation({
    mutationFn: async (opts: { fecharAnterior?: string } = {}) => {
      const nome = nomeVisitante.trim();
      let visitante = (visitantes.data ?? []).find((v) => normalizar(v.nome) === normalizar(nome));

      if (opts.fecharAnterior) {
        const { error } = await supabase
          .from("visitas")
          .update({ horario_saida: new Date().toISOString() })
          .eq("id", opts.fecharAnterior);
        if (error) throw error;
      }

      if (!visitante) {
        const { data: novo, error } = await supabase
          .from("visitantes")
          .insert({ nome, documento: documento.trim() || null, grau_parentesco_padrao: grauFinal })
          .select("id, nome, documento, grau_parentesco_padrao")
          .single();
        if (error) throw error;
        visitante = novo as Visitante;
      } else if (documento.trim() && documento.trim() !== visitante.documento) {
        await supabase
          .from("visitantes")
          .update({ documento: documento.trim(), grau_parentesco_padrao: grauFinal })
          .eq("id", visitante.id);
      }

      const { data: visita, error: erroVisita } = await supabase
        .from("visitas")
        .insert({
          visitante_id: visitante.id,
          data,
          horario_entrada: deInputLocal(entrada) ?? new Date().toISOString(),
          grau_parentesco: grauFinal,
          recebido_por: perfil?.userId ?? null,
          recebido_por_nome: perfil?.fullName ?? null,
          observacoes: observacoes.trim() || null,
          sintomas_gripais: config.data?.triagem_ativa ? sintomas : null,
          temperatura: config.data?.triagem_ativa && temperatura ? Number(temperatura) : null,
          ciente_normas: ciente,
          assinatura_visitante: assinatura,
        })
        .select("id")
        .single();
      if (erroVisita) throw erroVisita;

      const { error: erroVinculo } = await supabase
        .from("visitas_residentes")
        .insert(residentesSel.map((residente_id) => ({ visita_id: visita.id, residente_id })));
      if (erroVinculo) throw erroVinculo;
    },
    onSuccess: () => {
      toast.success("Entrada registrada");
      qc.invalidateQueries({ queryKey: ["visitas"] });
      qc.invalidateQueries({ queryKey: ["visitantes"] });
      setConfirmarDupla(null);
      limpar();
    },
    onError: (e: unknown) => toast.error((e as Error)?.message || "Não foi possível registrar a visita"),
  });

  const salvarEntrada = () => {
    if (residentesSel.length === 0) {
      toast.error("Selecione pelo menos um residente visitado");
      return;
    }
    if (!nomeVisitante.trim()) {
      toast.error("Informe o nome do visitante");
      return;
    }
    if (config.data?.termo_ativo && !ciente) {
      toast.error("Confirme a ciência das normas de visitação");
      return;
    }
    const emAberto = (visitas.data ?? []).find(
      (v) => !v.horario_saida && normalizar(v.visitantes?.nome ?? "") === normalizar(nomeVisitante),
    );
    if (emAberto) {
      setConfirmarDupla(emAberto);
      return;
    }
    registrar.mutate({});
  };

  // ------- saída -------
  const registrarSaida = useMutation({
    mutationFn: async ({ id, quando }: { id: string; quando: string }) => {
      const { error } = await supabase.from("visitas").update({ horario_saida: quando }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saída registrada");
      qc.invalidateQueries({ queryKey: ["visitas"] });
    },
    onError: (e: unknown) => toast.error((e as Error)?.message || "Erro ao registrar saída"),
  });

  const [editandoSaida, setEditandoSaida] = useState<Visita | null>(null);
  const [saidaValor, setSaidaValor] = useState("");

  // ------- filtros do histórico -------
  const [fResidente, setFResidente] = useState("");
  const [fVisitante, setFVisitante] = useState("");
  const [fDe, setFDe] = useState("");
  const [fAte, setFAte] = useState("");

  const historico = useMemo(() => {
    return (visitas.data ?? []).filter((v) => {
      if (fDe && v.data < fDe) return false;
      if (fAte && v.data > fAte) return false;
      if (fVisitante && !normalizar(v.visitantes?.nome ?? "").includes(normalizar(fVisitante))) return false;
      if (fResidente && !v.visitas_residentes.some((r) => r.residente_id === fResidente)) return false;
      return true;
    });
  }, [visitas.data, fDe, fAte, fVisitante, fResidente]);

  const abertas = useMemo(() => (visitas.data ?? []).filter((v) => !v.horario_saida), [visitas.data]);
  const alertaHoras = config.data?.alerta_horas ?? 4;

  // ------- configurações -------
  const [configAberta, setConfigAberta] = useState(false);
  const salvarConfig = useMutation({
    mutationFn: async (valores: Partial<ConfigVisitas>) => {
      const { error } = await supabase.from("config_visitas").update(valores).eq("id", true);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configurações atualizadas");
      qc.invalidateQueries({ queryKey: ["config-visitas"] });
    },
    onError: (e: unknown) => toast.error((e as Error)?.message || "Erro ao salvar configurações"),
  });

  const nomesResidentes = (v: Visita) =>
    v.visitas_residentes.map((r) => r.residentes?.nome_completo).filter(Boolean).join(", ") || "—";

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight flex items-center gap-2">
            <DoorOpen className="size-5" /> Controle de Visitas
          </h2>
          <p className="text-xs text-muted-foreground">
            Registro de entrada e saída de visitantes vinculado aos residentes visitados.
          </p>
        </div>
        {perfil?.isAdmin && (
          <Button variant="outline" size="sm" onClick={() => setConfigAberta(true)}>
            <Settings className="mr-2 size-4" /> Configurações
          </Button>
        )}
      </div>

      {/* visitas em aberto */}
      {abertas.length > 0 && (
        <section className="rounded-lg border border-border bg-surface p-4 space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Users className="size-4" /> Visitas em andamento ({abertas.length})
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {abertas.map((v) => {
              const atrasada = horasAberta(v.horario_entrada) > alertaHoras;
              return (
                <div
                  key={v.id}
                  className={cn(
                    "rounded-md border p-3 space-y-1",
                    atrasada ? "border-primary bg-primary/5" : "border-border",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold truncate">{v.visitantes?.nome}</p>
                    {atrasada && <AlertTriangle className="size-4 text-primary shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">Visitando: {nomesResidentes(v)}</p>
                  <p className="text-xs text-muted-foreground">
                    Entrada {horaCurta(v.horario_entrada)} • {dataCurta(v.data)}
                  </p>
                  {atrasada && (
                    <p className="text-[11px] font-semibold text-primary">
                      Aberta há mais de {alertaHoras}h — confirme a saída.
                    </p>
                  )}
                  <Button
                    size="sm"
                    className="w-full mt-1"
                    onClick={() => {
                      setEditandoSaida(v);
                      setSaidaValor(paraInputLocal(new Date().toISOString()));
                    }}
                  >
                    <LogOut className="mr-2 size-3.5" /> Registrar saída
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* formulário de entrada */}
      <section className="rounded-lg border border-border bg-surface p-4 space-y-5">
        <h3 className="text-sm font-bold">Registrar entrada</h3>

        <div className="space-y-2">
          <Label>Residente(s) visitado(s) *</Label>
          <Input
            placeholder="Buscar residente…"
            value={buscaResidente}
            onChange={(e) => setBuscaResidente(e.target.value)}
          />
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1">
            {residentesFiltrados.map((r) => (
              <Chip
                key={r.id}
                active={residentesSel.includes(r.id)}
                onClick={() =>
                  setResidentesSel((s) =>
                    s.includes(r.id) ? s.filter((x) => x !== r.id) : [...s, r.id],
                  )
                }
              >
                {r.nome_completo}
              </Chip>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {residentesSel.length} residente(s) selecionado(s)
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5 relative">
            <Label>Nome do visitante *</Label>
            <Input value={nomeVisitante} onChange={(e) => setNomeVisitante(e.target.value)} autoComplete="off" />
            {sugestoes.length > 0 && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 rounded-md border border-border bg-background shadow-lg">
                {sugestoes.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => aplicarSugestao(s)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted"
                  >
                    <span className="font-semibold">{s.nome}</span>
                    {s.documento && <span className="text-muted-foreground"> • {s.documento}</span>}
                    {s.grau_parentesco_padrao && (
                      <span className="text-muted-foreground"> • {s.grau_parentesco_padrao}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Documento (RG ou CPF)</Label>
            <Input value={documento} onChange={(e) => setDocumento(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Grau de parentesco / relação</Label>
          <div className="flex flex-wrap gap-2">
            {GRAUS_PARENTESCO.map((g) => (
              <Chip key={g} active={grau === g} onClick={() => setGrau(g)}>
                {g}
              </Chip>
            ))}
          </div>
          {grau === "Outro" && (
            <Input
              placeholder="Especifique a relação"
              value={grauOutro}
              onChange={(e) => setGrauOutro(e.target.value)}
            />
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Data da visita</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Horário de entrada</Label>
            <Input
              type="datetime-local"
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
              placeholder="Automático ao salvar"
            />
            <p className="text-[11px] text-muted-foreground">Em branco = momento do registro.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Recebido por</Label>
            <Input value={perfil?.fullName ?? ""} readOnly className="bg-muted" />
          </div>
        </div>

        {config.data?.triagem_ativa && (
          <div className="rounded-md border border-border p-3 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Triagem de saúde
            </p>
            <div className="space-y-2">
              <Label>Está com sintomas gripais/febre?</Label>
              <div className="flex gap-2">
                <Chip active={sintomas === true} onClick={() => setSintomas(true)}>
                  Sim
                </Chip>
                <Chip active={sintomas === false} onClick={() => setSintomas(false)}>
                  Não
                </Chip>
              </div>
            </div>
            <div className="space-y-1.5 max-w-40">
              <Label>Temperatura aferida (°C)</Label>
              <Input
                type="number"
                step="0.1"
                value={temperatura}
                onChange={(e) => setTemperatura(e.target.value)}
              />
            </div>
            {sintomas === true && (
              <p className="rounded-md bg-primary/10 border border-primary/30 p-2 text-xs font-semibold text-primary">
                Oriente o visitante sobre o risco de contágio e avise a enfermagem. O registro pode
                prosseguir a critério da recepção.
              </p>
            )}
          </div>
        )}

        {config.data?.termo_ativo && (
          <div className="rounded-md border border-border p-3 space-y-3">
            <div className="flex items-start gap-2">
              <Checkbox
                id="ciente"
                checked={ciente}
                onCheckedChange={(c) => setCiente(c === true)}
                className="mt-0.5"
              />
              <Label htmlFor="ciente" className="text-sm font-medium leading-snug">
                Visitante ciente das normas de visitação da instituição
              </Label>
            </div>
            <button
              type="button"
              className="text-xs font-semibold underline text-muted-foreground hover:text-foreground"
              onClick={() => setNormasAbertas(true)}
            >
              Ler as normas de visitação
            </button>
            <div className="space-y-1.5">
              <Label>Assinatura do visitante (opcional)</Label>
              <AssinaturaVisitante valor={assinatura} onChange={setAssinatura} />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Observações</Label>
          <TextareaDitavel
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Ex.: trouxe roupas, fraldas, alimentos…"
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={salvarEntrada} disabled={registrar.isPending}>
            Registrar entrada
          </Button>
          <Button variant="outline" onClick={limpar}>
            Limpar
          </Button>
        </div>
      </section>

      {/* histórico */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold">Histórico de visitas</h3>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Residente</Label>
            <select
              value={fResidente}
              onChange={(e) => setFResidente(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Todos</option>
              {(residentes.data ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome_completo}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Visitante</Label>
            <Input value={fVisitante} onChange={(e) => setFVisitante(e.target.value)} placeholder="Nome" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">De</Label>
            <Input type="date" value={fDe} onChange={(e) => setFDe(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Até</Label>
            <Input type="date" value={fAte} onChange={(e) => setFAte(e.target.value)} />
          </div>
        </div>

        <p className="text-xs font-semibold text-muted-foreground">
          {historico.length} visita(s) no período filtrado •{" "}
          {historico.filter((v) => !v.horario_saida).length} em aberto
        </p>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">Data</th>
                <th className="text-left p-3">Residente(s)</th>
                <th className="text-left p-3">Visitante</th>
                <th className="text-left p-3">Parentesco</th>
                <th className="text-left p-3">Entrada</th>
                <th className="text-left p-3">Saída</th>
                <th className="text-left p-3">Duração</th>
                <th className="text-left p-3">Recebido por</th>
                <th className="text-left p-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {historico.map((v) => (
                <tr key={v.id} className={cn("border-t border-border", !v.horario_saida && "bg-primary/5")}>
                  <td className="p-3 whitespace-nowrap">{dataCurta(v.data)}</td>
                  <td className="p-3">{nomesResidentes(v)}</td>
                  <td className="p-3 font-semibold">{v.visitantes?.nome}</td>
                  <td className="p-3">{v.grau_parentesco ?? "—"}</td>
                  <td className="p-3 whitespace-nowrap">{horaCurta(v.horario_entrada)}</td>
                  <td className="p-3 whitespace-nowrap">{horaCurta(v.horario_saida)}</td>
                  <td className="p-3 whitespace-nowrap">{duracao(v.horario_entrada, v.horario_saida)}</td>
                  <td className="p-3">{v.recebido_por_nome ?? "—"}</td>
                  <td className="p-3">
                    <Button
                      size="sm"
                      variant={v.horario_saida ? "outline" : "default"}
                      onClick={() => {
                        setEditandoSaida(v);
                        setSaidaValor(paraInputLocal(v.horario_saida ?? new Date().toISOString()));
                      }}
                    >
                      {v.horario_saida ? "Editar saída" : "Registrar saída"}
                    </Button>
                  </td>
                </tr>
              ))}
              {historico.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-sm text-muted-foreground">
                    Nenhuma visita registrada no período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* dialog saída */}
      <Dialog open={!!editandoSaida} onOpenChange={(o) => !o && setEditandoSaida(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Horário de saída</DialogTitle>
            <DialogDescription>
              {editandoSaida?.visitantes?.nome} — entrada {horaCurta(editandoSaida?.horario_entrada ?? null)}
            </DialogDescription>
          </DialogHeader>
          <Input type="datetime-local" value={saidaValor} onChange={(e) => setSaidaValor(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditandoSaida(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                const quando = deInputLocal(saidaValor);
                if (!editandoSaida || !quando) {
                  toast.error("Informe um horário válido");
                  return;
                }
                registrarSaida.mutate(
                  { id: editandoSaida.id, quando },
                  { onSuccess: () => setEditandoSaida(null) },
                );
              }}
            >
              Salvar saída
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* dialog visita duplicada */}
      <Dialog open={!!confirmarDupla} onOpenChange={(o) => !o && setConfirmarDupla(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Visita em andamento</DialogTitle>
            <DialogDescription>
              Este visitante já possui uma visita em andamento (entrada {horaCurta(confirmarDupla?.horario_entrada ?? null)}
              ). Deseja registrar a saída da anterior antes de abrir uma nova?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmarDupla(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => confirmarDupla && registrar.mutate({ fecharAnterior: confirmarDupla.id })}
              disabled={registrar.isPending}
            >
              Fechar anterior e registrar nova
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* dialog normas */}
      <Dialog open={normasAbertas} onOpenChange={setNormasAbertas}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Normas de visitação</DialogTitle>
          </DialogHeader>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{config.data?.normas_texto}</p>
        </DialogContent>
      </Dialog>

      {/* dialog configurações */}
      <Dialog open={configAberta} onOpenChange={setConfigAberta}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurações de visitas</DialogTitle>
            <DialogDescription>Ajustes aplicados a todos os registros de visita.</DialogDescription>
          </DialogHeader>
          <ConfigForm
            config={config.data}
            salvando={salvarConfig.isPending}
            onSalvar={(v) => salvarConfig.mutate(v, { onSuccess: () => setConfigAberta(false) })}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConfigForm({
  config,
  salvando,
  onSalvar,
}: {
  config?: ConfigVisitas;
  salvando: boolean;
  onSalvar: (v: Partial<ConfigVisitas>) => void;
}) {
  const [triagem, setTriagem] = useState(config?.triagem_ativa ?? true);
  const [termo, setTermo] = useState(config?.termo_ativo ?? true);
  const [normas, setNormas] = useState(config?.normas_texto ?? "");
  const [horas, setHoras] = useState(String(config?.alerta_horas ?? 4));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="triagem">Triagem de saúde na entrada</Label>
        <Switch id="triagem" checked={triagem} onCheckedChange={setTriagem} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="termo">Termo de ciência e assinatura do visitante</Label>
        <Switch id="termo" checked={termo} onCheckedChange={setTermo} />
      </div>
      <div className="space-y-1.5">
        <Label>Alerta de visita aberta (horas)</Label>
        <Input type="number" min={1} value={horas} onChange={(e) => setHoras(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Texto das normas de visitação</Label>
        <TextareaDitavel value={normas} onChange={(e) => setNormas(e.target.value)} className="min-h-32" />
      </div>
      <Button
        className="w-full"
        disabled={salvando}
        onClick={() =>
          onSalvar({
            triagem_ativa: triagem,
            termo_ativo: termo,
            normas_texto: normas,
            alerta_horas: Math.max(1, Number(horas) || 4),
          })
        }
      >
        Salvar configurações
      </Button>
    </div>
  );
}
