

// ===== 1. CONFIGURAÇÃO =====
var AOI = ee.FeatureCollection('projects/ee-uendry/assets/Bayeux_limites');
var aoiGeom = AOI.geometry();

var DATA_INI = '2025-08-01';   // janela seca → menos nuvem
var DATA_FIM = '2026-04-30';
var CS_THRESH = 0.60;          // Cloud Score+
var CRS = 'EPSG:31985';
var ESCALA = 10;
var ASSET_PASTA = 'projects/ee-uendry/assets/PMRR_Bayeux/';

Map.centerObject(AOI, 12);
Map.setOptions('HYBRID');

// ===== 2. SENTINEL-2 + MÁSCARA DE NUVENS =====
var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(AOI).filterDate(DATA_INI, DATA_FIM);
var cs = ee.ImageCollection('GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED');

var s2masked = s2.linkCollection(cs, ['cs_cdf']).map(function(img){
  return img.updateMask(img.select('cs_cdf').gte(CS_THRESH));
});

// composição mediana, escalada para reflectância 0–1
var comp = s2masked.median().clip(AOI).divide(10000);

// ===== 3. ÍNDICES ESPECTRAIS =====
var ndvi  = comp.normalizedDifference(['B8','B4']).rename('NDVI');   // vegetação
var ndwi  = comp.normalizedDifference(['B3','B8']).rename('NDWI');   // água (McFeeters)
var mndwi = comp.normalizedDifference(['B3','B11']).rename('MNDWI'); // água urbana/turva
var ndbi  = comp.normalizedDifference(['B11','B8']).rename('NDBI');  // construído
var bsi   = comp.expression(                                          // solo exposto
  '((SWIR1+RED)-(NIR+BLUE))/((SWIR1+RED)+(NIR+BLUE))',
  {SWIR1:comp.select('B11'), RED:comp.select('B4'),
   NIR:comp.select('B8'), BLUE:comp.select('B2')}).rename('BSI');
// red-edge NDVI — ajuda a separar dossel denso de vegetação rasa
var ndre  = comp.normalizedDifference(['B8','B5']).rename('NDRE');

var nir   = comp.select('B8').rename('NIR');
var swir1 = comp.select('B11').rename('SWIR1');

// ===== 4. CLASSIFICAÇÃO POR REGRAS (cascata) =====
//  Cada pixel recebe a primeira classe cuja condição satisfizer.
//  Começa em 0 (não classificado) e é preenchido em ordem.

var classe = ee.Image(0).rename('classe').clip(AOI);

// --- 1. ÁGUA (estuário, inclui turva) ---
//  água clara: MNDWI alto. água turva: MNDWI moderado + NIR baixo
var agua = mndwi.gt(0.0)
  .or(ndwi.gt(0.1))
  .or(mndwi.gt(-0.1).and(nir.lt(0.10)));
classe = classe.where(agua, 1);

// --- 3. VEGETAÇÃO ALTO PORTE (dossel denso) ---
//  NDVI muito alto + NDRE alto (estrutura de dossel)
var vegAlta = classe.eq(0)
  .and(ndvi.gt(0.55))
  .and(ndre.gt(0.30));
classe = classe.where(vegAlta, 3);

// --- 4. VEGETAÇÃO BAIXO PORTE (gramínea, rasteira, cultivo) ---
//  NDVI moderado a alto, mas sem estrutura de dossel denso
var vegBaixa = classe.eq(0)
  .and(ndvi.gt(0.25));
classe = classe.where(vegBaixa, 4);

// --- 5. ÁREA URBANA / IMPERMEABILIZADA ---
//  construído: NDBI positivo, NDVI baixo, SWIR alto
var urbano = classe.eq(0)
  .and(ndbi.gt(-0.05))
  .and(ndvi.lt(0.25))
  .and(swir1.gt(0.12));
classe = classe.where(urbano, 5);

// --- 2. SOLO EXPOSTO (o que sobrou com BSI alto / NDVI baixo) ---
var solo = classe.eq(0)
  .and(bsi.gt(0.0).or(ndvi.lt(0.20)));
classe = classe.where(solo, 2);

// pixels remanescentes (raros) → solo exposto como default neutro
classe = classe.where(classe.eq(0), 2);

classe = classe.rename('classe').toInt().clip(AOI);

// ===== 5. VISUALIZAÇÃO (validação humana) =====
var palette = [
  '#1f78b4', // 1 água — azul
  '#d9a441', // 2 solo exposto — ocre
  '#1a6634', // 3 veg alto porte — verde escuro
  '#a6d96a', // 4 veg baixo porte — verde claro
  '#cc2a36'  // 5 urbano — vermelho
];
Map.addLayer(comp, {bands:['B4','B3','B2'], min:0, max:0.3}, 'Sentinel-2 RGB');
Map.addLayer(classe, {min:1, max:5, palette:palette}, 'Classificação (5 classes)');
Map.addLayer(AOI.style({color:'yellow', fillColor:'00000000', width:2}), {}, 'Limite Bayeux');

// legenda
var legenda = ui.Panel({style:{position:'bottom-left', padding:'8px'}});
legenda.add(ui.Label('Classes', {fontWeight:'bold'}));
var nomes = ['1 Água','2 Solo exposto','3 Veg. alto porte','4 Veg. baixo porte','5 Urbano'];
nomes.forEach(function(n,i){
  legenda.add(ui.Panel({
    layout: ui.Panel.Layout.flow('horizontal'),
    widgets: [
      ui.Label('', {backgroundColor:palette[i], padding:'8px', margin:'2px'}),
      ui.Label(n, {margin:'4px'})
    ]}));
});
Map.add(legenda);

// ===== 6. ESTATÍSTICAS — área por classe (validação) =====
var areaPorClasse = ee.Image.pixelArea().divide(1e4)  // hectares
  .addBands(classe).reduceRegion({
    reducer: ee.Reducer.sum().group({groupField:1, groupName:'classe'}),
    geometry: aoiGeom, scale: ESCALA, maxPixels: 1e10
  });
print('Área por classe (hectares):', areaPorClasse);
print('  1=Água 2=Solo 3=VegAlta 4=VegBaixa 5=Urbano');

// ===== 7. EXPORT ASSET INTERMEDIÁRIO =====
Export.image.toAsset({
  image: classe,
  description: 'Bayeux_classificacao_asset',
  assetId: ASSET_PASTA + 'Bayeux_classificacao_regras',
  region: aoiGeom, scale: ESCALA, crs: CRS, maxPixels: 1e10
});

// ===== 8. EXPORT RASTER (GeoTIFF) =====
Export.image.toDrive({
  image: classe,
  description: 'Bayeux_classificacao_tif', folder: 'PMRR_Bayeux',
  fileNamePrefix: 'bayeux_classificacao_regras',
  region: aoiGeom, scale: ESCALA, crs: CRS, maxPixels: 1e10
});

// ===== 9. EXPORT VETORIAL (Shapefile) =====
var vetores = classe.reduceToVectors({
  geometry: aoiGeom, crs: CRS, scale: ESCALA,
  geometryType: 'polygon', eightConnected: false,
  labelProperty: 'classe', maxPixels: 1e10
});
Export.table.toDrive({
  collection: vetores,
  description: 'Bayeux_classificacao_shp', folder: 'PMRR_Bayeux',
  fileNamePrefix: 'bayeux_classificacao_regras', fileFormat: 'SHP'
});

//  ===  FIM  ===
