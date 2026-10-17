import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function check(body: string) {
  return execFileSync("psql", ["-X", "-At", "-v", "ON_ERROR_STOP=1"], {
    encoding: "utf8",
    input: `BEGIN;
      CREATE TEMP TABLE teste_visita AS SELECT gen_random_uuid() visita, gen_random_uuid() visitante;
      INSERT INTO public.visitantes(id,nome,documento) SELECT visitante,'Teste correção','original' FROM teste_visita;
      INSERT INTO public.visitas(id,visitante_id,data,horario_entrada,ciente_normas)
        SELECT visita,visitante,current_date,now(),true FROM teste_visita;
      SELECT set_config('request.jwt.claim.sub', (SELECT user_id::text FROM public.user_roles WHERE role='admin' LIMIT 1),true);
      ${body}
      ROLLBACK;`,
  });
}

describe("Correção de visitas em andamento", () => {
  it("corrige dados e residentes sem registrar saída nem alterar a identidade anterior", () => {
    const result = check(`
      SELECT public.corrigir_visita_em_andamento((SELECT visita FROM teste_visita),
        jsonb_build_object('nome','Nome corrigido','documento','corrigido','data',current_date,
          'horario_entrada',now(),'ciente_normas',true,'observacoes','Correção teste'),
        ARRAY[(SELECT id FROM public.residentes LIMIT 1)]);
      SELECT (v.horario_saida IS NULL AND v.observacoes='Correção teste'
        AND novo.nome='Nome corrigido' AND antigo.nome='Teste correção'
        AND antigo.documento='original' AND EXISTS(SELECT 1 FROM public.visitas_residentes r WHERE r.visita_id=v.id))
      FROM public.visitas v JOIN teste_visita t ON t.visita=v.id
      JOIN public.visitantes novo ON novo.id=v.visitante_id
      JOIN public.visitantes antigo ON antigo.id=t.visitante;
    `);
    expect(result.split("\n")).toContain("t");
  });

  it("recusa correções quando a visita já foi encerrada", () => {
    const result = check(`
      UPDATE public.visitas SET horario_saida=now() WHERE id=(SELECT visita FROM teste_visita);
      DO $$ BEGIN
        BEGIN
          PERFORM public.corrigir_visita_em_andamento((SELECT visita FROM teste_visita),'{}',ARRAY[]::uuid[]);
          RAISE EXCEPTION 'Teste falhou: visita encerrada foi alterada';
        EXCEPTION WHEN OTHERS THEN
          IF SQLERRM NOT LIKE 'Esta visita já foi encerrada%' THEN RAISE; END IF;
        END;
      END $$;
      SELECT observacoes IS NULL AND horario_saida IS NOT NULL FROM public.visitas WHERE id=(SELECT visita FROM teste_visita);
    `);
    expect(result.split("\n")).toContain("t");
  });
});