export function quartoOcupado(status: string, ocupantes: number): boolean {
  return status === "ocupado" || ocupantes > 0;
}