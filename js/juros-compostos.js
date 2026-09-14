let modoAtual = 'quantoVouTer';
let chartInstance = null;
let debounceTimer = null;

// Sanitização estrita e limites de segurança (Impede negativos e estouro visual)
function obterNumeroSeguro(idInput, min, max, valorPadrao = 0) {
  const el = document.getElementById(idInput);
  if (!el) return valorPadrao;
  
  let val = parseFloat(el.value);

  if (isNaN(val) || val < min) {
    val = min;
    if (document.activeElement !== el) el.value = min; // Corrige o campo visual se desfocado ou inválido
  } else if (val > max) {
    val = max;
    el.value = max; // Trava estouros de layout no valor máximo
  }
  
  return val;
}

document.addEventListener("DOMContentLoaded", () => {
  // Configuração inicial do tema
  const temaSalvo = localStorage.getItem('theme');
  if (temaSalvo === 'dark') {
    document.body.classList.add('dark-mode');
    const btnTheme = document.getElementById('btnTheme');
    if (btnTheme) btnTheme.innerText = '☀️';
    Chart.defaults.color = '#94a3b8';
  } else {
    Chart.defaults.color = '#64748b';
  }

  // Configuração de idioma
  const langSalvo = localStorage.getItem('app_lang_code') || 'br';
  const imgLangAtual = document.getElementById('imgLangAtual');
  if (imgLangAtual) {
    imgLangAtual.src = `https://flagcdn.com/w40/${langSalvo}.png`;
  }
  
  // Prioridade: Se existirem dados na URL, carrega da URL; senão, do LocalStorage
  const carregouURL = carregarParametrosURL();
  if (!carregouURL) {
    carregarEstado();
  }

  // Vincula o evento de clique para evitar falhas em navegadores móveis
  const btnCompartilhar = document.getElementById('btnCopiarLink');
  if (btnCompartilhar) {
    btnCompartilhar.addEventListener('click', copiarLinkSimulacao);
  }

  atualizarECalcular();
});

// Compartilhamento seguro (Previne XSS via URL)
function copiarLinkSimulacao(e) {
  if (e) e.preventDefault();

  const params = new URLSearchParams({
    modo: modoAtual || 'quantoVouTer',
    vInit: obterNumeroSeguro('valorInicial', 0, 1000000000, 0),
    vMensal: obterNumeroSeguro('valorMensal', 0, 10000000, 500),
    meta: obterNumeroSeguro('metaTotal', 1, 10000000000, 1000000),
    taxa: obterNumeroSeguro('taxaJuros', 0, 500, 10),
    anos: obterNumeroSeguro('anos', 1, 50, 20),
    aumento: obterNumeroSeguro('aumentoAnual', 0, 100, 0)
  });

  const urlCompleta = `${window.location.origin}${window.location.pathname}?${params.toString()}`;

  if (navigator.share) {
    navigator.share({ title: 'Simulação Financeira', url: urlCompleta })
      .then(() => notificarSucessoCopiar())
      .catch((err) => {
        if (err.name !== 'AbortError') executarCopiaManual(urlCompleta);
      });
    return;
  }

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(urlCompleta)
      .then(() => notificarSucessoCopiar())
      .catch(() => executarCopiaManual(urlCompleta));
    return;
  }

  executarCopiaManual(urlCompleta);
}

function executarCopiaManual(texto) {
  let copiadoComSucesso = false;

  try {
    const textArea = document.createElement('textarea');
    textArea.value = texto;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    copiadoComSucesso = document.execCommand('copy');
    document.body.removeChild(textArea);
  } catch (err) {
    copiadoComSucesso = false;
  }

  if (copiadoComSucesso) {
    notificarSucessoCopiar();
  } else {
    window.prompt('Copie o link da sua simulação abaixo:', texto);
  }
}

function notificarSucessoCopiar() {
  const btn = document.getElementById('btnCopiarLink');
  if (btn) {
    const textoOriginal = btn.innerText;
    btn.innerText = '✅ Link Copiado!';
    setTimeout(() => { btn.innerText = textoOriginal; }, 2000);
  }
}

// Fechar o menu de idiomas ao clicar fora
document.addEventListener('click', (e) => {
  const containerDropdown = document.querySelector('.lang-dropdown');
  if (containerDropdown && !containerDropdown.contains(e.target)) {
    const menu = document.getElementById('menuIdiomas');
    if (menu) menu.classList.remove('show');
  }
});

function toggleLangMenu(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('menuIdiomas');
  if (menu) menu.classList.toggle('show');
}

function traduzirPagina(langCode, countryCode) {
  localStorage.setItem('app_lang_code', countryCode);
  
  const imgLangAtual = document.getElementById('imgLangAtual');
  if (imgLangAtual) imgLangAtual.src = `https://flagcdn.com/w40/${countryCode}.png`;

  document.cookie = `googtrans=/pt/${langCode}; path=/;`;
  document.cookie = `googtrans=/pt/${langCode}; domain=${window.location.hostname}; path=/;`;

  const selectTranslate = document.querySelector('.goog-te-combo');
  if (selectTranslate && selectTranslate.value !== undefined) {
    selectTranslate.value = langCode;
    selectTranslate.dispatchEvent(new Event('change'));
  } else {
    window.location.reload();
  }

  const menu = document.getElementById('menuIdiomas');
  if (menu) menu.classList.remove('show');
}

function agendarCalculo() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    salvarEstado();
    atualizarECalcular();
  }, 100);
}

function setModo(modo) {
  if (modoAtual === modo && document.querySelector('.tab-btn.active')) return;
  modoAtual = modo;

  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  
  const containerVouTer = document.getElementById('modoQuantoVouTer');
  const containerInvestir = document.getElementById('modoQuantoInvestir');

  if (modo === 'quantoVouTer') {
    document.getElementById('tabQuantoVouTer')?.classList.add('active');
    if (containerVouTer) containerVouTer.style.display = 'block';
    if (containerInvestir) containerInvestir.style.display = 'none';
    setElementText('calcTitle', 'Simulador de Juros Compostos');
    setElementText('calcDesc', 'Projete o crescimento do seu patrimônio em tempo real.');
    setElementText('resTitle', 'Projeção Final');
  } else {
    document.getElementById('tabQuantoInvestir')?.classList.add('active');
    if (containerVouTer) containerVouTer.style.display = 'none';
    if (containerInvestir) containerInvestir.style.display = 'block';
    setElementText('calcTitle', 'Calculadora de Meta Financeira');
    setElementText('calcDesc', 'Descubra quanto precisa investir por mês para chegar ao seu objetivo.');
    setElementText('resTitle', 'Aporte Mensal Necessário');
  }

  agendarCalculo();
}

function setElementText(id, text) {
  const el = document.getElementById(id);
  if (el) el.innerText = text;
}

function sincronizarAporteInput() {
  const val = obterNumeroSeguro('valorMensal', 0, 10000000, 500);
  const slider = document.getElementById('sliderAporte');
  const label = document.getElementById('labelAporteSlider');
  if (slider) slider.value = Math.min(val, 10000);
  if (label) label.innerText = formatarMoeda(val);
  agendarCalculo();
}

function sincronizarAporteSlider() {
  const slider = document.getElementById('sliderAporte');
  if (!slider) return;
  const val = slider.value;
  const input = document.getElementById('valorMensal');
  const label = document.getElementById('labelAporteSlider');
  if (input) input.value = val;
  if (label) label.innerText = formatarMoeda(val);
  agendarCalculo();
}

function sincronizarAnosInput() {
  const val = obterNumeroSeguro('anos', 1, 50, 20);
  const slider = document.getElementById('sliderAnos');
  const label = document.getElementById('labelAnosSlider');
  if (slider) slider.value = val;
  if (label) label.innerText = `${val} anos`;
  agendarCalculo();
}

function sincronizarAnosSlider() {
  const slider = document.getElementById('sliderAnos');
  if (!slider) return;
  const val = slider.value;
  const input = document.getElementById('anos');
  const label = document.getElementById('labelAnosSlider');
  if (input) input.value = val;
  if (label) label.innerText = `${val} anos`;
  agendarCalculo();
}

function adicionarAporte(valorExtra) {
  if (modoAtual === 'quantoVouTer') {
    const inputAporte = document.getElementById('valorMensal');
    if (inputAporte) {
      const valorAtual = parseFloat(inputAporte.value) || 0;
      inputAporte.value = Math.min(valorAtual + valorExtra, 10000000);
      sincronizarAporteInput();
    }
  } else {
    const inputMeta = document.getElementById('metaTotal');
    if (inputMeta) {
      const valorAtual = parseFloat(inputMeta.value) || 0;
      inputMeta.value = Math.min(valorAtual + (valorExtra * 12), 10000000000);
      agendarCalculo();
    }
  }
}

function adicionarAnos(anosExtras) {
  const inputAnos = document.getElementById('anos');
  if (inputAnos) {
    const valorAtual = parseInt(inputAnos.value) || 0;
    inputAnos.value = Math.min(valorAtual + anosExtras, 50);
    sincronizarAnosInput();
  }
}

function resetarSimulacao() {
  const elValInit = document.getElementById('valorInicial');
  const elValMensal = document.getElementById('valorMensal');
  const elMeta = document.getElementById('metaTotal');
  const elTaxa = document.getElementById('taxaJuros');
  const elAnos = document.getElementById('anos');
  const elAumento = document.getElementById('aumentoAnual');

  if (elValInit) elValInit.value = 0;
  if (elValMensal) elValMensal.value = 500;
  if (elMeta) elMeta.value = 1000000;
  if (elTaxa) elTaxa.value = 10;
  if (elAnos) elAnos.value = 20;
  if (elAumento) elAumento.value = 0;
  
  sincronizarAporteInput();
  sincronizarAnosInput();
}

function salvarEstado() {
  localStorage.setItem('sl_modo', modoAtual);
  localStorage.setItem('sl_valInit', obterNumeroSeguro('valorInicial', 0, 1000000000, 0));
  localStorage.setItem('sl_valMensal', obterNumeroSeguro('valorMensal', 0, 10000000, 500));
  localStorage.setItem('sl_meta', obterNumeroSeguro('metaTotal', 1, 10000000000, 1000000));
  localStorage.setItem('sl_taxa', obterNumeroSeguro('taxaJuros', 0, 500, 10));
  localStorage.setItem('sl_anos', obterNumeroSeguro('anos', 1, 50, 20));
  localStorage.setItem('sl_aumento', obterNumeroSeguro('aumentoAnual', 0, 100, 0));
}

function carregarEstado() {
  const savedModo = localStorage.getItem('sl_modo');
  if (savedModo) setModo(savedModo);

  if (localStorage.getItem('sl_valInit') !== null) document.getElementById('valorInicial').value = localStorage.getItem('sl_valInit');
  if (localStorage.getItem('sl_valMensal') !== null) document.getElementById('valorMensal').value = localStorage.getItem('sl_valMensal');
  if (localStorage.getItem('sl_meta') !== null) document.getElementById('metaTotal').value = localStorage.getItem('sl_meta');
  if (localStorage.getItem('sl_taxa') !== null) document.getElementById('taxaJuros').value = localStorage.getItem('sl_taxa');
  if (localStorage.getItem('sl_anos') !== null) document.getElementById('anos').value = localStorage.getItem('sl_anos');
  if (localStorage.getItem('sl_aumento') !== null) document.getElementById('aumentoAnual').value = localStorage.getItem('sl_aumento');

  sincronizarAporteInput();
  sincronizarAnosInput();
}

function carregarParametrosURL() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('modo') && !params.has('vInit')) return false;

  if (params.get('modo')) setModo(params.get('modo'));
  if (params.has('vInit')) document.getElementById('valorInicial').value = params.get('vInit');
  if (params.has('vMensal')) document.getElementById('valorMensal').value = params.get('vMensal');
  if (params.has('meta')) document.getElementById('metaTotal').value = params.get('meta');
  if (params.has('taxa')) document.getElementById('taxaJuros').value = params.get('taxa');
  if (params.has('anos')) document.getElementById('anos').value = params.get('anos');
  if (params.has('aumento')) document.getElementById('aumentoAnual').value = params.get('aumento');

  sincronizarAporteInput();
  sincronizarAnosInput();
  return true;
}

function atualizarECalcular() {
  const p = obterNumeroSeguro('valorInicial', 0, 1000000000, 0);
  const taxaAnual = obterNumeroSeguro('taxaJuros', 0, 500, 0);
  const anos = Math.round(obterNumeroSeguro('anos', 1, 50, 20));
  const pctAumentoAnual = obterNumeroSeguro('aumentoAnual', 0, 100, 0);
  
  const meses = anos * 12;
  const iMensal = Math.pow(1 + (taxaAnual / 100), 1/12) - 1;

  if (modoAtual === 'quantoVouTer') {
    const pm = obterNumeroSeguro('valorMensal', 0, 10000000, 500);
    const res = simularCrescimento(p, pm, iMensal, meses, pctAumentoAnual);
    
    const totalFinalEl = document.getElementById('totalFinal');
    if (totalFinalEl) totalFinalEl.innerHTML = `${formatarMoeda(res.totalFinal)} <span>Valor acumulado total</span>`;
    
    setElementText('totalInvestido', formatarMoeda(res.totalInvestido));
    setElementText('totalJuros', formatarMoeda(res.totalJuros));

    renderizarGrafico(res.labelsMeses, res.dadosInvestido, res.dadosJuros);
    
    const jurosUltimosAnos = res.dadosJuros[res.dadosJuros.length - 1] - (res.dadosJuros[Math.floor(res.dadosJuros.length * 0.75)] || 0);
    const cardTempo = document.getElementById('cardEfeitoTempo');
    if (cardTempo) {
      cardTempo.innerHTML = `🚀 <strong>O Efeito do Tempo:</strong> Nos últimos 25% do período (${Math.round(anos*0.25)} anos), seus juros renderam <strong>${formatarMoeda(jurosUltimosAnos)}</strong> do total acumulado!`;
    }

    renderizarTabelaCenarios(p, pm, iMensal, meses, pctAumentoAnual);
    renderizar3Cenarios(p, pm, meses, pctAumentoAnual);
    atualizarResumoDinamico(modoAtual, pm, anos, taxaAnual, pctAumentoAnual, res.totalFinal, null);

  } else {
    const meta = obterNumeroSeguro('metaTotal', 1, 10000000000, 1000000);
    const aporteNecessario = calcularAporteParaMetaMapeado(p, meta, iMensal, meses, pctAumentoAnual);
    const res = simularCrescimento(p, aporteNecessario, iMensal, meses, pctAumentoAnual);

    let textoAporte = `por mês para atingir ${formatarMoeda(meta)}`;
    if (pctAumentoAnual > 0) {
      textoAporte += ` (com aumento de ${pctAumentoAnual}% ao ano)`;
    }

    const totalFinalEl = document.getElementById('totalFinal');
    if (totalFinalEl) totalFinalEl.innerHTML = `${formatarMoeda(aporteNecessario)} <span>${textoAporte}</span>`;
    
    setElementText('totalInvestido', formatarMoeda(res.totalInvestido));
    setElementText('totalJuros', formatarMoeda(res.totalFinal - res.totalInvestido));
    
    renderizarGrafico(res.labelsMeses, res.dadosInvestido, res.dadosJuros);
    
    const cardTempo = document.getElementById('cardEfeitoTempo');
    if (cardTempo) {
      cardTempo.innerHTML = `🎯 <strong>Estratégia para Meta:</strong> Começando com <strong>${formatarMoeda(aporteNecessario)}/mês</strong> e reajustando <strong>${pctAumentoAnual}% ao ano</strong>, você atinge o objetivo!`;
    }

    renderizarTabelaCenarios(p, aporteNecessario, iMensal, meses, pctAumentoAnual);
    renderizar3Cenarios(p, aporteNecessario, meses, pctAumentoAnual);
    atualizarResumoDinamico(modoAtual, aporteNecessario, anos, taxaAnual, pctAumentoAnual, res.totalFinal, meta);
  }
}

function simularCrescimento(pInicial, pMensal, taxaMensal, totalMeses, pctAumentoAnual) {
  let montante = pInicial;
  let totalInvestido = pInicial;
  let aporteAtual = pMensal;

  const labelsMeses = new Array(totalMeses);
  const dadosInvestido = new Array(totalMeses);
  const dadosJuros = new Array(totalMeses);

  for (let m = 1; m <= totalMeses; m++) {
    if (m > 1 && m % 12 === 1 && pctAumentoAnual > 0) {
      aporteAtual += aporteAtual * (pctAumentoAnual / 100);
    }

    montante = (montante + aporteAtual) * (1 + taxaMensal);
    totalInvestido += aporteAtual;

    const idx = m - 1;
    labelsMeses[idx] = `Mês ${m}`;
    dadosInvestido[idx] = Math.round(totalInvestido * 100) / 100;
    dadosJuros[idx] = Math.round((montante - totalInvestido) * 100) / 100;
  }

  return {
    totalFinal: montante,
    totalInvestido: totalInvestido,
    totalJuros: montante - totalInvestido,
    labelsMeses: labelsMeses,
    dadosInvestido: dadosInvestido,
    dadosJuros: dadosJuros
  };
}

function calcularAporteParaMetaMapeado(pInicial, meta, taxaMensal, meses, pctAumentoAnual) {
  if (meta <= 0) return 0;
  const simUmReal = simularCrescimento(0, 1, taxaMensal, meses, pctAumentoAnual);
  const valorGeradoPorUmReal = simUmReal.totalFinal;
  const montanteInicial = pInicial * Math.pow(1 + taxaMensal, meses);
  const metaRestante = meta - montanteInicial;

  if (metaRestante <= 0) return 0;
  return metaRestante / valorGeradoPorUmReal;
}

function renderizarGrafico(labels, investido, juros) {
  const canvas = document.getElementById('meuGrafico');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        { label: 'Total Investido (R$)', data: investido, borderColor: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.1)', fill: true },
        { label: 'Juros Ganhos (R$)', data: juros, borderColor: '#16a34a', backgroundColor: 'rgba(22, 163, 74, 0.1)', fill: true }
      ]
    },
    options: {
      responsive: true,
      animation: false,
      elements: { point: { radius: 0 } },
      interaction: { mode: 'index', intersect: false },
      scales: { x: { display: false }, y: { stacked: false } }
    }
  });
}

function renderizarTabelaCenarios(p, pm, iMensal, meses, pctAumentoAnual) {
  const tbody = document.getElementById('tbodyCenarios');
  if (!tbody) return;
  
  const multiplicadores = [0, 0.5, 1, 1.5, 2];
  let htmlText = '';

  for (let i = 0; i < multiplicadores.length; i++) {
    const aporteTemp = pm * multiplicadores[i];
    const res = simularCrescimento(p, aporteTemp, iMensal, meses, pctAumentoAnual);
    htmlText += `
      <tr>
        <td><strong>${formatarMoeda(aporteTemp)}</strong></td>
        <td>${formatarMoeda(res.totalInvestido)}</td>
        <td style="color: var(--green);">${formatarMoeda(res.totalJuros)}</td>
        <td><strong>${formatarMoeda(res.totalFinal)}</strong></td>
      </tr>
    `;
  }
  tbody.innerHTML = htmlText;
}

function renderizar3Cenarios(p, pm, meses, pctAumentoAnual) {
  const iCons = Math.pow(1 + (8 / 100), 1/12) - 1;
  const iMod = Math.pow(1 + (10 / 100), 1/12) - 1;
  const iAgres = Math.pow(1 + (12 / 100), 1/12) - 1;

  setElementText('scCons', formatarMoeda(simularCrescimento(p, pm, iCons, meses, pctAumentoAnual).totalFinal));
  setElementText('scMod', formatarMoeda(simularCrescimento(p, pm, iMod, meses, pctAumentoAnual).totalFinal));
  setElementText('scAgres', formatarMoeda(simularCrescimento(p, pm, iAgres, meses, pctAumentoAnual).totalFinal));
}

// Formatação segura de moeda com tratamento para Infinity/NaN
function formatarMoeda(valor) {
  const num = parseFloat(valor);
  if (isNaN(num) || !isFinite(num)) return 'R$ 0,00';
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function atualizarResumoDinamico(modo, aporte, anos, taxa, aumento, totalFinal, meta) {
  const container = document.getElementById('resumoDinamico');
  if (!container) return;

  const meses = anos * 12;
  const valAporte = Number(aporte) || 0;
  const valTotal = Number(totalFinal) || 0;
  const valMeta = Number(meta) || 0;

  const aporteFmt = formatarMoeda(valAporte);
  const totalFmt = formatarMoeda(valTotal);
  const metaFmt = meta ? formatarMoeda(valMeta) : '';

  const textoAumento = aumento > 0 ? ` com reajuste de <strong>${aumento}% ao ano</strong>` : '';

  if (modo === 'quantoVouTer') {
    container.innerHTML = `
      💡 <strong>Resumo do Plano:</strong> Investindo <strong>${aporteFmt}/mês</strong> durante <strong>${anos} anos</strong> (${meses} meses) a uma taxa de <strong>${taxa}% a.a.</strong>${textoAumento}, você acumulará <strong>${totalFmt}</strong>.
    `;
  } else {
    container.innerHTML = `
      💡 <strong>Resumo do Plano:</strong> Para atingir a meta de <strong>${metaFmt}</strong> em <strong>${anos} anos</strong> (${meses} meses) com rentabilidade de <strong>${taxa}% a.a.</strong>${textoAumento}, você precisará investir <strong>${aporteFmt}/mês</strong>.
    `;
  }
}

function alternarTema() {
  document.body.classList.toggle('dark-mode');
  const eDark = document.body.classList.contains('dark-mode');
  
  const btnTheme = document.getElementById('btnTheme');
  if (btnTheme) btnTheme.innerText = eDark ? '☀️' : '🌙';
  
  localStorage.setItem('theme', eDark ? 'dark' : 'light');
  
  if (chartInstance) {
    Chart.defaults.color = eDark ? '#94a3b8' : '#64748b';
    chartInstance.update();
  }
}