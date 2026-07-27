// ===== IDENTIDADE DO PROJETO =====
exports.PROJETO = 'PMRR-Bayeux';
exports.VERSAO  = 'v3.0';
// ===== CAMINHOS DE ASSETS =====
var RAIZ = 'projects/pmrr-bayeux/assets/';
exports.RAIZ       = RAIZ;
exports.PASTA_BASE = RAIZ + 'base/';   // assets do pipeline (criar pasta antes)
exports.AOI_ID     = RAIZ + 'Bayeux_limites';
// ===== PARÂMETROS ESPACIAIS =====
exports.CRS       = 'EPSG:31985';  // SIRGAS 2000 / UTM 25S
exports.ESCALA_S2 = 10;            // Sentinel-2
exports.ESCALA_DEM = 30;           // Copernicus GLO-30
// ===== JANELA TEMPORAL DA COMPOSIÇÃO =====
exports.DATA_INI = '2025-08-01';
exports.DATA_FIM = '2026-04-30';
// ===== LIMIARES =====
exports.CS_THRESH   = 0.60;  // Cloud Score+ (cs_cdf)
exports.HAND_LIMIAR = 5;     // m — suscetibilidade fluvial
// ===== BANDAS S2 USADAS NO PIPELINE =====
exports.BANDAS_S2 = ['B2','B3','B4','B5','B8','B11','B12'];
// ===== PALETAS (padrão visual do projeto) =====
exports.PAL = {
  classif: ['
#1f78b4','
#d9a441','
#1a6634','
#a6d96a','
#cc2a36'],
  suscet:  ['
#1a9850','
#fee08b','
#d73027'],
  relevo:  ['
#2c7bb6','
#abd9e9','
#ffffbf','
#fdae61','
#d7191c'],
  decliv:  ['
#1a9850','
#a6d96a','
#fee08b','
#f46d43','
#a50026'],
  ndvi:    ['
#a50026','
#f46d43','
#fee08b','
#a6d96a','
#1a9850']
};
// ===== HELPERS =====
// AOI pronta
exports.getAOI = function(){ return ee.FeatureCollection(exports.AOI_ID); };
// Coleção S2 mascarada por Cloud Score+ (reuso em qualquer módulo)
exports.getS2Masked = function(aoi){
  var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(aoi).filterDate(exports.DATA_INI, exports.DATA_FIM);
  var cs = ee.ImageCollection('GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED');
  return s2.linkCollection(cs, ['cs_cdf']).map(function(img){
    return img.updateMask(img.select('cs_cdf').gte(exports.CS_THRESH))
              .copyProperties(img, img.propertyNames());
  });
};
print('Config OK — versão', exports.VERSAO, '· AOI:', exports.AOI_ID);
