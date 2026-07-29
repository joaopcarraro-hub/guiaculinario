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

  // ---------- S2 (motor unificado): tags da receita (label+sinônimos) como campo de texto ----------
  function tagsText(item) {
    return (item.tags || [])
      .map((tagId) => {
        const tag = window.TagModel && window.TagModel.getTagById(tagId);
        if (!tag) return "";
        return [tag.label].concat(tag.synonyms || []).join(" ");
      })
      .join(" ");
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
        tags: norm(tagsText(item)),
      };
    });
    fieldIndexById = {};
    fieldCache.forEach((f) => {
      fieldIndexById[f.item.id] = f;
    });
    return fieldCache;
  }

  // Pesos por campo — nome/categoria/origem pesam mais que descrição. "tags" (S2, motor
  // unificado 2026-07-29): labels+sinônimos das tags da própria receita viram campo de texto —
  // peso 3, mesmo tier de "ingrediente" (metadado estruturado, não é decisão do spec, escolha de
  // implementação registrada no relatório da tarefa). Nunca entra em B1_FIELDS (ver abaixo).
  const WEIGHTS = { nome: 5, categoria: 4, origem: 4, ingrediente: 3, dificuldade: 2, descricao: 1, tags: 3 };
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

  // S3 (parcimônia): só o ÚLTIMO token da query, 3+ letras, casa INÍCIO de palavra (sem exigir
  // fronteira de fechamento) — "carn" casa carne/carnes/carneiro. Tokens anteriores continuam em
  // wordRegex (palavra inteira + plural-lite), inalterado.
  //
  // Herda o plural-lite de wordRegex (mesma regra: 4+ letras terminando em "s" -> tenta a forma
  // sem "s"): sem isso, prefixo vira uma faca de 2 gumes ASSIMÉTRICA — "molho" (prefixo) alcança
  // "molhos" (mais longo), mas "molhos" (prefixo) NUNCA alcança "molho" (mais curto que o próprio
  // prefixo). Achado real rodando scripts/verify-busca-unificada-2026-07-29.js item 3: sem este
  // ajuste, "molho"=56 e "molhos"=34 no mesmo escopo — a query singular/plural completa (não só o
  // prefixo truncado do spec) também passa pelo último token, e precisa continuar simétrica.
  function prefixRegex(term) {
    const base = term.length >= 4 && term.slice(-1) === "s" ? term.slice(0, -1) : term;
    return new RegExp("\\b" + escapeRegex(base));
  }

  function fieldScore(f, terms, fieldNames, prefixQuery, prefixEligibleTerm) {
    let score = 0;
    let matchedTerms = 0;
    terms.forEach((term) => {
      const usePrefix = !!prefixEligibleTerm && term === prefixEligibleTerm && term.length >= 3;
      const re = usePrefix ? prefixRegex(term) : wordRegex(term);
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

  // Fallback de PREFIXO (S3, motor unificado 2026-07-29) — só chamado pelo parseQuery quando nem
  // classifyCandidate nem classifySingleTokenFallback acham nada E o token é o ÚLTIMO da query
  // inteira, com 3+ letras. Procura uma palavra de alguma frase do vocabulário que COMECE com o
  // token e herda a classificação do termo completo alcançado (roda classifyCandidate nele) — mas
  // NUNCA promove a auto, mesmo que o termo completo colapsasse sozinho: prefixo é sempre
  // incerto (a palavra pode não estar terminada de digitar), então vira sempre chip sugerido, nunca
  // filtro aplicado direto. Cap de chips = 2, mesmo cap de classifySingleTokenFallback (não há
  // recorte adicional na renderização, então esse já É o cap efetivo da UI).
  function classifyPrefixFallback(tok, excludeTagIds) {
    const exclude = excludeTagIds || [];
    const vocab = getVocabulary().filter((v) => exclude.indexOf(v.tag.id) === -1);
    const seenWords = {};
    const candidateWords = [];
    vocab.forEach((v) => {
      v.phrases.forEach((p) => {
        p.split(" ").forEach((w) => {
          if (w && w !== tok && w.indexOf(tok) === 0 && !seenWords[w]) {
            seenWords[w] = true;
            candidateWords.push(w);
          }
        });
      });
    });
    if (!candidateWords.length) return { classification: "text", autoTagId: null, chipTagIds: [] };
    const chipIds = [];
    candidateWords.forEach((w) => {
      // Mesmo processo de 2 etapas que parseQuery aplicaria se "w" fosse o único token digitado:
      // classifyCandidate primeiro (pega igualdade exata, ex. "carneiro"); se vier "text" (palavra
      // nunca é igual a frase nenhuma sozinha, só contida em frases maiores — caso de "carne"),
      // cai pra classifySingleTokenFallback (continência). Sem isso, termos como "carne" (que só
      // vira chip via continência, nunca via igualdade) ficariam de fora do prefixo silenciosamente.
      let c = classifyCandidate(w, excludeTagIds);
      if (c.classification === "text") c = classifySingleTokenFallback(w, excludeTagIds);
      if (c.classification === "auto" && chipIds.indexOf(c.autoTagId) === -1) chipIds.push(c.autoTagId);
      if (c.classification === "optional") {
        c.chipTagIds.forEach((id) => {
          if (chipIds.indexOf(id) === -1) chipIds.push(id);
        });
      }
    });
    if (!chipIds.length) return { classification: "text", autoTagId: null, chipTagIds: [] };
    const sorted = chipIds
      .map((id) => (window.TAGS || []).find((t) => t.id === id))
      .filter(Boolean)
      .sort((a, b) => tagPriority(a.id) - tagPriority(b.id))
      .slice(0, 2)
      .map((t) => t.id);
    return { classification: "optional", autoTagId: null, chipTagIds: sorted };
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
        let c = classifySingleTokenFallback(tokens[i], excludeTagIds);
        if (c.classification === "text" && i === tokens.length - 1 && tokens[i].length >= 3) {
          c = classifyPrefixFallback(tokens[i], excludeTagIds);
        }
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
    // S1 (motor unificado, escopo): null = universo inteiro (busca global, comportamento de
    // sempre); Set|Array de ids de receita recorta blocos 1/2/parcial pra um subconjunto (busca
    // de hub, ver renderGrupo em app.js). getFields() permanece com o cache de sempre — filtramos
    // uma CÓPIA do array, nunca mutamos fieldCache.
    const scopeIds = opts.scopeIds || null;
    const scopeSet = scopeIds ? (scopeIds instanceof Set ? scopeIds : new Set(scopeIds)) : null;
    const fields = scopeSet ? getFields().filter((f) => scopeSet.has(f.item.id)) : getFields();
    const nq = norm(query).trim();
    // S3: último token da query inteira (não do resíduo) — pode ter sido consumido por uma tag
    // auto e nunca aparecer nos terms realmente escaneados; nesse caso simplesmente não bate em
    // nenhum termo escaneado e não tem efeito (comparação por igualdade de string abaixo).
    const lastToken = parsed.tokens.length ? parsed.tokens[parsed.tokens.length - 1] : null;
    const prefixEligibleTerm = lastToken && lastToken.length >= 3 ? lastToken : null;

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
          const s = fieldScore(f, parsed.residualTokens, B1_FIELDS, null, prefixEligibleTerm);
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
        const s = fieldScore(f, allTerms, ALL_FIELDS, nq, prefixEligibleTerm);
        return { item: f.item, score: s.score, matchedTerms: s.matchedTerms };
      })
      .filter((r) => allTerms.length > 0 && r.matchedTerms === allTerms.length);
    block2.sort((a, b) => b.score - a.score);

    let partial = [];
    if (!block1.length && !block2.length && allTerms.length > 1) {
      partial = basePool
        .filter((f) => !inBlock1[f.item.id])
        .map((f) => {
          const s = fieldScore(f, allTerms, ALL_FIELDS, nq, prefixEligibleTerm);
          return { item: f.item, score: s.score, matchedTerms: s.matchedTerms };
        })
        .filter((r) => r.matchedTerms > 0);
      partial.sort((a, b) => b.matchedTerms - a.matchedTerms || b.score - a.score);
    }

    return { parsed: parsed, block1: block1, block2: block2, partial: partial };
  }

  // ---------- matchesTextFilter: usado por facetUniverse (app.js) pro estado JÁ materializado
  // de textFilters — pra texto não mudar de comportamento entre "ainda digitando" (preview,
  // Bloco 2 de searchByQuery) e "já aplicado" (aqui). CORREÇÃO (P1, válvula de escape do hub,
  // 2026-07-29): usava B1_FIELDS (4 campos) — divergia do Bloco 2, que usa ALL_FIELDS (7 campos,
  // inclui descrição/origem/tags). B1_FIELDS existe pra outra situação (Bloco 1 = resíduo DENTRO
  // de um pool já estreitado por tag automática, onde descrição vira ruído proporcionalmente
  // maior) — matchesTextFilter nunca teve esse contexto de tag-já-aplicada quando o texto é
  // 100% livre (sem nenhuma tag), então herdar B1_FIELDS aqui contradizia o próprio comentário
  // acima ("não mudar de comportamento"): termo puro sem tag digitado na busca global mostrava
  // uma contagem no preview (Bloco 2) e uma contagem MENOR ao confirmar com Enter (aqui) — bug
  // real, não uma escolha deliberada. Confirmado por sondagem: 20/20 termos de texto puro
  // testados divergiam (ex. "cremoso" 29 no preview vs 4 ao confirmar). ALL_FIELDS elimina a
  // divergência inteira — verificado que os 2 mecanismos passam a produzir o MESMO número pra
  // qualquer termo sem tag (prova em scripts/verify-busca-unificada-2026-07-29.js, seção 9d).
  function matchesTextFilter(item, term) {
    getFields();
    const f = fieldIndexById[item.id];
    if (!f) return false;
    const re = wordRegex(norm(term));
    return ALL_FIELDS.some((fn) => re.test(f[fn]));
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
