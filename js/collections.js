// collections.js — coleções são apenas filtros de tags sobre a lista global de receitas.
// Cada coleção antiga (uma por categoria) tem paridade com o app atual (mesmo id/label/icon),
// mas agora também pode receber receitas de outras categorias que compartilhem a tag.
// As coleções novas (grupo "Por proteína" e "Por tempo") só existem por causa do sistema de tags.
(function () {
  window.COLLECTIONS = [
    // ---------- Fundamentos (paridade com as categorias atuais) ----------
    { id: "molhos", group: "Fundamentos", label: "Molhos Clássicos", icon: "🥣", desc: "A base de praticamente toda cozinha ocidental.", filterTags: ["dish_type:molho"] },
    { id: "sopas", group: "Fundamentos", label: "Sopas", icon: "🍲", filterTags: ["dish_type:sopa"] },
    { id: "entradas-frias", group: "Fundamentos", label: "Entradas Frias", icon: "🥗", filterTags: ["dish_type:entrada-fria"] },
    { id: "entradas-quentes", group: "Fundamentos", label: "Entradas Quentes", icon: "🧀", filterTags: ["dish_type:entrada-quente"] },
    { id: "massas", group: "Fundamentos", label: "Massas", icon: "🍝", filterTags: ["dish_type:massa"] },
    { id: "risotos", group: "Fundamentos", label: "Risotos", icon: "🍚", filterTags: ["dish_type:risoto"] },
    { id: "ovos-basicos", group: "Fundamentos", label: "Ovos Básicos", icon: "🍳", filterTags: ["dish_type:ovo"] },
    { id: "ovos-classicos", group: "Fundamentos", label: "Preparações Clássicas com Ovos", icon: "🥚", filterTags: ["dish_type:ovo"] },
    { id: "padaria", group: "Fundamentos", label: "Padaria", icon: "🍞", filterTags: ["dish_type:pao"] },
    { id: "sobremesas-classicas", group: "Fundamentos", label: "Sobremesas Clássicas", icon: "🍰", filterTags: ["dish_type:sobremesa"] },
    { id: "contemporaneos", group: "Fundamentos", label: "Clássicos Contemporâneos", icon: "✨", filterTags: ["dish_type:contemporaneo"] },
    { id: "tecnicas-contemporaneas-2", group: "Fundamentos", label: "Técnicas Contemporâneas Avançadas", icon: "🧪", filterTags: ["dish_type:tecnica-avancada"] },

    // ---------- Proteínas (paridade) ----------
    { id: "aves", group: "Proteínas", label: "Aves", icon: "🍗", filterTags: ["protein:ave"] },
    { id: "carnes-bovinas", group: "Proteínas", label: "Carnes Bovinas", icon: "🥩", filterTags: ["protein:boi"] },
    { id: "cordeiro", group: "Proteínas", label: "Cordeiro", icon: "🐑", filterTags: ["protein:cordeiro"] },
    { id: "suinos", group: "Proteínas", label: "Suínos", icon: "🐖", filterTags: ["protein:suino"] },
    { id: "peixes", group: "Proteínas", label: "Peixes", icon: "🐟", filterTags: ["protein:peixe"] },
    { id: "frutos-do-mar", group: "Proteínas", label: "Frutos do Mar", icon: "🦐", filterTags: ["protein:frutos-do-mar"] },
    { id: "arrozes", group: "Proteínas", label: "Arrozes", icon: "🍚", filterTags: ["dish_type:arroz"] },

    // ---------- Brasil (paridade) ----------
    { id: "brasileiros", group: "Brasil", label: "Brasileiros Obrigatórios", icon: "🇧🇷", filterTags: ["country:brasil"] },
    { id: "brasil-regional", group: "Brasil", label: "Brasil por Região", icon: "🗺️", filterTags: ["country:brasil"] },

    // ---------- Cozinhas do Mundo (paridade) ----------
    { id: "franca", group: "Cozinhas do Mundo", label: "França", icon: "🇫🇷", filterTags: ["country:franca"] },
    { id: "italia", group: "Cozinhas do Mundo", label: "Itália", icon: "🇮🇹", filterTags: ["country:italia"] },
    { id: "espanha", group: "Cozinhas do Mundo", label: "Espanha", icon: "🇪🇸", filterTags: ["country:espanha"] },
    { id: "portugal", group: "Cozinhas do Mundo", label: "Portugal", icon: "🇵🇹", filterTags: ["country:portugal"] },
    { id: "japao", group: "Cozinhas do Mundo", label: "Japão", icon: "🇯🇵", filterTags: ["country:japao"] },
    { id: "china", group: "Cozinhas do Mundo", label: "China", icon: "🇨🇳", filterTags: ["country:china"] },
    { id: "coreia", group: "Cozinhas do Mundo", label: "Coreia", icon: "🇰🇷", filterTags: ["country:coreia"] },
    { id: "tailandia", group: "Cozinhas do Mundo", label: "Tailândia", icon: "🇹🇭", filterTags: ["country:tailandia"] },
    { id: "india", group: "Cozinhas do Mundo", label: "Índia", icon: "🇮🇳", filterTags: ["country:india"] },
    { id: "mexico", group: "Cozinhas do Mundo", label: "México", icon: "🇲🇽", filterTags: ["country:mexico"] },
    { id: "peru", group: "Cozinhas do Mundo", label: "Peru", icon: "🇵🇪", filterTags: ["country:peru"] },
    { id: "alemanha", group: "Cozinhas do Mundo", label: "Alemanha", icon: "🇩🇪", filterTags: ["country:alemanha"] },
    { id: "austria", group: "Cozinhas do Mundo", label: "Áustria", icon: "🇦🇹", filterTags: ["country:austria"] },
    { id: "hungria", group: "Cozinhas do Mundo", label: "Hungria", icon: "🇭🇺", filterTags: ["country:hungria"] },
    { id: "grecia", group: "Cozinhas do Mundo", label: "Grécia", icon: "🇬🇷", filterTags: ["country:grecia"] },
    { id: "marrocos", group: "Cozinhas do Mundo", label: "Marrocos", icon: "🇲🇦", filterTags: ["country:marrocos"] },
    { id: "libano", group: "Cozinhas do Mundo", label: "Líbano", icon: "🇱🇧", filterTags: ["country:libano"] },
    { id: "eua", group: "Cozinhas do Mundo", label: "EUA", icon: "🇺🇸", filterTags: ["country:eua"] },
    { id: "dinamarca", group: "Cozinhas do Mundo", label: "Dinamarca", icon: "🇩🇰", filterTags: ["country:dinamarca"] },

    // ---------- Novas coleções cruzadas (só existem graças às tags) ----------
    { id: "col-frango", group: "Por proteína", label: "Frango", icon: "🍗", filterTags: ["protein:frango"] },
    { id: "col-suino", group: "Por proteína", label: "Suíno (todas)", icon: "🐖", filterTags: ["protein:suino"] },
    { id: "col-boi", group: "Por proteína", label: "Carne Bovina (todas)", icon: "🥩", filterTags: ["protein:boi"] },
    { id: "col-peixe", group: "Por proteína", label: "Peixe (todas)", icon: "🐟", filterTags: ["protein:peixe"] },
    { id: "col-frutos-do-mar", group: "Por proteína", label: "Frutos do Mar (todas)", icon: "🦐", filterTags: ["protein:frutos-do-mar"] },
    { id: "col-vegetariana", group: "Por proteína", label: "Vegetarianas", icon: "🥬", filterTags: ["protein:vegetariana"] },
    { id: "col-com-ovo", group: "Por proteína", label: "Com Ovo", icon: "🥚", filterTags: ["ingredient:ovo"] },

    { id: "col-rapidas", group: "Por tempo", label: "Até 30 min", icon: "⏱️", filterTags: ["time:ate-30-min"] },
    { id: "col-faceis", group: "Por dificuldade", label: "Fáceis", icon: "👍", filterTags: ["difficulty:facil"] },
  ];
})();
