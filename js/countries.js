// Fonte única dos 20 países do acervo — nome, emoji de bandeira e ISO 3166-1 alpha-2.
// Antes desta Fase 0c, a mesma lista de 20 bandeiras existia solta em 3 lugares
// (js/categories.js, js/collections.js e COUNTRY_FLAG_EMOJI em js/app.js) sem fonte única.
// Consumida por esses 3 arquivos — precisa carregar ANTES deles (ver index.html).
// -------------------------------------------------------------------------------------------------
// signatureRecipe — a RECEITA-ASSINATURA de cada país (rumo novo de Países, 26/07/2026)
//
// O tile do hub Países deixou de usar bandeira e passou a usar a FOTO da receita que mais
// caracteriza o país. Bandeira sobrevive só na faceta País do modal de Filtros.
//
// É MAPA CURADO, não derivado. Não existe regra que escolha isto: "qual prato um brasileiro
// reconhece de relance como daquele país" é julgamento humano, e a §4 do contrato registra Países
// como EXCEÇÃO documentada à regra "nenhuma receita representa categoria" — que continua valendo
// para todas as outras categorias.
//
// ATENÇÃO — RESOLVE CONTRA O ACERVO INTEIRO, NUNCA CONTRA RECIPES[catId].
// (Sem emoji nem em comentário: scripts/verify-emoji-fase0c-2026-07-25.js exige EXATAMENTE 40
// code points neste arquivo — os 20 emoji de bandeira x 2 — e conta o arquivo inteiro, não só
// o código. Um "atenção" decorativo aqui reprova a suíte.)
// CINCO dos vinte apontam para receita que mora FORA da categoria do próprio país: Feijoada está
// em brasileiros, Croissant em padaria, Carbonara em massas, Paella em frutos-do-mar e Goulash em
// carnes-bovinas. (Esta contagem dizia "quatro" e omitia Feijoada — corrigida na implementação,
// contra o acervo carregado de verdade.) Quem implementar buscando dentro da categoria do país
// deixa esses cinco sem foto — e sem erro no console, que é o modo de falha caro deste projeto.
// scripts/verify-categoria-tiles-2026-07-26.js §7 falha se qualquer um dos 20 não resolver,
// resolver ambíguo (2+ receitas com o mesmo nome) ou não tiver .webp em disco.
//
// TROCAR É BARATO: é só mudar o nome aqui. Candidatas-reserva avaliadas e descartadas ficam
// anotadas em cada linha, para a próxima troca não recomeçar a análise do zero.
// -------------------------------------------------------------------------------------------------
window.COUNTRIES = {
  brasil:     { nome: "Brasil",    emoji: "🇧🇷", iso2: "BR", signatureRecipe: "Feijoada" },
  // Croissant (padaria) escolhido pela frente de design sobre Bœuf Bourguignon: num tile a FORMA
  // decide, e croissant lê França em meio segundo — ensopado escuro não. Reserva: Crème Brûlée.
  franca:     { nome: "França",    emoji: "🇫🇷", iso2: "FR", signatureRecipe: "Croissant" },
  italia:     { nome: "Itália",    emoji: "🇮🇹", iso2: "IT", signatureRecipe: "Carbonara" },
  espanha:    { nome: "Espanha",   emoji: "🇪🇸", iso2: "ES", signatureRecipe: "Paella" },
  // Reserva: Bacalhau com Natas.
  portugal:   { nome: "Portugal",  emoji: "🇵🇹", iso2: "PT", signatureRecipe: "Pastel de Nata" },
  // Reservas: Temaki, Ramen.
  japao:      { nome: "Japão",     emoji: "🇯🇵", iso2: "JP", signatureRecipe: "Arroz de Sushi (Shari) e Nigiri" },
  // Pato Laqueado é mais icônico, mas o que o brasileiro reconhece de restaurante chinês é frango
  // salteado. Reservas: Pato Laqueado (Pequim), Chow Mein.
  china:      { nome: "China",     emoji: "🇨🇳", iso2: "CN", signatureRecipe: "Frango Kung Pao" },
  coreia:     { nome: "Coreia",    emoji: "🇰🇷", iso2: "KR", signatureRecipe: "Bibimbap" },
  tailandia:  { nome: "Tailândia", emoji: "🇹🇭", iso2: "TH", signatureRecipe: "Pad Thai" },
  india:      { nome: "Índia",     emoji: "🇮🇳", iso2: "IN", signatureRecipe: "Butter Chicken (Murgh Makhani)" },
  // Tacos al Pastor sobre Chiles Rellenos: lê México mais rápido. Reserva: Chiles Rellenos.
  mexico:     { nome: "México",    emoji: "🇲🇽", iso2: "MX", signatureRecipe: "Tacos al Pastor" },
  peru:       { nome: "Peru",      emoji: "🇵🇪", iso2: "PE", signatureRecipe: "Ají de Gallina" },
  // Sauerbraten é desconhecido no Brasil; Eisbein é joelho de porco — associação direta com
  // Oktoberfest/Blumenau. Reserva: Sauerbraten.
  alemanha:   { nome: "Alemanha",  emoji: "🇩🇪", iso2: "DE", signatureRecipe: "Eisbein" },
  austria:    { nome: "Áustria",   emoji: "🇦🇹", iso2: "AT", signatureRecipe: "Wiener Schnitzel" },
  // A categoria hungria só tem Frango Paprikash e Lángos. O prato húngaro que o brasileiro conhece
  // é Goulash, e ele mora em carnes-bovinas. Reserva: Lángos.
  hungria:    { nome: "Hungria",   emoji: "🇭🇺", iso2: "HU", signatureRecipe: "Goulash" },
  grecia:     { nome: "Grécia",    emoji: "🇬🇷", iso2: "GR", signatureRecipe: "Moussaka" },
  marrocos:   { nome: "Marrocos",  emoji: "🇲🇦", iso2: "MA", signatureRecipe: "Tajine de Cordeiro com Damasco" },
  // Reserva: Quibe Frito.
  libano:     { nome: "Líbano",    emoji: "🇱🇧", iso2: "LB", signatureRecipe: "Hommus" },
  // Beef Brisket tem a foto mais bonita do acervo, mas frango frito lê EUA mais rápido.
  // Reservas: Beef Brisket, Mac and Cheese.
  eua:        { nome: "EUA",       emoji: "🇺🇸", iso2: "US", signatureRecipe: "Frango Frito Americano" },
  // 44 receitas e nenhuma de reconhecimento imediato no Brasil. O smørrebrød é o ícone nacional;
  // a versão de camarão é a mais distinta visualmente. Reserva: Wienerbrød.
  dinamarca:  { nome: "Dinamarca", emoji: "🇩🇰", iso2: "DK", signatureRecipe: "Sanduíche Aberto de Camarão" },
};
