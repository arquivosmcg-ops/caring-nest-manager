import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Wallet } from 'lucide-react';
import { financeiroDadosOptions } from '@/lib/financeiro-data';
import { nivelAlerta } from '@/lib/financeiro';
import { Badge } from '@/components/ui/badge';

export function FinanceiroIndicador({ compact = false }: { compact?: boolean }) {
  const {data:d}=useQuery({...financeiroDadosOptions,refetchInterval:60_000});
  const qtd=d?.cobrancas.filter(c=>{const contato=d.contatos.find(t=>t.cobranca_id===c.id);return nivelAlerta(c.vencimento,d.hoje,c.calculo.saldo,d.config?.alerta_dias??3,d.config?.inadimplencia_dias??30)||(c.calculo.saldo>0&&contato?.promessa_data&&contato.promessa_data<d.hoje);}).length??0;
  if(!qtd)return null;
  if(compact)return <Badge variant="destructive" className="ml-auto">{qtd}</Badge>;
  return <Link to="/financeiro" aria-label={`${qtd} pendências financeiras`} title="Pendências financeiras" className="flex items-center gap-1 p-2"><Wallet className="size-4" /><Badge variant="destructive">{qtd}</Badge></Link>;
}