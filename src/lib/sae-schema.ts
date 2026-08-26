export type SaeCampo =
  | { id: string; label: string; tipo: "chips"; multi?: boolean; opcoes: string[]; sufixo?: string }
  | { id: string; label: string; tipo: "texto"; placeholder?: string }
  | { id: string; label: string; tipo: "numero"; unidade?: string }
  | { id: string; label: string; tipo: "textarea" };

export type SaeSecao = { id: string; titulo: string; campos: SaeCampo[] };

export const SAE_SECOES: SaeSecao[] = [
  {
    id: "cardiaco",
    titulo: "1. Trocar — Cardíaco / Periférico",
    campos: [
      { id: "pa", label: "PA", tipo: "numero", unidade: "mmHg" },
      { id: "pa_local", label: "Local (PA)", tipo: "texto" },
      { id: "fc", label: "FC", tipo: "numero", unidade: "bpm" },
      { id: "fc_local", label: "Local (FC)", tipo: "texto" },
      { id: "ausculta_cardiaca", label: "A. Cardíaca", tipo: "texto" },
      { id: "pulso", label: "Pulso", tipo: "chips", opcoes: ["Cheio", "Filiforme", "Ausente"] },
      {
        id: "perfusao",
        label: "Perfusão periférica",
        tipo: "chips",
        multi: true,
        opcoes: ["Preservada", "MMSS", "MMII", "Cianose", "Edema"],
      },
      { id: "perfusao_obs", label: "Detalhar perfusão", tipo: "texto" },
    ],
  },
  {
    id: "cerebral",
    titulo: "2. Trocar — Cerebral",
    campos: [
      {
        id: "estado_mental",
        label: "Estado mental",
        tipo: "chips",
        multi: true,
        opcoes: [
          "Orientada no tempo e espaço",
          "Desorientada",
          "Confusa",
          "Com alucinações",
          "Calma",
          "Agitada",
          "Agressiva",
          "Sonolenta",
        ],
      },
      {
        id: "pupilas",
        label: "Pupilas",
        tipo: "chips",
        multi: true,
        opcoes: ["Isocóricas", "Anisocóricas", "Fotorreagentes", "Midríase"],
      },
      {
        id: "deficit",
        label: "Déficit",
        tipo: "chips",
        multi: true,
        opcoes: ["Plegia", "Parestesia", "Paresia", "Dislalia", "Outro"],
      },
      { id: "deficit_outro", label: "Outro déficit", tipo: "texto" },
    ],
  },
  {
    id: "respiratorio",
    titulo: "3. Trocar — Respiratório",
    campos: [
      { id: "oxigenacao", label: "Oxigenação", tipo: "chips", opcoes: ["Eupneica", "Bradipneica", "Taquipneica"] },
      { id: "tosse", label: "Tosse", tipo: "chips", opcoes: ["Produtiva", "Seca"] },
      { id: "ausculta_pulmonar", label: "Ausculta pulmonar", tipo: "texto" },
      { id: "expansibilidade", label: "Expansibilidade torácica", tipo: "chips", opcoes: ["Simétrica", "Assimétrica"] },
      {
        id: "suporte_o2",
        label: "Suporte de O₂",
        tipo: "chips",
        multi: true,
        opcoes: ["Uso intermitente de O2", "Traqueostomia"],
      },
      { id: "temperatura", label: "Temperatura", tipo: "numero", unidade: "°C" },
      { id: "temperatura_local", label: "Local (temperatura)", tipo: "texto" },
    ],
  },
  {
    id: "nutricao",
    titulo: "4. Nutrição",
    campos: [
      { id: "via_alimentacao", label: "Via de alimentação", tipo: "chips", opcoes: ["VO", "SNE", "SNG", "GTT"] },
      { id: "dieta", label: "Dieta", tipo: "chips", opcoes: ["Geral", "Pastosa", "Branda"] },
      { id: "cavidade_oral", label: "Cavidade oral", tipo: "texto" },
      { id: "dentes", label: "Dentes", tipo: "texto" },
      { id: "protese", label: "Prótese", tipo: "chips", multi: true, opcoes: ["Inferior", "Superior"] },
      {
        id: "sintomas",
        label: "Sintomas",
        tipo: "chips",
        multi: true,
        opcoes: ["Náuseas", "Vômitos", "Pirose", "Disfagia", "Anorexia"],
      },
    ],
  },
  {
    id: "abdome",
    titulo: "5. Abdome / Eliminações",
    campos: [
      { id: "abdome", label: "Abdome", tipo: "chips", opcoes: ["Globoso", "Plano", "Flácido", "Distendido"] },
      { id: "abdome_obs", label: "Observações do abdome", tipo: "texto" },
      { id: "rha", label: "RHA presente em", tipo: "chips", multi: true, opcoes: ["QSE", "QSD", "QID", "QIE"] },
      { id: "db", label: "DB", tipo: "chips", opcoes: ["Positivo (+)", "Negativo (-)"] },
      { id: "eliminacoes_freq", label: "Eliminações intestinais", tipo: "numero", unidade: "x/semana" },
      {
        id: "eliminacoes_caract",
        label: "Características",
        tipo: "chips",
        multi: true,
        opcoes: ["Com laxante", "Com enema", "Pastosa", "Líquida", "Endurecida"],
      },
      { id: "eliminacao_renal", label: "Eliminação renal", tipo: "chips", opcoes: ["Espontânea", "Incontinência"] },
      { id: "eliminacao_renal_obs", label: "Observações renais", tipo: "texto" },
      { id: "fralda", label: "Uso de fralda", tipo: "chips", opcoes: ["Sim", "Não"] },
    ],
  },
  {
    id: "pele",
    titulo: "6. Pele e Tecidos",
    campos: [
      {
        id: "aspecto_pele",
        label: "Aspecto da pele",
        tipo: "chips",
        multi: true,
        opcoes: ["Corada", "Seca/ressecada", "Hiperemiada", "Hematoma"],
      },
      { id: "elasticidade", label: "Elasticidade", tipo: "chips", opcoes: ["Preservada", "Diminuída"] },
      { id: "turgor", label: "Turgor", tipo: "chips", opcoes: ["Normal", "Diminuído"] },
      { id: "hidratacao", label: "Hidratação", tipo: "chips", opcoes: ["Hidratada", "Ressecada"] },
      { id: "integridade", label: "Integridade", tipo: "texto" },
      { id: "lesao", label: "Lesão", tipo: "textarea" },
    ],
  },
  {
    id: "comunicar",
    titulo: "7. Comunicar",
    campos: [
      {
        id: "tipo_comunicacao",
        label: "Tipo de comunicação",
        tipo: "chips",
        multi: true,
        opcoes: [
          "Comunicação verbal",
          "Comunicação não verbal",
          "Comunicação desconexa",
          "Dificuldade por impedimento mecânico",
        ],
      },
      {
        id: "capacidades",
        label: "Capacidades",
        tipo: "chips",
        multi: true,
        opcoes: [
          "Escreve",
          "Lê",
          "Compreende e executa comandos verbais",
          "Não executa comandos verbais",
          "Interage com o meio ambiente",
        ],
      },
    ],
  },
  {
    id: "relacionar",
    titulo: "8. Relacionar",
    campos: [
      { id: "estado_civil", label: "Estado civil", tipo: "chips", opcoes: ["Casada", "Viúva", "Solteira", "Mãe"] },
      { id: "n_filhos", label: "Nº de filhos", tipo: "numero" },
      { id: "filhos_vivos", label: "Filhos vivos", tipo: "numero" },
      { id: "relacao_familiar", label: "Relação familiar", tipo: "textarea" },
    ],
  },
  {
    id: "valorizar",
    titulo: "9. Valorizar",
    campos: [
      { id: "religiao", label: "Religião", tipo: "texto" },
      { id: "espiritualidade", label: "Espiritualidade", tipo: "texto" },
      { id: "padrao_escolha", label: "Padrão de escolha", tipo: "textarea" },
    ],
  },
  {
    id: "movimentar",
    titulo: "10. Movimentar",
    campos: [
      {
        id: "mobilidade",
        label: "Mobilidade",
        tipo: "chips",
        multi: true,
        opcoes: [
          "Dependente para cuidados",
          "Independente para deambular",
          "Cadeirante",
          "Usa órtese",
          "Movimenta-se no leito",
        ],
      },
      {
        id: "sono",
        label: "Sono",
        tipo: "chips",
        multi: true,
        opcoes: ["Dorme bem", "Usa medicação para dormir"],
      },
    ],
  },
  {
    id: "conhecer",
    titulo: "11. Escolher / Conhecer",
    campos: [
      { id: "deficiencia_sentido", label: "Deficiência de órgão do sentido", tipo: "texto" },
      { id: "sabe_onde_esta", label: "Sabe onde está", tipo: "chips", opcoes: ["Sim", "Não"] },
      { id: "sabe_onde_esta_obs", label: "Observações", tipo: "texto" },
      { id: "conhece_doenca", label: "Conhece sua doença", tipo: "chips", opcoes: ["Sim", "Não"] },
      { id: "conhece_doenca_obs", label: "Observações", tipo: "texto" },
      { id: "memoria", label: "Memória", tipo: "chips", opcoes: ["Preservada", "Prejudicada"] },
      { id: "atencao", label: "Atenção e concentração", tipo: "chips", opcoes: ["Preservada", "Prejudicada"] },
      { id: "padrao_conhecimento", label: "Padrão de conhecimento", tipo: "textarea" },
    ],
  },
];

export type SaeValores = Record<string, Record<string, string | string[] | number>>;

export function resumoSecao(secao: SaeSecao, valores: SaeValores): number {
  const v = valores[secao.id] ?? {};
  return secao.campos.filter((c) => {
    const val = v[c.id];
    return Array.isArray(val) ? val.length > 0 : val !== undefined && val !== "" && val !== null;
  }).length;
}
