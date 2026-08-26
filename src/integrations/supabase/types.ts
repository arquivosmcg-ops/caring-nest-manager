export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      admin_config: {
        Row: {
          id: boolean
          senha_painel_hash: string
          updated_at: string
        }
        Insert: {
          id?: boolean
          senha_painel_hash: string
          updated_at?: string
        }
        Update: {
          id?: boolean
          senha_painel_hash?: string
          updated_at?: string
        }
        Relationships: []
      }
      administracoes: {
        Row: {
          administrado_em: string
          administrado_por: string | null
          id: string
          medicamento_id: string
          observacoes: string | null
          residente_id: string
        }
        Insert: {
          administrado_em?: string
          administrado_por?: string | null
          id?: string
          medicamento_id: string
          observacoes?: string | null
          residente_id: string
        }
        Update: {
          administrado_em?: string
          administrado_por?: string | null
          id?: string
          medicamento_id?: string
          observacoes?: string | null
          residente_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "administracoes_medicamento_id_fkey"
            columns: ["medicamento_id"]
            isOneToOne: false
            referencedRelation: "medicamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "administracoes_residente_id_fkey"
            columns: ["residente_id"]
            isOneToOne: false
            referencedRelation: "residentes"
            referencedColumns: ["id"]
          },
        ]
      }
      alertas_clinicos: {
        Row: {
          categoria: string
          created_at: string
          emitido_por: string
          emitido_por_nome: string
          evolucao_id: string | null
          id: string
          mensagem: string
          residente_id: string
          resolvido_em: string | null
          resolvido_por: string | null
          status: string
          visualizado_em: string | null
        }
        Insert: {
          categoria: string
          created_at?: string
          emitido_por: string
          emitido_por_nome?: string
          evolucao_id?: string | null
          id?: string
          mensagem: string
          residente_id: string
          resolvido_em?: string | null
          resolvido_por?: string | null
          status?: string
          visualizado_em?: string | null
        }
        Update: {
          categoria?: string
          created_at?: string
          emitido_por?: string
          emitido_por_nome?: string
          evolucao_id?: string | null
          id?: string
          mensagem?: string
          residente_id?: string
          resolvido_em?: string | null
          resolvido_por?: string | null
          status?: string
          visualizado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alertas_clinicos_evolucao_id_fkey"
            columns: ["evolucao_id"]
            isOneToOne: false
            referencedRelation: "evolucoes_multi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_clinicos_residente_id_fkey"
            columns: ["residente_id"]
            isOneToOne: false
            referencedRelation: "residentes"
            referencedColumns: ["id"]
          },
        ]
      }
      assinaturas: {
        Row: {
          categoria_profissional: string
          certificado_info: Json | null
          conselho_uf: string | null
          created_at: string
          documento_id: string
          documento_ref: Json
          documento_tipo: string
          hash_documento: string
          id: string
          metodo: string
          nome_profissional: string
          numero_conselho: string | null
          usuario_id: string
        }
        Insert: {
          categoria_profissional: string
          certificado_info?: Json | null
          conselho_uf?: string | null
          created_at?: string
          documento_id: string
          documento_ref?: Json
          documento_tipo: string
          hash_documento: string
          id?: string
          metodo?: string
          nome_profissional: string
          numero_conselho?: string | null
          usuario_id: string
        }
        Update: {
          categoria_profissional?: string
          certificado_info?: Json | null
          conselho_uf?: string | null
          created_at?: string
          documento_id?: string
          documento_ref?: Json
          documento_tipo?: string
          hash_documento?: string
          id?: string
          metodo?: string
          nome_profissional?: string
          numero_conselho?: string | null
          usuario_id?: string
        }
        Relationships: []
      }
      auditoria_prontuario: {
        Row: {
          acao: string
          created_at: string
          detalhes: Json
          entidade: string
          entidade_id: string | null
          equipamento: string | null
          id: string
          ip: string | null
          residente_id: string | null
          user_id: string | null
          user_nome: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          detalhes?: Json
          entidade: string
          entidade_id?: string | null
          equipamento?: string | null
          id?: string
          ip?: string | null
          residente_id?: string | null
          user_id?: string | null
          user_nome?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          detalhes?: Json
          entidade?: string
          entidade_id?: string | null
          equipamento?: string | null
          id?: string
          ip?: string | null
          residente_id?: string | null
          user_id?: string | null
          user_nome?: string | null
        }
        Relationships: []
      }
      categorias_profissionais: {
        Row: {
          ativo: boolean
          chave: string
          created_at: string
          icone: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          chave: string
          created_at?: string
          icone?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          chave?: string
          created_at?: string
          icone?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      checklist_itens: {
        Row: {
          concluido: boolean
          concluido_em: string | null
          concluido_por: string | null
          data: string
          id: string
          observacoes: string | null
          residente_id: string
          tarefa: string
          turno: Database["public"]["Enums"]["shift"]
        }
        Insert: {
          concluido?: boolean
          concluido_em?: string | null
          concluido_por?: string | null
          data?: string
          id?: string
          observacoes?: string | null
          residente_id: string
          tarefa: string
          turno: Database["public"]["Enums"]["shift"]
        }
        Update: {
          concluido?: boolean
          concluido_em?: string | null
          concluido_por?: string | null
          data?: string
          id?: string
          observacoes?: string | null
          residente_id?: string
          tarefa?: string
          turno?: Database["public"]["Enums"]["shift"]
        }
        Relationships: [
          {
            foreignKeyName: "checklist_itens_residente_id_fkey"
            columns: ["residente_id"]
            isOneToOne: false
            referencedRelation: "residentes"
            referencedColumns: ["id"]
          },
        ]
      }
      config_evolucao: {
        Row: {
          id: boolean
          prazo_edicao_minutos: number
          updated_at: string
        }
        Insert: {
          id?: boolean
          prazo_edicao_minutos?: number
          updated_at?: string
        }
        Update: {
          id?: boolean
          prazo_edicao_minutos?: number
          updated_at?: string
        }
        Relationships: []
      }
      diagnosticos_enfermagem: {
        Row: {
          ano: number
          assinatura_enfermeira: string | null
          created_at: string
          diagnosticos: string[]
          id: string
          mes: number
          outros_texto: string | null
          residente_id: string
          updated_at: string
        }
        Insert: {
          ano: number
          assinatura_enfermeira?: string | null
          created_at?: string
          diagnosticos?: string[]
          id?: string
          mes: number
          outros_texto?: string | null
          residente_id: string
          updated_at?: string
        }
        Update: {
          ano?: number
          assinatura_enfermeira?: string | null
          created_at?: string
          diagnosticos?: string[]
          id?: string
          mes?: number
          outros_texto?: string | null
          residente_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnosticos_enfermagem_residente_id_fkey"
            columns: ["residente_id"]
            isOneToOne: false
            referencedRelation: "residentes"
            referencedColumns: ["id"]
          },
        ]
      }
      evolucoes_multi: {
        Row: {
          anexos: Json
          assinatura: string | null
          autor_id: string
          autor_nome: string
          categoria: string
          conselho_numero: string | null
          created_at: string
          editado_em: string | null
          id: string
          residente_id: string
          texto: string
          updated_at: string
        }
        Insert: {
          anexos?: Json
          assinatura?: string | null
          autor_id: string
          autor_nome?: string
          categoria: string
          conselho_numero?: string | null
          created_at?: string
          editado_em?: string | null
          id?: string
          residente_id: string
          texto: string
          updated_at?: string
        }
        Update: {
          anexos?: Json
          assinatura?: string | null
          autor_id?: string
          autor_nome?: string
          categoria?: string
          conselho_numero?: string | null
          created_at?: string
          editado_em?: string | null
          id?: string
          residente_id?: string
          texto?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evolucoes_multi_residente_id_fkey"
            columns: ["residente_id"]
            isOneToOne: false
            referencedRelation: "residentes"
            referencedColumns: ["id"]
          },
        ]
      }
      familia_residente: {
        Row: {
          id: string
          parentesco: string | null
          residente_id: string
          user_id: string
        }
        Insert: {
          id?: string
          parentesco?: string | null
          residente_id: string
          user_id: string
        }
        Update: {
          id?: string
          parentesco?: string | null
          residente_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "familia_residente_residente_id_fkey"
            columns: ["residente_id"]
            isOneToOne: false
            referencedRelation: "residentes"
            referencedColumns: ["id"]
          },
        ]
      }
      incidentes: {
        Row: {
          acao_tomada: string | null
          descricao: string
          id: string
          ocorrido_em: string
          registrado_por: string | null
          residente_id: string
          resolvido: boolean
          severidade: Database["public"]["Enums"]["incident_severity"]
          tipo: string
        }
        Insert: {
          acao_tomada?: string | null
          descricao: string
          id?: string
          ocorrido_em?: string
          registrado_por?: string | null
          residente_id: string
          resolvido?: boolean
          severidade?: Database["public"]["Enums"]["incident_severity"]
          tipo: string
        }
        Update: {
          acao_tomada?: string | null
          descricao?: string
          id?: string
          ocorrido_em?: string
          registrado_por?: string | null
          residente_id?: string
          resolvido?: boolean
          severidade?: Database["public"]["Enums"]["incident_severity"]
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidentes_residente_id_fkey"
            columns: ["residente_id"]
            isOneToOne: false
            referencedRelation: "residentes"
            referencedColumns: ["id"]
          },
        ]
      }
      medicamentos: {
        Row: {
          ativo: boolean
          created_at: string
          dias_do_mes: Json
          dias_semana: string[]
          dosagem: string
          horarios: string[]
          id: string
          nome: string
          numero: number | null
          observacoes: string | null
          prescricao_id: string | null
          residente_id: string
          via: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          dias_do_mes?: Json
          dias_semana?: string[]
          dosagem: string
          horarios?: string[]
          id?: string
          nome: string
          numero?: number | null
          observacoes?: string | null
          prescricao_id?: string | null
          residente_id: string
          via?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          dias_do_mes?: Json
          dias_semana?: string[]
          dosagem?: string
          horarios?: string[]
          id?: string
          nome?: string
          numero?: number | null
          observacoes?: string | null
          prescricao_id?: string | null
          residente_id?: string
          via?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medicamentos_prescricao_id_fkey"
            columns: ["prescricao_id"]
            isOneToOne: false
            referencedRelation: "prescricoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicamentos_residente_id_fkey"
            columns: ["residente_id"]
            isOneToOne: false
            referencedRelation: "residentes"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_cuidados: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string
          id: string
          numero: number
          residente_id: string | null
          turnos_aplicaveis: Database["public"]["Enums"]["shift"][]
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao: string
          id?: string
          numero: number
          residente_id?: string | null
          turnos_aplicaveis?: Database["public"]["Enums"]["shift"][]
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string
          id?: string
          numero?: number
          residente_id?: string | null
          turnos_aplicaveis?: Database["public"]["Enums"]["shift"][]
        }
        Relationships: [
          {
            foreignKeyName: "plano_cuidados_residente_id_fkey"
            columns: ["residente_id"]
            isOneToOne: false
            referencedRelation: "residentes"
            referencedColumns: ["id"]
          },
        ]
      }
      prescricoes: {
        Row: {
          alergias: string | null
          andar: string | null
          ano: number
          created_at: string
          crm: string | null
          hd: string | null
          id: string
          medico_nome: string | null
          mes: number
          residente_id: string
          updated_at: string
        }
        Insert: {
          alergias?: string | null
          andar?: string | null
          ano: number
          created_at?: string
          crm?: string | null
          hd?: string | null
          id?: string
          medico_nome?: string | null
          mes: number
          residente_id: string
          updated_at?: string
        }
        Update: {
          alergias?: string | null
          andar?: string | null
          ano?: number
          created_at?: string
          crm?: string | null
          hd?: string | null
          id?: string
          medico_nome?: string | null
          mes?: number
          residente_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescricoes_residente_id_fkey"
            columns: ["residente_id"]
            isOneToOne: false
            referencedRelation: "residentes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          aprovado: boolean
          aprovado_em: string | null
          aprovado_por: string | null
          categoria_assinatura: string | null
          celular: string | null
          conselho_uf: string | null
          created_at: string
          email: string | null
          full_name: string
          funcao: string | null
          id: string
          pin_hash: string | null
          registro_profissional: string | null
          status_aprovacao: string
        }
        Insert: {
          aprovado?: boolean
          aprovado_em?: string | null
          aprovado_por?: string | null
          categoria_assinatura?: string | null
          celular?: string | null
          conselho_uf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          funcao?: string | null
          id: string
          pin_hash?: string | null
          registro_profissional?: string | null
          status_aprovacao?: string
        }
        Update: {
          aprovado?: boolean
          aprovado_em?: string | null
          aprovado_por?: string | null
          categoria_assinatura?: string | null
          celular?: string | null
          conselho_uf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          funcao?: string | null
          id?: string
          pin_hash?: string | null
          registro_profissional?: string | null
          status_aprovacao?: string
        }
        Relationships: []
      }
      quartos: {
        Row: {
          ala: string | null
          capacidade: number
          created_at: string
          id: string
          numero: string
          observacoes: string | null
          status: Database["public"]["Enums"]["room_status"]
        }
        Insert: {
          ala?: string | null
          capacidade?: number
          created_at?: string
          id?: string
          numero: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["room_status"]
        }
        Update: {
          ala?: string | null
          capacidade?: number
          created_at?: string
          id?: string
          numero?: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["room_status"]
        }
        Relationships: []
      }
      recebimentos_fraldas: {
        Row: {
          criado_em: string
          data_entrega: string
          forma_entrega: Database["public"]["Enums"]["forma_entrega_fralda"]
          id: string
          marca: string
          nome_familiar: string | null
          nome_fornecedor: string | null
          observacoes: string | null
          origem_correios:
            | Database["public"]["Enums"]["origem_correios_fralda"]
            | null
          quantidade_fardos: number
          recebido_por: string
          registrado_por: string | null
          residente_id: string
          tipo: Database["public"]["Enums"]["tipo_fralda"]
          total_unidades: number | null
          unidades_por_fardo: number
        }
        Insert: {
          criado_em?: string
          data_entrega?: string
          forma_entrega: Database["public"]["Enums"]["forma_entrega_fralda"]
          id?: string
          marca: string
          nome_familiar?: string | null
          nome_fornecedor?: string | null
          observacoes?: string | null
          origem_correios?:
            | Database["public"]["Enums"]["origem_correios_fralda"]
            | null
          quantidade_fardos?: number
          recebido_por: string
          registrado_por?: string | null
          residente_id: string
          tipo: Database["public"]["Enums"]["tipo_fralda"]
          total_unidades?: number | null
          unidades_por_fardo?: number
        }
        Update: {
          criado_em?: string
          data_entrega?: string
          forma_entrega?: Database["public"]["Enums"]["forma_entrega_fralda"]
          id?: string
          marca?: string
          nome_familiar?: string | null
          nome_fornecedor?: string | null
          observacoes?: string | null
          origem_correios?:
            | Database["public"]["Enums"]["origem_correios_fralda"]
            | null
          quantidade_fardos?: number
          recebido_por?: string
          registrado_por?: string | null
          residente_id?: string
          tipo?: Database["public"]["Enums"]["tipo_fralda"]
          total_unidades?: number | null
          unidades_por_fardo?: number
        }
        Relationships: [
          {
            foreignKeyName: "recebimentos_fraldas_residente_id_fkey"
            columns: ["residente_id"]
            isOneToOne: false
            referencedRelation: "residentes"
            referencedColumns: ["id"]
          },
        ]
      }
      registros_cuidados: {
        Row: {
          created_at: string
          cuidado_id: string
          data: string
          feito_em: string
          id: string
          observacao: string | null
          residente_id: string
          responsavel_id: string | null
          responsavel_nome: string | null
          turno: Database["public"]["Enums"]["shift"]
        }
        Insert: {
          created_at?: string
          cuidado_id: string
          data: string
          feito_em?: string
          id?: string
          observacao?: string | null
          residente_id: string
          responsavel_id?: string | null
          responsavel_nome?: string | null
          turno: Database["public"]["Enums"]["shift"]
        }
        Update: {
          created_at?: string
          cuidado_id?: string
          data?: string
          feito_em?: string
          id?: string
          observacao?: string | null
          residente_id?: string
          responsavel_id?: string | null
          responsavel_nome?: string | null
          turno?: Database["public"]["Enums"]["shift"]
        }
        Relationships: [
          {
            foreignKeyName: "registros_cuidados_cuidado_id_fkey"
            columns: ["cuidado_id"]
            isOneToOne: false
            referencedRelation: "plano_cuidados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_cuidados_residente_id_fkey"
            columns: ["residente_id"]
            isOneToOne: false
            referencedRelation: "residentes"
            referencedColumns: ["id"]
          },
        ]
      }
      residentes: {
        Row: {
          alergias: string | null
          ativo: boolean
          contato_emergencia_nome: string | null
          contato_emergencia_telefone: string | null
          contatos: string | null
          convenio: string | null
          cpf: string | null
          created_at: string
          data_admissao: string | null
          data_nascimento: string | null
          dieta: string | null
          endereco_bairro: string | null
          endereco_cep: string | null
          endereco_cidade: string | null
          endereco_complemento: string | null
          endereco_estado: string | null
          endereco_logradouro: string | null
          endereco_numero: string | null
          foto_url: string | null
          historico_medico: string | null
          id: string
          nome_completo: string
          observacoes: string | null
          quarto_id: string | null
          rg: string | null
          status: Database["public"]["Enums"]["resident_status"]
        }
        Insert: {
          alergias?: string | null
          ativo?: boolean
          contato_emergencia_nome?: string | null
          contato_emergencia_telefone?: string | null
          contatos?: string | null
          convenio?: string | null
          cpf?: string | null
          created_at?: string
          data_admissao?: string | null
          data_nascimento?: string | null
          dieta?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_estado?: string | null
          endereco_logradouro?: string | null
          endereco_numero?: string | null
          foto_url?: string | null
          historico_medico?: string | null
          id?: string
          nome_completo: string
          observacoes?: string | null
          quarto_id?: string | null
          rg?: string | null
          status?: Database["public"]["Enums"]["resident_status"]
        }
        Update: {
          alergias?: string | null
          ativo?: boolean
          contato_emergencia_nome?: string | null
          contato_emergencia_telefone?: string | null
          contatos?: string | null
          convenio?: string | null
          cpf?: string | null
          created_at?: string
          data_admissao?: string | null
          data_nascimento?: string | null
          dieta?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_estado?: string | null
          endereco_logradouro?: string | null
          endereco_numero?: string | null
          foto_url?: string | null
          historico_medico?: string | null
          id?: string
          nome_completo?: string
          observacoes?: string | null
          quarto_id?: string | null
          rg?: string | null
          status?: Database["public"]["Enums"]["resident_status"]
        }
        Relationships: [
          {
            foreignKeyName: "residentes_quarto_id_fkey"
            columns: ["quarto_id"]
            isOneToOne: false
            referencedRelation: "quartos"
            referencedColumns: ["id"]
          },
        ]
      }
      sae_registros: {
        Row: {
          assinatura: string | null
          autor_id: string
          autor_nome: string
          autor_registro: string | null
          created_at: string
          data: string
          evolucao: string | null
          id: string
          motivo_retificacao: string | null
          residente_id: string
          retifica_id: string | null
          secoes: Json
          turno: Database["public"]["Enums"]["shift"]
          updated_at: string
        }
        Insert: {
          assinatura?: string | null
          autor_id: string
          autor_nome: string
          autor_registro?: string | null
          created_at?: string
          data?: string
          evolucao?: string | null
          id?: string
          motivo_retificacao?: string | null
          residente_id: string
          retifica_id?: string | null
          secoes?: Json
          turno: Database["public"]["Enums"]["shift"]
          updated_at?: string
        }
        Update: {
          assinatura?: string | null
          autor_id?: string
          autor_nome?: string
          autor_registro?: string | null
          created_at?: string
          data?: string
          evolucao?: string | null
          id?: string
          motivo_retificacao?: string | null
          residente_id?: string
          retifica_id?: string | null
          secoes?: Json
          turno?: Database["public"]["Enums"]["shift"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sae_registros_residente_id_fkey"
            columns: ["residente_id"]
            isOneToOne: false
            referencedRelation: "residentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sae_registros_retifica_id_fkey"
            columns: ["retifica_id"]
            isOneToOne: false
            referencedRelation: "sae_registros"
            referencedColumns: ["id"]
          },
        ]
      }
      sinais_vitais: {
        Row: {
          frequencia_cardiaca: number | null
          glicemia: number | null
          id: string
          observacoes: string | null
          peso: number | null
          pressao_diastolica: number | null
          pressao_sistolica: number | null
          registrado_em: string
          registrado_por: string | null
          residente_id: string
          saturacao: number | null
          temperatura: number | null
        }
        Insert: {
          frequencia_cardiaca?: number | null
          glicemia?: number | null
          id?: string
          observacoes?: string | null
          peso?: number | null
          pressao_diastolica?: number | null
          pressao_sistolica?: number | null
          registrado_em?: string
          registrado_por?: string | null
          residente_id: string
          saturacao?: number | null
          temperatura?: number | null
        }
        Update: {
          frequencia_cardiaca?: number | null
          glicemia?: number | null
          id?: string
          observacoes?: string | null
          peso?: number | null
          pressao_diastolica?: number | null
          pressao_sistolica?: number | null
          registrado_em?: string
          registrado_por?: string | null
          residente_id?: string
          saturacao?: number | null
          temperatura?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sinais_vitais_residente_id_fkey"
            columns: ["residente_id"]
            isOneToOne: false
            referencedRelation: "residentes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      alterar_senha_painel: {
        Args: { _atual: string; _nova: string }
        Returns: boolean
      }
      definir_admin: {
        Args: {
          _equipamento?: string
          _ip?: string
          _tornar: boolean
          _user_id: string
        }
        Returns: boolean
      }
      definir_pin_assinatura: { Args: { _pin: string }; Returns: boolean }
      listar_profissionais: {
        Args: never
        Returns: {
          aprovado: boolean
          celular: string
          created_at: string
          email: string
          full_name: string
          funcao: string
          id: string
          registro_profissional: string
          roles: string[]
          status_aprovacao: string
        }[]
      }
      redefinir_senha_painel: { Args: { _nova: string }; Returns: boolean }
      registrar_assinatura: {
        Args: {
          _documento_id: string
          _documento_ref?: Json
          _documento_tipo: string
          _hash: string
          _metodo?: string
          _pin?: string
        }
        Returns: string
      }
      tenho_pin_assinatura: { Args: never; Returns: boolean }
      verificar_senha_painel: { Args: { _senha: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "gerente"
        | "enfermeiro"
        | "cuidador"
        | "familia"
        | "multiprofissional"
      forma_entrega_fralda: "familiar" | "fornecedor" | "correios"
      incident_severity: "leve" | "moderado" | "grave"
      origem_correios_fralda: "governo" | "outros"
      resident_status: "estavel" | "observacao" | "critico"
      room_status: "ocupado" | "vago" | "manutencao"
      shift: "manha" | "tarde" | "noite"
      tipo_fralda: "tradicional" | "calcinha_pant" | "absorvente"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "gerente",
        "enfermeiro",
        "cuidador",
        "familia",
        "multiprofissional",
      ],
      forma_entrega_fralda: ["familiar", "fornecedor", "correios"],
      incident_severity: ["leve", "moderado", "grave"],
      origem_correios_fralda: ["governo", "outros"],
      resident_status: ["estavel", "observacao", "critico"],
      room_status: ["ocupado", "vago", "manutencao"],
      shift: ["manha", "tarde", "noite"],
      tipo_fralda: ["tradicional", "calcinha_pant", "absorvente"],
    },
  },
} as const
