import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

export function FinanceiroIndicador({ compact = false }: { compact?: boolean }) {
  const {data:qtd=0}=useQuery({queryKey:['financeiro-dados','contagem-alertas'],staleTime:60_000,refetchInterval:60_000,queryFn:async()=>{const {data,error}=await supabase.rpc('financeiro_contar_alertas');if(error)throw error;return data;}});
  if(!qtd)return null;
  if(compact)return <Badge variant="destructive" className="ml-auto">{qtd}</Badge>;
  return <Link to="/financeiro" aria-label={`${qtd} pendências financeiras`} title="Pendências financeiras" className="flex items-center gap-1 p-2"><Wallet className="size-4" /><Badge variant="destructive">{qtd}</Badge></Link>;
}