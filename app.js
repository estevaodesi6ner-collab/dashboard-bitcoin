// ===== Configurações =====
const URL_BASE = 'https://api.coingecko.com/api/v3';
const VALIDADE_CACHE_MS = 60 * 1000; // respostas guardadas por 1 minuto (a API gratuita limita as chamadas)
const MS_POR_DIA = 24 * 60 * 60 * 1000;
const DIAS_MAXIMOS = 365;             // a API gratuita só tem dados de até 365 dias atrás
const DIAS_PERIODO_INICIAL = 30;      // período mostrado no histórico ao abrir a página

let moedaAtual = 'brl';
const cache = new Map(); // url -> { momento, dados }
const graficos = {};     // id do canvas -> gráfico já desenhado (para poder redesenhar)

// Últimos dados recebidos. O histórico personalizado "recorta" daqui, sem novas chamadas à API.
let precosSemanais = null; // um preço por hora, últimos 7 dias
let precosAnuais = null;   // um preço por dia, últimos 365 dias

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
    // Quando a CoinGecko recusa por excesso de consultas, o navegador às vezes só vê "falha de conexão".
    throw new Error('Não foi possível falar com a CoinGecko. Geralmente é excesso de consultas seguidas '
      + '(a versão gratuita tem limite): aguarde 1 minuto e clique em "Atualizar". '
      + 'Se continuar, verifique sua internet.');
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

// Date -> "AAAA-MM-DD" (formato do <input type="date">), usando o fuso horário local.
function dataParaTexto(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

// "AAAA-MM-DD" -> Date à meia-noite local (new Date("AAAA-MM-DD") usaria o fuso de Londres).
function textoParaData(texto) {
  const [ano, mes, dia] = texto.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}

// Rótulo do eixo X em português, conforme a "régua" do gráfico. Ex.: "14:00", "25/11", "nov/25".
function formatarRotuloEixo(ms, unidade) {
  const data = new Date(ms);
  if (unidade === 'hour') {
    return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  if (unidade === 'month') {
    const mes = data.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    return `${mes}/${String(data.getFullYear()).slice(-2)}`;
  }
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function diasAtras(quantidade) {
  return new Date(Date.now() - quantidade * MS_POR_DIA);
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

// Mínimo, máximo, média e variação de uma lista de preços.
function calcularEstatisticas(precos) {
  const valores = precos.map(([, preco]) => preco);
  const soma = valores.reduce((total, valor) => total + valor, 0);
  return {
    minimo: Math.min(...valores),
    maximo: Math.max(...valores),
    media: soma / valores.length,
    variacao: calcularVariacao(precos),
  };
}

// ===== Gráficos =====

// Desenha (ou redesenha) um gráfico de linha. Usada por todos os gráficos do dashboard.
// opcoes.unidade: 'hour', 'day' ou 'month' (marcações do eixo X); opcoes.mostrarHora: hora no balão.
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
          time: { unit: opcoes.unidade || 'day' },
          ticks: {
            color: COR_TEXTO,
            maxTicksLimit: 12,
            callback: (valor) => formatarRotuloEixo(valor, opcoes.unidade || 'day'),
          },
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
    const moeda = moedaAtual;
    const url = `${URL_BASE}/coins/bitcoin/market_chart?vs_currency=${moeda}&days=7`;
    const dados = await buscarDados(url);
    if (moeda !== moedaAtual) return; // a moeda mudou enquanto esperávamos: ignora a resposta antiga

    precosSemanais = dados.prices;
    criarGrafico('grafico-semanal', dados.prices, { unidade: 'day', mostrarHora: true });
    mostrarVariacao(variacaoEl, calcularVariacao(dados.prices));
  } catch (erro) {
    variacaoEl.textContent = '—';
    mostrarErro(erro.message);
  }
}

// Gráfico do último ano + cartão "Variação 1 ano".
async function carregarAnual() {
  const variacaoEl = document.getElementById('variacao-1a');
  variacaoEl.textContent = 'Carregando…';

  try {
    const moeda = moedaAtual;
    const url = `${URL_BASE}/coins/bitcoin/market_chart?vs_currency=${moeda}&days=365`;
    const dados = await buscarDados(url);
    if (moeda !== moedaAtual) return; // a moeda mudou enquanto esperávamos: ignora a resposta antiga

    precosAnuais = dados.prices;
    criarGrafico('grafico-anual', dados.prices, { unidade: 'month' });
    mostrarVariacao(variacaoEl, calcularVariacao(dados.prices));
  } catch (erro) {
    variacaoEl.textContent = '—';
    mostrarErro(erro.message);
  }
}

// ===== Histórico personalizado =====

function mostrarAvisoPeriodo(mensagem) {
  const aviso = document.getElementById('aviso-periodo');
  aviso.textContent = mensagem;
  aviso.hidden = false;
}

function esconderAvisoPeriodo() {
  document.getElementById('aviso-periodo').hidden = true;
}

function limparEstatisticas() {
  ['estat-minimo', 'estat-maximo', 'estat-media', 'estat-variacao'].forEach((id) => {
    const elemento = document.getElementById(id);
    elemento.textContent = '—';
    elemento.classList.remove('alta', 'queda');
  });
}

// Confere se o período faz sentido. Devolve uma mensagem de problema, ou null se estiver tudo certo.
function validarPeriodo(textoInicio, textoFim) {
  if (!textoInicio || !textoFim) {
    return 'Escolha a data inicial e a data final.';
  }
  const inicio = textoParaData(textoInicio);
  const fim = textoParaData(textoFim);
  const hoje = textoParaData(dataParaTexto(new Date()));
  const limite = textoParaData(dataParaTexto(diasAtras(DIAS_MAXIMOS)));

  if (inicio >= fim) return 'A data inicial precisa ser anterior à data final.';
  if (fim > hoje) return 'A data final não pode estar no futuro.';
  if (inicio < limite) {
    return `A versão gratuita só tem dados a partir de ${formatarData(limite)}. Escolha uma data inicial mais recente.`;
  }
  return null;
}

// Escolhe a "régua" do eixo X conforme o tamanho do período.
function escolherUnidade(dias) {
  if (dias <= 2) return 'hour';
  if (dias <= 120) return 'day';
  return 'month';
}

// Mostra o gráfico + tabela do período escolhido nos campos de data.
// Não chama a API: recorta os dados já carregados pelos gráficos semanal e anual.
function carregarPeriodo() {
  const textoInicio = document.getElementById('data-inicio').value;
  const textoFim = document.getElementById('data-fim').value;

  const problema = validarPeriodo(textoInicio, textoFim);
  if (problema) {
    mostrarAvisoPeriodo(problema);
    return;
  }

  if (!precosAnuais) {
    limparEstatisticas();
    mostrarAvisoPeriodo('Os dados ainda não foram carregados. Clique em "Atualizar" e tente de novo.');
    return;
  }
  esconderAvisoPeriodo();

  // O fim vai até 23:59 do dia escolhido.
  const inicioMs = textoParaData(textoInicio).getTime();
  const fimMs = textoParaData(textoFim).getTime() + MS_POR_DIA - 1;

  // Períodos dentro da última semana usam os dados por hora (mais detalhe); os demais, os dados diários.
  const usarSemanal = precosSemanais && inicioMs >= precosSemanais[0][0];
  const fonte = usarSemanal ? precosSemanais : precosAnuais;
  const precos = fonte.filter(([ms]) => ms >= inicioMs && ms <= fimMs);

  if (precos.length < 2) {
    limparEstatisticas();
    mostrarAvisoPeriodo('Não há dados suficientes para esse período. Tente um intervalo maior.');
    return;
  }

  const dias = (fimMs - inicioMs) / MS_POR_DIA;
  criarGrafico('grafico-periodo', precos, {
    unidade: escolherUnidade(dias),
    mostrarHora: usarSemanal,
  });

  const estatisticas = calcularEstatisticas(precos);
  document.getElementById('estat-minimo').textContent = formatarMoeda(estatisticas.minimo);
  document.getElementById('estat-maximo').textContent = formatarMoeda(estatisticas.maximo);
  document.getElementById('estat-media').textContent = formatarMoeda(estatisticas.media);
  mostrarVariacao(document.getElementById('estat-variacao'), estatisticas.variacao);
}

// Destaca o atalho escolhido (ou nenhum, quando a pessoa mexe nas datas à mão).
function marcarAtalho(botaoAtivo) {
  document.querySelectorAll('.botao-atalho').forEach((botao) => {
    botao.classList.toggle('ativo', botao === botaoAtivo);
  });
}

// Preenche as datas com "últimos N dias" até hoje.
function preencherUltimosDias(dias) {
  document.getElementById('data-inicio').value = dataParaTexto(diasAtras(dias));
  document.getElementById('data-fim').value = dataParaTexto(new Date());
}

function configurarSeletorPeriodo() {
  const campoInicio = document.getElementById('data-inicio');
  const campoFim = document.getElementById('data-fim');

  // Limites do calendário: de 365 dias atrás até hoje.
  const minimo = dataParaTexto(diasAtras(DIAS_MAXIMOS));
  const maximo = dataParaTexto(new Date());
  [campoInicio, campoFim].forEach((campo) => {
    campo.min = minimo;
    campo.max = maximo;
    campo.addEventListener('input', () => marcarAtalho(null));
  });

  document.getElementById('form-periodo').addEventListener('submit', (evento) => {
    evento.preventDefault(); // impede o navegador de recarregar a página
    carregarPeriodo();
  });

  document.querySelectorAll('.botao-atalho').forEach((botao) => {
    botao.addEventListener('click', () => {
      preencherUltimosDias(Number(botao.dataset.dias));
      marcarAtalho(botao);
      carregarPeriodo();
    });
  });

  // Período inicial: últimos 30 dias.
  preencherUltimosDias(DIAS_PERIODO_INICIAL);
  marcarAtalho(document.querySelector(`.botao-atalho[data-dias="${DIAS_PERIODO_INICIAL}"]`));
}

// ===== Início =====

async function atualizarTudo() {
  esconderErro(); // limpa avisos antigos; cada seção mostra o seu se falhar
  atualizarResumo();
  // O histórico depende dos dados semanais e anuais, então espera os dois chegarem.
  await Promise.all([carregarSemanal(), carregarAnual()]);
  carregarPeriodo();
}

// Troca entre real (BRL) e dólar (USD) e recarrega tudo na nova moeda.
function trocarMoeda(novaMoeda) {
  if (novaMoeda === moedaAtual) return;
  moedaAtual = novaMoeda;

  document.querySelectorAll('.botao-moeda').forEach((botao) => {
    const ativo = botao.dataset.moeda === novaMoeda;
    botao.classList.toggle('ativo', ativo);
    botao.setAttribute('aria-pressed', ativo);
  });

  // Esquece os dados da moeda anterior para o histórico não misturar moedas.
  precosSemanais = null;
  precosAnuais = null;
  atualizarTudo();
}

function iniciar() {
  document.getElementById('botao-atualizar').addEventListener('click', atualizarTudo);
  document.querySelectorAll('.botao-moeda').forEach((botao) => {
    botao.addEventListener('click', () => trocarMoeda(botao.dataset.moeda));
  });
  configurarSeletorPeriodo();
  atualizarTudo();
}

document.addEventListener('DOMContentLoaded', iniciar);
