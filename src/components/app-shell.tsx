import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  BedDouble,
  Pill,
  Activity,
  AlertTriangle,
  ClipboardCheck,
  ClipboardList,
  FileText,
  ShieldCheck,
  Stethoscope,
  UserCog,
  Cake,
  Package,
  Boxes,
  BadgeCheck,
  DoorOpen,
  FileSignature,
  LogOut,
  Menu,
  CalendarDays,
} from "lucide-react";
import logoAsset from "@/assets/logo_instituto_maior.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { usePerfilAtual } from "@/hooks/use-perfil";
import { AlertasSino } from "@/components/alertas-sino";

const navItems = [
  { to: "/dashboard", label: "Painel Geral", icon: LayoutDashboard, multi: false },
  { to: "/residentes", label: "Residentes", icon: Users, multi: true },
  { to: "/aniversariantes", label: "Aniversariantes do Mês", icon: Cake, multi: true },
  { to: "/prontuario", label: "Prontuário", icon: FileText, multi: true },
  { to: "/evolucao-multi", label: "Evolução Multiprofissional", icon: Stethoscope, multi: true },
  { to: "/sae", label: "SAE", icon: ClipboardList, multi: false },
  { to: "/prescricao-enfermagem", label: "Prescrição de Enfermagem", icon: ClipboardCheck, multi: false },
  { to: "/quartos", label: "Quartos", icon: BedDouble, multi: false },
  { to: "/medicamentos", label: "Prescrição Médica", icon: Pill, multi: false },
  { to: "/receituario", label: "Receituário Médico", icon: FileSignature, multi: false },
  { to: "/sinais-vitais", label: "Sinais Vitais", icon: Activity, multi: false },
  { to: "/escala", label: "Escala de Trabalho", icon: CalendarDays, multi: false },
  { to: "/incidentes", label: "Incidentes", icon: AlertTriangle, multi: false },
  { to: "/checklists", label: "Checklists", icon: ClipboardCheck, multi: false },
  { to: "/recebimento-fraldas", label: "Recebimento de Fraldas", icon: Package, multi: true },
  { to: "/recebimento-itens", label: "Recebimento de Itens e Materiais", icon: Boxes, multi: true },
  { to: "/visitas", label: "Controle de Visitas", icon: DoorOpen, multi: true },
  { to: "/auditoria-assinaturas", label: "Auditoria de Assinaturas", icon: ShieldCheck, multi: true },
  { to: "/perfil", label: "Meu Perfil / Certificado", icon: BadgeCheck, multi: true },

  { to: "/admin-aprovacoes", label: "Área Admin", icon: ShieldCheck, multi: false },
  { to: "/implantacao", label: "Checklist de Implantação", icon: ClipboardCheck, multi: false, adminOnly: true },
  { to: "/admin-usuarios", label: "Gerenciar Administradores", icon: UserCog, multi: false, adminOnly: true },
] as const;




export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const perfil = usePerfilAtual().data;
  const somenteMulti = !!perfil && perfil.isMultiprofissional && !perfil.isEquipeClinica;
  const itensVisiveis = navItems.filter(
    (i) =>
      (somenteMulti ? i.multi : true) &&
      (!("adminOnly" in i && i.adminOnly) || !!perfil?.isAdmin),
  );
  const [profile, setProfile] = useState<{ full_name: string; role: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const [{ data: prof }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", userData.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userData.user.id),
      ]);
      const roleLabels: Record<string, string> = {
        admin: "Administrador",
        gerente: "Gerente de Cuidados",
        enfermeiro: "Enfermeiro(a)",
        cuidador: "Cuidador(a)",
        familia: "Família",
        multiprofissional: "Profissional Multiprofissional",
      };
      const primaryRole = roles?.[0]?.role ?? "cuidador";
      setProfile({
        full_name: prof?.full_name || userData.user.email || "Usuário",
        role: roleLabels[primaryRole] ?? primaryRole,
      });
    })();
  }, []);

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Sessão encerrada");
    navigate({ to: "/auth", replace: true });
  };

  const hour = new Date().getHours();
  const shift = hour < 12 ? "Manhã" : hour < 18 ? "Tarde" : "Noite";
  const shiftRange = hour < 12 ? "06:00 – 12:00" : hour < 18 ? "12:00 – 18:00" : "18:00 – 06:00";

  const currentPage = navItems.find((n) => pathname.startsWith(n.to))?.label ?? "Painel";

  const [menuAberto, setMenuAberto] = useState(false);

  return (
    <div className="flex min-h-screen bg-background text-foreground selection:bg-primary/10">
      {menuAberto && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMenuAberto(false)}
          aria-hidden
        />
      )}
      <aside
        className={cn(
          "w-64 border-r border-border bg-sidebar flex flex-col h-screen z-50",
          "fixed inset-y-0 left-0 transition-transform lg:sticky lg:top-0 lg:translate-x-0",
          menuAberto ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="size-8 bg-white rounded-sm grid place-items-center overflow-hidden border border-border">
              <img src={logoAsset.url} alt="Logo" className="h-5 w-auto object-contain" />
            </div>
            <span className="font-extrabold tracking-tight text-lg">RESIDENCIAL SÃO CAMILO</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {itensVisiveis.map((item) => {
            const active = pathname === item.to || (item.to !== "/dashboard" && pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMenuAberto(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  active
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-black/5 hover:text-foreground"
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 p-2 bg-muted rounded-lg">
            <div className="size-8 rounded-full bg-foreground text-background grid place-items-center text-xs font-bold">
              {profile?.full_name?.charAt(0)?.toUpperCase() ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate">{profile?.full_name ?? "…"}</p>
              <p className="text-[10px] text-muted-foreground truncate">{profile?.role ?? ""}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="text-muted-foreground hover:text-foreground p-1"
              title="Sair"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="min-h-20 border-b border-border bg-surface flex items-center justify-between gap-3 px-4 lg:px-8 py-3 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMenuAberto(true)}
              className="lg:hidden p-2 -ml-2 rounded-md hover:bg-black/5"
              aria-label="Abrir menu"
            >
              <Menu className="size-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base lg:text-xl font-extrabold tracking-tight truncate">{currentPage}</h1>
              <p className="text-[10px] lg:text-xs text-muted-foreground font-medium uppercase tracking-wider mt-0.5 truncate">
                Plantão: {shift} • {shiftRange}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <AlertasSino />
            <button
              onClick={() => toast.error("Alerta de emergência disparado à equipe", { duration: 4000 })}
              className="bg-primary text-primary-foreground px-3 lg:px-6 py-2.5 lg:py-3 rounded-md font-bold text-xs lg:text-sm tracking-wide shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"
            >
              <span className="size-2 bg-primary-foreground rounded-full animate-pulse" />
              <span className="hidden sm:inline">EMERGÊNCIA</span>
              <span className="sm:hidden">SOS</span>
            </button>
          </div>
        </header>


        <div className="p-4 lg:p-8 animate-in-up">{children}</div>
      </main>
    </div>
  );
}
