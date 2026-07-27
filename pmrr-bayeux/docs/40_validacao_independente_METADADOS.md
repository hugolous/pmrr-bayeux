# PMRR Bayeux/PB — Validação Independente de Acurácia (produto `Uso_cobertura_RF_v5`)

**Script:** `40_validacao_independente` (v1.1)
**Produto validado:** `Uso_cobertura_RF_v5` (classificação supervisionada de uso e cobertura)
**Fotointerpretação:** Paulo (estagiário) — 250 pontos, 5 sessões
**Responsável técnico:** Uendry da Silva Ramos Maia — Geoprocessamento e Dados
**Coordenação:** Prof. Dr. Saulo Roberto de Oliveira Vital — LAGERISCO/GENAT, UFPB
**Financiamento:** Ministério das Cidades

> **Este é o número oficial de acurácia do mapa de uso e cobertura.** Todas as demais
> métricas produzidas anteriormente (validação interna auditada e não auditada) eram
> diagnósticos de desenvolvimento. Esta é a única acurácia que deve ser reportada como
> qualidade do produto.

---

## 1. Resultado principal

| Métrica | Valor |
|---|---|
| **Acurácia global (ponderada por área)** | **0,728** |
| Erro-padrão | 0,0233 |
| **Intervalo de confiança 95%** | **0,683 – 0,774** |
| Kappa | 0,628 |
| Pontos sorteados | 250 |
| Pontos válidos (após exclusão de incertos) | 215 |
| Pontos marcados como incertos | 35 (14,0%) |

**Interpretação:** para uma classificação de uso e cobertura em resolução de 10 m, em
área urbana e periurbana heterogênea, com validação por amostragem probabilística
independente e fotointerpretação cega, uma acurácia global de 72,8% é um resultado
consistente e defensável. Não é comparável — e é estruturalmente inferior — às acurácias
de validação interna (0,987), porque estas foram medidas sobre as próprias amostras de
treinamento, em áreas espectralmente homogêneas. A diferença entre os dois números é
exatamente a razão de existir a validação independente.

---

## 2. Método

### 2.1 Desenho amostral

| Parâmetro | Valor |
|---|---|
| Tipo de amostragem | Aleatória estratificada |
| Estratos | As 5 classes do mapa |
| Alocação | Igual — 50 pontos por classe |
| Total | 250 pontos |
| Semente | 2026 (independente da semente do script `30_`) |
| Exclusão | Polígonos de treino + buffer de 20 m removidos da área sorteável |
| Referência | Fotointerpretação cega sobre imagem de alta resolução + Sentinel-2 |
| Estimador | Estratificado ponderado por área (Olofsson et al., 2014) |

### 2.2 Por que estratificar pelas classes do mapa

A alocação igual (50/classe) garante amostra suficiente até nas classes raras (água,
solo), que numa amostragem simples receberiam poucos pontos. Como as classes ocupam
áreas diferentes, a acurácia global **precisa** ser ponderada pela área de cada classe —
caso contrário, classes pequenas teriam peso desproporcional. O estimador de Olofsson
faz essa correção e é o padrão internacional para avaliação de acurácia e estimativa de
área.

### 2.3 Fotointerpretação cega

O fotointérprete (Paulo) não teve acesso à classe atribuída pelo mapa a nenhum ponto. O
sistema mantém dois arquivos de pontos: um com a classe do mapa
(`amostras/valid_pontos_v5`, restrito) e um sem (`amostras/valid_pontos_cego_v5`, usado
na interface). Isso elimina o viés de confirmação — a tendência de concordar com um
resultado já conhecido. Sem esse cuidado, a validação mediria a concordância do avaliador
consigo mesmo, não a qualidade do mapa.

### 2.4 Tratamento dos pontos incertos

Pontos onde o fotointérprete não conseguiu decidir com segurança foram marcados como
"incerto" (código 9), contabilizados e **excluídos do cálculo**. É procedimento padrão.
Um ponto honestamente incerto vale mais que um palpite, que entraria no cálculo como
informação confiável e distorceria o resultado.

---

## 3. Métricas por classe

| Classe | n | F1 | Acurácia do usuário (1−comissão) | Acurácia do produtor (1−omissão) |
|---|---|---|---|---|
| Água | 44 | **0,886** | 0,795 | 1,000 |
| **Solo exposto** | 43 | **0,409** | **0,372** | 0,454 |
| Veg. alto porte | 50 | **0,885** | 0,980 | 0,808 |
| **Veg. baixo porte** | 32 | **0,456** | **0,313** | 0,841 |
| Urbano | 46 | 0,750 | 0,913 | 0,636 |

*(Acurácias com IC 95% nos CSV exportados. n = pontos válidos por classe, após incertos.)*

### 3.1 Leitura por classe

**Água (F1 0,886)** — sólida. Acurácia do produtor de 1,000: todo ponto de água real foi
corretamente classificado. A correção do substrato úmido na v5 (exclusão da lama de maré
por critério B11) eliminou a confusão água↔mangue que existia até a v4.

**Vegetação de alto porte (F1 0,885)** — sólida. Acurácia do usuário 0,980: quase tudo
que o mapa chama de mata/mangue é de fato vegetação de alto porte. O manguezal está bem
representado.

**Urbano (F1 0,750)** — bom, com ressalva: acurácia do produtor de 0,636, ou seja, o mapa
**omite 36% do urbano real**, classificando-o como solo exposto ou vegetação. Coerente
com a baixa separabilidade Solo × Urbano (Jeffries-Matusita 0,39), consequência de a
classe solo, na v5, ter ficado restrita a superfície clara e seca — espectralmente
próxima de concreto e telhado claro.

**Solo exposto (F1 0,409) — classe crítica.** Acurácia do usuário 0,372: quando o mapa
diz "solo exposto", acerta em apenas 37% dos casos. É a classe mais fraca do produto e a
que mais demanda a coleta dirigida de amostras.

**Vegetação de baixo porte (F1 0,456) — classe crítica.** Acurácia do usuário 0,313, a
mais baixa do mapa. Confunde-se sistematicamente com solo exposto.

### 3.2 A confusão dominante: Solo exposto ↔ Vegetação de baixo porte

As duas classes de pior desempenho são o mesmo problema visto dos dois lados. Solo
exposto (usuário 0,37) e vegetação de baixo porte (usuário 0,31) estão sendo trocados um
pelo outro. Este par já era apontado como o de menor separabilidade espectral desde as
primeiras versões (JM em torno de 0,5–1,4 conforme a rodada); a validação independente,
com dado de referência cego, **confirmou empiricamente** o que o diagnóstico interno
suspeitava.

A causa provável é a composição mediana de nove meses: uma superfície descoberta em parte
do período e com cobertura herbácea rala em outra parte produz uma resposta espectral
intermediária, indistinguível de forma estável em 10 m.

---

## 4. Área ajustada por classe (resultado de maior impacto)

A área que cada classe ocupa no mapa é enviesada pelos erros de classificação. O
estimador de Olofsson corrige esse viés e fornece a área real estimada com intervalo de
confiança.

| Classe | Área do mapa (ha) | **Área ajustada (ha)** | IC 95% (± ha) | Usar no relatório |
|---|---|---|---|---|
| Água | 195,9 | 155,8 | 23,6 | ajustada |
| Solo exposto | 440,6 | 361,5 | 114,0 | ajustada |
| Veg. alto porte | 1.073,8 | **1.303,1** | 105,6 | **ajustada** |
| Veg. baixo porte | 537,1 | **199,6** | 99,3 | **ajustada** |
| Urbano | 522,6 | **750,1** | 85,2 | **ajustada** |

### 4.1 Achados críticos

**A vegetação de baixo porte é superestimada em ~2,7×.** O mapa indica 537 ha; a
estimativa corrigida é 199,6 ha. Boa parte do que o mapa chama de vegetação de baixo
porte é, na referência, outra classe (sobretudo urbano e solo).

**A mancha urbana é subestimada em ~30%.** O mapa indica 522,6 ha; a estimativa corrigida
é 750,1 ha. **Para um Plano de Redução de Riscos, esta é a correção mais relevante** — a
área urbana é onde está a população exposta, e subestimá-la subestima a exposição.

**A vegetação de alto porte é subestimada em ~21%** (1.074 → 1.303 ha), coerente com a
omissão de arborização e mangue nas bordas.

### 4.2 Regra de uso

Onde a área do mapa cai **fora** do intervalo de confiança da área ajustada, a área
ajustada é a estimativa válida. Isso ocorre em vegetação de baixo porte, urbano e
vegetação de alto porte. **A tabela de áreas do relatório do Produto 1 deve ser a
ajustada, não a do mapa.**

Observação: a soma das áreas ajustadas pode não fechar exatamente com a área total do
AOI, o que é esperado no estimador — cada classe é estimada independentemente. Ao
apresentar, indicar que são estimativas por classe com incerteza, não uma partição exata.

---

## 5. Assets e arquivos gerados

### 5.1 Assets GEE (`projects/pmrr-bayeux/assets/`)

| Asset | Conteúdo | Acesso |
|---|---|---|
| `amostras/valid_pontos_v5` | 250 pontos com a classe do mapa | **restrito** (quebra a cegueira) |
| `amostras/valid_pontos_cego_v5` | 250 pontos sem a classe do mapa | interno |
| `amostras/valid_respostas_v5` | respostas do fotointérprete (250) | interno |

### 5.2 Arquivos (Drive → `PMRR_Bayeux/`)

Prefixo: `PMRR_Bayeux_valid_oficial_v5_`

| Arquivo | Conteúdo |
|---|---|
| `resumo.csv` | acurácia global, erro-padrão, IC 95%, Kappa, n, método |
| `metricas_classe.csv` | F1, acurácia usuário/produtor, omissão, comissão, IC por classe |
| `matriz.csv` | matriz de confusão em formato longo (mapa × referência) |
| `areas_ajustadas.csv` | área do mapa, área ajustada, IC 95%, diferença por classe |

---

## 6. Limitações declaradas

1. **Vegetação de baixo porte teve 32 pontos válidos** (após incertos), o menor n entre
   as classes. Os intervalos de confiança dessa classe são, portanto, mais largos.
2. **14% de pontos incertos** é acima do usual (~5–10%). Concentram-se, provavelmente, na
   fronteira solo/vegetação de baixo porte e na franja estuarina — as mesmas zonas de
   menor separabilidade. A inspeção a posteriori dos pontos incertos deve confirmar isso e
   converter-se em evidência adicional da nota de método.
3. **O fundo de alta resolução pode ser de data distinta** do período do mapa
   (ago/2025–abr/2026). Divergências temporais claras foram tratadas como incerto.
4. **A validação mede o mapa como um todo.** Não substitui verificação de campo em áreas
   específicas de risco, que segue no escopo do trabalho de campo.

---

## 7. Consequências para o projeto

### 7.1 Classes prontas
Água e vegetação de alto porte têm desempenho sólido (F1 ~0,89). Não requerem ação
adicional.

### 7.2 Coleta dirigida de solo exposto — agora justificada por número
Com F1 de 0,409 e acurácia do usuário de 0,372, a classe solo exposto é o principal ponto
fraco do produto. A coleta dirigida de 30–40 polígonos de solo seco real (areais,
saibreiras, terraplenagens, lotes raspados), usando máscara `NDVI < 0,20 AND BSI > 0`
apenas para localizar e confirmação visual para rotular, deixa de ser recomendação e
passa a ser resposta a um resultado medido.

### 7.3 Impacto direto na álgebra de suscetibilidade à erosão
Solo exposto (peso 3 na álgebra de erosão) está com baixa acurácia e área superestimada;
a mancha urbana (também peso 3) está subestimada em ~30%. **Recomenda-se não consolidar a
nova álgebra de erosão antes de melhorar a classe solo exposto** — caso contrário, o mapa
de suscetibilidade herda esses erros nas exatas classes que mais pesam no índice.

---

## 8. Referência metodológica

Olofsson, P.; Foody, G.M.; Herold, M.; Stehman, S.V.; Woodcock, C.E.; Wulder, M.A. (2014).
Good practices for estimating area and assessing accuracy of land change. *Remote Sensing
of Environment*, v.148, p.42–57.

> A citação sobre a crítica ao uso isolado do índice Kappa (atribuída a Pontius Jr. &
> Millones, 2011, *IJRS*) permanece **não verificada** — não citar antes de confirmação.
> O Kappa é reportado aqui por praxe institucional, acompanhado de acurácia global e
> métricas por classe, nunca isolado.

---

**Versão do documento:** 1.0
**Data:** 26 de julho de 2026
