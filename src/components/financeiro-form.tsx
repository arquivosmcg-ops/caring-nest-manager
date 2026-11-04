import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { centavos, reais, dataBr, formasFinanceiras, categoriasFinanceiras, alocarPagamento, calcularSaldo } from '@/lib/financeiro';
import { operarFinanceiro, type FinanceiroDados, type CobrancaFinanceira } from '@/lib/financeiro-data';

export type FinanceiroModal = { tipo: string; id?: string; residente?: string };
export function SeletorFinanceiro({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return <div className="space-y-1"><Label>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label}><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>;
}
function Campo({ label, value, set, type = 'text', min, max }: { label: string; value: string; set: (v: string) => void; type?: string; min?: number; max?: number }) {
  return <div className="space-y-1"><Label>{label}</Label><Input aria-label={label} type={type} min={min} max={max} required value={value} onChange={e => set(e.target.value)} /></div>;
}

export function FinanceiroForm({ d, modal, fechar }: { d: FinanceiroDados; modal: FinanceiroModal; fechar: () => void }) {
  const qc = useQueryClient();
  const rid = modal.residente ?? d.residentes.find(r => r.ativo)?.id ?? '';
  const cadastro = d.cadastros.find(c => c.residente_id === rid);
  const item = d.catalogo.find(i => i.id === modal.id);
  const cobranca = d.cobrancas.find(c => c.id === modal.id);
  const pagamento = d.pagamentos.find(p => p.id === modal.id);
  const [residente, setResidente] = useState(rid);
  const [valor, setValor] = useState(String(modal.tipo === 'cadastro' ? (cadastro?.mensalidade_centavos ?? 0) / 100 : item ? item.valor_centavos / 100 : ''));
  const [nome, setNome] = useState(item?.nome ?? cadastro?.responsavel_nome ?? '');
  const [telefone, setTelefone] = useState(cadastro?.responsavel_telefone ?? '');
  const [dia, setDia] = useState(String(cadastro?.dia_vencimento ?? 10));
  const [data, setData] = useState(d.hoje);
  const [vencimento, setVencimento] = useState(d.hoje);
  const [forma, setForma] = useState(cadastro?.forma_preferencial ?? 'pix');
  const [categoria, setCategoria] = useState(item?.categoria ?? 'outros');
  const [unidade, setUnidade] = useState(item?.unidade ?? 'un');
  const [obs, setObs] = useState('');
  const [promessa, setPromessa] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [manual, setManual] = useState(false);
  const [selecao, setSelecao] = useState<Record<string, string>>({});
  const [residentes, setResidentes] = useState<string[]>([rid]);
  const [linhas, setLinhas] = useState([{ catalogo_id: d.catalogo.find(i => i.ativo)?.id ?? '', quantidade: '1', valor: String((d.catalogo.find(i => i.ativo)?.valor_centavos ?? 0) / 100) }]);
  const [anexo, setAnexo] = useState<File | null>(null);
  const [usarCredito, setUsarCredito] = useState(false);
  const [fonteCredito, setFonteCredito] = useState('');
  const [avulso, setAvulso] = useState(false);
  const operacao = useRef(crypto.randomUUID());
  const ocupadoRef = useRef(false);
  const { data: previaServidor, isFetching: carregandoPrevia } = useQuery({queryKey:['financeiro-previa',residente,data],enabled:modal.tipo==='pagamento',queryFn:async()=>{const {data:res,error}=await supabase.rpc('financeiro_previa',{_residente:residente,_data:data});if(error)throw error;return res as unknown as {id:string;calculo: import('@/lib/financeiro').Saldo}[];}});
  const saldosData = d.cobrancas.filter(c => c.residente_id === residente && !c.cancelada && c.emissao<=data).map(c => {
    const eventos = d.alocacoes.filter(a => a.cobranca_id === c.id).flatMap(a => {
      const p = d.pagamentos.find(p => p.id === a.pagamento_id && !p.estornado); return p ? [{ data: p.data, principal: a.principal_centavos, multa: a.multa_centavos, juros: a.juros_centavos, correcao: a.correcao_centavos }] : [];
    });
    return { ...c, calculo: previaServidor?.find(p=>p.id===c.id)?.calculo ?? (data === d.hoje ? c.calculo : calcularSaldo(c.valor_centavos + c.ajuste_centavos, c.vencimento, data, eventos, c.multa_bp, c.juros_bp, c.carencia, c.correcao_bp)) };
  }).filter(c => c.calculo.saldo > 0);
  let valorCentavos = 0; try { valorCentavos = centavos(valor); } catch { /* validated on save */ }
  const previa = alocarPagamento(Math.max(0, valorCentavos), saldosData);
  const totalManual = Object.values(selecao).reduce((s, v) => { try { return s + centavos(v); } catch { return s; } }, 0);
  const residenteOptions = d.residentes.map(r => ({ value: r.id, label: r.nome + (!r.ativo ? ' (inativa)' : '') }));
  const creditos = d.pagamentos.filter(p=>p.residente_id===residente&&!p.estornado&&p.forma!=='credito').map(p=>{const livre=p.valor_centavos-d.alocacoes.filter(a=>a.pagamento_id===p.id).reduce((s,a)=>s+a.principal_centavos+a.multa_centavos+a.juros_centavos+a.correcao_centavos,0)-d.pagamentos.filter(u=>u.fonte_credito===p.id&&!u.estornado).reduce((s,u)=>s+u.valor_centavos,0);return {value:p.id,label:`${dataBr(p.data)} · ${reais(livre)}`,livre};}).filter(p=>p.livre>0);

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); if (ocupadoRef.current) return;
    if (modal.tipo === 'pagamento' && !confirmar) { try {if(centavos(valor)<=0)throw new Error('Informe um valor positivo');if(manual&&(!Object.values(selecao).some(v=>centavos(v)>0)||totalManual>centavos(valor)))throw new Error('Selecione cobranças e confira a distribuição');if(usarCredito&&!fonteCredito)throw new Error('Escolha a origem do crédito');setConfirmar(true);}catch(e){toast.error(e instanceof Error?e.message:'Confira os valores');}return; }
    ocupadoRef.current = true; setOcupado(true);
    try {
      let acao = modal.tipo; let dados: Record<string, unknown> = {};
      if (acao === 'cadastro') dados = { residente_id: residente, mensalidade_centavos: centavos(valor), dia_vencimento: Number(dia), responsavel_nome: nome, responsavel_telefone: telefone, forma_preferencial: forma };
      if (acao === 'catalogo') dados = { id: item?.id, nome, categoria, unidade, valor_centavos: centavos(valor), ativo: item?.ativo ?? true };
      if (acao === 'mensalidades') dados = { mes: data.slice(0, 7) + '-01' };
      if (acao === 'avulsa') dados = { residente_id: residente, descricao: nome, categoria, data, vencimento, valor_centavos: centavos(valor), observacoes: obs };
      if (acao === 'consumo') dados = { residentes, data, vencimento, avulso, itens: linhas.map(l => ({ catalogo_id: l.catalogo_id, quantidade: Number(l.quantidade.replace(',','.')), valor_centavos: centavos(l.valor) })) };
      if (acao === 'cancelar' || acao === 'perdoar' || acao === 'estornar' || acao === 'ajuste') dados = { id: modal.id, motivo: obs, ajuste_centavos: acao === 'ajuste' ? centavos(valor) : undefined };
      if (acao === 'contato') dados = { id: modal.id, forma: forma === 'pix' ? 'telefone' : forma, observacao: obs, promessa_data: promessa };
      if (acao === 'caixa') dados = { data: modal.id, fechado: !d.caixa.find(c => c.data === modal.id)?.fechado, motivo: obs };
      if (acao === 'pagamento') {
        if (manual && totalManual > centavos(valor)) throw new Error('A distribuição excede o valor recebido');
        let path: string | undefined;
        if (anexo) {
          if (anexo.size > 10 * 1024 * 1024) throw new Error('Comprovante deve ter até 10 MB');
          if (!['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(anexo.type)) throw new Error('Use PDF, JPG, PNG ou WebP');
          path = `${residente}/${operacao.current}.${anexo.type === 'application/pdf' ? 'pdf' : anexo.type.split('/')[1]}`;
          const { error } = await supabase.storage.from('financeiro-comprovantes').upload(path, anexo, { upsert: true }); if (error) throw error;
        }
        dados = { residente_id: residente, data, valor_centavos: centavos(valor), forma, observacoes: obs, comprovante_path: path, alocacoes: manual ? Object.entries(selecao).map(([id, v]) => ({ id, valor: centavos(v) })).filter(a => a.valor > 0) : undefined };
        if(usarCredito){acao='credito';dados.fonte_credito=fonteCredito;}
      }
      const res = await operarFinanceiro(acao, dados, operacao.current);
      toast.success(acao === 'mensalidades' ? `${res.geradas ?? 0} mensalidade(s) gerada(s)` : 'Registro financeiro salvo');
      await Promise.all([qc.invalidateQueries({ queryKey: ['financeiro-dados'] }),qc.invalidateQueries({queryKey:['financeiro-previa']})]); fechar();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível salvar'); }
    finally { ocupadoRef.current = false; setOcupado(false); }
  }
  const escolherResidente = (id: string) => {
    setResidente(id); setConfirmar(false);setSelecao({});
    if (modal.tipo === 'cadastro') { const c = d.cadastros.find(c => c.residente_id === id); setNome(c?.responsavel_nome ?? ''); setTelefone(c?.responsavel_telefone ?? ''); setDia(String(c?.dia_vencimento ?? 10)); setValor(String((c?.mensalidade_centavos ?? 0) / 100));setForma(c?.forma_preferencial ?? 'pix'); }
  };
  return <form onSubmit={salvar} className="space-y-4">
    {['cadastro', 'avulsa', 'pagamento'].includes(modal.tipo) && <SeletorFinanceiro label="Residente" value={residente} onChange={escolherResidente} options={residenteOptions} />}
    {modal.tipo === 'cadastro' && <>
      <div className="grid grid-cols-2 gap-3"><Campo label="Mensalidade (R$)" value={valor} set={setValor} /><Campo label="Dia de vencimento" type="number" min={1} max={28} value={dia} set={setDia} /></div>
      <Campo label="Responsável financeiro" value={nome} set={setNome} /><Campo label="Telefone do responsável" value={telefone} set={setTelefone} type="tel" />
      <Button type="button" variant="outline" onClick={() => { const r = d.residentes.find(r => r.id === residente); setNome(r?.responsavel ?? r?.nome ?? ''); setTelefone(r?.telefone ?? ''); }}>Usar responsável do cadastro</Button>
      <SeletorFinanceiro label="Pagamento preferencial" value={forma} onChange={setForma} options={Object.entries(formasFinanceiras).map(([value, label]) => ({ value, label }))} />
    </>}
    {modal.tipo === 'catalogo' && <><Campo label="Nome do item" value={nome} set={setNome} /><SeletorFinanceiro label="Categoria" value={categoria} onChange={setCategoria} options={Object.entries(categoriasFinanceiras).map(([value,label]) => ({value,label}))} /><div className="grid grid-cols-2 gap-3"><Campo label="Unidade" value={unidade} set={setUnidade} /><Campo label="Valor padrão (R$)" value={valor} set={setValor} /></div></>}
    {modal.tipo === 'mensalidades' && <Campo label="Mês de referência" type="month" value={data.slice(0,7)} set={v => setData(v+'-01')} />}
    {modal.tipo === 'avulsa' && <><Campo label="Descrição da cobrança" value={nome} set={setNome} /><SeletorFinanceiro label="Categoria" value={categoria} onChange={setCategoria} options={Object.entries(categoriasFinanceiras).map(([value,label])=>({value,label}))} /><Campo label="Valor original (R$)" value={valor} set={setValor} /></>}
    {modal.tipo==='consumo'&&d.config?.extras_agrupados&&<label className="flex items-center gap-2 text-sm"><Checkbox checked={avulso} onCheckedChange={v=>setAvulso(v===true)} />Cobrar estes itens avulsamente</label>}
    {['consumo','avulsa','pagamento'].includes(modal.tipo) && <div className="grid grid-cols-2 gap-3"><Campo label={modal.tipo==='pagamento'?'Data do pagamento':'Data do lançamento'} type="date" value={data} set={v=>{setData(v);setConfirmar(false);}} />{modal.tipo!=='pagamento' && (!d.config?.extras_agrupados || modal.tipo==='avulsa'||avulso) && <Campo label="Vencimento" type="date" value={vencimento} set={setVencimento} />}</div>}
    {modal.tipo==='consumo' && <>
      <Label>Residentes selecionadas ({residentes.length})</Label><div className="max-h-36 overflow-y-auto border border-border rounded-md p-3 space-y-2">{d.residentes.filter(r=>r.ativo).map(r=><label key={r.id} className="flex items-center gap-2 text-sm"><Checkbox checked={residentes.includes(r.id)} onCheckedChange={v=>setResidentes(v?[...residentes,r.id]:residentes.filter(id=>id!==r.id))} />{r.nome}</label>)}</div>
      {linhas.map((l,i)=><div key={i} className="border-b border-border pb-3 space-y-2"><SeletorFinanceiro label={`Item ${i+1}`} value={l.catalogo_id} options={d.catalogo.filter(c=>c.ativo).map(c=>({value:c.id,label:c.nome}))} onChange={id=>setLinhas(linhas.map((linha,j)=>j===i?{...linha,catalogo_id:id,valor:String((d.catalogo.find(c=>c.id===id)?.valor_centavos??0)/100)}:linha))} /><div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end"><Campo label="Quantidade" value={l.quantidade} set={v=>setLinhas(linhas.map((linha,j)=>j===i?{...linha,quantidade:v}:linha))} /><Campo label="Unitário (R$)" value={l.valor} set={v=>setLinhas(linhas.map((linha,j)=>j===i?{...linha,valor:v}:linha))} /><Button type="button" variant="ghost" size="icon" aria-label="Remover item" disabled={linhas.length===1} onClick={()=>setLinhas(linhas.filter((_,j)=>j!==i))}><Trash2 className="size-4" /></Button></div></div>)}
      <Button type="button" variant="outline" onClick={()=>setLinhas([...linhas,{catalogo_id:'',quantidade:'1',valor:''}])}><Plus className="size-4" />Adicionar item</Button>
    </>}
    {modal.tipo==='pagamento' && <>
      {!!creditos.length&&<><label className="flex items-center gap-2 text-sm"><Checkbox checked={usarCredito} onCheckedChange={v=>{setUsarCredito(v===true);setConfirmar(false);}} />Usar crédito da residente</label>{usarCredito&&<SeletorFinanceiro label="Origem do crédito" value={fonteCredito} onChange={v=>{setFonteCredito(v);setConfirmar(false);}} options={creditos} />}</>}
      <Campo label="Valor recebido (R$)" value={valor} set={v=>{setValor(v);setConfirmar(false);}} />
      <SeletorFinanceiro label="Forma de pagamento" value={forma} onChange={setForma} options={Object.entries(formasFinanceiras).map(([value,label])=>({value,label}))} />
      <div className="space-y-1"><Label>Comprovante (opcional)</Label><Input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e=>setAnexo(e.target.files?.[0]??null)} /></div>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={manual} onCheckedChange={v=>{setManual(v===true);setConfirmar(false);}} />Escolher cobranças e valores manualmente</label>
      {manual && saldosData.map(c=><div key={c.id} className="flex items-center gap-2 text-sm"><span className="flex-1">{c.descricao} · {reais(c.calculo.saldo)}</span><Input className="w-28" aria-label={`Abater ${c.descricao}`} value={selecao[c.id]??''} onChange={e=>{setSelecao({...selecao,[c.id]:e.target.value});setConfirmar(false);}} /></div>)}
      {confirmar && <div className="bg-muted p-3 rounded-md space-y-2 text-sm"><h3 className="font-bold">Prévia do pagamento</h3>{(manual?saldosData.filter(c=>centavos(selecao[c.id]??'0')>0).map(c=>({id:c.id,total:centavos(selecao[c.id]),multa:Math.min(centavos(selecao[c.id]),c.calculo.multa),juros:Math.min(Math.max(0,centavos(selecao[c.id])-c.calculo.multa),c.calculo.juros),principal:Math.max(0,centavos(selecao[c.id])-c.calculo.multa-c.calculo.juros-c.calculo.correcao)})):previa.alocacoes).map(a=><div key={a.id}><b>{saldosData.find(c=>c.id===a.id)?.descricao}: {reais(a.total)}</b><p className="text-muted-foreground">Multa {reais(a.multa)} · Juros {reais(a.juros)} · Principal {reais(a.principal)}</p></div>)}<p className="font-bold">Crédito gerado: {reais(manual?Math.max(0,valorCentavos-totalManual):previa.credito)}</p></div>}
    </>}
    {cobranca && ['cancelar','perdoar','ajuste','contato'].includes(modal.tipo) && <p className="text-sm">{cobranca.descricao} · {reais(cobranca.calculo.saldo)} · {dataBr(cobranca.vencimento)}</p>}
    {pagamento && modal.tipo==='estornar' && <p>{reais(pagamento.valor_centavos)} recebido em {dataBr(pagamento.data)}</p>}
    {modal.tipo==='ajuste' && <Campo label="Ajuste (R$; negativo para desconto)" value={valor} set={setValor} />}
    {modal.tipo==='contato' && <><SeletorFinanceiro label="Forma de contato" value={forma==='pix'?'telefone':forma} onChange={setForma} options={[{value:'telefone',label:'Telefone'},{value:'presencial',label:'Presencial'},{value:'whatsapp',label:'WhatsApp'},{value:'email',label:'E-mail'}]} /><div><Label>Promessa de pagamento (opcional)</Label><Input type="date" value={promessa} onChange={e=>setPromessa(e.target.value)} /></div></>}
    {!['catalogo','cadastro','mensalidades','consumo'].includes(modal.tipo) && <div className="space-y-1"><Label>{['cancelar','perdoar','estornar','ajuste','caixa'].includes(modal.tipo)?'Motivo':'Observações'}</Label><Textarea aria-label="Observações ou motivo" required={['cancelar','perdoar','estornar','ajuste'].includes(modal.tipo)||(modal.tipo==='caixa'&&!!d.caixa.find(c=>c.data===modal.id)?.fechado)} value={obs} onChange={e=>setObs(e.target.value)} /></div>}
    <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={fechar}>Voltar</Button><Button type="submit" disabled={ocupado||(modal.tipo==='pagamento'&&carregandoPrevia)}>{ocupado?'Salvando…':modal.tipo==='pagamento'&&!confirmar?'Ver distribuição':modal.tipo==='pagamento'?'Confirmar pagamento':'Salvar'}</Button></div>
  </form>;
}

export function MemorialFinanceiro({ c }: { c: CobrancaFinanceira }) {
  return <dl className="grid grid-cols-2 gap-2 text-sm">{[['Valor original',reais(c.valor_centavos)],['Ajuste',reais(c.ajuste_centavos)],['Principal em aberto',reais(c.calculo.principal)],['Dias de atraso',String(c.calculo.dias)],['Multa',reais(c.calculo.multa)],['Juros simples',reais(c.calculo.juros)],['Correção monetária',reais(c.calculo.correcao)],['Pagamentos abatidos',reais(c.calculo.pago)],['Saldo atualizado',reais(c.calculo.saldo)]].map(([k,v])=><div key={k} className="border-b border-border py-2"><dt className="text-muted-foreground">{k}</dt><dd className="font-bold">{v}</dd></div>)}</dl>;
}