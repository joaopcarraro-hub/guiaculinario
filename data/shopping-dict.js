// ============ DICIONÁRIO DE COMPRA v1 (Lista de Compras — Fase 1) ============
// Normaliza o TEXTO de um ingrediente pro seu "núcleo de compra": o que de fato vai pro
// carrinho, ignorando o que só importa na execução da receita (tamanho, temperatura, estado
// de uso). É uma camada PRÓPRIA da lista de compras — ingredientsStructured continua sendo a
// verdade da RECEITA e nunca é alterado por aqui. Critério de fusão (decidido na investigação
// de 2026-07-23): variantes ORDENADAS (comprar a específica satisfaz a genérica) fundem no
// rótulo MAIS ESPECÍFICO (leite → leite integral); variantes PARALELAS (nenhuma satisfaz a
// outra) fundem no GENÉRICO (camarão médio/grande → camarão); produto processado/diferente
// NUNCA funde (manteiga clarificada ≠ manteiga; creme de leite fresco ≠ lata); cortes de
// proteína (peito, coxa, lombo) ficam separados.
// Usado em produção (js/app.js agrupamento da visão Geral + js/storage.js boughtKeys e
// migração v1→v2) — mesmo padrão UMD de derivation-dict.js pra também poder ser carregado
// via require em teste/auditoria. Não duplique este conteúdo em nenhum lugar.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.ShoppingDict = factory();
  }
})(typeof window !== "undefined" ? window : this, function () {
  // Enum das unidades que existem no acervo — a migração v1→v2 de boughtKeys (storage.js)
  // usa isto pra validar o split "item|unit" no último pipe antes de reescrever a chave.
  const KNOWN_UNITS = {
    grama: 1, quilograma: 1, mililitro: 1, litro: 1,
    "colher-sopa": 1, "colher-cha": 1, xicara: 1,
    dente: 1, pitada: 1, folha: 1, talo: 1, fatia: 1, ramo: 1, pedaco: 1,
    file: 1, fio: 1, disco: 1, fava: 1, posta: 1, pacote: 1, colher: 1, lata: 1,
  };

  // ---- Camada 3 (fallback): modificadores que NUNCA mudam o que se compra ----
  // Só tamanho, temperatura e estado de uso/preparo pós-compra. NUNCA coloque aqui:
  // "fresco/fresca" (creme de leite fresco, camarão fresco vs seco — muda a identidade),
  // "seco/seca" (camarão seco, vinho seco), "grosso/grossa" (sal grosso), "inteiro/inteira"
  // (frango inteiro é rótulo canônico), "extra" (extra virgem). Esses casos se resolvem um a
  // um no mapa CANONICAL abaixo.
  const STRIP_PHRASES = ["em temperatura ambiente"];
  const STRIP_WORDS = {
    // tamanho
    pequeno: 1, pequena: 1, pequenos: 1, pequenas: 1,
    grande: 1, grandes: 1,
    "médio": 1, "média": 1, "médios": 1, "médias": 1, medio: 1, media: 1,
    // temperatura
    morno: 1, morna: 1, gelado: 1, gelada: 1, gelados: 1, geladas: 1,
    frio: 1, fria: 1, quente: 1, fervente: 1,
    // estado de uso / preparo pós-compra
    dividido: 1, dividida: 1, divididos: 1, divididas: 1,
    derretido: 1, derretida: 1, amolecido: 1, amolecida: 1,
    maduro: 1, madura: 1, maduros: 1, maduras: 1,
    cozido: 1, cozida: 1, cozidos: 1, cozidas: 1,
    picado: 1, picada: 1, picados: 1, picadas: 1,
    ralado: 1, ralada: 1, amassado: 1, amassada: 1,
    tostado: 1, tostada: 1, tostados: 1, tostadas: 1,
    desfiado: 1, desfiada: 1, duro: 1, duros: 1, dura: 1, duras: 1,
    firme: 1, firmes: 1, levemente: 1, bem: 1, muito: 1, muita: 1,
  };
  // Sobras de conector quando um modificador some do começo ou do meio da frase ("cebola em
  // rodelas grandes" → "cebola em rodelas"; "tomate bem maduro" → "tomate"; "½ de cebola
  // roxa" chega aqui como "de cebola roxa") — nunca abrem nem terminam um núcleo válido.
  const DANGLING = { de: 1, da: 1, do: 1, em: 1, e: 1, com: 1, para: 1, a: 1 };

  // ---- Camada 2: mapa curado texto-completo → núcleo de compra ----
  // Chaves já em lowercase e SEM parênteses (a camada 1 roda antes da consulta). A consulta
  // roda DUAS vezes: no texto pós-camada-1 e de novo no resultado da camada 3 ("cebolas
  // grandes" → strip → "cebolas" → mapa → "cebola"). Valores devem ser pontos fixos (rodar o
  // pipeline neles devolve eles mesmos).
  const CANONICAL = {
    // fusões ORDENADAS — genérico assume o rótulo específico
    "leite": "leite integral",
    "azeite": "azeite extra virgem",
    "azeite de oliva": "azeite extra virgem",
    "azeite de oliva extra virgem": "azeite extra virgem",
    "azeite de oliva extra virgem de boa qualidade": "azeite extra virgem",
    "azeite de oliva extra virgem de altíssima qualidade": "azeite extra virgem",
    "azeite extra": "azeite extra virgem",
    "manteiga": "manteiga sem sal",
    "manteiga extra": "manteiga sem sal",
    "manteiga para tostar os muffins": "manteiga sem sal",
    "frango": "frango inteiro",
    "óleo": "óleo neutro",
    "arroz": "arroz branco",
    "arroz cru": "arroz branco",
    "vinagre": "vinagre branco",
    "pimenta": "pimenta-do-reino",
    "pimenta-do-reino preta": "pimenta-do-reino",
    "pimenta-do-reino grossa": "pimenta-do-reino",
    "iogurte natural": "iogurte natural integral",
    "cogumelos": "cogumelos paris",
    "cogumelos frescos": "cogumelos paris",
    "peito": "peito de frango",

    // plural / grafia → mesma coisa na prateleira (o núcleo é SEMPRE singular; a forma
    // plural de exibição vive em PLURALS, abaixo)
    "cebolas": "cebola",
    "cebolas roxas": "cebola roxa",
    "cebolinhas pérola": "cebolinha pérola",
    "tomates": "tomate",
    "tomates cereja": "tomate cereja",
    "batatas": "batata",
    "ovos": "ovo",
    "gemas": "gema",
    "gemas frescas": "gema",
    "gema por porção": "gema",
    "claras": "clara",
    "claras de ovo": "clara",
    "clara de ovo": "clara",
    "cenouras": "cenoura",
    "camarões": "camarão",
    "cravos": "cravo",
    "grãos de cravo": "cravo",
    "maçãs": "maçã",
    "mexilhões": "mexilhão",
    "berinjelas": "berinjela",
    "limões": "limão",
    "limões-sicilianos": "limão-siciliano",
    "abacates": "abacate",
    "nabos": "nabo",
    "lulas": "lula",
    "lagostas": "lagosta",
    "rabanetes": "rabanete",
    "beterrabas": "beterraba",
    "pepinos em conserva": "pepino em conserva",
    "cardamomos": "cardamomo",
    "vagens de cardamomo": "cardamomo",
    "filés mignon": "filé mignon",
    "medalhões de filé mignon": "medalhão de filé mignon",
    "filés finos de vitela": "filé fino de vitela",
    "joelhos de porco": "joelho de porco",
    "suprêmes de frango": "suprême de frango",
    "coxas de pato com sobrecoxa": "coxa de pato com sobrecoxa",
    "sobrecoxas de frango com osso": "sobrecoxa de frango com osso",
    "shanks de cordeiro": "shank de cordeiro",
    "bifes de lombo": "bife de lombo",
    "bifes de lombo suíno": "bife de lombo suíno",
    "bifes de contrafilé": "bife de contrafilé",
    "galetos": "galeto",
    "vieiras frescas": "vieira",
    "escargots em conserva": "escargot em conserva",
    "conchas": "concha",
    "sachês de tinta de lula": "sachê de tinta de lula",
    "cápsulas de n2o": "cápsula de n2o",
    "bolas de sorvete de creme": "bola de sorvete de creme",
    "maços de salsinha": "maço de salsinha",
    "maços de folhas de jambu": "maço de folhas de jambu",
    "pães tipo hot dog": "pão tipo hot dog",
    "pães pita": "pão pita",
    "pães": "pão",
    "pimentões poblano": "pimentão poblano",
    "pimentas guajillo secas": "pimenta guajillo seca",
    "pimentas ancho secas": "pimenta ancho seca",
    "pimentas chipotle secas": "pimenta chipotle seca",
    "pimentas mulato secas": "pimenta mulato seca",
    "pimentas pasilla secas": "pimenta pasilla seca",
    "pimentas tailandesas": "pimenta tailandesa",
    "pimentas jalapeño": "pimenta jalapeño",
    "pimentas secas": "pimenta seca",
    "tortillas de milho": "tortilla de milho",
    "tortillas de trigo": "tortilla de trigo",
    "english muffins": "english muffin",
    "biscoitos champanhe": "biscoito champanhe",
    "pequis inteiros": "pequi inteiro",
    "cabeças de alho": "cabeça de alho",
    "queijo tipo mussarela": "queijo muçarela",
    "presunto parma": "presunto de parma",
    "farinha de trigo tipo 00": "farinha tipo 00",
    "repolho napa": "repolho chinês",
    "banha de porco": "banha",

    // variantes de texto → núcleo (casos que a camada 3 não cobre — em geral por causa de
    // "fresco", que nunca é removido mecanicamente, só decidido aqui um a um)
    "farinha": "farinha de trigo",
    "farinha extra": "farinha de trigo",
    "farinha de trigo branca": "farinha de trigo",
    "farinha de rosca fina": "farinha de rosca",
    "farinha de mandioca crua": "farinha de mandioca",
    "sal para a água da massa": "sal",
    "cebola inteira": "cebola",
    "ovos inteiros": "ovo",
    "ovos com casca": "ovo",
    "ovos por ramequim": "ovo",
    "ovo por porção": "ovo",
    "ovo fresco por porção": "ovo",
    "ovos frescos": "ovo",
    "ovos para poché": "ovo",
    "ovos marinados": "ovo",
    "ovo frito": "ovo",
    "ovo mexido cremoso": "ovo",
    "ovos no ponto mollet": "ovo",
    "água com gelo": "água",
    "água suficiente para cobrir os ovos": "água",
    "água suficiente para cobrir": "água",
    "água suficiente para um banho controlado": "água",
    "água para a salmoura final": "água",
    "suco de limão fresco": "suco de limão",
    "suco cítrico fresco": "suco cítrico",
    "camarão fresco": "camarão",
    "peixe branco fresco": "peixe branco",
    "filé mignon fresco": "filé mignon",
    "filé mignon em peça central": "filé mignon",
    "carne seca dessalgada": "carne seca",
    "creme de leite fresco por ramequim": "creme de leite fresco",
    "grãos de pimenta-do-reino": "pimenta-do-reino em grãos",
    "grãos de pimenta-do-reino preta": "pimenta-do-reino em grãos",
    "pimenta-do-reino preta em grãos": "pimenta-do-reino em grãos",
    "grãos de pimenta": "pimenta-do-reino em grãos",
    "folhas de louro": "louro",
    "folha de louro": "louro",
    "maionese caseira": "maionese",
    "mostarda dijon extra": "mostarda dijon",
    "vinho branco seco + água para cobrir": "vinho branco seco",
    "presunto de boa qualidade": "presunto",
    "iogurte grego espesso": "iogurte grego",
    "crème pâtissière de baunilha": "crème pâtissière",
    "batata palha fina": "batata palha",

    // ---- auditoria de cobertura (2026-07-23): fechamento dos clusters restantes ----
    // redundância cultural (o genérico É o específico no Brasil)
    "suco de limão-tahiti": "suco de limão",
    // achado na investigação de sub-produto derivado (2026-07-24): quantidade de fruta escrita
    // dentro do próprio texto do ingrediente (não no campo qty estruturado) — sem isso, "suco
    // de 2 limões" e "suco de 1/2 limão" viram canônicos DIFERENTES de "suco de limão" e ficam
    // fora da soma/máximo do sub-produto. Parênteses já são removidos pela Camada 1 antes desta
    // consulta, então "suco de 1 limão (para o quiabo)" e "suco de 2 limões (dividido)" também
    // caem aqui.
    "suco de 1 limão": "suco de limão",
    "suco de 1-2 limões": "suco de limão",
    "suco de 1/2 limão": "suco de limão",
    "suco de 2 limões": "suco de limão",
    "suco de 3 limões": "suco de limão",
    "raspas de 1 limão": "raspas de limão",
    "suco de 2 laranjas": "suco de laranja",
    "cominho em pó": "cominho",
    "orégano seco": "orégano",
    "acém bovino": "acém",
    "carne suína": "carne de porco",
    "molho shoyu": "shoyu",
    "pão árabe": "pão pita",
    "grãos de cominho": "sementes de cominho",
    "vinho de arroz shaoxing": "vinho shaoxing",
    "creme de confeiteiro": "crème pâtissière",
    // ervas: "fresco" redundante (só existe fresca na prateleira; em pó/seca são núcleos próprios)
    "salsinha fresca": "salsinha",
    "coentro fresco": "coentro",
    "endro fresco": "endro",
    "hortelã fresca": "hortelã",
    "folhas de hortelã": "hortelã",
    "sálvia fresca": "sálvia",
    "estragão fresco": "estragão",
    "manjericão fresco": "manjericão",
    "alecrim fresco": "alecrim",
    "espinafre fresco": "espinafre",
    "folhas de espinafre": "espinafre",
    "gengibre fresco": "gengibre",
    "ervilha fresca": "ervilha",
    "foie gras fresco": "foie gras",
    "maço de salsinha fresca": "maço de salsinha",
    "maço de endro fresco": "maço de endro",
    // ordenadas → rótulo específico
    "vinho branco": "vinho branco seco",
    "páprica": "páprica doce",
    "pato": "pato inteiro",
    "canela": "canela em pó",
    "lombo": "lombo de porco",
    // paralelas / estado de uso / formato da mesma peça → genérico
    "vinho tinto seco": "vinho tinto",
    "vinho tinto encorpado": "vinho tinto",
    "fundo escuro": "fundo escuro de carne",
    "fundo de carne": "fundo escuro de carne",
    "fundo escuro de carne adicional": "fundo escuro de carne",
    "caldo claro": "fundo claro",
    "fundo de galinha para o cozimento": "fundo claro",
    "frango com osso e pele": "frango com osso",
    "filé de peixe branco": "peixe branco",
    "lombo de porco assado": "lombo de porco",
    "lombo de porco inteiro": "lombo de porco",
    "pernil de porco com pele": "pernil de porco",
    "pernil de porco com pele e osso": "pernil de porco",
    "barriga de porco inteira": "barriga de porco",
    // "batata frita" (Gyros) e "tortillas fritas" (Pozole) NÃO fundem com o cru: o raw das
    // duas receitas confirma que são acompanhamento pronto na montagem/serviço — nenhum passo
    // frita; batata frita congelada e tostadas são produtos compráveis por si.
    "pão amanhecido": "pão",
    "bacon em pedaço": "bacon",
    "couve refogada": "couve",
    "kimchi fermentado": "kimchi",
    "alcaparras extras": "alcaparras",
    "azeitonas pretas sem caroço": "azeitonas pretas",
    "bacalhau dessalgado": "bacalhau",
    "ragù à bolonhesa pronto": "ragù à bolonhesa",
    "torradas finas": "torradas",
    "fatias extras de toucinho": "toucinho",
    "sobras de carne assada": "sobras de assado",
    "espetos": "espetos de bambu",
    "alface para forrar o prato": "alface",
    "folhas de alface": "alface",
    "folhas de gelatina": "gelatina em folha",
    "folhas de ervas frescas": "ervas frescas",
    "ervas": "ervas frescas",
    "frutas": "frutas frescas",
    "frutas para acompanhar": "frutas frescas",
    "frutas frescas variadas": "frutas frescas",
    "frutas vermelhas variadas": "frutas vermelhas",
    "pepinos": "pepino",
    "cogumelo paris": "cogumelos paris",
    "vegetal": "vegetal de sua escolha",
    "vegetal escolhido": "vegetal de sua escolha",
    "vegetal à sua escolha": "vegetal de sua escolha",
    "vegetal principal": "vegetal de sua escolha",
    // identidade protegida do strip da camada 3 ("firme" aqui é produto, não descritor)
    "tofu firme": "tofu firme",

    // colaterais da varredura da Fase 3B (2026-07-23): grafia/sinônimo do mesmo produto
    "pimenta-caiena": "pimenta caiena",
    "flocos de pimenta": "pimenta em flocos",
    "açafrão-da-terra": "cúrcuma",
    "parmesão": "queijo parmesão",
    "salsa": "salsinha",
    "aipo": "salsão",
    "negi": "cebolinha grossa",
    // achado na investigação de seção de mercado (2026-07-24): recipe.name já traduzido de
    // Rødkål pra Repolho Roxo, mas o texto de ingrediente em OUTRAS receitas que referenciam
    // repolho roxo como componente ainda usa o nome dinamarquês — mesmo vegetal, sem isso
    // vira 2 canônicos diferentes na lista de compras.
    "rødkål": "repolho roxo",
  };

  // ---- Formas plurais de EXIBIÇÃO (visão Geral, grupos de contagem sem unidade) ----
  // Curado, não algorítmico — português tem irregularidade demais (-ão→-ões/-ães, -l→-is,
  // -m→-ns) pra confiar em regra genérica. Chave = núcleo canônico (singular); valor = forma
  // exibida quando a quantidade final somada é > 1 (ou faixa com limite superior > 1). Núcleo
  // fora deste mapa não flexiona (massa/invariável: "sal", "suco de limão", "repolho").
  // Itens COM unidade nunca passam por aqui — quem flexiona é a unidade, no UNIT_DISPLAY de
  // js/app.js ("4 dentes de alho", "2 folhas de louro").
  const PLURALS = {
    "cebola": "cebolas",
    "cebola roxa": "cebolas roxas",
    "cebolinha pérola": "cebolinhas pérola",
    "ovo": "ovos",
    "gema": "gemas",
    "clara": "claras",
    "tomate": "tomates",
    "tomate cereja": "tomates cereja",
    "batata": "batatas",
    "cenoura": "cenouras",
    "limão": "limões",
    "limão-siciliano": "limões-sicilianos",
    "pão": "pães",
    "pão pita": "pães pita",
    "pão tipo hot dog": "pães tipo hot dog",
    "camarão": "camarões",
    "cravo": "cravos",
    "maçã": "maçãs",
    "mexilhão": "mexilhões",
    "berinjela": "berinjelas",
    "berinjela tailandesa": "berinjelas tailandesas",
    "abacate": "abacates",
    "nabo": "nabos",
    "lula": "lulas",
    "lagosta": "lagostas",
    "rabanete": "rabanetes",
    "beterraba": "beterrabas",
    "pepino": "pepinos",
    "pepino em conserva": "pepinos em conserva",
    "abobrinha": "abobrinhas",
    "amêndoa": "amêndoas",
    "pera asiática": "peras asiáticas",
    "cardamomo": "cardamomos",
    "polvo": "polvos",
    "pato inteiro": "patos inteiros",
    "frango inteiro": "frangos inteiros",
    "frango caipira": "frangos caipiras",
    "galeto": "galetos",
    "pimentão": "pimentões",
    "pimentão vermelho": "pimentões vermelhos",
    "pimentão verde": "pimentões verdes",
    "pimentão amarelo": "pimentões amarelos",
    "pimentão poblano": "pimentões poblano",
    "pimenta dedo-de-moça": "pimentas dedo-de-moça",
    "pimenta malagueta": "pimentas malagueta",
    "pimenta amarela peruana": "pimentas amarelas peruanas",
    "pimenta verde": "pimentas verdes",
    "pimenta seca": "pimentas secas",
    "pimenta guajillo seca": "pimentas guajillo secas",
    "pimenta ancho seca": "pimentas ancho secas",
    "pimenta chipotle seca": "pimentas chipotle secas",
    "pimenta mulato seca": "pimentas mulato secas",
    "pimenta pasilla seca": "pimentas pasilla secas",
    "pimenta tailandesa": "pimentas tailandesas",
    "pimenta jalapeño": "pimentas jalapeño",
    "tortilla de milho": "tortillas de milho",
    "tortilla de trigo": "tortillas de trigo",
    "english muffin": "english muffins",
    "biscoito champanhe": "biscoitos champanhe",
    "filé mignon": "filés mignon",
    "medalhão de filé mignon": "medalhões de filé mignon",
    "filé fino de vitela": "filés finos de vitela",
    "joelho de porco": "joelhos de porco",
    "suprême de frango": "suprêmes de frango",
    "coxa de pato com sobrecoxa": "coxas de pato com sobrecoxa",
    "sobrecoxa de frango com osso": "sobrecoxas de frango com osso",
    "shank de cordeiro": "shanks de cordeiro",
    "bife de lombo": "bifes de lombo",
    "bife de lombo suíno": "bifes de lombo suíno",
    "bife de contrafilé": "bifes de contrafilé",
    "carré de cordeiro": "carrés de cordeiro",
    "peito de pato": "peitos de pato",
    "orelha de porco": "orelhas de porco",
    "pé de porco": "pés de porco",
    "vieira": "vieiras",
    "escargot em conserva": "escargots em conserva",
    "concha": "conchas",
    "sachê de tinta de lula": "sachês de tinta de lula",
    "cápsula de n2o": "cápsulas de n2o",
    "bola de sorvete de creme": "bolas de sorvete de creme",
    "maço de salsinha": "maços de salsinha",
    "maço de endro": "maços de endro",
    "maço de espinafre japonês": "maços de espinafre japonês",
    "maço de hortelã": "maços de hortelã",
    "maço de folhas de jambu": "maços de folhas de jambu",
    "pequi inteiro": "pequis inteiros",
    "cabeça de alho": "cabeças de alho",
    "pau de canela": "paus de canela",
    "pedaço de gengibre": "pedaços de gengibre",
    "buquê de ervas": "buquês de ervas",
    "dose de café espresso": "doses de café espresso",
    "peça de carne": "peças de carne",
    "bulbo de erva-doce": "bulbos de erva-doce",
    "alho-poró": "alhos-poró",
    "alface romana": "alfaces romanas",
    "cogumelo shiitake": "cogumelos shiitake",
  };

  // Forma plural de exibição do núcleo — null quando não flexiona (massa/invariável).
  function pluralFor(core) {
    return PLURALS[String(core || "").trim().toLowerCase()] || null;
  }

  // ---- Despensa (Fase 2) ----
  // Conjunto ESTRITO, chaveado pelo NÚCLEO canônico: só entra item cuja quantidade típica de
  // receita é irrelevante frente ao pacote doméstico (1 colher de chá de sal não muda a
  // compra — você tem sal em casa). Na visão Geral esses itens saem da soma e vão pra seção
  // "Despensa — confira se já tem", sem número. NÃO ENTRAM (decisão explícita): farinha,
  // açúcar, manteiga, arroz, leite — aparecem em quantidade que muda a compra de verdade.
  // Especialidades também ficam FORA (dendê, azeite leve, óleo de gergelim/chili, vinagres
  // de xerez/balsâmico/arroz etc.): quem compra pro prato precisa ver na lista principal.
  const PANTRY_SET = {
    "sal": 1, "sal grosso": 1, "sal em flocos": 1, "sal não iodado": 1,
    "pimenta-do-reino": 1, "pimenta-do-reino em grãos": 1, "pimenta-do-reino branca": 1,
    "pimenta branca": 1,
    "azeite extra virgem": 1,
    "óleo neutro": 1,
    "vinagre branco": 1,
    "água": 1,
  };

  function isPantry(core) {
    return !!PANTRY_SET[String(core || "").trim().toLowerCase()];
  }

  // ---- Agrupamento por corredor de mercado (visão Geral, 2026-07-24) ----
  // Ordem de exibição das 10 seções + fallback "outros" no fim pra núcleo ainda não mapeado —
  // nunca some, nunca quebra o sort, só fica visualmente no final até alguém classificar.
  // Despensa (PANTRY_SET) fica FORA desta lista de propósito: já é uma seção própria e
  // separada da visão Geral antes mesmo do agrupamento por corredor entrar (ver
  // isPantry, consumido em js/app.js ANTES do sectionFor). Sem cabeçalho visível — a ordem
  // resultante só agrupa os itens do mesmo corredor de forma contígua.
  const SECTION_ORDER = [
    "Hortifruti", "Padaria", "Açougue e Peixaria", "Frios e Laticínios", "Mercearia e Secos",
    "Doces e Sobremesas", "Temperos e Condimentos", "Produtos Asiáticos e Orientais",
    "Congelados", "Bebidas", "outros",
  ];

  // Mapa curado núcleo → seção (mesmo padrão do PANTRY_SET, escala maior). Cobertura vem da
  // investigação de agrupamento por corredor (2026-07-24): rodar purchaseCore contra todo
  // ingrediente estruturado das 398 receitas reais, classificar cada núcleo distinto, e
  // resolver os ambíguos (cabiam em 2 seções) pela forma física de compra mais comum no
  // Brasil — fresco vai pra Hortifruti/Açougue/Peixaria, processado/seco/em pó/enlatado vai
  // pra Mercearia ou Temperos; nos casos que nem isso decidia sozinho, decisão explícita do
  // dono. Núcleo fora deste mapa (equipamento, subproduto de outra receita, texto vago —
  // nenhum é problema de seção, são gaps de cobertura do dicionário ou itens que não deveriam
  // nem estar na lista) cai em "outros" via sectionFor, nunca quebra.
  const SECTION_MAP = {
    // Hortifruti (123)
    "abacate": "Hortifruti",
    "abacaxi": "Hortifruti",
    "abóbora": "Hortifruti",
    "abobrinha": "Hortifruti",
    "alecrim": "Hortifruti",
    "alface": "Hortifruti",
    "alface romana": "Hortifruti",
    "alho": "Hortifruti",
    "alho-poró": "Hortifruti",
    "aspargos": "Hortifruti",
    "aspargos brancos": "Hortifruti",
    "banana": "Hortifruti",
    "banana-da-terra": "Hortifruti",
    "batata": "Hortifruti",
    "batata amarela": "Hortifruti",
    "batata-doce": "Hortifruti",
    "batatinhas": "Hortifruti",
    "berinjela": "Hortifruti",
    "berinjela tailandesa": "Hortifruti",
    "beterraba": "Hortifruti",
    "broto de feijão": "Hortifruti",
    "bulbo de erva-doce": "Hortifruti",
    "buquê de ervas": "Hortifruti",
    "cabeça de alho": "Hortifruti",
    "casca de laranja": "Hortifruti",
    "casca de limão": "Hortifruti",
    "casca de limão-siciliano": "Hortifruti",
    "cebola": "Hortifruti",
    "cebola roxa": "Hortifruti",
    "cebolinha": "Hortifruti",
    "cebolinha grossa": "Hortifruti",
    "cebolinha pérola": "Hortifruti",
    "cenoura": "Hortifruti",
    "cheiro-verde": "Hortifruti",
    "coco": "Hortifruti",
    "coentro": "Hortifruti",
    "cogumelo shiitake": "Hortifruti",
    "cogumelos paris": "Hortifruti",
    "cogumelos shiitake e enoki": "Hortifruti",
    "cogumelos shiitake e shimeji": "Hortifruti",
    "cogumelos variados": "Hortifruti",
    "couve": "Hortifruti",
    "couve-galega": "Hortifruti",
    "cubos de pepino": "Hortifruti",
    "daikon": "Hortifruti",
    "endro": "Hortifruti",
    "erva-doce": "Hortifruti",
    "ervas finas": "Hortifruti",
    "ervas frescas": "Hortifruti",
    "ervas/aromáticos": "Hortifruti",
    "ervilha": "Hortifruti",
    "espinafre": "Hortifruti",
    "estragão": "Hortifruti",
    "fatias finas de limão-siciliano": "Hortifruti",
    "fatias finas de shiitake": "Hortifruti",
    "folha de mandioca brava": "Hortifruti",
    "frutas frescas": "Hortifruti",
    "frutas vermelhas": "Hortifruti",
    "gengibre": "Hortifruti",
    "guacamole": "Hortifruti",
    "hortelã": "Hortifruti",
    "laranja": "Hortifruti",
    "legumes": "Hortifruti",
    "limão": "Hortifruti",
    "limão-siciliano": "Hortifruti",
    "maçã": "Hortifruti",
    "macaxeira": "Hortifruti",
    "maço de endro": "Hortifruti",
    "maço de espinafre japonês": "Hortifruti",
    "maço de folhas de jambu": "Hortifruti",
    "maço de hortelã": "Hortifruti",
    "maço de salsinha": "Hortifruti",
    "mamão verde": "Hortifruti",
    "mandioca": "Hortifruti",
    "manjericão": "Hortifruti",
    "milho": "Hortifruti",
    "morango": "Hortifruti",
    "nabo": "Hortifruti",
    "pedaço de gengibre": "Hortifruti",
    "pepino": "Hortifruti",
    "pequi inteiro": "Hortifruti",
    "pera asiática": "Hortifruti",
    "pimenta amarela peruana": "Hortifruti",
    "pimenta dedo-de-moça": "Hortifruti",
    "pimenta jalapeño": "Hortifruti",
    "pimenta malagueta": "Hortifruti",
    "pimenta verde": "Hortifruti",
    "pimenta vermelha": "Hortifruti",
    "pimenta-de-cheiro": "Hortifruti",
    "pimentão": "Hortifruti",
    "pimentão amarelo": "Hortifruti",
    "pimentão poblano": "Hortifruti",
    "pimentão verde": "Hortifruti",
    "pimentão verde longo": "Hortifruti",
    "pimentão vermelho": "Hortifruti",
    "quiabo": "Hortifruti",
    "rabanete": "Hortifruti",
    "raiz-forte": "Hortifruti",
    "raspas de laranja": "Hortifruti",
    "raspas de limão": "Hortifruti",
    "raspas de limão-siciliano": "Hortifruti",
    "repolho": "Hortifruti",
    "repolho chinês": "Hortifruti",
    "repolho roxo": "Hortifruti",
    "rodelas de laranja": "Hortifruti",
    "rodelas de limão": "Hortifruti",
    "romã": "Hortifruti",
    "rúcula fresca": "Hortifruti",
    "salsão": "Hortifruti",
    "salsinha": "Hortifruti",
    "salsinha e cebolinha": "Hortifruti",
    "sálvia": "Hortifruti",
    "shiso": "Hortifruti",
    "suco cítrico": "Hortifruti",
    "suco de laranja": "Hortifruti",
    "suco de limão": "Hortifruti",
    "suco de limão-siciliano": "Hortifruti",
    "tomate": "Hortifruti",
    "tomate cereja": "Hortifruti",
    "tomilho": "Hortifruti",
    "vagem": "Hortifruti",
    "vegetais variados": "Hortifruti",
    "vegetal de sua escolha": "Hortifruti",
    "wasabi fresco": "Hortifruti",

    // Padaria (19)
    "baguete": "Padaria",
    "brioche": "Padaria",
    "cubos de pão torrado": "Padaria",
    "english muffin": "Padaria",
    "fatias de baguete": "Padaria",
    "franskbrød": "Padaria",
    "massa filo": "Padaria",
    "massa folhada": "Padaria",
    "naan": "Padaria",
    "pão": "Padaria",
    "pão brioche": "Padaria",
    "pão de forma": "Padaria",
    "pão de gengibre": "Padaria",
    "pão escuro": "Padaria",
    "pão pita": "Padaria",
    "pão rústico": "Padaria",
    "pão tipo hot dog": "Padaria",
    "pão turco": "Padaria",
    "rugbrød": "Padaria",

    // Açougue e Peixaria (101)
    "acém": "Açougue e Peixaria",
    "almôndegas": "Açougue e Peixaria",
    "amêijoas": "Açougue e Peixaria",
    "arenque salgado": "Açougue e Peixaria",
    "asas de frango": "Açougue e Peixaria",
    "atum fresco": "Açougue e Peixaria",
    "bacalhau": "Açougue e Peixaria",
    "barriga de porco": "Açougue e Peixaria",
    "bife de contrafilé": "Açougue e Peixaria",
    "bife de lombo": "Açougue e Peixaria",
    "bife de lombo suíno": "Açougue e Peixaria",
    "camarão": "Açougue e Peixaria",
    "camarão seco": "Açougue e Peixaria",
    "carne": "Açougue e Peixaria",
    "carne bovina": "Açougue e Peixaria",
    "carne bovina grelhada": "Açougue e Peixaria",
    "carne bovina moída": "Açougue e Peixaria",
    "carne bovina para cozimento longo": "Açougue e Peixaria",
    "carne de cordeiro": "Açougue e Peixaria",
    "carne de lagosta": "Açougue e Peixaria",
    "carne de porco": "Açougue e Peixaria",
    "carne de sol": "Açougue e Peixaria",
    "carne seca": "Açougue e Peixaria",
    "carré de cordeiro": "Açougue e Peixaria",
    "charque": "Açougue e Peixaria",
    "chashu": "Açougue e Peixaria",
    "contrafilé": "Açougue e Peixaria",
    "coração de boi": "Açougue e Peixaria",
    "coração de galinha": "Açougue e Peixaria",
    "cordeiro": "Açougue e Peixaria",
    "corte de carne para braseado": "Açougue e Peixaria",
    "costela bovina": "Açougue e Peixaria",
    "costelinha de porco salgada": "Açougue e Peixaria",
    "costelinha suína": "Açougue e Peixaria",
    "coxa de frango": "Açougue e Peixaria",
    "coxa de pato com sobrecoxa": "Açougue e Peixaria",
    "coxão mole": "Açougue e Peixaria",
    "dobradinha": "Açougue e Peixaria",
    "fígado de frango": "Açougue e Peixaria",
    "fígado de porco": "Açougue e Peixaria",
    "filé fino de vitela": "Açougue e Peixaria",
    "filé mignon": "Açougue e Peixaria",
    "foie gras": "Açougue e Peixaria",
    "frango caipira": "Açougue e Peixaria",
    "frango com osso": "Açougue e Peixaria",
    "frango inteiro": "Açougue e Peixaria",
    "frutos do mar": "Açougue e Peixaria",
    "galeto": "Açougue e Peixaria",
    "joelho de porco": "Açougue e Peixaria",
    "lagarto": "Açougue e Peixaria",
    "lagosta": "Açougue e Peixaria",
    "linguado": "Açougue e Peixaria",
    "linguiça": "Açougue e Peixaria",
    "linguiça de porco fresca": "Açougue e Peixaria",
    "linguiça de toulouse": "Açougue e Peixaria",
    "linguiça fresca de porco tipo medister": "Açougue e Peixaria",
    "lombo de porco": "Açougue e Peixaria",
    "lula": "Açougue e Peixaria",
    "medalhão de filé mignon": "Açougue e Peixaria",
    "mexilhão": "Açougue e Peixaria",
    "miúdos de porco variados": "Açougue e Peixaria",
    "orelha de porco": "Açougue e Peixaria",
    "orelha e pé de porco": "Açougue e Peixaria",
    "ossobuco": "Açougue e Peixaria",
    "ossos": "Açougue e Peixaria",
    "ossos de porco": "Açougue e Peixaria",
    "ovas de peixe": "Açougue e Peixaria",
    "paleta": "Açougue e Peixaria",
    "paleta de cordeiro": "Açougue e Peixaria",
    "paleta de porco": "Açougue e Peixaria",
    "pato inteiro": "Açougue e Peixaria",
    "pé de porco": "Açougue e Peixaria",
    "peça de carne": "Açougue e Peixaria",
    "peça de carne bovina com osso": "Açougue e Peixaria",
    "peça de peixe": "Açougue e Peixaria",
    "pedaço de gordura de boi": "Açougue e Peixaria",
    "peito bovino": "Açougue e Peixaria",
    "peito de frango": "Açougue e Peixaria",
    "peito de pato": "Açougue e Peixaria",
    "peixe branco": "Açougue e Peixaria",
    "peixe fresco tipo sashimi": "Açougue e Peixaria",
    "peixe pintado": "Açougue e Peixaria",
    "peixes variados": "Açougue e Peixaria",
    "pernil": "Açougue e Peixaria",
    "pernil de cordeiro": "Açougue e Peixaria",
    "pernil de porco": "Açougue e Peixaria",
    "pirarucu salgado": "Açougue e Peixaria",
    "polvo": "Açougue e Peixaria",
    "posta de peixe de água doce": "Açougue e Peixaria",
    "rabo bovino": "Açougue e Peixaria",
    "sachê de tinta de lula": "Açougue e Peixaria",
    "salmão defumado": "Açougue e Peixaria",
    "salmão fresco": "Açougue e Peixaria",
    "sangue de porco": "Açougue e Peixaria",
    "sashimi variado": "Açougue e Peixaria",
    "shank de cordeiro": "Açougue e Peixaria",
    "sobrecoxa de frango com osso": "Açougue e Peixaria",
    "suprême de frango": "Açougue e Peixaria",
    "tutano de boi": "Açougue e Peixaria",
    "vieira": "Açougue e Peixaria",
    "vitela": "Açougue e Peixaria",

    // Frios e Laticínios (58)
    "bacon": "Frios e Laticínios",
    "bacon canadense": "Frios e Laticínios",
    "casca de parmesão": "Frios e Laticínios",
    "chantilly": "Frios e Laticínios",
    "chouriço espanhol": "Frios e Laticínios",
    "chouriço português": "Frios e Laticínios",
    "chouriço/linguiça calabresa": "Frios e Laticínios",
    "clara": "Frios e Laticínios",
    "creme azedo": "Frios e Laticínios",
    "crème chantilly": "Frios e Laticínios",
    "creme de leite": "Frios e Laticínios",
    "creme de leite fresco": "Frios e Laticínios",
    "crème pâtissière": "Frios e Laticínios",
    "gema": "Frios e Laticínios",
    "ghee": "Frios e Laticínios",
    "guanciale": "Frios e Laticínios",
    "iogurte grego": "Frios e Laticínios",
    "iogurte natural integral": "Frios e Laticínios",
    "lascas de parmesão": "Frios e Laticínios",
    "leite integral": "Frios e Laticínios",
    "leitelho": "Frios e Laticínios",
    "linguiça calabresa": "Frios e Laticínios",
    "lombo de porco defumado e curado": "Frios e Laticínios",
    "manteiga clarificada": "Frios e Laticínios",
    "manteiga de garrafa": "Frios e Laticínios",
    "manteiga sem sal": "Frios e Laticínios",
    "mascarpone": "Frios e Laticínios",
    "morcela": "Frios e Laticínios",
    "mortadela": "Frios e Laticínios",
    "muçarela": "Frios e Laticínios",
    "ovo": "Frios e Laticínios",
    "paio": "Frios e Laticínios",
    "pancetta": "Frios e Laticínios",
    "peça de jamón ibérico de bellota": "Frios e Laticínios",
    "pecorino romano": "Frios e Laticínios",
    "presunto": "Frios e Laticínios",
    "presunto cru": "Frios e Laticínios",
    "presunto de parma": "Frios e Laticínios",
    "queijo": "Frios e Laticínios",
    "queijo beyaz peynir": "Frios e Laticínios",
    "queijo cheddar": "Frios e Laticínios",
    "queijo coalho": "Frios e Laticínios",
    "queijo cremoso": "Frios e Laticínios",
    "queijo de cabra": "Frios e Laticínios",
    "queijo feta": "Frios e Laticínios",
    "queijo fresco": "Frios e Laticínios",
    "queijo gruyère": "Frios e Laticínios",
    "queijo muçarela": "Frios e Laticínios",
    "queijo parmesão": "Frios e Laticínios",
    "queijo tipo oaxaca": "Frios e Laticínios",
    "queijo tipo provolone": "Frios e Laticínios",
    "ricota": "Frios e Laticínios",
    "ricota salata": "Frios e Laticínios",
    "roast beef": "Frios e Laticínios",
    "tofu firme": "Frios e Laticínios",
    "tofu macio": "Frios e Laticínios",
    "toucinho": "Frios e Laticínios",
    "toucinho/bacon": "Frios e Laticínios",

    // Mercearia e Secos (112)
    "ágar-ágar": "Mercearia e Secos",
    "amêndoa": "Mercearia e Secos",
    "amêndoas": "Mercearia e Secos",
    "amêndoas laminadas": "Mercearia e Secos",
    "amendoim": "Mercearia e Secos",
    "amendoim torrado": "Mercearia e Secos",
    "amido de arroz": "Mercearia e Secos",
    "amido de milho": "Mercearia e Secos",
    "anchova": "Mercearia e Secos",
    "arroz arbóreo": "Mercearia e Secos",
    "arroz basmati": "Mercearia e Secos",
    "arroz branco": "Mercearia e Secos",
    "arroz jasmim": "Mercearia e Secos",
    "arroz tipo bomba": "Mercearia e Secos",
    "atum em conserva": "Mercearia e Secos",
    "azeite de dendê": "Mercearia e Secos",
    "azeite de oliva leve": "Mercearia e Secos",
    "banha": "Mercearia e Secos",
    "batata palha": "Mercearia e Secos",
    "bicarbonato de sódio": "Mercearia e Secos",
    "bucatini": "Mercearia e Secos",
    "café": "Mercearia e Secos",
    "café espresso": "Mercearia e Secos",
    "café solúvel": "Mercearia e Secos",
    "caldo": "Mercearia e Secos",
    "caldo base": "Mercearia e Secos",
    "caldo de anchova": "Mercearia e Secos",
    "caldo de carne": "Mercearia e Secos",
    "caldo de galinha": "Mercearia e Secos",
    "caldo de legumes": "Mercearia e Secos",
    "caldo de peixe": "Mercearia e Secos",
    "caldo de porco/frango": "Mercearia e Secos",
    "caldo encorpado": "Mercearia e Secos",
    "castanha de caju": "Mercearia e Secos",
    "castanha-do-pará": "Mercearia e Secos",
    "castanhas": "Mercearia e Secos",
    "cebola frita crocante": "Mercearia e Secos",
    "chucrute": "Mercearia e Secos",
    "cogumelos secos": "Mercearia e Secos",
    "crackers": "Mercearia e Secos",
    "cuscuz": "Mercearia e Secos",
    "damasco seco": "Mercearia e Secos",
    "dose de café espresso": "Mercearia e Secos",
    "escargot em conserva": "Mercearia e Secos",
    "extrato de tomate": "Mercearia e Secos",
    "extrato/concentrado de tomate": "Mercearia e Secos",
    "farinha de amêndoas": "Mercearia e Secos",
    "farinha de arroz": "Mercearia e Secos",
    "farinha de centeio integral": "Mercearia e Secos",
    "farinha de mandioca": "Mercearia e Secos",
    "farinha de rosca": "Mercearia e Secos",
    "farinha de trigo": "Mercearia e Secos",
    "farinha de trigo integral": "Mercearia e Secos",
    "farinha tipo 00": "Mercearia e Secos",
    "farofa": "Mercearia e Secos",
    "feijão branco": "Mercearia e Secos",
    "feijão carioca": "Mercearia e Secos",
    "feijão preto": "Mercearia e Secos",
    "feijão vermelho": "Mercearia e Secos",
    "feijão-de-corda": "Mercearia e Secos",
    "feijão-fradinho": "Mercearia e Secos",
    "fermento biológico seco": "Mercearia e Secos",
    "fermento em pó": "Mercearia e Secos",
    "fermento natural": "Mercearia e Secos",
    "fermento natural de centeio": "Mercearia e Secos",
    "fumet de peixe": "Mercearia e Secos",
    "fundo claro": "Mercearia e Secos",
    "fundo de peixe": "Mercearia e Secos",
    "fundo escuro de carne": "Mercearia e Secos",
    "goma de tapioca": "Mercearia e Secos",
    "goma xantana": "Mercearia e Secos",
    "gordura de pato": "Mercearia e Secos",
    "grão-de-bico": "Mercearia e Secos",
    "grãos de centeio": "Mercearia e Secos",
    "lasanha": "Mercearia e Secos",
    "lascas de trufa negra": "Mercearia e Secos",
    "leite de coco": "Mercearia e Secos",
    "lentilha": "Mercearia e Secos",
    "macarrão de batata-doce": "Mercearia e Secos",
    "macarrão tipo cotovelo": "Mercearia e Secos",
    "massa curta": "Mercearia e Secos",
    "massa de milho": "Mercearia e Secos",
    "massa fideuà": "Mercearia e Secos",
    "milho para pozole": "Mercearia e Secos",
    "milho secas": "Mercearia e Secos",
    "nozes": "Mercearia e Secos",
    "parreira em conserva": "Mercearia e Secos",
    "passas": "Mercearia e Secos",
    "pasta de tomate": "Mercearia e Secos",
    "pinoli": "Mercearia e Secos",
    "pistache": "Mercearia e Secos",
    "polenta": "Mercearia e Secos",
    "purê de batata": "Mercearia e Secos",
    "purê de fruta": "Mercearia e Secos",
    "purê de tomate concentrado": "Mercearia e Secos",
    "rigatoni": "Mercearia e Secos",
    "semolina": "Mercearia e Secos",
    "spaghetti": "Mercearia e Secos",
    "tomate pelado": "Mercearia e Secos",
    "tonnarelli": "Mercearia e Secos",
    "torradas": "Mercearia e Secos",
    "torresmo": "Mercearia e Secos",
    "tortilla de milho": "Mercearia e Secos",
    "tortilla de trigo": "Mercearia e Secos",
    "tortillas fritas": "Mercearia e Secos",
    "trigo para quibe": "Mercearia e Secos",
    "vinagre balsâmico": "Mercearia e Secos",
    "vinagre de maçã": "Mercearia e Secos",
    "vinagre de vinho branco": "Mercearia e Secos",
    "vinagre de vinho tinto": "Mercearia e Secos",
    "vinagre de xerez": "Mercearia e Secos",
    "vinagre preto": "Mercearia e Secos",

    // Doces e Sobremesas (34)
    "açúcar": "Doces e Sobremesas",
    "açúcar de confeiteiro": "Doces e Sobremesas",
    "açúcar de palma": "Doces e Sobremesas",
    "açúcar mascavo": "Doces e Sobremesas",
    "baunilha": "Doces e Sobremesas",
    "biscoito amaretti": "Doces e Sobremesas",
    "biscoito champanhe": "Doces e Sobremesas",
    "biscoito tipo maisena": "Doces e Sobremesas",
    "biscoitos amanteigados": "Doces e Sobremesas",
    "cacau em pó": "Doces e Sobremesas",
    "calda de cereja": "Doces e Sobremesas",
    "calda de frutas vermelhas": "Doces e Sobremesas",
    "chocolate": "Doces e Sobremesas",
    "chocolate amargo": "Doces e Sobremesas",
    "chocolate meio amargo": "Doces e Sobremesas",
    "compota de frutas vermelhas": "Doces e Sobremesas",
    "corante": "Doces e Sobremesas",
    "corante vermelho alimentício": "Doces e Sobremesas",
    "cremor tártaro": "Doces e Sobremesas",
    "extrato de amêndoas amargas": "Doces e Sobremesas",
    "extrato de baunilha": "Doces e Sobremesas",
    "fondant branco": "Doces e Sobremesas",
    "gelatina": "Doces e Sobremesas",
    "gelatina em folha": "Doces e Sobremesas",
    "geleia": "Doces e Sobremesas",
    "geleia de damasco": "Doces e Sobremesas",
    "geleia de framboesa": "Doces e Sobremesas",
    "geleia de groselha": "Doces e Sobremesas",
    "glacê de açúcar de confeiteiro": "Doces e Sobremesas",
    "glucose de milho": "Doces e Sobremesas",
    "granulado colorido": "Doces e Sobremesas",
    "mel": "Doces e Sobremesas",
    "melaço": "Doces e Sobremesas",
    "pasta de praliné": "Doces e Sobremesas",

    // Temperos e Condimentos (79)
    "açafrão": "Temperos e Condimentos",
    "açafrão em pistilos": "Temperos e Condimentos",
    "alcaparras": "Temperos e Condimentos",
    "alho em pó": "Temperos e Condimentos",
    "azeitonas pretas": "Temperos e Condimentos",
    "azeitonas pretas de nice": "Temperos e Condimentos",
    "canela em pó": "Temperos e Condimentos",
    "cardamomo": "Temperos e Condimentos",
    "cardamomo em pó": "Temperos e Condimentos",
    "cebola em pó": "Temperos e Condimentos",
    "coentro em pó": "Temperos e Condimentos",
    "cominho": "Temperos e Condimentos",
    "cravo": "Temperos e Condimentos",
    "cravo em pó": "Temperos e Condimentos",
    "cúrcuma": "Temperos e Condimentos",
    "curry em pó": "Temperos e Condimentos",
    "ervas secas": "Temperos e Condimentos",
    "especiarias": "Temperos e Condimentos",
    "garam masala": "Temperos e Condimentos",
    "gengibre em pó": "Temperos e Condimentos",
    "grãos de coentro": "Temperos e Condimentos",
    "grãos de pimenta de sichuan": "Temperos e Condimentos",
    "louro": "Temperos e Condimentos",
    "maionese": "Temperos e Condimentos",
    "melaço de romã": "Temperos e Condimentos",
    "molho barbecue": "Temperos e Condimentos",
    "molho de campanha": "Temperos e Condimentos",
    "molho de peixe": "Temperos e Condimentos",
    "molho de pimenta": "Temperos e Condimentos",
    "molho de pimenta tipo frank's redhot": "Temperos e Condimentos",
    "molho de tomate": "Temperos e Condimentos",
    "molho encorpado": "Temperos e Condimentos",
    "molho inglês": "Temperos e Condimentos",
    "molho ranch": "Temperos e Condimentos",
    "mostarda dijon": "Temperos e Condimentos",
    "mostarda em grãos": "Temperos e Condimentos",
    "mostarda em pó": "Temperos e Condimentos",
    "noz-moscada": "Temperos e Condimentos",
    "orégano": "Temperos e Condimentos",
    "páprica defumada": "Temperos e Condimentos",
    "páprica doce": "Temperos e Condimentos",
    "páprica doce húngara": "Temperos e Condimentos",
    "páprica picante": "Temperos e Condimentos",
    "pasta de ají amarillo": "Temperos e Condimentos",
    "pasta de ají panca": "Temperos e Condimentos",
    "pasta de gergelim": "Temperos e Condimentos",
    "pasta de tamarindo": "Temperos e Condimentos",
    "pau de canela": "Temperos e Condimentos",
    "pepino em conserva": "Temperos e Condimentos",
    "picles": "Temperos e Condimentos",
    "pimenta ancho seca": "Temperos e Condimentos",
    "pimenta caiena": "Temperos e Condimentos",
    "pimenta calabresa": "Temperos e Condimentos",
    "pimenta chipotle seca": "Temperos e Condimentos",
    "pimenta dedo-de-moça seca": "Temperos e Condimentos",
    "pimenta em flocos": "Temperos e Condimentos",
    "pimenta guajillo seca": "Temperos e Condimentos",
    "pimenta mulato seca": "Temperos e Condimentos",
    "pimenta pasilla seca": "Temperos e Condimentos",
    "pimenta rosa": "Temperos e Condimentos",
    "pimenta seca": "Temperos e Condimentos",
    "pimenta síria": "Temperos e Condimentos",
    "pimenta-da-jamaica": "Temperos e Condimentos",
    "quatro-especiarias": "Temperos e Condimentos",
    "ragù à bolonhesa": "Temperos e Condimentos",
    "ragù de javali": "Temperos e Condimentos",
    "remoulade": "Temperos e Condimentos",
    "rouille": "Temperos e Condimentos",
    "sementes de cominho": "Temperos e Condimentos",
    "sementes de endro": "Temperos e Condimentos",
    "sementes de erva-doce": "Temperos e Condimentos",
    "sementes de mostarda": "Temperos e Condimentos",
    "sementes de papoula": "Temperos e Condimentos",
    "sementes variadas": "Temperos e Condimentos",
    "tahine": "Temperos e Condimentos",
    "tamarindo": "Temperos e Condimentos",
    "temperos": "Temperos e Condimentos",
    "tucupi": "Temperos e Condimentos",
    "zimbro": "Temperos e Condimentos",

    // Produtos Asiáticos e Orientais (54)
    "alga nori": "Produtos Asiáticos e Orientais",
    "arroz japonês": "Produtos Asiáticos e Orientais",
    "broto de bambu": "Produtos Asiáticos e Orientais",
    "caldo dashi": "Produtos Asiáticos e Orientais",
    "capim-limão": "Produtos Asiáticos e Orientais",
    "cinco-especiarias chinesas": "Produtos Asiáticos e Orientais",
    "dashi": "Produtos Asiáticos e Orientais",
    "farinha panko": "Produtos Asiáticos e Orientais",
    "folhas de nori": "Produtos Asiáticos e Orientais",
    "galanga": "Produtos Asiáticos e Orientais",
    "gergelim": "Produtos Asiáticos e Orientais",
    "gochugaru": "Produtos Asiáticos e Orientais",
    "gochujang": "Produtos Asiáticos e Orientais",
    "kamaboko": "Produtos Asiáticos e Orientais",
    "kimchi": "Produtos Asiáticos e Orientais",
    "limão kaffir": "Produtos Asiáticos e Orientais",
    "macarrão chow mein": "Produtos Asiáticos e Orientais",
    "macarrão de arroz plano": "Produtos Asiáticos e Orientais",
    "macarrão shirataki": "Produtos Asiáticos e Orientais",
    "macarrão soba": "Produtos Asiáticos e Orientais",
    "macarrão udon": "Produtos Asiáticos e Orientais",
    "macarrão udon fresco": "Produtos Asiáticos e Orientais",
    "manjericão tailandês": "Produtos Asiáticos e Orientais",
    "massa para dumpling": "Produtos Asiáticos e Orientais",
    "massa para wonton": "Produtos Asiáticos e Orientais",
    "mirin": "Produtos Asiáticos e Orientais",
    "molho de feijão preto fermentado": "Produtos Asiáticos e Orientais",
    "molho de ostra": "Produtos Asiáticos e Orientais",
    "molho hoisin": "Produtos Asiáticos e Orientais",
    "molho ponzu": "Produtos Asiáticos e Orientais",
    "molho tentsuyu": "Produtos Asiáticos e Orientais",
    "molho tonkatsu": "Produtos Asiáticos e Orientais",
    "nori": "Produtos Asiáticos e Orientais",
    "óleo de chili": "Produtos Asiáticos e Orientais",
    "óleo de gergelim": "Produtos Asiáticos e Orientais",
    "panquecas mandarim": "Produtos Asiáticos e Orientais",
    "pasta de curry massaman": "Produtos Asiáticos e Orientais",
    "pasta de curry verde": "Produtos Asiáticos e Orientais",
    "pasta de curry vermelho": "Produtos Asiáticos e Orientais",
    "pasta de feijão fermentado picante": "Produtos Asiáticos e Orientais",
    "pasta de gengibre e alho": "Produtos Asiáticos e Orientais",
    "pasta de pimenta tailandesa": "Produtos Asiáticos e Orientais",
    "pimenta tailandesa": "Produtos Asiáticos e Orientais",
    "sake": "Produtos Asiáticos e Orientais",
    "sementes de gergelim": "Produtos Asiáticos e Orientais",
    "shoyu": "Produtos Asiáticos e Orientais",
    "shoyu claro": "Produtos Asiáticos e Orientais",
    "shoyu escuro": "Produtos Asiáticos e Orientais",
    "tteok": "Produtos Asiáticos e Orientais",
    "vinagre de arroz": "Produtos Asiáticos e Orientais",
    "vinagre de arroz preto": "Produtos Asiáticos e Orientais",
    "vinho de arroz": "Produtos Asiáticos e Orientais",
    "vinho shaoxing": "Produtos Asiáticos e Orientais",
    "wasabi": "Produtos Asiáticos e Orientais",

    // Congelados (3)
    "batata frita": "Congelados",
    "bola de sorvete de creme": "Congelados",
    "sorvete de creme": "Congelados",

    // Bebidas (11)
    "aquavit": "Bebidas",
    "conhaque": "Bebidas",
    "licor": "Bebidas",
    "licor de café": "Bebidas",
    "madeira": "Bebidas",
    "rum": "Bebidas",
    "suco de groselha": "Bebidas",
    "vinho branco seco": "Bebidas",
    "vinho madeira": "Bebidas",
    "vinho marsala": "Bebidas",
    "vinho tinto": "Bebidas",
  };

  function sectionFor(core) {
    return SECTION_MAP[String(core || "").trim().toLowerCase()] || "outros";
  }

  // ---- Sub-produto derivado — "não compra quebrado" (2026-07-24) ----
  // Núcleo que NÃO se compra sozinho, só como fração de um item-base que TAMBÉM é canônico
  // próprio (gema/clara vêm de dentro do ovo). Todo core aqui NUNCA vira grupo próprio na
  // visão Geral — sempre funde no `base`, via js/app.js.
  //
  // `base`: núcleo pro qual funde. `perMl`: fator de rendimento estimado (1 ml do sub-produto
  // medido em volume equivale a `perMl` unidades do item-base — ex.: 1/30 = 30 ml de suco por
  // fruta) — SEM `perMl`, a quantidade medida em volume não tem como converter e o item vira
  // fallback pra `perCount`. `perCount`: quantas unidades do item-base 1 unidade CONTADA (sem
  // unidade de medida, ex. "2 raspas de limão") do sub-produto representa — default 1 (1
  // conta = 1 fruta) quando omitido. `noQuantity: true`: nunca contribui número, só funde o
  // nome da receita no grupo do item-base (ex.: casca de parmesão — não tem rendimento
  // conhecido em gramas de queijo, e o item-base já teria "sobra" de casca se comprado por
  // outro motivo).
  //
  // Regra de combinação (js/app.js): sub-produtos do MESMO item-base tomam o MÁXIMO entre si
  // (nunca soma) — a mesma fruta rende raspas E suco ao mesmo tempo, então pedir os dois não
  // dobra a necessidade. `base` direto (ex.: "2 limões" puro) SOMA por cima do máximo dos
  // sub-produtos: total = base_direto + MÁXIMO(sub-produto A, sub-produto B, ...). Exceção
  // biológica confirmada: ovo (gema+clara vêm do MESMO ovo, sempre, sem exceção — máximo é
  // exato, não estimativa). Cítricos são estimativa de rendimento culinário (marcado EST
  // abaixo), arredondada SEMPRE pra cima e pelo valor MENOR do intervalo típico (assimetria de
  // risco: comprar fruta a mais é barato, comprar de menos impede a receita).
  const SUBPRODUCT_OF = {
    "gema": { base: "ovo" },
    "clara": { base: "ovo", perMl: 1 / 30 }, // EST: 1 clara ≈ 30 ml (2 colheres de sopa)
    "suco de limão": { base: "limão", perMl: 1 / 30 }, // EST: 1 limão ≈ 30 ml de suco
    "raspas de limão": { base: "limão", perMl: 1 / 5 }, // EST: 1 limão ≈ 5 ml (1 colher de chá) de raspas
    "casca de limão": { base: "limão" },
    "rodelas de limão": { base: "limão" },
    "suco de limão-siciliano": { base: "limão-siciliano", perMl: 1 / 45 }, // EST: fruta maior, mais suco
    "raspas de limão-siciliano": { base: "limão-siciliano", perMl: 1 / 8 }, // EST
    "casca de limão-siciliano": { base: "limão-siciliano" },
    "fatias finas de limão-siciliano": { base: "limão-siciliano", perCount: 0.25 }, // EST: ~4 fatias finas por fruta
    "suco de laranja": { base: "laranja", perMl: 1 / 120 }, // EST
    "raspas de laranja": { base: "laranja", perMl: 1 / 15 }, // EST
    "casca de laranja": { base: "laranja" },
    "rodelas de laranja": { base: "laranja" },
    "casca de parmesão": { base: "queijo parmesão", noQuantity: true },
  };

  function subproductOf(core) {
    return SUBPRODUCT_OF[String(core || "").trim().toLowerCase()] || null;
  }

  // ---- Fase 3B: unidade de VENDA pra medidas de colher/xícara ----
  // Princípio: a lista de compras exibe a unidade em que o item é VENDIDO (rótulo da
  // embalagem), não a unidade em que a receita mede. Colher e xícara nunca aparecem em
  // rótulo — sólido vendido por peso converte pra GRAMA (e funde com o grupo de peso do
  // mesmo núcleo); líquido vendido por volume converte pro ml padrão (15/5/240), que já é o
  // comportamento default da família volume — por isso líquidos NÃO entram nesta tabela.
  // Valores em gramas POR UNIDADE: cs = colher-sopa rasa, cc = colher-chá (default cs/3),
  // xic = xícara de 240 ml (só onde o acervo mede em xícara). Fontes: tabela da investigação
  // de 2026-07-23 + tabelas culinárias padrão. "EST:" = estimado sem referência consolidada —
  // dá noção de proporção, mas está marcado pra revisão.
  const SPOON_TO_GRAM = {
    // tabela da investigação (aprovada)
    "açúcar": { cs: 12, cc: 4, xic: 180 },
    "farinha de trigo": { cs: 8, cc: 3, xic: 120 },
    "manteiga sem sal": { cs: 14, cc: 5 },
    "arroz branco": { cs: 12, xic: 200 },
    "farinha de rosca": { cs: 8, cc: 3 },
    "açúcar mascavo": { cs: 12, cc: 4 },
    "passas": { cs: 10 },
    "banha": { cs: 13 },
    "maionese": { cs: 15 },
    "amendoim torrado": { cs: 10 },
    "gochugaru": { cs: 6 }, // EST (aprovada como estimativa na investigação)
    "camarão seco": { cs: 10 }, // EST (aprovada como estimativa na investigação)
    // tabelas culinárias padrão
    "açúcar de confeiteiro": { cs: 8, cc: 3, xic: 120 },
    "mel": { cs: 21, cc: 7 },
    "melaço": { cs: 20, cc: 7 },
    "ghee": { cs: 13, cc: 4 },
    "alcaparras": { cs: 9, cc: 3 },
    "extrato de tomate": { cs: 16, cc: 5 },
    "pasta de tomate": { cs: 16, cc: 5 },
    "purê de tomate concentrado": { cs: 16, cc: 5 },
    "extrato/concentrado de tomate": { cs: 16, cc: 5 },
    "mostarda dijon": { cs: 15, cc: 5 },
    "mostarda em pó": { cs: 7, cc: 2 },
    "mostarda em grãos": { cs: 11, cc: 4 },
    "sementes de mostarda": { cs: 11, cc: 4 },
    "amido de milho": { cs: 8, cc: 3 },
    "amido de arroz": { cs: 8, cc: 3 },
    "canela em pó": { cs: 8, cc: 3 },
    "páprica doce": { cs: 7, cc: 2 },
    "páprica defumada": { cs: 7, cc: 2 },
    "páprica picante": { cs: 7, cc: 2 },
    "páprica doce húngara": { cs: 7, cc: 2 },
    "pimenta caiena": { cs: 5, cc: 2 },
    "cominho": { cs: 6, cc: 2 },
    "sementes de cominho": { cs: 6, cc: 2 },
    "coentro em pó": { cs: 5, cc: 2 },
    "grãos de coentro": { cs: 5, cc: 2 },
    "cúrcuma": { cs: 9, cc: 3 },
    "gengibre em pó": { cs: 5, cc: 2 },
    "alho em pó": { cs: 9, cc: 3 },
    "cebola em pó": { cs: 7, cc: 2 },
    "garam masala": { cs: 6, cc: 2 },
    "curry em pó": { cs: 6, cc: 2 },
    "cinco-especiarias chinesas": { cs: 6, cc: 2 },
    "pimenta-da-jamaica": { cs: 6, cc: 2 },
    "orégano": { cs: 3, cc: 1 },
    "fermento em pó": { cs: 14, cc: 5 },
    "sementes de endro": { cs: 6, cc: 2 },
    "sementes de erva-doce": { cs: 6, cc: 2 },
    "erva-doce": { cs: 6, cc: 2 },
    "arroz japonês": { xic: 200 },
    "arroz basmati": { xic: 200 },
    // estimados — SEM tabela consolidada, revisar (noção de proporção > nenhum número)
    "açúcar de palma": { cs: 12, cc: 4 }, // EST
    "farinha de mandioca": { cs: 10, cc: 3 }, // EST
    "gochujang": { cs: 20, cc: 7 }, // EST
    "pasta de ají amarillo": { cs: 15, cc: 5 }, // EST
    "pasta de ají panca": { cs: 15, cc: 5 }, // EST
    "pasta de curry verde": { cs: 15, cc: 5 }, // EST
    "pasta de curry vermelho": { cs: 15, cc: 5 }, // EST
    "pasta de curry massaman": { cs: 15, cc: 5 }, // EST
    "pasta de pimenta tailandesa": { cs: 18, cc: 6 }, // EST
    "pasta de feijão fermentado picante": { cs: 18, cc: 6 }, // EST
    "molho de feijão preto fermentado": { cs: 18, cc: 6 }, // EST (pasta de grãos, pote em g)
    "pasta de gengibre e alho": { cs: 15, cc: 5 }, // EST
    "tamarindo": { cs: 15, cc: 5 }, // EST
    "pasta de tamarindo": { cs: 16, cc: 5 }, // EST
    "pimenta síria": { cs: 8, cc: 3 }, // EST
    "pimenta calabresa": { cs: 5, cc: 2 }, // EST
    "pimenta em flocos": { cs: 5, cc: 2 }, // EST
    "zimbro": { cs: 6, cc: 2 }, // EST
    "grãos de pimenta de sichuan": { cs: 6, cc: 2 }, // EST
    "goma xantana": { cs: 9, cc: 3 }, // EST
    "café solúvel": { cs: 2, cc: 1 }, // EST
  };

  // Ervas frescas & afins medidas em colher: a unidade de VENDA é o maço/a fruta, e nem
  // colher nem grama são comparáveis com isso — decisão de 2026-07-23: a colherada vira
  // ocorrência SEM quantidade ("usado em N receitas", mesmo caminho do "a gosto"), na lista
  // principal (é compra de verdade, só sem quantidade útil). Unidades de contagem desses
  // núcleos (talo, ramo, folha) seguem normais.
  const SPOON_NO_QUANTITY = {
    "salsinha": 1, "cebolinha": 1, "salsinha e cebolinha": 1, "ervas frescas": 1,
    "endro": 1, "hortelã": 1, "alecrim": 1, "estragão": 1, "raspas de limão": 1,
  };

  // Gramas de 1 unidade de medida (colher-sopa/colher-cha/xicara) do núcleo, ou null se o
  // núcleo não é sólido tabelado (líquido → ml padrão; pendente → fallback de colher).
  function spoonToGram(core, unit) {
    const t = SPOON_TO_GRAM[String(core || "").trim().toLowerCase()];
    if (!t) return null;
    if (unit === "colher-sopa") return t.cs || null;
    if (unit === "colher-cha") return t.cc || (t.cs ? Math.round(t.cs / 3) : null);
    if (unit === "xicara") return t.xic || (t.cs ? t.cs * 16 : null);
    return null;
  }

  function isSpoonNoQuantity(core) {
    return !!SPOON_NO_QUANTITY[String(core || "").trim().toLowerCase()];
  }

  // ---- Itens vendidos em EMBALAGEM de tamanho padrão universal ----
  // Peso somado vira contagem de embalagens ("2 latas de 400 g de tomate pelado"), sempre
  // arredondando pra CIMA (meia lata não se compra). Só entra aqui tamanho que não varia por
  // marca: tomate pelado é lata de 400 g em qualquer marca. Ficaram FORA por variação real
  // (decisão 2026-07-23, seguem em g/ml): leite de coco (200/400/500 ml), creme de leite
  // (caixinha 200 g vs lata 300 g), azeitonas e alcaparras (vidros de vários tamanhos).
  // Leite condensado não existe no acervo hoje.
  const PACKAGE_SIZE = {
    "tomate pelado": { grams: 400, label: "lata", labelPlural: "latas" },
  };

  function packageFor(core) {
    return PACKAGE_SIZE[String(core || "").trim().toLowerCase()] || null;
  }

  // Pipeline de 3 camadas. Retorna sempre lowercase — é chave de agrupamento e de
  // boughtKeys; quem exibe capitaliza (mesma convenção do formatStructuredItem).
  function purchaseCore(itemText) {
    // Camada 1 — mecânica: lowercase + remove segmentos entre parênteses (no acervo,
    // parêntese é sempre nota de uso ou esclarecimento, nunca identidade sozinha).
    let s = String(itemText || "").trim().toLowerCase();
    s = s.replace(/\s*\([^)]*\)/g, " ").replace(/\s+/g, " ").replace(/[,;\s]+$/, "").trim();
    if (!s) return "";

    // Camada 2 — mapa curado no texto inteiro.
    if (CANONICAL[s]) return CANONICAL[s];

    // Camada 3 — remove modificadores de tamanho/temperatura/estado e reconsulta o mapa.
    let t = s;
    STRIP_PHRASES.forEach(function (p) {
      t = t.split(p).join(" ");
    });
    t = t
      .split(/\s+/)
      .filter(function (w) {
        return w && !STRIP_WORDS[w];
      })
      .join(" ");
    const words = t.split(" ");
    while (words.length > 1 && DANGLING[words[words.length - 1]]) words.pop();
    while (words.length > 1 && DANGLING[words[0]]) words.shift();
    t = words.join(" ").trim();
    if (!t) return s;
    if (CANONICAL[t]) return CANONICAL[t];
    return t;
  }

  return { KNOWN_UNITS: KNOWN_UNITS, CANONICAL: CANONICAL, STRIP_WORDS: STRIP_WORDS, STRIP_PHRASES: STRIP_PHRASES, PLURALS: PLURALS, PANTRY_SET: PANTRY_SET, SPOON_TO_GRAM: SPOON_TO_GRAM, SPOON_NO_QUANTITY: SPOON_NO_QUANTITY, PACKAGE_SIZE: PACKAGE_SIZE, SECTION_ORDER: SECTION_ORDER, SECTION_MAP: SECTION_MAP, SUBPRODUCT_OF: SUBPRODUCT_OF, purchaseCore: purchaseCore, pluralFor: pluralFor, isPantry: isPantry, spoonToGram: spoonToGram, isSpoonNoQuantity: isSpoonNoQuantity, packageFor: packageFor, sectionFor: sectionFor, subproductOf: subproductOf };
});
