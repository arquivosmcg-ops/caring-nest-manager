import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { operarFinanceiro, type FinanceiroDados } from '@/lib/financeiro-data';

export function FinanceiroConfig({ d }: { d: FinanceiroDados }) {
  const c = d.config;
  const [multa,setMulta]=useState(String((c?.multa_bp??200)/100));
  const [juros,setJuros]=useState(String((c?.juros_bp??100)/100));
  const [carencia,setCarencia]=useState(String(c?.carencia??0));
  const [correcao,setCorrecao]=useState(String((c?.correcao_bp??0)/100));
  const [agrupados,setAgrupados]=useState(c?.extras_agrupados??true);
  const [dia,setDia]=useState(c?.extras_dia?String(c.extras_dia):'');
  const [breve,setBreve]=useState(String(c?.alerta_dias??3));
  const [inadimplencia,setInadimplencia]=useState(String(c?.inadimplencia_dias??30));
  const [automatico,setAutomatico]=useState(c?.automatico??false);
  const [mensagem,setMensagem]=useState(c?.mensagem??'Olá, {responsavel}. A cobrança de {residente}, no valor de {valor}, com vencimento em {vencimento}, está pendente. Por favor, entre em contato com o Residencial São Camilo.');
  const [salvando,setSalvando]=useState(false);const qc=useQueryClient();
  const fields=[['Multa por atraso (%)',multa,setMulta,0,100],['Juros simples ao mês (%)',juros,setJuros,0,100],['Carência (dias)',carencia,setCarencia,0,365],['Correção manual ao mês (%; 0 desligada)',correcao,setCorrecao,0,100],['Avisar antes do vencimento (dias)',breve,setBreve,0,90],['Inadimplente após (dias)',inadimplencia,setInadimplencia,1,365]] as const;
  async function salvar(e:React.FormEvent){e.preventDefault();if(salvando)return;setSalvando(true);try{await operarFinanceiro('config',{multa_bp:Math.round(Number(multa.replace(',','.'))*100),juros_bp:Math.round(Number(juros.replace(',','.'))*100),carencia:Number(carencia),correcao_bp:Math.round(Number(correcao.replace(',','.'))*100),extras_agrupados:agrupados,extras_dia:dia,alerta_dias:Number(breve),inadimplencia_dias:Number(inadimplencia),mensagem,automatico},crypto.randomUUID());await qc.invalidateQueries({queryKey:['financeiro-dados']});toast.success('Configurações financeiras salvas');}catch(e){toast.error(e instanceof Error?e.message:'Não foi possível salvar');}finally{setSalvando(false);}}
  return <form onSubmit={salvar} className="max-w-3xl space-y-6"><h2 className="text-xl font-bold">Configurações financeiras</h2><div className="grid sm:grid-cols-2 gap-4">{fields.map(([label,value,set,min,max])=><div key={label} className="space-y-1"><Label>{label}</Label><Input aria-label={label} type="number" step={label.includes('%')?'0.01':'1'} min={min} max={max} required value={value} onChange={e=>set(e.target.value)} /></div>)}</div><div className="flex items-center justify-between border-y border-border py-4 gap-4"><Label htmlFor="extras-agrupados">Agrupar extras mensais</Label><Switch id="extras-agrupados" checked={agrupados} onCheckedChange={setAgrupados} /></div>{agrupados&&<div className="space-y-1"><Label>Dia de vencimento dos extras (vazio: mensalidade do mês seguinte)</Label><Input aria-label="Dia de vencimento dos extras" type="number" min={1} max={28} value={dia} onChange={e=>setDia(e.target.value)} /></div>}<div className="flex items-center justify-between border-b border-border py-4 gap-4"><Label htmlFor="mensalidades-auto">Gerar mensalidades automaticamente a partir do próximo mês</Label><Switch id="mensalidades-auto" checked={automatico} onCheckedChange={setAutomatico} /></div><div className="space-y-1"><Label>Modelo da mensagem de cobrança</Label><Textarea aria-label="Modelo da mensagem de cobrança" rows={5} value={mensagem} onChange={e=>setMensagem(e.target.value)} /><p className="text-xs text-muted-foreground">{'{responsavel} · {residente} · {valor} · {vencimento}'}</p></div><Button disabled={salvando} type="submit"><Save className="size-4" />{salvando?'Salvando…':'Salvar configurações'}</Button></form>;
}