
// ===== 1. CONFIGURAÇÃO =====
var AOI = ee.FeatureCollection('projects/ee-uendry/assets/Bayeux_limites');
var aoiGeom = AOI.geometry();

var CRS = 'EPSG:31985';
var ESCALA = 10;
var ASSET_PASTA = 'projects/ee-uendry/assets/PMRR_Bayeux/';

// pesos de importância entre fatores (somam 1.0)
var P_DECLIV = 0.40, P_COBERT = 0.30, P_SOLOS = 0.20, P_VERTEN = 0.10;

Map.centerObject(AOI, 12);
Map.setOptions('HYBRID');

// ===== 2. ASSETS DE ENTRADA =====
var terreno = ee.Image('projects/ee-uendry/assets/PMRR_Bayeux/Bayeux_terreno');
var cobertura = ee.Image('projects/ee-uendry/assets/PMRR_Bayeux/Bayeux_classificacao_regras');
var pedologia = ee.FeatureCollection('projects/ee-uendry/assets/pedologia_Bayeux_area_mu_2501807');

// ===== 3. FATOR 1 — DECLIVIDADE (peso de classe) =====
//  usa a banda declividade_pct do asset de terreno
var declivPct = terreno.select('declividade_pct');
var fDecliv = ee.Image(0)
  .where(declivPct.lt(8), 1)
  .where(declivPct.gte(8).and(declivPct.lt(20)), 2)
  .where(declivPct.gte(20), 3)
  .rename('peso_decliv').clip(AOI);

// ===== 4. FATOR 2 — COBERTURA DA TERRA (peso de classe) =====
//  classes do asset: 1=Água 2=SoloExp 3=VegAlta 4=VegBaixa 5=Urbano
var fCobert = ee.Image(0)
  .where(cobertura.eq(1), 1)  // água
  .where(cobertura.eq(2), 3)  // solo exposto → alta
  .where(cobertura.eq(3), 1)  // veg alto porte → baixa
  .where(cobertura.eq(4), 2)  // veg baixo porte → média
  .where(cobertura.eq(5), 3)  // urbano → alta
  .rename('peso_cobert').clip(AOI);

// ===== 5. FATOR 3 — SOLOS (peso de classe) =====
//  campo "ordem": GLEISSOLO=1, ARGISSOLO=3
//  rasteriza o vetor atribuindo o peso diretamente
var pedComPeso = pedologia.map(function(f){
  var ordem = ee.String(f.get('ordem'));
  var peso = ee.Algorithms.If(ordem.equals('ARGISSOLO'), 3,
             ee.Algorithms.If(ordem.equals('GLEISSOLO'), 1, 0));
  return f.set('peso_solo', peso);
});
//  rasteriza por atributo peso_solo
var fSolosRaw = pedComPeso
  .reduceToImage({properties: ['peso_solo'], reducer: ee.Reducer.first()})
  .rename('peso_solo');
//  onde não há polígono de solo (sem-dado), assume peso 1 (neutro-baixo)
//  para não criar buraco no resultado; ajuste se a equipe preferir outro.
var fSolos = fSolosRaw.unmask(1).clip(AOI).rename('peso_solo');

// ===== 6. FATOR 4 — VERTENTES (peso de classe) =====
//  usa a banda aspecto_classe do asset de terreno
//  1=N 2=NE 3=E 4=SE 5=S 6=SO 7=O 8=NO  (gerado na etapa de terreno)
//  Tabela 2: Plano/SW/W/NW=1 | N/S=2 | SE/E/NE=3
//  declividade ~0 = plano → peso 1 (sem vertente definida)
var aspectoCl = terreno.select('aspecto_classe');
var ehPlano = declivPct.lt(3);  // limiar de "plano": <3% sem vertente relevante
var fVerten = ee.Image(0)
  .where(aspectoCl.eq(1).or(aspectoCl.eq(5)), 2)             // N, S
  .where(aspectoCl.eq(4).or(aspectoCl.eq(3)).or(aspectoCl.eq(2)), 3) // SE, E, NE
  .where(aspectoCl.eq(6).or(aspectoCl.eq(7)).or(aspectoCl.eq(8)), 1) // SO, O, NO
  .where(ehPlano, 1)                                          // plano sobrepõe
  .rename('peso_verten').clip(AOI);
//  garante que não fique 0 (qualquer resíduo vira 1)
fVerten = fVerten.where(fVerten.eq(0), 1);

// ===== 7. ÁLGEBRA DE MAPAS PONDERADA =====
//  índice = Σ (peso_classe_fator × peso_importância_fator)
//  resultado contínuo entre 1 e 3
var suscet = fDecliv.multiply(P_DECLIV)
  .add(fCobert.multiply(P_COBERT))
  .add(fSolos.multiply(P_SOLOS))
  .add(fVerten.multiply(P_VERTEN))
  .rename('suscet_indice').clip(AOI);

// ===== 8. RECLASSIFICAÇÃO EM 3 CLASSES =====
//  cortes iniciais por terços do intervalo teórico [1,3]:
//   Baixa: 1.00–1.67 | Média: 1.67–2.33 | Alta: 2.33–3.00
//  (ajuste pelos quebras reais do histograma após validação)
var suscetClasse = ee.Image(1)
  .where(suscet.gt(1.67), 2)
  .where(suscet.gt(2.33), 3)
  .rename('suscet_classe').toInt().clip(AOI);

// ===== 9. VISUALIZAÇÃO (validação humana) =====
var palIndice = ['#1a9850','#fee08b','#d73027']; // verde→amarelo→vermelho
Map.addLayer(suscet, {min:1, max:3, palette:palIndice}, 'Índice contínuo (1–3)');
Map.addLayer(suscetClasse, {min:1, max:3, palette:palIndice}, 'Suscetibilidade (3 classes)');
Map.addLayer(AOI.style({color:'yellow', fillColor:'00000000', width:2}), {}, 'Limite Bayeux');

// fatores individuais (para auditar cada camada) — desligados por padrão
Map.addLayer(fDecliv, {min:1,max:3,palette:palIndice}, 'Fator declividade', false);
Map.addLayer(fCobert, {min:1,max:3,palette:palIndice}, 'Fator cobertura', false);
Map.addLayer(fSolos,  {min:1,max:3,palette:palIndice}, 'Fator solos', false);
Map.addLayer(fVerten, {min:1,max:3,palette:palIndice}, 'Fator vertentes', false);

// legenda
var legenda = ui.Panel({style:{position:'bottom-left', padding:'8px'}});
legenda.add(ui.Label('Suscetibilidade à erosão', {fontWeight:'bold'}));
['Baixa','Média','Alta'].forEach(function(n,i){
  legenda.add(ui.Panel({
    layout: ui.Panel.Layout.flow('horizontal'),
    widgets: [ui.Label('', {backgroundColor:palIndice[i], padding:'8px', margin:'2px'}),
              ui.Label(n, {margin:'4px'})]}));
});
Map.add(legenda);

// ===== 10. ESTATÍSTICAS (validação) =====
print('Índice contínuo — percentis:', suscet.reduceRegion({
  reducer: ee.Reducer.percentile([10,25,50,75,90]),
  geometry: aoiGeom, scale: ESCALA, maxPixels: 1e10}));

var areaClasse = ee.Image.pixelArea().divide(1e4).addBands(suscetClasse)
  .reduceRegion({
    reducer: ee.Reducer.sum().group({groupField:1, groupName:'classe'}),
    geometry: aoiGeom, scale: ESCALA, maxPixels: 1e10});
print('Área por classe de suscetibilidade (ha) — 1=Baixa 2=Média 3=Alta:', areaClasse);

// ===== 11. EXPORT ASSET INTERMEDIÁRIO =====
//  guarda índice contínuo + classe, num único asset
var saida = suscet.addBands(suscetClasse).toFloat();
Export.image.toAsset({
  image: saida,
  description: 'Bayeux_suscet_erosao_asset',
  assetId: ASSET_PASTA + 'Bayeux_suscet_erosao',
  region: aoiGeom, scale: ESCALA, crs: CRS, maxPixels: 1e10});

// ===== 12. EXPORT RASTER (GeoTIFF) =====
Export.image.toDrive({
  image: saida, description: 'Bayeux_suscet_erosao_tif',
  folder: 'PMRR_Bayeux', fileNamePrefix: 'bayeux_suscet_erosao',
  region: aoiGeom, scale: ESCALA, crs: CRS, maxPixels: 1e10});

// ===== 13. EXPORT VETORIAL (Shapefile das classes) =====
var vetores = suscetClasse.reduceToVectors({
  geometry: aoiGeom, crs: CRS, scale: ESCALA,
  geometryType: 'polygon', eightConnected: false,
  labelProperty: 'suscet_classe', maxPixels: 1e10});
Export.table.toDrive({
  collection: vetores, description: 'Bayeux_suscet_erosao_shp',
  folder: 'PMRR_Bayeux', fileNamePrefix: 'bayeux_suscet_erosao',
  fileFormat: 'SHP'});

//  ===  FIM  ===
