// search.js — busca global (todas as categorias) com pontuação por campo.
(function () {
  function norm(s) {
    return (s || "")
      .toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(new RegExp("[̀-ͯ]", "g"), ""); // remove acentos, pra "cafe" achar "café"
  }

  function buildIndex() {
    const items = [];
    const categories = window.CATEGORIES || [];
    Object.keys(window.RECIPES || {}).forEach((catId) => {
      const cat = categories.find((c) => c.id === catId);
      (window.RECIPES[catId] || []).forEach((r) => {
        items.push({ catId: catId, catLabel: cat ? cat.label : catId, recipe: r });
      });
    });
    return items;
  }

  // Pesos por campo — nome/categoria/origem pesam mais que descrição.
  const WEIGHTS = {
    nome: 5,
    categoria: 4,
    origem: 4,
    ingrediente: 3,
    dificuldade: 2,
    descricao: 1,
  };

  function searchRecipes(query, opts) {
    const q = norm(query).trim();
    if (!q) return [];
    const terms = q.split(/\s+/).filter(Boolean);
    const limit = (opts && opts.limit) || Infinity;
    const items = buildIndex();
    const results = [];

    items.forEach(function (item) {
      const recipe = item.recipe;
      const fields = {
        nome: norm(recipe.name),
        categoria: norm(item.catLabel) + " " + norm(recipe.subgroup),
        origem: norm(recipe.origin),
        ingrediente: norm((recipe.ingredients || []).join(" ")),
        dificuldade: norm(recipe.difficulty),
        descricao: norm(recipe.desc),
      };

      let score = 0;
      const matchedFields = new Set();

      terms.forEach(function (term) {
        Object.keys(fields).forEach(function (fieldName) {
          if (fields[fieldName].indexOf(term) !== -1) {
            score += WEIGHTS[fieldName];
            matchedFields.add(fieldName);
          }
        });
      });

      // Bônus se o nome começa exatamente com o termo (relevância extra)
      if (fields.nome.indexOf(q) === 0) score += 6;

      if (score > 0) {
        results.push({
          catId: item.catId,
          catLabel: item.catLabel,
          recipe: recipe,
          score: score,
          matchedFields: Array.from(matchedFields),
        });
      }
    });

    results.sort(function (a, b) {
      return b.score - a.score;
    });

    return results.slice(0, limit);
  }

  // ---------- Busca de tags (usada pela busca facetada) ----------
  function searchTags(query, opts) {
    const q = norm(query).trim();
    if (q.length < 2) return [];
    const limit = (opts && opts.limit) || 8;
    const tags = window.TAGS || [];

    const scored = tags
      .map(function (tag) {
        const label = norm(tag.label);
        const id = norm(tag.id);
        const group = norm(tag.group);
        const synonyms = (tag.synonyms || []).map(norm);
        const searchableValues = [label, id, group].concat(synonyms);

        let score = 0;
        if (label === q) score += 100;
        if (label.indexOf(q) === 0) score += 60;
        if (label.indexOf(q) !== -1) score += 40;
        if (searchableValues.some((v) => v.indexOf(q) !== -1)) score += 25;

        return { tag: tag, score: score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.tag);

    return scored.slice(0, limit);
  }

  window.Search = { searchRecipes: searchRecipes, searchTags: searchTags };
})();
