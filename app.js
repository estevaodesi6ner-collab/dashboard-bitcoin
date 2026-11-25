// ===== Configurações =====
const URL_BASE = 'https://api.coingecko.com/api/v3';
const VALIDADE_CACHE_MS = 60 * 1000; // respostas guardadas por 1 minuto (a API gratuita limita as chamadas)

let moedaAtual = 'brl';
const cache = new Map(); // url -> { momento, dados }

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
    esconderErro();
    marcarAtualizacao();
  } catch (erro) {
    precoEl.textContent = '—';
    variacaoEl.textContent = '—';
    mostrarErro(erro.message);
  }
}

// ===== Início =====

function iniciar() {
  document.getElementById('botao-atualizar').addEventListener('click', atualizarResumo);
  atualizarResumo();
}

document.addEventListener('DOMContentLoaded', iniciar);
