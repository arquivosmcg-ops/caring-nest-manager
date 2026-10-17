import { describe, expect, it } from "vitest";
import { quartoOcupado } from "../src/lib/quartos";

describe("Aviso de quarto ocupado", () => {
  it("avisa para um quarto marcado como ocupado", () => {
    expect(quartoOcupado("ocupado", 0)).toBe(true);
  });
  it("avisa quando há residente ativo mesmo se o status está vago", () => {
    expect(quartoOcupado("vago", 1)).toBe(true);
  });
  it("exibe como vago um quarto sem ocupantes e com status vago", () => {
    expect(quartoOcupado("vago", 0)).toBe(false);
  });
});