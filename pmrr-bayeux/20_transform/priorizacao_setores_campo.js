

// ===== 1. ENTRADAS =====
var AOI       = ee.FeatureCollection('projects/ee-uendry/assets/Bayeux_limites');
var setores   = ee.FeatureCollection('projects/ee-uendry/assets/Risco_CPRM_Bayeux');
var inund     = ee.FeatureCollection('projects/ee-uendry/assets/Area_Vulneravel_Inundacao');

var suscet    = ee.Image('projects/ee-uendry/assets/PMRR_Bayeux/Bayeux_suscet_erosao')
                  .select('suscet_indice');
var cobertura = ee.Image('projects/ee-uendry/assets/PMRR_Bayeux/Bayeux_classificacao_regras');

var CRS = 'EPSG:31985';
var ESCALA = 10;
var ASSET_PASTA = 'projects/ee-uendry/assets/PMRR_Bayeux/';

Map.centerObject(setores, 13);
Map.setOptions('HYBRID');

// ===== 2. PESOS DE PRIORIZAÇÃO (ajustáveis) =====
//  Score final combina fatores numa escala comparável. Pesos somam 1.
var W_RISCO    = 0.30;  // grau de risco do CPRM (Muito Alto=2, Alto=1)
var W_PESSOAS  = 0.25;  // população exposta (normalizada)
var W_SUSCET   = 0.20;  // suscetibilidade à erosão (dado próprio 2026)
var W_MORFO    = 0.15;  // bônus se tipologia é morfológica (erosão/desliz/colapso)
var W_INUND    = 0.10;  // interseção com mancha de inundação da Prefeitura

// ===== 3. PRÉ-CÁLCULO: máximo de pessoas (para normalizar) =====
var maxPess = ee.Number(setores.aggregate_max('NUM_PESS'));

// dissolve as áreas de inundação numa só geometria (para teste de interseção)
var inundGeom = inund.geometry();

// ===== 4. FUNÇÃO POR SETOR =====
var setoresProc = setores.map(function(f){
  var geom = f.geometry();

  // -- grau de risco (texto -> número) --
  var grauTxt = ee.String(f.get('GRAU_RISCO'));
  var grauNum = ee.Algorithms.If(grauTxt.equals('Muito Alto'), 2, 1);
  grauNum = ee.Number(grauNum);

  // -- tipologia morfológica? (Erosão, Deslizamento, Colapso) --
  var tipo = ee.String(f.get('TIPOLO_G1'));
  var ehMorfo = ee.Number(ee.Algorithms.If(
    tipo.equals('Inundação'), 0, 1));

  // -- população exposta --
  var pess = ee.Number.parse(ee.Algorithms.If(
    f.get('NUM_PESS'), f.get('NUM_PESS'), 0));

  // -- suscetibilidade média do setor (dado próprio) --
  var suscMean = ee.Number(suscet.reduceRegion({
    reducer: ee.Reducer.mean(), geometry: geom,
    scale: ESCALA, maxPixels: 1e9}).get('suscet_indice'));
  suscMean = ee.Number(ee.Algorithms.If(suscMean, suscMean, 1)); // 1 se nulo

  // -- % urbano dentro do setor (classe 5 da cobertura) --
  var urbanoMask = cobertura.eq(5).rename('urb');
  var fracUrb = ee.Number(urbanoMask.reduceRegion({
    reducer: ee.Reducer.mean(), geometry: geom,
    scale: ESCALA, maxPixels: 1e9}).get('urb'));
  fracUrb = ee.Number(ee.Algorithms.If(fracUrb, fracUrb, 0));

  // -- intersecta mancha de inundação da Prefeitura? --
  var tocaInund = ee.Number(ee.Algorithms.If(
    geom.intersects(inundGeom, ee.ErrorMargin(1)), 1, 0));

  // -- componentes normalizados (0–1) --
  var nRisco  = grauNum.divide(2);                 // 0.5 ou 1
  var nPess   = pess.divide(maxPess);              // 0–1
  var nSuscet = suscMean.subtract(1).divide(2);    // índice 1–3 -> 0–1
  var nMorfo  = ehMorfo;                           // 0 ou 1
  var nInund  = tocaInund;                          // 0 ou 1

  // -- score final ponderado --
  var score = nRisco.multiply(W_RISCO)
    .add(nPess.multiply(W_PESSOAS))
    .add(nSuscet.multiply(W_SUSCET))
    .add(nMorfo.multiply(W_MORFO))
    .add(nInund.multiply(W_INUND))
    .multiply(100); // escala 0–100

  // centroide para roteiro de campo (lat/lon)
  var c = geom.centroid(1).coordinates();

  return f.set({
    score_prior: score,
    susc_media: suscMean,
    frac_urbano: fracUrb,
    toca_inund: tocaInund,
    eh_morfo: ehMorfo,
    grau_num: grauNum,
    lon: c.get(0),
    lat: c.get(1)
  });
});

// ===== 5. ORDENA POR SCORE =====
var ranked = setoresProc.sort('score_prior', false);

// imprime tabela enxuta no Console
print('=== SETORES PRIORIZADOS (maior score = maior prioridade) ===');
print(ranked.select(
  ['NUM_SETOR','LOCAL','TIPOLO_G1','GRAU_RISCO','NUM_PESS',
   'susc_media','toca_inund','score_prior'],
  null, false));

// ===== 6. VISUALIZAÇÃO =====
// setores coloridos por tipo (morfológico vermelho, inundação azul)
var morfo = ranked.filter(ee.Filter.eq('eh_morfo', 1));
var hidro = ranked.filter(ee.Filter.eq('eh_morfo', 0));

Map.addLayer(suscet, {min:1,max:3,
  palette:['#1a9850','#fee08b','#d73027']}, 'Suscetibilidade erosão', false);
Map.addLayer(inund.style({color:'00b0f0', fillColor:'00b0f055', width:1}),
  {}, 'Inundação (Prefeitura)');
Map.addLayer(hidro.style({color:'0033cc', fillColor:'0033cc44', width:2}),
  {}, 'Setores CPRM — Inundação');
Map.addLayer(morfo.style({color:'cc0000', fillColor:'cc000055', width:2}),
  {}, 'Setores CPRM — Morfológico (erosão/desliz/colapso)');
Map.addLayer(AOI.style({color:'yellow', fillColor:'00000000', width:2}),
  {}, 'Limite Bayeux');

// rótulos de score nos centroides
var centroides = ranked.map(function(f){
  return ee.Feature(f.geometry().centroid(1), {
    rotulo: ee.Number(f.get('score_prior')).format('%.0f'),
    setor: f.get('NUM_SETOR')});
});
Map.addLayer(centroides.style({color:'white', pointSize:4}),
  {}, 'Centroides (score)', false);

// ===== 7. EXPORTS =====
// CSV priorizado para o roteiro de campo
Export.table.toDrive({
  collection: ranked.select(
    ['NUM_SETOR','LOCAL','TIPOLO_G1','TIPOLO_E1','GRAU_RISCO',
     'NUM_EDIF','NUM_PESS','susc_media','frac_urbano','toca_inund',
     'eh_morfo','score_prior','lat','lon','SUG_INTERV','DESCRICAO'],
    null, false),
  description: 'Bayeux_setores_priorizados_csv',
  folder: 'PMRR_Bayeux',
  fileNamePrefix: 'bayeux_setores_priorizados',
  fileFormat: 'CSV'
});

// asset com os setores enriquecidos
Export.table.toAsset({
  collection: ranked,
  description: 'Bayeux_setores_priorizados_asset',
  assetId: ASSET_PASTA + 'Bayeux_setores_priorizados'
});

// KML para abrir no Google Earth / celular (navegação rápida)
Export.table.toDrive({
  collection: ranked.select(
    ['NUM_SETOR','LOCAL','TIPOLO_G1','GRAU_RISCO','NUM_PESS','score_prior']),
  description: 'Bayeux_setores_priorizados_kml',
  folder: 'PMRR_Bayeux',
  fileNamePrefix: 'bayeux_setores_priorizados',
  fileFormat: 'KML'
});

//  ===  FIM  ===
