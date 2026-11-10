const RAIO_TERRA_KM = 6371;
const FATOR_TORTUOSIDADE_RODOVIARIA = 1.25;
const LIMITE_HISTORICO = 5;
const CHAVE_STORAGE_PREFERENCIAS = 'rotacusto_preferencias';
const CHAVE_STORAGE_HISTORICO = 'rotacusto_historico';
const CHAVE_STORAGE_TEMA = 'rotacusto_tema';

const veiculo = {
  consumoKml: 12.0,
  precoCombustivel: 5.90
};

let historicoViagens = [];
let ultimaSimulacao = null;
let instanciaMapaLeaflet = null;
let camadaRotaLeaflet = null;

const estadoGpsOrigem = {
  temOrigemGps: false,
  dadosLocalizacao: null
};

const cacheCeps = new Map();

function converterGrausParaRadianos(graus) {
  return (graus * Math.PI) / 180;
}

function calcularDistanciaHaversine(coord1, coord2) {
  const lat1Rad = converterGrausParaRadianos(coord1.latitude);
  const lat2Rad = converterGrausParaRadianos(coord2.latitude);
  const deltaLat = converterGrausParaRadianos(coord2.latitude - coord1.latitude);
  const deltaLon = converterGrausParaRadianos(coord2.longitude - coord1.longitude);

  const senoLat = Math.sin(deltaLat / 2);
  const senoLon = Math.sin(deltaLon / 2);

  const a =
    senoLat * senoLat +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * (senoLon * senoLon);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return RAIO_TERRA_KM * c;
}

function estimarDistanciaRodoviaria(distanciaLinearKm) {
  return distanciaLinearKm * FATOR_TORTUOSIDADE_RODOVIARIA;
}

function calcularConsumoLitros(distancia, kmPorLitro) {
  if (distancia <= 0 || kmPorLitro <= 0) {
    return 0;
  }
  return distancia / kmPorLitro;
}

function calcularCustoViagem(litros, precoLitro, pedagios, ehIdaEVolta) {
  const litrosValidos = litros > 0 ? litros : 0;
  const precoValido = precoLitro > 0 ? precoLitro : 0;
  const pedagioBase = pedagios > 0 ? pedagios : 0;

  const custoCombustivel = litrosValidos * precoValido;
  const custoTotal = custoCombustivel + pedagioBase;

  return {
    custoCombustivel,
    custoPedagio: pedagioBase,
    custoTotal,
    ehIdaEVolta: Boolean(ehIdaEVolta)
  };
}

function dividirPorPassageiros(custoTotal, qtdPessoas) {
  if (qtdPessoas < 1 || Number.isNaN(qtdPessoas)) {
    return custoTotal;
  }
  return custoTotal / qtdPessoas;
}

function classificarFaixaDistancia(distanciaTotalKm) {
  if (distanciaTotalKm <= 100) {
    return {
      rotulo: 'Viagem Curta (até 100 km)',
      classeCss: 'badge-curta',
      ehViagemLonga: false
    };
  }
  if (distanciaTotalKm <= 300) {
    return {
      rotulo: 'Viagem Média (100 a 300 km)',
      classeCss: 'badge-media',
      ehViagemLonga: distanciaTotalKm > 200
    };
  }
  return {
    rotulo: 'Viagem Longa (+300 km)',
    classeCss: 'badge-longa',
    ehViagemLonga: true
  };
}

function calcularEstatisticasHistorico(listaViagens) {
  if (!Array.isArray(listaViagens) || listaViagens.length === 0) {
    return { quantidade: 0, mediaGasto: 0, distanciaAcumulada: 0 };
  }

  let somaGasto = 0;
  let somaDistancia = 0;

  for (let indice = 0; indice < listaViagens.length; indice += 1) {
    const item = listaViagens[indice];
    somaGasto += Number(item.custoTotal) || 0;
    somaDistancia += Number(item.distanciaTotalKm) || 0;
  }

  return {
    quantidade: listaViagens.length,
    mediaGasto: somaGasto / listaViagens.length,
    distanciaAcumulada: somaDistancia
  };
}

function salvarPreferenciasVeiculo(consumoKml, precoCombustivel) {
  if (consumoKml <= 0 || precoCombustivel <= 0) {
    return;
  }

  veiculo.consumoKml = consumoKml;
  veiculo.precoCombustivel = precoCombustivel;

  const preferencias = {
    consumoKml,
    precoCombustivel,
    atualizadoEm: new Date().toISOString()
  };

  try {
    localStorage.setItem(CHAVE_STORAGE_PREFERENCIAS, JSON.stringify(preferencias));
  } catch (erroStorage) {}
}

function carregarPreferenciasVeiculo() {
  try {
    const textoSalvo = localStorage.getItem(CHAVE_STORAGE_PREFERENCIAS);
    if (!textoSalvo) {
      return;
    }

    const dados = JSON.parse(textoSalvo);
    if (Number(dados.consumoKml) > 0) {
      veiculo.consumoKml = Number(dados.consumoKml);
    }
    if (Number(dados.precoCombustivel) > 0) {
      veiculo.precoCombustivel = Number(dados.precoCombustivel);
    }
  } catch (erroLeitura) {}
}

function carregarHistoricoSalvo() {
  try {
    const textoHistorico = localStorage.getItem(CHAVE_STORAGE_HISTORICO);
    if (!textoHistorico) {
      historicoViagens = [];
      return;
    }

    const listaParseada = JSON.parse(textoHistorico);
    if (Array.isArray(listaParseada)) {
      historicoViagens = listaParseada.slice(0, LIMITE_HISTORICO);
    }
  } catch (erroLeitura) {
    historicoViagens = [];
  }
}

function salvarViagemNoHistorico(resumoViagem) {
  historicoViagens.unshift(resumoViagem);

  if (historicoViagens.length > LIMITE_HISTORICO) {
    historicoViagens = historicoViagens.slice(0, LIMITE_HISTORICO);
  }

  try {
    localStorage.setItem(CHAVE_STORAGE_HISTORICO, JSON.stringify(historicoViagens));
  } catch (erroEscrita) {}
}

function limparHistoricoViagens() {
  historicoViagens = [];
  try {
    localStorage.removeItem(CHAVE_STORAGE_HISTORICO);
  } catch (erroRemocao) {}
  renderizarHistoricoDOM();
}

const COORDENADAS_CIDADES_FALLBACK = {
  'DOIS VIZINHOS-PR': { latitude: -25.7407, longitude: -53.0574 },
  'CASCAVEL-PR': { latitude: -24.9578, longitude: -53.4595 },
  'CURITIBA-PR': { latitude: -25.4284, longitude: -49.2733 },
  'FLORIANOPOLIS-SC': { latitude: -27.5954, longitude: -48.5480 },
  'SAO PAULO-SP': { latitude: -23.5505, longitude: -46.6333 },
  'RIO DE JANEIRO-RJ': { latitude: -22.9068, longitude: -43.1729 },
  'PORTO ALEGRE-RS': { latitude: -30.0346, longitude: -51.2177 },
  'BELO HORIZONTE-MG': { latitude: -19.9167, longitude: -43.9345 },
  'BRASILIA-DF': { latitude: -15.7939, longitude: -47.8828 }
};

function limparCep(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 8);
}

function formatarMascaraCep(valor) {
  const digitos = limparCep(valor);
  if (digitos.length <= 5) {
    return digitos;
  }
  return `${digitos.slice(0, 5)}-${digitos.slice(5, 8)}`;
}

function normalizarChaveCidade(cidade, uf) {
  return `${cidade}-${uf}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

async function buscarCoordenadasComplementares(cidade, uf, cepLimpo) {
  const chaveCidade = normalizarChaveCidade(cidade, uf);

  if (cepLimpo && cepLimpo !== '00000000') {
    try {
      const respAwesome = await fetch(`https://cep.awesomeapi.com.br/json/${cepLimpo}`);
      if (respAwesome.ok) {
        const dadosAwesome = await respAwesome.json();
        const latAwesome = parseFloat(dadosAwesome.lat);
        const lonAwesome = parseFloat(dadosAwesome.lng);
        if (!Number.isNaN(latAwesome) && !Number.isNaN(lonAwesome)) {
          return { latitude: latAwesome, longitude: lonAwesome };
        }
      }
    } catch (erroAwesome) {}
  }

  if (COORDENADAS_CIDADES_FALLBACK[chaveCidade]) {
    return COORDENADAS_CIDADES_FALLBACK[chaveCidade];
  }

  try {
    const consulta = encodeURIComponent(cidade);
    const respGeo = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${consulta}&count=5&language=pt&format=json`
    );
    if (respGeo.ok) {
      const dadosGeo = await respGeo.json();
      const resultados = Array.isArray(dadosGeo.results) ? dadosGeo.results : [];
      const itemBrasil =
        resultados.find((item) => item.country_code === 'BR') || resultados[0];
      if (itemBrasil) {
        const latGeo = parseFloat(itemBrasil.latitude);
        const lonGeo = parseFloat(itemBrasil.longitude);
        if (!Number.isNaN(latGeo) && !Number.isNaN(lonGeo)) {
          return { latitude: latGeo, longitude: lonGeo };
        }
      }
    }
  } catch (erroGeo) {}

  throw new Error(
    `O CEP ${formatarMascaraCep(cepLimpo)} (${cidade}/${uf}) não retornou coordenadas geográficas. Tente informar um CEP de rua específico da cidade.`
  );
}

const CEPS_GENERICOS_CAPITAIS = {
  '01000000': '01001000',
  '01000001': '01001000',
  '20000000': '20040002',
  '20000001': '20040002',
  '29000000': '29010001',
  '29000001': '29010001',
  '30000000': '30130000',
  '30000001': '30130000',
  '40000000': '40020000',
  '40000001': '40020000',
  '49000000': '49010020',
  '49000001': '49010020',
  '50000000': '50010000',
  '50000001': '50010000',
  '57000000': '57020000',
  '57000001': '57020000',
  '58000000': '58010000',
  '58000001': '58010000',
  '59000000': '59010000',
  '59000001': '59010000',
  '60000000': '60025000',
  '60000001': '60025000',
  '64000000': '64000040',
  '64000001': '64000040',
  '65000000': '65010000',
  '65000001': '65010000',
  '66000000': '66010000',
  '66000001': '66010000',
  '68900000': '68900073',
  '68900001': '68900073',
  '69000000': '69005010',
  '69000001': '69005010',
  '69300000': '69301000',
  '69300001': '69301000',
  '69900000': '69900064',
  '69900001': '69900064',
  '70000000': '70040010',
  '70000001': '70040010',
  '74000000': '74003010',
  '74000001': '74003010',
  '76800000': '76801000',
  '76800001': '76801000',
  '77000000': '77001002',
  '77000001': '77001002',
  '78000000': '78005000',
  '78000001': '78005000',
  '79000000': '79002000',
  '79000001': '79002000',
  '80000000': '80010010',
  '80000001': '80010010',
  '88000000': '88010400',
  '88000001': '88010400',
  '90000000': '90010150',
  '90000001': '90010150'
};

async function consultarViaCepFallback(cepEfetivo, cepOriginalLimpo) {
  try {
    const respViaCep = await fetch(`https://viacep.com.br/ws/${cepEfetivo}/json/`);
    if (respViaCep.ok) {
      const dadosViaCep = await respViaCep.json();
      if (!dadosViaCep.erro && dadosViaCep.localidade && dadosViaCep.uf) {
        const coord = await buscarCoordenadasComplementares(
          dadosViaCep.localidade,
          dadosViaCep.uf,
          cepEfetivo
        );
        return {
          cep: formatarMascaraCep(cepOriginalLimpo),
          cidade: dadosViaCep.localidade,
          uf: dadosViaCep.uf,
          bairro: dadosViaCep.bairro || '',
          logradouro: dadosViaCep.logradouro || '',
          latitude: coord.latitude,
          longitude: coord.longitude
        };
      }
    }
  } catch (erroViaCep) {}

  throw new Error(`O CEP ${formatarMascaraCep(cepOriginalLimpo)} não foi encontrado.`);
}

async function buscarDadosCep(cep) {
  const cepLimpo = limparCep(cep);
  if (cepLimpo.length !== 8) {
    throw new Error('Informe um CEP válido contendo exatamente 8 dígitos numéricos.');
  }

  if (cacheCeps.has(cepLimpo)) {
    return cacheCeps.get(cepLimpo);
  }

  const cepEfetivo = CEPS_GENERICOS_CAPITAIS[cepLimpo] || cepLimpo;
  const url = `https://brasilapi.com.br/api/cep/v2/${cepEfetivo}`;
  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 404) {
      const resultadoFallback = await consultarViaCepFallback(cepEfetivo, cepLimpo);
      cacheCeps.set(cepLimpo, resultadoFallback);
      return resultadoFallback;
    }
    throw new Error(`Erro ao consultar a BrasilAPI (Status HTTP ${response.status}).`);
  }

  const dadosJson = await response.json();
  const coordenadasApi =
    dadosJson.location && dadosJson.location.coordinates
      ? dadosJson.location.coordinates
      : {};
  let latitude = parseFloat(coordenadasApi.latitude);
  let longitude = parseFloat(coordenadasApi.longitude);

  const temCoordenadasDiretas = !Number.isNaN(latitude) && !Number.isNaN(longitude);
  if (!temCoordenadasDiretas) {
    const coordComplementar = await buscarCoordenadasComplementares(
      dadosJson.city,
      dadosJson.state,
      cepEfetivo
    );
    latitude = coordComplementar.latitude;
    longitude = coordComplementar.longitude;
  }

  const resultadoFormatado = {
    cep: formatarMascaraCep(cepLimpo),
    cidade: dadosJson.city || 'Cidade não informada',
    uf: dadosJson.state || '',
    bairro: dadosJson.neighborhood || '',
    logradouro: dadosJson.street || '',
    latitude,
    longitude
  };

  cacheCeps.set(cepLimpo, resultadoFormatado);
  return resultadoFormatado;
}

async function obterDistanciaRodoviaria(coordOrigem, coordDestino) {
  const distanciaLinear = calcularDistanciaHaversine(coordOrigem, coordDestino);
  const linhaDireta = [
    [coordOrigem.latitude, coordOrigem.longitude],
    [coordDestino.latitude, coordDestino.longitude]
  ];

  if (distanciaLinear < 0.05) {
    return {
      distanciaRotaKm: 0.5,
      duracaoMinutos: 2,
      metodo: 'Mesma localidade',
      coordenadasLinha: linhaDireta
    };
  }

  const urlOsrm =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${coordOrigem.longitude},${coordOrigem.latitude};${coordDestino.longitude},${coordDestino.latitude}` +
    `?overview=full&geometries=geojson`;

  try {
    const response = await fetch(urlOsrm);
    if (response.ok) {
      const dadosRota = await response.json();
      const rotaPrincipal =
        dadosRota.routes && dadosRota.routes.length > 0
          ? dadosRota.routes[0]
          : null;
      if (rotaPrincipal && rotaPrincipal.distance > 0) {
        const geometriaCoords =
          rotaPrincipal.geometry && Array.isArray(rotaPrincipal.geometry.coordinates)
            ? rotaPrincipal.geometry.coordinates.map((ponto) => [ponto[1], ponto[0]])
            : linhaDireta;
        return {
          distanciaRotaKm: rotaPrincipal.distance / 1000,
          duracaoMinutos: Math.round(rotaPrincipal.duration / 60),
          metodo: 'Rota Real via Rodovias (OSRM)',
          coordenadasLinha: geometriaCoords
        };
      }
    }
  } catch (erroOsrm) {}

  const distanciaEstimada = estimarDistanciaRodoviaria(distanciaLinear);
  const duracaoEstimada = Math.round((distanciaEstimada / 80) * 60);

  return {
    distanciaRotaKm: distanciaEstimada,
    duracaoMinutos: duracaoEstimada,
    metodo: 'Estimativa Haversine (×1,25)',
    coordenadasLinha: linhaDireta
  };
}

const elementosDOM = {
  formulario: document.getElementById('form-calculadora'),
  cepOrigem: document.getElementById('cep-origem'),
  cepDestino: document.getElementById('cep-destino'),
  infoCepOrigem: document.getElementById('info-cep-origem'),
  infoCepDestino: document.getElementById('info-cep-destino'),
  consumoKml: document.getElementById('consumo-kml'),
  precoCombustivel: document.getElementById('preco-combustivel'),
  custoPedagio: document.getElementById('custo-pedagio'),
  qtdPassageiros: document.getElementById('qtd-passageiros'),
  idaEVolta: document.getElementById('ida-e-volta'),
  btnCalcular: document.getElementById('btn-calcular'),
  btnLimparForm: document.getElementById('btn-limpar-form'),
  btnGeolocalizacao: document.getElementById('btn-geolocalizacao'),
  btnInverterCeps: document.getElementById('btn-inverter-ceps'),
  mensagemAlerta: document.getElementById('mensagem-alerta'),
  secaoResultado: document.getElementById('secao-resultado'),
  badgeFaixaDistancia: document.getElementById('badge-faixa-distancia'),
  subtituloRota: document.getElementById('subtitulo-rota'),
  metodoCalculoBadge: document.getElementById('metodo-calculo-badge'),
  painelMetricas: document.getElementById('painel-metricas'),
  barraProporcaoCustos: document.getElementById('barra-proporcao-custos'),
  mapaRota: document.getElementById('mapa-rota'),
  btnGoogleMaps: document.getElementById('btn-google-maps'),
  btnCopiarWhatsapp: document.getElementById('btn-copiar-whatsapp'),
  feedbackCopia: document.getElementById('feedback-copia'),
  boxAfiliadoContextual: document.getElementById('box-afiliado-contextual'),
  estatisticasHistorico: document.getElementById('estatisticas-historico'),
  listaHistorico: document.getElementById('lista-historico'),
  btnLimparHistorico: document.getElementById('btn-limpar-historico'),
  btnAlternarTema: document.getElementById('btn-alternar-tema'),
  buscaNomeCidade: document.getElementById('busca-nome-cidade'),
  btnBuscarCidade: document.getElementById('btn-buscar-cidade'),
  listaResultadosCidade: document.getElementById('lista-resultados-cidade'),
  botoesPreset: document.querySelectorAll('.btn-preset'),
  botoesCombustivel: document.querySelectorAll('.btn-fuel')
};

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function formatarNumero(valor, casasDecimais = 1) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: casasDecimais,
    maximumFractionDigits: casasDecimais
  });
}

function formatarTempoViagem(minutosTotais) {
  if (!minutosTotais || minutosTotais <= 0) {
    return 'Tempo variável';
  }
  if (minutosTotais < 60) {
    return `~${minutosTotais} min de condução`;
  }
  const horas = Math.floor(minutosTotais / 60);
  const minutos = minutosTotais % 60;
  if (minutos === 0) {
    return `~${horas}h de condução`;
  }
  return `~${horas}h ${minutos}min de condução`;
}

function exibirMensagemAlerta(texto, tipo = 'error') {
  elementosDOM.mensagemAlerta.textContent = texto;
  elementosDOM.mensagemAlerta.className = `alert-box ${
    tipo === 'info' ? 'alert-info' : 'alert-error'
  }`;
  elementosDOM.mensagemAlerta.classList.remove('hidden');
}

function ocultarMensagemAlerta() {
  elementosDOM.mensagemAlerta.textContent = '';
  elementosDOM.mensagemAlerta.classList.add('hidden');
}

function atualizarHelperCep(elementoHelper, mensagem, estado = 'neutro') {
  elementoHelper.textContent = mensagem;
  elementoHelper.classList.remove('cep-ok', 'cep-erro');

  if (estado === 'ok') {
    elementoHelper.classList.add('cep-ok');
    return;
  }
  if (estado === 'erro') {
    elementoHelper.classList.add('cep-erro');
  }
}

function criarCardMetricaDOM(rotulo, valorPrincipal, subtexto, ehDestaque = false) {
  const card = document.createElement('div');
  card.className = ehDestaque ? 'metric-card highlight' : 'metric-card';

  const spanRotulo = document.createElement('span');
  spanRotulo.className = 'metric-label';
  spanRotulo.textContent = rotulo;

  const strongValor = document.createElement('strong');
  strongValor.className = 'metric-value';
  strongValor.textContent = valorPrincipal;

  const spanSub = document.createElement('span');
  spanSub.className = 'metric-sub';
  spanSub.textContent = subtexto;

  card.appendChild(spanRotulo);
  card.appendChild(strongValor);
  card.appendChild(spanSub);
  return card;
}

function renderizarProporcaoCustosDOM(simulacao) {
  const container = elementosDOM.barraProporcaoCustos;
  if (!container) {
    return;
  }
  container.textContent = '';

  const total = simulacao.custoTotal > 0 ? simulacao.custoTotal : 1;
  const percentualCombustivel = Math.round((simulacao.custoCombustivel / total) * 100);
  const percentualPedagio = Math.max(0, 100 - percentualCombustivel);

  const cabecalho = document.createElement('div');
  cabecalho.className = 'breakdown-header';

  const spanComb = document.createElement('span');
  spanComb.textContent = `⛽ Combustível: ${percentualCombustivel}% (${formatarMoeda(simulacao.custoCombustivel)})`;

  const spanPed = document.createElement('span');
  spanPed.textContent = `🛣️ Pedágio/Extras: ${percentualPedagio}% (${formatarMoeda(simulacao.custoPedagio)})`;

  cabecalho.appendChild(spanComb);
  cabecalho.appendChild(spanPed);

  const trilha = document.createElement('div');
  trilha.className = 'breakdown-track';

  const barraComb = document.createElement('div');
  barraComb.className = 'breakdown-fill-fuel';
  barraComb.style.width = `${percentualCombustivel}%`;

  const barraPed = document.createElement('div');
  barraPed.className = 'breakdown-fill-toll';
  barraPed.style.width = `${percentualPedagio}%`;

  trilha.appendChild(barraComb);
  trilha.appendChild(barraPed);

  container.appendChild(cabecalho);
  container.appendChild(trilha);
}

function renderizarAfiliadoContextualDOM(simulacao) {
  const container = elementosDOM.boxAfiliadoContextual;
  container.textContent = '';

  const classificacao = classificarFaixaDistancia(simulacao.distanciaTotalKm);
  const textoSpan = document.createElement('span');
  const linkAfiliado = document.createElement('a');
  linkAfiliado.className = 'affiliate-link';
  linkAfiliado.href = '#como-economizar';

  if (classificacao.ehViagemLonga) {
    textoSpan.textContent =
      '🧳 Vai viajar mais de 200 km? Compare aluguel de carros e faça um check-up ou cotação de Seguro Auto antes de pegar a estrada.';
    linkAfiliado.textContent = 'Ver dicas para viagens longas →';
    container.appendChild(textoSpan);
    container.appendChild(linkAfiliado);
    return;
  }

  textoSpan.textContent =
    '🏷️ Evite filas nas praças de pedágio: utilize uma tag de passagem automática (Sem Parar / Veloe) na sua rota.';
  linkAfiliado.textContent = 'Saiba como economizar →';
  container.appendChild(textoSpan);
  container.appendChild(linkAfiliado);
}

function renderizarMapaRotaDOM(simulacao) {
  if (!elementosDOM.mapaRota || typeof window.L === 'undefined') {
    return;
  }

  const coordOrigem = simulacao.coordOrigem;
  const coordDestino = simulacao.coordDestino;
  if (!coordOrigem || !coordDestino) {
    return;
  }

  if (instanciaMapaLeaflet) {
    instanciaMapaLeaflet.remove();
    instanciaMapaLeaflet = null;
    camadaRotaLeaflet = null;
  }

  instanciaMapaLeaflet = window.L.map(elementosDOM.mapaRota, {
    scrollWheelZoom: true
  });
  window.L.tileLayer('https://tile.openstreetmap.de/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(instanciaMapaLeaflet);

  camadaRotaLeaflet = window.L.featureGroup().addTo(instanciaMapaLeaflet);

  const latOrigem = Number(coordOrigem.latitude);
  const lonOrigem = Number(coordOrigem.longitude);
  const latDestino = Number(coordDestino.latitude);
  const lonDestino = Number(coordDestino.longitude);

  const pontosLinha =
    Array.isArray(simulacao.coordenadasLinha) && simulacao.coordenadasLinha.length > 1
      ? simulacao.coordenadasLinha
      : [
          [latOrigem, lonOrigem],
          [latDestino, lonDestino]
        ];

  const polilinha = window.L.polyline(pontosLinha, {
    color: '#0d9488',
    weight: 4,
    opacity: 0.9
  }).addTo(camadaRotaLeaflet);

  window.L.circleMarker([latOrigem, lonOrigem], {
    radius: 7,
    fillColor: '#16a34a',
    color: '#ffffff',
    weight: 2,
    fillOpacity: 1
  })
    .bindPopup(`Origem: ${simulacao.nomeOrigem}`)
    .addTo(camadaRotaLeaflet);

  window.L.circleMarker([latDestino, lonDestino], {
    radius: 7,
    fillColor: '#f59e0b',
    color: '#ffffff',
    weight: 2,
    fillOpacity: 1
  })
    .bindPopup(`Destino: ${simulacao.nomeDestino}`)
    .addTo(camadaRotaLeaflet);

  instanciaMapaLeaflet.invalidateSize();
  instanciaMapaLeaflet.fitBounds(polilinha.getBounds(), {
    padding: [28, 28],
    animate: false
  });
}

function atualizarLinkGoogleMaps(simulacao) {
  if (!elementosDOM.btnGoogleMaps) {
    return;
  }
  const coordOrigem = simulacao.coordOrigem;
  const coordDestino = simulacao.coordDestino;
  if (!coordOrigem || !coordDestino) {
    elementosDOM.btnGoogleMaps.classList.add('hidden');
    return;
  }
  const lat1 = Number(coordOrigem.latitude);
  const lon1 = Number(coordOrigem.longitude);
  const lat2 = Number(coordDestino.latitude);
  const lon2 = Number(coordDestino.longitude);
  elementosDOM.btnGoogleMaps.href = `https://www.google.com/maps/dir/?api=1&origin=${lat1},${lon1}&destination=${lat2},${lon2}`;
  elementosDOM.btnGoogleMaps.classList.remove('hidden');
}

function renderizarResultadoDOM(simulacao) {
  const classificacao = classificarFaixaDistancia(simulacao.distanciaTotalKm);

  elementosDOM.badgeFaixaDistancia.textContent = classificacao.rotulo;
  elementosDOM.badgeFaixaDistancia.className = `distance-badge ${classificacao.classeCss}`;

  const sufixoTrajeto = simulacao.ehIdaEVolta ? ' (Ida e Volta)' : ' (Somente Ida)';
  elementosDOM.subtituloRota.textContent = `${simulacao.nomeOrigem} → ${simulacao.nomeDestino}${sufixoTrajeto}`;
  elementosDOM.metodoCalculoBadge.textContent = simulacao.metodoRota;

  elementosDOM.painelMetricas.textContent = '';

  const duracaoAjustada = simulacao.duracaoMinutosBase
    ? simulacao.duracaoMinutosBase * (simulacao.ehIdaEVolta ? 2 : 1)
    : null;

  const cardDistancia = criarCardMetricaDOM(
    'Distância Total',
    `${formatarNumero(simulacao.distanciaTotalKm, 1)} km`,
    formatarTempoViagem(duracaoAjustada),
    false
  );

  const cardCombustivel = criarCardMetricaDOM(
    'Combustível Necessário',
    `${formatarNumero(simulacao.litrosNecessarios, 1)} L`,
    `Custo comb.: ${formatarMoeda(simulacao.custoCombustivel)}`,
    false
  );

  const subtextoPedagio =
    simulacao.custoPedagio > 0
      ? `Inclui ${formatarMoeda(simulacao.custoPedagio)} de pedágio`
      : 'Sem pedágio informado';

  const cardTotal = criarCardMetricaDOM(
    'Custo Total da Viagem',
    formatarMoeda(simulacao.custoTotal),
    subtextoPedagio,
    true
  );

  const rotuloPassageiros =
    simulacao.qtdPassageiros === 1
      ? 'Individual (1 motorista)'
      : `Dividido entre ${simulacao.qtdPassageiros} pessoas`;

  const cardPorPessoa = criarCardMetricaDOM(
    'Valor por Passageiro',
    formatarMoeda(simulacao.custoPorPessoa),
    rotuloPassageiros,
    true
  );

  elementosDOM.painelMetricas.appendChild(cardDistancia);
  elementosDOM.painelMetricas.appendChild(cardCombustivel);
  elementosDOM.painelMetricas.appendChild(cardTotal);
  elementosDOM.painelMetricas.appendChild(cardPorPessoa);

  renderizarProporcaoCustosDOM(simulacao);
  renderizarAfiliadoContextualDOM(simulacao);
  atualizarLinkGoogleMaps(simulacao);
  elementosDOM.secaoResultado.classList.remove('hidden');
  renderizarMapaRotaDOM(simulacao);
}

async function obterCoordenadasDeRotuloCidade(nomeCidadeUf, cepSalvo) {
  if (cepSalvo && limparCep(cepSalvo).length === 8) {
    try {
      const dadosCep = await buscarDadosCep(cepSalvo);
      return { latitude: dadosCep.latitude, longitude: dadosCep.longitude };
    } catch (erroCep) {}
  }

  const partes = String(nomeCidadeUf || '').split('/');
  const cidade = (partes[0] || '').trim();
  const uf = (partes[1] || 'BR').trim();
  return buscarCoordenadasComplementares(cidade, uf, '00000000');
}

async function recarregarViagemDoHistorico(viagem) {
  ocultarMensagemAlerta();
  estadoGpsOrigem.temOrigemGps = false;
  estadoGpsOrigem.dadosLocalizacao = null;

  if (viagem.cepOrigem) {
    elementosDOM.cepOrigem.value = viagem.cepOrigem;
  }
  if (viagem.cepDestino) {
    elementosDOM.cepDestino.value = viagem.cepDestino;
  }
  if (Number(viagem.consumoKml) > 0) {
    elementosDOM.consumoKml.value = viagem.consumoKml;
  }
  if (Number(viagem.precoCombustivel) > 0) {
    elementosDOM.precoCombustivel.value = viagem.precoCombustivel;
  }
  elementosDOM.custoPedagio.value = Number(viagem.custoPedagio) || 0;
  elementosDOM.qtdPassageiros.value = Number(viagem.qtdPassageiros) || 1;
  elementosDOM.idaEVolta.checked = Boolean(viagem.ehIdaEVolta);

  atualizarHelperCep(elementosDOM.infoCepOrigem, `📍 ${viagem.nomeOrigem}`, 'ok');
  atualizarHelperCep(elementosDOM.infoCepDestino, `📍 ${viagem.nomeDestino}`, 'ok');

  ultimaSimulacao = { ...viagem };
  renderizarResultadoDOM(ultimaSimulacao);
  elementosDOM.secaoResultado.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  const temCoordenadasSalvas =
    ultimaSimulacao.coordOrigem &&
    ultimaSimulacao.coordDestino &&
    Array.isArray(ultimaSimulacao.coordenadasLinha) &&
    ultimaSimulacao.coordenadasLinha.length > 1;

  if (temCoordenadasSalvas) {
    return;
  }

  try {
    const [coordOrigem, coordDestino] = await Promise.all([
      obterCoordenadasDeRotuloCidade(viagem.nomeOrigem, viagem.cepOrigem),
      obterCoordenadasDeRotuloCidade(viagem.nomeDestino, viagem.cepDestino)
    ]);

    const rota = await obterDistanciaRodoviaria(coordOrigem, coordDestino);
    const linhaCompacta = Array.isArray(rota.coordenadasLinha)
      ? rota.coordenadasLinha.filter(
          (_, idx, arr) =>
            idx === 0 ||
            idx === arr.length - 1 ||
            idx % Math.max(1, Math.floor(arr.length / 80)) === 0
        )
      : [];

    viagem.coordOrigem = coordOrigem;
    viagem.coordDestino = coordDestino;
    viagem.coordenadasLinha = linhaCompacta;
    ultimaSimulacao = { ...viagem };

    try {
      localStorage.setItem(CHAVE_STORAGE_HISTORICO, JSON.stringify(historicoViagens));
    } catch (erroStorage) {}

    renderizarMapaRotaDOM(ultimaSimulacao);
    atualizarLinkGoogleMaps(ultimaSimulacao);
  } catch (erroMapaHistorico) {}
}

function renderizarHistoricoDOM() {
  elementosDOM.estatisticasHistorico.textContent = '';
  elementosDOM.listaHistorico.textContent = '';

  const estatisticas = calcularEstatisticasHistorico(historicoViagens);

  if (estatisticas.quantidade === 0) {
    elementosDOM.estatisticasHistorico.classList.add('hidden');
    elementosDOM.btnLimparHistorico.classList.add('hidden');

    const vazioDiv = document.createElement('div');
    vazioDiv.className = 'empty-history';
    vazioDiv.textContent = 'Nenhuma viagem simulada ainda. Faça um cálculo acima para registrar seu histórico.';
    elementosDOM.listaHistorico.appendChild(vazioDiv);
    return;
  }

  elementosDOM.estatisticasHistorico.classList.remove('hidden');
  elementosDOM.btnLimparHistorico.classList.remove('hidden');

  const itensEstatistica = [
    { rotulo: 'Viagens salvas: ', valor: String(estatisticas.quantidade) },
    { rotulo: 'Média de gasto: ', valor: formatarMoeda(estatisticas.mediaGasto) },
    { rotulo: 'Distância acumulada: ', valor: `${formatarNumero(estatisticas.distanciaAcumulada, 1)} km` }
  ];

  itensEstatistica.forEach((item) => {
    const span = document.createElement('span');
    span.className = 'stat-pill';
    span.textContent = item.rotulo;

    const strong = document.createElement('strong');
    strong.textContent = item.valor;
    span.appendChild(strong);

    elementosDOM.estatisticasHistorico.appendChild(span);
  });

  historicoViagens.forEach((viagem) => {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'history-item';
    itemDiv.setAttribute('role', 'button');
    itemDiv.setAttribute('tabindex', '0');
    itemDiv.title = 'Clique para recarregar esta viagem na calculadora';

    const colEsquerda = document.createElement('div');
    const tituloRota = document.createElement('div');
    tituloRota.className = 'history-route';
    tituloRota.textContent = `${viagem.nomeOrigem} → ${viagem.nomeDestino}`;

    const badgeRecarregar = document.createElement('span');
    badgeRecarregar.className = 'history-reload-hint';
    badgeRecarregar.textContent = '↻ Recarregar';
    tituloRota.appendChild(badgeRecarregar);

    const metaRota = document.createElement('div');
    metaRota.className = 'history-meta';
    const tipoTrajeto = viagem.ehIdaEVolta ? 'Ida e Volta' : 'Somente Ida';
    metaRota.textContent = `${formatarNumero(viagem.distanciaTotalKm, 1)} km (${tipoTrajeto}) • ${formatarNumero(viagem.litrosNecessarios, 1)} L • ${viagem.qtdPassageiros} pass.`;

    colEsquerda.appendChild(tituloRota);
    colEsquerda.appendChild(metaRota);

    const colDireita = document.createElement('div');
    colDireita.className = 'history-values';

    const valorTotal = document.createElement('div');
    valorTotal.className = 'history-total';
    valorTotal.textContent = formatarMoeda(viagem.custoTotal);

    const valorPessoa = document.createElement('div');
    valorPessoa.className = 'history-per-person';
    valorPessoa.textContent = `${formatarMoeda(viagem.custoPorPessoa)} / pessoa`;

    colDireita.appendChild(valorTotal);
    colDireita.appendChild(valorPessoa);

    itemDiv.appendChild(colEsquerda);
    itemDiv.appendChild(colDireita);

    itemDiv.addEventListener('click', () => {
      recarregarViagemDoHistorico(viagem);
    });
    itemDiv.addEventListener('keydown', (eventoTecla) => {
      if (eventoTecla.key === 'Enter' || eventoTecla.key === ' ') {
        eventoTecla.preventDefault();
        recarregarViagemDoHistorico(viagem);
      }
    });

    elementosDOM.listaHistorico.appendChild(itemDiv);
  });
}

function recalcularSimulacaoAtivaInstantaneamente() {
  if (!ultimaSimulacao) {
    return;
  }

  const consumoKml = parseFloat(elementosDOM.consumoKml.value);
  const precoCombustivel = parseFloat(elementosDOM.precoCombustivel.value);
  const custoPedagio = parseFloat(elementosDOM.custoPedagio.value) || 0;
  const qtdPassageiros = parseInt(elementosDOM.qtdPassageiros.value, 10) || 1;
  const ehIdaEVolta = elementosDOM.idaEVolta.checked;

  if (consumoKml <= 0 || precoCombustivel <= 0 || qtdPassageiros < 1) {
    return;
  }

  const multiplicadorTrajeto = ehIdaEVolta ? 2 : 1;
  const distanciaTotalKm = ultimaSimulacao.distanciaRotaBaseKm * multiplicadorTrajeto;
  const litrosNecessarios = calcularConsumoLitros(distanciaTotalKm, consumoKml);
  const custos = calcularCustoViagem(
    litrosNecessarios,
    precoCombustivel,
    custoPedagio,
    ehIdaEVolta
  );
  const custoPorPessoa = dividirPorPassageiros(custos.custoTotal, qtdPassageiros);

  ultimaSimulacao = {
    ...ultimaSimulacao,
    ehIdaEVolta,
    distanciaTotalKm,
    litrosNecessarios,
    custoCombustivel: custos.custoCombustivel,
    custoPedagio: custos.custoPedagio,
    custoTotal: custos.custoTotal,
    qtdPassageiros,
    custoPorPessoa
  };

  renderizarResultadoDOM(ultimaSimulacao);
}

async function consultarPreviaCepNoInput(inputElemento, helperElemento, ehCampoOrigem) {
  if (ehCampoOrigem) {
    estadoGpsOrigem.temOrigemGps = false;
    estadoGpsOrigem.dadosLocalizacao = null;
  }

  inputElemento.value = formatarMascaraCep(inputElemento.value);
  inputElemento.classList.remove('input-error');

  const cepLimpo = limparCep(inputElemento.value);
  if (cepLimpo.length < 8) {
    atualizarHelperCep(helperElemento, 'Digite os 8 números do CEP', 'neutro');
    return;
  }

  atualizarHelperCep(helperElemento, 'Consultando CEP na BrasilAPI...', 'neutro');

  try {
    const dadosCep = await buscarDadosCep(cepLimpo);
    const detalheBairro = dadosCep.bairro ? ` (${dadosCep.bairro})` : '';
    atualizarHelperCep(
      helperElemento,
      `📍 ${dadosCep.cidade} - ${dadosCep.uf}${detalheBairro}`,
      'ok'
    );
  } catch (erroCep) {
    atualizarHelperCep(helperElemento, erroCep.message, 'erro');
  }
}

function validarCamposFormulario() {
  ocultarMensagemAlerta();
  const cepOrigemLimpo = limparCep(elementosDOM.cepOrigem.value);
  const cepDestinoLimpo = limparCep(elementosDOM.cepDestino.value);
  const consumo = parseFloat(elementosDOM.consumoKml.value);
  const preco = parseFloat(elementosDOM.precoCombustivel.value);
  const pedagio = parseFloat(elementosDOM.custoPedagio.value || '0');
  const passageiros = parseInt(elementosDOM.qtdPassageiros.value, 10);

  if (!estadoGpsOrigem.temOrigemGps && cepOrigemLimpo.length !== 8) {
    elementosDOM.cepOrigem.classList.add('input-error');
    exibirMensagemAlerta('Informe um CEP de Origem válido com 8 dígitos ou use sua localização GPS.');
    return false;
  }

  if (cepDestinoLimpo.length !== 8) {
    elementosDOM.cepDestino.classList.add('input-error');
    exibirMensagemAlerta('Informe um CEP de Destino válido com 8 dígitos.');
    return false;
  }

  if (Number.isNaN(consumo) || consumo <= 0) {
    elementosDOM.consumoKml.classList.add('input-error');
    exibirMensagemAlerta('O consumo médio do veículo (km/l) deve ser maior que zero.');
    return false;
  }

  if (Number.isNaN(preco) || preco <= 0) {
    elementosDOM.precoCombustivel.classList.add('input-error');
    exibirMensagemAlerta('O preço do litro do combustível deve ser maior que zero.');
    return false;
  }

  if (Number.isNaN(pedagio) || pedagio < 0) {
    elementosDOM.custoPedagio.classList.add('input-error');
    exibirMensagemAlerta('O valor de pedágio não pode ser negativo.');
    return false;
  }

  if (Number.isNaN(passageiros) || passageiros < 1) {
    elementosDOM.qtdPassageiros.classList.add('input-error');
    exibirMensagemAlerta('O número de passageiros deve ser de pelo menos 1 pessoa.');
    return false;
  }

  return true;
}

async function processarCalculoViagem(event) {
  event.preventDefault();

  if (!validarCamposFormulario()) {
    return;
  }

  const textoOriginalBotao = elementosDOM.btnCalcular.textContent;
  elementosDOM.btnCalcular.disabled = true;
  elementosDOM.btnCalcular.textContent = '⏳ Calculando rota...';

  try {
    const cepOrigem = elementosDOM.cepOrigem.value;
    const cepDestino = elementosDOM.cepDestino.value;
    const consumoKml = parseFloat(elementosDOM.consumoKml.value);
    const precoCombustivel = parseFloat(elementosDOM.precoCombustivel.value);
    const custoPedagio = parseFloat(elementosDOM.custoPedagio.value || '0');
    const qtdPassageiros = parseInt(elementosDOM.qtdPassageiros.value, 10);
    const ehIdaEVolta = elementosDOM.idaEVolta.checked;

    salvarPreferenciasVeiculo(consumoKml, precoCombustivel);

    const promessaOrigem = estadoGpsOrigem.temOrigemGps
      ? Promise.resolve(estadoGpsOrigem.dadosLocalizacao)
      : buscarDadosCep(cepOrigem);

    const [dadosOrigem, dadosDestino] = await Promise.all([
      promessaOrigem,
      buscarDadosCep(cepDestino)
    ]);

    if (!estadoGpsOrigem.temOrigemGps) {
      atualizarHelperCep(
        elementosDOM.infoCepOrigem,
        `📍 ${dadosOrigem.cidade} - ${dadosOrigem.uf}`,
        'ok'
      );
    }
    atualizarHelperCep(
      elementosDOM.infoCepDestino,
      `📍 ${dadosDestino.cidade} - ${dadosDestino.uf}`,
      'ok'
    );

    const rotaCalculada = await obterDistanciaRodoviaria(
      { latitude: dadosOrigem.latitude, longitude: dadosOrigem.longitude },
      { latitude: dadosDestino.latitude, longitude: dadosDestino.longitude }
    );

    const multiplicador = ehIdaEVolta ? 2 : 1;
    const distanciaTotalKm = rotaCalculada.distanciaRotaKm * multiplicador;
    const litrosNecessarios = calcularConsumoLitros(distanciaTotalKm, consumoKml);
    const custos = calcularCustoViagem(
      litrosNecessarios,
      precoCombustivel,
      custoPedagio,
      ehIdaEVolta
    );
    const custoPorPessoa = dividirPorPassageiros(custos.custoTotal, qtdPassageiros);

    const nomeOrigemFormatado = dadosOrigem.uf
      ? `${dadosOrigem.cidade}/${dadosOrigem.uf}`
      : dadosOrigem.cidade;
    const nomeDestinoFormatado = dadosDestino.uf
      ? `${dadosDestino.cidade}/${dadosDestino.uf}`
      : dadosDestino.cidade;

    const linhaCompacta = Array.isArray(rotaCalculada.coordenadasLinha)
      ? rotaCalculada.coordenadasLinha.filter(
          (_, idx, arr) =>
            idx === 0 ||
            idx === arr.length - 1 ||
            idx % Math.max(1, Math.floor(arr.length / 80)) === 0
        )
      : [];

    ultimaSimulacao = {
      id: Date.now(),
      cepOrigem: dadosOrigem.cep,
      cepDestino: dadosDestino.cep,
      consumoKml,
      precoCombustivel,
      coordOrigem: { latitude: dadosOrigem.latitude, longitude: dadosOrigem.longitude },
      coordDestino: { latitude: dadosDestino.latitude, longitude: dadosDestino.longitude },
      coordenadasLinha: linhaCompacta,
      nomeOrigem: nomeOrigemFormatado,
      nomeDestino: nomeDestinoFormatado,
      distanciaRotaBaseKm: rotaCalculada.distanciaRotaKm,
      duracaoMinutosBase: rotaCalculada.duracaoMinutos,
      metodoRota: rotaCalculada.metodo,
      ehIdaEVolta,
      distanciaTotalKm,
      litrosNecessarios,
      custoCombustivel: custos.custoCombustivel,
      custoPedagio: custos.custoPedagio,
      custoTotal: custos.custoTotal,
      qtdPassageiros,
      custoPorPessoa,
      dataHora: new Date().toISOString()
    };

    renderizarResultadoDOM(ultimaSimulacao);
    salvarViagemNoHistorico(ultimaSimulacao);
    renderizarHistoricoDOM();
  } catch (erroCalculo) {
    exibirMensagemAlerta(
      erroCalculo.message || 'Não foi possível calcular a rota entre os CEPs informados.'
    );
  } finally {
    elementosDOM.btnCalcular.disabled = false;
    elementosDOM.btnCalcular.textContent = textoOriginalBotao;
  }
}

function gerarTextoResumoWhatsApp(simulacao) {
  const distanciaTexto = Math.round(simulacao.distanciaTotalKm);
  const litrosTexto = formatarNumero(simulacao.litrosNecessarios, 1);
  const combTexto = formatarMoeda(simulacao.custoCombustivel);
  const pedagioTexto = formatarMoeda(simulacao.custoPedagio);
  const totalTexto = formatarMoeda(simulacao.custoTotal);
  const pessoaTexto = formatarMoeda(simulacao.custoPorPessoa);

  return (
    `🚗 Resumo da Viagem (${simulacao.nomeOrigem} -> ${simulacao.nomeDestino}): ` +
    `Distância: ${distanciaTexto} km | ` +
    `Combustível: ${litrosTexto} L (${combTexto}) | ` +
    `Pedágio: ${pedagioTexto} | ` +
    `Total: ${totalTexto} (${pessoaTexto} por pessoa para ${simulacao.qtdPassageiros} passageiros).`
  );
}

async function copiarResumoWhatsApp() {
  if (!ultimaSimulacao) {
    return;
  }

  const textoResumo = gerarTextoResumoWhatsApp(ultimaSimulacao);

  try {
    await navigator.clipboard.writeText(textoResumo);
    elementosDOM.feedbackCopia.classList.remove('hidden');
    setTimeout(() => {
      elementosDOM.feedbackCopia.classList.add('hidden');
    }, 3500);
  } catch (erroClipboard) {
    exibirMensagemAlerta(
      'Não foi possível acessar a área de transferência automaticamente neste navegador.',
      'info'
    );
  }
}

async function obterCidadePorCoordenadasGps(latitude, longitude) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14`;
    const response = await fetch(url);
    if (response.ok) {
      const dados = await response.json();
      const endereco = dados.address || {};
      const cidade =
        endereco.city ||
        endereco.town ||
        endereco.municipality ||
        endereco.village ||
        'Minha Localização GPS';
      const estado = endereco.ISO3166_2_lvl4
        ? endereco.ISO3166_2_lvl4.replace('BR-', '')
        : '';
      const cepDetectado = endereco.postcode ? formatarMascaraCep(endereco.postcode) : 'GPS Atual';
      return { cidade, uf: estado, cep: cepDetectado };
    }
  } catch (erroReverso) {}
  return { cidade: 'Localização GPS', uf: 'BR', cep: 'GPS Atual' };
}

function usarLocalizacaoGpsAtual() {
  ocultarMensagemAlerta();

  if (!('geolocation' in navigator)) {
    exibirMensagemAlerta('Seu navegador não suporta geolocalização por GPS.');
    return;
  }

  atualizarHelperCep(
    elementosDOM.infoCepOrigem,
    '📡 Obtendo coordenadas do GPS do seu dispositivo...',
    'neutro'
  );
  elementosDOM.btnGeolocalizacao.disabled = true;

  navigator.geolocation.getCurrentPosition(
    async (posicao) => {
      const { latitude, longitude } = posicao.coords;
      const localDetectado = await obterCidadePorCoordenadasGps(latitude, longitude);

      estadoGpsOrigem.temOrigemGps = true;
      estadoGpsOrigem.dadosLocalizacao = {
        cep: localDetectado.cep,
        cidade: localDetectado.cidade,
        uf: localDetectado.uf,
        bairro: 'Coordenadas via GPS',
        logradouro: '',
        latitude,
        longitude
      };

      elementosDOM.cepOrigem.value =
        localDetectado.cep.length === 9 ? localDetectado.cep : 'GPS-ATUAL';
      elementosDOM.cepOrigem.classList.remove('input-error');

      atualizarHelperCep(
        elementosDOM.infoCepOrigem,
        `📍 Origem via GPS: ${localDetectado.cidade}${localDetectado.uf ? ' - ' + localDetectado.uf : ''} (${latitude.toFixed(3)}, ${longitude.toFixed(3)})`,
        'ok'
      );
      elementosDOM.btnGeolocalizacao.disabled = false;
    },
    (erroGps) => {
      elementosDOM.btnGeolocalizacao.disabled = false;
      atualizarHelperCep(
        elementosDOM.infoCepOrigem,
        'Permissão de GPS negada ou indisponível. Digite o CEP manualmente.',
        'erro'
      );
      exibirMensagemAlerta(
        `Não foi possível obter sua localização (${erroGps.message || 'Permissão negada'}). Digite o CEP de origem manualmente.`
      );
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000
    }
  );
}

const MAPA_ESTADO_PARA_UF = {
  'ACRE': 'AC',
  'ALAGOAS': 'AL',
  'AMAPA': 'AP',
  'AMAZONAS': 'AM',
  'BAHIA': 'BA',
  'CEARA': 'CE',
  'DISTRITO FEDERAL': 'DF',
  'ESPIRITO SANTO': 'ES',
  'GOIAS': 'GO',
  'MARANHAO': 'MA',
  'MATO GROSSO': 'MT',
  'MATO GROSSO DO SUL': 'MS',
  'MINAS GERAIS': 'MG',
  'PARA': 'PA',
  'PARAIBA': 'PB',
  'PARANA': 'PR',
  'PERNAMBUCO': 'PE',
  'PIAUI': 'PI',
  'RIO DE JANEIRO': 'RJ',
  'RIO GRANDE DO NORTE': 'RN',
  'RIO GRANDE DO SUL': 'RS',
  'RONDONIA': 'RO',
  'RORAIMA': 'RR',
  'SANTA CATARINA': 'SC',
  'SAO PAULO': 'SP',
  'SERGIPE': 'SE',
  'TOCANTINS': 'TO'
};

const CEP_PADRAO_POR_UF = {
  'AC': '69900064',
  'AL': '57020000',
  'AP': '68900073',
  'AM': '69005010',
  'BA': '40020000',
  'CE': '60025000',
  'DF': '70040010',
  'ES': '29010001',
  'GO': '74003010',
  'MA': '65010000',
  'MT': '78005000',
  'MS': '79002000',
  'MG': '30130000',
  'PA': '66010000',
  'PB': '58010000',
  'PR': '80010010',
  'PE': '50010000',
  'PI': '64000040',
  'RJ': '20040002',
  'RN': '59010000',
  'RS': '90010150',
  'RO': '76801000',
  'RR': '69301000',
  'SC': '88010400',
  'SP': '01001000',
  'SE': '49010020',
  'TO': '77001002'
};

let temporizadorBuscaCidade = null;

function converterEstadoParaUf(nomeEstado) {
  const chave = String(nomeEstado || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
  return MAPA_ESTADO_PARA_UF[chave] || 'BR';
}

async function obterCepRealDaCidade(cidade, uf) {
  const cidadeSemAcento = String(cidade || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  const sufixosTentativa = [cidadeSemAcento, 'Centro', 'Rua', 'Avenida'];

  for (let i = 0; i < sufixosTentativa.length; i += 1) {
    const termoLogradouro = sufixosTentativa[i];
    if (termoLogradouro.length >= 3) {
      try {
        const url =
          `https://viacep.com.br/ws/${encodeURIComponent(uf)}/` +
          `${encodeURIComponent(cidadeSemAcento)}/` +
          `${encodeURIComponent(termoLogradouro)}/json/`;
        const resp = await fetch(url);
        if (resp.ok) {
          const lista = await resp.json();
          if (Array.isArray(lista) && lista.length > 0 && lista[0].cep) {
            return limparCep(lista[0].cep);
          }
        }
      } catch (erroTentativa) {}
    }
  }

  return CEP_PADRAO_POR_UF[uf] || '80010010';
}

async function selecionarCidadeNaBusca(itemCidade, ehCampoOrigem) {
  const inputAlvo = ehCampoOrigem ? elementosDOM.cepOrigem : elementosDOM.cepDestino;
  const helperAlvo = ehCampoOrigem ? elementosDOM.infoCepOrigem : elementosDOM.infoCepDestino;

  if (ehCampoOrigem) {
    estadoGpsOrigem.temOrigemGps = false;
    estadoGpsOrigem.dadosLocalizacao = null;
  }

  atualizarHelperCep(
    helperAlvo,
    `⏳ Buscando CEP de ${itemCidade.cidade} - ${itemCidade.uf}...`,
    'neutro'
  );

  const cepLimpo = await obterCepRealDaCidade(itemCidade.cidade, itemCidade.uf);
  const cepFormatado = formatarMascaraCep(cepLimpo);

  cacheCeps.set(cepLimpo, {
    cep: cepFormatado,
    cidade: itemCidade.cidade,
    uf: itemCidade.uf,
    bairro: 'Centro',
    logradouro: '',
    latitude: itemCidade.latitude,
    longitude: itemCidade.longitude
  });

  inputAlvo.value = cepFormatado;
  inputAlvo.classList.remove('input-error');

  atualizarHelperCep(
    helperAlvo,
    `📍 ${itemCidade.cidade} - ${itemCidade.uf} (CEP ${cepFormatado})`,
    'ok'
  );

  if (elementosDOM.listaResultadosCidade) {
    elementosDOM.listaResultadosCidade.classList.add('hidden');
  }
}

async function pesquisarCidadesPorNome() {
  const container = elementosDOM.listaResultadosCidade;
  if (!elementosDOM.buscaNomeCidade || !container) {
    return;
  }

  const termo = elementosDOM.buscaNomeCidade.value.trim();
  if (termo.length < 3) {
    container.textContent = '';
    container.classList.add('hidden');
    return;
  }

  container.textContent = '';
  container.classList.remove('hidden');

  const avisoCarregando = document.createElement('div');
  avisoCarregando.className = 'cep-helper';
  avisoCarregando.textContent = '🔎 Buscando cidades brasileiras...';
  container.appendChild(avisoCarregando);

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      termo
    )}&count=10&language=pt&format=json`;
    const resp = await fetch(url);
    const dados = resp.ok ? await resp.json() : {};
    const resultadosBrutos = Array.isArray(dados.results) ? dados.results : [];

    const cidadesBrasil = [];
    const chavesVistas = new Set();

    resultadosBrutos.forEach((item) => {
      if (item.country_code === 'BR' && item.name) {
        const uf = converterEstadoParaUf(item.admin1);
        const chaveUnica = `${item.name.toUpperCase()}-${uf}`;
        if (!chavesVistas.has(chaveUnica)) {
          chavesVistas.add(chaveUnica);
          cidadesBrasil.push({
            cidade: item.name,
            uf,
            latitude: Number(item.latitude),
            longitude: Number(item.longitude)
          });
        }
      }
    });

    container.textContent = '';

    if (cidadesBrasil.length === 0) {
      const semResultado = document.createElement('div');
      semResultado.className = 'cep-helper cep-erro';
      semResultado.textContent = 'Nenhuma cidade encontrada com esse nome.';
      container.appendChild(semResultado);
      return;
    }

    cidadesBrasil.slice(0, 5).forEach((itemCidade) => {
      const linha = document.createElement('div');
      linha.className = 'city-result-item';

      const nomeSpan = document.createElement('span');
      nomeSpan.className = 'city-result-name';
      nomeSpan.textContent = `📍 ${itemCidade.cidade} - ${itemCidade.uf}`;

      const acoesDiv = document.createElement('div');
      acoesDiv.className = 'city-result-actions';

      const btnOrigem = document.createElement('button');
      btnOrigem.type = 'button';
      btnOrigem.className = 'btn-apply-city';
      btnOrigem.textContent = 'Usar na Origem';
      btnOrigem.addEventListener('click', () => {
        selecionarCidadeNaBusca(itemCidade, true);
      });

      const btnDestino = document.createElement('button');
      btnDestino.type = 'button';
      btnDestino.className = 'btn-apply-city';
      btnDestino.textContent = 'Usar no Destino';
      btnDestino.addEventListener('click', () => {
        selecionarCidadeNaBusca(itemCidade, false);
      });

      acoesDiv.appendChild(btnOrigem);
      acoesDiv.appendChild(btnDestino);

      linha.appendChild(nomeSpan);
      linha.appendChild(acoesDiv);
      container.appendChild(linha);
    });
  } catch (erroBuscaCidade) {
    container.textContent = '';
    const erroDiv = document.createElement('div');
    erroDiv.className = 'cep-helper cep-erro';
    erroDiv.textContent = 'Erro ao buscar cidades. Verifique sua conexão.';
    container.appendChild(erroDiv);
  }
}

function inverterCepsOrigemDestino() {
  const valorOrigem = elementosDOM.cepOrigem.value;
  const valorDestino = elementosDOM.cepDestino.value;

  estadoGpsOrigem.temOrigemGps = false;
  estadoGpsOrigem.dadosLocalizacao = null;

  elementosDOM.cepOrigem.value = valorDestino;
  elementosDOM.cepDestino.value = valorOrigem;

  consultarPreviaCepNoInput(elementosDOM.cepOrigem, elementosDOM.infoCepOrigem, true);
  consultarPreviaCepNoInput(elementosDOM.cepDestino, elementosDOM.infoCepDestino, false);
}

function limparCamposFormulario() {
  ocultarMensagemAlerta();
  estadoGpsOrigem.temOrigemGps = false;
  estadoGpsOrigem.dadosLocalizacao = null;

  elementosDOM.cepOrigem.value = '';
  elementosDOM.cepDestino.value = '';
  elementosDOM.custoPedagio.value = '0';
  elementosDOM.qtdPassageiros.value = '1';
  elementosDOM.idaEVolta.checked = false;

  elementosDOM.cepOrigem.classList.remove('input-error');
  elementosDOM.cepDestino.classList.remove('input-error');

  atualizarHelperCep(elementosDOM.infoCepOrigem, 'Digite 8 números ou use o GPS', 'neutro');
  atualizarHelperCep(elementosDOM.infoCepDestino, 'Ex.: 88010-400', 'neutro');

  elementosDOM.secaoResultado.classList.add('hidden');
  ultimaSimulacao = null;
}

function aplicarTema(ehModoEscuro) {
  document.body.classList.toggle('dark-theme', ehModoEscuro);
  if (!elementosDOM.btnAlternarTema) {
    return;
  }
  elementosDOM.btnAlternarTema.textContent = ehModoEscuro
    ? '☀️ Modo Claro'
    : '🌙 Modo Escuro';
}

function carregarTemaSalvo() {
  try {
    const temaSalvo = localStorage.getItem(CHAVE_STORAGE_TEMA);
    if (temaSalvo === 'dark') {
      aplicarTema(true);
      return;
    }
    if (temaSalvo === 'light') {
      aplicarTema(false);
      return;
    }
  } catch (erroTema) {}

  const prefereEscuroSistema =
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  aplicarTema(Boolean(prefereEscuroSistema));
}

function alternarTema() {
  const ehModoEscuroNovo = !document.body.classList.contains('dark-theme');
  aplicarTema(ehModoEscuroNovo);
  try {
    localStorage.setItem(CHAVE_STORAGE_TEMA, ehModoEscuroNovo ? 'dark' : 'light');
  } catch (erroSalvarTema) {}
}

function inicializarAplicacao() {
  carregarTemaSalvo();
  carregarPreferenciasVeiculo();
  carregarHistoricoSalvo();

  elementosDOM.consumoKml.value = veiculo.consumoKml;
  elementosDOM.precoCombustivel.value = veiculo.precoCombustivel;

  renderizarHistoricoDOM();

  elementosDOM.cepOrigem.addEventListener('input', () => {
    consultarPreviaCepNoInput(elementosDOM.cepOrigem, elementosDOM.infoCepOrigem, true);
  });

  elementosDOM.cepDestino.addEventListener('input', () => {
    consultarPreviaCepNoInput(elementosDOM.cepDestino, elementosDOM.infoCepDestino, false);
  });

  elementosDOM.consumoKml.addEventListener('input', () => {
    elementosDOM.consumoKml.classList.remove('input-error');
    const consumo = parseFloat(elementosDOM.consumoKml.value);
    const preco = parseFloat(elementosDOM.precoCombustivel.value);
    salvarPreferenciasVeiculo(consumo, preco);
    recalcularSimulacaoAtivaInstantaneamente();
  });

  elementosDOM.precoCombustivel.addEventListener('input', () => {
    elementosDOM.precoCombustivel.classList.remove('input-error');
    const consumo = parseFloat(elementosDOM.consumoKml.value);
    const preco = parseFloat(elementosDOM.precoCombustivel.value);
    salvarPreferenciasVeiculo(consumo, preco);
    recalcularSimulacaoAtivaInstantaneamente();
  });

  elementosDOM.qtdPassageiros.addEventListener('input', () => {
    elementosDOM.qtdPassageiros.classList.remove('input-error');
    recalcularSimulacaoAtivaInstantaneamente();
  });

  elementosDOM.custoPedagio.addEventListener('input', () => {
    elementosDOM.custoPedagio.classList.remove('input-error');
    recalcularSimulacaoAtivaInstantaneamente();
  });

  elementosDOM.idaEVolta.addEventListener('change', () => {
    recalcularSimulacaoAtivaInstantaneamente();
  });

  elementosDOM.formulario.addEventListener('submit', processarCalculoViagem);
  elementosDOM.btnLimparForm.addEventListener('click', limparCamposFormulario);
  elementosDOM.btnGeolocalizacao.addEventListener('click', usarLocalizacaoGpsAtual);
  if (elementosDOM.btnInverterCeps) {
    elementosDOM.btnInverterCeps.addEventListener('click', inverterCepsOrigemDestino);
  }
  elementosDOM.btnCopiarWhatsapp.addEventListener('click', copiarResumoWhatsApp);
  elementosDOM.btnLimparHistorico.addEventListener('click', limparHistoricoViagens);
  if (elementosDOM.btnAlternarTema) {
    elementosDOM.btnAlternarTema.addEventListener('click', alternarTema);
  }

  if (elementosDOM.btnBuscarCidade && elementosDOM.buscaNomeCidade) {
    elementosDOM.btnBuscarCidade.addEventListener('click', pesquisarCidadesPorNome);
    elementosDOM.buscaNomeCidade.addEventListener('keydown', (eventoTecla) => {
      if (eventoTecla.key === 'Enter') {
        eventoTecla.preventDefault();
        pesquisarCidadesPorNome();
      }
    });
    elementosDOM.buscaNomeCidade.addEventListener('input', () => {
      clearTimeout(temporizadorBuscaCidade);
      temporizadorBuscaCidade = setTimeout(pesquisarCidadesPorNome, 320);
    });
  }

  elementosDOM.botoesPreset.forEach((botao) => {
    botao.addEventListener('click', () => {
      const cepOrigemPreset = botao.getAttribute('data-origem');
      const cepDestinoPreset = botao.getAttribute('data-destino');

      elementosDOM.cepOrigem.value = cepOrigemPreset;
      elementosDOM.cepDestino.value = cepDestinoPreset;

      consultarPreviaCepNoInput(elementosDOM.cepOrigem, elementosDOM.infoCepOrigem, true);
      consultarPreviaCepNoInput(elementosDOM.cepDestino, elementosDOM.infoCepDestino, false);
    });
  });

  elementosDOM.botoesCombustivel.forEach((botaoComb) => {
    botaoComb.addEventListener('click', () => {
      elementosDOM.botoesCombustivel.forEach((b) => b.classList.remove('active'));
      botaoComb.classList.add('active');

      const kmlSugerido = parseFloat(botaoComb.getAttribute('data-kml'));
      const precoSugerido = parseFloat(botaoComb.getAttribute('data-preco'));

      elementosDOM.consumoKml.value = kmlSugerido;
      elementosDOM.precoCombustivel.value = precoSugerido;
      elementosDOM.consumoKml.classList.remove('input-error');
      elementosDOM.precoCombustivel.classList.remove('input-error');

      salvarPreferenciasVeiculo(kmlSugerido, precoSugerido);
      recalcularSimulacaoAtivaInstantaneamente();
    });
  });
}

document.addEventListener('DOMContentLoaded', inicializarAplicacao);
