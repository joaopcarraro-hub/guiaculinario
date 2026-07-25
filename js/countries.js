// Fonte única dos 20 países do acervo — nome, emoji de bandeira e ISO 3166-1 alpha-2.
// Antes desta Fase 0c, a mesma lista de 20 bandeiras existia solta em 3 lugares
// (js/categories.js, js/collections.js e COUNTRY_FLAG_EMOJI em js/app.js) sem fonte única.
// Consumida por esses 3 arquivos — precisa carregar ANTES deles (ver index.html).
window.COUNTRIES = {
  brasil: { nome: "Brasil", emoji: "🇧🇷", iso2: "BR" },
  franca: { nome: "França", emoji: "🇫🇷", iso2: "FR" },
  italia: { nome: "Itália", emoji: "🇮🇹", iso2: "IT" },
  espanha: { nome: "Espanha", emoji: "🇪🇸", iso2: "ES" },
  portugal: { nome: "Portugal", emoji: "🇵🇹", iso2: "PT" },
  japao: { nome: "Japão", emoji: "🇯🇵", iso2: "JP" },
  china: { nome: "China", emoji: "🇨🇳", iso2: "CN" },
  coreia: { nome: "Coreia", emoji: "🇰🇷", iso2: "KR" },
  tailandia: { nome: "Tailândia", emoji: "🇹🇭", iso2: "TH" },
  india: { nome: "Índia", emoji: "🇮🇳", iso2: "IN" },
  mexico: { nome: "México", emoji: "🇲🇽", iso2: "MX" },
  peru: { nome: "Peru", emoji: "🇵🇪", iso2: "PE" },
  alemanha: { nome: "Alemanha", emoji: "🇩🇪", iso2: "DE" },
  austria: { nome: "Áustria", emoji: "🇦🇹", iso2: "AT" },
  hungria: { nome: "Hungria", emoji: "🇭🇺", iso2: "HU" },
  grecia: { nome: "Grécia", emoji: "🇬🇷", iso2: "GR" },
  marrocos: { nome: "Marrocos", emoji: "🇲🇦", iso2: "MA" },
  libano: { nome: "Líbano", emoji: "🇱🇧", iso2: "LB" },
  eua: { nome: "EUA", emoji: "🇺🇸", iso2: "US" },
  dinamarca: { nome: "Dinamarca", emoji: "🇩🇰", iso2: "DK" },
};
