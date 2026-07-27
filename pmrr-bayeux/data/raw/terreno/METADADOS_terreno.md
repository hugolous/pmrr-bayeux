# Terreno — Relevo, Declividade e Aspecto

- Produto: análise de terreno do município de Bayeux/PB
- Script gerador: 20_transform/terreno_copernicus.js
- Asset GEE: projects/ee-uendry/assets/PMRR_Bayeux/Bayeux_terreno
- Fonte primária: Copernicus DEM GLO-30 (COPERNICUS/DEM/GLO30)
- Data de geração: 2026-06-15
- Responsável: Uendry — Componente de Geoprocessamento e Dados

## Especificação técnica
- Sistema de referência: SIRGAS 2000 / UTM 25S (EPSG:31985)
- Resolução: 30 m (nativa do Copernicus DEM GLO-30)
- Recorte (AOI): projects/ee-uendry/assets/Bayeux_limites

## Bandas do asset
- elevacao — altimetria (m)
- declividade_pct — declividade em porcentagem [tan(graus)*100]
- declividade_graus — declividade em graus
- aspecto_graus — orientação de vertentes (0–360°)
- aspecto_classe — vertente em 8 classes (1=N,2=NE,3=E,4=SE,5=S,6=SO,7=O,8=NO)
- decliv_classe — classes EMBRAPA (1:0-3%,2:3-8%,3:8-20%,4:20-45%,5:45-75%,6:>75%)

## Arquivos
- bayeux_relevo.tif — altimetria (raster)
- bayeux_declividade_pct.tif — declividade % (raster)
- bayeux_aspecto.tif — aspecto (raster)
- bayeux_declividade_classes.shp — classes de declividade (vetor)
- bayeux_aspecto_classes.shp — classes de vertente (vetor)

## Limitações
- Copernicus DEM GLO-30 é DSM (inclui dossel e edificações); em área
  urbana e vegetada superestima o terreno. Para análises de detalhe na
  Etapa 2, prever substituição por FABDEM ou MDT de drone.
- Aspecto é ruidoso em áreas planas (declividade ~0), onde não há
  vertente definida — interpretar apenas onde a declividade é relevante.
