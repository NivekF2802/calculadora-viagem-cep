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

const ICONE_SVG_MAP_PIN =
  '<svg class="ui-icon ui-icon-sm" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>';

const ICONE_SVG_FUEL =
  '<svg class="ui-icon ui-icon-sm" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="15" y1="22" y2="22"/><line x1="4" x2="14" y1="9" y2="9"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/></svg>';

const ICONE_SVG_TOLL =
  '<svg class="ui-icon ui-icon-sm" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" x2="9" y1="3" y2="18"/><line x1="15" x2="15" y1="6" y2="21"/></svg>';

const ICONE_SVG_TAG =
  '<svg class="ui-icon ui-icon-sm" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 1.9a2 2 0 0 1-1.4.6H4a1 1 0 0 0-1 1v4.7a2 2 0 0 1-.6 1.4L.5 13.5a1 1 0 0 0 0 1.4l8.6 8.6a1 1 0 0 0 1.4 0l1.9-1.9a2 2 0 0 1 1.4-.6H19a1 1 0 0 0 1-1v-4.7a2 2 0 0 1 .6-1.4l1.9-1.9a1 1 0 0 0 0-1.4L13.9 3.5a1 1 0 0 0-1.4 0Z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>';

const ICONE_SVG_CAR =
  '<svg class="ui-icon ui-icon-sm" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>';

const ICONE_SVG_SUN =
  '<svg class="ui-icon ui-icon-sm" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>';

const ICONE_SVG_MOON =
  '<svg class="ui-icon ui-icon-sm" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';

async function fetchComTimeout(url, opcoes = {}, timeoutMs = 7000) {
  if (typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine) {
    throw new Error('Você está sem conexão com a internet. Verifique sua rede.');
  }

  const controlador = new AbortController();
  const idTimer = setTimeout(() => controlador.abort(), timeoutMs);

  try {
    const resposta = await fetch(url, {
      ...opcoes,
      signal: controlador.signal
    });
    clearTimeout(idTimer);
    return resposta;
  } catch (erroFetch) {
    clearTimeout(idTimer);
    if (erroFetch.name === 'AbortError') {
      throw new Error('O tempo de conexão com o servidor expirou. Tente novamente.');
    }
    throw erroFetch;
  }
}

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
    const textoSalvo = localStorage.getItem(CHAVE_STORAGE_HISTORICO);
    if (!textoSalvo) {
      return;
    }
    const dados = JSON.parse(textoSalvo);
    if (Array.isArray(dados)) {
      historicoViagens = dados.slice(0, LIMITE_HISTORICO);
    }
  } catch (erroHistorico) {
    historicoViagens = [];
  }
}

function salvarViagemNoHistorico(novaViagem) {
  historicoViagens = [
    novaViagem,
    ...historicoViagens.filter((viagem) => viagem.id !== novaViagem.id)
  ].slice(0, LIMITE_HISTORICO);

  try {
    localStorage.setItem(CHAVE_STORAGE_HISTORICO, JSON.stringify(historicoViagens));
  } catch (erroStorage) {}
}

function limparHistoricoViagens() {
  historicoViagens = [];
  try {
    localStorage.removeItem(CHAVE_STORAGE_HISTORICO);
  } catch (erroStorage) {}
  renderizarHistoricoDOM();
}

const COORDENADAS_CIDADES_FALLBACK = {
  'DOIS VIZINHOS-PR': { latitude: -25.7505, longitude: -53.0574 },
  'CASCAVEL-PR': { latitude: -24.9578, longitude: -53.4595 },
  'PATO BRANCO-PR': { latitude: -26.2295, longitude: -52.6716 },
  'FRANCISCO BELTRAO-PR': { latitude: -26.0811, longitude: -53.0551 },
  'CURITIBA-PR': { latitude: -25.4284, longitude: -49.2733 },
  'FOZ DO IGUACU-PR': { latitude: -25.5163, longitude: -54.5854 },
  'MARINGA-PR': { latitude: -23.4205, longitude: -51.9333 },
  'LONDRINA-PR': { latitude: -23.3045, longitude: -51.1696 },
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
      const respAwesome = await fetchComTimeout(
        `https://cep.awesomeapi.com.br/json/${cepLimpo}`,
        {},
        4000
      );
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
    const respGeo = await fetchComTimeout(
      `https://geocoding-api.open-meteo.com/v1/search?name=${consulta}&count=5&language=pt&format=json`,
      {},
      4500
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
    `O CEP ${formatarMascaraCep(cepLimpo)} (${cidade}/${uf}) não retornou coordenadas. Digite um CEP específico ou busque pelo nome da cidade.`
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
    const respViaCep = await fetchComTimeout(
      `https://viacep.com.br/ws/${cepEfetivo}/json/`,
      {},
      5000
    );
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

  throw new Error(`O CEP ${formatarMascaraCep(cepOriginalLimpo)} não foi localizado nos serviços postais.`);
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

  let response = null;
  try {
    response = await fetchComTimeout(url, {}, 6000);
  } catch (erroRede) {
    const fallbackRede = await consultarViaCepFallback(cepEfetivo, cepLimpo);
    cacheCeps.set(cepLimpo, fallbackRede);
    return fallbackRede;
  }

  if (!response.ok) {
    const resultadoFallback = await consultarViaCepFallback(cepEfetivo, cepLimpo);
    cacheCeps.set(cepLimpo, resultadoFallback);
    return resultadoFallback;
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
    const response = await fetchComTimeout(urlOsrm, {}, 6000);
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
    metodo: 'Estimativa Haversine (Rede OSRM indisponível)',
    coordenadasLinha: linhaDireta
  };
}

const elementosDOM = {
  bannerOffline: document.getElementById('banner-offline'),
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
  iconeTema: document.getElementById('icone-tema'),
  textoTema: document.getElementById('texto-tema'),
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
  elementoHelper.innerHTML = mensagem;
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
  spanComb.innerHTML = `${ICONE_SVG_FUEL} Combustível: ${percentualCombustivel}% (${formatarMoeda(simulacao.custoCombustivel)})`;

  const spanPed = document.createElement('span');
  spanPed.innerHTML = `${ICONE_SVG_TOLL} Pedágio/Extras: ${percentualPedagio}% (${formatarMoeda(simulacao.custoPedagio)})`;

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
    textoSpan.innerHTML = `${ICONE_SVG_CAR} Vai viajar mais de 200 km? Compare locadoras de veículos e faça revisão preventiva antes de pegar a estrada.`;
    linkAfiliado.textContent = 'Ver dicas para viagens longas →';
    container.appendChild(textoSpan);
    container.appendChild(linkAfiliado);
    return;
  }

  textoSpan.innerHTML = `${ICONE_SVG_TAG} Evite filas nas cabines de pedágio: utilize uma tag de passagem automática na sua rota.`;
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

  atualizarHelperCep(elementosDOM.infoCepOrigem, `${ICONE_SVG_MAP_PIN} ${viagem.nomeOrigem}`, 'ok');
  atualizarHelperCep(elementosDOM.infoCepDestino, `${ICONE_SVG_MAP_PIN} ${viagem.nomeDestino}`, 'ok');

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

  atualizarHelperCep(helperElemento, 'Consultando CEP na base de dados...', 'neutro');

  try {
    const dadosCep = await buscarDadosCep(cepLimpo);
    const detalheBairro = dadosCep.bairro ? ` (${dadosCep.bairro})` : '';
    atualizarHelperCep(
      helperElemento,
      `${ICONE_SVG_MAP_PIN} ${dadosCep.cidade} - ${dadosCep.uf}${detalheBairro}`,
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

  const htmlOriginalBotao = elementosDOM.btnCalcular.innerHTML;
  elementosDOM.btnCalcular.disabled = true;
  elementosDOM.btnCalcular.textContent = 'Calculando rota...';

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
        `${ICONE_SVG_MAP_PIN} ${dadosOrigem.cidade} - ${dadosOrigem.uf}`,
        'ok'
      );
    }
    atualizarHelperCep(
      elementosDOM.infoCepDestino,
      `${ICONE_SVG_MAP_PIN} ${dadosDestino.cidade} - ${dadosDestino.uf}`,
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
    elementosDOM.btnCalcular.innerHTML = htmlOriginalBotao;
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
    const response = await fetchComTimeout(url, {}, 5000);
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
    'Obtendo coordenadas do GPS do seu dispositivo...',
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
        `${ICONE_SVG_MAP_PIN} Origem via GPS: ${localDetectado.cidade}${localDetectado.uf ? ' - ' + localDetectado.uf : ''}`,
        'ok'
      );
      elementosDOM.btnGeolocalizacao.disabled = false;
    },
    (erroGps) => {
      elementosDOM.btnGeolocalizacao.disabled = false;
      let mensagemErro = 'Permissão de GPS negada. Digite o CEP manualmente.';
      if (erroGps.code === 2) {
        mensagemErro = 'Sinal de GPS indisponível no momento. Digite o CEP manualmente.';
      }
      if (erroGps.code === 3) {
        mensagemErro = 'Tempo limite de GPS esgotado. Digite o CEP de origem manualmente.';
      }
      atualizarHelperCep(elementosDOM.infoCepOrigem, mensagemErro, 'erro');
      exibirMensagemAlerta(mensagemErro);
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
        const resp = await fetchComTimeout(url, {}, 4000);
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
    `Buscando CEP de ${itemCidade.cidade} - ${itemCidade.uf}...`,
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
    `${ICONE_SVG_MAP_PIN} ${itemCidade.cidade} - ${itemCidade.uf} (CEP ${cepFormatado})`,
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
  avisoCarregando.textContent = 'Buscando municípios...';
  container.appendChild(avisoCarregando);

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      termo
    )}&count=10&language=pt&format=json`;
    const resp = await fetchComTimeout(url, {}, 4500);
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
      nomeSpan.innerHTML = `${ICONE_SVG_MAP_PIN} ${itemCidade.cidade} - ${itemCidade.uf}`;

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
    erroDiv.textContent = 'Não foi possível consultar os municípios. Verifique sua conexão.';
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

  if (ehModoEscuro) {
    elementosDOM.btnAlternarTema.innerHTML = `${ICONE_SVG_SUN}<span>Modo Claro</span>`;
    return;
  }
  elementosDOM.btnAlternarTema.innerHTML = `${ICONE_SVG_MOON}<span>Modo Escuro</span>`;
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

function atualizarEstadoConexao() {
  if (!elementosDOM.bannerOffline) {
    return;
  }
  if (navigator.onLine) {
    elementosDOM.bannerOffline.classList.add('hidden');
    return;
  }
  elementosDOM.bannerOffline.classList.remove('hidden');
}

function inicializarAplicacao() {
  carregarTemaSalvo();
  carregarPreferenciasVeiculo();
  carregarHistoricoSalvo();

  elementosDOM.consumoKml.value = veiculo.consumoKml;
  elementosDOM.precoCombustivel.value = veiculo.precoCombustivel;

  renderizarHistoricoDOM();
  atualizarEstadoConexao();

  window.addEventListener('online', atualizarEstadoConexao);
  window.addEventListener('offline', atualizarEstadoConexao);
  window.addEventListener('resize', () => {
    if (instanciaMapaLeaflet) {
      instanciaMapaLeaflet.invalidateSize();
    }
  });

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