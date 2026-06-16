/******************************************************************
 *  PMRR-BAYEUX — Etapa Terreno (Copernicus DEM GLO-30)
 *  Produtos: relevo (altimetria), declividade (%), aspecto (vertentes)
 *
 *  Entregas por produto:
 *    1. Asset intermediário (Image) — para reuso no pipeline
 *    2. Visualização no mapa — para validação humana
 *    3. Export raster (GeoTIFF) e vetorial (Shapefile reclassificado)
 *
 *  CRS de análise: EPSG:31985 (SIRGAS 2000 / UTM 25S)
 ******************************************************************/

// ===== 1. CONFIGURAÇÃO =====
var AOI = ee.FeatureCollection('projects/ee-uendry/assets/Bayeux_limites');
var aoiGeom = AOI.geometry();

var CRS    = 'EPSG:31985';
var ESCALA = 30;            // resolução nativa do Copernicus DEM GLO-30
var ASSET_PASTA = 'projects/ee-uendry/assets/PMRR_Bayeux/'; // destino dos assets

Map.centerObject(AOI, 12);
Map.setOptions('HYBRID');

// ===== 2. DEM — mosaico + projeção fixa =====
//  Copernicus DEM GLO-30 vem como ImageCollection; o mosaico perde a
//  projeção, então restauramos e reprojetamos para CRS métrico.
var demColl = ee.ImageCollection('COPERNICUS/DEM/GLO30').filterBounds(AOI);
var demProj = ee.Image(demColl.first()).projection();

var dem = demColl.select('DEM').mosaic()
            .setDefaultProjection(demProj)
            .reproject({crs: CRS, scale: ESCALA})
            .clip(AOI)
            .rename('elevacao');

// ===== 3. DECLIVIDADE EM PORCENTAGEM =====
//  ee.Terrain.slope retorna graus. Convertemos para porcentagem:
//  slope_% = tan(graus) * 100
var slopeGraus = ee.Terrain.slope(dem);
var slopePct = slopeGraus.divide(180).multiply(Math.PI)  // graus -> radianos
                 .tan().multiply(100)
                 .rename('declividade_pct')
                 .clip(AOI);

// ===== 4. ASPECTO (ORIENTAÇÃO DAS VERTENTES) =====
var aspecto = ee.Terrain.aspect(dem).rename('aspecto_graus').clip(AOI);

//  Classes de orientação (8 direções) para a versão vetorial
var aspectoClasse = aspecto.expression(
  "(b('aspecto_graus') >= 337.5 || b('aspecto_graus') < 22.5) ? 1" +  // N
  ": (b('aspecto_graus') < 67.5)  ? 2" +  // NE
  ": (b('aspecto_graus') < 112.5) ? 3" +  // E
  ": (b('aspecto_graus') < 157.5) ? 4" +  // SE
  ": (b('aspecto_graus') < 202.5) ? 5" +  // S
  ": (b('aspecto_graus') < 247.5) ? 6" +  // SO
  ": (b('aspecto_graus') < 292.5) ? 7" +  // O
  ": 8"                                    // NO
).rename('aspecto_classe').clip(AOI);

// ===== 5. CLASSES DE DECLIVIDADE (EMBRAPA) =====
//  1: 0-3% (plano) | 2: 3-8% (suave ond.) | 3: 8-20% (ondulado)
//  4: 20-45% (forte ond.) | 5: 45-75% (montanhoso) | 6: >75% (escarpado)
var declivClasse = slopePct.expression(
  "(b('declividade_pct') < 3)  ? 1" +
  ": (b('declividade_pct') < 8)  ? 2" +
  ": (b('declividade_pct') < 20) ? 3" +
  ": (b('declividade_pct') < 45) ? 4" +
  ": (b('declividade_pct') < 75) ? 5" +
  ": 6"
).rename('decliv_classe').clip(AOI);

// ===== 6. IMAGEM INTERMEDIÁRIA CONSOLIDADA =====
var terreno = dem
  .addBands(slopePct)
  .addBands(slopeGraus.rename('declividade_graus'))
  .addBands(aspecto)
  .addBands(aspectoClasse)
  .addBands(declivClasse)
  .toFloat();

// ===== 7. VISUALIZAÇÃO (validação humana) =====
var visDEM = {min: 0, max: 60,
  palette: ['#2c7bb6','#abd9e9','#ffffbf','#fdae61','#d7191c']};
var visDecliv = {min: 0, max: 45,
  palette: ['#1a9850','#a6d96a','#fee08b','#f46d43','#a50026']};
var visAspecto = {min: 0, max: 360,
  palette: ['#ff0000','#ffaa00','#aaff00','#00ffaa','#00aaff','#aa00ff','#ff00aa','#ff0000']};

Map.addLayer(dem,       visDEM,     '1. Relevo — altimetria (m)');
Map.addLayer(slopePct,  visDecliv,  '2. Declividade (%)');
Map.addLayer(aspecto,   visAspecto, '3. Aspecto — vertentes (graus)', false);
Map.addLayer(AOI.style({color:'yellow', fillColor:'00000000', width:2}), {}, 'Limite Bayeux');

// estatísticas rápidas no console (validação)
print('Altimetria (m) — min/max/média:', dem.reduceRegion({
  reducer: ee.Reducer.minMax().combine(ee.Reducer.mean(), '', true),
  geometry: aoiGeom, scale: ESCALA, maxPixels: 1e9}));
print('Declividade (%) — percentis:', slopePct.reduceRegion({
  reducer: ee.Reducer.percentile([25,50,75,95]),
  geometry: aoiGeom, scale: ESCALA, maxPixels: 1e9}));

// ===== 8. EXPORT DO ASSET INTERMEDIÁRIO =====
Export.image.toAsset({
  image: terreno,
  description: 'Bayeux_terreno_asset',
  assetId: ASSET_PASTA + 'Bayeux_terreno',
  region: aoiGeom, scale: ESCALA, crs: CRS, maxPixels: 1e10
});

// ===== 9. EXPORT RASTER (GeoTIFF) =====
Export.image.toDrive({
  image: dem.toFloat(),
  description: 'Bayeux_relevo_tif', folder: 'PMRR_Bayeux',
  fileNamePrefix: 'bayeux_relevo', region: aoiGeom,
  scale: ESCALA, crs: CRS, maxPixels: 1e10
});
Export.image.toDrive({
  image: slopePct.toFloat(),
  description: 'Bayeux_declividade_pct_tif', folder: 'PMRR_Bayeux',
  fileNamePrefix: 'bayeux_declividade_pct', region: aoiGeom,
  scale: ESCALA, crs: CRS, maxPixels: 1e10
});
Export.image.toDrive({
  image: aspecto.toFloat(),
  description: 'Bayeux_aspecto_tif', folder: 'PMRR_Bayeux',
  fileNamePrefix: 'bayeux_aspecto', region: aoiGeom,
  scale: ESCALA, crs: CRS, maxPixels: 1e10
});

// ===== 10. EXPORT VETORIAL (Shapefile reclassificado) =====
//  Vetoriza as classes (não o raster contínuo). reduceToVectors agrupa
//  pixels contíguos de mesma classe em polígonos.
function vetorizar(imgClasse, nomeCampo, descricao, prefixo) {
  var vetores = imgClasse.toInt().reduceToVectors({
    geometry: aoiGeom,
    crs: CRS,
    scale: ESCALA,
    geometryType: 'polygon',
    eightConnected: false,
    labelProperty: nomeCampo,
    maxPixels: 1e10
  });
  Export.table.toDrive({
    collection: vetores,
    description: descricao,
    folder: 'PMRR_Bayeux',
    fileNamePrefix: prefixo,
    fileFormat: 'SHP'
  });
}

vetorizar(declivClasse,  'decliv_classe',  'Bayeux_declividade_classes_shp', 'bayeux_declividade_classes');
vetorizar(aspectoClasse, 'aspecto_classe', 'Bayeux_aspecto_classes_shp',     'bayeux_aspecto_classes');
