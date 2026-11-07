# Financeiro — Boleto e Pix automáticos via Asaas

Adicionar emissão e conciliação automática de cobranças por boleto bancário e Pix usando o gateway Asaas, sem remover nada do Financeiro atual (lançamentos, pagamentos manuais, correções, alertas, caixa, relatórios continuam iguais).

## Etapa 1 — Responsável financeiro completo + integração em sandbox

- Ampliar o cadastro financeiro do responsável: nome completo, CPF ou CNPJ (com validação dos dígitos), e-mail, telefone/WhatsApp e endereço completo (CEP, rua, número, bairro, cidade, UF). Um mesmo responsável pode pagar por mais de uma residente.
- Dados pessoais protegidos: visíveis só para quem já tem permissão financeira.
- Nova aba/área "Faturas": agrupa cobranças em aberto de um responsável em um único boleto/Pix, com seleção automática das que vencem no mês e escolha manual do que entra.
- Integração com o Asaas em ambiente de testes (sandbox): ao emitir a primeira fatura de um responsável, o app cria o cliente no gateway e guarda o ID para reutilizar.
- Fatura emitida guarda: pagador, cobranças incluídas, valor total, vencimento, forma (Boleto, Pix ou Boleto com Pix), ID no gateway, link do boleto, linha digitável, código Pix copia-e-cola, QR Code, status e histórico.
- Multa e juros das Configurações (padrão 2% + 1% ao mês) enviados ao gateway na criação, para o boleto vencido calcular encargos sozinho.
- Enquanto a fatura estiver ativa, as cobranças incluídas ficam travadas para edição de valor; para alterar, cancela-se a fatura (também no gateway) e gera-se outra.
- Aviso visível "Ambiente de testes (sandbox)" enquanto não estiver em produção.

## Etapa 2 — Geração em lote e envio ao responsável

- Botão "Gerar faturas do mês": cria as faturas de todos os responsáveis de uma vez, com prévia e confirmação antes de enviar ao gateway, e relatório de sucessos e falhas com o motivo (ex.: CPF inválido).
- Botões por fatura: copiar link, enviar por WhatsApp (mensagem pré-preenchida com valor, vencimento e link), enviar por e-mail (notificação do próprio gateway) e baixar PDF do boleto.
- Modelo da mensagem editável em Configurações; cada envio registrado no histórico de contatos.
- Alertas existentes ("vence em breve", "vence hoje", "atrasado") passam a ter o botão "Reenviar boleto/Pix".

## Etapa 3 — Webhook e conciliação automática

- Endpoint público `/api/public/asaas-webhook` que recebe eventos do gateway: pagamento criado, confirmado/recebido, vencido, estornado/devolvido e cobrança cancelada.
- Autenticidade validada por token secreto conferido no endpoint; chamadas sem o token são rejeitadas.
- Idempotência: o ID de cada evento é guardado e repetições são ignoradas — o mesmo evento nunca gera dois pagamentos.
- Ao confirmar pagamento: cria o registro de pagamento automaticamente (forma Pix ou Boleto, data, valor efetivamente recebido, referência da fatura), abate das cobranças pela regra já existente (encargos, depois principal, mais antiga primeiro), atualiza status e Caixa do dia e remove os alertas daquele pagador.
- Valor pago diferente do esperado: mostrar a diferença e permitir ajuste manual; divergência entre gateway e memorial interno é sinalizada.
- Estorno/devolução: reverte o pagamento com trilha de auditoria e recalcula a dívida.
- Todos os payloads recebidos ficam num log técnico para diagnóstico.
- Botão "Sincronizar com o gateway" por fatura e geral, para consultar o status caso algum webhook falhe.

## Etapa 4 — Telas, indicadores e relatórios

- Lista de faturas com filtros por status (Aguardando, Paga, Vencida, Cancelada, Estornada), forma de pagamento e período, com ícones e cores.
- Caixa do dia e relatórios separam recebimentos por origem: Pix automático, boleto automático e manuais.
- Relatório de conciliação: pago no gateway × registrado no app, apontando divergências.
- Tarifas do gateway por cobrança (quando informadas) e total de tarifas no relatório mensal, para conferir o líquido recebido.

## Segurança

- Chave de API do Asaas somente nos segredos do backend; toda chamada ao gateway passa por funções de backend, nunca pelo navegador.
- Ambiente (teste/produção) configurável em Configurações, com aviso visível em modo teste.
- Permissões: administradores e Administrador financeiro geram e cancelam faturas; configuração do gateway e alteração de multa/juros só para administradores.
- Erros do gateway com mensagens claras em português e nova tentativa segura.
- Tudo auditado: quem gerou, cancelou, reenviou, sincronizou.

## O que você vai precisar cadastrar (ao final da Etapa 1)

1. **Chave de API do Asaas** (começando pela de testes/sandbox) — guardada como segredo do app.
2. **Token do webhook** — valor gerado pelo app para você colar no painel do Asaas.
3. **URL do webhook** para configurar no painel do Asaas: `https://gerenciamento-residencial-s-camilo.lovable.app/api/public/asaas-webhook`
4. **Eventos a ativar no Asaas**: pagamento criado, confirmado/recebido, vencido, estornado/devolvido e cobrança cancelada.

## Detalhes técnicos

- Novas tabelas: `financeiro_faturas` (fatura, status, dados do gateway), `financeiro_fatura_cobrancas` (vínculo fatura↔cobranças), `financeiro_gateway_eventos` (log + idempotência). Todas com RLS restrita à permissão financeira e grants mínimos.
- Campos novos em `financeiro_cadastros`: CPF/CNPJ, e-mail, endereço completo e ID do cliente no gateway.
- Chamadas ao Asaas em `createServerFn` autenticadas que revalidam `financeiro_tem_acesso()` no servidor; webhook como rota de servidor pública com verificação de token.
- Pagamentos automáticos reutilizam a mesma rotina atômica de alocação/estorno já existente (`financeiro_operar`), preservando auditoria e regras atuais.
- Testes automatizados: validação de CPF/CNPJ, idempotência do webhook e rejeição sem token.
