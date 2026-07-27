var cfg = require('users/pmrrbayeux/pmrr:00_config');

// ===== ENTRADAS =====
var bacia  = ee.FeatureCollection(cfg.RAIZ + 'Bacia_hidrografica_rio_Paraiba');
var rios   = ee.FeatureCollection(cfg.RAIZ + 'HydroRIVERS_v10_sa');
var pedo   = ee.FeatureCollection(cfg.RAIZ + 'pedo_area_uf_pb');
var acudes = ee.FeatureCollection(cfg.RAIZ + 'Boqueirao_e_Acaua');

var geom = bacia.geometry();
var PASTA_BACIA = cfg.RAIZ + 'bacia/';   // criar a pasta "bacia" nos Assets
var ESC_DEM = 30;

Map.centerObject(bacia, 8);
Map.setOptions('TERRAIN');

// ================================================================
//  1. GEOMETRIA DA BACIA — área, perímetro (base da morfometria)
// ================================================================
var areaKm2 = geom.area(1).divide(1e6);
var perimKm = geom.perimeter(1).divide(1e3);
print('=== BACIA DO RIO PARAÍBA ===');
print('Área (km²):', areaKm2);
print('Perímetro (km):', perimKm);

// ================================================================
//  2. TERRENO (Copernicus GLO-30, fix de projeção)
// ================================================================
var demColl = ee.ImageCollection('COPERNICUS/DEM/GLO30').filterBounds(geom);
var demProj = ee.Image(demColl.first()).projection();
var dem = demColl.select('DEM').mosaic()
  .setDefaultProjection(demProj)
  .reproject({crs: cfg.CRS, scale: ESC_DEM})
  .clip(geom).rename('elevacao');

var slopeP = ee.Terrain.slope(dem)
  .divide(180).multiply(Math.PI).tan().multiply(100)
  .rename('declividade_pct');

var terrenoBacia = dem.addBands(slopeP).toFloat();

// hipsometria e amplitude
var elevStats = dem.reduceRegion({
  reducer: ee.Reducer.minMax().combine(ee.Reducer.mean(), '', true)
           .combine(ee.Reducer.percentile([25,50,75]), '', true),
  geometry: geom, scale: ESC_DEM, maxPixels: 1e10, tileScale: 4});
print('Elevação — min/máx/média/percentis (m):', elevStats);

Map.addLayer(dem, {min:0, max:700, palette:cfg.PAL.relevo}, 'Elevação (m)');
Map.addLayer(slopeP, {min:0, max:30, palette:cfg.PAL.decliv}, 'Declividade %', false);

// ================================================================
//  3. PEDOLOGIA (BDiA estadual recortado pela bacia)
// ================================================================
var pedoBacia = pedo.filterBounds(geom).map(function(f){
  return f.intersection(geom, 10);
});
//  >>> VERIFICAÇÃO: nomes de campo do BDiA estadual <
print('Pedologia — campos:', pedoBacia.first().propertyNames());
print('Pedologia — ordens presentes:',
  pedoBacia.aggregate_array('ordem').distinct());  // ajustar se o campo tiver outro nome

// área por ordem de solo (km²)
var areaPorOrdem = pedoBacia.map(function(f){
  return f.set('a_km2', f.geometry().area(10).divide(1e6));
});
print('Área por ordem de solo (km²):',
  areaPorOrdem.reduceColumns({
    selectors: ['ordem','a_km2'],
    reducer: ee.Reducer.sum().group({groupField:0, groupName:'ordem'})}));

Map.addLayer(pedoBacia.style({color:'8c510a', fillColor:'d8b36555', width:1}),
  {}, 'Pedologia (bacia)', false);

// ================================================================
//  4. USO E COBERTURA (MapBiomas — ano mais recente)
// ================================================================
//  Se o ID abaixo acusar erro, confira a coleção vigente no catálogo
//  público do MapBiomas e ajuste (o padrão de nome se mantém).
var mapbiomas = ee.Image(
  'projects/mapbiomas-public/assets/brazil/lulc/collection9/mapbiomas_collection90_integration_v1')
  .select('classification_2023').clip(geom).rename('uso');

//  remap para 6 grandes grupos (síntese p/ relatório)
//  1 Floresta · 2 Veg. não-florestal · 3 Agropecuária · 4 Área não vegetada
//  5 Urbano · 6 Água
var de   = [1,3,4,5,6,49, 10,11,12,32,29,50, 14,15,18,19,39,20,40,62,41,36,46,47,35,48,9,21,
            22,23,24,30,25, 26,33,31, 27];
var para = [1,1,1,1,1,1,  2,2,2,2,2,2,      3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,
            4,4,5,4,4,    6,6,6,  4];
var usoGrupos = mapbiomas.remap(de, para).rename('uso_grupo');

var palUso = ['#1a6634','#a6d96a','#e8c26e','#d9a441','#cc2a36','#1f78b4'];
Map.addLayer(usoGrupos, {min:1, max:6, palette:palUso}, 'Uso do solo (6 grupos)');

var areaUso = ee.Image.pixelArea().divide(1e6).addBands(usoGrupos)
  .reduceRegion({reducer: ee.Reducer.sum().group({groupField:1, groupName:'grupo'}),
    geometry: geom, scale: 30, maxPixels: 1e10, tileScale: 4});
print('Área por grupo de uso (km²) — 1 Floresta 2 VegNat 3 Agropec 4 NãoVeg 5 Urbano 6 Água:',
  areaUso);

// ================================================================
//  5. HIERARQUIA FLUVIAL (HydroRIVERS — Strahler)
// ================================================================
var riosBacia = rios.filterBounds(geom);
print('Segmentos HydroRIVERS na bacia:', riosBacia.size());

// destaque ordens 1–3 (pedido de Sara/Caio)
var ord123 = riosBacia.filter(ee.Filter.lte('ORD_STRA', 3));
Map.addLayer(riosBacia.style({color:'#74a9cf', width:1}), {}, 'Rede (todas as ordens)', false);
Map.addLayer(ord123.style({color:'#0570b0', width:1}), {}, 'Rios ordem 1–3');

// comprimento por ordem (km) e comprimento total (p/ densidade de drenagem)
var compPorOrdem = riosBacia.reduceColumns({
  selectors: ['ORD_STRA','LENGTH_KM'],
  reducer: ee.Reducer.sum().group({groupField:0, groupName:'ordem_strahler'})});
print('Comprimento de canais por ordem de Strahler (km):', compPorOrdem);

var Lt = ee.Number(riosBacia.aggregate_sum('LENGTH_KM'));
print('Comprimento total de canais Lt (km):', Lt);

// ================================================================
//  6. PERFIL LONGITUDINAL DO RIO PARAÍBA (canal-tronco corrigido)
//  Traça o tronco de JUSANTE→MONTANTE seguindo, a cada confluência,
//  o segmento de MAIOR área de contribuição (UPLAND_SKM).
//  Usa os campos HydroRIVERS: HYRIV_ID, NEXT_DOWN, UPLAND_SKM,
//  DIST_DN_KM, ORD_STRA, LENGTH_KM.
// ================================================================

// segmento da foz = maior área de contribuição de toda a bacia
var segFoz = riosBacia.sort('UPLAND_SKM', false).first();
var fozId = ee.Number(segFoz.get('HYRIV_ID'));

// dicionário id -> feição, para caminhar na rede
var lista = riosBacia.toList(riosBacia.size());
var ids = ee.List(riosBacia.aggregate_array('HYRIV_ID'));

// para cada segmento, quem é seu "montante principal" =
// o segmento cujo NEXT_DOWN aponta para ele E tem maior UPLAND_SKM
function montantePrincipal(hyrivId){
  var candidatos = riosBacia.filter(ee.Filter.eq('NEXT_DOWN', hyrivId));
  var n = candidatos.size();
  // se não há montante, retorna null; senão o de maior área
  return ee.Algorithms.If(n.gt(0),
    candidatos.sort('UPLAND_SKM', false).first(), null);
}

// caminha até 400 passos montante a partir da foz (bacia grande)
var PASSOS = 400;
var seed = ee.List([segFoz]);
var tronco = ee.List(ee.List.sequence(1, PASSOS).iterate(function(i, acc){
  acc = ee.List(acc);
  var ultimo = ee.Feature(acc.get(-1));
  var prox = montantePrincipal(ee.Number(ultimo.get('HYRIV_ID')));
  // se achou montante, adiciona; senão repete o último (será deduplicado)
  return ee.Algorithms.If(prox, acc.add(prox), acc);
}, seed));

// remove repetições (quando o caminho terminou antes de 400 passos)
var mainStem = ee.FeatureCollection(tronco).distinct('HYRIV_ID');
print('Rio Paraíba (tronco) — segmentos:', mainStem.size(),
      '· comprimento (km):', mainStem.aggregate_sum('LENGTH_KM'));

Map.addLayer(riosBacia.style({color:'#74a9cf', width:1}), {}, 'Rede (todas as ordens)', false);
Map.addLayer(mainStem.style({color:'#08306b', width:3}), {}, 'Rio Paraíba (tronco)');
Map.addLayer(acudes.style({color:'red', pointSize:8}), {}, 'Açudes');

// elevação média do DEM sob cada segmento do tronco
var perfil = dem.reduceRegions({
  collection: mainStem,
  reducer: ee.Reducer.mean().setOutputs(['elev_m']),
  scale: ESC_DEM, tileScale: 4});

// açudes: distância à foz do segmento do tronco mais próximo
var acudesDist = acudes.map(function(a){
  var seg = mainStem.map(function(s){
    return s.set('d', s.geometry().distance(a.geometry(), 50));
  }).sort('d').first();
  return a.set('dist_foz_km', seg.get('DIST_DN_KM'));
});
print('Açudes — distância à foz pelo tronco (km):',
  acudesDist.select(['Nome','dist_foz_km'], null, false));

// L do rio principal para o Ff (comprimento real do tronco)
var Lp = ee.Number(mainStem.aggregate_sum('LENGTH_KM'));
print('Comprimento do rio principal Lp (km):', Lp);

// export do perfil (tabela) — ordenado por distância à foz
var perfilOrd = perfil.select(['DIST_DN_KM','elev_m','ORD_STRA','LENGTH_KM'])
  .sort('DIST_DN_KM', false);  // nascente (maior dist) -> foz (menor dist)
Export.table.toDrive({collection: perfilOrd,
  description: 'perfil_longitudinal_paraiba', folder: 'PMRR_Bayeux',
  fileNamePrefix: 'perfil_longitudinal_paraiba', fileFormat: 'CSV'});

// ================================================================
//  7. QUADRO MORFOMÉTRICO (índices do artigo de referência)
// ================================================================
var Lp = ee.Number(mainStem.aggregate_sum('LENGTH_KM'));  // compr. rio principal (proxy de L)
var Kc = perimKm.multiply(0.28).divide(areaKm2.sqrt());              // compacidade
var Ic = areaKm2.multiply(12.57).divide(perimKm.pow(2));             // circularidade
var Ff = areaKm2.divide(Lp.pow(2));                                  // fator forma (L = rio principal)
var Dd = Lt.divide(areaKm2);                                         // densidade de drenagem

print('=== QUADRO MORFOMÉTRICO ===');
print('Kc — coef. compacidade:', Kc);
print('Ic — índice de circularidade:', Ic);
print('Ff — fator forma (L = rio principal):', Ff);
print('Dd — densidade de drenagem (km/km²):', Dd);

// ================================================================
//  8. EXPORTS
// ================================================================
Export.image.toAsset({image: terrenoBacia, description: 'bacia_terreno_asset',
  assetId: PASTA_BACIA + 'Terreno_bacia', region: geom,
  scale: ESC_DEM, crs: cfg.CRS, maxPixels: 1e10});

Export.image.toAsset({image: usoGrupos.toInt8(), description: 'bacia_uso_asset',
  assetId: PASTA_BACIA + 'Uso_grupos_2023', region: geom,
  scale: 30, crs: cfg.CRS, maxPixels: 1e10});

Export.table.toDrive({collection: perfil.select(['DIST_DN_KM','elev_m','ORD_STRA','LENGTH_KM']),
  description: 'perfil_longitudinal_paraiba', folder: 'PMRR_Bayeux',
  fileNamePrefix: 'perfil_longitudinal_paraiba', fileFormat: 'CSV'});

Export.table.toAsset({collection: ord123, description: 'bacia_rios_ord123_asset',
  assetId: PASTA_BACIA + 'Rios_ordem_1a3'});

Export.image.toDrive({image: terrenoBacia, description: 'bacia_terreno_tif',
  folder: 'PMRR_Bayeux', fileNamePrefix: 'bacia_paraiba_terreno',
  region: geom, scale: ESC_DEM, crs: cfg.CRS, maxPixels: 1e10});
