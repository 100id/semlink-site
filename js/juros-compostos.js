let modoAtual = 'quantoVouTer';
let chartInstance = null;

document.addEventListener("DOMContentLoaded", () => {
  atualizarECalcular();
});

function setModo(modo) {
  modoAtual = modo;
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  
  if(modo === 'quantoVouTer') {
    event.target.classList.add('active');
    document.getElementById('modoQuantoVouTer').style.display = 'block';
    document.getElementById('modoQuantoInvestir').style.display = 'none';
    document.getElementById('calcTitle').innerText = 'Simulador de Juros Compostos';
    document.getElementById('calcDesc').innerText = 'Projete o crescimento do seu patrimônio em tempo real.';
    document.getElementById('resTitle').innerText = 'Projeção Final';
  } else {
    event.target.classList.add('active');
    document.getElementById('modoQuantoVouTer').style.display = 'none';
    document.getElementById('modoQuantoInvestir').style.display = 'block';
    document.getElementById('calcTitle').innerText = 'Calculadora de Meta Financeira';
    document.getElementById('calcDesc').innerText = 'Descubra quanto precisa investir por mês para chegar ao seu objetivo.';
    document.getElementById('resTitle').innerText = 'Aporte Mensal Necessário';
  }
  atualizarECalcular();
}

function sincronizarAporteInput() {
  const val = document.getElementById('valorMensal').value;
  document.getElementById('sliderAporte').value = val;
  document.getElementById('labelAporteSlider').innerText = formatarMoeda(val);
  atualizarECalcular();
}

function sincronizarAporteSlider() {
  const val = document.getElementById('sliderAporte').value;
  document.getElementById('valorMensal').value = val;
  document.getElementById('labelAporteSlider').innerText = formatarMoeda(val);
  atualizarECalcular();
}

function sincronizarAnosInput() {
  const val = document.getElementById('anos').value;
  document.getElementById('sliderAnos').value = val;
  document.getElementById('labelAnosSlider').innerText = `${val} anos`;
  atualizarECalcular();
}

function sincronizarAnosSlider() {
  const val = document.getElementById('sliderAnos').value;
  document.getElementById('anos').value = val;
  document.getElementById('labelAnosSlider').innerText = `${val} anos`;
  atualizarECalcular();
}

function atualizarECalcular() {
  const p = parseFloat(document.getElementById('valorInicial').value) || 0;
  const taxaAnual = parseFloat(document.getElementById('taxaJuros').value) || 0;
  const anos = parseInt(document.getElementById('anos').value) || 1;
  const pctAumentoAnual = parseFloat(document.getElementById('aumentoAnual').value) || 0;
  const meses = anos * 12;
  const iMensal = Math.pow(1 + (taxaAnual / 100), 1/12) - 1;

  if (modoAtual === 'quantoVouTer') {
    const pm = parseFloat(document.getElementById('valorMensal').value) || 0;
    const res = simularCrescimento(p, pm, iMensal, meses, pctAumentoAnual);
    
    document.getElementById('totalFinal').innerHTML = `${formatarMoeda(res.totalFinal)} <span>Valor acumulado total</span>`;
    document.getElementById('totalInvestido').innerText = formatarMoeda(res.totalInvestido);
    document.getElementById('totalJuros').innerText = formatarMoeda(res.totalJuros);

    renderizarGrafico(res.labelsMeses, res.dadosInvestido, res.dadosJuros);
    
    const jurosUltimosAnos = res.dadosJuros[res.dadosJuros.length - 1] - (res.dadosJuros[Math.floor(res.dadosJuros.length * 0.75)] || 0);
    document.getElementById('cardEfeitoTempo').innerHTML = `🚀 <strong>O Efeito do Tempo:</strong> Nos últimos 25% do período (${Math.round(anos*0.25)} anos), seus juros renderam <strong>${formatarMoeda(jurosUltimosAnos)}</strong> do total acumulado!`;

    renderizarTabelaCenarios(p, pm, iMensal, meses, pctAumentoAnual);
    renderizar3Cenarios(p, pm, meses, pctAumentoAnual);

  } else {
    const meta = parseFloat(document.getElementById('metaTotal').value) || 0;
    const aporteNecessario = calcularAporteParaMeta(p, meta, iMensal, meses);
    
    document.getElementById('totalFinal').innerHTML = `${formatarMoeda(aporteNecessario)} <span>por mês para atingir ${formatarMoeda(meta)}</span>`;
    document.getElementById('totalInvestido').innerText = formatarMoeda(p + (aporteNecessario * meses));
    document.getElementById('totalJuros').innerText = formatarMoeda(meta - (p + (aporteNecessario * meses)));
    
    const res = simularCrescimento(p, aporteNecessario, iMensal, meses, 0);
    renderizarGrafico(res.labelsMeses, res.dadosInvestido, res.dadosJuros);
  }
}

function simularCrescimento(pInicial, pMensal, taxaMensal, totalMeses, pctAumentoAnual) {
  let montante = pInicial;
  let totalInvestido = pInicial;
  let aporteAtual = pMensal;

  const labelsMeses = [];
  const dadosInvestido = [];
  const dadosJuros = [];

  for (let m = 1; m <= totalMeses; m++) {
    if (m > 1 && m % 12 === 1 && pctAumentoAnual > 0) {
      aporteAtual += aporteAtual * (pctAumentoAnual / 100);
    }

    montante = (montante + aporteAtual) * (1 + taxaMensal);
    totalInvestido += aporteAtual;

    labelsMeses.push(`Mês ${m}`);
    dadosInvestido.push(totalInvestido);
    dadosJuros.push(montante - totalInvestido);
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

function calcularAporteParaMeta(pInicial, meta, taxaMensal, meses) {
  let valorFuturoInicial = pInicial * Math.pow(1 + taxaMensal, meses);
  let valorRestante = meta - valorFuturoInicial;
  if (valorRestante <= 0) return 0;
  let fvFactor = (Math.pow(1 + taxaMensal, meses) - 1) / taxaMensal;
  return valorRestante / fvFactor;
}

function renderizarGrafico(labels, investido, juros) {
  const ctx = document.getElementById('meuGrafico').getContext('2d');
  if (chartInstance) chartInstance.destroy();

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
      interaction: { mode: 'index', intersect: false },
      scales: { x: { display: false }, y: { stacked: false } }
    }
  });
}

function renderizarTabelaCenarios(p, pm, iMensal, meses, pctAumentoAnual) {
  const tbody = document.getElementById('tbodyCenarios');
  tbody.innerHTML = '';
  const multiplicadores = [0, 0.5, 1, 1.5, 2];

  multiplicadores.forEach(mult => {
    const aporteTemp = pm * mult;
    const res = simularCrescimento(p, aporteTemp, iMensal, meses, pctAumentoAnual);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${formatarMoeda(aporteTemp)}</strong></td>
      <td>${formatarMoeda(res.totalInvestido)}</td>
      <td style="color: var(--green);">${formatarMoeda(res.totalJuros)}</td>
      <td><strong>${formatarMoeda(res.totalFinal)}</strong></td>
    `;
    tbody.appendChild(tr);
  });
}

function renderizar3Cenarios(p, pm, meses, pctAumentoAnual) {
  const iCons = Math.pow(1 + (8 / 100), 1/12) - 1;
  const iMod = Math.pow(1 + (10 / 100), 1/12) - 1;
  const iAgres = Math.pow(1 + (12 / 100), 1/12) - 1;

  document.getElementById('scCons').innerText = formatarMoeda(simularCrescimento(p, pm, iCons, meses, pctAumentoAnual).totalFinal);
  document.getElementById('scMod').innerText = formatarMoeda(simularCrescimento(p, pm, iMod, meses, pctAumentoAnual).totalFinal);
  document.getElementById('scAgres').innerText = formatarMoeda(simularCrescimento(p, pm, iAgres, meses, pctAumentoAnual).totalFinal);
}

function formatarMoeda(valor) {
  return (parseFloat(valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}