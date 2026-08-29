import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CertificadoCadastrado } from "@/lib/certificado-icp";

/** Certificado digital ICP-Brasil cadastrado pelo profissional logado (apenas metadados). */
export function useCertificadoAtual() {
  return useQuery<CertificadoCadastrado | null>({
    queryKey: ["certificado-digital"],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;
      const { data, error } = await supabase
        .from("certificados_digitais" as never)
        .select("*")
        .eq("usuario_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return (data as CertificadoCadastrado | null) ?? null;
    },
  });
}
