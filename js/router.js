// router.js — navegação baseada em hash (#/...), sem depender de servidor.
// Rotas: home | categoria/:id (id de coleção) | busca/:query | receita/:id | cozinhar/:id
//        favoritos | quero-fazer | historico
// :id de receita/cozinhar é o id único global da receita (TagModel), não mais catId+nome.
(function () {
  const listeners = [];

  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, "");
    if (!raw) return { name: "home" };

    const parts = raw.split("/").map(function (p) {
      try {
        return decodeURIComponent(p);
      } catch (e) {
        return p;
      }
    });

    if (parts[0] === "categoria" && parts[1]) {
      return { name: "categoria", catId: parts[1] };
    }
    if (parts[0] === "busca") {
      return { name: "busca", query: parts.slice(1).join("/") || "" };
    }
    if (parts[0] === "receita" && parts[1]) {
      return { name: "receita", id: parts[1] };
    }
    if (parts[0] === "cozinhar" && parts[1]) {
      return { name: "cozinhar", id: parts[1] };
    }
    if (parts[0] === "favoritos") {
      return { name: "favoritos" };
    }
    if (parts[0] === "quero-fazer") {
      return { name: "quero-fazer" };
    }
    if (parts[0] === "historico") {
      return { name: "historico" };
    }
    return { name: "home" };
  }

  function navigate(path) {
    location.hash = "/" + path;
  }

  // Atualiza a URL sem empilhar uma entrada nova no histórico (bom pra "digitar e buscar").
  function replace(path) {
    const url = location.pathname + location.search + "#/" + path;
    history.replaceState(null, "", url);
  }

  function onChange(fn) {
    listeners.push(fn);
  }

  window.addEventListener("hashchange", function () {
    const route = parseHash();
    listeners.forEach(function (fn) {
      fn(route);
    });
  });

  window.Router = {
    current: parseHash,
    onChange: onChange,
    navigate: navigate,
    replace: replace,
    toHome: function () {
      navigate("");
    },
    toCategoria: function (catId) {
      navigate("categoria/" + encodeURIComponent(catId));
    },
    toBusca: function (query) {
      navigate("busca/" + encodeURIComponent(query));
    },
    replaceBusca: function (query) {
      replace("busca/" + encodeURIComponent(query));
    },
    toReceita: function (id) {
      navigate("receita/" + encodeURIComponent(id));
    },
    toCozinhar: function (id) {
      navigate("cozinhar/" + encodeURIComponent(id));
    },
    toFavoritos: function () {
      navigate("favoritos");
    },
    toQueroFazer: function () {
      navigate("quero-fazer");
    },
    toHistorico: function () {
      navigate("historico");
    },
  };
})();
