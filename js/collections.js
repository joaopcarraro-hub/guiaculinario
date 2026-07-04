// collections.js — coleções são apenas filtros de tags sobre a lista global de receitas.
// Cada coleção antiga (uma por categoria) tem paridade com o app atual (mesmo id/label/icon),
// mas agora também pode receber receitas de outras categorias que compartilhem a tag.
// As coleções novas (grupo "Por proteína" e "Por tempo") só existem por causa do sistema de tags.
(function () {
  window.COLLECTIONS = [
    // ---------- Fundamentos (paridade com as categorias atuais) ----------
    { id: "molhos", group: "Fundamentos", label: "Molhos Clássicos", icon: "🥣", desc: "A base de praticamente toda cozinha ocidental.", primaryFilterTags: ["dish_type:molho"] },
    { id: "sopas", group: "Fundamentos", label: "Sopas", icon: "🍲", primaryFilterTags: ["dish_type:sopa"] },
    { id: "entradas-frias", group: "Fundamentos", label: "Entradas Frias", icon: "🥗", primaryFilterTags: ["dish_type:entrada-fria"] },
    { id: "entradas-quentes", group: "Fundamentos", label: "Entradas Quentes", icon: "🧀", primaryFilterTags: ["dish_type:entrada-quente"] },
    { id: "massas", group: "Fundamentos", label: "Massas", icon: "🍝", primaryFilterTags: ["dish_type:massa"] },
    { id: "risotos", group: "Fundamentos", label: "Risotos", icon: "🍚", primaryFilterTags: ["dish_type:risoto"] },
    { id: "ovos-basicos", group: "Fundamentos", label: "Ovos Básicos", icon: "🍳", primaryFilterTags: ["dish_type:ovo"] },
    { id: "ovos-classicos", group: "Fundamentos", label: "Preparações Clássicas com Ovos", icon: "🥚", primaryFilterTags: ["dish_type:ovo"] },
    { id: "padaria", group: "Fundamentos", label: "Padaria", icon: "🍞", primaryFilterTags: ["dish_type:pao"] },
    { id: "sobremesas-classicas", group: "Fundamentos", label: "Sobremesas Clássicas", icon: "🍰", primaryFilterTags: ["dish_type:sobremesa"] },
    { id: "contemporaneos", group: "Fundamentos", label: "Clássicos Contemporâneos", icon: "✨", primaryFilterTags: ["dish_type:contemporaneo"] },
    { id: "tecnicas-contemporaneas-2", group: "Fundamentos", label: "Técnicas Contemporâneas Avançadas", icon: "🧪", primaryFilterTags: ["dish_type:tecnica-avancada"] },

    // ---------- Proteínas (paridade) ----------
    { id: "aves", group: "Proteínas", label: "Aves", icon: "🍗", primaryFilterTags: ["protein:ave", "protein:frango"], defaultView: "primary" },
    { id: "carnes-bovinas", group: "Proteínas", label: "Carnes Bovinas", icon: "🥩", primaryFilterTags: ["protein:boi"], defaultView: "primary" },
    { id: "cordeiro", group: "Proteínas", label: "Cordeiro", icon: "🐑", primaryFilterTags: ["protein:cordeiro"], defaultView: "primary" },
    { id: "suinos", group: "Proteínas", label: "Suínos", icon: "🐖", desc: "Receitas com carne suína, embutidos ou derivados.", primaryFilterTags: ["protein:suino"], relatedFilterTags: ["contains:suino"], defaultView: "primary" },
    { id: "peixes", group: "Proteínas", label: "Peixes", icon: "🐟", primaryFilterTags: ["protein:peixe"], defaultView: "primary" },
    { id: "frutos-do-mar", group: "Proteínas", label: "Frutos do Mar", icon: "🦐", primaryFilterTags: ["protein:frutos-do-mar"], defaultView: "primary" },
    { id: "arrozes", group: "Proteínas", label: "Arrozes", icon: "🍚", primaryFilterTags: ["dish_type:arroz"] },

    // ---------- Brasil (paridade) ----------
    { id: "brasileiros", group: "Brasil", label: "Brasileiros Obrigatórios", icon: "🇧🇷", primaryFilterTags: ["country:brasil"] },
    { id: "brasil-regional", group: "Brasil", label: "Brasil por Região", icon: "🗺️", primaryFilterTags: ["country:brasil"] },

    // ---------- Cozinhas do Mundo (paridade) ----------
    { id: "franca", group: "Cozinhas do Mundo", label: "França", icon: "🇫🇷", primaryFilterTags: ["country:franca"] },
    { id: "italia", group: "Cozinhas do Mundo", label: "Itália", icon: "🇮🇹", primaryFilterTags: ["country:italia"] },
    { id: "espanha", group: "Cozinhas do Mundo", label: "Espanha", icon: "🇪🇸", primaryFilterTags: ["country:espanha"] },
    { id: "portugal", group: "Cozinhas do Mundo", label: "Portugal", icon: "🇵🇹", primaryFilterTags: ["country:portugal"] },
    { id: "japao", group: "Cozinhas do Mundo", label: "Japão", icon: "🇯🇵", primaryFilterTags: ["country:japao"] },
    { id: "china", group: "Cozinhas do Mundo", label: "China", icon: "🇨🇳", primaryFilterTags: ["country:china"] },
    { id: "coreia", group: "Cozinhas do Mundo", label: "Coreia", icon: "🇰🇷", primaryFilterTags: ["country:coreia"] },
    { id: "tailandia", group: "Cozinhas do Mundo", label: "Tailândia", icon: "🇹🇭", primaryFilterTags: ["country:tailandia"] },
    { id: "india", group: "Cozinhas do Mundo", label: "Índia", icon: "🇮🇳", primaryFilterTags: ["country:india"] },
    { id: "mexico", group: "Cozinhas do Mundo", label: "México", icon: "🇲🇽", primaryFilterTags: ["country:mexico"] },
    { id: "peru", group: "Cozinhas do Mundo", label: "Peru", icon: "🇵🇪", primaryFilterTags: ["country:peru"] },
    { id: "alemanha", group: "Cozinhas do Mundo", label: "Alemanha", icon: "🇩🇪", primaryFilterTags: ["country:alemanha"] },
    { id: "austria", group: "Cozinhas do Mundo", label: "Áustria", icon: "🇦🇹", primaryFilterTags: ["country:austria"] },
    { id: "hungria", group: "Cozinhas do Mundo", label: "Hungria", icon: "🇭🇺", primaryFilterTags: ["country:hungria"] },
    { id: "grecia", group: "Cozinhas do Mundo", label: "Grécia", icon: "🇬🇷", primaryFilterTags: ["country:grecia"] },
    { id: "marrocos", group: "Cozinhas do Mundo", label: "Marrocos", icon: "🇲🇦", primaryFilterTags: ["country:marrocos"] },
    { id: "libano", group: "Cozinhas do Mundo", label: "Líbano", icon: "🇱🇧", primaryFilterTags: ["country:libano"] },
    { id: "eua", group: "Cozinhas do Mundo", label: "EUA", icon: "🇺🇸", primaryFilterTags: ["country:eua"] },
    { id: "dinamarca", group: "Cozinhas do Mundo", label: "Dinamarca", icon: "🇩🇰", primaryFilterTags: ["country:dinamarca"] },

    // ---------- Novas coleções cruzadas (só existem graças às tags) ----------
    { id: "col-frango", group: "Por proteína", label: "Frango", icon: "🍗", primaryFilterTags: ["protein:frango"] },
    { id: "col-suino", group: "Por proteína", label: "Suíno (todas)", icon: "🐖", primaryFilterTags: ["protein:suino"] },
    { id: "col-boi", group: "Por proteína", label: "Carne Bovina (todas)", icon: "🥩", primaryFilterTags: ["protein:boi"] },
    { id: "col-peixe", group: "Por proteína", label: "Peixe (todas)", icon: "🐟", primaryFilterTags: ["protein:peixe"] },
    { id: "col-frutos-do-mar", group: "Por proteína", label: "Frutos do Mar (todas)", icon: "🦐", primaryFilterTags: ["protein:frutos-do-mar"] },
    { id: "col-vegetariana", group: "Por proteína", label: "Vegetarianas", icon: "🥬", primaryFilterTags: ["protein:vegetariana"] },
    { id: "col-com-ovo", group: "Por proteína", label: "Com Ovo", icon: "🥚", primaryFilterTags: ["ingredient:ovo"] },

    { id: "col-rapidas", group: "Por tempo", label: "Até 30 min", icon: "⏱️", primaryFilterTags: ["time:ate-30-min"] },
    { id: "col-faceis", group: "Por dificuldade", label: "Fáceis", icon: "👍", primaryFilterTags: ["difficulty:facil"] },
  ];
})();
