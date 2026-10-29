# Financeiro — Residencial São Camilo

## Resultado
Nova área **Financeiro**, em português, integrada às residentes já cadastradas e com o mesmo visual do aplicativo. Valores em R$, datas em dd/mm/aaaa e telas adequadas ao celular. Nenhuma mensalidade, dívida ou pagamento fictício será lançado.

As outras áreas manterão seu funcionamento. Os dados financeiros ficarão em uma ficha separada vinculada a cada residente; usuários sem permissão financeira não terão acesso a esses valores, mesmo que possam corrigir o cadastro de residentes.

## 1. Estrutura, acesso e cadastros
- Criar armazenamento de catálogo, fichas financeiras, cobranças e itens, pagamentos e suas distribuições, créditos, configurações, contatos, promessas, fechamento de caixa e auditoria.
- Permissões independentes: **Visualizar financeiro**, **Lançar e receber** e **Administrador financeiro**. A administração atual poderá conceder e retirar essas permissões; administradores do app terão acesso inicial à administração financeira. Nenhum outro perfil receberá acesso automaticamente.
- Catálogo com nome, categoria, unidade, preço padrão e inativação. Preservar descrições e valores históricos mesmo quando o catálogo mudar.
- Ficha financeira por residente: mensalidade, vencimento de 1 a 28, responsável, telefone e pagamento preferencial. Permitir reaproveitar nome e telefone do responsável já cadastrado, mediante confirmação, sem assumir que o contato de emergência é o pagador.
- Comprovantes opcionais em armazenamento privado; histórico financeiro sem exclusão.

## 2. Cobranças e pagamentos
- Gerar mensalidades no primeiro dia de cada mês para residentes ativas com ficha financeira completa, com geração manual de recuperação e proteção contra duplicação. Avisar quais cadastros estão incompletos.
- Permitir descontos/acréscimos individuais, cobrança avulsa e consumo de vários itens para uma ou várias residentes. Valores preenchidos pelo catálogo, mas editáveis antes da confirmação.
- Extras agrupados por mês ou cobrados avulsamente. Padrão: extras do mês vencem com a mensalidade do mês seguinte; oferecer vencimento alternativo configurável.
- Mostrar descrição, itens, emissão, vencimento, observações e estados: em aberto, parcialmente paga, paga, vencida ou cancelada.
- Registrar recebimentos em Pix, dinheiro, transferência, boleto, cartão ou cheque. Prévia da distribuição antes de confirmar; encargos primeiro, depois principal, na ordem das dívidas mais antigas. Seleção manual de cobranças e valores, com validação dos totais.
- Excedente vira crédito vinculado à residente, com saldo e aplicação rastreáveis. Pagamento, distribuição e crédito são confirmados juntos, sem risco de salvar só uma parte.
- Cancelamentos e estornos exigem motivo, preservam o registro e recalculam saldos. Impedir duplicação por duplo clique ou repetição após falha de conexão.

## 3. Encargos e configurações
- Padrões do anexo: **multa 2%**, aplicada uma vez; **juros simples 1% ao mês**, proporcionais aos dias; **carência zero**; correção monetária manual desligada.
- Para cálculo diário, usar mês comercial de 30 dias e datas de São Paulo. Com carência, encargos começam após os dias de tolerância, sem retroagir ao período de carência.
- Calcular juros por intervalos entre pagamentos: somente o principal ainda em aberto gera novos juros. Multa não se reaplica, e encargos não geram juros sobre juros.
- Arredondar valores para centavos, conservando a memória dos intervalos. A configuração aplicável fica registrada na cobrança para alterações futuras não mudarem o passado silenciosamente.
- Memorial: valor original, saldo principal, dias, multa, juros, correção opcional, pagamentos, abatimentos e saldo atualizado. Administrador financeiro pode perdoar encargos com justificativa.
- Atualizar valores ao consultar e ao virar o dia com a tela aberta; não depender de gravar um novo saldo todos os dias.

## 4. Ficha financeira e alertas
- Ficha com dívida atualizada, crédito, cobranças, pagamentos e extrato cronológico. Ações diretas para consumo, cobrança e pagamento; demonstrativo PDF com itens e saldo.
- Alertas no topo do Financeiro e indicador no menu: vence em breve (3 dias), hoje, atrasado (1–30 dias) e inadimplente (mais de 30 dias), com limites configuráveis.
- Mostrar responsável, telefone, dívida atualizada e atraso. Registrar contatos, observações e promessa de pagamento; avisar novamente quando a promessa vencer sem quitação.
- Preparar mensagem de cobrança configurável e editável. **WhatsApp da enfermagem:** não conectar nem enviar pelo número pessoal. Abrir uma conversa usa a conta ativa no dispositivo; isso só será disponibilizado após confirmar que a equipe usa a conta da enfermagem. Envio direto pelo aplicativo depende da conexão dessa conta. Contatos e mensagens preparadas continuam disponíveis sem a conexão.
- Ao abrir o app, autorizados veem as pendências financeiras sem expor dados aos demais usuários.

## 5. Caixa e relatórios
- Caixa por data: total, quantidade e lista de recebimentos, separados por forma. Fechar o dia impede novos lançamentos e alterações que afetem aquela data, inclusive pagamentos retroativos e estornos; reabertura só por administrador financeiro com motivo.
- Visão mensal: gráfico diário, previsto, recebido, aberto e vencido; separação de mensalidades e repasses por categoria. Percentual de inadimplência calculado sobre o valor vencido não quitado em relação ao valor que já venceu no período, com denominador explícito.
- Relatórios de inadimplência (0–30, 31–60, 61–90 e mais de 90 dias), atrasos/pontualidade, recebimentos e consumo, com filtros e ordenação previstos no anexo.
- Exportação PDF, Excel e CSV; demonstrativos usam os mesmos cálculos da tela. PDF será um arquivo para baixar, não apenas uma janela de impressão.

## 6. Verificação
- Testar concretamente vencimento 1–28, valores em centavos, multa única de 2%, juros de 1%/mês, carência, parcial, seleção manual, crédito, estorno, cancelamento, promessa, fechamento e geração sem duplicidade.
- Testar permissões: não autorizados sem acesso, consulta sem escrita, operação sem poderes administrativos e administração financeira com acesso às funções previstas.
- Confirmar na tela um ciclo real controlado de cadastro financeiro, cobrança, pagamento parcial, extrato e estorno, sem deixar dados de teste na ficha de uma residente real.
- Verificar computador/celular, arquivos exportados e ausência de erros antes de declarar concluído.

## Detalhes técnicos
- Tabelas financeiras próprias ligadas a `residentes`, preservando as regras existentes de cadastro por Outros. Valores monetários em centavos inteiros; percentuais com precisão fixa.
- Permissões em tabela separada dos perfis, RLS e GRANT explícitos. Auditoria gerada no banco com identidade autenticada, protegida contra alteração ou exclusão.
- Operações de múltiplos registros em rotinas transacionais com validação de permissão, bloqueio de linhas e chaves de idempotência. O banco determina saldos e aplica as regras; prévia no navegador nunca autoriza a escrita.
- Rotina SQL mensal agendada para geração de mensalidades e fechamento dos extras do mês anterior; alternativa manual chama a mesma lógica. Não criar consulta periódica frequente para persistir estados de atraso.
- Novas páginas sob a área autenticada, carregamento integrado ao cache existente, metadados próprios e componentes visuais já usados no aplicativo. Utilizar biblioteca compatível para PDF e ferramentas existentes para planilhas.

## O que Maria Clarete deverá configurar
Valores das mensalidades, vencimentos e responsáveis de cada residente; itens, unidades e preços; pessoas autorizadas ao Financeiro. Conferir multa, juros, carência, modelo de mensagem e vencimento dos extras. Para WhatsApp, disponibilizar a conta da enfermagem; não é necessário informar senhas pessoais aqui.

## Ordem de entrega
Estrutura e cadastros → cobranças e pagamentos → encargos → alertas → caixa e relatórios → testes e resumo final, indicando claramente qualquer dependência não disponível.