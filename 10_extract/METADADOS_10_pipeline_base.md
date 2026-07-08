# 10_pipeline_base — Geração dos assets base do pipeline v3

- Tipo: script executável GEE
- Caminho GEE: users/pmrrbayeux/pmrr:10_pipeline_base
- Destino no repositório: `10_extract/10_pipeline_base.js`
- Depende de: users/pmrrbayeux/pmrr:00_config (v3.0)
- Data de execução: 2026-07-06
- Responsável: Uendry — Geoprocessamento e Dados

## Função
Gera os três assets base NATIVOS na conta institucional, com bandas de
nomes semânticos (substituem, no pipeline, os GeoTIFFs re-subidos da
conta pessoal, cujas bandas viraram b1/b2).

## Assets gerados (projects/pmrr-bayeux/assets/base/)
### S2_composite — 10 m, EPSG:31985
Composição mediana Sentinel-2 SR Harmonized (S2A+S2B), janela
2025-08-01 a 2026-04-30, máscara Cloud Score+ (cs_cdf >= 0.60),
76 cenas na janela. Refletância 0–1 (float).
Bandas: B2, B3, B4, B5, B8, B11, B12.

### S2_indices — 10 m, EPSG:31985
Índices espectrais derivados da composição.
Bandas: NDVI, NDWI, MNDWI, NDBI, NDRE, BSI.

### Terreno — 30 m, EPSG:31985
Copernicus DEM GLO-30 com correção de projeção
(setDefaultProjection + reproject antes do clip).
Bandas: elevacao (m), declividade_pct, declividade_graus,
aspecto_graus, aspecto_classe (1=N…8=NO),
decliv_classe (EMBRAPA 1–6).

## Proveniência
- COPERNICUS/S2_SR_HARMONIZED + GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED
- COPERNICUS/DEM/GLO30
- Referência da plataforma: Gorelick et al. (2017), RSE 202, 18-27.

## Observações
- Todo produto derivado do pipeline deve ler estes assets, não os
  GeoTIFFs re-subidos (que permanecem apenas para o App de visualização)
- Declividade % = tan(graus) × 100
