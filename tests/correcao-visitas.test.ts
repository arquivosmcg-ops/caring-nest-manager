import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function config(name: string) {
  const value = process.env[name] ?? readFileSync(".env", "utf8").match(new RegExp(`^${name}="?([^"\\n]+)`, "m"))?.[1];
  if (!value) throw new Error(`${name} ausente`);
  return value;
}
const session = JSON.parse(config("LOVABLE_BROWSER_SUPABASE_SESSION_JSON"));
const url = config("VITE_SUPABASE_URL");
const headers = { apikey: config("VITE_SUPABASE_PUBLISHABLE_KEY"), Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" };
async function visits(filter: string) {
  const response = await fetch(`${url}/rest/v1/visitas?select=*,visitantes(nome,documento),visitas_residentes(residente_id)&${filter}`, { headers });
  expect(response.status).toBe(200);
  return response.json();
}

describe("Correção de visitas em andamento — conta autenticada", () => {
  it("salva os dados existentes e mantém a visita aberta, os residentes e a recepção", async () => {
    const [before] = await visits("horario_saida=is.null&limit=1");
    expect(before).toBeDefined();
    const response = await fetch(`${url}/rest/v1/rpc/corrigir_visita_em_andamento`, {
      method: "POST", headers, body: JSON.stringify({
        _visita_id: before.id,
        _residentes: before.visitas_residentes.map((r: {residente_id: string}) => r.residente_id),
        _dados: { ...before, nome: before.visitantes.nome, documento: before.visitantes.documento },
      }),
    });
    expect(response.ok).toBe(true);
    const [after] = await visits(`id=eq.${before.id}`);
    expect(after.horario_saida).toBeNull();
    expect(after.recebido_por).toBe(before.recebido_por);
    expect(after.horario_entrada).toBe(before.horario_entrada);
    expect(after.visitantes).toEqual(before.visitantes);
    expect(after.visitas_residentes).toEqual(before.visitas_residentes);
  });

  it("recusa correções quando a visita já foi encerrada", async () => {
    const [before] = await visits("horario_saida=not.is.null&limit=1");
    expect(before).toBeDefined();
    const response = await fetch(`${url}/rest/v1/rpc/corrigir_visita_em_andamento`, {
      method: "POST", headers, body: JSON.stringify({ _visita_id: before.id, _residentes: [], _dados: {} }),
    });
    expect(response.ok).toBe(false);
    expect((await response.json()).message).toContain("Esta visita já foi encerrada");
    const [after] = await visits(`id=eq.${before.id}`);
    expect(after).toEqual(before);
  });
});
