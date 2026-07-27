# PMRR Bayeux/PB — Classificação Supervisionada de Uso e Cobertura do Solo (v5.0 — DEFINITIVA)

**Produto:** `Uso_cobertura_RF_v5`
**Script:** `30_classif_supervisionada` (v5.0)
**Responsável técnico:** Uendry da Silva Ramos Maia — Geoprocessamento e Dados
**Coleta de amostras:** Glauber (bolsista GIS/QGIS)
**Validação independente:** Paulo (estagiário) — script `40_validacao_independente`, a produzir
**Repositório/ETL/site:** Hugo (bolsista TI)
**Coordenação:** Prof. Dr. Saulo Roberto de Oliveira Vital — LAGERISCO/GENAT, UFPB
**Financiamento:** Ministério das Cidades

> **Status:** produto final da etapa de classificação. Substitui a v4.0.
> A acurácia **oficial** ainda depende da validação independente (Paulo). Ver seção 8.

---

## 0. O que mudou da v4.0 para a v5.0

A auditoria de rotulagem da classe **Solo exposto** passou a usar **dois** critérios em
vez de um:

| | v4.0 | v5.0 |
|---|---|---|
| Critério de solo exposto | `NDVI < 0,25` | `NDVI < 0,25` **E** `B11 > 0,30` |

**Motivo:** um polígono de solo exposto (`uid 2_00000000000000000000`) era, na verdade,
**lama de maré úmida** do estuário Paraíba–Sanhauá. Substrato úmido tem NDVI baixo (sem
clorofila) mas **SWIR baixo** (água intersticial), então passava no filtro de NDVI e era
confundido com água na classificação — gerando 13 pixels de "solo → água" na validação
da v4.

O limiar `B11 > 0,30` foi fixado no **ponto médio de uma descontinuidade natural**: não
existe nenhuma amostra de solo com B11 entre 0,20 e 0,35. O corte, portanto, não é
arbitrário — separa dois grupos fisicamente distintos (substrato úmido × solo seco).

**Resultado da correção:**

| Sinal | v4.0 | v5.0 |
|---|---|---|
| Solo → Água (matriz auditada) | 13 px | **0** |
| UA da Água | 0,822 | **1,000** |
| F1 da Água | 0,902 | **1,000** |
| Macro-F1 auditado | 0,941 | **0,987** |
| Macro-F1 não auditado | 0,804 | **0,819** |
| Kappa não auditado | 0,781 | **0,792** |

**Efeito colateral declarado:** ao restringir a classe a solo claro e seco, a
separabilidade Solo × Urbano caiu (JM 0,39) e a zona de dúvida subiu para ~17,8%. A
planície de maré passou a ser mapeada como **Água** (não como solo). Ver seções 5.2, 5.5
e 8.

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

Codificação **fixa**, compartilhada com os demais produtos (inclusive a álgebra de
suscetibilidade à erosão). Não renumerar.

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
camada de cobertura e a camada de relevo na álgebra de suscetibilidade à erosão.

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

### 4.1 Auditoria de rotulagem

Confronto da assinatura espectral média de cada polígono com a definição operacional da
classe. Polígonos que contradizem o próprio rótulo saem do treino e vão para asset/SHP.

| Limiar | Valor |
|---|---|
| `NDVI_AGUA_MAX` | 0,20 |
| `NDVI_SOLO_MAX` | 0,25 |
| **`B11_SOLO_MIN`** | **0,30** ← novo na v5 |
| `NDVI_VEGALTA_MIN` | 0,55 |
| `NDVI_VEGBAIXA_MIN` | 0,25 |
| `NDVI_VEGBAIXA_MAX` | 0,85 |
| `B8_URBANO_MAX` | 0,45 |

**Resultado:**

| Classe | Original | Aprovado | Rejeitado |
|---|---|---|---|
| Água | 53 | 50 | 3 |
| **Solo exposto** | **67** | **10** | **57** |
| Veg. alto porte | 100 | 100 | 0 |
| Veg. baixo porte | 40 | 40 | 0 |
| Urbano | 103 | 100 | 3 |

### 4.2 Partição

Separação **por polígono** (70/30), nunca por pixel.

| Classe | Pol. treino | Pol. validação |
|---|---|---|
| Água | 31 | 19 |
| Solo exposto | 6 | 4 |
| Veg. alto porte | 67 | 33 |
| Veg. baixo porte | 28 | 12 |
| Urbano | 80 | 20 |

Amostragem estratificada balanceada: 100 px/classe (treino), 60 px/classe (validação).

### 4.3 Subclasses espectrais

k-means intraclasse, remapeado para a legenda oficial (`classe = floor(codigo/10)`).

| Classe | k | Nota |
|---|---|---|
| 1 Água | 2 | turva / escura |
| 2 Solo exposto | 1 | amostra pequena |
| 3 Veg. alto porte | 1 | subclasses eram idênticas |
| 4 Veg. baixo porte | **1** | corrigido na v5 (2ª subclasse degenerava em ~13 px) |
| 5 Urbano | 2 | denso / esparso |

### 4.4 Classificador

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
| NDWI | 12,50 | | B11 | 7,32 |
| B8 | 11,00 | | NDRE | 7,21 |
| NDVI | 10,51 | | B3 | 6,48 |
| BSI | 8,50 | | B12 | 6,17 |
| MNDWI | 7,83 | | B2 | 5,36 |
| NDBI | 7,37 | | B4 | 5,10 |
| | | | B5 | 4,65 |

Uniforme seria 7,69%. Hierarquia fisicamente coerente: NDWI lidera a água, BSI figura
alto (solo exposto real presente no treino após a auditoria).

### 5.2 Separabilidade Jeffries-Matusita

| Par | JM média | JM melhor banda |
|---|---|---|
| **Solo exposto × Urbano** | **0,392** | **0,909** |
| Veg. baixo porte × Urbano | 1,246 | 1,945 |
| Solo exposto × Veg. baixo porte | 1,399 | 1,990 |
| Água × Urbano | 1,666 | 2,000 |
| Veg. alto porte × Veg. baixo porte | 1,725 | 1,999 |
| Água × Veg. alto porte | 1,727 | 2,000 |
| Veg. alto porte × Urbano | 1,737 | 2,000 |
| Água × Veg. baixo porte | 1,740 | 2,000 |
| Solo exposto × Veg. alto porte | 1,822 | 2,000 |
| Água × Solo exposto | 1,864 | 2,000 |

**Ponto frágil:** Solo × Urbano. Nenhuma banda isolada separa o par (melhor = 0,909).
A discriminação depende da combinação multivariada e é o principal foco da validação
independente e da coleta dirigida.

### 5.3 Validação interna

| Métrica | Auditada (circular) | Não auditada (honesta) |
|---|---|---|
| N amostral | 300 | 600 |
| Acurácia global | 0,9867 | **0,8333** |
| IC 95% | ±0,0130 | ±0,0298 |
| Kappa | 0,9833 | **0,7917** |
| Macro-F1 | 0,9867 | **0,8195** |
| Desacordo de quantidade (Q) | 0,0067 | 0,1400 |
| Desacordo de alocação (A) | 0,0067 | 0,0267 |

**Auditada** — treino e validação passaram pelo mesmo filtro. É **circular**: limite
superior de desempenho, não acurácia do mapa.

**Não auditada** — validação sobre todos os polígonos originais fora do treino,
inclusive os reprovados. Estimativa mais próxima da realidade.

#### Métricas por classe — validação auditada

| Classe | PA | UA | F1 |
|---|---|---|---|
| Água | 1,000 | 1,000 | 1,000 |
| Solo exposto | 0,983 | 0,952 | 0,967 |
| Veg. alto porte | 1,000 | 1,000 | 1,000 |
| Veg. baixo porte | 0,983 | 1,000 | 0,992 |
| Urbano | 0,967 | 0,983 | 0,975 |

#### Métricas por classe — validação não auditada

| Classe | PA | UA | F1 |
|---|---|---|---|
| Água | 0,908 | 1,000 | 0,952 |
| **Solo exposto** | **0,358** | **0,782** | **0,491** |
| Veg. alto porte | 1,000 | 0,916 | 0,956 |
| Veg. baixo porte | 1,000 | 0,622 | 0,767 |
| Urbano | 0,900 | 0,964 | 0,931 |

Leitura da classe 2: PA baixa (0,358) com UA razoável (0,782) — o mapa **subdeclara**
solo exposto, mas em geral acerta quando declara. Os pixels omitidos são os polígonos
reprovados na auditoria (73 caem como veg. baixa).

### 5.4 Áreas por classe (execução semente 42)

| Classe | Área (ha) | % do AOI |
|---|---|---|
| Água | 195,87 | 7,07 |
| Solo exposto | 440,55 | 15,90 |
| Veg. alto porte | 1.073,85 | 38,77 |
| Veg. baixo porte | 537,09 | 19,39 |
| Urbano | 522,65 | 18,87 |
| **Total AOI** | **2.770,01** | 100 |

> **Barra de erro:** o teste de estabilidade por semente da v4.0 (mesmas amostras, mesmo
> pipeline) registrou CV abaixo de 5,2% em todas as classes. Se `RODAR_ESTABILIDADE` for
> ligado na v5, ele gera a dispersão específica desta versão. **Recomendação:** rodar o
> teste na v5 antes de fechar os números do relatório, e reportar média ± desvio.
> Enquanto isso, a ordem de grandeza da incerteza (< 5,2%) é herdada da v4 e citada como
> tal.

### 5.5 Incerteza espacial

| Métrica | v4.0 | v5.0 |
|---|---|---|
| Área em zona de dúvida (margem < 0,20) | 365,0 ha (13,2%) | **493,4 ha (17,8%)** |

O aumento decorre da definição mais estreita de solo exposto após a v5: com 6 polígonos
de treino, "meio-solo" passa a votar dividido. As zonas concentram-se na fronteira
Solo × Urbano e na franja estuarina.

Confiança média por classe:

| Classe | Confiança |
|---|---|
| Veg. alto porte | 0,739 |
| Água | 0,698 |
| Urbano | 0,682 |
| Veg. baixo porte | 0,676 |
| **Solo exposto** | **0,549** |

### 5.6 Conferência com camadas da Prefeitura

| Referência | Área (ha) | Classe do mapa | Área (ha) | Razão |
|---|---|---|---|---|
| `Hidrografia_2013_SIRGAS` | 314,18 | 1 Água | 195,87 | 62% |
| `Quadras_SIRGAS` | 660,95 | 5 Urbano | 522,65 | 79% |
| `Malha_Urbana_SIRGAS2000` | 710,79 | 5 Urbano | 522,65 | 74% |

Na v5 a água (195,87 ha) aproximou-se mais da hidrografia de referência que na v4
(174,07 ha), porque a lama de maré migrou para a classe água — coerente com a delimitação
de calha da hidrografia vetorizada. Divergências residuais explicadas por: assoreamento
desde 2013, escala de vetorização, e composição da quadra (unidade cadastral, não
superfície impermeabilizada). Verificação pendente: cruzamento espacial classe × quadras.

---

## 6. Assets e arquivos gerados

### 6.1 Assets GEE (`projects/pmrr-bayeux/assets/`)

| Asset | Conteúdo |
|---|---|
| `base/Uso_cobertura_RF_v5` | **Produto principal** — raster 5 classes, 10 m, EPSG:31985 |
| `amostras/auditados_v5` | 300 polígonos aprovados — **congelado** (reprodutibilidade) |
| `amostras/rejeitados_v5` | polígonos reprovados — revisão do Glauber |
| `amostras/split_treino_v5` | Polígonos de treino — **excluir no sorteio do `40_`** |
| `amostras/split_validacao_v5` | Polígonos de validação interna |

> Os assets `_v4` **não** foram sobrescritos — permanecem para rastreabilidade histórica.

### 6.2 Rasters (Drive → `PMRR_Bayeux/`)

| Arquivo | Conteúdo |
|---|---|
| `PMRR_Bayeux_classif_RFv5_classes.tif` | Classificação final (1–5) |
| `PMRR_Bayeux_classif_RFv5_subclasses.tif` | Subclasses (diagnóstico) |
| `PMRR_Bayeux_classif_RFv5_confianca.tif` | 2 bandas: `confianca`, `margem` |

### 6.3 Tabelas (CSV, Drive → `PMRR_Bayeux/`)

Prefixo: `PMRR_Bayeux_classif_RFv5_` · Sufixos: `resumo_metadados`, `matriz_auditada`,
`matriz_nao_auditada`, `metricas_classe_auditada`, `metricas_classe_nao_auditada`,
`areas`, `auditoria`, `importancia`, `separabilidade_JM`, `assinaturas`,
`assinatura_subclasses`, `confianca_classe`, `poligonos_rejeitados` (SHP),
`solo_aprovado` (SHP). Com estabilidade ligada: `estabilidade_sementes`,
`estabilidade_dispersao`.

---

## 7. Reprodutibilidade

1. `MODO_AUDITORIA = 'asset'`, `VERSAO = 'v5'` (lê `amostras/auditados_v5`)
2. `SEED = 42`, `N_PIX_TREINO = 100`, `N_PIX_VALID = 60`
3. `USAR_FREQ = false`, `APLICAR_MODA = false`
4. `K_SUB = {1:2, 2:1, 3:1, 4:1, 5:2}`
5. `B11_SOLO_MIN = 0.30`

> Rodar com `MODO_AUDITORIA = 'calcular'` gera novo `system:index` e altera o sorteio.
> Para qualquer número de relatório, **use o asset congelado**.

---

## 8. Limitações metodológicas (declarar sempre)

1. **A acurácia oficial ainda não foi estimada** (depende do `40_`, Paulo).
2. **A validação auditada é circular** — limite superior, não acurácia.
3. **O OOB não é acurácia do mapa** (bootstrap por pixel; autocorrelação intra-polígono).
   Valor registrado: 0,0218.
4. **Solo exposto repousa sobre 10 polígonos** (6 de treino, 4 de validação). Amostra
   pequena; a coleta dirigida é a próxima prioridade.
5. **Solo exposto × Urbano com JM 0,392** e melhor banda 0,909: nenhuma banda separa o
   par sozinha.
6. **A planície de maré está mapeada como Água**, não como solo. Consequência deliberada
   do critério B11: substrato úmido é ambiente deposicional, não fonte de erosão.
7. **"Alto/baixo porte" é inferência espectral**, não medição de altura.
8. **Os limiares da auditoria são convencionais.** `B11_SOLO_MIN = 0,30` está no vazio da
   distribuição (defensável); os de NDVI vêm do `classificacao_regras.js`.
9. **Zona de dúvida de 17,8%** representa alvos genuinamente mistos (fronteira
   solo/urbano e franja estuarina), não falha do classificador.
10. **Sem estimador ponderado por área** — a amostragem balanceada exige, no `40_`,
    estimador estratificado ponderado pela proporção de cada classe no mapa.
11. **Área com barra de erro:** o teste de estabilidade não foi rodado nesta versão
    específica; a incerteza < 5,2% é herdada da v4. Rodar na v5 antes de fechar o relatório.

### Nota de método sobre a zona estuarina (para o relatório)

> A zona estuarina Paraíba–Sanhauá concentra alvos de resposta espectral ambígua em
> composição mediana: manguezal com alto teor de água foliar, lâmina d'água de baixa
> reflectância e planície de maré exposta apresentam sobreposição parcial no infravermelho
> de ondas curtas. A delimitação entre substrato exposto e superfície d'água nessa faixa
> depende da fase de maré no momento de cada aquisição, sendo intrinsecamente indeterminada
> em produto derivado de agregação temporal. Optou-se por excluir o substrato úmido da
> classe solo exposto (critério B11 > 0,30), coerente com a finalidade do produto na
> análise de suscetibilidade à erosão, uma vez que a planície de maré constitui ambiente
> deposicional e não fonte de sedimento erodido.

---

## 9. Pendências

### 9.1 Equipe técnica (Uendry / Caio)

- [ ] Rodar o teste de estabilidade na v5 (`RODAR_ESTABILIDADE = true`) e registrar
      média ± desvio das áreas
- [ ] Validar a definição de solo exposto (NDVI < 0,25 **e** B11 > 0,30) para a álgebra
      de erosão
- [ ] Revisar os pesos de classe da álgebra diante das novas áreas
- [ ] Discutir com Claude o desenho do script `40_` (próxima sessão)

### 9.2 Glauber — coleta dirigida (próxima prioridade)

- [ ] 30–40 polígonos de solo exposto **seco real** (areais, saibreiras, terraplenagens,
      lotes raspados), com máscara `NDVI < 0,20 AND BSI > 0` só para localizar e
      confirmação visual sobre imagem de alta resolução para rotular
- [ ] Revisar o SHP `poligonos_rejeitados`

### 9.3 Paulo — validação independente (`40_validacao_independente`, a desenhar)

- [ ] ~250 pontos aleatórios estratificados (50/classe), fotointerpretados
- [ ] **Excluir do sorteio os polígonos de `amostras/split_treino_v5`**
- [ ] **Não aplicar filtro espectral no sorteio**
- [ ] Priorizar as zonas de dúvida (margem < 0,20)
- [ ] Aplicar estimador estratificado ponderado por área
- [ ] Matriz de confusão, acurácia global, Kappa, IC 95%

### 9.4 Hugo — repositório e site

- [ ] Versionar `30_classif_supervisionada_v5.js` em `20_transform/`
- [ ] Arquivar `30_classif_supervisionada_v4.js` como histórico (não é o produto ativo)
- [ ] Registrar este `.md` em `docs/`
- [ ] Registrar os `assetId` no índice de produtos (rasters ficam no Drive/asset GEE)
- [ ] **Reprojetar para EPSG:4326 antes de gerar o GeoJSON do site** (Leaflet = WGS 84;
      produtos em EPSG:31985)
- [ ] Vetorizar e simplificar geometrias (raster de 10 m gera GeoJSON pesado)
- [ ] Painel de estatísticas usando média ± desvio (após o teste de estabilidade)
- [ ] Tag sugerida: `v0.5`

---

## 10. Referências verificadas

- Belgiu, M.; Drăguţ, L. (2016). Random forest in remote sensing: a review of
  applications and future directions. *ISPRS Journal of Photogrammetry and Remote
  Sensing*, v. 114, p. 24–31.
- Olofsson, P.; Foody, G. M.; Herold, M.; Stehman, S. V.; Woodcock, C. E.;
  Wulder, M. A. (2014). Good practices for estimating area and assessing accuracy
  of land change. *Remote Sensing of Environment*, v. 148, p. 42–57.
- Gorelick, N. et al. (2017). Google Earth Engine: planetary-scale geospatial analysis
  for everyone. *Remote Sensing of Environment*, v. 202, p. 18–27.

> A crítica ao uso isolado do índice Kappa (atribuída a Pontius Jr. & Millones, 2011,
> *IJRS*) **ainda não foi verificada**. Não citar antes de confirmação. A decomposição
> Q/A é calculável e defensável independentemente da citação.

---

**Versão do documento:** 1.0
**Última atualização:** 2026-07-24
