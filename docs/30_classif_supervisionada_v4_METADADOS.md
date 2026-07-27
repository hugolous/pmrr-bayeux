# PMRR Bayeux/PB — Classificação Supervisionada de Uso e Cobertura do Solo (v4.0)

> ⚠️ **VERSÃO SUPERADA.** O produto ativo é a **v5.0**
> (`30_classif_supervisionada_v5_METADADOS.md`). A v4.0 é mantida apenas para
> rastreabilidade histórica. Diferença: a v5 corrigiu a auditoria da classe Solo exposto
> com o critério adicional `B11 > 0,30`, que removeu a lama de maré confundida com água.
> **Não usar a v4 para novos produtos nem para o relatório.**

**Produto:** `Uso_cobertura_RF_v4`
**Script:** `30_classif_supervisionada` (v4.0)
**Responsável técnico:** Uendry da Silva Ramos Maia — Geoprocessamento e Dados
**Coleta de amostras:** Glauber (bolsista GIS/QGIS)
**Validação independente:** Paulo (estagiário) — script `40_validacao_independente`, a produzir
**Repositório/ETL/site:** Hugo (bolsista TI)
**Coordenação:** Prof. Dr. Saulo Roberto de Oliveira Vital — LAGERISCO/GENAT, UFPB
**Financiamento:** Ministério das Cidades

> **Status:** produto preliminar. A acurácia oficial ainda **não** foi estimada.
> Ver seção 8 (Limitações) antes de qualquer uso em relatório ou site.

---

## 1. Identificação (ISO 19115 — núcleo)

| Elemento | Valor |
|---|---|
| Título | Uso e cobertura do solo — Bayeux/PB — classificação supervisionada Random Forest |
| Data de referência dos dados | 2025-08-01 a 2026-04-30 |
| Tipo de representação espacial | Matricial (grid) |
| Resolução espacial | 10 m |
| Sistema de referência | SIRGAS 2000 / UTM 25S — **EPSG:31985** |
| Extensão | Limite municipal de Bayeux/PB (`Bayeux_limites`) |
| Área do AOI | 2.770,01 ha (27,70 km²) |
| Formato de distribuição | GeoTIFF (Drive), asset GEE, CSV (tabelas) |
| Idioma | pt-BR |
| Categoria temática | `imageryBaseMapsEarthCover` |
| Restrição de uso | Uso interno do PMRR; tier GEE Community (não comercial) |

---

## 2. Legenda oficial

| Código | Classe | Cor (hex) |
|---|---|---|
| 1 | Água | `#1f6fb4` |
| 2 | Solo exposto | `#c9a227` |
| 3 | Vegetação de alto porte | `#1a6b2f` |
| 4 | Vegetação de baixo porte | `#8fce5b` |
| 5 | Área urbana / impermeabilizada | `#d1462f` |

Codificação **fixa** e compartilhada com os demais produtos do projeto (inclusive a álgebra
de suscetibilidade à erosão). Não renumerar.

---

## 3. Insumos

### 3.1 Imagem

| Item | Valor |
|---|---|
| Coleção | `COPERNICUS/S2_SR_HARMONIZED` |
| Janela | 2025-08-01 a 2026-04-30 (ano-safra) |
| Cenas na janela | 76 |
| Plataformas | Sentinel-2A, 2B e 2C |
| Máscara de nuvem | Cloud Score+ (`cs_cdf`) ≥ 0,60 |
| Composição | Mediana |
| Assets base | `base/S2_composite`, `base/S2_indices` |

### 3.2 Variáveis preditoras (13)

**Refletância (7):** `B2 B3 B4 B5 B8 B11 B12`
**Índices (6):** `NDVI NDWI MNDWI NDBI NDRE BSI`

Variáveis de terreno **não** foram incluídas, para preservar a independência entre a
camada de cobertura e a camada de relevo na álgebra de suscetibilidade à erosão
(evitar circularidade).

A banda experimental de frequência de água (`freq_agua`) foi testada e **descartada**:
contribuiu com 1,25% da importância total e produzia falso positivo sobre telhado
metálico. Asset mantido para referência: `base/Agua_frequencia_v2`.

### 3.3 Amostras de treinamento

Polígonos coletados por Glauber no ambiente `20_amostras_treino`:

```
projects/pmrr-bayeux/assets/amostras/agua
projects/pmrr-bayeux/assets/amostras/solo
projects/pmrr-bayeux/assets/amostras/urbano
projects/pmrr-bayeux/assets/amostras/veg_alta
projects/pmrr-bayeux/assets/amostras/veg_baixa
```

---

## 4. Método

### 4.1 Fluxo

```
00_config (v3.0)
   └── 30_classif_supervisionada (v4.0)
         1. Stack preditor (13 bandas)
         2. Auditoria de rotulagem  → assets congelados
         3. Split 70/30 POR POLÍGONO
         4. Amostragem estratificada balanceada
         5. Subclasses espectrais (k-means intraclasse)
         6. Treino Random Forest
         7. Classificação + remapeamento subclasse → classe
         8. Validação interna (auditada e não auditada)
         9. Teste de estabilidade (5 sementes)
        10. Exportações
```

### 4.2 Auditoria de rotulagem

A assinatura espectral média de cada polígono foi confrontada com a definição
operacional da classe adotada no projeto (derivada de `classificacao_regras.js`).
Polígonos cuja resposta espectral contradiz o próprio rótulo foram excluídos do
treinamento e registrados em asset/SHP para revisão.

| Limiar | Valor |
|---|---|
| `NDVI_AGUA_MAX` | 0,20 |
| `NDVI_SOLO_MAX` | 0,25 |
| `NDVI_VEGALTA_MIN` | 0,55 |
| `NDVI_VEGBAIXA_MIN` | 0,25 |
| `NDVI_VEGBAIXA_MAX` | 0,85 |
| `B8_URBANO_MAX` | 0,45 |

**Resultado:**

| Classe | Original | Aprovado | Rejeitado | % rejeição |
|---|---|---|---|---|
| Água | 53 | 50 | 3 | 5,7% |
| **Solo exposto** | **67** | **12** | **55** | **82,1%** |
| Veg. alto porte | 100 | 100 | 0 | 0% |
| Veg. baixo porte | 40 | 40 | 0 | 0% |
| Urbano | 103 | 100 | 3 | 2,9% |
| **Total** | **363** | **302** | **61** | 16,8% |

A rejeição massiva em solo exposto decorre de os polígonos apresentarem NDVI médio
em torno de 0,46 na composição mediana — valor que a metodologia do próprio projeto
associa à vegetação de baixo porte. Interpretação provável: a mediana de nove meses
converte solo sazonalmente descoberto em superfície com cobertura herbácea rala.
**Decisão pendente de validação pela equipe** (ver seção 9).

### 4.3 Partição

Separação **no nível do polígono** (70% treino / 30% validação), nunca por pixel,
para evitar autocorrelação espacial entre conjuntos.

| Classe | Polígonos treino | Polígonos validação | Px disponíveis (treino) |
|---|---|---|---|
| Água | 36 | 14 | 1.323 |
| Solo exposto | 8 | 4 | 140 |
| Veg. alto porte | 68 | 32 | 3.210 |
| Veg. baixo porte | 27 | 13 | 644 |
| Urbano | 65 | 35 | 1.406 |

Amostragem estratificada **balanceada**: 120 px/classe (treino), 60 px/classe (validação).

### 4.4 Subclasses espectrais

Cada classe foi subdividida por k-means intraclasse, treinada nas subclasses e
remapeada para a legenda oficial (`classe = floor(codigo/10)`). Isso permite ao
classificador modelar classes multimodais sem alterar a legenda entregue.

| Classe | k | Subclasses |
|---|---|---|
| 1 Água | 2 | `10`, `11` |
| 2 Solo exposto | 1 | `20` |
| 3 Veg. alto porte | 1 | `30` |
| 4 Veg. baixo porte | 2 | `40`, `41` |
| 5 Urbano | 2 | `50`, `51` |

### 4.5 Classificador

| Parâmetro | Valor |
|---|---|
| Algoritmo | `ee.Classifier.smileRandomForest` |
| `numberOfTrees` | 500 |
| `variablesPerSplit` | `null` → √p ≈ 3,6 |
| `minLeafPopulation` | 5 |
| `bagFraction` | 0,5 |
| `seed` | 42 |

---

## 5. Resultados

### 5.1 Importância das variáveis (%)

| Banda | % | | Banda | % |
|---|---|---|---|---|
| NDWI | 10,16 | | B11 | 7,43 |
| B2 | 9,24 | | NDBI | 7,17 |
| B12 | 9,18 | | B8 | 7,03 |
| BSI | 8,68 | | B5 | 7,02 |
| NDVI | 8,02 | | B4 | 6,72 |
| B3 | 7,84 | | NDRE | 5,91 |
| | | | MNDWI | 5,60 |

Distribuição uniforme seria 7,69%. A hierarquia é fisicamente coerente: NDWI lidera
a discriminação de água e o BSI (*Bare Soil Index*) figura em 4º, coerente com a
presença de solo exposto real no conjunto de treinamento após a auditoria.

### 5.2 Separabilidade Jeffries-Matusita

JM ∈ [0, 2]. Referência: > 1,9 ótima · 1,7–1,9 boa · < 1,7 confusão provável.

| Par | JM média | JM melhor banda |
|---|---|---|
| **Solo exposto × Urbano** | **0,412** | **1,113** |
| Veg. baixo porte × Urbano | 1,256 | 1,966 |
| Solo exposto × Veg. baixo porte | 1,385 | 1,981 |
| Água × Veg. alto porte | 1,653 | 2,000 |
| Água × Urbano | 1,703 | 2,000 |
| Veg. alto porte × Veg. baixo porte | 1,705 | 1,998 |
| Água × Veg. baixo porte | 1,713 | 2,000 |
| Veg. alto porte × Urbano | 1,722 | 2,000 |
| Solo exposto × Veg. alto porte | 1,812 | 2,000 |
| Água × Solo exposto | 1,882 | 2,000 |

O par Solo × Urbano é o ponto frágil: nenhuma banda isolada os separa
(melhor banda = 1,113). A discriminação depende da combinação multivariada.

### 5.3 Validação interna

Duas medidas, com significados distintos:

| Métrica | Auditada | Não auditada |
|---|---|---|
| N amostral | 300 | 600 |
| Acurácia global | 0,9433 | **0,8250** |
| IC 95% | ±0,0262 | ±0,0304 |
| Kappa | 0,9292 | **0,7813** |
| Macro-F1 | 0,9415 | **0,8042** |
| Desacordo de quantidade (Q) | 0,0500 | 0,1683 |
| Desacordo de alocação (A) | 0,0067 | 0,0067 |

**Auditada** — validação sobre polígonos aprovados na auditoria. É **circular**:
treino e validação passaram pelo mesmo filtro espectral. Constitui limite superior.

**Não auditada** — validação sobre todos os polígonos originais fora do treino,
inclusive os reprovados. Estimativa mais próxima da realidade.

O desacordo de **alocação é idêntico (0,0067)** nas duas medidas: o modelo posiciona
as classes corretamente; a divergência é de **quantidade**, concentrada na classe
solo exposto, e reflete a discordância entre a rotulagem original e a definição
operacional adotada — não erro de posicionamento espacial.

#### Métricas por classe — validação auditada

| Classe | PA | UA | F1 | Omissão | Comissão |
|---|---|---|---|---|---|
| Água | 1,000 | 0,822 | 0,902 | 0,000 | 0,178 |
| Solo exposto | 0,733 | 0,978 | 0,838 | 0,267 | 0,022 |
| Veg. alto porte | 1,000 | 1,000 | 1,000 | 0,000 | 0,000 |
| Veg. baixo porte | 1,000 | 0,968 | 0,984 | 0,000 | 0,032 |
| Urbano | 0,983 | 0,983 | 0,983 | 0,017 | 0,017 |

#### Métricas por classe — validação não auditada

| Classe | PA | UA | F1 |
|---|---|---|---|
| Água | 0,867 | 1,000 | 0,929 |
| **Solo exposto** | **0,283** | **0,919** | **0,433** |
| Veg. alto porte | 1,000 | 0,882 | 0,938 |
| Veg. baixo porte | 1,000 | 0,585 | 0,738 |
| Urbano | 0,975 | 0,992 | 0,983 |

Leitura da classe 2: PA baixa (0,283) com UA alta (0,919) significa que o mapa
**subdeclara** solo exposto, mas **acerta quando declara**. Os 85 pixels omitidos
correspondem aos polígonos reprovados na auditoria.

#### Nota sobre a célula Solo → Água (validação auditada)

Treze pixels rotulados solo exposto foram classificados como água. Como a classe
possui apenas **4 polígonos de validação**, esses 13 pixels correspondem
aproximadamente a **um polígono inteiro**. Dado que Água × Solo é o par mais bem
separado (JM = 1,882), trata-se muito provavelmente de um polígono isolado sobre
superfície úmida escura, não de sobreposição espectral entre as classes.
**Pendência de inspeção visual.**

### 5.4 Áreas por classe

Média e desvio-padrão de **cinco execuções independentes** do pipeline
(sementes 42, 7, 13, 99, 2024), variando apenas a partição e a amostragem.

| Classe | Área média (ha) | Desvio (ha) | CV | Mín | Máx | % do AOI |
|---|---|---|---|---|---|---|
| Água | 162,11 | ±6,45 | 3,98% | 156,25 | 174,07 | 5,85% |
| Solo exposto | 445,61 | ±21,47 | 4,82% | 420,82 | 477,45 | 16,09% |
| Veg. alto porte | 1.030,80 | ±27,57 | 2,67% | 998,78 | 1.075,65 | 37,21% |
| Veg. baixo porte | 641,43 | ±32,74 | 5,10% | 599,93 | 686,64 | 23,16% |
| Urbano | 490,06 | ±15,04 | 3,07% | 472,14 | 516,99 | 17,69% |
| **Total AOI** | **2.770,01** | — | — | — | — | 100% |

Todas as classes com CV abaixo de 5,2%, indicando estabilidade da estimativa mesmo
para solo exposto, cujo conjunto amostral é reduzido.

> **Nas figuras e tabelas do relatório, usar a média das cinco sementes, não o valor
> da execução única com semente 42** — que se situa nos extremos da faixa em três
> das cinco classes.

### 5.5 Incerteza espacial

| Métrica | Valor |
|---|---|
| Área com margem de decisão < 0,20 | 365,04 ha |
| Proporção do AOI | 13,18% |

Confiança média por classe (probabilidade agregada da classe vencedora):

| Classe | Confiança |
|---|---|
| Veg. alto porte | 0,790 |
| Água | 0,756 |
| Urbano | 0,693 |
| Veg. baixo porte | 0,671 |
| **Solo exposto** | **0,585** |

As zonas de dúvida mantiveram-se estáveis (294–365 ha) sob diferentes parametrizações,
sugerindo característica do terreno — franja intermaré do estuário Paraíba–Sanhauá,
bordas de quadra com arborização domiciliar, superfícies em revegetação — e não
instabilidade do classificador.

### 5.6 Conferência com camadas da Prefeitura

| Referência | Área (ha) | Classe do mapa | Área (ha) | Razão |
|---|---|---|---|---|
| `Hidrografia_2013_SIRGAS` | 314,18 | 1 Água | 162,11 | 52% |
| `Quadras_SIRGAS` | 660,95 | 5 Urbano | 490,06 | 74% |
| `Malha_Urbana_SIRGAS2000` | 710,79 | 5 Urbano | 490,06 | 69% |

Divergências esperadas e não conclusivas de erro:
- **Água:** a hidrografia vetorizada delimita a calha fluvial (incluindo franja
  intermaré); a composição mediana detecta a lâmina d'água permanente. Somam-se
  assoreamento desde 2013 e diferença de escala de vetorização.
- **Urbano:** quadra é unidade cadastral, contendo edificações, quintais arborizados,
  vias e lotes vazios. Não se espera correspondência 1:1 com superfície impermeabilizada.

Verificação pendente: cruzamento espacial classe × quadras, para quantificar a
composição interna das quadras.

---

## 6. Assets e arquivos gerados

### 6.1 Assets GEE (`projects/pmrr-bayeux/assets/`)

| Asset | Conteúdo |
|---|---|
| `base/Uso_cobertura_RF_v4` | **Produto principal** — raster 5 classes, 10 m, EPSG:31985 |
| `base/Agua_frequencia_v2` | Frequência de água (auxiliar; não usada no produto final) |
| `amostras/auditados_v4` | 302 polígonos aprovados — **congelado, garante reprodutibilidade** |
| `amostras/rejeitados_v4` | 61 polígonos reprovados — material de revisão do Glauber |
| `amostras/split_treino_v4` | Polígonos de treino — **excluir no sorteio do `40_`** |
| `amostras/split_validacao_v4` | Polígonos de validação interna |

### 6.2 Rasters (Drive → `PMRR_Bayeux/`)

| Arquivo | Conteúdo |
|---|---|
| `PMRR_Bayeux_classif_RFv4_classes.tif` | Classificação final (valores 1–5) |
| `PMRR_Bayeux_classif_RFv4_subclasses.tif` | Subclasses (10–51), diagnóstico |
| `PMRR_Bayeux_classif_RFv4_confianca.tif` | 2 bandas: `confianca`, `margem` |

### 6.3 Tabelas (CSV, Drive → `PMRR_Bayeux/`)

Prefixo comum: `PMRR_Bayeux_classif_RFv4_`

| Sufixo | Conteúdo |
|---|---|
| `resumo_metadados` | Parâmetros e métricas consolidados |
| `matriz_auditada` | Matriz de confusão, formato longo |
| `matriz_nao_auditada` | Matriz de confusão, formato longo |
| `metricas_classe_auditada` | PA, UA, F1, omissão, comissão |
| `metricas_classe_nao_auditada` | idem |
| `areas` | Área por classe (execução semente 42) |
| `estabilidade_sementes` | Área por classe × 5 sementes |
| `estabilidade_dispersao` | Média, desvio, CV, mín, máx |
| `auditoria` | Aprovados/rejeitados por classe |
| `importancia` | Importância das variáveis |
| `separabilidade_JM` | JM por par de classes |
| `assinaturas` | Média e desvio por classe × banda |
| `assinatura_subclasses` | Assinatura média por subclasse |
| `subclasses` | Nº de pixels por subclasse |
| `confianca_classe` | Confiança média por classe |
| `poligonos_rejeitados` | **SHP** dos polígonos reprovados |

---

## 7. Reprodutibilidade

Para reproduzir exatamente estes números:

1. `MODO_AUDITORIA = 'asset'` (lê `amostras/auditados_v4`)
2. `SEED = 42`, `N_PIX_TREINO = 120`, `N_PIX_VALID = 60`
3. `USAR_FREQ = false`, `APLICAR_MODA = false`
4. `K_SUB = {1:2, 2:1, 3:1, 4:2, 5:2}`

> **Importante:** rodar com `MODO_AUDITORIA = 'calcular'` produz um `system:index`
> diferente após o `reduceRegions`, o que altera o sorteio do `randomColumn` mesmo
> com a mesma semente. **Sempre usar o asset congelado** para qualquer número que
> vá para relatório.

---

## 8. Limitações metodológicas (declarar sempre)

1. **A acurácia oficial ainda não foi estimada.** Ambas as validações internas
   derivam dos mesmos polígonos de treinamento, delimitados por fotointerpretação
   em áreas espectralmente homogêneas, sub-representando pixels de borda e mistura.
2. **A validação auditada é circular** — treino e validação filtrados pelo mesmo
   critério espectral. Constitui limite superior, não estimativa de acurácia.
3. **O erro Out-of-Bag não é acurácia do mapa.** O bootstrap do RF é por pixel, e
   pixels do mesmo polígono são quase idênticos. Serve como diagnóstico de
   convergência apenas. (Valor registrado: 0,0267.)
4. **Solo exposto repousa sobre 12 polígonos** (8 de treino, 4 de validação). Cada
   polígono sustenta ~37 ha mapeados, contra ~5 ha por polígono de urbano.
5. **Solo exposto × Urbano com JM = 0,412** e melhor banda isolada = 1,113: nenhuma
   banda separa o par sozinha.
6. **"Alto/baixo porte" é inferência espectral**, não medição de altura.
7. **A definição de solo exposto (NDVI < 0,25) é convencional** e derivada do
   `classificacao_regras.js`. Alterá-la move a fronteira entre as classes 2 e 4 e
   altera o resultado da álgebra de suscetibilidade à erosão.
8. **Zonas de dúvida (13,18%)** representam alvos genuinamente mistos, não falha
   do classificador.
9. **Sem filtro de moda pós-classificação.** Se aplicado posteriormente, todas as
   áreas devem ser recalculadas sobre o raster filtrado.
10. **Sem estimador ponderado por área.** A amostragem balanceada implica que as
    acurácias aqui apresentadas não são ponderadas pela proporção real das classes.
    O script `40_` deverá aplicar estimador estratificado.

---

## 9. Pendências

### 9.1 Equipe técnica (Uendry / Caio)

- [ ] Validar a definição operacional de solo exposto (NDVI < 0,25) à luz da
      finalidade do produto na álgebra de suscetibilidade à erosão
- [ ] Definir se os 55 polígonos reprovados são reclassificados como vegetação de
      baixo porte ou descartados
- [ ] Revisar os pesos de classe da álgebra de erosão diante das novas áreas
- [ ] Inspecionar visualmente os 4 polígonos de validação de solo exposto
      (identificar o polígono úmido — ver 5.3)

### 9.2 Glauber — coleta dirigida (desejável, não bloqueante)

- [ ] 30–40 polígonos de solo exposto **real** (areais, saibreiras, terraplenagens,
      lotes raspados), usando a máscara `NDVI < 0,20 AND BSI > 0` apenas para
      **localizar** candidatos e confirmação visual sobre imagem de alta resolução
      para **rotular** — evitando circularidade
- [ ] Revisar o SHP `poligonos_rejeitados`

### 9.3 Paulo — validação independente (script `40_validacao_independente`)

- [ ] ~250 pontos aleatórios estratificados (50/classe), fotointerpretados
- [ ] **Excluir do sorteio os polígonos de `amostras/split_treino_v4`**
- [ ] **Não aplicar filtro espectral no sorteio** — os pontos precisam cair também
      onde o modelo erra
- [ ] Priorizar as zonas de dúvida (margem < 0,20): são as amostras mais informativas
- [ ] Aplicar **estimador estratificado ponderado por área** (proporção de cada
      classe no mapa como peso)
- [ ] Produzir matriz de confusão, acurácia global, Kappa e IC 95%

### 9.4 Hugo — repositório e site

- [ ] Versionar `30_classif_supervisionada.js` em `20_transform/`
- [ ] Registrar este `.md` em `docs/`
- [ ] Registrar os `assetId` no índice de produtos (rasters pesados **não** vão para
      o Git — permanecem no Drive/asset GEE, conforme política do projeto)
- [ ] Publicar os CSV de métricas em `data/processed/`
- [ ] **Reprojetar para EPSG:4326 antes de gerar o GeoJSON do site** — o Leaflet
      opera em WGS 84 e todos os produtos do projeto estão em EPSG:31985
- [ ] Vetorizar o raster para o site (sugestão: simplificar geometrias; o raster de
      10 m gera GeoJSON pesado)
- [ ] Painel de estatísticas: usar as áreas de **média ± desvio** da seção 5.4,
      não os valores da execução única
- [ ] Tag sugerida: `v0.5`

---

## 10. Referências verificadas

- Belgiu, M.; Drăguţ, L. (2016). Random forest in remote sensing: a review of
  applications and future directions. *ISPRS Journal of Photogrammetry and Remote
  Sensing*, v. 114, p. 24–31.
- Olofsson, P.; Foody, G. M.; Herold, M.; Stehman, S. V.; Woodcock, C. E.;
  Wulder, M. A. (2014). Good practices for estimating area and assessing accuracy
  of land change. *Remote Sensing of Environment*, v. 148, p. 42–57.
- Gorelick, N. et al. (2017). Google Earth Engine: planetary-scale geospatial
  analysis for everyone. *Remote Sensing of Environment*, v. 202, p. 18–27.

> A crítica ao uso isolado do índice Kappa (atribuída a Pontius Jr. & Millones, 2011,
> *International Journal of Remote Sensing*) **ainda não foi verificada**. Não citar
> em relatório antes de confirmação bibliográfica. A decomposição Q/A empregada neste
> produto é calculável e defensável independentemente da citação.

---

**Versão do documento:** 1.0
**Última atualização:** 2026-07-23
