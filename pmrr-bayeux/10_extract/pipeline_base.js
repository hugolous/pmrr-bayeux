var cfg = require('users/pmrrbayeux/pmrr:00_config');
var AOI = cfg.getAOI();
var aoiGeom = AOI.geometry();
Map.centerObject(AOI, 12); Map.setOptions('HYBRID');

// ================================================================
//  1. COMPOSIÇÃO S2 (mediana, refletância 0–1)
// ================================================================
var s2 = cfg.getS2Masked(AOI);
var composite = s2.median().select(cfg.BANDAS_S2)
                  .divide(10000).clip(AOI).toFloat();

// ================================================================
//  2. ÍNDICES ESPECTRAIS (nomes semânticos)
// ================================================================
var ndvi  = composite.normalizedDifference(['B8','B4']).rename('NDVI');
var ndwi  = composite.normalizedDifference(['B3','B8']).rename('NDWI');
var mndwi = composite.normalizedDifference(['B3','B11']).rename('MNDWI');
var ndbi  = composite.normalizedDifference(['B11','B8']).rename('NDBI');
var ndre  = composite.normalizedDifference(['B8','B5']).rename('NDRE');
var bsi   = composite.expression(
  '((S+R)-(N+B))/((S+R)+(N+B))',
  {S:composite.select('B11'), R:composite.select('B4'),
   N:composite.select('B8'),  B:composite.select('B2')}).rename('BSI');

var indices = ndvi.addBands([ndwi, mndwi, ndbi, ndre, bsi]).toFloat();

// ================================================================
//  3. TERRENO (Copernicus GLO-30, fix de projeção)
// ================================================================
var demColl = ee.ImageCollection('COPERNICUS/DEM/GLO30').filterBounds(AOI);
var demProj = ee.Image(demColl.first()).projection();
var dem = demColl.select('DEM').mosaic()
  .setDefaultProjection(demProj)
  .reproject({crs: cfg.CRS, scale: cfg.ESCALA_DEM})
  .clip(AOI).rename('elevacao');

var slopeG = ee.Terrain.slope(dem).rename('declividade_graus');
var slopeP = slopeG.divide(180).multiply(Math.PI).tan().multiply(100)
               .rename('declividade_pct');
var aspG = ee.Terrain.aspect(dem).rename('aspecto_graus');

var aspCl = aspG.expression(
  "(b(0)>=337.5||b(0)<22.5)?1:(b(0)<67.5)?2:(b(0)<112.5)?3:(b(0)<157.5)?4:"+
  "(b(0)<202.5)?5:(b(0)<247.5)?6:(b(0)<292.5)?7:8").rename('aspecto_classe');

var decCl = slopeP.expression(
  "(b(0)<3)?1:(b(0)<8)?2:(b(0)<20)?3:(b(0)<45)?4:(b(0)<75)?5:6")
  .rename('decliv_classe');

var terreno = dem.addBands([slopeP, slopeG, aspG, aspCl, decCl]).toFloat();

// ================================================================
//  4. VISUALIZAÇÃO (validação humana antes dos exports)
// ================================================================
Map.addLayer(composite, {bands:['B4','B3','B2'], min:0, max:0.3}, 'S2 RGB');
Map.addLayer(ndvi, {min:-0.2, max:0.8, palette:cfg.PAL.ndvi}, 'NDVI', false);
Map.addLayer(dem, {min:0, max:60, palette:cfg.PAL.relevo}, 'Elevação', false);
Map.addLayer(slopeP, {min:0, max:45, palette:cfg.PAL.decliv}, 'Declividade %', false);
Map.addLayer(AOI.style({color:'yellow', fillColor:'00000000', width:2}), {}, 'Limite');

print('Pipeline', cfg.VERSAO, '· janela', cfg.DATA_INI, '→', cfg.DATA_FIM);
print('Cenas S2 na janela:', s2.size());

// ================================================================
//  5. EXPORTS → ASSETS BASE (rodar os 3 na aba Tasks)
// ================================================================
Export.image.toAsset({
  image: composite, description: 'base_S2_composite',
  assetId: cfg.PASTA_BASE + 'S2_composite',
  region: aoiGeom, scale: cfg.ESCALA_S2, crs: cfg.CRS, maxPixels: 1e10});

Export.image.toAsset({
  image: indices, description: 'base_S2_indices',
  assetId: cfg.PASTA_BASE + 'S2_indices',
  region: aoiGeom, scale: cfg.ESCALA_S2, crs: cfg.CRS, maxPixels: 1e10});

Export.image.toAsset({
  image: terreno, description: 'base_terreno',
  assetId: cfg.PASTA_BASE + 'Terreno',
  region: aoiGeom, scale: cfg.ESCALA_DEM, crs: cfg.CRS, maxPixels: 1e10});
