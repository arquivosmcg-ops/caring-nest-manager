import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function sql(query: string) {
  return execFileSync("psql", ["-X", "-v", "ON_ERROR_STOP=1", "-Atc", query], { encoding: "utf8" });
}

describe("Cadastro de residentes por Outros", () => {
  it("possui políticas de inclusão e correção sem acesso anônimo", () => {
    const output = sql(`SELECT cmd, roles, coalesce(qual,''), with_check FROM pg_policies
      WHERE schemaname='public' AND policyname IN ('residentes_outros_insert','residentes_outros_update') ORDER BY cmd`);
    expect(output).toContain("INSERT|{authenticated}||private.pode_cadastrar_residente(auth.uid())");
    expect(output).toContain("UPDATE|{authenticated}|private.pode_cadastrar_residente(auth.uid())|private.pode_cadastrar_residente(auth.uid())");
  });

  it("Outros não ganha permissão de excluir residentes", () => {
    const output = sql(`SELECT cmd, qual FROM pg_policies WHERE schemaname='public'
      AND tablename='residentes' AND cmd IN ('DELETE','ALL')`);
    expect(output.trim()).toBe("ALL|private.is_staff(auth.uid())");
  });

  it("autorização exige perfil Outros aprovado e papel multiprofissional do próprio usuário", () => {
    const output = sql(`SELECT pg_get_functiondef('private.pode_cadastrar_residente(uuid)'::regprocedure)`);
    expect(output).toContain("_user_id = auth.uid()");
    expect(output).toContain("p.funcao = 'outro'");
    expect(output).toContain("p.status_aprovacao = 'aprovado'");
    expect(output).toContain("private.is_multiprofissional(_user_id)");
  });

  it("foto exige a mesma autorização e permanece no bucket de residentes", () => {
    const output = sql(`SELECT cmd || ':' || with_check FROM pg_policies
      WHERE schemaname='storage' AND policyname IN
        ('residentes_fotos_outros_insert','residentes_fotos_outros_update') ORDER BY cmd`);
    const rows = output.trim().split("\n");
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row).toContain("bucket_id = 'residentes-fotos'");
      expect(row).toContain("private.pode_cadastrar_residente(auth.uid())");
    }
  });
});