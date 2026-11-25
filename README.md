# ₿ Dashboard Bitcoin

Página simples que mostra o preço do Bitcoin com dados gratuitos da [CoinGecko](https://www.coingecko.com/).

## O que tem no dashboard
- **Cartões de resumo:** preço atual e variação em 24 horas, 7 dias e 1 ano (verde = alta, vermelho = queda).
- **Gráfico dos últimos 7 dias** (um ponto por hora).
- **Gráfico do último ano** (um ponto por dia).
- **Histórico personalizado:** escolha as datas ou use os atalhos (30 dias, 90 dias, 6 meses, 1 ano) e veja
  o gráfico e a tabela com mínimo, máximo, média e variação do período.
- **Botão BRL / USD** para ver os valores em reais ou dólares.

## Como abrir
1. Dê dois cliques no arquivo `index.html`. Ele abre no seu navegador (Chrome, Edge, Firefox…).
2. Pronto! É preciso estar conectado à internet.

Não é necessário instalar nada.

## Como usar
- Passe o mouse (ou toque, no celular) sobre um gráfico para ver a data e o preço exatos.
- Clique em **Atualizar** para buscar os preços mais recentes.
- No **Histórico personalizado**, escolha as datas em "De" e "Até" e clique em **Ver período**.

## Limites da versão gratuita da CoinGecko
- **Só há dados de até 1 ano atrás.** Por isso o calendário não deixa escolher datas mais antigas.
- **Poucas consultas por minuto.** Se aparecer a faixa vermelha dizendo que não foi possível falar com a
  CoinGecko, aguarde 1 minuto e clique em **Atualizar**.
- Para economizar consultas, a página guarda as respostas por 1 minuto, e o histórico personalizado
  reaproveita os dados que já foram carregados (não faz consultas novas a cada clique).

## Arquivos
| Arquivo | Para que serve |
|---|---|
| `index.html` | Estrutura da página (o que aparece e onde). |
| `style.css` | Visual: cores, tamanhos, layout no computador e no celular. |
| `app.js` | Busca os dados na CoinGecko, faz os cálculos e desenha os gráficos. |
| `plan.md` | Roteiro do projeto, fase por fase. |
| `CLAUDE.md` | Regras do projeto para o Claude Code. |

## Tecnologias
HTML, CSS e JavaScript puro, com [Chart.js](https://www.chartjs.org/) para os gráficos.
