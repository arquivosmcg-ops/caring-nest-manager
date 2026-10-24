import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function sql(query: string) {
  return execFileSync("psql", ["-X", "-v", "ON_ERROR_STOP=1", "-Atc", query], { encoding: "utf8" });
}

function asOther(approved: boolean, action: string) {
  // Every change (including the test resident and profile status) is rolled back.
  return sql(`BEGIN;
    CREATE TEMP TABLE test_actor AS SELECT p.id FROM public.profiles p
      JOIN public.user_roles r ON r.user_id = p.id
      WHERE p.funcao = 'outro' AND p.status_aprovacao = 'aprovado'
        AND r.role = 'multiprofissional' LIMIT 1;
    DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM test_actor) THEN
      RAISE EXCEPTION 'Missing approved Other professional fixture'; END IF; END $$;
    ${approved ? "" : "UPDATE public.profiles SET status_aprovacao = 'pendente' WHERE id = (SELECT id FROM test_actor);"}
    SELECT set_config('request.jwt.claim.sub', (SELECT id::text FROM test_actor), true);
    SET LOCAL ROLE authenticated;
    ${action}
    ROLLBACK;`);
}

describe("Cadastro de residentes por Outros", () => {
  it("aprovado consegue inserir e corrigir residente com quarto", () => {
    const output = asOther(true, `
      INSERT INTO public.residentes (id,nome_completo,quarto_id)
      VALUES ('00000000-0000-4000-8000-000000000095','Teste temporário Outros',
        (SELECT id FROM public.quartos WHERE status <> 'manutencao' LIMIT 1));
      UPDATE public.residentes SET nome_completo = 'Teste corrigido Outros'
      WHERE id = '00000000-0000-4000-8000-000000000095';
      SELECT nome_completo FROM public.residentes
      WHERE id = '00000000-0000-4000-8000-000000000095';`);
    expect(output).toContain("Teste corrigido Outros");
  });

  it("aprovado não ganha permissão de excluir residentes", () => {
    const output = asOther(true, `
      INSERT INTO public.residentes (id,nome_completo)
      VALUES ('00000000-0000-4000-8000-000000000096','Teste sem exclusão');
      DELETE FROM public.residentes WHERE id = '00000000-0000-4000-8000-000000000096';
      SELECT count(*) AS preservado FROM public.residentes
      WHERE id = '00000000-0000-4000-8000-000000000096';`);
    expect(output).toMatch(/DELETE 0\n1/);
  });

  it("Outros ainda pendente não recebe acesso ao cadastro", () => {
    expect(asOther(false, "SELECT private.pode_cadastrar_residente(auth.uid());")).toMatch(/\nf\n/);
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