# 15_ROTEIRO_CAMPO — Roteiro das áreas prioritárias (campo 13/jul)

- Tipo: script executável GEE (análise + exports de navegação)
- Caminho GEE: users/pmrrbayeux/pmrr:15_ROTEIRO_CAMPO
- Destino no repositório: `20_transform/15_roteiro_campo.js`
- Depende de: 00_config (v3.0)
- Data de execução: 2026-07-06 · Campo: 2026-07-13
- Responsável: Uendry — Geoprocessamento e Dados

## Função
Prepara a inspeção das 4 áreas prioritárias definidas em reunião com a
Defesa Civil (asset Areas_Prioritarias_Defesa_Civil, campos ID, COM_SUB,
Perimetro, Area), cruzando cada polígono com inundação e drenagem e
ordenando a visita a partir da Secretaria de Segurança de Bayeux
(Av. Brasil, 77 — ponto -7.125020, -34.917397).

## Indicadores calculados por polígono
- area_ha · dist_partida_km (euclidiana) · lat/lon do centroide
- pct_inund_prefeitura — % da área na mancha Area_Vulneravel_Inundacao
- pct_hand_suscetivel — % com HAND (MERIT/Hydro v1.0.1) <= 5 m, escala 90 m
- n_setores_cprm + pop_exposta_cprm (Risco_CPRM_Bayeux, filterBounds)
- n_valas / n_galerias (Valas_e_Drenos_SIRGAS, Galerias)

## Resultados (2026-07-06) — ordem de visita
1. Porto do Moinho (ID 5) — 200 pess · inund 14,6% · HAND 72%
2. São Lourenço (ID 8) — 540 pess · inund 3% · HAND 74% · 3 valas + 1 galeria
3. Baralho I (ID 1) — 512 pess · inund 0% · HAND 87,5% · sem drenagem mapeada
4. Baralho II (ID 2) — 2000 pess · inund 49% · HAND 83% · 14 valas + 2 galerias

## Achados analíticos pré-campo
- Baralho II é a área crítica (SR_09, maior exposição do município)
- Divergência HAND alto × mancha ~0 em Baralho I e São Lourenço sugere
  alagamento pluvial/drenagem urbana (não capturado pelo buffer fluvial
  de 30 m) — hipótese a verificar em campo

## Arquivos exportados (Drive > PMRR_Bayeux → data/processed/)
- roteiro_areas_prioritarias.kml — navegação (Google Earth/Maps)
- roteiro_areas_prioritarias.csv — tabela-resumo do roteiro

## Limitações
- Ordenação por distância euclidiana (não viária); ajustável em campo
- HAND a 90 m é grosseiro para polígonos pequenos (~2–4 ha): usar como
  indicativo, não como medida
- Resultados pré-campo; tabela deve ser atualizada após a inspeção
