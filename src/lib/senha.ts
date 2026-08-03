export type RegraSenha = { label: string; ok: boolean };

export function regrasSenha(senha: string): RegraSenha[] {
  return [
    { label: "Pelo menos 8 caracteres", ok: senha.length >= 8 },
    { label: "Uma letra maiúscula", ok: /[A-ZÀ-Þ]/.test(senha) },
    { label: "Uma letra minúscula", ok: /[a-zà-þ]/.test(senha) },
    { label: "Um número", ok: /[0-9]/.test(senha) },
    { label: "Um símbolo (ex.: ! @ # $)", ok: /[^A-Za-zÀ-þ0-9]/.test(senha) },
  ];
}

export function senhaValida(senha: string): boolean {
  return regrasSenha(senha).every((r) => r.ok);
}

export function forcaSenha(senha: string): { nivel: "fraca" | "media" | "forte"; pontos: number } {
  const ok = regrasSenha(senha).filter((r) => r.ok).length;
  const bonus = senha.length >= 12 ? 1 : 0;
  const pontos = Math.min(ok + bonus, 6);
  if (pontos <= 2) return { nivel: "fraca", pontos };
  if (pontos <= 4) return { nivel: "media", pontos };
  return { nivel: "forte", pontos };
}
