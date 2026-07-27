
// ############ 0. PARÂMETROS #########################################################
var MODO_AUDITORIA = 'asset';    // 'asset' = lê os assets congelados (REPRODUTÍVEL)
var VERSAO         = 'v5';

// --- Blocos opcionais ---
var RODAR_DIAG_SOLO     = true;    // BLOCO 4B — diagnóstico de umidade dos solos
var RODAR_AUDITORIA     = true;
var RODAR_JM            = true;
var RODAR_CONFIANCA     = true;
var RODAR_VALID_CRUA    = true;    // validação NÃO auditada (estimativa honesta)
var RODAR_ESTABILIDADE  = true;    // BLOCO PESADO — deixe true para gerar a barra de erro
var RODAR_PREFEITURA    = true;
var RODAR_GTB           = false;
var APLICAR_MODA        = false;
var USAR_FREQ           = false;

// --- Hiperparâmetros ---
var SEED          = 42;
var FRACAO_TREINO = 0.70;
var N_ARVORES     = 500;
var MTRY          = null;          // null = sqrt(p)
var MIN_LEAF      = 5;
var N_PIX_TREINO  = 100;           // menor classe (Solo) tem ~115 px de treino disponíveis
var N_PIX_VALID   = 60;
var TILE_SCALE    = 8;
var LIMIAR_DUVIDA = 0.20;
var SEMENTES_TESTE = [42, 7, 13, 99, 2024];

// --- Limiares da auditoria ---
// A NOVIDADE da v5 é B11_SOLO_MIN: separa solo SECO de substrato ÚMIDO (lama de maré).
var LIM = {
  NDVI_AGUA_MAX    : 0.20,
  NDVI_SOLO_MAX    : 0.25,
  B11_SOLO_MIN     : 0.30,   // ponto médio da descontinuidade natural (sem amostra 0,20-0,35)
  NDVI_VEGALTA_MIN : 0.55,
  NDVI_VEGBAIXA_MIN: 0.25,
  NDVI_VEGBAIXA_MAX: 0.85,
  B8_URBANO_MAX    : 0.45
};

// --- Legenda oficial ---
var CLASSES = [1, 2, 3, 4, 5];
var NOMES   = ['Agua', 'Solo_exposto', 'Veg_alto_porte', 'Veg_baixo_porte', 'Urbano'];
var PALETA  = ['#1f6fb4', '#c9a227', '#1a6b2f', '#8fce5b', '#d1462f'];

// --- Subclasses espectrais (k do k-means). 1 = sem subdivisão ---
// v5 DEFINITIVA: K_SUB[4]=1. Na rodada de teste a 2a subclasse de Veg. baixo porte
// saía com apenas 13 pixels (cluster degenerado). Uma assinatura única é mais estável.
var K_SUB = {1: 2, 2: 1, 3: 1, 4: 1, 5: 2};

var BANDAS_REFLECT = ['B2','B3','B4','B5','B8','B11','B12'];
var BANDAS_INDICES = ['NDVI','NDWI','MNDWI','NDBI','NDRE','BSI'];
var BANDAS_FREQ    = USAR_FREQ ? ['freq_agua'] : [];


// ############ 1. CONFIG E INSUMOS ###################################################
var cfg = require('users/pmrrbayeux/pmrr:00_config');
var aoi = cfg.getAOI();
var CRS      = cfg.CRS       || 'EPSG:31985';
var ESCALA   = cfg.ESCALA    || 10;
var DATA_INI = cfg.DATA_INI  || '2025-08-01';
var DATA_FIM = cfg.DATA_FIM  || '2026-04-30';
var CS_LIM   = cfg.CS_LIMIAR || 0.60;
var RAIZ     = 'projects/pmrr-bayeux/assets/';

print('════════ PMRR BAYEUX — CLASSIFICAÇÃO SUPERVISIONADA v5.0 (DEFINITIVA) ════════');
print('MODO:', MODO_AUDITORIA, '| VERSÃO dos assets:', VERSAO);
print('Janela:', DATA_INI, 'a', DATA_FIM, '| CS+ >=', CS_LIM, '| CRS:', CRS);


// ############ 2. FREQUÊNCIA DE ÁGUA (desligada) ####################################
var freqImg = USAR_FREQ ? ee.Image(RAIZ + 'base/Agua_frequencia_v2') : null;


// ############ 3. STACK PREDITOR #####################################################
var BANDAS = BANDAS_REFLECT.concat(BANDAS_INDICES).concat(BANDAS_FREQ);

var stack = ee.Image(RAIZ + 'base/S2_composite').select(BANDAS_REFLECT)
  .addBands(ee.Image(RAIZ + 'base/S2_indices').select(BANDAS_INDICES));
if (USAR_FREQ) { stack = stack.addBands(freqImg.select(BANDAS_FREQ)); }
stack = stack.clip(aoi);
print('Preditoras (n=' + BANDAS.length + '):', BANDAS);


// ############ 4. AUDITORIA DE ROTULAGEM #############################################
var caminhos = {
  1: RAIZ + 'amostras/agua',      2: RAIZ + 'amostras/solo',
  3: RAIZ + 'amostras/veg_alta',  4: RAIZ + 'amostras/veg_baixa',
  5: RAIZ + 'amostras/urbano'
};

// B11 entrou na lista — separa solo SECO de substrato ÚMIDO
var BANDAS_AUD = ['NDVI','NDRE','MNDWI','BSI','B8','B11'];

function filtroValido(k) {
  if (k === 1) return ee.Filter.lt('NDVI', LIM.NDVI_AGUA_MAX);
  if (k === 2) return ee.Filter.and(                       // 2 condições na v5
                        ee.Filter.lt('NDVI', LIM.NDVI_SOLO_MAX),
                        ee.Filter.gt('B11',  LIM.B11_SOLO_MIN));
  if (k === 3) return ee.Filter.gt('NDVI', LIM.NDVI_VEGALTA_MIN);
  if (k === 4) return ee.Filter.and(ee.Filter.gt('NDVI', LIM.NDVI_VEGBAIXA_MIN),
                                    ee.Filter.lt('NDVI', LIM.NDVI_VEGBAIXA_MAX));
  return ee.Filter.lt('B8', LIM.B8_URBANO_MAX);
}

var polOriginais = ee.FeatureCollection(CLASSES.map(function(k, i) {
  return ee.FeatureCollection(caminhos[k]).map(function(f) {
    return f.set({classe: k, classe_nome: NOMES[i],
                  uid: ee.String(String(k)).cat('_').cat(f.get('system:index'))});
  });
})).flatten();

var polLimpos, polRejeitados, tabAuditoria;

if (MODO_AUDITORIA === 'asset') {
  polLimpos     = ee.FeatureCollection(RAIZ + 'amostras/auditados_'  + VERSAO);
  polRejeitados = ee.FeatureCollection(RAIZ + 'amostras/rejeitados_' + VERSAO);
  tabAuditoria  = ee.FeatureCollection(CLASSES.map(function(k, i) {
    return ee.Feature(null, {classe: k, nome: NOMES[i],
      n_aprovado:  polLimpos.filter(ee.Filter.eq('classe', k)).size(),
      n_rejeitado: polRejeitados.filter(ee.Filter.eq('classe', k)).size()});
  }));
  print('== 1. AUDITORIA (lida do asset congelado ' + VERSAO + ') ==', tabAuditoria);

} else {
  polLimpos     = ee.FeatureCollection([]);
  polRejeitados = ee.FeatureCollection([]);
  var resumoAud = [];

  CLASSES.forEach(function(k, i) {
    var fc = polOriginais.filter(ee.Filter.eq('classe', k));
    if (!RODAR_AUDITORIA) {
      polLimpos = polLimpos.merge(fc);
      resumoAud.push(ee.Feature(null, {classe: k, nome: NOMES[i],
        n_original: fc.size(), n_aprovado: fc.size(), n_rejeitado: 0}));
      return;
    }
    var st = stack.select(BANDAS_AUD).reduceRegions({
      collection: fc, reducer: ee.Reducer.mean(),
      scale: ESCALA, tileScale: TILE_SCALE
    }).filter(ee.Filter.notNull(['NDVI']));

    var ok  = st.filter(filtroValido(k));
    var bad = st.filter(filtroValido(k).not())
                .map(function(f) { return f.set('motivo', 'viola_definicao_classe'); });

    polLimpos     = polLimpos.merge(ok);
    polRejeitados = polRejeitados.merge(bad);
    resumoAud.push(ee.Feature(null, {classe: k, nome: NOMES[i],
      n_original: fc.size(), n_aprovado: ok.size(), n_rejeitado: bad.size()}));
  });

  tabAuditoria = ee.FeatureCollection(resumoAud);
  print('== 1. AUDITORIA DE POLÍGONOS ==', tabAuditoria);
  print('    Limiares aplicados:', LIM);
  print('    >>> Exporte ASSET_auditados_' + VERSAO + ' e ASSET_rejeitados_' + VERSAO +
        ', depois volte MODO_AUDITORIA para "asset".');
}


// ############ 4B. DIAGNÓSTICO DE UMIDADE DOS SOLOS APROVADOS ########################
// Lama de maré: NDVI baixo (sem clorofila) MAS SWIR baixo (água intersticial).
// Passa no filtro de NDVI e confunde com água. Solo seco tem B11 alto (~0,40).
if (RODAR_DIAG_SOLO) {
  print('════════ 4B. DIAGNÓSTICO — SOLO EXPOSTO APROVADO ════════');
  var soloAprov = polLimpos.filter(ee.Filter.eq('classe', 2));
  var soloStats = stack.select(['NDVI','MNDWI','BSI','B11','B12','B8'])
    .reduceRegions({collection: soloAprov, reducer: ee.Reducer.mean(),
                    scale: ESCALA, tileScale: TILE_SCALE})
    .sort('B11');   // mais ÚMIDO/ESCURO primeiro
  print('Polígonos de solo aprovados:', soloAprov.size());
  print('Lista ordenada por B11 (os PRIMEIROS seriam os suspeitos):', soloStats);
  print('== SENSIBILIDADE DO LIMIAR B11 ==',
    ee.FeatureCollection([0.15, 0.20, 0.25, 0.30, 0.35, 0.40].map(function(t) {
      return ee.Feature(null, {B11_min: t,
        n_sobrevive: soloStats.filter(ee.Filter.gt('B11', t)).size()});
    })));
  Map.addLayer(soloAprov, {color: 'yellow'}, '4B: Solo aprovado', false);
}


// ############ 5. SPLIT POR POLÍGONO #################################################
function fazerSplit(fonte, semente) {
  var tr = ee.FeatureCollection([]);
  var va = ee.FeatureCollection([]);
  CLASSES.forEach(function(k) {
    var fc = fonte.filter(ee.Filter.eq('classe', k)).randomColumn('rnd', semente + k);
    tr = tr.merge(fc.filter(ee.Filter.lt('rnd', FRACAO_TREINO)));
    va = va.merge(fc.filter(ee.Filter.gte('rnd', FRACAO_TREINO)));
  });
  return {treino: tr, valid: va};
}

var split     = fazerSplit(polLimpos, SEED);
var polTreino = split.treino;
var polValid  = split.valid;

print('== 2. SPLIT POR POLÍGONO ==',
  ee.FeatureCollection(CLASSES.map(function(k, i) {
    return ee.Feature(null, {classe: k, nome: NOMES[i],
      pol_treino: polTreino.filter(ee.Filter.eq('classe', k)).size(),
      pol_valid:  polValid.filter(ee.Filter.eq('classe', k)).size()});
  })));


// ############ 6. RASTERIZAÇÃO E AMOSTRAGEM ##########################################
// A base herda a grade de 10 m do stack (ee.Image(0) traria projeção global).
function pintar(fc) {
  return stack.select(0).multiply(0).byte().paint(fc, 'classe').selfMask().rename('classe');
}
function amostrar(imgClasse, nPontos, semente) {
  return stack.addBands(imgClasse).stratifiedSample({
    numPoints: nPontos, classBand: 'classe', region: aoi,
    scale: ESCALA, seed: semente, tileScale: TILE_SCALE, geometries: false});
}
function histo(img) {
  return ee.Dictionary(img.reduceRegion({
    reducer: ee.Reducer.frequencyHistogram(), geometry: aoi,
    scale: ESCALA, maxPixels: 1e13, tileScale: TILE_SCALE}).get('classe'));
}

var imgTreino = pintar(polTreino);
var imgValid  = pintar(polValid);
print('== 3. PIXELS DISPONÍVEIS — treino (N_PIX_TREINO deve ser <= menor classe) ==',
      histo(imgTreino));
print('== 3. PIXELS DISPONÍVEIS — validação ==', histo(imgValid));

var pixTreino = amostrar(imgTreino, N_PIX_TREINO, SEED);
var pixValid  = amostrar(imgValid,  N_PIX_VALID,  SEED + 100);


// ############ 7. SUBCLASSES ESPECTRAIS ##############################################
// Código = classe*10 + cluster.  Classe = floor(codigo/10).
function gerarSubclasses(pix) {
  var out = ee.FeatureCollection([]);
  CLASSES.forEach(function(k) {
    var sub = pix.filter(ee.Filter.eq('classe', k));
    if (K_SUB[k] <= 1) {
      out = out.merge(sub.map(function(f) { return f.set('subclasse', k * 10); }));
    } else {
      var km = ee.Clusterer.wekaKMeans(K_SUB[k]).train({
        features: sub, inputProperties: BANDAS});
      out = out.merge(sub.cluster(km, 'grupo').map(function(f) {
        return f.set('subclasse', ee.Number(f.get('grupo')).add(k * 10)); }));
    }
  });
  return out;
}
var pixTreinoSub = gerarSubclasses(pixTreino);

var codigosOrd = [];
CLASSES.forEach(function(k) {
  for (var c = 0; c < K_SUB[k]; c++) { codigosOrd.push(k * 10 + c); }
});

print('== 4. SUBCLASSES ESPECTRAIS ==',
  ee.FeatureCollection(codigosOrd.map(function(cod) {
    return ee.Feature(null, {subclasse: cod, classe: Math.floor(cod / 10),
      n_pixels: pixTreinoSub.filter(ee.Filter.eq('subclasse', cod)).size()});
  })));

var redMedia = ee.Reducer.mean().repeat(BANDAS.length);
var assinSub = ee.FeatureCollection(codigosOrd.map(function(cod) {
  var s = ee.Dictionary(pixTreinoSub.filter(ee.Filter.eq('subclasse', cod))
            .reduceColumns({reducer: redMedia, selectors: BANDAS}));
  var m = ee.List(s.get('mean'));
  var d = {subclasse: cod};
  BANDAS.forEach(function(b, j) { d[b] = m.get(j); });
  return ee.Feature(null, d);
}));
print('== 5. ASSINATURA MÉDIA POR SUBCLASSE ==', assinSub);


// ############ 8. ASSINATURAS E SEPARABILIDADE #######################################
var redStats = ee.Reducer.mean()
  .combine({reducer2: ee.Reducer.stdDev(), sharedInputs: true}).repeat(BANDAS.length);

var estat = {}, assinList = [];
CLASSES.forEach(function(k, i) {
  var s = ee.Dictionary(pixTreino.filter(ee.Filter.eq('classe', k))
            .reduceColumns({reducer: redStats, selectors: BANDAS}));
  var m = ee.List(s.get('mean')), sd = ee.List(s.get('stdDev'));
  estat[k] = {m: m, sd: sd};
  BANDAS.forEach(function(b, j) {
    assinList.push(ee.Feature(null, {classe: k, nome: NOMES[i], banda: b,
      media: m.get(j), desvio: sd.get(j)}));
  });
});
var tabAssinaturas = ee.FeatureCollection(assinList);

// Jeffries-Matusita (proxy univariado por banda; JM ∈ [0,2])
var tabJM = null;
if (RODAR_JM) {
  var EPS = 1e-12;
  var jm = function(m1, v1, m2, v2) {
    v1 = ee.Number(v1).max(EPS); v2 = ee.Number(v2).max(EPS);
    var soma = v1.add(v2);
    var t1 = ee.Number(m1).subtract(m2).pow(2).divide(soma.multiply(4));
    var t2 = soma.divide(2).divide(v1.multiply(v2).sqrt()).log().multiply(0.5);
    return ee.Number(2).multiply(ee.Number(1).subtract(t1.add(t2).multiply(-1).exp()));
  };
  var jmList = [];
  for (var a = 0; a < CLASSES.length; a++) {
    for (var b = a + 1; b < CLASSES.length; b++) {
      var k1 = CLASSES[a], k2 = CLASSES[b];
      var vals = BANDAS.map(function(bd, j) {
        var s1 = ee.Number(estat[k1].sd.get(j)), s2 = ee.Number(estat[k2].sd.get(j));
        return jm(estat[k1].m.get(j), s1.multiply(s1),
                  estat[k2].m.get(j), s2.multiply(s2));
      });
      jmList.push(ee.Feature(null, {par: NOMES[a] + ' x ' + NOMES[b],
        JM_media:  ee.Number(ee.List(vals).reduce(ee.Reducer.mean())),
        JM_melhor: ee.Number(ee.List(vals).reduce(ee.Reducer.max()))}));
    }
  }
  tabJM = ee.FeatureCollection(jmList).sort('JM_media');
  print('== 6. SEPARABILIDADE JM (pior par primeiro) ==', tabJM);
}


// ############ 9. TREINO #############################################################
function treinarRF(features, semente) {
  return ee.Classifier.smileRandomForest({
    numberOfTrees: N_ARVORES, variablesPerSplit: MTRY,
    minLeafPopulation: MIN_LEAF, bagFraction: 0.5, seed: semente
  }).train({features: features, classProperty: 'subclasse', inputProperties: BANDAS});
}
var rf = treinarRF(pixTreinoSub, SEED);
var expl = ee.Dictionary(rf.explain());
print('== 7. OOB (diagnóstico interno — NÃO reportar como acurácia) ==',
      expl.get('outOfBagErrorEstimate'));

var imp = ee.Dictionary(expl.get('importance'));
var somaImp = ee.Number(imp.values().reduce(ee.Reducer.sum()));
var tabImp = ee.FeatureCollection(BANDAS.map(function(b) {
  var v = ee.Number(imp.get(b));
  return ee.Feature(null, {banda: b, importancia: v,
    importancia_pct: v.divide(somaImp).multiply(100)});
})).sort('importancia_pct', false);
print('== 8. IMPORTÂNCIA DAS VARIÁVEIS ==', tabImp);
print(ui.Chart.feature.byFeature(tabImp, 'banda', ['importancia_pct'])
  .setChartType('ColumnChart').setOptions({
    title: 'Importância (%) — uniforme = ' + (100 / BANDAS.length).toFixed(2) + '%',
    legend: {position: 'none'}, vAxis: {title: '%'}}));


// ############ 10. CLASSIFICAÇÃO #####################################################
var subRaster = stack.classify(rf).rename('subclasse').toByte().clip(aoi);
var classifBruto = subRaster.divide(10).floor().toByte().rename('classe').clip(aoi);
var classificado = APLICAR_MODA
  ? classifBruto.focalMode(1, 'square', 'pixels', 1).toByte().rename('classe').clip(aoi)
  : classifBruto;


// ############ 11. VALIDAÇÃO #########################################################
function matrizDe(pixels, clf) {
  var v = pixels.classify(clf, 'ps').map(function(f) {
    return f.set('predito', ee.Number(f.get('ps')).divide(10).floor()); });
  return v.errorMatrix('classe', 'predito', ee.List(CLASSES));
}

function relatarMatriz(mc) {
  var arr = mc.array();
  var n  = ee.Number(arr.reduce(ee.Reducer.sum(), [0, 1]).get([0, 0]));
  var oa = mc.accuracy();
  var ic = oa.multiply(ee.Number(1).subtract(oa)).divide(n).sqrt().multiply(1.96);
  var pa = ee.Array(mc.producersAccuracy()).project([0]).toList();
  var ua = ee.Array(mc.consumersAccuracy()).project([1]).toList();
  var f1 = ee.Array(mc.fscore(1)).toList();

  var tab = ee.FeatureCollection(CLASSES.map(function(k, i) {
    var p = ee.Number(pa.get(i)), u = ee.Number(ua.get(i));
    return ee.Feature(null, {classe: k, nome: NOMES[i],
      producers_acc: p, users_acc: u,
      omissao: ee.Number(1).subtract(p), comissao: ee.Number(1).subtract(u),
      f1: ee.Number(f1.get(i))});
  }));

  var somaLin = arr.reduce(ee.Reducer.sum(), [1]).project([0]).toList();
  var somaCol = arr.reduce(ee.Reducer.sum(), [0]).project([1]).toList();
  var diag    = arr.matrixDiagonal().project([0]).toList();
  var qL = [], aL = [];
  CLASSES.forEach(function(k, i) {
    var L = ee.Number(somaLin.get(i)).divide(n);
    var C = ee.Number(somaCol.get(i)).divide(n);
    var D = ee.Number(diag.get(i)).divide(n);
    qL.push(L.subtract(C).abs());
    aL.push(L.subtract(D).min(C.subtract(D)));
  });

  return {matriz: mc, array: arr, n: n, oa: oa, ic: ic, kappa: mc.kappa(),
    tabela: tab, macroF1: ee.Number(f1.reduce(ee.Reducer.mean())),
    Q: ee.Number(ee.List(qL).reduce(ee.Reducer.sum())).divide(2),
    A: ee.Number(ee.List(aL).reduce(ee.Reducer.sum()))};
}

// --- AUDITADA (CIRCULAR — limite superior) ---
var R = relatarMatriz(matrizDe(pixValid, rf));
print('== 9. VALIDAÇÃO AUDITADA (CIRCULAR — limite superior) ==');
print('Matriz (linha = referência, coluna = predito; ordem 1..5):', R.matriz);
print('N:', R.n, '| OA:', R.oa, '| IC 95%:', R.ic, '| Kappa:', R.kappa);
print('== 10. MÉTRICAS POR CLASSE ==', R.tabela);
print('== 10. MACRO-F1 (comparar versões por este número) ==', R.macroF1);
print('== 11. DECOMPOSIÇÃO DO ERRO ==');
print('Quantidade (Q):', R.Q, '| Alocação (A):', R.A);
print('Conferência Q+A vs 1-OA:', R.Q.add(R.A), ee.Number(1).subtract(R.oa));

// --- NÃO AUDITADA (estimativa honesta) ---
var Rcru = null;
if (RODAR_VALID_CRUA) {
  var uidsTreino = polTreino.aggregate_array('uid');
  var polValidCru = polOriginais.filter(ee.Filter.inList('uid', uidsTreino).not());
  var pixValidCru = amostrar(pintar(polValidCru), N_PIX_VALID * 2, SEED + 200);
  Rcru = relatarMatriz(matrizDe(pixValidCru, rf));
  print('== 12. VALIDAÇÃO NÃO AUDITADA (estimativa honesta) ==');
  print('Matriz:', Rcru.matriz);
  print('N:', Rcru.n, '| OA:', Rcru.oa, '| IC 95%:', Rcru.ic, '| Kappa:', Rcru.kappa);
  print('Macro-F1:', Rcru.macroF1, '| Q:', Rcru.Q, '| A:', Rcru.A);
  print('Por classe:', Rcru.tabela);
  print('>>> Reporte AMBOS os números no Produto 1 (auditado x não auditado).');
}


// ############ 12. ÁREAS #############################################################
function calcularAreas(mapa) {
  var grp = ee.List(ee.Dictionary(
    ee.Image.pixelArea().divide(1e4).addBands(mapa).reduceRegion({
      reducer: ee.Reducer.sum().group({groupField: 1, groupName: 'classe'}),
      geometry: aoi, scale: ESCALA, maxPixels: 1e13, tileScale: TILE_SCALE
    })).get('groups'));
  var total = ee.Number(grp.iterate(function(el, acc) {
    return ee.Number(acc).add(ee.Dictionary(el).getNumber('sum')); }, 0));
  return {total: total,
    tabela: ee.FeatureCollection(grp.map(function(el) {
      var d = ee.Dictionary(el), a = d.getNumber('sum');
      return ee.Feature(null, {classe: d.getNumber('classe'), area_ha: a,
        area_pct: a.divide(total).multiply(100)});
    }))};
}
var areas = calcularAreas(classificado);
print('== 13. ÁREA TOTAL DO AOI (ha) ==', areas.total);
print('== 13. ÁREAS POR CLASSE ==', areas.tabela);


// ############ 13. CONFIANÇA E ZONAS DE DÚVIDA #######################################
// Probabilidades das SUBCLASSES somadas por CLASSE antes do top1/top2.
var confianca = null, margem = null, duvida = null, tabConf = null, areaDuvida = null;

if (RODAR_CONFIANCA) {
  var probArr = stack.classify(rf.setOutputMode('MULTIPROBABILITY')).select(0);
  var pegar = function(pos) {
    return probArr.arraySlice(0, pos, pos + 1).arrayFlatten([['v']]); };

  var probClasse = ee.Image.cat(CLASSES.map(function(k) {
    var soma = null;
    codigosOrd.forEach(function(cod, p) {
      if (Math.floor(cod / 10) === k) {
        var b = pegar(p);
        soma = (soma === null) ? b : soma.add(b);
      }
    });
    return soma.rename('p' + k);
  }));

  var arrC = probClasse.toArray().arraySort();
  var top1 = arrC.arraySlice(0, -1).arrayFlatten([['p1']]);
  var top2 = arrC.arraySlice(0, -2, -1).arrayFlatten([['p2']]);
  confianca = top1.rename('confianca').clip(aoi);
  margem    = top1.subtract(top2).rename('margem').clip(aoi);
  duvida    = margem.lt(LIMIAR_DUVIDA).selfMask().rename('duvida');

  var grpConf = ee.List(ee.Dictionary(
    confianca.addBands(classificado).reduceRegion({
      reducer: ee.Reducer.mean().group({groupField: 1, groupName: 'classe'}),
      geometry: aoi, scale: ESCALA, maxPixels: 1e13, tileScale: TILE_SCALE
    })).get('groups'));
  tabConf = ee.FeatureCollection(grpConf.map(function(el) {
    var d = ee.Dictionary(el);
    return ee.Feature(null, {classe: d.getNumber('classe'),
      confianca_media: d.getNumber('mean')});
  }));
  print('== 14. CONFIANÇA MÉDIA POR CLASSE ==', tabConf);

  areaDuvida = ee.Number(ee.Image.pixelArea().divide(1e4).updateMask(duvida)
    .reduceRegion({reducer: ee.Reducer.sum(), geometry: aoi, scale: ESCALA,
      maxPixels: 1e13, tileScale: TILE_SCALE}).get('area'));
  print('== 14. ÁREA EM ZONA DE DÚVIDA (ha) ==', areaDuvida,
        '| % do AOI:', areaDuvida.divide(areas.total).multiply(100));
}


// ############ 14. TESTE DE ESTABILIDADE POR SEMENTE #################################
var tabEstab = null, tabDispersao = null;
if (RODAR_ESTABILIDADE) {
  print('════════ 15. TESTE DE ESTABILIDADE (bloco pesado) ════════');
  var resultados = SEMENTES_TESTE.map(function(sm) {
    var sp   = fazerSplit(polLimpos, sm);
    var pix  = amostrar(pintar(sp.treino), N_PIX_TREINO, sm);
    var clf  = treinarRF(gerarSubclasses(pix), sm);
    var mapa = stack.classify(clf).divide(10).floor().toByte().rename('classe').clip(aoi);
    return {semente: sm, tabela: calcularAreas(mapa).tabela};
  });

  var linhas = [];
  resultados.forEach(function(r) {
    var d = {semente: r.semente};
    CLASSES.forEach(function(k, i) {
      d['ha_' + NOMES[i]] = ee.Number(
        r.tabela.filter(ee.Filter.eq('classe', k)).first().get('area_ha'));
    });
    linhas.push(ee.Feature(null, d));
  });
  tabEstab = ee.FeatureCollection(linhas);
  print('== 15. ÁREA (ha) POR SEMENTE ==', tabEstab);

  tabDispersao = ee.FeatureCollection(CLASSES.map(function(k, i) {
    var vals = ee.List(resultados.map(function(r) {
      return ee.Number(r.tabela.filter(ee.Filter.eq('classe', k)).first().get('area_ha'));
    }));
    var media = ee.Number(vals.reduce(ee.Reducer.mean()));
    var dp    = ee.Number(vals.reduce(ee.Reducer.stdDev()));
    return ee.Feature(null, {classe: k, nome: NOMES[i],
      media_ha: media, desvio_ha: dp, cv_pct: dp.divide(media).multiply(100),
      min_ha: ee.Number(vals.reduce(ee.Reducer.min())),
      max_ha: ee.Number(vals.reduce(ee.Reducer.max()))});
  })).sort('cv_pct', false);
  print('== 15. DISPERSÃO DAS ÁREAS (pior primeiro) ==', tabDispersao);
  print('>>> Use MÉDIA ± DESVIO no relatório, não o valor da semente 42.');
}


// ############ 15. CONFERÊNCIA COM A PREFEITURA ######################################
if (RODAR_PREFEITURA) {
  var areaRef = function(caminho) {
    return ee.Number(ee.FeatureCollection(caminho).filterBounds(aoi)
      .map(function(f) { return f.set('a', f.geometry().area(1).divide(1e4)); })
      .aggregate_sum('a'));
  };
  print('════════ 16. CONFERÊNCIA COM CAMADAS DA PREFEITURA ════════');
  print('Hidrografia 2013 (ha):', areaRef(RAIZ + 'Hidrografia_2013_SIRGAS'));
  print('Quadras (ha):',          areaRef(RAIZ + 'Quadras_SIRGAS'));
  print('Malha urbana (ha):',     areaRef(RAIZ + 'Malha_Urbana_SIRGAS2000'));
}


// ############ 16. GTB (opcional) ####################################################
if (RODAR_GTB) {
  var gtb = ee.Classifier.smileGradientTreeBoost({numberOfTrees: 500, seed: SEED})
    .train({features: pixTreinoSub, classProperty: 'subclasse', inputProperties: BANDAS});
  var Rg = relatarMatriz(matrizDe(pixValid, gtb));
  print('== 17. GTB — OA:', Rg.oa, '| Kappa:', Rg.kappa, '| Macro-F1:', Rg.macroF1);
}


// ############ 17. VISUALIZAÇÃO ######################################################
Map.centerObject(aoi, 12);
Map.addLayer(stack, {bands: ['B4','B3','B2'], min: 0.02, max: 0.30, gamma: 1.3}, 'RGB', false);
Map.addLayer(classificado, {min: 1, max: 5, palette: PALETA}, 'Classificação RF v5.0');
Map.addLayer(subRaster, {min: 10, max: 51}, 'Subclasses (diagnóstico)', false);
if (RODAR_CONFIANCA) {
  Map.addLayer(confianca, {min: 0.3, max: 1, palette: ['#d73027','#fee08b','#1a9850']}, 'Confiança', false);
  Map.addLayer(margem,    {min: 0,   max: 1, palette: ['#d73027','#fee08b','#1a9850']}, 'Margem', false);
  Map.addLayer(duvida,    {palette: ['#ff00ff']}, 'ZONAS DE DÚVIDA', false);
}
Map.addLayer(polTreino,     {color: 'white'},   'Polígonos treino', false);
Map.addLayer(polValid,      {color: 'black'},   'Polígonos validação', false);
Map.addLayer(polRejeitados, {color: '#ff0000'}, 'POLÍGONOS REJEITADOS', false);


// ############ 18. EXPORTAÇÕES #######################################################
var P = 'PMRR_Bayeux_classif_RF' + VERSAO + '_';

// Assets de auditoria — SÓ no modo 'calcular'
if (MODO_AUDITORIA === 'calcular') {
  Export.table.toAsset({collection: polLimpos,
    description: 'ASSET_auditados_' + VERSAO,
    assetId: RAIZ + 'amostras/auditados_' + VERSAO});
  Export.table.toAsset({collection: polRejeitados,
    description: 'ASSET_rejeitados_' + VERSAO,
    assetId: RAIZ + 'amostras/rejeitados_' + VERSAO});
}

// Rasters — PRODUTO PRINCIPAL
Export.image.toAsset({image: classificado,
  description: 'ASSET_classificacao_RF' + VERSAO,
  assetId: RAIZ + 'base/Uso_cobertura_RF_' + VERSAO,
  region: aoi.geometry(), scale: ESCALA, crs: CRS, maxPixels: 1e13});
Export.image.toDrive({image: classificado,
  description: 'TIF_classificacao_RF' + VERSAO, folder: 'PMRR_Bayeux',
  fileNamePrefix: P + 'classes', region: aoi.geometry(),
  scale: ESCALA, crs: CRS, maxPixels: 1e13});
Export.image.toDrive({image: subRaster, description: 'TIF_subclasses',
  folder: 'PMRR_Bayeux', fileNamePrefix: P + 'subclasses', region: aoi.geometry(),
  scale: ESCALA, crs: CRS, maxPixels: 1e13});
if (RODAR_CONFIANCA) {
  Export.image.toDrive({image: confianca.addBands(margem),
    description: 'TIF_confianca_margem', folder: 'PMRR_Bayeux',
    fileNamePrefix: P + 'confianca', region: aoi.geometry(),
    scale: ESCALA, crs: CRS, maxPixels: 1e13});
}

// Splits — Paulo precisa do treino para excluir no sorteio do 40_
Export.table.toAsset({collection: polTreino,
  description: 'ASSET_split_treino_' + VERSAO,
  assetId: RAIZ + 'amostras/split_treino_' + VERSAO});
Export.table.toAsset({collection: polValid,
  description: 'ASSET_split_validacao_' + VERSAO,
  assetId: RAIZ + 'amostras/split_validacao_' + VERSAO});

// SHP para QGIS (saem em EPSG:4326 — reprojetar)
Export.table.toDrive({collection: polRejeitados,
  description: 'SHP_poligonos_rejeitados', folder: 'PMRR_Bayeux',
  fileNamePrefix: P + 'poligonos_rejeitados', fileFormat: 'SHP'});
Export.table.toDrive({collection: polLimpos.filter(ee.Filter.eq('classe', 2)),
  description: 'SHP_solo_aprovado', folder: 'PMRR_Bayeux',
  fileNamePrefix: P + 'solo_aprovado', fileFormat: 'SHP'});

// Matrizes em formato longo
function exportarMatriz(res, sufixo) {
  var linhas = [];
  CLASSES.forEach(function(ki, i) {
    CLASSES.forEach(function(kj, j) {
      linhas.push(ee.Feature(null, {referencia: NOMES[i], predito: NOMES[j],
        n: res.array.get([i, j])}));
    });
  });
  Export.table.toDrive({collection: ee.FeatureCollection(linhas),
    description: 'CSV_matriz_' + sufixo, folder: 'PMRR_Bayeux',
    fileNamePrefix: P + 'matriz_' + sufixo, fileFormat: 'CSV'});
}
exportarMatriz(R, 'auditada');
if (RODAR_VALID_CRUA) { exportarMatriz(Rcru, 'nao_auditada'); }

// Tabelas
var tabelas = [[tabAuditoria, 'auditoria'], [assinSub, 'assinatura_subclasses'],
               [tabAssinaturas, 'assinaturas'], [tabImp, 'importancia'],
               [R.tabela, 'metricas_classe_auditada'], [areas.tabela, 'areas']];
if (RODAR_JM)           tabelas.push([tabJM, 'separabilidade_JM']);
if (RODAR_CONFIANCA)    tabelas.push([tabConf, 'confianca_classe']);
if (RODAR_VALID_CRUA)   tabelas.push([Rcru.tabela, 'metricas_classe_nao_auditada']);
if (RODAR_ESTABILIDADE) {
  tabelas.push([tabEstab, 'estabilidade_sementes']);
  tabelas.push([tabDispersao, 'estabilidade_dispersao']);
}
tabelas.forEach(function(par) {
  Export.table.toDrive({collection: par[0], description: 'CSV_' + par[1],
    folder: 'PMRR_Bayeux', fileNamePrefix: P + par[1], fileFormat: 'CSV'});
});

// Resumo consolidado (metadados do produto)
var resumo = {
  versao: VERSAO, data_execucao: ee.Date(Date.now()).format('YYYY-MM-dd'),
  janela_ini: DATA_INI, janela_fim: DATA_FIM, cs_limiar: CS_LIM,
  crs: CRS, escala_m: ESCALA, area_aoi_ha: areas.total,
  classificador: 'smileRandomForest', n_arvores: N_ARVORES, min_leaf: MIN_LEAF,
  variables_per_split: 'sqrt(p)', n_bandas: BANDAS.length, bandas: BANDAS.join(';'),
  n_pix_treino_classe: N_PIX_TREINO, n_pix_valid_classe: N_PIX_VALID,
  fracao_treino: FRACAO_TREINO, seed: SEED,
  ndvi_max_solo: LIM.NDVI_SOLO_MAX, b11_min_solo: LIM.B11_SOLO_MIN,
  oob_diagnostico: expl.get('outOfBagErrorEstimate'),
  aud_n: R.n, aud_oa: R.oa, aud_ic95: R.ic, aud_kappa: R.kappa,
  aud_macro_f1: R.macroF1, aud_Q: R.Q, aud_A: R.A,
  obs: 'Validacao auditada e CIRCULAR - limite superior. Acuracia oficial sera ' +
       'estimada por amostragem independente fotointerpretada (script 40_, Paulo).'
};
if (RODAR_VALID_CRUA) {
  resumo.cru_n = Rcru.n; resumo.cru_oa = Rcru.oa;
  resumo.cru_kappa = Rcru.kappa; resumo.cru_macro_f1 = Rcru.macroF1;
}
if (RODAR_CONFIANCA) { resumo.area_duvida_ha = areaDuvida; }
Export.table.toDrive({collection: ee.FeatureCollection([ee.Feature(null, resumo)]),
  description: 'CSV_resumo_metadados', folder: 'PMRR_Bayeux',
  fileNamePrefix: P + 'resumo_metadados', fileFormat: 'CSV'});

print('════════ v5.0 CARREGADO (DEFINITIVA) ════════');
print('MODO:', MODO_AUDITORIA, '| VERSÃO:', VERSAO, '| B11_SOLO_MIN:', LIM.B11_SOLO_MIN);
