# 00_config — Biblioteca de configuração do pipeline

- Tipo: biblioteca GEE (não executável; importada via require)
- Caminho GEE: users/pmrrbayeux/pmrr:00_config
- Destino no repositório: `00_config/00_config.js`
- Conta: institucional (projects/pmrr-bayeux)
- Versão do pipeline: v3.0
- Data: 2026-07-06
- Responsável: Uendry — Geoprocessamento e Dados

## Função
Fonte única de verdade dos parâmetros do pipeline. Todos os módulos
importam este script; alterações de parâmetro são feitas apenas aqui.

## Exports (parâmetros)
- PROJETO, VERSAO
- RAIZ = projects/pmrr-bayeux/assets/ · PASTA_BASE = RAIZ + base/
- AOI_ID = projects/pmrr-bayeux/assets/Bayeux_limites
- CRS = EPSG:31985 (SIRGAS 2000 / UTM 25S)
- ESCALA_S2 = 10 m · ESCALA_DEM = 30 m
- DATA_INI = 2025-08-01 · DATA_FIM = 2026-04-30
- CS_THRESH = 0.60 (Cloud Score+) · HAND_LIMIAR = 5 m
- BANDAS_S2 = B2, B3, B4, B5, B8, B11, B12
- PAL = paletas padrão do projeto (classif, suscet, relevo, decliv, ndvi)

## Exports (funções)
- getAOI() — retorna a FeatureCollection do limite municipal
- getS2Masked(aoi) — coleção S2 SR Harmonized filtrada pela janela
  temporal e mascarada por Cloud Score+ (cs_cdf >= CS_THRESH)

## Regras de uso
- Nenhum módulo deve conter parâmetro fixo que exista aqui
- Mudanças exigem incremento de versão e registro no commit
