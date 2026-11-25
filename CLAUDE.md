# CLAUDE.md — Dashboard de Bitcoin

## Sobre o projeto
Dashboard em uma única página web que mostra o preço do Bitcoin: gráfico semanal, gráfico anual,
histórico com seletor de período e cartões de resumo. Os dados vêm da CoinGecko API pública (sem chave).
O roteiro completo e as fases estão em `plan.md`. **Siga as fases na ordem.**

## Stack
- HTML + CSS + JavaScript puro. **Sem** frameworks, **sem** npm, **sem** etapa de build.
- Chart.js 4 + `chartjs-adapter-date-fns` carregados via CDN (jsDelivr).
- Seletor de datas: `<input type="date">` nativo.
- Node.js não está instalado nesta máquina: não proponha soluções que dependam dele.

## Como rodar
Abrir `index.html` no navegador (dois cliques) ou usar a extensão Live Server do VS Code.

## API (CoinGecko)
- Base: `https://api.coingecko.com/api/v3`
- Só 3 chamadas por atualização: `/simple/price` e `/coins/bitcoin/market_chart` (`days=7` e `days=365`).
- O histórico personalizado **não chama a API**: recorta `precosSemanais`/`precosAnuais` já carregados.
  Não reintroduza chamadas por clique (ex.: `/market_chart/range`) — elas estouravam o limite gratuito.
- As respostas trazem datas em **milissegundos**.
- Quando a CoinGecko recusa por excesso (429), o navegador costuma ver só "falha de conexão" (sem CORS na resposta).
- Limites: dados só até **365 dias atrás**; poucas chamadas por minuto → sempre usar o cache de `buscarDados`,
  nunca criar atualização automática em loop, tratar o erro 429 com mensagem amigável.

## Convenções de código
- Nomes de funções e variáveis em **português** (ex.: `buscarDados`, `carregarPeriodo`).
- Funções pequenas, com uma responsabilidade cada. Reaproveitar `criarGrafico` para todos os gráficos.
- Formatação brasileira: `Intl.NumberFormat('pt-BR', { style: 'currency', ... })` e `toLocaleDateString('pt-BR')`.
- Toda chamada à API passa por `buscarDados` (cache + tratamento de erro + estado "carregando").
- Comentários curtos explicando o "porquê", não o óbvio.
- Nunca colocar chaves, senhas ou dados pessoais no código.
- Cores: linha `#F7931A` (laranja Bitcoin), alta em verde, queda em vermelho, tema escuro.

## Fluxo de trabalho
1. Ler `plan.md` e trabalhar em **uma fase por vez**.
2. Ler os arquivos antes de alterá-los; fazer mudanças pequenas.
3. Testar no navegador (console F12 sem erros) antes de considerar a fase pronta.
4. Marcar os itens concluídos em `plan.md`.
5. Ao final de cada fase, propor um commit com mensagem clara em português (só commitar com aprovação do usuário).

## Comunicação
- Responder sempre em **português**.
- O usuário não é técnico: explicar cada passo de forma didática, como para alguém de 15 anos,
  com analogias simples e sem jargões desnecessários (se usar um termo técnico, explicar na hora).
