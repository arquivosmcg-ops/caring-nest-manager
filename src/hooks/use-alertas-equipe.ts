import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePerfilAtual } from "@/hooks/use-perfil";

export type ProfissionalAlerta = {
  id: string;
  full_name: string;
  funcao: string | null;
  status_aprovacao: string;
  aprovado: boolean;
  na_escala: boolean | null;
};

export type CategoriaAlerta =
  | "aprovacao"
  | "funcao"
  | "escala_enfermagem"
  | "escala_cuidadoras"
  | "sem_visita";

export type AlertaEquipe = {
  chave: string;
  categoria: CategoriaAlerta;
  titulo: string;
  detalhe: string;
  to: string;
};

export const ehEnfermeira = (p: ProfissionalAlerta) =>
  (p.funcao ?? "").toLowerCase().includes("enferm");
export const ehCuidadora = (p: ProfissionalAlerta) =>
  (p.funcao ?? "").toLowerCase().includes("cuidador");

const LIMITE_DIAS_SEM_VISITA = 30;

function montarAlertasEquipe(lista: ProfissionalAlerta[]): AlertaEquipe[] {
  const alertas: AlertaEquipe[] = [];
  for (const p of lista) {
    if (p.status_aprovacao === "pendente") {
      alertas.push({
        chave: `aprovacao:${p.id}`,
        categoria: "aprovacao",
        titulo: `${p.full_name} aguarda aprovação de cadastro`,
        detalhe: "Aprove ou recuse o cadastro na Área Admin.",
        to: "/admin-aprovacoes",
      });
      continue;
    }
    if (!p.aprovado) continue;
    if (!p.funcao) {
      alertas.push({
        chave: `funcao:${p.id}`,
        categoria: "funcao",
        titulo: `${p.full_name} está sem função definida`,
        detalhe: "Defina a função para classificar a escala correta.",
        to: "/admin-usuarios",
      });
    }
    if (ehEnfermeira(p) && p.na_escala === false) {
      alertas.push({
        chave: `escala-enfermagem:${p.id}`,
        categoria: "escala_enfermagem",
        titulo: `${p.full_name} (enfermagem) está fora da escala`,
        detalhe: "Inclua na escala de enfermagem ou confirme a exclusão.",
        to: "/implantacao",
      });
    }
    if (ehCuidadora(p) && p.na_escala === false) {
      alertas.push({
        chave: `escala-cuidadoras:${p.id}`,
        categoria: "escala_cuidadoras",
        titulo: `${p.full_name} (cuidadora) está fora da escala`,
        detalhe: "Inclua na escala de cuidadoras ou confirme a exclusão.",
        to: "/implantacao",
      });
    }
  }
  return alertas;
}

function montarAlertasVisitas(
  residentes: { id: string; nome_completo: string }[],
  ultimaVisitaPorResidente: Map<string, Date>,
): AlertaEquipe[] {
  const agora = Date.now();
  const alertas: AlertaEquipe[] = [];
  for (const r of residentes) {
    const ultima = ultimaVisitaPorResidente.get(r.id);
    const dias = ultima ? Math.floor((agora - ultima.getTime()) / 86_400_000) : null;
    if (dias === null || dias > LIMITE_DIAS_SEM_VISITA) {
      alertas.push({
        chave: `sem-visita:${r.id}`,
        categoria: "sem_visita",
        titulo: `${r.nome_completo} está sem visita há mais de 1 mês`,
        detalhe:
          dias === null
            ? "Nenhuma visita registrada até agora."
            : `Última visita há ${dias} dias (${ultima!.toLocaleDateString("pt-BR")}).`,
        to: "/visitas",
      });
    }
  }
  return alertas;
}

export function useAlertasEquipe() {
  const perfil = usePerfilAtual().data;
  const isAdmin = !!perfil?.isAdmin;

  const profissionais = useQuery({
    queryKey: ["alertas-equipe"],
    enabled: isAdmin,
    refetchInterval: 120_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("listar_profissionais");
      if (error) throw error;
      return (data ?? []) as ProfissionalAlerta[];
    },
  });

  const visitas = useQuery({
    queryKey: ["alertas-sem-visita"],
    enabled: isAdmin,
    refetchInterval: 300_000,
    queryFn: async () => {
      const [{ data: residentes, error: e1 }, { data: vinculos, error: e2 }] = await Promise.all([
        supabase.from("residentes").select("id, nome_completo").eq("ativo", true),
        supabase.from("visitas_residentes").select("residente_id, visitas(data)"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const ultima = new Map<string, Date>();
      for (const v of vinculos ?? []) {
        const dataStr = (v.visitas as { data: string } | null)?.data;
        if (!dataStr) continue;
        const d = new Date(`${dataStr}T12:00:00`);
        const atual = ultima.get(v.residente_id);
        if (!atual || d > atual) ultima.set(v.residente_id, d);
      }
      return { residentes: residentes ?? [], ultima };
    },
  });

  const dispensas = useQuery({
    queryKey: ["alertas-equipe-dispensados"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alertas_equipe_dispensados")
        .select("alerta_chave, dispensado_por_nome, dispensado_em");
      if (error) throw error;
      return data ?? [];
    },
  });

  const alertas = useMemo(() => {
    const equipe = montarAlertasEquipe(profissionais.data ?? []);
    const semVisita = montarAlertasVisitas(
      visitas.data?.residentes ?? [],
      visitas.data?.ultima ?? new Map(),
    );
    return [...equipe, ...semVisita];
  }, [profissionais.data, visitas.data]);

  const mapaDispensas = useMemo(
    () => new Map((dispensas.data ?? []).map((d) => [d.alerta_chave, d])),
    [dispensas.data],
  );

  return { isAdmin, alertas, mapaDispensas };
}
