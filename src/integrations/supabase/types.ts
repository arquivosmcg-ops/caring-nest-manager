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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
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
          dosagem: string
          horarios: string[]
          id: string
          nome: string
          observacoes: string | null
          residente_id: string
          via: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          dosagem: string
          horarios?: string[]
          id?: string
          nome: string
          observacoes?: string | null
          residente_id: string
          via?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          dosagem?: string
          horarios?: string[]
          id?: string
          nome?: string
          observacoes?: string | null
          residente_id?: string
          via?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medicamentos_residente_id_fkey"
            columns: ["residente_id"]
            isOneToOne: false
            referencedRelation: "residentes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
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
      residentes: {
        Row: {
          alergias: string | null
          ativo: boolean
          contato_emergencia_nome: string | null
          contato_emergencia_telefone: string | null
          created_at: string
          data_nascimento: string | null
          dieta: string | null
          foto_url: string | null
          historico_medico: string | null
          id: string
          nome_completo: string
          quarto_id: string | null
          status: Database["public"]["Enums"]["resident_status"]
        }
        Insert: {
          alergias?: string | null
          ativo?: boolean
          contato_emergencia_nome?: string | null
          contato_emergencia_telefone?: string | null
          created_at?: string
          data_nascimento?: string | null
          dieta?: string | null
          foto_url?: string | null
          historico_medico?: string | null
          id?: string
          nome_completo: string
          quarto_id?: string | null
          status?: Database["public"]["Enums"]["resident_status"]
        }
        Update: {
          alergias?: string | null
          ativo?: boolean
          contato_emergencia_nome?: string | null
          contato_emergencia_telefone?: string | null
          created_at?: string
          data_nascimento?: string | null
          dieta?: string | null
          foto_url?: string | null
          historico_medico?: string | null
          id?: string
          nome_completo?: string
          quarto_id?: string | null
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
      [_ in never]: never
    }
    Enums: {
      app_role: "admin" | "gerente" | "enfermeiro" | "cuidador" | "familia"
      incident_severity: "leve" | "moderado" | "grave"
      resident_status: "estavel" | "observacao" | "critico"
      room_status: "ocupado" | "vago" | "manutencao"
      shift: "manha" | "tarde" | "noite"
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
      app_role: ["admin", "gerente", "enfermeiro", "cuidador", "familia"],
      incident_severity: ["leve", "moderado", "grave"],
      resident_status: ["estavel", "observacao", "critico"],
      room_status: ["ocupado", "vago", "manutencao"],
      shift: ["manha", "tarde", "noite"],
    },
  },
} as const
