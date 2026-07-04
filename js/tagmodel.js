// tagmodel.js — camada de tags/coleções sobre os dados existentes (window.RECIPES/window.CATEGORIES).
// Não duplica o conteúdo das receitas: id e boa parte das tags são derivados em tempo de execução.
// Cada receita pode ter um campo opcional `tags` (só protein:/ingredient:, atribuído manualmente
// nos arquivos data/*.js) — as demais tags (country/dish_type/course/time/difficulty) são automáticas.
(function () {
  // ---------- tags automáticas por categoria (dish_type / course / country / protein "base") ----------
  const CATEGORY_BASE_TAGS = {
    // Fundamentos
    molhos: ["dish_type:molho", "course:acompanhamento"],
    sopas: ["dish_type:sopa", "course:entrada"],
    "entradas-frias": ["dish_type:entrada-fria", "course:entrada"],
    "entradas-quentes": ["dish_type:entrada-quente", "course:entrada"],
    massas: ["dish_type:massa", "course:principal"],
    risotos: ["dish_type:risoto", "course:principal"],
    "ovos-basicos": ["dish_type:ovo", "course:principal"],
    "ovos-classicos": ["dish_type:ovo", "course:principal"],
    padaria: ["dish_type:pao", "course:cafe-da-manha"],
    "sobremesas-classicas": ["dish_type:sobremesa", "course:sobremesa"],
    contemporaneos: ["dish_type:contemporaneo", "course:principal"],
    "tecnicas-contemporaneas-2": ["dish_type:tecnica-avancada", "course:principal"],
    // Proteínas (a categoria já indica a proteína principal)
    aves: ["protein:ave", "course:principal"],
    "carnes-bovinas": ["protein:boi", "course:principal"],
    cordeiro: ["protein:cordeiro", "course:principal"],
    suinos: ["protein:suino", "course:principal"],
    peixes: ["protein:peixe", "course:principal"],
    "frutos-do-mar": ["protein:frutos-do-mar", "course:principal"],
    arrozes: ["dish_type:arroz", "course:acompanhamento"],
    // Brasil
    brasileiros: ["country:brasil"],
    "brasil-regional": ["country:brasil"],
    // Cozinhas do Mundo — country:<id> direto
    franca: ["country:franca"],
    italia: ["country:italia"],
    espanha: ["country:espanha"],
    portugal: ["country:portugal"],
    japao: ["country:japao"],
    china: ["country:china"],
    coreia: ["country:coreia"],
    tailandia: ["country:tailandia"],
    india: ["country:india"],
    mexico: ["country:mexico"],
    peru: ["country:peru"],
    alemanha: ["country:alemanha"],
    austria: ["country:austria"],
    hungria: ["country:hungria"],
    grecia: ["country:grecia"],
    marrocos: ["country:marrocos"],
    libano: ["country:libano"],
    eua: ["country:eua"],
    dinamarca: ["country:dinamarca"],
  };

  // país mencionado no campo livre `origin` (para receitas de categorias não-país, ex.: Carbonara em "massas")
  const ORIGIN_COUNTRY_MATCHERS = [
    ["Brasil", "country:brasil"],
    ["França", "country:franca"],
    ["Itália", "country:italia"],
    ["Espanha", "country:espanha"],
    ["Portugal", "country:portugal"],
    ["Japão", "country:japao"],
    ["China", "country:china"],
    ["Coreia", "country:coreia"],
    ["Tailândia", "country:tailandia"],
    ["Índia", "country:india"],
    ["México", "country:mexico"],
    ["Peru", "country:peru"],
    ["Alemanha", "country:alemanha"],
    ["Áustria", "country:austria"],
    ["Hungria", "country:hungria"],
    ["Grécia", "country:grecia"],
    ["Marrocos", "country:marrocos"],
    ["Líbano", "country:libano"],
    ["Estados Unidos", "country:eua"],
    ["Dinamarca", "country:dinamarca"],
  ];

  function deriveCountryTagsFromOrigin(origin) {
    if (!origin) return [];
    const found = [];
    ORIGIN_COUNTRY_MATCHERS.forEach(([name, tagId]) => {
      if (origin.indexOf(name) !== -1 && found.indexOf(tagId) === -1) found.push(tagId);
    });
    return found;
  }

  function parseMinutes(timeStr) {
    if (!timeStr) return null;
    const text = timeStr
      .toString()
      .toLowerCase()
      .replace("≈", "")
      .replace("cerca de", "")
      .replace("aprox.", "")
      .replace("aproximadamente", "")
      .trim();
    let total = 0;
    const hMatch = text.match(/(\d+)\s*h/);
    const mMatch = text.match(/(\d+)\s*min/);
    if (hMatch) total += parseInt(hMatch[1], 10) * 60;
    if (mMatch) total += parseInt(mMatch[1], 10);
    if (!hMatch && !mMatch) {
      const numericOnly = text.match(/^(\d+)$/);
      if (numericOnly) return parseInt(numericOnly[1], 10);
      return null;
    }
    return total;
  }

  // Cumulativo: uma receita de 10 min é "até 15 min" E "até 30 min" E "até 1h" —
  // assim uma coleção "Até 30 min" (filterTags: ["time:ate-30-min"]) já inclui receitas mais rápidas.
  function deriveTimeTags(recipe) {
    const totalStr = recipe.time && recipe.time.total;
    const minutes = parseMinutes(totalStr);
    if (minutes === null) return [];
    const tags = [];
    if (minutes <= 15) tags.push("time:ate-15-min");
    if (minutes <= 30) tags.push("time:ate-30-min");
    if (minutes <= 60) tags.push("time:ate-1h");
    if (minutes > 60) tags.push("time:mais-de-1h");
    return tags;
  }

  function deriveDifficultyTag(recipe) {
    const d = (recipe.difficulty || "").toLowerCase();
    if (!d) return null;
    if (d.indexOf("difícil") !== -1) return "difficulty:dificil";
    if (d.indexOf("média") !== -1) return "difficulty:media";
    if (d.indexOf("fácil") !== -1) return "difficulty:facil";
    return null;
  }

  // ---------- tags completas de uma receita (automáticas + manuais) ----------
  function getRecipeTags(catId, recipe) {
    const auto = (CATEGORY_BASE_TAGS[catId] || []).slice();
    deriveCountryTagsFromOrigin(recipe.origin).forEach((t) => {
      if (auto.indexOf(t) === -1) auto.push(t);
    });
    deriveTimeTags(recipe).forEach((t) => {
      if (auto.indexOf(t) === -1) auto.push(t);
    });
    const diffTag = deriveDifficultyTag(recipe);
    if (diffTag) auto.push(diffTag);
    const manual = recipe.tags || [];
    manual.forEach((t) => {
      if (auto.indexOf(t) === -1) auto.push(t);
    });
    return auto;
  }

  // ---------- id único por receita (slug do nome, com desempate por categoria) ----------
  // Letras nórdicas (ø/å/æ) não têm forma decomposta em NFD, então são tratadas à parte.
  const EXTRA_LETTER_MAP = { "ø": "o", "å": "a", "æ": "ae" };
  function slugify(str) {
    return str
      .toString()
      .toLowerCase()
      .replace(/[øåæ]/g, (ch) => EXTRA_LETTER_MAP[ch] || ch)
      .normalize("NFD")
      .replace(new RegExp("[" + String.fromCharCode(92) + "u0300-" + String.fromCharCode(92) + "u036f]", "g"), "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  let flatCache = null;
  function getAllRecipesFlat() {
    if (flatCache) return flatCache;
    const seenIds = {};
    const list = [];
    Object.keys(window.RECIPES || {}).forEach((catId) => {
      (window.RECIPES[catId] || []).forEach((recipe) => {
        let id = slugify(recipe.name);
        if (seenIds[id]) {
          id = slugify(recipe.name + "-" + catId);
        }
        seenIds[id] = true;
        list.push({
          id: id,
          catId: catId,
          recipe: recipe,
          tags: getRecipeTags(catId, recipe),
        });
      });
    });
    flatCache = list;
    return list;
  }

  // ---------- consultas ----------
  function getTagById(tagId) {
    return (window.TAGS || []).find((t) => t.id === tagId);
  }

  // AND — usado pela busca facetada (o usuário escolhe cada tag deliberadamente, quer todas juntas).
  function getRecipesByTags(tagIds) {
    const all = getAllRecipesFlat();
    if (!tagIds || !tagIds.length) return all;
    return all.filter((item) => tagIds.every((tagId) => item.tags.indexOf(tagId) !== -1));
  }

  // OR — usado pelas coleções (uma coleção é definida por "qualquer uma destas tags", não todas).
  function matchesAnyTag(itemTags, filterTags) {
    return (filterTags || []).some((tagId) => itemTags.indexOf(tagId) !== -1);
  }

  // Retorna as receitas de uma coleção já separadas por relevância:
  // principais (bateram em primaryFilterTags) e relacionadas (só bateram em relatedFilterTags).
  function getRecipesByCollection(collectionId) {
    const collection = (window.COLLECTIONS || []).find((c) => c.id === collectionId);
    if (!collection) return { collection: null, primaryRecipes: [], relatedRecipes: [], allRecipes: [] };
    const all = getAllRecipesFlat();
    const primaryRecipes = all.filter((item) => matchesAnyTag(item.tags, collection.primaryFilterTags));
    const primaryIds = new Set(primaryRecipes.map((item) => item.id));
    const relatedRecipes = collection.relatedFilterTags
      ? all.filter((item) => !primaryIds.has(item.id) && matchesAnyTag(item.tags, collection.relatedFilterTags))
      : [];
    return { collection, primaryRecipes, relatedRecipes, allRecipes: primaryRecipes.concat(relatedRecipes) };
  }

  // ---------- relevância e ordenação ----------
  function getCollectionRelevanceScore(item, collection) {
    if (!collection) return 0;
    let score = 0;
    if (matchesAnyTag(item.tags, collection.primaryFilterTags)) score += 100;
    if (collection.relatedFilterTags && matchesAnyTag(item.tags, collection.relatedFilterTags)) score += 40;
    return score;
  }

  const DIFFICULTY_RANK = { facil: 1, media: 2, dificil: 3 };
  function getDifficultyRank(recipe) {
    const d = (recipe.difficulty || "").toLowerCase();
    if (d.indexOf("difícil") !== -1 || d.indexOf("dificil") !== -1) return 3;
    if (d.indexOf("média") !== -1 || d.indexOf("media") !== -1) return 2;
    if (d.indexOf("fácil") !== -1 || d.indexOf("facil") !== -1) return 1;
    return 99;
  }

  function normalizeForSort(value) {
    return (value || "")
      .toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(new RegExp("[" + String.fromCharCode(92) + "u0300-" + String.fromCharCode(92) + "u036f]", "g"), "");
  }

  const SORT_OPTIONS = [
    { key: "relevance", label: "Relevância" },
    { key: "category-az", label: "Categoria original" },
    { key: "recipe-az", label: "Nome da receita A-Z" },
    { key: "time-asc", label: "Tempo: menor primeiro" },
    { key: "time-desc", label: "Tempo: maior primeiro" },
    { key: "difficulty-asc", label: "Dificuldade: fácil primeiro" },
    { key: "difficulty-desc", label: "Dificuldade: difícil primeiro" },
    { key: "favorites-first", label: "Favoritas primeiro" },
    { key: "not-made-first", label: "Não feitas primeiro" },
  ];

  function getCategoryLabel(item) {
    const cat = (window.CATEGORIES || []).find((c) => c.id === item.catId);
    return cat ? cat.label : item.catId || "";
  }

  function sortRecipeItems(items, sortKey, collection) {
    const sorted = items.slice();
    const Storage = window.Storage;
    sorted.sort((a, b) => {
      if (sortKey === "category-az") {
        return (
          normalizeForSort(getCategoryLabel(a)).localeCompare(normalizeForSort(getCategoryLabel(b))) ||
          normalizeForSort(a.recipe.name).localeCompare(normalizeForSort(b.recipe.name))
        );
      }
      if (sortKey === "recipe-az") {
        return normalizeForSort(a.recipe.name).localeCompare(normalizeForSort(b.recipe.name));
      }
      if (sortKey === "time-asc" || sortKey === "time-desc") {
        const ta = parseMinutes(a.recipe.time && a.recipe.time.total);
        const tb = parseMinutes(b.recipe.time && b.recipe.time.total);
        const va = ta === null ? 99999 : ta;
        const vb = tb === null ? 99999 : tb;
        return sortKey === "time-asc" ? va - vb : vb - va;
      }
      if (sortKey === "difficulty-asc") return getDifficultyRank(a.recipe) - getDifficultyRank(b.recipe);
      if (sortKey === "difficulty-desc") return getDifficultyRank(b.recipe) - getDifficultyRank(a.recipe);
      if (sortKey === "favorites-first" && Storage) {
        return Number(Storage.isFavorite(b.id)) - Number(Storage.isFavorite(a.id));
      }
      if (sortKey === "not-made-first" && Storage) {
        return Number(Storage.isMade(a.id)) - Number(Storage.isMade(b.id));
      }
      // relevância (padrão)
      return getCollectionRelevanceScore(b, collection) - getCollectionRelevanceScore(a, collection);
    });
    return sorted;
  }

  // ---------- preferência de ordenação por coleção (localStorage) ----------
  const SORT_PREF_KEY = "cardapio-collection-sort";
  function getCollectionSort(collectionId) {
    try {
      const raw = localStorage.getItem(SORT_PREF_KEY);
      if (!raw) return null;
      return JSON.parse(raw)[collectionId] || null;
    } catch (e) {
      return null;
    }
  }
  function setCollectionSort(collectionId, sortKey) {
    try {
      const raw = localStorage.getItem(SORT_PREF_KEY);
      const data = raw ? JSON.parse(raw) : {};
      data[collectionId] = sortKey;
      localStorage.setItem(SORT_PREF_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function getRelatedTags(selectedTagIds) {
    const filtered = getRecipesByTags(selectedTagIds);
    const counts = {};
    filtered.forEach((item) => {
      item.tags.forEach((tagId) => {
        if (selectedTagIds.indexOf(tagId) !== -1) return;
        counts[tagId] = (counts[tagId] || 0) + 1;
      });
    });
    return Object.keys(counts)
      .map((tagId) => ({ tag: getTagById(tagId), count: counts[tagId] }))
      .filter((item) => item.tag)
      .sort((a, b) => b.count - a.count);
  }

  function findRecipeById(id) {
    return getAllRecipesFlat().find((item) => item.id === id);
  }

  // usado para migrar chaves antigas ("catId::nome") e para casar resultados do search.js
  function getIdForCatAndName(catId, name) {
    const item = getAllRecipesFlat().find((i) => i.catId === catId && i.recipe.name === name);
    return item ? item.id : null;
  }

  // ---------- validação (uso manual/console, não roda em produção) ----------
  function validateRecipeTags() {
    const validIds = new Set((window.TAGS || []).map((t) => t.id));
    const errors = [];
    getAllRecipesFlat().forEach((item) => {
      (item.recipe.tags || []).forEach((tagId) => {
        if (!validIds.has(tagId)) {
          errors.push({ id: item.id, catId: item.catId, name: item.recipe.name, invalidTagId: tagId });
        }
      });
    });
    return errors;
  }

  function findDuplicateIds() {
    const all = getAllRecipesFlat();
    const seen = {};
    const dupes = [];
    all.forEach((item) => {
      if (seen[item.id]) dupes.push(item.id);
      seen[item.id] = true;
    });
    return dupes;
  }

  window.TagModel = {
    getAllRecipesFlat,
    getRecipeTags,
    getTagById,
    getRecipesByTags,
    getRecipesByCollection,
    getRelatedTags,
    findRecipeById,
    getIdForCatAndName,
    slugify,
    parseMinutes,
    validateRecipeTags,
    findDuplicateIds,
    getCollectionRelevanceScore,
    sortRecipeItems,
    SORT_OPTIONS,
    getCollectionSort,
    setCollectionSort,
    getCategoryLabel,
  };
})();
