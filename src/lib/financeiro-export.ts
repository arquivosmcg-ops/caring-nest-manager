import { reais, dataBr } from './financeiro';
import { creditoResidente, type FinanceiroDados } from './financeiro-data';

export async function exportarFinanceiro(titulo: string, colunas: string[], linhas: (string | number)[][], formato: 'pdf' | 'xlsx' | 'csv') {
  const nome = titulo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
  if (formato === 'pdf') {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
    const pdf = new jsPDF({ orientation: colunas.length > 6 ? 'landscape' : 'portrait' });
    pdf.setFontSize(15); pdf.text('Residencial São Camilo', 14, 16);
    pdf.setFontSize(11); pdf.text(titulo, 14, 24);
    autoTable(pdf, { startY: 30, head: [colunas], body: linhas, styles: { fontSize: 8 }, theme: 'striped' });
    pdf.save(`${nome}.pdf`); return;
  }
  const XLSX = await import('xlsx');
  const sheet = XLSX.utils.aoa_to_sheet([colunas, ...linhas]);
  if (formato === 'xlsx') { const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, 'Financeiro'); XLSX.writeFile(book, `${nome}.xlsx`); return; }
  const blob = new Blob(['\ufeff' + XLSX.utils.sheet_to_csv(sheet, { FS: ';' })], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${nome}.csv`; link.click(); URL.revokeObjectURL(url);
}
export async function extratoFinanceiro(d: FinanceiroDados, id: string) {
  const residente = d.residentes.find(r => r.id === id); if (!residente) return;
  const linhas: (string | number)[][] = [];
  let total = 0;
  for (const c of d.cobrancas.filter(c => c.residente_id === id)) {
    linhas.push([dataBr(c.emissao), c.descricao, dataBr(c.vencimento), reais(c.valor_centavos + c.ajuste_centavos), reais(c.calculo.multa + c.calculo.juros + c.calculo.correcao), reais(c.calculo.pago), reais(c.calculo.saldo), c.calculo.status]);
    for (const i of d.itens.filter(i => i.cobranca_id === c.id)) linhas.push([dataBr(i.data_consumo), `${i.descricao} (${i.quantidade} ${i.unidade})`, '', reais(i.total_centavos), '', '', '', '']);
    total += c.calculo.saldo;
  }
  for(const p of d.pagamentos.filter(p=>p.residente_id===id))linhas.push([dataBr(p.data),`Pagamento · ${p.forma}`, '', '', '', reais(p.valor_centavos), '', p.estornado?'Estornado':'Confirmado']);
  linhas.push(['', 'Saldo devedor atualizado', dataBr(d.hoje), '', '', '', reais(total), '']);
  linhas.push(['', 'Saldo de crédito', dataBr(d.hoje), '', '', '', reais(creditoResidente(d,id)), '']);
  await exportarFinanceiro(`Demonstrativo — ${residente.nome}`, ['Emissão/Consumo', 'Descrição', 'Vencimento', 'Original', 'Encargos', 'Abatido', 'Saldo', 'Situação'], linhas, 'pdf');
}