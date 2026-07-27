# 12_bacia_paraiba — Caracterização fisiográfica e morfométrica da bacia do rio Paraíba

- Tipo: script executável GEE (análise + exports)
- Caminho GEE: users/pmrrbayeux/pmrr:12_bacia_paraiba
- Destino no repositório: `10_extract/12_bacia_paraiba.js`
- Depende de: users/pmrrbayeux/pmrr:00_config (v3.0)
- Data: 2026-07-10
- Responsável: Uendry — Geoprocessamento e Dados

## Função
Caracterização de CONTEXTO da bacia do rio Paraíba (AOI = bacia inteira,
~20.230 km²), como subsídio hidrossedimentológico ao PMRR de Bayeux
(situado no baixo curso). Distinta dos produtos operacionais do
município. Replica, em escala regional, a metodologia de Santos et al.
(2018) para a bacia do Jaguaribe.

## Especificação técnica
- Sistema de referência: SIRGAS 2000 / UTM 25S (EPSG:31985)
- Terreno: 30 m (Copernicus GLO-30) · Uso: 30 m (MapBiomas)
- AOI: projects/pmrr-bayeux/assets/Bacia_hidrografica_rio_Paraiba

## Insumos
- Bacia_hidrografica_rio_Paraiba (AESA) — AOI
- HydroRIVERS_v10_sa (HydroSHEDS/HydroRIVERS) — rede + ordem de Strahler
- pedo_area_uf_pb (IBGE) — pedologia estadual, campo "ordem"
- Boqueirao_e_Acaua (AESA) — reservatórios (capacidade, bacia de contrib.)
- COPERNICUS/DEM/GLO30 (catálogo GEE) — terreno
- MapBiomas Coleção 9, classification_2023 (catálogo GEE) — uso do solo

## Assets gerados (projects/pmrr-bayeux/assets/bacia/)
- Terreno_bacia — elevação + declividade (%), 30 m
- Uso_grupos_2023 — uso do solo em 6 grandes grupos, 30 m
- Rios_ordem_1a3 — rede de drenagem de ordem 1 a 3 (Strahler)

## Produtos exportados (Drive → data/processed/)
- perfil_longitudinal_paraiba.csv — perfil bruto do rio principal (92 seg.)
- bacia_paraiba_terreno.tif — terreno da bacia (raster)
- (derivados fora do GEE: perfil_paraiba_tabela.csv, perfil PNG, relatório docx)

## Resultados-chave (para referência)
- Geometria: A = 20.230,37 km² · P = 1.073,96 km · rio principal = 380,59 km
- Morfometria: Kc = 2,11 · Ic = 0,22 · Ff = 0,14 · Dd = 0,22 km/km²
  (bacia alongada, baixa suscetibilidade natural a enchentes)
- Solos: Luvissolo 44,7% + Neossolo 27,9% + Planossolo 14,8% (erodíveis)
- Uso: Agropecuária 52% · Floresta 44%
- Strahler: ordem 1 = 2.303 km ... ordem 6 = 232 km (total 4.539 km)
- Perfil: gradiente cai de 2,15 (médio curso) para 1,05 m/km (baixo curso)
- Açudes: Boqueirão a 215,5 km e Acauã a 102 km da foz; controlam ~80%
  da área de drenagem

## Correções e decisões de implementação
- Rio-tronco extraído por caminhamento de máxima área de contribuição
  (UPLAND_SKM / NEXT_DOWN); a 1ª versão via MAIN_RIV pegava a rede toda
  (corrigido: 92 segmentos, 380,59 km)
- Campo da pedologia confirmado como "ordem" (valores em MAIÚSCULAS)
- MapBiomas remapeado para 6 grupos; classes fora do remap ficam mascaradas

## Limitações (ver relatório para detalhe)
- HydroRIVERS truncado (~10 km²): Dd e canais de baixa ordem são limites
  inferiores; não comparar a redes de cartas de grande escala
- DEM 30 m suaviza o baixo curso: gradiente de 1,05 m/km é aproximado
  (a RELAÇÃO entre trechos é robusta)
- Análise de contexto; detalhamento do baixo curso previsto p/ Etapa 2 (drone)

## Próximos passos registrados (parecer do relatório)
1. Eficiência de retenção dos reservatórios (curva de Brune) com séries
   fluviométricas da AESA (Ofício 04)
2. Transporte de sedimento por sensoriamento remoto (turbidez montante ×
   jusante; evolução de deltas de assoreamento)
3. Séries pluviométricas e de cotas para caracterização de eventos críticos
