
# Classificação de Uso e Cobertura — 5 classes (por regras)

- Produto: classificação de uso e cobertura do solo de Bayeux/PB
- Script gerador: 20_transform/classificacao_regras.js
- Asset GEE: projects/ee-uendry/assets/PMRR_Bayeux/Bayeux_classificacao_regras
- Fonte primária: Sentinel-2 SR Harmonized (S2A+S2B) + Cloud Score+
- Data de geração: 2026-06-15
- Responsável: Uendry — Componente de Geoprocessamento e Dados

## Especificação técnica
- Sistema de referência: SIRGAS 2000 / UTM 25S (EPSG:31985)
- Resolução: 10 m
- Janela temporal da composição: 2025-08-01 a 2026-04-30
- Máscara de nuvem: Cloud Score+ (cs_cdf >= 0.60)
- Composição: mediana
- Recorte (AOI): projects/ee-uendry/assets/Bayeux_limites

## Classes (banda "classe")
- 1 = Água (estuário)
- 2 = Solo exposto
- 3 = Vegetação de alto porte
- 4 = Vegetação de baixo porte
- 5 = Área urbana / impermeabilizada

## Método
Classificação baseada em regras (decision rules) em cascata, com índices
NDVI, NDWI, MNDWI, NDBI, BSI, NDRE. Ordem: água → veg. alto porte →
veg. baixo porte → urbano → solo exposto.

## Arquivos
- bayeux_classificacao_regras.tif — raster de classes
- bayeux_classificacao_regras.shp — vetor de classes

## Limitações
- Classificação NÃO supervisionada: sem matriz de confusão nem Kappa.
  Produto preliminar para validação visual.
- "Alto/baixo porte" é inferência espectral (NDVI/NDRE), não medição de
  altura. Refinar na Etapa 2 com MDS-MDT de drone.
- Evoluir para Random Forest supervisionado (amostras de campo via
  QField) para o produto final com acurácia reportada.
- Limiares são ponto de partida; sujeitos a calibração após validação.
