
// ===== ENTRADAS =====
var AOI    = cfg.getAOI();
var areas  = ee.FeatureCollection(cfg.RAIZ + 'Areas_Prioritarias_Defesa_Civil');
var inund  = ee.FeatureCollection(cfg.RAIZ + 'Area_Vulneravel_Inundacao');
var cprm   = ee.FeatureCollection(cfg.RAIZ + 'Risco_CPRM_Bayeux');
var valas  = ee.FeatureCollection(cfg.RAIZ + 'Valas_e_Drenos_SIRGAS');
var galer  = ee.FeatureCollection(cfg.RAIZ + 'Galerias');

// HAND (MERIT) — suscetibilidade fluvial complementar
var hand = ee.Image('MERIT/Hydro/v1_0_1').select('hnd').clip(AOI);
var handSusc = hand.lte(cfg.HAND_LIMIAR);

// ponto de partida (Secretaria de Segurança)
var PARTIDA = ee.Geometry.Point([-34.917397118828404, -7.125020051634694]);

Map.centerObject(areas, 13); Map.setOptions('HYBRID');

// ===== ANÁLISE POR POLÍGONO =====
var inundGeom = inund.geometry();

var areasProc = areas.map(function(f){
  var g = f.geometry();
  var areaHa = g.area(1).divide(1e4);

  // % da área dentro da mancha de inundação da Prefeitura
  var interInund = g.intersection(inundGeom, 1);
  var pctInund = interInund.area(1).divide(g.area(1)).multiply(100);

  // % da área com HAND <= limiar (suscetível fluvial)
  var pctHand = ee.Number(handSusc.reduceRegion({
    reducer: ee.Reducer.mean(), geometry: g,
    scale: 90, maxPixels: 1e9}).get('hnd')).multiply(100);

  // setores CPRM que tocam o polígono + população somada
  var cprmToca = cprm.filterBounds(g);
  var nSetores = cprmToca.size();
  var popExp   = ee.Number(cprmToca.aggregate_sum('NUM_PESS'));

  // drenagem que cruza (extensão de valas/galerias dentro)
  var valasIn = valas.filterBounds(g);
  var galerIn = galer.filterBounds(g);

  // distância da partida (para ordenar a rota)
  var c = g.centroid(1);
  var distKm = c.distance(PARTIDA, 1).divide(1000);

  return f.set({
    area_ha: areaHa,
    pct_inund_prefeitura: pctInund,
    pct_hand_suscetivel: pctHand,
    n_setores_cprm: nSetores,
    pop_exposta_cprm: popExp,
    n_valas: valasIn.size(),
    n_galerias: galerIn.size(),
    dist_partida_km: distKm,
    lon: c.coordinates().get(0),
    lat: c.coordinates().get(1)
  });
});

// ===== ORDEM DE VISITA (mais próximo primeiro a partir da Secretaria) =====
//  Com 4 pontos, vizinho-mais-próximo simples resolve; a ordem final
//  pode ser ajustada no dia conforme trânsito/logística local.
var ordenado = areasProc.sort('dist_partida_km');

print('=== ROTEIRO — ÁREAS PRIORITÁRIAS DEFESA CIVIL (13/jul) ===');
print('Partida: Secretaria de Segurança — Av. Brasil, 77');
print(ordenado.select(
  ['ID','COM_SUB','area_ha','dist_partida_km','pct_inund_prefeitura',
   'pct_hand_suscetivel','n_setores_cprm','pop_exposta_cprm',
   'n_valas','n_galerias','lat','lon'], null, false));

// ===== VISUALIZAÇÃO =====
Map.addLayer(handSusc.selfMask(), {palette:['#fdae61']},
  'HAND ≤ '+cfg.HAND_LIMIAR+' m (suscetível fluvial)', false);
Map.addLayer(inund.style({color:'00b0f0', fillColor:'00b0f055', width:1}),
  {}, 'Inundação (Prefeitura)');
Map.addLayer(valas.style({color:'3498db', width:1}), {}, 'Valas e drenos');
Map.addLayer(galer.style({color:'2980b9', width:1}), {}, 'Galerias', false);
Map.addLayer(cprm.style({color:'cc0000', fillColor:'cc000033', width:1}),
  {}, 'Setores CPRM');
Map.addLayer(areas.style({color:'ff6600', fillColor:'ff660044', width:3}),
  {}, 'ÁREAS PRIORITÁRIAS (Defesa Civil)');
Map.addLayer(ee.FeatureCollection([ee.Feature(PARTIDA, {nome:'PARTIDA'})])
  .style({color:'white', pointSize:8}), {}, 'Partida — Secretaria');
Map.addLayer(AOI.style({color:'yellow', fillColor:'00000000', width:2}),
  {}, 'Limite Bayeux');

// ===== EXPORTS =====
// KML: polígonos com atributos (abre no Google Earth/Maps do celular)
Export.table.toDrive({
  collection: ordenado,
  description: 'Roteiro_areas_prioritarias_kml',
  folder: 'PMRR_Bayeux', fileNamePrefix: 'roteiro_areas_prioritarias',
  fileFormat: 'KML'});

// CSV resumo (tabela do roteiro para imprimir/compartilhar)
Export.table.toDrive({
  collection: ordenado.select(
    ['ID','COM_SUB','area_ha','dist_partida_km','pct_inund_prefeitura',
     'pct_hand_suscetivel','n_setores_cprm','pop_exposta_cprm',
     'n_valas','n_galerias','lat','lon'], null, false),
  description: 'Roteiro_areas_prioritarias_csv',
  folder: 'PMRR_Bayeux', fileNamePrefix: 'roteiro_areas_prioritarias',
  fileFormat: 'CSV'});
