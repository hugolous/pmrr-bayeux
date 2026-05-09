# pmrr-bayeux

# PMRR Bayeux — Componente de Geoprocessamento e Dados

Repositório de scripts, documentação e dados auxiliares do
componente de Geoprocessamento e Dados do Plano Municipal de
Redução de Riscos do município de Bayeux/PB, financiado pelo
Ministério das Cidades.

## Equipe

- Coordenação acadêmica: Prof. Dr. Saulo Roberto de Oliveira Vital (UFPB)
- Componente de Geoprocessamento e Dados: Uendry Maia
- Apoio em GIS: Glauber (sobrenomes)
- Apoio em programação e infraestrutura de código: Hugo Alexsanderson dos Santos Soares

## Estrutura


pmrr-bayeux/
├── 00_config/        — parâmetros globais, AOI, datas e limiares
├── 10_extract/       — scripts GEE de coleta de fontes externas
├── 20_transform/     — scripts GEE de processamento e índices espectrais
├── 30_load/          — exports padronizados para o Banco de Dados Geográfico
├── 40_qgis/          — projetos QGIS (.qgs) e estilos (.qml)
├── 50_relatorios/    — documentos textuais por componente
├── data/
│   ├── raw/          — dados originais recebidos (NÃO EDITAR)
│   ├── interim/      — produtos intermediários de processamento
│   └── processed/    — produtos finais para o BDG
└── docs/             — documentação metodológica do projeto


## Pipeline ETL

O pipeline está organizado em três fases:

- **Extract** (10_extract): coleta de fontes — Sentinel-2, Copernicus DEM, JRC GSW, MERIT Hydro, CHIRPS, MapBiomas, Open Buildings.
- **Transform** (20_transform): processamento, índices espectrais, análise de terreno, máscaras de água multi-fonte, síntese preliminar de suscetibilidade.
- **Load** (30_load): exports padronizados para o Banco de Dados Geográfico final (.SHP, .GeoTIFF, .QGS), em SIRGAS 2000 / UTM 25S (EPSG:31985).

## Convenções técnicas

Sistema de referência, formatos preferenciais, nomenclatura de arquivos e metadados mínimos seguem o Documento-Guia Técnico Interno do projeto, disponível em `docs/`.

## Como contribuir

- Branch principal: `main`
- Trabalho em branches `feat/*`, `fix/*`, `docs/*`
- Commits em português prefixados: `feat:`, `fix:`, `docs:`, `chore:`
- Merge via Pull Request

## Contato

- Componente Geoprocessamento: uendry@gmail.com
- Coordenação: srovital@gmail.com
