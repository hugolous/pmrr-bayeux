
// ############ 0. PARÂMETROS #########################################################
var RAIZ = 'projects/pmrr-bayeux/assets/';

// --- Assets ---
var A_AOI      = RAIZ + 'Bayeux_limites';
var A_DEFCIVIL = RAIZ + 'Areas_apontamento_Defesa_Civil';
var A_HAND     = RAIZ + 'PMRR_HAND_Copernicus';
var A_CPRM     = RAIZ + 'Risco_CPRM_Bayeux';
var A_QUADRAS  = RAIZ + 'Quadras_SIRGAS';
var A_TERRENO  = RAIZ + 'base/Terreno';
var A_COBERT   = RAIZ + 'base/Uso_cobertura_RF_v5';
var A_PEDO     = RAIZ + 'pedo_area_mu_2501807';
var A_INUND    = RAIZ + 'Area_Vulneravel_Inundacao';

// --- Campos (CONFERIR no bloco 1 antes de rodar tudo) ---
var CAMPO_NOME   = 'Nome';         // Areas_apontamento_Defesa_Civil
var CAMPO_CPRM   = 'TIPOLO_G1';    // Risco_CPRM_Bayeux
var CAMPO_PEDO   = 'ordem';        // pedologia
var BANDA_DECLIV = 'declividade_pct';
var BANDA_ASPECT = 'aspecto_classe';

// --- Limiares do HAND (m) — definidos pela equipe ---
var HAND_CRITICO = 1.0;   // <= 1 m  -> suscetibilidade alta
var HAND_MEDIO   = 4.0;   // 1–4 m   -> média · > 4 m -> baixa

// --- Pesos da álgebra de erosão (somam 1,0) ---
var P_DECLIV = 0.40, P_COBERT = 0.30, P_SOLOS = 0.20, P_VERTEN = 0.10;

// --- Cortes de classe do índice de erosão ---
var CORTE_MEDIA = 1.67;
var CORTE_ALTA  = 2.33;

// --- Limiares para a contagem de convergência ---
var LIM_HAND_PCT  = 20;   // % da área em HAND crítico
var LIM_EROS_PCT  = 20;   // % da área em erosão Alta+Média
var LIM_QUAD_PCT  = 10;   // % da área ocupada por quadra cadastrada

var ESCALA = 10;
var CRS = 'EPSG:31985';
var TILE_SCALE = 8;

var RODAR_EXPORTS = true;


// ############ 1. CARGA E CONFERÊNCIA ################################################
var aoi = ee.FeatureCollection(A_AOI);
var aoiGeom = aoi.geometry();

// Acrescenta código sequencial único (A01, A02...) — resolve nomes repetidos
var dcBruto = ee.FeatureCollection(A_DEFCIVIL);
var nDC = dcBruto.size();
var listaDC = dcBruto.toList(nDC);
var dc = ee.FeatureCollection(
  ee.List.sequence(0, nDC.subtract(1)).map(function(i) {
    i = ee.Number(i);
    var f = ee.Feature(listaDC.get(i));
    var nm = ee.String(ee.Algorithms.If(f.get(CAMPO_NOME), f.get(CAMPO_NOME), 'sem nome'));
    var cod = ee.String('A').cat(i.add(1).format('%02d'));
    return f.set({id_area: i.add(1), cod_area: cod, rotulo: cod.cat(' — ').cat(nm)});
  })
);
var cprm    = ee.FeatureCollection(A_CPRM);
var quadras = ee.FeatureCollection(A_QUADRAS);
var pedo    = ee.FeatureCollection(A_PEDO);
var inund   = ee.FeatureCollection(A_INUND);

var hand    = ee.Image(A_HAND).select(0).rename('hand');
var terreno = ee.Image(A_TERRENO);
var cobert  = ee.Image(A_COBERT).select(0).rename('classe');

print('════════ CONFERÊNCIA DE INSUMOS ════════');
print('Áreas apontadas pela Defesa Civil:', dc.size());
print('Campos disponíveis (1a feição DC):', dc.first().propertyNames());
print('Nomes das áreas:', dc.aggregate_array(CAMPO_NOME));
print('---');
print('Tipologias CPRM presentes:', cprm.aggregate_array(CAMPO_CPRM).distinct());
print('Bandas do asset Terreno:', terreno.bandNames());
print('Bandas do asset HAND:', ee.Image(A_HAND).bandNames());
print('Ordens pedológicas:', pedo.aggregate_array(CAMPO_PEDO).distinct());
print('>>> Se algum campo/banda divergir, ajuste no bloco 0 antes de prosseguir.');


// ############ 2. ANÁLISE I — HAND (risco hidrológico) ###############################
// Classes: 3 = alta (<= 1 m) · 2 = média (1–4 m) · 1 = baixa (> 4 m)
var handClasse = ee.Image(1)
  .where(hand.lte(HAND_MEDIO), 2)
  .where(hand.lte(HAND_CRITICO), 3)
  .rename('hand_classe').toInt().clip(aoi);

var mHandAlta  = hand.lte(HAND_CRITICO).rename('hand_alta');
var mHandMedia = hand.gt(HAND_CRITICO).and(hand.lte(HAND_MEDIO)).rename('hand_media');


// ############ 3. ANÁLISE II — SUSCETIBILIDADE À EROSÃO ##############################
// Álgebra ponderada de 4 fatores. Versão institucional, com cobertura da
// classificação supervisionada v5 (a versão anterior usava classificação por regras,
// sem acurácia medida).

// --- Fator 1: declividade ---
var declivPct = terreno.select(BANDA_DECLIV);
var fDecliv = ee.Image(0)
  .where(declivPct.lt(8), 1)
  .where(declivPct.gte(8).and(declivPct.lt(20)), 2)
  .where(declivPct.gte(20), 3)
  .rename('peso_decliv');

// --- Fator 2: cobertura (RF v5) ---
// 1=Água 2=SoloExp 3=VegAlta 4=VegBaixa 5=Urbano
var fCobert = ee.Image(0)
  .where(cobert.eq(1), 1)
  .where(cobert.eq(2), 3)
  .where(cobert.eq(3), 1)
  .where(cobert.eq(4), 2)
  .where(cobert.eq(5), 3)
  .rename('peso_cobert');
fCobert = fCobert.where(fCobert.eq(0), 1);   // evita zero em pixel mascarado

// --- Fator 3: solos ---
var pedoPeso = pedo.map(function(f) {
  var ordem = ee.String(f.get(CAMPO_PEDO));
  var peso = ee.Algorithms.If(ordem.equals('ARGISSOLO'), 3,
             ee.Algorithms.If(ordem.equals('GLEISSOLO'), 1, 1));
  return f.set('peso_solo', peso);
});
var fSolos = pedoPeso
  .reduceToImage({properties: ['peso_solo'], reducer: ee.Reducer.first()})
  .unmask(1).rename('peso_solo');

// --- Fator 4: orientação de vertente ---
// 1=N 2=NE 3=E 4=SE 5=S 6=SO 7=O 8=NO
var aspectoCl = terreno.select(BANDA_ASPECT);
var ehPlano = declivPct.lt(3);
var fVerten = ee.Image(0)
  .where(aspectoCl.eq(1).or(aspectoCl.eq(5)), 2)
  .where(aspectoCl.eq(4).or(aspectoCl.eq(3)).or(aspectoCl.eq(2)), 3)
  .where(aspectoCl.eq(6).or(aspectoCl.eq(7)).or(aspectoCl.eq(8)), 1)
  .where(ehPlano, 1)
  .rename('peso_verten');
fVerten = fVerten.where(fVerten.eq(0), 1);

// --- Índice ponderado ---
var erosIndice = fDecliv.multiply(P_DECLIV)
  .add(fCobert.multiply(P_COBERT))
  .add(fSolos.multiply(P_SOLOS))
  .add(fVerten.multiply(P_VERTEN))
  .rename('eros_indice').clip(aoi);

var erosClasse = ee.Image(1)
  .where(erosIndice.gt(CORTE_MEDIA), 2)
  .where(erosIndice.gt(CORTE_ALTA), 3)
  .rename('eros_classe').toInt().clip(aoi);

var mErosAlta  = erosClasse.eq(3).rename('eros_alta');
var mErosMedia = erosClasse.eq(2).rename('eros_media');

// --- Diagnóstico: quanto do município cai em cada classe ---
function areaPorClasse(img, nome) {
  return ee.List(ee.Dictionary(
    ee.Image.pixelArea().divide(1e4).addBands(img).reduceRegion({
      reducer: ee.Reducer.sum().group({groupField: 1, groupName: 'classe'}),
      geometry: aoiGeom, scale: ESCALA, maxPixels: 1e13, tileScale: TILE_SCALE
    })).get('groups'));
}
print('════════ DIAGNÓSTICO MUNICIPAL ════════');
print('HAND — área (ha) por classe [1=baixa 2=média 3=alta]:', areaPorClasse(handClasse));
print('EROSÃO — área (ha) por classe [1=baixa 2=média 3=alta]:', areaPorClasse(erosClasse));
print('EROSÃO — percentis do índice contínuo:', erosIndice.reduceRegion({
  reducer: ee.Reducer.percentile([10, 25, 50, 75, 90]),
  geometry: aoiGeom, scale: ESCALA, maxPixels: 1e13, tileScale: TILE_SCALE}));
print('>>> A álgebra só atinge classe Alta onde há declividade relevante.');
print('>>> Em planície o índice satura em Baixa — comportamento esperado, não erro.');


// ############ 4. QUADRAS — PROXY DE EXPOSIÇÃO #######################################
// Usa a malha cadastral, NÃO a classe urbano da classificação: a validação
// independente indicou subestimação de ~30% da mancha urbana no mapa.
var mQuadras = ee.Image(0).byte().paint(quadras, 1).rename('quadra').clip(aoi);


// ############ 5. CRUZAMENTO POR ÁREA APONTADA #######################################
// Empilha as máscaras; a média de uma máscara binária = fração da área.
var pilha = mHandAlta
  .addBands(mHandMedia)
  .addBands(mErosAlta)
  .addBands(mErosMedia)
  .addBands(mQuadras)
  .addBands(hand.rename('hand_m'));

var dcStats = pilha.reduceRegions({
  collection: dc,
  reducer: ee.Reducer.mean(),
  scale: ESCALA,
  tileScale: TILE_SCALE
});

// --- Acrescenta tipologia CPRM e contagem de quadras ---
var dcCompleto = dcStats.map(function(f) {
  var g = f.geometry();
  var areaHa = g.area(1).divide(1e4);

  var cprmInt = cprm.filterBounds(g);
  var tipos = cprmInt.aggregate_array(CAMPO_CPRM).distinct();

  var quadInt = quadras.filterBounds(g);
  var inundInt = inund.filterBounds(g);

  var pHandAlta  = ee.Number(f.get('hand_alta')).multiply(100);
  var pHandMedia = ee.Number(f.get('hand_media')).multiply(100);
  var pErosAlta  = ee.Number(f.get('eros_alta')).multiply(100);
  var pErosMedia = ee.Number(f.get('eros_media')).multiply(100);
  var pQuadra    = ee.Number(f.get('quadra')).multiply(100);

  // Contagem de convergência: quantos critérios independentes sinalizam a área
  var conv = ee.Number(0)
    .add(ee.Algorithms.If(pHandAlta.gte(LIM_HAND_PCT), 1, 0))
    .add(ee.Algorithms.If(pErosAlta.add(pErosMedia).gte(LIM_EROS_PCT), 1, 0))
    .add(ee.Algorithms.If(cprmInt.size().gt(0), 1, 0))
    .add(ee.Algorithms.If(inundInt.size().gt(0), 1, 0));

  return ee.Feature(g, {
    nome: f.get(CAMPO_NOME),
    id_area: f.get('id_area'),
    cod_area: f.get('cod_area'),
    area_ha: areaHa,
    hand_pct_alta: pHandAlta,
    hand_pct_media: pHandMedia,
    hand_medio_m: f.get('hand_m'),
    eros_pct_alta: pErosAlta,
    eros_pct_media: pErosMedia,
    eros_pct_alta_media: pErosAlta.add(pErosMedia),
    cprm_n_poligonos: cprmInt.size(),
    cprm_tipologias: ee.Algorithms.If(tipos.size().gt(0),
                                      ee.List(tipos).join(' + '), 'nenhuma'),
    inund_prefeitura: ee.Algorithms.If(inundInt.size().gt(0), 'sim', 'nao'),
    quadras_n: quadInt.size(),
    quadras_pct_area: pQuadra,
    convergencia: conv
  });
});

var tabela = dcCompleto.sort('convergencia', false);

print('════════ TABELA DE APOIO À DECISÃO ════════');
print('Ordenada por convergência (nº de critérios independentes que sinalizam):',
      tabela.select([
        'nome', 'area_ha', 'convergencia',
        'hand_pct_alta', 'eros_pct_alta_media',
        'cprm_tipologias', 'inund_prefeitura',
        'quadras_n', 'quadras_pct_area'
      ], null, false));

print('>>> CONVERGÊNCIA = quantas fontes independentes apontam a área:');
print('    HAND crítico >= ' + LIM_HAND_PCT + '% · Erosão A+M >= ' + LIM_EROS_PCT +
      '% · sobrepõe CPRM · sobrepõe mancha de inundação da Prefeitura');
print('>>> Convergência alta = maior confiança. Convergência 1 vinda só do pipeline');
print('    = LACUNA: área não coberta pelas fontes oficiais, candidata a vistoria.');


// ############ 6. VISUALIZAÇÃO PARA A REUNIÃO ########################################
Map.centerObject(aoi, 12);
Map.setOptions('HYBRID');

var palHand  = ['#f7f7f7', '#74add1', '#313695'];   // baixa · média · alta
var palEros  = ['#1a9850', '#fee08b', '#d73027'];   // baixa · média · alta
var palCPRM  = {'Inundação': '#4575b4', 'Erosão': '#d73027', 'Deslizamento': '#762a83'};

Map.addLayer(erosClasse, {min: 1, max: 3, palette: palEros},
             'II — Suscetibilidade à erosão', false);
Map.addLayer(handClasse, {min: 1, max: 3, palette: palHand},
             'I — HAND (suscetibilidade a inundação)');

Map.addLayer(inund.style({color: '#00b0f0', fillColor: '00b0f055', width: 1}),
             {}, 'Mancha de inundação (Prefeitura)', false);

Object.keys(palCPRM).forEach(function(t) {
  Map.addLayer(
    cprm.filter(ee.Filter.eq(CAMPO_CPRM, t))
        .style({color: palCPRM[t], fillColor: '00000000', width: 2}),
    {}, 'CPRM — ' + t, false);
});

Map.addLayer(quadras.style({color: '#888888', fillColor: '00000000', width: 1}),
             {}, 'Quadras (cadastro)', false);

Map.addLayer(dc.style({color: '#ffff00', fillColor: '00000000', width: 3}),
             {}, 'ÁREAS APONTADAS — Defesa Civil');

Map.addLayer(aoi.style({color: 'white', fillColor: '00000000', width: 2}),
             {}, 'Limite municipal');

// --- Legenda ---
var legenda = ui.Panel({style: {position: 'bottom-left', padding: '10px', width: '250px'}});
legenda.add(ui.Label('PMRR Bayeux — Subsídio técnico',
                     {fontWeight: 'bold', fontSize: '14px'}));

function blocoLegenda(titulo, rotulos, cores) {
  legenda.add(ui.Label(titulo, {fontWeight: 'bold', fontSize: '12px', margin: '8px 0 2px 0'}));
  rotulos.forEach(function(r, i) {
    legenda.add(ui.Panel({
      layout: ui.Panel.Layout.flow('horizontal'),
      widgets: [ui.Label('', {backgroundColor: cores[i], padding: '8px', margin: '1px 4px 1px 0'}),
                ui.Label(r, {margin: '3px', fontSize: '11px'})]
    }));
  });
}
blocoLegenda('I — HAND (inundação)',
             ['Baixa (> ' + HAND_MEDIO + ' m)',
              'Média (' + HAND_CRITICO + '–' + HAND_MEDIO + ' m)',
              'Alta (<= ' + HAND_CRITICO + ' m)'], palHand);
blocoLegenda('II — Erosão (vertente)', ['Baixa', 'Média', 'Alta'], palEros);
legenda.add(ui.Label('Contorno amarelo: áreas apontadas pela Defesa Civil',
                     {fontSize: '11px', margin: '8px 0 0 0'}));
legenda.add(ui.Label('Suscetibilidade ≠ risco. Grau R1–R4 exige campo.',
                     {fontSize: '10px', color: '#b00', margin: '6px 0 0 0'}));
Map.add(legenda);
// ############ 6B. RÓTULOS E INSPETOR ################################################
var MOSTRAR_ROTULOS = false;
var ESCALA_ROTULO   = 25;   // metros/pixel do texto — menor = texto menor

// --- Rótulos desenhados sobre o mapa (pacote comunitário) ---
if (MOSTRAR_ROTULOS) {
  var txt = require('users/gena/packages:text');
  var listaR = dcCompleto.toList(dcCompleto.size());
  var imgsRot = listaR.map(function(f) {
    f = ee.Feature(f);
    return txt.draw(ee.String(f.get('cod_area')), f.geometry().centroid(10),
      ESCALA_ROTULO, {fontSize: 18, textColor: 'ffff00',
                      outlineColor: '000000', outlineWidth: 1.5, outlineOpacity: 0.9});
  });
  Map.addLayer(ee.ImageCollection.fromImages(imgsRot).mosaic(), {}, 'Códigos (A01, A02…)');
}

// --- Índice código → nome, no painel ---
var painelIndice = ui.Panel({
  style: {position: 'bottom-right', width: '270px', maxHeight: '320px', padding: '8px'}});
painelIndice.add(ui.Label('Áreas apontadas', {fontWeight: 'bold', fontSize: '13px'}));
Map.add(painelIndice);

dcCompleto.sort('cod_area').evaluate(function(fc) {
  if (!fc || !fc.features) { return; }
  fc.features.forEach(function(ft) {
    var p = ft.properties;
    painelIndice.add(ui.Button({
      label: p.cod_area + ' — ' + p.nome + '  (conv. ' + p.convergencia + '/4)',
      style: {stretch: 'horizontal', margin: '1px', fontSize: '11px'},
      onClick: function() {
        Map.centerObject(ee.Feature(ft).geometry(), 16);
      }
    }));
  });
});

// --- Clique no mapa mostra todos os indicadores ---
var painelInfo = ui.Panel({
  style: {position: 'top-right', width: '300px', padding: '8px'}});
painelInfo.add(ui.Label('Clique numa área para ver os indicadores',
                        {fontSize: '12px', color: '#555'}));
Map.add(painelInfo);

Map.onClick(function(coords) {
  painelInfo.clear();
  painelInfo.add(ui.Label('Consultando…', {fontSize: '8px'}));
  var pt = ee.Geometry.Point([coords.lon, coords.lat]);
  dcCompleto.filterBounds(pt).limit(1).evaluate(function(fc) {
    painelInfo.clear();
    if (!fc || !fc.features || fc.features.length === 0) {
      painelInfo.add(ui.Label('Nenhuma área apontada aqui.',
                              {fontSize: '12px', color: '#777'}));
      return;
    }
    var p = fc.features[0].properties;
    function num(v, c) {
      return (v === null || v === undefined) ? '—' : Number(v).toFixed(c);
    }
    function linha(r, v) {
      painelInfo.add(ui.Label(r + ': ' + v, {fontSize: '8px', margin: '1px 2px'}));
    }
    painelInfo.add(ui.Label(p.cod_area + ' — ' + p.nome,
                            {fontWeight: 'bold', fontSize: '8px'}));
    linha('Área', num(p.area_ha, 2) + ' ha');
    linha('Convergência', p.convergencia + '/4');
    linha('HAND crítico', num(p.hand_pct_alta, 1) + '%');
    linha('HAND médio', num(p.hand_pct_media, 1) + '%');
    linha('HAND médio (m)', num(p.hand_medio_m, 2) + ' m');
    linha('Erosão A+M', num(p.eros_pct_alta_media, 1) + '%');
    linha('CPRM', p.cprm_tipologias);
    linha('Mancha Prefeitura', p.inund_prefeitura);
    linha('Quadras', p.quadras_n + ' (' + num(p.quadras_pct_area, 1) + '% da área)');
  });
});

// ############ 7. EXPORTAÇÕES ########################################################
if (RODAR_EXPORTS) {
  var PFX = 'PMRR_Bayeux_';

  // Tabela de decisão
  Export.table.toDrive({
    collection: tabela,
    description: 'CSV_tabela_areas_prioritarias',
    folder: 'PMRR_Bayeux',
    fileNamePrefix: PFX + 'tabela_areas_prioritarias',
    fileFormat: 'CSV',
    selectors: ['nome', 'area_ha', 'convergencia',
                'hand_pct_alta', 'hand_pct_media', 'hand_medio_m',
                'eros_pct_alta', 'eros_pct_media', 'eros_pct_alta_media',
                'cprm_n_poligonos', 'cprm_tipologias', 'inund_prefeitura',
                'quadras_n', 'quadras_pct_area']
  });

  // Rasters
  Export.image.toAsset({
    image: erosIndice.addBands(erosClasse).toFloat(),
    description: 'ASSET_suscet_erosao_v2',
    assetId: RAIZ + 'base/Suscet_erosao_v2',
    region: aoiGeom, scale: ESCALA, crs: CRS, maxPixels: 1e13
  });
  Export.image.toDrive({
    image: erosIndice.addBands(erosClasse).toFloat(),
    description: 'TIF_suscet_erosao_v2', folder: 'PMRR_Bayeux',
    fileNamePrefix: PFX + 'suscet_erosao_v2',
    region: aoiGeom, scale: ESCALA, crs: CRS, maxPixels: 1e13
  });
  Export.image.toDrive({
    image: handClasse, description: 'TIF_hand_classes', folder: 'PMRR_Bayeux',
    fileNamePrefix: PFX + 'hand_classes',
    region: aoiGeom, scale: ESCALA, crs: CRS, maxPixels: 1e13
  });

  // Áreas apontadas — nomes de campo <= 10 caracteres (limite do DBF/Shapefile).
  // A truncagem automática do GEE gerava colisão entre eros_pct_alta e
  // eros_pct_alta_media, invalidando o DBF.
  var paraSHP = dcCompleto.map(function(f) {
    return ee.Feature(f.geometry(), {
      cod_area:   f.get('cod_area'),
      nome:       f.get('nome'),
      area_ha:    f.get('area_ha'),
      converg:    f.get('convergencia'),
      hand_alta:  f.get('hand_pct_alta'),
      hand_med:   f.get('hand_pct_media'),
      hand_m:     f.get('hand_medio_m'),
      eros_alta:  f.get('eros_pct_alta'),
      eros_med:   f.get('eros_pct_media'),
      eros_am:    f.get('eros_pct_alta_media'),
      cprm_n:     f.get('cprm_n_poligonos'),
      cprm_tipo:  f.get('cprm_tipologias'),
      inund_pref: f.get('inund_prefeitura'),
      quadras_n:  f.get('quadras_n'),
      quadras_pc: f.get('quadras_pct_area')
    });
  });
  Export.table.toDrive({
    collection: paraSHP, description: 'SHP_areas_com_indicadores',
    folder: 'PMRR_Bayeux', fileNamePrefix: PFX + 'areas_com_indicadores',
    fileFormat: 'SHP'
  });
}

print('════════ SCRIPT CARREGADO ════════');
print('HAND: crítico <= ' + HAND_CRITICO + ' m · médio até ' + HAND_MEDIO + ' m');
print('Erosão: cortes ' + CORTE_MEDIA + ' / ' + CORTE_ALTA +
      ' · pesos D' + P_DECLIV + ' C' + P_COBERT + ' S' + P_SOLOS + ' V' + P_VERTEN);