import { useState } from 'react';
import { FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SeletorFinanceiro } from './financeiro-form';
import { reais, dataBr, categoriasFinanceiras, formasFinanceiras } from '@/lib/financeiro';
import { exportarFinanceiro } from '@/lib/financeiro-export';
import type { FinanceiroDados } from '@/lib/financeiro-data';

export function FinanceiroRelatorios({ d }: { d: FinanceiroDados }) {
  const [tipo,setTipo]=useState('inadimplencia');const [inicio,setInicio]=useState(d.hoje.slice(0,7)+'-01');const [fim,setFim]=useState(d.hoje);const [categoria,setCategoria]=useState('todas');const [forma,setForma]=useState('todas');const [faixa,setFaixa]=useState('todas');const [ordem,setOrdem]=useState('valor');const [rid,setRid]=useState('todos');
  const nome=(id:string)=>d.residentes.find(r=>r.id===id)?.nome??'—';
  const classe=(dias:number)=>dias<=30?'0–30':dias<=60?'31–60':dias<=90?'61–90':'Mais de 90';
  const porCategoria=(id:string)=>categoria==='todas'||d.itens.some(i=>i.cobranca_id===id&&i.categoria===categoria);
  let colunas:string[]=[];let linhas:(string|number)[][]=[];
  if(tipo==='inadimplencia'){
    colunas=['Residente','Vencimento','Original','Encargos','Saldo atualizado','Dias','Faixa'];
    linhas=d.cobrancas.filter(c=>c.calculo.saldo>0&&c.calculo.dias>0&&c.vencimento>=inicio&&c.vencimento<=fim&&porCategoria(c.id)&&(rid==='todos'||rid===c.residente_id)&&(faixa==='todas'||classe(c.calculo.dias)===faixa)).sort((a,b)=>ordem==='valor'?b.calculo.saldo-a.calculo.saldo:b.calculo.dias-a.calculo.dias).map(c=>[nome(c.residente_id),dataBr(c.vencimento),reais(c.valor_centavos+c.ajuste_centavos),reais(c.calculo.multa+c.calculo.juros+c.calculo.correcao),reais(c.calculo.saldo),c.calculo.dias,classe(c.calculo.dias)]);
  }else if(tipo==='consumo'){
    colunas=['Residente','Data','Item','Categoria','Quantidade','Unidade','Unitário','Total'];
    linhas=d.itens.filter(i=>{const c=d.cobrancas.find(c=>c.id===i.cobranca_id);return c&&!c.cancelada&&i.data_consumo>=inicio&&i.data_consumo<=fim&&(categoria==='todas'||categoria===i.categoria)&&(rid==='todos'||rid===c.residente_id);}).map(i=>{const c=d.cobrancas.find(c=>c.id===i.cobranca_id);return[nome(c?.residente_id??''),dataBr(i.data_consumo),i.descricao,categoriasFinanceiras[i.categoria as keyof typeof categoriasFinanceiras]??i.categoria,i.quantidade,i.unidade,reais(i.valor_unitario_centavos),reais(i.total_centavos)];});
  }else if(tipo==='recebimentos'){
    colunas=['Residente','Data','Forma','Categoria','Principal','Encargos','Crédito','Recebido'];
    for(const p of d.pagamentos.filter(p=>!p.estornado&&p.forma!=='credito'&&p.data>=inicio&&p.data<=fim&&(forma==='todas'||forma===p.forma)&&(rid==='todos'||rid===p.residente_id))){
      let alocado=0;
      for(const a of d.alocacoes.filter(a=>a.pagamento_id===p.id)){
        const itens=d.itens.filter(i=>i.cobranca_id===a.cobranca_id);const base=itens.reduce((s,i)=>s+i.total_centavos,0);const grupos=new Map<string,number>();for(const i of itens)grupos.set(i.categoria,(grupos.get(i.categoria)??0)+i.total_centavos);if(!grupos.size)grupos.set('outros',1);
        const encargos=a.multa_centavos+a.juros_centavos+a.correcao_centavos;const total=a.principal_centavos+encargos;alocado+=total;let distribuido=0;const entradas=[...grupos.entries()];entradas.forEach(([cat,v],idx)=>{const parte=idx===entradas.length-1?a.principal_centavos-distribuido:Math.round(a.principal_centavos*v/(base||1));distribuido+=parte;if(categoria==='todas'||categoria===cat)linhas.push([nome(p.residente_id),dataBr(p.data),formasFinanceiras[p.forma as keyof typeof formasFinanceiras]??p.forma,categoriasFinanceiras[cat as keyof typeof categoriasFinanceiras]??cat,reais(parte),reais(idx===0?encargos:0),'',reais(parte+(idx===0?encargos:0))]);});
      }
      if(p.valor_centavos>alocado&&categoria==='todas')linhas.push([nome(p.residente_id),dataBr(p.data),formasFinanceiras[p.forma as keyof typeof formasFinanceiras]??p.forma,'Crédito','', '',reais(p.valor_centavos-alocado),reais(p.valor_centavos-alocado)]);
    }
  }else{
    colunas=['Residente','Cobranças pagas','Pagas com atraso','Pontualidade (%)'];
    linhas=d.residentes.filter(r=>rid==='todos'||rid===r.id).map(r=>{const cobrancas=d.cobrancas.filter(c=>c.residente_id===r.id&&c.vencimento>=inicio&&c.vencimento<=fim&&c.calculo.status==='Paga'&&porCategoria(c.id));const atraso=cobrancas.filter(c=>d.alocacoes.some(a=>a.cobranca_id===c.id&&d.pagamentos.some(p=>p.id===a.pagamento_id&&!p.estornado&&p.data>c.vencimento))).length;return[r.nome,cobrancas.length,atraso,cobrancas.length?Math.round((cobrancas.length-atraso)/cobrancas.length*100):'—'];});
  }
  const titulo={inadimplencia:'Relatório de inadimplência',consumo:'Relatório de consumo',recebimentos:'Relatório de recebimentos',pontualidade:'Relatório de pontualidade'}[tipo]??'Relatório financeiro';
  return <div className="space-y-5"><h2 className="text-xl font-bold">Relatórios financeiros</h2><div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3"><SeletorFinanceiro label="Relatório" value={tipo} onChange={setTipo} options={[{value:'inadimplencia',label:'Inadimplência'},{value:'pontualidade',label:'Atrasos e pontualidade'},{value:'recebimentos',label:'Recebimentos'},{value:'consumo',label:'Consumo de itens'}]} /><div><Label>De</Label><Input aria-label="Início do período" type="date" value={inicio} onChange={e=>setInicio(e.target.value)} /></div><div><Label>Até</Label><Input aria-label="Fim do período" type="date" value={fim} onChange={e=>setFim(e.target.value)} /></div><SeletorFinanceiro label="Residente" value={rid} onChange={setRid} options={[{value:'todos',label:'Todas'},...d.residentes.map(r=>({value:r.id,label:r.nome}))]} /><SeletorFinanceiro label="Categoria" value={categoria} onChange={setCategoria} options={[{value:'todas',label:'Todas'},...Object.entries(categoriasFinanceiras).map(([value,label])=>({value,label}))]} />{tipo==='recebimentos'&&<SeletorFinanceiro label="Forma de pagamento" value={forma} onChange={setForma} options={[{value:'todas',label:'Todas'},...Object.entries(formasFinanceiras).map(([value,label])=>({value,label}))]} />{tipo==='inadimplencia'&&<><SeletorFinanceiro label="Faixa de atraso" value={faixa} onChange={setFaixa} options={[{value:'todas',label:'Todas'},...['0–30','31–60','61–90','Mais de 90'].map(v=>({value:v,label:v+' dias'}))]} /><SeletorFinanceiro label="Ordenar" value={ordem} onChange={setOrdem} options={[{value:'valor',label:'Maior valor'},{value:'dias',label:'Maior atraso'}]} /></>}</div><div className="flex flex-wrap gap-2">{(['pdf','xlsx','csv'] as const).map(f=><Button key={f} variant="outline" onClick={()=>void exportarFinanceiro(titulo+' '+dataBr(inicio)+' a '+dataBr(fim),colunas,linhas,f).catch(()=>toast.error('Não foi possível exportar'))}><FileDown className="size-4" />{f==='xlsx'?'Excel':f.toUpperCase()}</Button>)}</div><div className="overflow-x-auto border-y border-border"><table className="w-full text-sm"><thead><tr>{colunas.map(c=><th key={c} className="text-left p-3 bg-muted whitespace-nowrap">{c}</th>)}</tr></thead><tbody>{linhas.map((l,i)=><tr key={i} className="border-b border-border">{l.map((v,j)=><td key={j} className="p-3">{v}</td>)}</tr>)}</tbody></table>{!linhas.length&&<p className="py-10 text-center text-muted-foreground">Nenhum registro neste período.</p>}</div></div>;
}