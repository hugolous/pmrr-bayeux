
// ############ 0. PARÂMETROS #########################################################
var MODO   = 'analisar';   // 'gerar_pontos' | 'interface' | 'analisar'
var VERSAO = 'v5';

// --- Amostragem (usados em 'gerar_pontos') ---
var N_POR_CLASSE  = 50;    // 50 x 5 classes = 250 pontos
var SEED_VALID    = 2026;  // semente independente da usada no script 30_
var BUFFER_TREINO = 20;    // metros de folga ao redor dos polígonos de treino

// --- Interface (usados em 'interface') ---
var BLOCO     = 5;      // 1 a 5 — Paulo faz um bloco por sessão
var TAM_BLOCO = 50;     // pontos por bloco
var ZOOM      = 18;     // zoom fixo: todos os pontos avaliados na mesma escala

// --- Análise (usado em 'analisar') ---
var ASSET_RESPOSTAS = 'amostras/valid_respostas_' + VERSAO;

// --- Legenda ---
var CLASSES = [1, 2, 3, 4, 5];
var NOMES   = ['Agua', 'Solo_exposto', 'Veg_alto_porte', 'Veg_baixo_porte', 'Urbano'];
var PALETA  = ['#1f6fb4', '#c9a227', '#1a6b2f', '#8fce5b', '#d1462f'];
var COD_INCERTO = 9;   // ponto que não foi possível decidir — sai do cálculo

var RAIZ = 'projects/pmrr-bayeux/assets/';


// ############ 1. CONFIG E INSUMOS ###################################################
var cfg = require('users/pmrrbayeux/pmrr:00_config');
var aoi = cfg.getAOI();
var CRS    = cfg.CRS    || 'EPSG:31985';
var ESCALA = cfg.ESCALA || 10;

var mapa = ee.Image(RAIZ + 'base/Uso_cobertura_RF_' + VERSAO).rename('classe');
var composite = ee.Image(RAIZ + 'base/S2_composite');


// ####################################################################################
// ############ MODO 1 — GERAR PONTOS (Uendry roda uma vez) ###########################
// ####################################################################################
if (MODO === 'gerar_pontos') {

  print('════════ MODO: GERAR PONTOS ════════');

  // --- 1.1 Máscara: remove os polígonos de treino (+ buffer) da área sorteável ---
  var treino = ee.FeatureCollection(RAIZ + 'amostras/split_treino_' + VERSAO);
  var treinoBuf = treino.map(function(f) {
    return f.buffer(BUFFER_TREINO);
  });
  var mascara = ee.Image(1).byte().paint(treinoBuf, 0).rename('ok');
  var mapaAmostravel = mapa.updateMask(mascara).clip(aoi);

  // --- 1.2 Sorteio estratificado pelas CLASSES DO MAPA ---
  var pontos = mapaAmostravel.stratifiedSample({
    numPoints: N_POR_CLASSE,
    classBand: 'classe',
    region: aoi,
    scale: ESCALA,
    seed: SEED_VALID,
    geometries: true,
    tileScale: 8
  });

  // --- 1.3 Embaralhar ANTES de numerar ---
  // Se os pontos ficarem agrupados por classe, o fotointérprete rotula 50 águas
  // seguidas e desenvolve viés de ancoragem. O embaralhamento mistura as classes.
  var embaralhados = pontos.randomColumn('ord', SEED_VALID).sort('ord');

  var n = embaralhados.size();
  var lista = embaralhados.toList(n);

  var numerados = ee.FeatureCollection(
    ee.List.sequence(0, n.subtract(1)).map(function(i) {
      i = ee.Number(i);
      var f = ee.Feature(lista.get(i));
      var c = f.geometry().coordinates();
      return f.set({
        id: i.add(1),
        classe_mapa: f.get('classe'),
        bloco: i.divide(TAM_BLOCO).floor().add(1),
        lon: c.get(0),
        lat: c.get(1)
      });
    })
  );

  print('Total de pontos sorteados:', n);
  print('Pontos por classe do mapa:',
    ee.FeatureCollection(CLASSES.map(function(k, idx) {
      return ee.Feature(null, {
        classe: k, nome: NOMES[idx],
        n_pontos: numerados.filter(ee.Filter.eq('classe_mapa', k)).size()
      });
    })));
  print('Pontos por bloco (1 bloco por sessão):',
    numerados.aggregate_histogram('bloco'));

  // --- 1.4 Versão CEGA — é a que o fotointérprete abre ---
  // Sem classe_mapa. A fotointerpretação precisa ser independente do resultado.
  var cegos = numerados.select(['id', 'bloco', 'lon', 'lat']);

  // --- 1.5 Exportações ---
  Export.table.toAsset({
    collection: numerados,
    description: 'ASSET_valid_pontos_' + VERSAO,
    assetId: RAIZ + 'amostras/valid_pontos_' + VERSAO
  });
  Export.table.toAsset({
    collection: cegos,
    description: 'ASSET_valid_pontos_cego_' + VERSAO,
    assetId: RAIZ + 'amostras/valid_pontos_cego_' + VERSAO
  });

  // Para conferência no QGIS e alternativa de trabalho offline
  Export.table.toDrive({
    collection: cegos, description: 'SHP_valid_pontos_cego',
    folder: 'PMRR_Bayeux',
    fileNamePrefix: 'PMRR_Bayeux_valid_pontos_cego_' + VERSAO,
    fileFormat: 'SHP'
  });
  Export.table.toDrive({
    collection: cegos, description: 'KML_valid_pontos_cego',
    folder: 'PMRR_Bayeux',
    fileNamePrefix: 'PMRR_Bayeux_valid_pontos_cego_' + VERSAO,
    fileFormat: 'KML'
  });

  Map.centerObject(aoi, 12);
  Map.addLayer(mapa, {min: 1, max: 5, palette: PALETA}, 'Classificação ' + VERSAO, false);
  Map.addLayer(mascara.selfMask(), {palette: ['#cccccc']}, 'Área sorteável', false);
  Map.addLayer(treinoBuf, {color: 'red'}, 'Treino excluído (+buffer)', false);
  Map.addLayer(numerados, {color: 'yellow'}, 'Pontos de validação');

  print('>>> Rode as tasks ASSET_valid_pontos_' + VERSAO +
        ' e ASSET_valid_pontos_cego_' + VERSAO + '.');
  print('>>> Depois entregue este script com MODO = "interface" e BLOCO = 1.');
}


// ####################################################################################
// ############ MODO 2 — INTERFACE DE FOTOINTERPRETAÇÃO ###############################
// ####################################################################################
if (MODO === 'interface') {

  var idIni = (BLOCO - 1) * TAM_BLOCO + 1;
  var idFim = BLOCO * TAM_BLOCO;

  var pts = ee.FeatureCollection(RAIZ + 'amostras/valid_pontos_cego_' + VERSAO)
              .filter(ee.Filter.and(ee.Filter.gte('id', idIni),
                                    ee.Filter.lte('id', idFim)))
              .sort('id');

  // ---------- Estado do lado do cliente ----------
  var dados = [];       // [{id, lon, lat}]
  var rotulos = {};     // {id: codigo}
  var atual = 0;

  // ---------- Mapa ----------
  var mapaUI = ui.Map();
  mapaUI.setOptions('SATELLITE');
  mapaUI.setControlVisibility({
    layerList: true,           // sem isto o ícone de camadas não aparece
    zoomControl: true,
    mapTypeControl: true,
    scaleControl: true,        // barra de escala ajuda a julgar os 10 m
    fullscreenControl: false,
    drawingToolsControl: false
  });

  // Camadas FIXAS — adicionadas UMA vez, para preservar o estado ligado/desligado.
  // Índice 0 = S2 cor real · 1 = S2 falsa cor · 2 = pixel avaliado (trocado por ponto).
  mapaUI.addLayer(composite.select(['B4','B3','B2']),
    {min: 0.02, max: 0.30, gamma: 1.3}, 'S2 cor real', false);
  mapaUI.addLayer(composite.select(['B8','B4','B3']),
    {min: 0.02, max: 0.45, gamma: 1.3}, 'S2 falsa cor (infravermelho)', false);

  // ---------- Widgets do painel ----------
  var lblTitulo = ui.Label('VALIDAÇÃO PMRR BAYEUX — Bloco ' + BLOCO,
    {fontWeight: 'bold', fontSize: '16px'});
  var lblProgresso = ui.Label('Carregando...', {fontSize: '13px'});
  var lblPonto = ui.Label('', {fontSize: '20px', fontWeight: 'bold', color: '#1a6b2f'});
  var lblResposta = ui.Label('', {fontSize: '13px', color: '#555'});

  var instrucoes = ui.Label(
    'Classifique o QUADRADO BRANCO no centro do mapa (10 x 10 m). ' +
    'Não o entorno — apenas o que está dentro do quadrado. ' +
    'Havendo mistura, escolha o que ocupa MAIS DE METADE. ' +
    'Se for impossível decidir, use "Incerto".',
    {fontSize: '12px', color: '#333'});

  function botaoClasse(codigo, texto, cor) {
    return ui.Button({
      label: texto,
      style: {stretch: 'horizontal', color: cor, fontWeight: 'bold'},
      onClick: function() {
        rotulos[dados[atual].id] = codigo;
        if (atual < dados.length - 1) { irPara(atual + 1); }
        else { atualizarPainel(); }
      }
    });
  }

  var btns = ui.Panel([
    botaoClasse(1, '1 — Água', '#1f6fb4'),
    botaoClasse(2, '2 — Solo exposto', '#c9a227'),
    botaoClasse(3, '3 — Vegetação de ALTO porte (árvore/mangue)', '#1a6b2f'),
    botaoClasse(4, '4 — Vegetação de BAIXO porte (capim/gramado)', '#6a9e30'),
    botaoClasse(5, '5 — Urbano / impermeabilizado', '#d1462f'),
    botaoClasse(COD_INCERTO, '9 — Incerto / misto', '#777777')
  ], ui.Panel.Layout.flow('vertical'), {stretch: 'horizontal'});

  var btnAnt = ui.Button({label: '< Anterior', onClick: function() {
    if (atual > 0) { irPara(atual - 1); }
  }});
  var btnProx = ui.Button({label: 'Próximo >', onClick: function() {
    if (atual < dados.length - 1) { irPara(atual + 1); }
  }});
  var navegacao = ui.Panel([btnAnt, btnProx], ui.Panel.Layout.flow('horizontal'));

  // ---------- Protocolo dentro do painel ----------
  // ui.root.clear() elimina o console, então o protocolo NÃO pode ficar em print().
  var textoProtocolo = ui.Label(
    'REGRAS DE FRONTEIRA (acordadas com a equipe)\n\n' +
    '• Telhado, laje, asfalto, calçada .......... 5 Urbano\n' +
    '• Piscina que ocupe a maior parte .......... 1 Água\n' +
    '• Quintal com copa de árvore cobrindo ...... 3 Veg. alto porte\n' +
    '• Quintal gramado, sem árvore .............. 4 Veg. baixo porte\n' +
    '• Gramado, campo, capim, pasto ............. 4 Veg. baixo porte\n' +
    '• Terra batida, areia, obra, lote raspado .. 2 Solo exposto\n' +
    '• Rua de terra ............................. 2 Solo exposto\n' +
    '• Manguezal ................................ 3 Veg. alto porte\n' +
    '• Lama de maré exposta ..................... 2 Solo exposto\n' +
    '• Água escura visível no mangue ............ 1 Água\n' +
    '• Campo de futebol de terra ................ 2 Solo exposto\n' +
    '• Campo de futebol gramado ................. 4 Veg. baixo porte\n' +
    '• Telhado tomado por mato .................. 3 Veg. alto porte\n' +
    '• Sombra densa, sem ver o que há embaixo ... 9 Incerto\n\n' +
    'PISTA MAIS ÚTIL: árvore projeta SOMBRA e tem textura granulada. ' +
    'Capim e gramado não projetam sombra e têm textura lisa.\n\n' +
    'FALSA COR (ligue no ícone de camadas): vegetação viva fica VERMELHA, ' +
    'água fica PRETA. Resolve a maior parte dos casos difíceis.\n\n' +
    'DATAS: o fundo de alta resolução do Google pode ser de outra data. ' +
    'Use-o para identificar O QUE é; use a imagem Sentinel-2 para confirmar ' +
    'que ainda era assim no período do mapa (ago/2025 a abr/2026). ' +
    'Se discordarem claramente, marque 9 e anote o ID.\n\n' +
    'NÃO tente adivinhar o que o mapa diz. A validação só tem valor se a ' +
    'sua leitura for independente.',
    {fontSize: '11px', color: '#333', whiteSpace: 'pre'});

  var painelProtocolo = ui.Panel({
    widgets: [textoProtocolo],
    style: {shown: false, backgroundColor: '#f4f4f4', padding: '6px'}
  });

  var btnProtocolo = ui.Button({
    label: '📋 Mostrar / ocultar regras',
    style: {stretch: 'horizontal'},
    onClick: function() {
      painelProtocolo.style().set('shown', !painelProtocolo.style().get('shown'));
    }
  });

  // ---------- Exportação ----------
  var btnExportar = ui.Button({
    label: '⬇ EXPORTAR BLOCO ' + BLOCO,
    style: {stretch: 'horizontal', fontWeight: 'bold'},
    onClick: function() {
      var feats = [];
      for (var i = 0; i < dados.length; i++) {
        var d = dados[i];
        var r = (rotulos[d.id] === undefined) ? null : rotulos[d.id];
        feats.push(ee.Feature(null, {
          id: d.id, classe_ref: r, bloco: BLOCO,
          lon: d.lon, lat: d.lat
        }));
      }
      Export.table.toDrive({
        collection: ee.FeatureCollection(feats),
        description: 'CSV_valid_respostas_bloco' + BLOCO,
        folder: 'PMRR_Bayeux',
        fileNamePrefix: 'PMRR_Bayeux_valid_respostas_bloco' + BLOCO,
        fileFormat: 'CSV'
      });
      lblResposta.setValue('Task criada. Abra a aba TASKS (à direita) e clique em RUN. ' +
                           'NÃO feche a aba antes de a task ficar verde.');
    }
  });

  var avisoSalvar = ui.Label(
    'ATENÇÃO: o progresso NÃO é salvo automaticamente. Se fechar a aba ou atualizar ' +
    'a página, o bloco inteiro é perdido. Exporte ao terminar (ou antes de pausas).',
    {fontSize: '11px', color: '#b00'});

  var painel = ui.Panel({
    widgets: [lblTitulo, lblProgresso, lblPonto, instrucoes, btns,
              navegacao, lblResposta, ui.Label(''),
              btnProtocolo, painelProtocolo, ui.Label(''),
              btnExportar, avisoSalvar],
    style: {width: '350px', padding: '8px'}
  });

  // ---------- Funções de navegação ----------
  function atualizarPainel() {
    var d = dados[atual];
    var respondidos = Object.keys(rotulos).length;
    lblProgresso.setValue('Ponto ' + (atual + 1) + ' de ' + dados.length +
                          '  |  respondidos: ' + respondidos + '/' + dados.length);
    lblPonto.setValue('ID ' + d.id);
    var r = rotulos[d.id];
    lblResposta.setValue(r === undefined
      ? 'Ainda não classificado.'
      : 'Resposta atual: ' + (r === COD_INCERTO ? 'Incerto' : NOMES[r - 1]) +
        '  (clique em outro botão para corrigir)');
  }

  function irPara(i) {
    atual = i;
    var d = dados[atual];
    var pt = ee.Geometry.Point([d.lon, d.lat]);
    var caixa = pt.buffer(5).bounds();   // pixel de 10 m

    var camadaPixel = ui.Map.Layer(
      ee.FeatureCollection([ee.Feature(caixa)]).style(
        {color: 'white', fillColor: '00000000', width: 3}),
      {}, 'PIXEL AVALIADO');

    // Troca APENAS a camada do pixel. As camadas S2 mantêm o estado
    // ligado/desligado que o fotointérprete escolheu.
    if (mapaUI.layers().length() > 2) {
      mapaUI.layers().set(2, camadaPixel);
    } else {
      mapaUI.layers().add(camadaPixel);
    }

    mapaUI.centerObject(pt, ZOOM);
    atualizarPainel();
  }

  // ---------- Montagem ----------
  ui.root.clear();
  ui.root.add(ui.SplitPanel({firstPanel: painel, secondPanel: mapaUI}));

  pts.evaluate(function(fc) {
    if (!fc || !fc.features || fc.features.length === 0) {
      lblProgresso.setValue('ERRO: nenhum ponto neste bloco. Confira BLOCO e VERSAO, ' +
                            'ou peça liberação de acesso ao asset.');
      return;
    }
    dados = fc.features.map(function(f) {
      return {id: f.properties.id, lon: f.properties.lon, lat: f.properties.lat};
    });
    dados.sort(function(a, b) { return a.id - b.id; });
    irPara(0);
  });
}


// ####################################################################################
// ############ MODO 3 — ANÁLISE (Uendry roda ao final) ###############################
// ####################################################################################
if (MODO === 'analisar') {

  print('════════ MODO: ANÁLISE — ACURÁCIA OFICIAL ════════');

  var pontosFull = ee.FeatureCollection(RAIZ + 'amostras/valid_pontos_' + VERSAO);
  var respostas  = ee.FeatureCollection(RAIZ + ASSET_RESPOSTAS)
    .map(function(f) {
      return f.set('classe_ref', ee.Number.parse(f.get('classe_ref')));
    });

  // --- 3.1 Junta respostas com a classe do mapa ---
  var juncao = ee.Join.inner('p', 'r').apply(
    pontosFull, respostas,
    ee.Filter.equals({leftField: 'id', rightField: 'id'})
  );
  var pareado = ee.FeatureCollection(juncao.map(function(f) {
    var p = ee.Feature(f.get('p'));
    var r = ee.Feature(f.get('r'));
    return ee.Feature(null, {
      id: p.get('id'),
      classe_mapa: p.get('classe_mapa'),
      classe_ref: r.get('classe_ref')
    });
  }));

  var incertos = pareado.filter(ee.Filter.eq('classe_ref', COD_INCERTO)).size();
  var validos  = pareado.filter(ee.Filter.inList('classe_ref', CLASSES));

  print('== 1. CONFERÊNCIA DA AMOSTRA ==');
  print('Pontos pareados:', pareado.size());
  print('Marcados como INCERTO (excluídos do cálculo):', incertos);
  print('Pontos válidos para o estimador:', validos.size());
  print('Distribuição da referência:', validos.aggregate_histogram('classe_ref'));

  // --- 3.2 Área e peso W por classe ---
  var grpArea = ee.List(ee.Dictionary(
    ee.Image.pixelArea().divide(1e4).addBands(mapa).reduceRegion({
      reducer: ee.Reducer.sum().group({groupField: 1, groupName: 'classe'}),
      geometry: aoi, scale: ESCALA, maxPixels: 1e13, tileScale: 8
    })).get('groups'));

  var areaPorClasse = ee.Dictionary(
    grpArea.map(function(el) {
      return ee.String(ee.Dictionary(el).getNumber('classe').format('%d'));
    }).zip(grpArea.map(function(el) {
      return ee.Dictionary(el).getNumber('sum');
    })).flatten()
  );
  var areaTotal = ee.Number(ee.List(areaPorClasse.values()).reduce(ee.Reducer.sum()));

  // Listas JS-nativas (evita matrixToDiag / project, que causaram o erro)
  var Wl = CLASSES.map(function(k) {
    return ee.Number(areaPorClasse.get(String(k))).divide(areaTotal);
  });
  print('== 2. PESOS DE ÁREA (W) ==');
  print('Área total (ha):', areaTotal);
  print('W por classe (1..5):', ee.List(Wl));

  // --- 3.3 Matriz bruta (linha = MAPA, coluna = REFERÊNCIA) ---
  var mc  = validos.errorMatrix('classe_mapa', 'classe_ref', ee.List(CLASSES));
  var arr = mc.array();
  print('== 3. MATRIZ DE CONTAGEM (bruta) ==');
  print('Linha = MAPA · Coluna = REFERÊNCIA:', mc);
  print('Acurácia bruta NÃO ponderada (diagnóstico — NÃO reportar):', mc.accuracy());
  print('Kappa (matriz bruta):', mc.kappa());

  // n_i. por estrato e n_ij (célula) — tudo via get(), sem álgebra de matriz
  function cel(i, j) { return ee.Number(arr.get([i, j])); }
  var niL = CLASSES.map(function(k, i) {
    return ee.Number(arr.slice(0, i, i + 1).reduce(ee.Reducer.sum(), [1]).get([0, 0]));
  });

  // p_ij = W_i * n_ij / n_i.   (proporção de área estimada)
  function pij(i, j) {
    return ee.Number(Wl[i]).multiply(cel(i, j)).divide(ee.Number(niL[i]));
  }

  // --- 3.4 Acurácia global ponderada ---
  var OA = ee.Number(0);
  CLASSES.forEach(function(k, i) { OA = OA.add(pij(i, i)); });

  // U_i (users) e V(OA)
  var varOA = ee.Number(0);
  CLASSES.forEach(function(k, i) {
    var Ui = cel(i, i).divide(ee.Number(niL[i]));            // users accuracy
    var Wi = ee.Number(Wl[i]);
    varOA = varOA.add(
      Wi.pow(2).multiply(Ui).multiply(ee.Number(1).subtract(Ui))
        .divide(ee.Number(niL[i]).subtract(1)));
  });
  var seOA = varOA.sqrt();

  print('== 4. ACURÁCIA GLOBAL — ESTIMADOR ESTRATIFICADO (OFICIAL) ==');
  print('Acurácia global:', OA);
  print('Erro-padrão:', seOA);
  print('IC 95% (±):', seOA.multiply(1.96));
  print('>>> Reportar Kappa junto com OA, PA/UA e F1 — nunca isolado.');

  // p_.j = soma da coluna j (proporção de área REAL estimada da classe j)
  function pcolj(j) {
    var s = ee.Number(0);
    CLASSES.forEach(function(k, i) { s = s.add(pij(i, j)); });
    return s;
  }

  // --- 3.5 Métricas por classe ---
  var tabClasse = ee.FeatureCollection(CLASSES.map(function(k, j) {
    var Uj  = cel(j, j).divide(ee.Number(niL[j]));           // users (comissão)
    var pjj = pij(j, j);
    var pj  = pcolj(j);
    var Pj  = pjj.divide(pj);                                // producers (omissão)
    var nJ  = ee.Number(niL[j]);
    var Wj  = ee.Number(Wl[j]);

    var varU = Uj.multiply(ee.Number(1).subtract(Uj)).divide(nJ.subtract(1));

    // V(P_j) — Olofsson et al. (2014), eq. 7
    var somaMcol = ee.Number(0);   // Σ_i W_i²·q_ij(1-q_ij)/(n_i-1)  (i != j)
    CLASSES.forEach(function(kk, i) {
      if (i !== j) {
        var qij = cel(i, j).divide(ee.Number(niL[i]));
        somaMcol = somaMcol.add(
          ee.Number(Wl[i]).pow(2).multiply(qij)
            .multiply(ee.Number(1).subtract(qij))
            .divide(ee.Number(niL[i]).subtract(1)));
      }
    });
    var t1 = Wj.pow(2).multiply(ee.Number(1).subtract(Pj).pow(2))
               .multiply(Uj).multiply(ee.Number(1).subtract(Uj))
               .divide(nJ.subtract(1));
    var varP = t1.add(Pj.pow(2).multiply(somaMcol)).divide(pj.pow(2));

    return ee.Feature(null, {
      classe: k, nome: NOMES[j],
      n_pontos: nJ,
      users_acc: Uj,       users_ic95: varU.sqrt().multiply(1.96),
      producers_acc: Pj,   producers_ic95: varP.sqrt().multiply(1.96),
      f1: Pj.multiply(Uj).multiply(2).divide(Pj.add(Uj)),
      omissao: ee.Number(1).subtract(Pj),
      comissao: ee.Number(1).subtract(Uj)
    });
  }));
  print('== 5. MÉTRICAS POR CLASSE (ponderadas por área) ==', tabClasse);

  // --- 3.6 Área ajustada por classe ---
  var tabArea = ee.FeatureCollection(CLASSES.map(function(k, j) {
    var pj = pcolj(j);
    var seP = ee.Number(0);
    CLASSES.forEach(function(kk, i) {
      var qij = cel(i, j).divide(ee.Number(niL[i]));
      seP = seP.add(ee.Number(Wl[i]).pow(2).multiply(qij)
              .multiply(ee.Number(1).subtract(qij))
              .divide(ee.Number(niL[i]).subtract(1)));
    });
    seP = seP.sqrt();
    var areaMapa = ee.Number(areaPorClasse.get(String(k)));
    return ee.Feature(null, {
      classe: k, nome: NOMES[j],
      area_mapa_ha: areaMapa,
      area_ajustada_ha: pj.multiply(areaTotal),
      area_ajustada_ic95_ha: seP.multiply(1.96).multiply(areaTotal),
      diferenca_ha: pj.multiply(areaTotal).subtract(areaMapa)
    });
  }));
  print('== 6. ÁREA AJUSTADA POR CLASSE (Olofsson) ==', tabArea);
  print('>>> Se a área do mapa cair FORA do IC 95% da ajustada, use a AJUSTADA.');

  // --- 3.7 Exportações ---
  var P = 'PMRR_Bayeux_valid_oficial_' + VERSAO + '_';

  var mcLongo = [];
  CLASSES.forEach(function(ki, i) {
    CLASSES.forEach(function(kj, j) {
      mcLongo.push(ee.Feature(null, {
        mapa: NOMES[i], referencia: NOMES[j], n: arr.get([i, j])
      }));
    });
  });
  Export.table.toDrive({collection: ee.FeatureCollection(mcLongo),
    description: 'CSV_matriz_oficial', folder: 'PMRR_Bayeux',
    fileNamePrefix: P + 'matriz', fileFormat: 'CSV'});
  Export.table.toDrive({collection: tabClasse,
    description: 'CSV_metricas_oficiais', folder: 'PMRR_Bayeux',
    fileNamePrefix: P + 'metricas_classe', fileFormat: 'CSV'});
  Export.table.toDrive({collection: tabArea,
    description: 'CSV_areas_ajustadas', folder: 'PMRR_Bayeux',
    fileNamePrefix: P + 'areas_ajustadas', fileFormat: 'CSV'});
  Export.table.toDrive({
    collection: ee.FeatureCollection([ee.Feature(null, {
      produto: 'Uso_cobertura_RF_' + VERSAO,
      data_analise: ee.Date(Date.now()).format('YYYY-MM-dd'),
      n_validos: validos.size(), n_incertos: incertos,
      seed_amostragem: SEED_VALID,
      acuracia_global: OA, erro_padrao: seOA, ic95: seOA.multiply(1.96),
      kappa: mc.kappa(), area_total_ha: areaTotal,
      metodo: 'Amostragem aleatoria estratificada por classe do mapa, alocacao igual, ' +
              'fotointerpretacao cega, estimador estratificado ponderado por area ' +
              '(Olofsson et al., 2014). Poligonos de treino excluidos do sorteio.'
    })]),
    description: 'CSV_resumo_validacao_oficial', folder: 'PMRR_Bayeux',
    fileNamePrefix: P + 'resumo', fileFormat: 'CSV'});

  Map.centerObject(aoi, 12);
  Map.addLayer(mapa, {min: 1, max: 5, palette: PALETA}, 'Classificação ' + VERSAO);
  Map.addLayer(pontosFull, {color: 'yellow'}, 'Pontos de validação', false);
}