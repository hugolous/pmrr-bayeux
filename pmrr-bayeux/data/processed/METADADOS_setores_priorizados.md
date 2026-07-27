# Priorização de Setores de Risco para Campo

- Produto: ranking de prioridade dos setores de risco do CPRM para
  inspeção de campo (reconhecimento)
- Script gerador: 20_transform/priorizacao_setores_campo.js
- Asset GEE: projects/ee-uendry/assets/PMRR_Bayeux/Bayeux_setores_priorizados
- Data de geração: 2026-06-15
- Responsável: Uendry — Componente de Geoprocessamento e Dados

## Finalidade
Subsidiar a inspeção de campo de reconhecimento (segunda-feira seguinte),
ordenando os 20 setores de risco por prioridade. Produto pré-campo,
sujeito a validação e ajuste após a inspeção.

## Especificação técnica
- Sistema de referência: SIRGAS 2000 / UTM 25S (EPSG:31985)
- Escala de cálculo dos rasters: 10 m
- Recorte (AOI): projects/ee-uendry/assets/Bayeux_limites

## Fontes de entrada
- Setorização de risco — SGB/CPRM, 2019 (asset Risco_CPRM_Bayeux):
  20 setores em alto e muito alto risco. Tipologias: Inundação (12),
  Erosão (4), Deslizamento (3), Colapso (1).
- Áreas vulneráveis a inundação — Prefeitura de Bayeux
  (asset Area_Vulneravel_Inundacao).
- Suscetibilidade à erosão — produto próprio
  (asset Bayeux_suscet_erosao, banda suscet_indice).
- Uso e cobertura — produto próprio (asset Bayeux_classificacao_regras,
  classe 5 = urbano).
- Referência de contexto: Diagnóstico da População em Áreas de Risco
  Geológico, Bayeux/PB — CPRM, 2022 (docs/referencias/).

## Método — score de prioridade (0–100)
Combinação ponderada de cinco fatores normalizados:
- Grau de risco CPRM (Muito Alto=2, Alto=1) — peso 30%
- População exposta (NUM_PESS, normalizada pelo máximo) — peso 25%
- Suscetibilidade à erosão média no setor (própria, 2026) — peso 20%
- Bônus morfológico (Erosão/Deslizamento/Colapso=1; Inundação=0) — peso 15%
- Interseção com mancha de inundação da Prefeitura — peso 10%

## Campos adicionados a cada setor
- score_prior — score de prioridade (0–100)
- susc_media — suscetibilidade à erosão média no setor (1–3)
- frac_urbano — fração de área urbana (classe 5)
- toca_inund — intersecta inundação da Prefeitura (1/0)
- eh_morfo — tipologia morfológica (1/0)
- grau_num — grau de risco numérico (2/1)
- lat, lon — centroide do setor (navegação de campo)

## Arquivos
- bayeux_setores_priorizados.csv — tabela ordenada (roteiro de campo)
- bayeux_setores_priorizados.kml — pontos para navegação em celular
- bayeux_setores_priorizados.shp — setores enriquecidos (vetor)

## Limitações
- A setorização do CPRM é de 2019 (base Censo 2010); há defasagem de
  ocupação. O cruzamento com dados próprios de 2026 é justamente para
  sinalizar possível agravamento, mas não substitui a verificação em campo.
- Buffer de inundação de 100 m (Area_Vulneravel_Inundacao_100m) NÃO foi
  usado nesta fase; reservado para etapa posterior.
- Pesos do score são ajustáveis e preliminares; o ranking deve ser
  validado em campo e recalibrado conforme a inspeção.
- Score não é medida absoluta de risco — é instrumento de ordenação de
  prioridade para otimizar a inspeção de reconhecimento.

## Referência documental
CPRM/SGB. Setorização de áreas em alto e muito alto risco a movimentos
de massa, enchentes e inundações: Bayeux, Paraíba. 2019.
(RIGeo: https://rigeo.cprm.gov.br/handle/doc/19764)
