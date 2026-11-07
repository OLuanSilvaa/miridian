# Miridian · Gestão de operações

Plataforma de gestão de operações do **Grupo Miridian**. Na primeira visita, solicita somente nome e sobrenome para personalizar a experiência. Esses dados ficam no LocalStorage do navegador. Nas próximas visitas, abre a tela solicitada sem pedir o nome novamente.

## Escopo desta entrega

As **Fases 1 e 2** da especificação estão implementadas:

- Identidade visual, navegação lateral recolhível, header, pesquisa global e interface adaptável.
- Estado centralizado, LocalStorage versionado, serialização compacta e recuperação de dados incompatíveis.
- Dashboard com indicadores financeiros e operacionais, gráficos SVG interativos, tabelas, alertas e atividades recentes.
- Filtros compartilhados de unidade e período, incluindo intervalo personalizado.
- Agrupamento mensal, trimestral ou anual, legendas interativas e tooltips financeiros.
- Consultas dos registros da base com pesquisa, ordenação, paginação, filtros de status e detalhes vinculados.
- Cadastro rápido de solicitações com validação, ID único, histórico, notificação e atualização dos indicadores.
- Identificação pelo nome e sobrenome, temas claro/escuro e densidade das tabelas.
- Exportação CSV, impressão, backup JSON, importação validada e restauração com confirmação.

As **14 opções da sidebar são telas na área principal**. O menu e o cabeçalho permanecem montados enquanto o conteúdo muda, sem recarregar o documento. Cada tela atualiza título, breadcrumb e item ativo. As listagens oferecem pesquisa, filtros, paginação e detalhes vinculados. Relatórios e Configurações também são telas; formulários e detalhes continuam em modais.

A navegação usa rotas no fragmento da URL, como `#/solicitacoes`, `#/financeiro` e `#/configuracoes`. Os módulos JavaScript são carregados de forma assíncrona e reutilizados. Links diretos, atualização da página e os botões Voltar/Avançar funcionam sem rotas de servidor, inclusive no subdiretório do GitHub Pages. Os filtros e a página de cada consulta são mantidos durante a navegação da sessão.

As telas consultam os registros existentes. Aprovar, rejeitar, executar, transferir equipamentos, lançar movimentações e editar cadastros ainda são entregas das Fases 3–5. A área de Relatórios já permite selecionar desempenho das unidades, despesas por departamento, solicitações por status e movimentações financeiras, com exportação CSV dos resultados filtrados.

## Executar localmente

Na raiz do projeto, abra o PowerShell e execute:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/serve.ps1
```

Acesse **http://127.0.0.1:4173/**. Encerre com `Ctrl+C`. Para outra porta:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/serve.ps1 -Port 8080
```

Esse utilitário entrega apenas arquivos estáticos e serve para desenvolvimento. Não integra a aplicação publicada. Também é possível usar a extensão **Live Server** do VS Code ou outro servidor HTTP estático. Como o projeto usa módulos JavaScript nativos, abra por HTTP/HTTPS; `file://` pode bloquear os imports.

Não é necessário instalar pacotes, executar build ou ter Node.js para usar a aplicação.

## Organização

```text
index.html                    Entrada do dashboard
assets/
  favicon.svg                 Identidade visual
  css/
    styles.css                Tokens, temas, reset e utilitários
    layout.css                Shell, grids, responsividade e impressão
    components.css            Cards, gráficos, tabelas, formulários e modais
    screens.css               Telas, indicadores, relatórios e configurações
  js/
    bootstrap.js              Entrada da aplicação
    app.js                    Aplicação e eventos da interface
    router.js                 Rotas, histórico e carregamento de módulos
    screen-host.js            Shell persistente e troca do conteúdo principal
    seed-data.js              Base inicial reproduzível e colaboradores
    request-catalog.js        Variedade dos pedidos e atualização do conteúdo inicial
    identity.js               Nome e sobrenome no armazenamento local
    actors.js                 Autoria dos eventos de histórico
    storage.js                Codec compacto e acesso protegido ao LocalStorage
    state.js                  Estado, índices, validação e seletores de dados
    navigation.js             Menu compartilhado
    components.js             Componentes, ícones, CSV e notificações de interface
    charts.js                 Gráficos SVG e agrupamentos financeiros
    formatters.js             Moeda, datas, números e escape de HTML
    modules/
      dashboard.js            Dashboard executivo
      explorer.js             Consultas e detalhes reutilizáveis
      screens.js              Telas dos módulos, relatórios e configurações
      identity.js             Formulário de nome e aviso de armazenamento
scripts/serve.ps1             Pré-visualização local no Windows
tests/
  checks.js                   Casos de teste independentes
  app-smoke.js                Integração da aplicação e troca das 14 telas
  navigation-checks.js        Rotas, histórico, cache e links diretos
  identity-checks.js          Identificação, privacidade e persistência
  dashboard-checks.js         Saldo, extrapolação e conciliação das solicitações
  realism-checks.js           Períodos parciais, comparações e atualização dos pedidos
  browser-stub.js             Ambiente em memória para os testes
  business-rules.test.js       Integração com o test runner nativo do Node
```

## Base e regras de cálculo

A base tem **12 unidades operacionais, uma sede, um centro de distribuição, 1.480 colaboradores, 86 gestores/supervisores, 240 fornecedores, 430 contratos, 3.800 ativos e 2.400 solicitações**. Os registros possuem IDs estáveis e referências validadas. Os registros iniciais são definidos em `seed-data.js`; os e-mails usam o domínio reservado `.example`.

Os valores monetários são **centavos inteiros**. As movimentações do ano de referência somam exatamente **R$ 185 milhões de receitas** e **R$ 128 milhões de despesas**. Há também registros do ano anterior para comparações. As datas são geradas em relação ao dia de inicialização, sem números aleatórios. A base fica persistida; recarregar a página não a recria.

Movimentações futuras são marcadas como **Previsto** e não contam como realizadas. Portanto, o total registrado até hoje é menor que a soma das competências do ano completo. Algumas despesas são desmembradas de lotes e vinculadas a solicitações concluídas, mantendo os totais anuais exatos.

| Indicador | Origem |
| --- | --- |
| Receita/despesas | Movimentações registradas, dentro do período e da unidade |
| Resultado | Receita menos despesas |
| Comparativo dos cards | Intervalo imediatamente anterior, com o mesmo número de dias |
| Orçamento aprovado | Soma dos orçamentos anuais das unidades selecionadas |
| Comprometido | Valor autorizado ainda não coberto por despesa registrada e vinculada |
| Saldo orçamentário | Orçamento anual menos despesas realizadas no ano e compromissos pendentes |
| Processos | Solicitações criadas dentro do período selecionado |
| Atrasos | Solicitações não finalizadas com prazo anterior a hoje |
| Contratos a vencer | Contratos vigentes com término entre hoje e os próximos 30 dias |
| Ativos em manutenção | Situação atual dos ativos da unidade selecionada |

**Conclusão de atividade não equivale a pagamento**: um valor autorizado permanece comprometido até a despesa vinculada ser registrada. Valores realizados vinculados reduzem o compromisso, evitando dupla contagem. O orçamento é anual; os demais cards financeiros seguem o período escolhido. Contratos e ativos representam a posição atual. A auditoria mostra o histórico local da unidade.

O **saldo orçamentário** mantém valores negativos quando despesas e compromissos ultrapassam o orçamento anual. Nesse caso, o card mostra o valor assinado, o percentual utilizado e o aviso **Limite excedido**, com o excesso em reais. A mesma nomenclatura é utilizada no Financeiro e na exportação do dashboard.

A contagem de solicitações é derivada dos registros. No cenário inicial de **07/11/2026**, filtrando **Unidade 05 / Este ano**, há **162 solicitações: 81 em aberto, 54 concluídas e 27 rejeitadas**. As 81 não finalizadas incluem 27 em análise, 27 aprovadas e 27 em execução; a fila de aprovação tem zero registros nesse recorte. Aprovação e execução são subconjuntos das solicitações não finalizadas. Os testes conciliam os totais nas 14 unidades e em todos os períodos, além de verificar novo cadastro e recarga.

No celular, os seis indicadores operacionais usam **duas colunas**, com espaçamento interno e quebra de linha nas descrições. Os gráficos financeiro e de despesas por departamento permanecem visíveis no layout de impressão. A captura visual da parte inferior ainda depende de acesso ao navegador de automação.

O gráfico financeiro identifica meses, trimestres e anos **parciais** com asterisco, faixa destacada e datas no tooltip. O último trecho incompleto é tracejado; valores futuros não são desenhados como meses zerados. A opção **Comparar mesmos dias** confronta intervalos de mesma duração do mês selecionado e do anterior, usando somente lançamentos registrados da unidade escolhida. Meses mais curtos usam o número de dias comum; não há projeção dos valores. Essa comparação é separada do comparativo dos cards, que mantém o intervalo imediatamente anterior.

Na **Unidade 05**, entre 01/01 e 07/11/2026, a receita é **R$ 13.847.767,96**; o consolidado do grupo é **R$ 157.486.762,97**. Entre os primeiros sete dias, a receita da unidade é **R$ 410.256,00 em outubro** e **R$ 335.367,99 em novembro**. O indicador principal usa o nome **Solicitações não finalizadas** e exclui os estados concluída, rejeitada e cancelada.

As solicitações iniciais distribuem sete categorias e dezenas de títulos por unidade. A versão de conteúdo `requestContentVersion: 2` atualiza automaticamente registros iniciais reconhecidos da base antiga, incluindo a descrição dos lançamentos vinculados. IDs, valores, datas, status e vínculos são preservados. Títulos personalizados, pedidos com descrição adicionada e novos pedidos do visitante não são substituídos. Não é necessário restaurar a base nem apagar o nome informado.

## Armazenamento e recuperação

Chave utilizada: `meridian:database:v1`, mantida por compatibilidade com os registros já salvos antes da renomeação para Miridian. O JSON é serializado em tabelas de colunas, reduzindo a repetição de nomes de campos. A base inicial ocupa aproximadamente **1,8 milhão de caracteres** no LocalStorage, abaixo de 4 MiB em UTF-16. O backup exportado mantém o esquema completo e legível.

Se o armazenamento falhar, a interface avisa e mantém a sessão utilizável. Dados corrompidos ou de versão incompatível **não são sobrescritos automaticamente**: uma base temporária é aberta, e Configurações oferece exportação dos dados originais, importação ou restauração confirmada. Dados locais podem ser apagados pelo navegador; backups JSON preservam as alterações fora dele.

Para restaurar: **Configurações → Restaurar base → Restaurar dados**. A restauração recria a base inicial com datas relativas ao dia atual. A importação valida estrutura, versão, campos, datas, valores inteiros, IDs duplicados e vínculos antes de oferecer a substituição confirmada.

A identificação pessoal usa a chave `miridian:visitor:v1`, separada da base operacional. São salvos somente `firstName` e `lastName`, sem envio a servidor. O nome pode ser alterado pelo botão no cabeçalho ou em **Configurações → Seus dados**. Restaurar ou importar registros não apaga essa identificação. Novas ações guardam o nome informado no histórico; eventos anteriores preservam seus responsáveis. Preferências antigas de seleção de perfil são removidas automaticamente, sem apagar os registros existentes.

## Testes

Com **Node.js 18 ou superior**, apenas como ferramenta de desenvolvimento:

```powershell
node --test tests/business-rules.test.js
```

Ou `npm test`. Não há instalação de dependências. Os casos cobrem coerência financeira, relacionamentos, filtros, gráficos, orçamento sem dupla contagem, vencimentos, cadastros, persistência, falhas de armazenamento, importação, restauração, exportação e renderização das consultas.

Os **57 casos** foram executados com sucesso no runtime de desenvolvimento da sessão. A suíte inclui identificação na primeira visita, reutilização do nome salvo, tratamento de nomes inválidos e falhas no armazenamento, autoria das atividades, navegação pelas 14 telas, preservação do shell e dos filtros, histórico, acesso inicial por link direto, troca rápida de tela e recuperação de falhas no carregamento. O HTML, CSS, JavaScript e favicon também foram servidos e verificados por HTTP. A automação de navegador estava indisponível; **a inspeção visual e os testes de interação em um navegador real, incluindo mobile e impressão, permanecem pendentes**. Esta entrega não afirma ter sido publicada ou verificada no GitHub Pages.

## GitHub Pages

1. Envie os arquivos para um repositório GitHub, mantendo `index.html`, `.nojekyll` e `assets/` na raiz.
2. Em **Settings → Pages**, selecione **Deploy from a branch**, a branch desejada e a pasta **/ (root)**.
3. Depois da publicação, acesse a URL fornecida pelo GitHub.

Os caminhos de CSS, scripts, ícones e imports são relativos e funcionam em subdiretórios como `https://usuario.github.io/repositorio/`. Não há rotas de servidor nem build obrigatório. Somente os arquivos estáticos são necessários para a hospedagem.

## Próxima etapa

Concluir a revisão visual do dashboard no navegador antes de iniciar a **Fase 3**: solicitação → aprovação por alçada → atividade → validação do solicitante, mantendo valores autorizados separados das despesas e registrando cada ação na auditoria.
