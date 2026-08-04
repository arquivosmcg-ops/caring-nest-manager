import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PerfilAtual = {
  userId: string;
  fullName: string;
  funcao: string | null;
  registroProfissional: string | null;
  roles: string[];
  isMultiprofissional: boolean;
  isAdmin: boolean;
  isEquipeClinica: boolean;
};

export function usePerfilAtual() {
  return useQuery<PerfilAtual | null>({
    queryKey: ["perfil-atual"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;
      const [{ data: prof }, { data: roleRows }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, funcao, registro_profissional")
          .eq("id", user.id)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      const roles = (roleRows ?? []).map((r) => String(r.role));
      const isMultiprofissional = roles.includes("multiprofissional");
      return {
        userId: user.id,
        fullName: prof?.full_name || user.email || "Usuário",
        funcao: prof?.funcao ?? null,
        registroProfissional: prof?.registro_profissional ?? null,
        roles,
        isMultiprofissional,
        isAdmin: roles.includes("admin"),
        isEquipeClinica: roles.some((r) =>
          ["admin", "gerente", "enfermeiro", "cuidador"].includes(r),
        ),
      };
    },
  });
}
