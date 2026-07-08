# Camadas_fase_1 — App de visualização do acervo (Fase 1)

- Tipo: script GEE de interface (ui.*) publicado como Earth Engine App
- Caminho GEE: users/pmrrbayeux/pmrr:Camadas_fase_1
- Destino no repositório: `40_visualizacao/camadas_fase_1.js`
- App publicado: https://pmrr-bayeux.projects.earthengine.app/view/pmrrfase1
  (apps na conta institucional: "PMRR_Fase1" e "PMRR_FASE1 reader")
- Data: 2026-07 (Fase 1)
- Responsável: Uendry — Geoprocessamento e Dados

## Função
Visualização pública do acervo espacial da Fase 1 (38 assets: 5 rasters
+ 33 vetores) com seletor temático: um dropdown troca simultaneamente o
grupo de camadas exibido e a legenda (legenda dinâmica). Limite
municipal sempre visível. Complementa o Drive (download) — App é a
via de VISUALIZAÇÃO; Drive é a via de DOWNLOAD.

## Grupos temáticos (mesma estrutura do Quadro 2 da seção 6.3)
1. Risco e priorização — suscetibilidade (raster), CPRM, priorizados,
   inundação (30 m e 100 m), suscetibilidade vetor, IVS
2. Produtos — uso e terreno — classificação 5 classes, relevo,
   declividade, aspecto
3. Limites e divisões — bairros, malha urbana, quadras, zoneamento,
   comunidades, subcomunidades, setores censitários
4. Hidrografia, vegetação e APPs
5. Infraestrutura e saneamento — valas, galerias, esgoto, CEHAP
6. Casa Branca (estudo de caso)
7. Meio físico (BDiA/IBGE) — geologia, geomorfologia, pedologia, vegetação

## Observações técnicas
- Rasters deste App são os GeoTIFFs RE-SUBIDOS (bandas renomeadas para
  b1/b2 pelo export): suscetibilidade usa banda "b2" (classe);
  demais rasters usam banda única b1
- O pipeline v3 NÃO consome estes rasters — usa os assets nativos em
  assets/base/ (ver 10_pipeline_base.md)
- Paleta e grupos seguem o padrão visual do projeto

## Pendências registradas
- Migrar/despublicar versão antiga do App criada na conta pessoal
  (ee-uendry) — apenas a versão institucional deve circular
- Substituir gradualmente os rasters b1/b2 pelos assets nativos do
  pipeline nas próximas versões do App
