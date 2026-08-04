import {
  Activity,
  Apple,
  Brain,
  Dumbbell,
  Ear,
  HandHelping,
  Pill,
  Stethoscope,
  Users,
  type LucideIcon,
} from "lucide-react";

export const ICONES_CATEGORIA: Record<string, LucideIcon> = {
  activity: Activity,
  brain: Brain,
  apple: Apple,
  users: Users,
  ear: Ear,
  "hand-helping": HandHelping,
  dumbbell: Dumbbell,
  pill: Pill,
  stethoscope: Stethoscope,
};

export function iconeDaCategoria(icone?: string | null): LucideIcon {
  return ICONES_CATEGORIA[icone ?? "stethoscope"] ?? Stethoscope;
}

export function idadeEmAnos(dataNascimento?: string | null): string {
  if (!dataNascimento) return "—";
  const n = new Date(dataNascimento);
  if (Number.isNaN(n.getTime())) return "—";
  const hoje = new Date();
  let anos = hoje.getFullYear() - n.getFullYear();
  const m = hoje.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < n.getDate())) anos--;
  return `${anos} anos`;
}

export function numeroProntuario(id?: string | null): string {
  if (!id) return "—";
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}
