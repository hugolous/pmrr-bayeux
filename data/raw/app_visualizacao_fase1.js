var P = 'projects/pmrr-bayeux/assets/';

// ===== PALETAS =====
var palClassif = ['#1f78b4','#d9a441','#1a6634','#a6d96a','#cc2a36'];
var palSuscet  = ['#1a9850','#fee08b','#d73027'];
var palRelevo  = ['#2c7bb6','#abd9e9','#ffffbf','#fdae61','#d7191c'];
var palDecliv  = ['#1a9850','#a6d96a','#fee08b','#f46d43','#a50026'];
var palAspecto = ['#ff0000','#ffaa00','#aaff00','#00ffaa','#00aaff','#aa00ff','#ff00aa','#ff0000'];

// ===== HELPERS =====
function vlayer(id, cor, larg, fill, nome, on){
  return ui.Map.Layer(
    ee.FeatureCollection(P+id).style({color:cor, width:larg, fillColor:fill||'00000000'}),
    {}, nome, on||false);
}
function rlayer(id, banda, vis, nome, on){
  var img = ee.Image(P+id);
  if (banda) img = img.select(banda);
  return ui.Map.Layer(img, vis, nome, on||false);
}

// limite municipal — sempre presente por cima
var layerLimite = ui.Map.Layer(
  ee.FeatureCollection(P+'Bayeux_limites').style({color:'yellow', width:3, fillColor:'00000000'}),
  {}, 'Limite municipal', true);

// ===== GRUPOS TEMÁTICOS =====
// cada camada: {layer, on, leg:[{cor,txt}]}
var GRUPOS = [
  {
    nome: '1. Risco e priorização',
    camadas: [
      {layer: rlayer('bayeux_suscet_erosao','b2',{min:1,max:3,palette:palSuscet},'Suscetibilidade erosão',true), on:true,
       leg:[{cor:'#1a9850',txt:'Suscet. Baixa'},{cor:'#fee08b',txt:'Suscet. Média'},{cor:'#d73027',txt:'Suscet. Alta'}]},
      {layer: vlayer('Risco_CPRM_Bayeux','cc0000',2,'cc000055','Setores risco CPRM',true), on:true,
       leg:[{cor:'#cc0000',txt:'Setores risco CPRM'}]},
      {layer: vlayer('bayeux_setores_priorizados_1','ff6600',2,'ff660055','Setores priorizados',true), on:true,
       leg:[{cor:'#ff6600',txt:'Setores priorizados (Fase 1)'}]},
      {layer: vlayer('Area_Vulneravel_Inundacao','00b0f0',1,'00b0f055','Inundação',true), on:true,
       leg:[{cor:'#00b0f0',txt:'Inundação (Prefeitura)'}]},
      {layer: vlayer('Area_Vulneravel_Inundacao_100m','0070c0',1,'0070c033','Inundação buffer 100m',false), on:false,
       leg:[{cor:'#0070c0',txt:'Inundação buffer 100m'}]},
      {layer: vlayer('Suscetibilidade_1','7030a0',1,'7030a044','Suscetibilidade (vetor)',false), on:false,
       leg:[{cor:'#7030a0',txt:'Suscetibilidade (vetor)'}]},
      {layer: vlayer('IVS_Bayeux','d35400',1,'d3540044','IVS vulnerabilidade',false), on:false,
       leg:[{cor:'#d35400',txt:'IVS — vulnerabilidade (hidro)'}]}
    ]
  },
  {
    nome: '2. Produtos — uso e terreno',
    camadas: [
      {layer: rlayer('bayeux_classificacao_regras',null,{min:1,max:5,palette:palClassif},'Uso e cobertura',true), on:true,
       leg:[{cor:'#1f78b4',txt:'Água'},{cor:'#d9a441',txt:'Solo exposto'},{cor:'#1a6634',txt:'Veg. alto porte'},{cor:'#a6d96a',txt:'Veg. baixo porte'},{cor:'#cc2a36',txt:'Urbano'}]},
      {layer: rlayer('bayeux_relevo',null,{min:0,max:60,palette:palRelevo},'Relevo (m)',false), on:false,
       leg:[{cor:'#2c7bb6',txt:'Relevo: baixo'},{cor:'#ffffbf',txt:'Relevo: médio'},{cor:'#d7191c',txt:'Relevo: alto'}]},
      {layer: rlayer('bayeux_declividade_pct',null,{min:0,max:45,palette:palDecliv},'Declividade (%)',false), on:false,
       leg:[{cor:'#1a9850',txt:'Declив.: baixa'},{cor:'#fee08b',txt:'Declив.: média'},{cor:'#a50026',txt:'Declив.: alta'}]},
      {layer: rlayer('bayeux_aspecto',null,{min:0,max:360,palette:palAspecto},'Aspecto (vertentes)',false), on:false,
       leg:[{cor:'#ff0000',txt:'Vertentes (orientação 0–360°)'}]}
    ]
  },
  {
    nome: '3. Limites e divisões',
    camadas: [
      {layer: vlayer('Limite_de_Bairros_SIRGAS2000','ffff00',2,'00000000','Limite de bairros',true), on:true,
       leg:[{cor:'#ffff00',txt:'Limite de bairros'}]},
      {layer: vlayer('Malha_Urbana_SIRGAS2000','ffffff',1,'ffffff22','Malha urbana',true), on:true,
       leg:[{cor:'#ffffff',txt:'Malha urbana'}]},
      {layer: vlayer('Quadras_SIRGAS','cccccc',1,'00000000','Quadras',false), on:false,
       leg:[{cor:'#cccccc',txt:'Quadras'}]},
      {layer: vlayer('Zoneamento_2022','9b59b6',1,'9b59b633','Zoneamento 2022',false), on:false,
       leg:[{cor:'#9b59b6',txt:'Zoneamento 2022'}]},
      {layer: vlayer('COMUNIDADES_TR_SIRGAS2000','e74c3c',1,'e74c3c33','Comunidades',true), on:true,
       leg:[{cor:'#e74c3c',txt:'Comunidades'}]},
      {layer: vlayer('Subcomunidades_SIRGAS2000','c0392b',1,'c0392b33','Subcomunidades',false), on:false,
       leg:[{cor:'#c0392b',txt:'Subcomunidades'}]},
      {layer: vlayer('Setores_censitarios_com_renda','999999',1,'99999922','Setores censitários (renda)',false), on:false,
       leg:[{cor:'#999999',txt:'Setores censitários (renda)'}]}
    ]
  },
  {
    nome: '4. Hidrografia, vegetação e APPs',
    camadas: [
      {layer: vlayer('Hidrografia_2013_SIRGAS','00ffff',1,'00000000','Hidrografia 2013',true), on:true,
       leg:[{cor:'#00ffff',txt:'Hidrografia 2013'}]},
      {layer: vlayer('APP_Maguezal','27ae60',1,'27ae6044','APP Manguezal',true), on:true,
       leg:[{cor:'#27ae60',txt:'APP Manguezal'}]},
      {layer: vlayer('APP_Lei_de_Bairros_SIRGAS','229954',1,'22995444','APP Lei de Bairros',false), on:false,
       leg:[{cor:'#229954',txt:'APP Lei de Bairros'}]},
      {layer: vlayer('Area_Mangue_Casa_Branca_SIRGAS','16a085',1,'16a08544','Mangue Casa Branca',false), on:false,
       leg:[{cor:'#16a085',txt:'Mangue Casa Branca'}]},
      {layer: vlayer('Vegetacao_SIRGAS','52be80',1,'52be8044','Vegetação',false), on:false,
       leg:[{cor:'#52be80',txt:'Vegetação (Prefeitura)'}]}
    ]
  },
  {
    nome: '5. Infraestrutura e saneamento',
    camadas: [
      {layer: vlayer('Valas_e_Drenos_SIRGAS','3498db',1,'00000000','Valas e drenos',true), on:true,
       leg:[{cor:'#3498db',txt:'Valas e drenos'}]},
      {layer: vlayer('Galerias','2980b9',1,'00000000','Galerias',true), on:true,
       leg:[{cor:'#2980b9',txt:'Galerias'}]},
      {layer: vlayer('Esgotamento_SIRGAS2000','8e44ad',1,'00000000','Esgotamento',false), on:false,
       leg:[{cor:'#8e44ad',txt:'Esgotamento'}]},
      {layer: vlayer('Bacia_Esgotamento_Executado_SIRGAS','6c3483',1,'6c348322','Bacia esgotamento',false), on:false,
       leg:[{cor:'#6c3483',txt:'Bacia esgotamento executado'}]},
      {layer: vlayer('Unidades_Habitacionais_CEHAP','f39c12',1,'f39c1244','Habitação CEHAP',false), on:false,
       leg:[{cor:'#f39c12',txt:'Unidades habitacionais CEHAP'}]},
      {layer: vlayer('Dist_Alimentos_SIRGAS','e67e22',2,'00000000','Distrib. alimentos',false), on:false,
       leg:[{cor:'#e67e22',txt:'Distribuição de alimentos'}]}
    ]
  },
  {
    nome: '6. Casa Branca (estudo de caso)',
    camadas: [
      {layer: vlayer('Limite_Comunidade_Casa_Branca_SIRGAS','ff0066',2,'00000000','CB — limite',true), on:true,
       leg:[{cor:'#ff0066',txt:'Limite da comunidade'}]},
      {layer: vlayer('Casas_casa_Branca_SIRGAS','ff3399',1,'ff339944','CB — casas',true), on:true,
       leg:[{cor:'#ff3399',txt:'Casas'}]},
      {layer: vlayer('Area_Residencial_Casa_Branca_SIRGAS','ff66b2',1,'ff66b244','CB — área residencial',false), on:false,
       leg:[{cor:'#ff66b2',txt:'Área residencial'}]},
      {layer: vlayer('Area_CEHAP_Mario_Andreazza','cc0066',1,'cc006644','CB — Mário Andreazza 1',false), on:false,
       leg:[{cor:'#cc0066',txt:'CEHAP Mário Andreazza 1'}]},
      {layer: vlayer('Area_CEHAP_Mario_Andreazza_2','b30059',1,'b3005944','CB — Mário Andreazza 2',false), on:false,
       leg:[{cor:'#b30059',txt:'CEHAP Mário Andreazza 2'}]}
    ]
  },
  {
    nome: '7. Meio físico (BDiA/IBGE)',
    camadas: [
      {layer: vlayer('geol_area_mu_2501807','a0522d',1,'a0522d44','Geologia',true), on:true,
       leg:[{cor:'#a0522d',txt:'Geologia'}]},
      {layer: vlayer('geom_area_mu_2501807','cd853f',1,'cd853f44','Geomorfologia (área)',true), on:true,
       leg:[{cor:'#cd853f',txt:'Geomorfologia (área)'}]},
      {layer: vlayer('geom_linha_simbolizada_mu_2501807','8b4513',2,'00000000','Geomorfologia (linha)',false), on:false,
       leg:[{cor:'#8b4513',txt:'Geomorfologia (linha)'}]},
      {layer: vlayer('pedo_area_mu_2501807','daa520',1,'daa52044','Pedologia',false), on:false,
       leg:[{cor:'#daa520',txt:'Pedologia'}]},
      {layer: vlayer('vege_area_mu_2501807','6b8e23',1,'6b8e2344','Vegetação (IBGE)',false), on:false,
       leg:[{cor:'#6b8e23',txt:'Vegetação (IBGE)'}]}
    ]
  }
];

// ===== MAPA =====
Map.setOptions('HYBRID');
Map.centerObject(ee.FeatureCollection(P+'Bayeux_limites'), 12);

// ===== PAINEL DE CONTROLE (topo) =====
var painelTopo = ui.Panel({style:{position:'top-center', padding:'8px',
  backgroundColor:'rgba(255,255,255,0.92)', width:'340px'}});
painelTopo.add(ui.Label('PMRR Bayeux/PB — Acervo Espacial (Fase 1)',
  {fontWeight:'bold', fontSize:'15px', margin:'0'}));
painelTopo.add(ui.Label('Escolha um grupo temático:',
  {fontSize:'11px', color:'#555', margin:'4px 0 2px 0'}));

var seletor = ui.Select({
  items: GRUPOS.map(function(g){return g.nome;}),
  value: GRUPOS[0].nome,
  style:{width:'320px'},
  onChange: function(nome){
    var g = GRUPOS.filter(function(x){return x.nome===nome;})[0];
    aplicaGrupo(g);
  }
});
painelTopo.add(seletor);
painelTopo.add(ui.Label('No painel "Layers" (canto sup. dir.) você liga/desliga cada camada do grupo.',
  {fontSize:'10px', color:'#777', margin:'4px 0 0 0'}));
Map.add(painelTopo);

// ===== LEGENDA DINÂMICA (canto inferior esquerdo) =====
var legPanel = ui.Panel({style:{position:'bottom-left', padding:'8px',
  backgroundColor:'rgba(255,255,255,0.92)', width:'240px'}});
Map.add(legPanel);

function chip(cor, txt){
  return ui.Panel({
    layout: ui.Panel.Layout.flow('horizontal'),
    widgets:[
      ui.Label('', {backgroundColor:cor, padding:'8px', margin:'2px 6px 2px 0', border:'1px solid #999'}),
      ui.Label(txt, {fontSize:'11px', margin:'2px 0'})
    ]});
}

function setLegenda(g){
  legPanel.clear();
  legPanel.add(ui.Label(g.nome, {fontWeight:'bold', fontSize:'12px', margin:'0 0 4px 0'}));
  g.camadas.forEach(function(c){
    c.leg.forEach(function(item){ legPanel.add(chip(item.cor, item.txt)); });
  });
  legPanel.add(ui.Label('— Limite municipal (amarelo)', {fontSize:'10px', color:'#777', margin:'4px 0 0 0'}));
}

// ===== TROCA DE GRUPO =====
function aplicaGrupo(g){
  var layers = g.camadas.map(function(c){ c.layer.setShown(c.on); return c.layer; });
  layers.push(layerLimite);
  Map.layers().reset(layers);
  setLegenda(g);
}

// inicializa no primeiro grupo
aplicaGrupo(GRUPOS[0]);
