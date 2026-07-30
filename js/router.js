// router.js — navegação baseada em hash (#/...), sem depender de servidor.
// Rotas: home | grupo/:id (grupo macro) | categoria/:id (id de coleção) | busca?tags=a,b,c
//        receita/:id | cozinhar/:id
//        minhas-receitas (favoritas/já feitas, com abas) | preparos | lista-compras
//        (as 2 últimas ainda são telas-placeholder da barra inferior)
// :id de receita/cozinhar é o id único global da receita (TagModel), não mais catId+nome.
(function () {
  const listeners = [];

  // #/receita/:id e #/cozinhar/:id levam o id-slug direto na URL — renomear recipe.name muda
  // esse slug (ver skill recipe-data-quality, leva de 2026-07-24). window.Storage.RENAME_SLUG_MAP
  // é a MESMA tabela que migra favoritas/feitas/últimas-visitadas (storage.js, carregado antes
  // deste arquivo) — um link salvo com o slug antigo continua abrindo a receita certa.
  function resolveRecipeIdAlias(id) {
    const map = window.Storage && window.Storage.RENAME_SLUG_MAP;
    return (map && map[id]) || id;
  }

  function rawPath() {
    return location.hash.replace(/^#\/?/, "");
  }

  function parseHash() {
    const raw = rawPath();
    // "home" é fromHash PÚBLICO e documentado (contrato do carrossel "Vistas recentemente" da
    // Home — Router.toReceita(id, "home"), ver product-navigation-ux/SKILL.md e
    // scripts/verify-recentes-ui-2026-07-25.js). Checagem EXPLÍCITA aqui, ao lado do "raw" vazio
    // de sempre — NÃO depende do fallback genérico do fim desta função: se esse fallback mudar
    // no futuro (deixar de resolver pra home), "home" continua resolvendo, porque é tratado aqui
    // em cima, não lá embaixo por acidente.
    if (!raw || raw === "home") return { name: "home" };

    const [pathPart, queryPart] = raw.split("?");
    const parts = pathPart.split("/").map(function (p) {
      try {
        return decodeURIComponent(p);
      } catch (e) {
        return p;
      }
    });

    if (parts[0] === "grupo" && parts[1]) {
      return { name: "grupo", grupoId: parts[1] };
    }
    if (parts[0] === "categoria" && parts[1]) {
      let catTags = [];
      let role = null;
      let ingredientMode = null;
      if (queryPart) {
        queryPart.split("&").forEach(function (pair) {
          const [k, v] = pair.split("=");
          if (k === "tags" && v) {
            catTags = v.split(",").map(decodeURIComponent).filter(Boolean);
          }
          if (k === "role" && v) {
            role = v;
          }
          if (k === "imode" && v === "and") {
            ingredientMode = "and";
          }
        });
      }
      return { name: "categoria", catId: parts[1], tags: catTags, role: role, ingredientMode: ingredientMode };
    }
    if (parts[0] === "busca") {
      let tags = [];
      let textFilters = [];
      let ingredientMode = null;
      // role: Papel da proteína (correção de semântica, 2026-07-29) — mesmo padrão de
      // categoria, agora também em busca global. null | "focus" | "secondary".
      let role = null;
      // query: texto ainda não commitado (preview ao vivo, ver Router.replaceBusca) — vive só
      // na URL enquanto o usuário digita; renderBusca nasce já com o preview desse texto
      // renderizado (sobrevive ao "Voltar" de uma receita aberta a partir do preview).
      let query = null;
      // origin: F1b acabamento (2026-07-30) — marca que esta busca foi alcançada por uma
      // NAVEGAÇÃO com origem explícita (hoje só "vitrine", toque num Momento), nunca por
      // refinamento orgânico dentro da própria tela (digitar, tocar chip/facet) — esses
      // continuam construindo a URL sem este parâmetro (ver Router.toBusca/goTo/goToTags em
      // app.js). renderBusca usa isto pra decidir 2 coisas, as duas só quando há resultado
      // (tags/text não vazios): mostrar back-float "Voltar para Pesquisar" e filtrar
      // nature==="prato" nos resultados dos Momentos (ver relatório da tarefa). Único valor
      // válido hoje é "vitrine" — string opaca, mesmo espírito de fromHash="home".
      let origin = null;
      if (queryPart) {
        queryPart.split("&").forEach(function (pair) {
          const [k, v] = pair.split("=");
          if (k === "tags" && v) {
            tags = v.split(",").map(decodeURIComponent).filter(Boolean);
          }
          if (k === "text" && v) {
            textFilters = v.split(",").map(decodeURIComponent).filter(Boolean);
          }
          if (k === "imode" && v === "and") {
            ingredientMode = "and";
          }
          if (k === "role" && v) {
            role = v;
          }
          if (k === "q" && v) {
            try {
              query = decodeURIComponent(v);
            } catch (e) {
              query = v;
            }
          }
          if (k === "origin" && v) {
            origin = v;
          }
        });
      }
      return { name: "busca", tags: tags, textFilters: textFilters, ingredientMode: ingredientMode, role: role, query: query, origin: origin };
    }
    // fromHash: rota de origem inteira (ver comentário de Router.toReceita/toCozinhar abaixo),
    // não mais só um catId — decodificada aqui, mas NUNCA reprocessada por parseHash de novo
    // (é usada como string opaca por Router.navigate quando o usuário clica "Voltar").
    let fromHash = null;
    let portion = null;
    if (queryPart) {
      queryPart.split("&").forEach(function (pair) {
        const [k, v] = pair.split("=");
        if (k === "from" && v) {
          try {
            fromHash = decodeURIComponent(v);
          } catch (e) {
            fromHash = v;
          }
        }
        if (k === "portion" && v) {
          portion = parseFloat(v);
        }
      });
    }
    if (parts[0] === "receita" && parts[1]) {
      return { name: "receita", id: resolveRecipeIdAlias(parts[1]), fromHash: fromHash };
    }
    if (parts[0] === "cozinhar" && parts[1]) {
      // portion: multiplicador de porções capturado do stepper da tela de receita no momento
      // de clicar "Começar preparo" (Fase 2) — só usado se renderCookMode for CRIAR uma sessão
      // nova; retomar uma sessão em andamento ignora esse valor (usa o portionMultiplier já
      // salvo). null quando a receita não tinha stepper (yield sem base numérica).
      return { name: "cozinhar", id: resolveRecipeIdAlias(parts[1]), fromHash: fromHash, portion: portion && !isNaN(portion) ? portion : null };
    }
    if (parts[0] === "minhas-receitas") {
      return { name: "minhas-receitas" };
    }
    if (parts[0] === "preparos") {
      return { name: "preparos" };
    }
    if (parts[0] === "lista-compras") {
      return { name: "lista-compras" };
    }
    return { name: "home" };
  }

  // Item 3 (2026-07-28): colapso de zigue-zague no histórico. Cada navigate() empilha uma
  // entrada REAL do navegador (location.hash=) — sem isso, alternar entre 2 telas via navegação
  // PRÓPRIA do app (ex.: receita -> preparo -> nome da receita no cabeçalho do modo cozinhar,
  // que é Router.toReceita de novo, não um "voltar" de histórico) empilha duplicatas alternadas;
  // o botão/gesto de voltar NATIVO do navegador (único jeito de sair do modo cozinhar sem usar
  // "Sair", já que aquela tela nunca tem back-float) então repete a zigue-zague inteira em vez
  // de avançar de verdade pro que veio antes. Regra: ao navegar pra um destino que já é o hash
  // do nível PENÚLTIMO (o que "voltar 1 passo" já alcançaria), colapsa — history.go(-1) em vez
  // de empilhar duplicata. navHistoryStack é um ESPELHO do que este módulo empilhou (não uma
  // fonte de verdade paralela — o navegador continua sendo dono do histórico real);
  // pendingSelfNav distingue uma mudança de hash disparada por NÓS (navigate/o próprio go(-1)
  // do colapso, já contabilizada de forma síncrona no ponto de chamada) de uma NATIVA de
  // verdade (botão físico, gesto, dropdown de histórico do navegador — só essa precisa
  // resincronizar o cursor reagindo ao evento).
  let navHistoryStack = [rawPath()];
  let cursor = 0;
  let pendingSelfNav = false;

  function navigate(path) {
    if (cursor > 0 && navHistoryStack[cursor - 1] === path) {
      // Mesmo hash do penúltimo nível — colapsa: back nativo de 1 passo em vez de empilhar uma
      // duplicata (ex.: receita -> preparo -> receita de novo pelo mesmo caminho já visitado).
      pendingSelfNav = true;
      cursor -= 1;
      history.go(-1);
      return;
    }
    pendingSelfNav = true;
    navHistoryStack = navHistoryStack.slice(0, cursor + 1);
    navHistoryStack.push(path);
    cursor = navHistoryStack.length - 1;
    location.hash = "/" + path;
  }

  // Quem precisa saber quando a URL muda por replace() (history.replaceState não dispara
  // hashchange nem popstate) — usado pelo scroll por rota em app.js pra manter o "hash atual"
  // sincronizado mesmo quando o refino de filtro in-context (replaceCategoriaFacets) troca a
  // URL sem navegar de verdade. Sem isso, salvar o scroll ao sair da tela usaria a chave de
  // ANTES do filtro ser aplicado (stale), nunca batendo com o hash que "Voltar" reconstrói.
  const replaceListeners = [];
  function onReplace(fn) {
    replaceListeners.push(fn);
  }

  // Atualiza a URL sem empilhar uma entrada nova no histórico (bom pra "digitar e buscar").
  function replace(path) {
    const url = location.pathname + location.search + "#/" + path;
    history.replaceState(null, "", url);
    // replaceState não empilha (mesma entrada, conteúdo novo) — navHistoryStack precisa
    // acompanhar, senão um navigate() futuro comparando contra o penúltimo usaria um valor
    // stale (de antes do refino de filtro).
    navHistoryStack[cursor] = path;
    replaceListeners.forEach(function (fn) {
      fn(path);
    });
  }

  function onChange(fn) {
    listeners.push(fn);
  }

  // Compartilhado por toBusca (navega, sem q) e replaceBusca (substitui, com q opcional).
  // role: Papel da proteína (correção de semântica, 2026-07-29) — mesmo padrão de
  // replaceCategoriaFacets, agora também em busca. origin: ver comentário em parseHash.
  function buildBuscaPath(tagIds, textFilters, ingredientMode, query, role, origin) {
    const q = (tagIds || []).map(encodeURIComponent).join(",");
    const t = (textFilters || []).map(encodeURIComponent).join(",");
    const params = [];
    if (q) params.push("tags=" + q);
    if (t) params.push("text=" + t);
    if (ingredientMode === "and") params.push("imode=and");
    if (role) params.push("role=" + encodeURIComponent(role));
    if (query) params.push("q=" + encodeURIComponent(query));
    if (origin) params.push("origin=" + encodeURIComponent(origin));
    return "busca" + (params.length ? "?" + params.join("&") : "");
  }

  window.addEventListener("hashchange", function () {
    if (pendingSelfNav) {
      // Mudança disparada por nós (navigate() ou o go(-1) do colapso) — cursor já foi atualizado
      // de forma síncrona no ponto de chamada, só consome a flag.
      pendingSelfNav = false;
    } else {
      // Navegação NATIVA (botão físico/gesto/dropdown de histórico do navegador) — nunca
      // passamos por navigate() pra isso, então o cursor precisa se resincronizar sozinho.
      // Vizinho imediato cobre o caso comum (voltar/avançar 1 passo); um hash que não bate com
      // nenhum vizinho (ex.: usuário pulou vários passos no histórico do navegador, ou abriu um
      // link direto) reinicia o rastreamento a partir daqui — degrada com segurança (só perde o
      // colapso até a pilha se reconstruir via novos navigate()), nunca quebra a navegação em si.
      const newPath = rawPath();
      if (cursor > 0 && navHistoryStack[cursor - 1] === newPath) {
        cursor -= 1;
      } else if (cursor < navHistoryStack.length - 1 && navHistoryStack[cursor + 1] === newPath) {
        cursor += 1;
      } else {
        navHistoryStack = [newPath];
        cursor = 0;
      }
    }
    const route = parseHash();
    listeners.forEach(function (fn) {
      fn(route);
    });
  });

  window.Router = {
    current: parseHash,
    onChange: onChange,
    onReplace: onReplace,
    navigate: navigate,
    replace: replace,
    toHome: function () {
      navigate("");
    },
    toGrupo: function (grupoId) {
      navigate("grupo/" + encodeURIComponent(grupoId));
    },
    toCategoria: function (catId) {
      navigate("categoria/" + encodeURIComponent(catId));
    },
    // Atualiza as facetas extras (e o papel da proteína, se houver) de uma categoria na URL sem
    // navegar (sem empilhar histórico e sem re-disparar handleRoute) — usado pelo refino
    // in-context de renderCategory.
    replaceCategoriaFacets: function (catId, tagIds, role, ingredientMode) {
      const q = (tagIds || []).map(encodeURIComponent).join(",");
      const params = [];
      if (q) params.push("tags=" + q);
      if (role) params.push("role=" + encodeURIComponent(role));
      if (ingredientMode === "and") params.push("imode=and");
      replace("categoria/" + encodeURIComponent(catId) + (params.length ? "?" + params.join("&") : ""));
    },
    // origin (F1b acabamento, 2026-07-30): opcional, só os Momentos da vitrine passam
    // "vitrine" hoje — qualquer refinamento orgânico dentro da tela (goTo/goToTags em app.js)
    // NUNCA passa este argumento, propositalmente, pra não herdar o back-float/filtro de
    // nature de um Momento numa busca que o usuário já customizou à mão.
    toBusca: function (tagIds, textFilters, ingredientMode, role, origin) {
      navigate(buildBuscaPath(tagIds, textFilters, ingredientMode, null, role, origin));
    },
    // Preview ao vivo (digitar e buscar): atualiza a URL com q= sem empilhar histórico e sem
    // re-disparar handleRoute (mesmo mecanismo de replaceCategoriaFacets) — Enter/tocar um chip
    // é que materializa de verdade em tags=/text= via toBusca (dropando q).
    replaceBusca: function (tagIds, textFilters, ingredientMode, query, role) {
      replace(buildBuscaPath(tagIds, textFilters, ingredientMode, query, role));
    },
    // fromHash: rota de origem INTEIRA (path+query, sem o "#/" — mesmo formato de "raw" acima,
    // ex.: "categoria/molhos?tags=ingredient:tomate&imode=and"), não mais só o catId. Guarda o
    // hash de origem de verdade em vez de reconstruir a rota do zero, pra "Voltar" (renderReceita)
    // reproduzir o estado EXATO de filtro (tags/imode/role) de onde a receita foi aberta — não só
    // a coleção certa, sem filtro nenhum. Só passa por cima (query "from="), nunca decodifica
    // internamente; quem lê de volta é renderReceita, via Router.navigate(fromHash) direto.
    toReceita: function (id, fromHash) {
      navigate("receita/" + encodeURIComponent(id) + (fromHash ? "?from=" + encodeURIComponent(fromHash) : ""));
    },
    toCozinhar: function (id, fromHash, portionMultiplier) {
      const params = [];
      if (fromHash) params.push("from=" + encodeURIComponent(fromHash));
      if (portionMultiplier) params.push("portion=" + encodeURIComponent(portionMultiplier));
      navigate("cozinhar/" + encodeURIComponent(id) + (params.length ? "?" + params.join("&") : ""));
    },
    toMinhasReceitas: function () {
      navigate("minhas-receitas");
    },
    toPreparos: function () {
      navigate("preparos");
    },
    toListaCompras: function () {
      navigate("lista-compras");
    },
  };
})();
