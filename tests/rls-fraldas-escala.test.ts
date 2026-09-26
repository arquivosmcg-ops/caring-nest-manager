/**
 * Testes das regras de acesso:
 *  - visitantes (não logados) consultam produtos de fraldas, mas não alteram;
 *  - só administradores alteram produtos de fraldas;
 *  - dados da escala restritos por função (próprio registro, admin ou gerente).
 * Executar: bunx vitest run tests/rls-fraldas-escala.test.ts
 * As verificações de políticas usam psql (variáveis PG* do ambiente).
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function env(name: string): string {
  if (process.env[name]) return process.env[name]!;
  const m = readFileSync(".env", "utf8").match(new RegExp(`^${name}="?([^"\\n]+)"?`, "m"));
  if (!m) throw new Error(`${name} ausente`);
  return m[1];
}
const URL = env("VITE_SUPABASE_URL");
const KEY = env("VITE_SUPABASE_PUBLISHABLE_KEY");
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

type Pol = { cmd: string; roles: string; qual: string; check: string };
function politicas(tabela: string): Pol[] {
  const out = execSync(
    `psql -At -F '|~|' -c "select cmd, roles::text, coalesce(qual,''), coalesce(with_check,'') from pg_policies where schemaname='public' and tablename='${tabela}'"`,
    { encoding: "utf8" },
  );
  return out.trim().split("\n").filter(Boolean).map((l) => {
    const [cmd, roles, qual, check] = l.split("|~|");
    return { cmd, roles, qual, check };
  });
}
const ADMIN = /has_role\(auth\.uid\(\), 'admin'::app_role\)/;
const ADMIN_GERENTE = /admin.*gerente|gerente.*admin/s;

describe("Produtos de fraldas — visitante", () => {
  it("consegue consultar a lista", async () => {
    const r = await fetch(`${URL}/rest/v1/produtos_fraldas?select=id,nome_produto`, { headers });
    expect(r.status).toBe(200);
    expect(Array.isArray(await r.json())).toBe(true);
  });
  it("não consegue inserir", async () => {
    const r = await fetch(`${URL}/rest/v1/produtos_fraldas`, {
      method: "POST", headers,
      body: JSON.stringify({ nome_produto: "TESTE", unidades_padrao_por_pacote: 1, tipo_sugerido: "tradicional" }),
    });
    expect(r.ok).toBe(false);
  });
  it("não consegue alterar nem excluir", async () => {
    const h = { ...headers, Prefer: "return=representation" };
    const up = await fetch(`${URL}/rest/v1/produtos_fraldas?id=not.is.null`, {
      method: "PATCH", headers: h, body: JSON.stringify({ ordem: 999 }),
    });
    if (up.ok) expect(await up.json()).toEqual([]); else expect(up.ok).toBe(false);
    const del = await fetch(`${URL}/rest/v1/produtos_fraldas?id=not.is.null`, { method: "DELETE", headers: h });
    if (del.ok) expect(await del.json()).toEqual([]); else expect(del.ok).toBe(false);
  });
});

describe("Produtos de fraldas — só administradores alteram", () => {
  const pols = politicas("produtos_fraldas");
  it("leitura livre para visitantes e equipe", () => {
    const sel = pols.filter((p) => p.cmd === "SELECT");
    expect(sel.some((p) => p.roles.includes("anon") && p.qual === "true")).toBe(true);
  });
  it.each(["INSERT", "UPDATE", "DELETE"])("%s exige administrador", (cmd) => {
    const ps = pols.filter((p) => p.cmd === cmd || p.cmd === "ALL");
    expect(ps.length).toBeGreaterThan(0);
    for (const p of ps) {
      expect(p.roles).not.toContain("anon");
      expect(`${p.qual} ${p.check}`).toMatch(ADMIN);
    }
  });
});

describe("Escala — restrita por função", () => {
  it.each(["escala_turnos", "escala_afastamentos", "escala_config", "escala_historico"])(
    "visitante não lê %s", async (t) => {
      const r = await fetch(`${URL}/rest/v1/${t}?select=*&limit=1`, { headers });
      if (r.ok) expect(await r.json()).toEqual([]); else expect(r.ok).toBe(false);
    },
  );
  it.each(["escala_turnos", "escala_afastamentos"])("%s: vê só o próprio, admin ou gerente", (t) => {
    const pols = politicas(t);
    for (const p of pols) {
      expect(p.roles).not.toContain("anon");
      if (p.cmd === "SELECT") {
        expect(p.qual).toContain("colaborador_id = auth.uid()");
        expect(p.qual).toMatch(ADMIN_GERENTE);
      } else {
        expect(`${p.qual} ${p.check}`).toMatch(ADMIN_GERENTE);
        expect(p.qual).not.toContain("colaborador_id");
      }
    }
  });
  it("escala_config: só admin ou gerente", () => {
    for (const p of politicas("escala_config")) {
      expect(p.roles).not.toContain("anon");
      expect(`${p.qual} ${p.check}`).toMatch(ADMIN_GERENTE);
      expect(p.qual).not.toBe("true");
    }
  });
  it("escala_historico: grava só em nome próprio; lê próprio, admin ou gerente", () => {
    const pols = politicas("escala_historico");
    expect(pols.find((p) => p.cmd === "INSERT")?.check).toContain("auth.uid() = user_id");
    const sel = pols.find((p) => p.cmd === "SELECT")!;
    expect(sel.qual).toContain("user_id = auth.uid()");
    expect(sel.qual).toMatch(ADMIN_GERENTE);
    expect(pols.some((p) => ["UPDATE", "DELETE", "ALL"].includes(p.cmd))).toBe(false);
  });
});
