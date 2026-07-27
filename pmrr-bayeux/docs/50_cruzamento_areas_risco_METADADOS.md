# PMRR Bayeux/PB — Cruzamento de Áreas de Risco (script `50_`)

**Para:** Hugo (bolsista TI — repositório, ETL e site)
**De:** Uendry da Silva Ramos Maia — Geoprocessamento e Dados
**Data:** 26 de julho de 2026

> **Resumo:** o script `50_cruzamento_areas_risco` produz o subsídio técnico usado na
> reunião do Comitê Gestor para seleção das áreas preliminares. Gera duas camadas de
> **suscetibilidade** (hidrológica e geomorfológica) e uma tabela cruzando cada área
> apontada com todos os indicadores disponíveis.
>
> **Nenhum produto deste script é um mapa de risco.** Ver seção 6 antes de publicar
> qualquer coisa no site.

---

## 1. Onde colocar no repositório

```
pmrr-bayeux/
├── 10_extract/
├── 20_transform/
│   ├── 00_config.js
│   ├── 10_pipeline_base.js
│   ├── 30_classif_supervisionada_v5.js
│   ├── 40_validacao_independente.js
│   └── 50_cruzamento_areas_risco.js        ← NOVO
├── 30_analysis/                             ← criar, se ainda não existir
│   └── (produtos derivados e notebooks de análise)
├── data/
│   └── processed/
│       └── PMRR_Bayeux_tabela_areas_prioritarias.csv   ← NOVO
├── docs/
│   ├── 30_classif_supervisionada_v5_METADADOS.md
│   ├── 40_validacao_independente_METADADOS.md
│   ├── 50_cruzamento_areas_risco_METADADOS.md          ← este documento
│   ├── MANUAL_VALIDACAO_Paulo.md
│   └── apresentacoes/
│       └── PMRR_Bayeux_ParteII_Geoprocessamento.docx   ← NOVO
└── README.md
```

**Observação sobre a pasta:** o script `50_` é de análise, não de transformação. Se
preferir criar `30_analysis/` e movê-lo para lá, faz sentido conceitualmente — mas
**mantenha a numeração no nome do arquivo**, que é o que dá a ordem de execução do
pipeline. Se optar por manter tudo em `20_transform/`, também está correto; o
importante é a consistência.

**Tag sugerida após o commit:** `v0.7`

---

## 2. O que o script faz

| Etapa | Descrição |
|---|---|
| Análise I | Classifica o HAND em 3 faixas (≤1 m, 1–4 m, >4 m) |
| Análise II | Calcula a suscetibilidade à erosão por álgebra ponderada de 4 fatores |
| Cruzamento | Para cada área apontada, calcula % em cada classe, sobreposições e exposição |
| Convergência | Conta quantas fontes independentes sinalizam cada área (0 a 4) |
| Interface | Painel de navegação por área e inspetor de clique (usado na reunião) |
| Exportação | Tabela CSV, shapefile, rasters e asset institucional |

### 2.1 Álgebra de suscetibilidade à erosão

| Fator | Peso | Pesos de classe |
|---|---|---|
| Declividade | 40% | 0–8% → 1 · 8–20% → 2 · >20% → 3 |
| Cobertura do solo | 30% | Água 1 · Solo exposto 3 · Veg. alta 1 · Veg. baixa 2 · Urbano 3 |
| Tipo de solo | 20% | Gleissolo 1 · Argissolo 3 |
| Orientação de vertente | 10% | Plano/SO/O/NO 1 · N/S 2 · SE/E/NE 3 |

Índice contínuo entre 1 e 3; cortes de classe em 1,67 e 2,33.

### 2.2 Mudança em relação à versão anterior

A primeira versão desta álgebra (executada em conta pessoal, antes da migração
institucional) usava classificação por regras como camada de cobertura. Esta versão usa
`Uso_cobertura_RF_v5`, a classificação supervisionada **com acurácia medida** (72,8%,
validação independente). Todos os caminhos de asset foram atualizados para
`projects/pmrr-bayeux/assets/`.

---

## 3. Assets e insumos

### 3.1 Entradas (todas em `projects/pmrr-bayeux/assets/`)

| Asset | Origem |
|---|---|
| `Bayeux_limites` | limite municipal |
| `Areas_apontamento_Defesa_Civil` | apontamentos de campo + subcomunidades (campo `Nome`) |
| `PMRR_HAND_Copernicus` | HAND calculado externamente sobre o MDE Copernicus |
| `Risco_CPRM_Bayeux` | polígonos de tipologia (campo `TIPOLO_G1`) |
| `Area_Vulneravel_Inundacao` | mancha de inundação da Prefeitura |
| `Quadras_SIRGAS` | malha cadastral |
| `base/Terreno` | declividade e orientação de vertente |
| `base/Uso_cobertura_RF_v5` | classificação supervisionada validada |
| `pedo_area_mu_2501807` | pedologia (campo `ordem`) |

### 3.2 Saídas

| Saída | Destino |
|---|---|
| `base/Suscet_erosao_v2` | asset GEE (índice contínuo + classe) |
| `PMRR_Bayeux_suscet_erosao_v2.tif` | Drive |
| `PMRR_Bayeux_hand_classes.tif` | Drive |
| `PMRR_Bayeux_tabela_areas_prioritarias.csv` | Drive → `data/processed/` |
| `PMRR_Bayeux_areas_com_indicadores.shp` | Drive |

---

## 4. Nota de proveniência — HAND

O HAND **não foi calculado no Google Earth Engine.** A plataforma não dispõe de função
nativa de acumulação de fluxo, necessária ao cálculo. O processamento foi feito
externamente por Sara, a partir do mesmo Modelo Digital de Elevação Copernicus utilizado
no restante do pipeline, e o resultado foi ingerido como asset institucional.

Isso **não quebra a reprodutibilidade do pipeline**, desde que registrados os parâmetros
do processamento externo. Campos a completar:

| Item | Valor |
|---|---|
| Software e versão | *a preencher* |
| Limiar de acumulação de fluxo | *a preencher* |
| Condicionamento (fill sinks) | *a preencher* |
| MDE de entrada | Copernicus DEM (asset do pipeline) |
| CRS de saída | EPSG:31985 |

> **Pendência para Hugo registrar:** sem o limiar de acumulação declarado, o HAND não é
> reproduzível por terceiros. Solicitar esses parâmetros antes de fechar a documentação.

---

## 5. Limitações a declarar sempre que o produto for citado

1. **Suscetibilidade não é risco.** Risco exige exposição e vulnerabilidade, e o grau
   R1–R4 só se define em vistoria de campo.
2. **O HAND representa cheia fluvial.** Não capta alagamento pluvial (drenagem urbana
   insuficiente) nem influência de maré — ambos relevantes em Bayeux.
3. **"Baixa suscetibilidade à erosão" não significa "área segura".** Significa que aquele
   processo específico não é o problema naquele local. Em planície o índice satura em
   Baixa por construção, já que a declividade responde por 40% do peso.
4. **A exposição usa a malha cadastral, não a classificação.** A validação independente
   indicou subestimação de ~30% da mancha urbana no mapa de cobertura.
5. **Os pesos da álgebra são convenção técnica**, baseados na literatura e passíveis de
   ajuste.
6. **Resolução de 10 m** — adequada para priorizar vistorias, não para levantamento por
   moradia.

---

## 6. Orientações para o site

### 6.1 O que NÃO publicar

- **Não rotular nenhuma camada como "mapa de risco"** ou "áreas de risco". Os termos
  corretos são "suscetibilidade hidrológica" e "suscetibilidade geomorfológica".
- **Não publicar o índice de convergência como ranking de gravidade.** É contagem de
  fontes, não hierarquia de risco.
- **Não publicar as áreas preliminares antes da deliberação do Comitê Gestor.** A
  definição é do Comitê, não da equipe técnica.

### 6.2 O que pode ser publicado

- As duas camadas de suscetibilidade, com legenda e nota metodológica visível.
- A tabela de indicadores por área, desde que acompanhada das limitações da seção 5.

### 6.3 Lembretes técnicos

- **Reprojetar para EPSG:4326 antes de gerar GeoJSON.** Os produtos estão em EPSG:31985;
  o Leaflet opera em WGS 84.
- Os shapefiles exportados por `Export.table.toDrive` já saem em EPSG:4326 — os rasters,
  não.
- **Nomes de campo do shapefile foram encurtados para 10 caracteres** (limite do formato
  DBF). Correspondência: `converg` = convergência · `hand_alta` = % em HAND crítico ·
  `eros_am` = % em erosão alta+média · `quadras_pc` = % de área em quadra cadastrada.
- Paleta das camadas de suscetibilidade: HAND `#f7f7f7 · #74add1 · #313695` ·
  Erosão `#1a9850 · #fee08b · #d73027` (baixa → média → alta em ambas).

---

## 7. Checklist

- [ ] Versionar `50_cruzamento_areas_risco.js`
- [ ] Registrar este documento em `docs/`
- [ ] Arquivar `PMRR_Bayeux_ParteII_Geoprocessamento.docx` em `docs/apresentacoes/`
- [ ] Publicar `tabela_areas_prioritarias.csv` em `data/processed/`
- [ ] Registrar `base/Suscet_erosao_v2` no índice de assets
- [ ] Completar a nota de proveniência do HAND (seção 4)
- [ ] Conferir que nenhuma camada está rotulada como "risco" no site
- [ ] Tag `v0.7`

---

**Versão do documento:** 1.0
**Data:** 26 de julho de 2026
