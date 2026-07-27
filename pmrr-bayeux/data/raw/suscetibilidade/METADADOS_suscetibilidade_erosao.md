# Suscetibilidade à Erosão — Álgebra de Mapas ponderada
- Produto: mapa de suscetibilidade à erosão de Bayeux/PB
- Script gerador: 20_transform/suscetibilidade_erosao.js
- Asset GEE: projects/ee-uendry/assets/PMRR_Bayeux/Bayeux_suscet_erosao
- Data de geração: 2026-06-15
- Responsável: Uendry — Componente de Geoprocessamento e Dados
## Especificação técnica
- Sistema de referência: SIRGAS 2000 / UTM 25S (EPSG:31985)
- Resolução: 10 m
- Recorte (AOI): projects/ee-uendry/assets/Bayeux_limites
- Método: combinação ponderada (soma de pesos de importância entre fatores)
## Fatores de entrada e pesos de importância
- Declividade — 40% (asset Bayeux_terreno, banda declividade_pct)
- Cobertura da terra — 30% (asset Bayeux_classificacao_regras)
- Solos — 20% (asset pedologia_Bayeux_area_mu_2501807, campo "ordem")
- Exposição de vertentes — 10% (asset Bayeux_terreno, banda aspecto_classe)
## Pesos de classe (1=baixa, 2=média, 3=alta suscetibilidade)
- Declividade: 0–8%=1 | 8–20%=2 | >20%=3
- Cobertura: Água=1 | Solo exposto=3 | Veg. alto=1 | Veg. baixo=2 | Urbano=3
- Solos: GLEISSOLO=1 | ARGISSOLO=3 | sem-dado=1 (unmask)
- Vertentes: Plano/SO/O/NO=1 | N/S=2 | SE/E/NE=3
## Fórmula
indice = (decliv*0.40) + (cobertura*0.30) + (solos*0.20) + (vertentes*0.10)
Resultado contínuo [1–3], reclassificado em:
- 1 = Baixa (1.00–1.67)
- 2 = Média (1.67–2.33)
- 3 = Alta (2.33–3.00)
Obs.: cortes iniciais por terços; recalibrar pelos percentis reais.
## Bandas do asset
- suscet_indice — índice contínuo (1–3)
- suscet_classe — classe (1=Baixa, 2=Média, 3=Alta)
## Arquivos
- bayeux_suscet_erosao.tif — raster (índice + classe)
- bayeux_suscet_erosao.shp — vetor das classes
## Referência metodológica
Pesos de classe conforme Tabela 2 (pesos atribuídos às classes dos mapas
temáticos) adotada pela equipe. Geologia não entra neste cálculo.
## Limitações
- Solos com apenas 2 ordens em Bayeux (GLEISSOLO, ARGISSOLO); áreas sem
  polígono de pedologia receberam peso 1 (unmask). Reavaliar se houver
  lacunas extensas de cobertura pedológica.
- Cortes das 3 classes são preliminares; ajustar pelos quebras naturais
  do histograma após validação.
- Herda as limitações dos insumos (DSM Copernicus; classificação por
  regras não validada por campo).
