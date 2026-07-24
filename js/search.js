// search.js — busca global: texto ponderado por campo (word-boundary) + parser de query que
// decompõe texto digitado em tags vivas + resíduo textual, pro preview ao vivo de renderBusca
// (js/app.js). Reescrito na leva de 2026-07-24 (investigação de busca + taxonomia) — antes só
// alimentava sugestões (buildIndex() próprio, substring puro); agora é a fonte de verdade dos
// 2 blocos de resultado (filtrado-por-tag e "mais por texto"), sobre TagModel.getAllRecipesFlat.
(function () {
  function norm(s) {
    return window.DerivationDict.norm((s || "").toString());
  }
  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // ---------- índice de campos (1x, cache sobre TagModel.getAllRecipesFlat) ----------
  // Substitui o antigo buildIndex() (rebuild a cada chamada, sem tags derivadas). Ingredientes
  // passam pela máscara de medidas (data/derivation-dict.js MEASUREMENT_MASKS) ANTES de virar
  // campo de busca — sem isso "colher (sopa)" faria a palavra "sopa" contaminar ~200 receitas.
  let fieldCache = null;
  let fieldIndexById = null;
  function getFields() {
    if (fieldCache) return fieldCache;
    const masks = (window.DerivationDict && window.DerivationDict.MEASUREMENT_MASKS) || [];
    function maskMeasures(s) {
      let t = s;
      masks.forEach((m) => {
        t = t.split(m).join(" ");
      });
      return t;
    }
    fieldCache = window.TagModel.getAllRecipesFlat().map((item) => {
      const r = item.recipe;
      const cat = (window.CATEGORIES || []).find((c) => c.id === item.catId);
      return {
        item: item,
        nome: norm(r.name),
        categoria: norm(cat ? cat.label : item.catId) + " " + norm(r.subgroup || ""),
        origem: norm(r.origin || ""),
        ingrediente: maskMeasures(norm((r.ingredients || []).join(" "))),
        dificuldade: norm(r.difficulty || ""),
        descricao: norm(r.desc || ""),
      };
    });
    fieldIndexById = {};
    fieldCache.forEach((f) => {
      fieldIndexById[f.item.id] = f;
    });
    return fieldCache;
  }

  // Pesos por campo — nome/categoria/origem pesam mais que descrição.
  const WEIGHTS = { nome: 5, categoria: 4, origem: 4, ingrediente: 3, dificuldade: 2, descricao: 1 };
  const ALL_FIELDS = Object.keys(WEIGHTS);
  // Bloco 1 (resíduo dentro de um filtro de tag já aplicado) usa escopo mais estrito: sem
  // descrição. Descrição é prosa (sugestão de uso, referência cruzada a outro preparo, às vezes
  // negação — "sem carne") e pesa proporcionalmente mais dentro de um pool já pequeno; o Bloco 2
  // (rede ampla) mantém os 6 campos, generosidade é o trabalho dele. Achado real (investigação
  // 2026-07-24): "carne na air fryer" trazia Chips de Vegetais/Agnolotti só por menção em
  // descrição, nunca em ingrediente — ruído, não sinal.
  const B1_FIELDS = ["nome", "categoria", "ingrediente", "dificuldade"];

  // Palavra inteira + plural-lite (s final opcional, e aceita a forma sem "s" se o termo já
  // termina em "s" com 4+ letras — cobre "alcaparras"/"tortillas" buscados no singular).
  function wordRegex(term) {
    if (term.length >= 4 && term.slice(-1) === "s") {
      return new RegExp("\\b(?:" + escapeRegex(term) + "|" + escapeRegex(term.slice(0, -1)) + ")s?\\b");
    }
    return new RegExp("\\b" + escapeRegex(term) + "s?\\b");
  }

  function fieldScore(f, terms, fieldNames, prefixQuery) {
    let score = 0;
    let matchedTerms = 0;
    terms.forEach((term) => {
      const re = wordRegex(term);
      let hit = false;
      fieldNames.forEach((fn) => {
        if (re.test(f[fn])) {
          score += WEIGHTS[fn];
          hit = true;
        }
      });
      if (hit) matchedTerms++;
    });
    if (prefixQuery && f.nome.indexOf(prefixQuery) === 0) score += 6;
    return { score: score, matchedTerms: matchedTerms };
  }

  // ---------- searchRecipes — mesma assinatura/contrato, agora palavra inteira por dentro ----------
  function searchRecipes(query, opts) {
    const q = norm(query).trim();
    if (!q) return [];
    const terms = q.split(/\s+/).filter(Boolean);
    const limit = (opts && opts.limit) || Infinity;
    const results = [];
    getFields().forEach((f) => {
      const s = fieldScore(f, terms, ALL_FIELDS, q);
      if (s.score > 0) {
        const matchedFields = ALL_FIELDS.filter((fn) => terms.some((t) => wordRegex(t).test(f[fn])));
        results.push({ catId: f.item.catId, catLabel: f.item.catId, recipe: f.item.recipe, score: s.score, matchedFields: matchedFields });
      }
    });
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  // ---------- searchTags — inalterado (outro consumidor real: renderGrupo em app.js:432) ----------
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

  // ---------- vocabulário do parser: frases de tags VIVAS (exclui aliases cuisine:/contains:/
  // region:, que duplicam country:/protein: ou são dinâmicos) ----------
  let vocabCache = null;
  function getVocabulary() {
    if (vocabCache) return vocabCache;
    const excludedPrefixes = ["cuisine:", "contains:", "region:"];
    const list = [];
    (window.TAGS || []).forEach((tag) => {
      if (excludedPrefixes.some((p) => tag.id.indexOf(p) === 0)) return;
      if (window.TagModel.getRecipesByTags([tag.id]).length === 0) return; // tag morta — nunca entra no vocabulário
      const slug = tag.id.slice(tag.id.indexOf(":") + 1);
      const phrases = [];
      [norm(tag.label)].concat((tag.synonyms || []).map(norm), [norm(slug.replace(/-/g, " "))]).forEach((p) => {
        if (p && phrases.indexOf(p) === -1) phrases.push(p);
      });
      list.push({ tag: tag, phrases: phrases });
    });
    vocabCache = list;
    return list;
  }

  // Prioridade de desempate quando EQ tem 2+ tags do MESMO slug (hoje nunca ocorre, mas
  // futuro-prova): identidade do prato > contexto > componente.
  const NS_PRIORITY = ["dish_type:", "country:", "protein:", "equipment:", "diet:", "format:", "course:", "ingredient:", "time:", "difficulty:", "seasoning:", "water:"];
  function tagPriority(id) {
    const i = NS_PRIORITY.findIndex((p) => id.indexOf(p) === 0);
    return i === -1 ? 99 : i;
  }

  // Predicado "forte": só considera CONTINÊNCIA quando já existe IGUALDADE (EQ não-vazio) —
  // evita que um n-grama de 2+ palavras vire chip opcional só por conter uma palavra de outra
  // tag. cand já vem normalizado (norm aplicado no tokenizer).
  function classifyCandidate(cand, excludeTagIds) {
    const exclude = excludeTagIds || [];
    const vocab = getVocabulary().filter((v) => exclude.indexOf(v.tag.id) === -1);
    const eq = [];
    vocab.forEach((v) => {
      if (v.phrases.indexOf(cand) !== -1) eq.push(v.tag);
    });
    if (!eq.length) return { classification: "text", autoTagId: null, chipTagIds: [] };
    const re = new RegExp("\\b" + escapeRegex(cand) + "\\b");
    const contains = [];
    vocab.forEach((v) => {
      if (eq.indexOf(v.tag) !== -1) return;
      if (v.phrases.some((p) => p !== cand && re.test(p))) contains.push(v.tag);
    });
    const slugs = new Set(eq.concat(contains).map((t) => t.id.slice(t.id.indexOf(":") + 1)));
    if (slugs.size === 1) {
      const best = eq.slice().sort((a, b) => tagPriority(a.id) - tagPriority(b.id))[0];
      return { classification: "auto", autoTagId: best.id, chipTagIds: [] };
    }
    const chips = eq
      .concat(contains)
      .sort((a, b) => tagPriority(a.id) - tagPriority(b.id))
      .slice(0, 3)
      .map((t) => t.id);
    return { classification: "optional", autoTagId: null, chipTagIds: chips };
  }

  // Só pro fallback de TOKEN ÚNICO (nenhum n-grama teve igualdade): aceita continência pura
  // (EQ vazio) — é aqui que "carne" vira chip opcional [Carne Bovina, Suíno] sem nunca virar
  // auto, porque "carne" isolada nunca é igual à frase de tag nenhuma.
  function classifySingleTokenFallback(tok, excludeTagIds) {
    const exclude = excludeTagIds || [];
    const vocab = getVocabulary().filter((v) => exclude.indexOf(v.tag.id) === -1);
    const re = new RegExp("\\b" + escapeRegex(tok) + "\\b");
    const contains = [];
    vocab.forEach((v) => {
      if (v.phrases.some((p) => p !== tok && re.test(p))) contains.push(v.tag);
    });
    if (!contains.length) return { classification: "text", autoTagId: null, chipTagIds: [] };
    const chips = contains
      .sort((a, b) => tagPriority(a.id) - tagPriority(b.id))
      .slice(0, 2)
      .map((t) => t.id);
    return { classification: "optional", autoTagId: null, chipTagIds: chips };
  }

  // ---------- parseQuery: decompõe a query em segmentos {auto|optional|text} ----------
  // n-grama maior primeiro (4→1); só consome mais de 1 token quando há IGUALDADE de frase
  // (classifyCandidate). excludeTagIds = tags já aplicadas (não sugere de novo).
  function parseQuery(query, excludeTagIds) {
    const stop = new Set((window.DerivationDict && window.DerivationDict.STOPWORDS_PT) || []);
    const tokens = norm(query)
      .split(/[^a-z0-9]+/)
      .filter((t) => t && !stop.has(t));
    const segments = [];
    let i = 0;
    while (i < tokens.length) {
      let seg = null;
      let consumed = 0;
      for (let n = Math.min(4, tokens.length - i); n >= 1; n--) {
        const spanTokens = tokens.slice(i, i + n);
        const cand = spanTokens.join(" ");
        const c = classifyCandidate(cand, excludeTagIds);
        if (c.classification === "text") continue;
        seg = { classification: c.classification, autoTagId: c.autoTagId, chipTagIds: c.chipTagIds, tokens: spanTokens, text: cand };
        consumed = n;
        break;
      }
      if (!seg) {
        const c = classifySingleTokenFallback(tokens[i], excludeTagIds);
        seg = { classification: c.classification, autoTagId: c.autoTagId, chipTagIds: c.chipTagIds, tokens: [tokens[i]], text: tokens[i] };
        consumed = 1;
      }
      segments.push(seg);
      i += consumed;
    }
    const autoTagIds = [];
    const residualTokens = [];
    segments.forEach((seg) => {
      if (seg.classification === "auto") {
        if (autoTagIds.indexOf(seg.autoTagId) === -1) autoTagIds.push(seg.autoTagId);
      } else {
        residualTokens.push(seg.text);
      }
    });
    return { tokens: tokens, segments: segments, autoTagIds: autoTagIds, residualTokens: residualTokens };
  }

  // ---------- searchByQuery: os 2 blocos (filtrado-por-tag + mais-por-texto) + fallback parcial ----------
  // baseTagIds/baseTextFilters = estado JÁ materializado (tagIds[]/textFilters[] de renderBusca)
  // — os dois blocos sempre respeitam esse recorte; só o Bloco 1 soma as tags NOVAS do parse.
  function searchByQuery(query, opts) {
    opts = opts || {};
    const parsed = opts.parsed || parseQuery(query, opts.excludeTagIds || []);
    const baseTagIds = opts.baseTagIds || [];
    const baseTextFilters = opts.baseTextFilters || [];
    const ingredientMode = opts.ingredientMode || "or";
    const fields = getFields();
    const nq = norm(query).trim();

    function matchesBaseTextFilters(f) {
      return baseTextFilters.every((t) => B1_FIELDS.some((fn) => wordRegex(norm(t)).test(f[fn])));
    }

    let block1 = [];
    if (parsed.autoTagIds.length) {
      const filterTagIds = baseTagIds.concat(parsed.autoTagIds);
      let pool = fields.filter((f) => window.TagModel.matchesGroupedTags(f.item.tags, filterTagIds, ingredientMode));
      if (baseTextFilters.length) pool = pool.filter(matchesBaseTextFilters);
      block1 = pool
        .map((f) => {
          const s = fieldScore(f, parsed.residualTokens, B1_FIELDS, null);
          return { item: f.item, score: s.score, matchedTerms: s.matchedTerms };
        })
        .filter((r) => parsed.residualTokens.length === 0 || r.matchedTerms === parsed.residualTokens.length);
      block1.sort((a, b) => b.score - a.score || a.item.recipe.name.localeCompare(b.item.recipe.name));
    }
    const inBlock1 = {};
    block1.forEach((r) => {
      inBlock1[r.item.id] = true;
    });

    let basePool = fields;
    if (baseTagIds.length) basePool = basePool.filter((f) => window.TagModel.matchesGroupedTags(f.item.tags, baseTagIds, ingredientMode));
    if (baseTextFilters.length) basePool = basePool.filter(matchesBaseTextFilters);

    const allTerms = parsed.tokens;
    let block2 = basePool
      .filter((f) => !inBlock1[f.item.id])
      .map((f) => {
        const s = fieldScore(f, allTerms, ALL_FIELDS, nq);
        return { item: f.item, score: s.score, matchedTerms: s.matchedTerms };
      })
      .filter((r) => allTerms.length > 0 && r.matchedTerms === allTerms.length);
    block2.sort((a, b) => b.score - a.score);

    let partial = [];
    if (!block1.length && !block2.length && allTerms.length > 1) {
      partial = basePool
        .filter((f) => !inBlock1[f.item.id])
        .map((f) => {
          const s = fieldScore(f, allTerms, ALL_FIELDS, nq);
          return { item: f.item, score: s.score, matchedTerms: s.matchedTerms };
        })
        .filter((r) => r.matchedTerms > 0);
      partial.sort((a, b) => b.matchedTerms - a.matchedTerms || b.score - a.score);
    }

    return { parsed: parsed, block1: block1, block2: block2, partial: partial };
  }

  // ---------- matchesTextFilter: usado por facetUniverse (app.js) pro estado JÁ materializado
  // de textFilters — mesma mecânica (palavra inteira, B1_FIELDS) do resíduo do preview, pra
  // texto não mudar de comportamento entre "ainda digitando" e "já aplicado". ----------
  function matchesTextFilter(item, term) {
    getFields();
    const f = fieldIndexById[item.id];
    if (!f) return false;
    const re = wordRegex(norm(term));
    return B1_FIELDS.some((fn) => re.test(f[fn]));
  }

  // ---------- guard de teste: vocabulário completo pra suíte detectar deriva silenciosa ----------
  function getVocabularySingleWordTerms() {
    const seen = {};
    const out = [];
    getVocabulary().forEach((v) => {
      v.phrases.forEach((p) => {
        if (p.indexOf(" ") === -1 && p && !seen[p]) {
          seen[p] = true;
          out.push(p);
        }
      });
    });
    return out;
  }

  window.Search = {
    searchRecipes: searchRecipes,
    searchTags: searchTags,
    parseQuery: parseQuery,
    searchByQuery: searchByQuery,
    classifyCandidate: classifyCandidate,
    matchesTextFilter: matchesTextFilter,
    getVocabularySingleWordTerms: getVocabularySingleWordTerms,
  };
})();
