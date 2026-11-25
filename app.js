// ===== Configurações =====
const URL_BASE = 'https://api.coingecko.com/api/v3';
const VALIDADE_CACHE_MS = 60 * 1000; // respostas guardadas por 1 minuto (a API gratuita limita as chamadas)

let moedaAtual = 'brl';
const cache = new Map(); // url -> { momento, dados }
const graficos = {};     // id do canvas -> gráfico já desenhado (para poder redesenhar)

const COR_LINHA = '#f7931a';
const COR_TEXTO = '#9aa0aa';
const COR_GRADE = 'rgba(255, 255, 255, 0.06)';

// ===== Acesso à API =====

// Busca dados na API reaproveitando respostas recentes do cache.
async function buscarDados(url) {
  const guardado = cache.get(url);
  if (guardado && Date.now() - guardado.momento < VALIDADE_CACHE_MS) {
    return guardado.dados;
  }

  let resposta;
  try {
    resposta = await fetch(url);
  } catch {
    throw new Error('Não foi possível conectar à CoinGecko. Verifique sua internet.');
  }

  if (resposta.status === 429) {
    throw new Error('Muitas consultas seguidas. Aguarde um minuto e tente de novo.');
  }
  if (!resposta.ok) {
    throw new Error(`A CoinGecko respondeu com erro (${resposta.status}). Tente novamente mais tarde.`);
  }

  const dados = await resposta.json();
  cache.set(url, { momento: Date.now(), dados });
  return dados;
}

// ===== Formatação =====

function formatarMoeda(valor, moeda = moedaAtual) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: moeda.toUpperCase(),
  }).format(valor);
}

function formatarData(ms) {
  return new Date(ms).toLocaleDateString('pt-BR');
}

function formatarPercentual(valor) {
  const seta = valor >= 0 ? '▲' : '▼';
  const sinal = valor >= 0 ? '+' : '';
  const numero = valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${seta} ${sinal}${numero}%`;
}

// Escreve a variação no elemento e pinta de verde (alta) ou vermelho (queda).
function mostrarVariacao(elemento, valor) {
  elemento.textContent = formatarPercentual(valor);
  elemento.classList.toggle('alta', valor >= 0);
  elemento.classList.toggle('queda', valor < 0);
}

// ===== Mensagens na tela =====

function mostrarErro(mensagem) {
  const caixa = document.getElementById('mensagem-erro');
  caixa.textContent = mensagem;
  caixa.hidden = false;
}

function esconderErro() {
  document.getElementById('mensagem-erro').hidden = true;
}

function marcarAtualizacao() {
  const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  document.getElementById('ultima-atualizacao').textContent = `Atualizado: ${hora}`;
}

// ===== Cálculos =====

// Variação em % entre o primeiro e o último preço. `precos` = [[ms, preço], ...]
function calcularVariacao(precos) {
  const primeiro = precos[0][1];
  const ultimo = precos[precos.length - 1][1];
  return ((ultimo - primeiro) / primeiro) * 100;
}

// ===== Gráficos =====

// Desenha (ou redesenha) um gráfico de linha. Usada por todos os gráficos do dashboard.
// opcoes.unidade: 'day' ou 'month' (marcações do eixo X); opcoes.mostrarHora: hora no balão.
function criarGrafico(idCanvas, precos, opcoes = {}) {
  if (graficos[idCanvas]) {
    graficos[idCanvas].destroy(); // apaga o desenho anterior antes de desenhar de novo
  }

  const pontos = precos.map(([ms, preco]) => ({ x: ms, y: preco }));
  const canvas = document.getElementById(idCanvas);

  graficos[idCanvas] = new Chart(canvas, {
    type: 'line',
    data: {
      datasets: [{
        data: pontos,
        borderColor: COR_LINHA,
        backgroundColor: 'rgba(247, 147, 26, 0.12)',
        fill: true,
        borderWidth: 2,
        pointRadius: 0,     // sem bolinhas em cada ponto (fica mais limpo)
        pointHoverRadius: 4,
        tension: 0.2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false }, // balão aparece só de passar o mouse perto
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (itens) => {
              const data = new Date(itens[0].parsed.x);
              return opcoes.mostrarHora
                ? data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                : formatarData(data);
            },
            label: (item) => formatarMoeda(item.parsed.y),
          },
        },
      },
      scales: {
        x: {
          type: 'time',
          time: {
            unit: opcoes.unidade || 'day',
            displayFormats: { day: 'dd/MM', month: 'MMM/yy' },
          },
          ticks: { color: COR_TEXTO, maxTicksLimit: 12 },
          grid: { color: COR_GRADE },
        },
        y: {
          ticks: {
            color: COR_TEXTO,
            // valores do eixo em formato curto, ex.: "R$ 350 mil"
            callback: (valor) => new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: moedaAtual.toUpperCase(),
              notation: 'compact',
            }).format(valor),
          },
          grid: { color: COR_GRADE },
        },
      },
    },
  });
}

// ===== Seções do dashboard =====

// Preenche os cartões "Preço atual" e "Variação 24h".
async function atualizarResumo() {
  const precoEl = document.getElementById('preco-atual');
  const variacaoEl = document.getElementById('variacao-24h');
  precoEl.textContent = 'Carregando…';
  variacaoEl.textContent = 'Carregando…';

  try {
    const url = `${URL_BASE}/simple/price?ids=bitcoin&vs_currencies=brl,usd&include_24hr_change=true`;
    const dados = await buscarDados(url);
    const bitcoin = dados.bitcoin;

    precoEl.textContent = formatarMoeda(bitcoin[moedaAtual]);
    mostrarVariacao(variacaoEl, bitcoin[`${moedaAtual}_24h_change`]);
    marcarAtualizacao();
  } catch (erro) {
    precoEl.textContent = '—';
    variacaoEl.textContent = '—';
    mostrarErro(erro.message);
  }
}

// Gráfico dos últimos 7 dias + cartão "Variação 7 dias".
async function carregarSemanal() {
  const variacaoEl = document.getElementById('variacao-7d');
  variacaoEl.textContent = 'Carregando…';

  try {
    const url = `${URL_BASE}/coins/bitcoin/market_chart?vs_currency=${moedaAtual}&days=7`;
    const dados = await buscarDados(url);

    criarGrafico('grafico-semanal', dados.prices, { unidade: 'day', mostrarHora: true });
    mostrarVariacao(variacaoEl, calcularVariacao(dados.prices));
  } catch (erro) {
    variacaoEl.textContent = '—';
    mostrarErro(erro.message);
  }
}

// ===== Início =====

function atualizarTudo() {
  esconderErro(); // limpa avisos antigos; cada seção mostra o seu se falhar
  atualizarResumo();
  carregarSemanal();
}

function iniciar() {
  document.getElementById('botao-atualizar').addEventListener('click', atualizarTudo);
  atualizarTudo();
}

document.addEventListener('DOMContentLoaded', iniciar);
