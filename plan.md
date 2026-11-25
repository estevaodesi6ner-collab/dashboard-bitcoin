# Plano do Projeto — Dashboard de Bitcoin

## 1. Objetivo
Criar uma página web (dashboard) que mostra o preço do Bitcoin de forma clara e visual, com:
- Gráfico de variação **semanal** (últimos 7 dias);
- Gráfico de variação **anual** (últimos 365 dias);
- Visualização clara dos **dados históricos** (gráfico + tabela de resumo);
- **Seletor de período** (data inicial e final) interativo.

Prioridades: **simplicidade**, **boa visualização** e **fácil implementação para iniciantes**.

---

## 2. Stack (ferramentas escolhidas)

| Peça | Escolha | Por quê |
|---|---|---|
| Estrutura | HTML | O "esqueleto" da página. Todo navegador entende. |
| Visual | CSS puro | As "roupas" da página: cores, tamanhos, posições. |
| Lógica | JavaScript puro | O "cérebro": busca os dados e desenha os gráficos. |
| Gráficos | [Chart.js 4](https://www.chartjs.org/) via CDN | Biblioteca de gráficos simples, bonita e bem documentada. |
| Eixo de datas | `chartjs-adapter-date-fns` via CDN | Ensina o Chart.js a entender datas. |
| Seletor de datas | `<input type="date">` nativo | Já vem no navegador, sem instalar nada. |
| Dados | [CoinGecko API](https://docs.coingecko.com/) (pública) | Gratuita e sem cadastro/chave. |

**Sem** frameworks (React, Vue…), **sem** npm, **sem** etapa de build. Basta abrir o `index.html` no navegador.

Links de CDN (colocar no fim do `<body>`, antes do `app.js`):
```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3"></script>
```

---

## 3. API — CoinGecko (sem chave)

URL base: `https://api.coingecko.com/api/v3`

| Uso | Endpoint |
|---|---|
| Cartões de resumo (preço atual e variação 24h) | `/simple/price?ids=bitcoin&vs_currencies=brl,usd&include_24hr_change=true` |
| Gráfico semanal | `/coins/bitcoin/market_chart?vs_currency=brl&days=7` |
| Gráfico anual | `/coins/bitcoin/market_chart?vs_currency=brl&days=365` |
| Período personalizado | `/coins/bitcoin/market_chart/range?vs_currency=brl&from=<unix>&to=<unix>` |

**Formato da resposta de `market_chart`:**
```json
{ "prices": [[1732492800000, 560123.45], ...], "market_caps": [...], "total_volumes": [...] }
```
Cada item de `prices` é `[data em milissegundos, preço]`.
Atenção: no endpoint `/range`, os parâmetros `from` e `to` estão em **segundos** (não milissegundos).

**Limites importantes da versão gratuita:**
- Só há dados de **até 365 dias atrás** → o seletor de datas deve bloquear datas mais antigas.
- Aceita poucas chamadas por minuto (~5 a 30) → guardar respostas em **cache** (memória) e **não** atualizar sozinho em loop.
- Se a API responder com erro `429`, mostrar: "Muitas consultas seguidas. Aguarde um minuto e tente de novo."

---

## 4. Estrutura de arquivos

```
dashboard-bitcoin/
├── CLAUDE.md      ← regras do projeto para o Claude Code
├── plan.md        ← este roteiro
├── README.md      ← como usar (criado na fase 6)
├── .gitignore
├── index.html     ← estrutura da página
├── style.css      ← visual (tema escuro, responsivo)
└── app.js         ← busca de dados + gráficos
```

### Funções principais do `app.js`
| Função | O que faz |
|---|---|
| `buscarDados(url)` | Faz a chamada à API, guarda em cache e trata erros. |
| `formatarMoeda(valor)` | Ex.: `560123.45` → `R$ 560.123,45` (usa `Intl.NumberFormat('pt-BR')`). |
| `formatarData(ms)` | Ex.: `1732492800000` → `25/11/2026`. |
| `calcularVariacao(precos)` | % entre o primeiro e o último preço. |
| `calcularEstatisticas(precos)` | Mínimo, máximo, média e variação de um período. |
| `criarGrafico(canvas, precos, opcoes)` | Desenha (ou redesenha) um gráfico de linha. Reutilizada pelos 3 gráficos. |
| `atualizarResumo()` | Preenche os cartões do topo. |
| `carregarSemanal()` / `carregarAnual()` | Buscam os dados e desenham os gráficos fixos. |
| `carregarPeriodo(inicio, fim)` | Valida as datas, busca e desenha o gráfico + tabela do período. |

---

## 5. Layout da página

```
┌──────────────────────────────────────────────────────┐
│  ₿ Dashboard Bitcoin          [BRL|USD]  Atualizado: 14:32 │
├────────────┬────────────┬────────────┬───────────────┤
│ Preço atual│ Var. 24h   │ Var. 7 dias│ Var. 1 ano    │
│ R$ 560 mil │ ▲ +2,1%    │ ▼ -1,4%    │ ▲ +85%        │
├────────────┴────────────┴────────────┴───────────────┤
│  Últimos 7 dias                 [gráfico de linha]    │
├──────────────────────────────────────────────────────┤
│  Último ano                     [gráfico de linha]    │
├──────────────────────────────────────────────────────┤
│  Histórico personalizado                              │
│  De [__/__/____]  Até [__/__/____]  [Ver]             │
│  Atalhos: [30d] [90d] [6m] [1a]                       │
│  [gráfico de linha]                                   │
│  Mínimo | Máximo | Média | Variação no período        │
└──────────────────────────────────────────────────────┘
```
- Cores: alta em **verde**, queda em **vermelho**, linha do gráfico em laranja Bitcoin (`#F7931A`).
- Tema escuro, cartões com cantos arredondados.
- No celular: os cartões ficam empilhados (um embaixo do outro).

---

## 6. Fases de desenvolvimento

Cada fase é pequena, testada no navegador e salva com um **commit** no Git (um "ponto de salvamento").

### Fase 0 — Preparação
- [x] Criar a pasta `dashboard-bitcoin/`, `plan.md` e `CLAUDE.md`.
- [x] `git init` e criar `.gitignore` (ignorar `.vscode/`, `.DS_Store`, `Thumbs.db`).
- **Pronto quando:** a pasta existe e o primeiro commit foi feito.

### Fase 1 — Esqueleto da página
- [x] `index.html` com cabeçalho, 4 cartões, 3 áreas de gráfico (`<canvas>`) e o seletor de datas.
- [x] `style.css` com tema escuro e grade responsiva (CSS Grid).
- **Pronto quando:** abrir `index.html` mostra o layout com espaços vazios, sem erros no console (F12).

### Fase 2 — Primeiros dados reais
- [x] Criar `buscarDados`, `formatarMoeda`, `formatarData`.
- [x] Preencher o cartão "Preço atual" e "Var. 24h" com `/simple/price`.
- [x] Mostrar "Carregando…" enquanto espera e mensagem amigável em caso de erro.
- **Pronto quando:** o preço real do Bitcoin aparece na tela.

### Fase 3 — Gráfico semanal
- [ ] Criar `criarGrafico` com Chart.js (linha, eixo X de datas, tooltip com preço formatado).
- [ ] `carregarSemanal()` usando `days=7`; preencher o cartão "Var. 7 dias".
- **Pronto quando:** o gráfico dos 7 dias aparece e, ao passar o mouse, mostra data e preço.

### Fase 4 — Gráfico anual
- [ ] `carregarAnual()` usando `days=365`, reaproveitando `criarGrafico`; preencher "Var. 1 ano".
- **Pronto quando:** o gráfico anual aparece com os meses no eixo X.

### Fase 5 — Seletor de período + histórico
- [ ] Inputs de data com `min` = hoje − 365 dias e `max` = hoje.
- [ ] Validação: início antes do fim, nada no futuro, nada além de 365 dias.
- [ ] Botões de atalho (30d, 90d, 6m, 1a) que preenchem as datas automaticamente.
- [ ] `carregarPeriodo` com `/market_chart/range` + tabela com mínimo, máximo, média e variação.
- **Pronto quando:** escolher datas válidas atualiza o gráfico e a tabela; datas inválidas mostram aviso claro.

### Fase 6 — Acabamento
- [ ] Botão BRL/USD (refaz as buscas na outra moeda, usando o cache quando possível).
- [ ] Ajustes para celular (testar no F12 → modo dispositivo).
- [ ] Horário da "última atualização" e botão "Atualizar".
- [ ] `README.md` curto explicando como abrir e usar.
- **Pronto quando:** tudo funciona no computador e no celular, sem erros no console.

---

## 7. Como testar
1. Abrir `index.html` com dois cliques (ou "Open with Live Server" no VS Code).
2. Apertar **F12** → aba **Console**: não deve haver erros vermelhos.
3. Conferir se o preço exibido bate com o site da CoinGecko.
4. Testar o seletor: período válido, data inicial depois da final, data de mais de 1 ano atrás.
5. Testar no modo celular (F12 → ícone de celular).

## 8. Melhorias futuras (fora do escopo agora)
- Outras moedas (Ethereum etc.).
- Gráfico de volume negociado.
- Histórico com mais de 1 ano (exigiria outra API ou chave da CoinGecko).
- Publicar o site gratuitamente (GitHub Pages).
