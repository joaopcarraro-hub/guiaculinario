(function () {
  const sidebar = document.getElementById("category-list");
  const header = document.getElementById("category-header");
  const content = document.getElementById("recipes-content");
  const searchInput = document.getElementById("search");
  const progressEl = document.getElementById("progress");
  const sidebarNav = document.getElementById("sidebar");
  const menuToggle = document.getElementById("menu-toggle");
  const sidebarBackdrop = document.getElementById("sidebar-backdrop");

  function openMobileMenu() {
    sidebarNav.classList.add("open");
    sidebarBackdrop.classList.add("open");
  }
  function closeMobileMenu() {
    sidebarNav.classList.remove("open");
    sidebarBackdrop.classList.remove("open");
  }
  menuToggle.addEventListener("click", openMobileMenu);
  sidebarBackdrop.addEventListener("click", closeMobileMenu);

  const firstReady = window.CATEGORIES.find((c) => c.ready) || window.CATEGORIES[0];
  let activeCat = null; // null quando estamos na home ou em modo de busca global
  let homeSearchInput = null; // input de busca da tela home (recriado a cada render)

  // ---------- Sidebar ----------
  function renderSidebar() {
    sidebar.innerHTML = "";
    const groups = {};
    window.CATEGORIES.forEach((c) => {
      if (!groups[c.group]) groups[c.group] = [];
      groups[c.group].push(c);
    });

    Object.keys(groups).forEach((groupName) => {
      const groupTitle = document.createElement("div");
      groupTitle.className = "group-title";
      groupTitle.textContent = groupName;
      sidebar.appendChild(groupTitle);

      groups[groupName].forEach((cat) => {
        const recipes = window.RECIPES[cat.id] || [];
        const btn = document.createElement("button");
        btn.className = "cat-item" + (cat.ready ? " ready" : "") + (cat.id === activeCat ? " active" : "");
        btn.innerHTML =
          '<span class="dot"></span><span>' +
          cat.label +
          "</span>" +
          (recipes.length ? '<span class="count">' + recipes.length + "</span>" : "");
        btn.addEventListener("click", () => {
          closeMobileMenu();
          Router.toCategoria(cat.id);
        });
        sidebar.appendChild(btn);
      });
    });
  }

  // ---------- Busca (compartilhada entre sidebar e home) ----------
  let searchDebounce = null;
  function wireSearchInput(el) {
    el.addEventListener("input", () => {
      const value = el.value;
      [searchInput, homeSearchInput].forEach((other) => {
        if (other && other !== el) other.value = value;
      });
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        if (value.trim()) {
          activeCat = null;
          Router.replaceBusca(value);
          renderSidebar();
          renderSearchResults(value);
        } else {
          Router.replace("");
          renderHome();
        }
      }, 200);
    });
  }
  wireSearchInput(searchInput);

  // ---------- Home ----------
  function renderHome() {
    activeCat = null;
    searchInput.value = "";
    renderSidebar();

    header.innerHTML = "";
    content.innerHTML = "";
    progressEl.textContent = "";

    const wrap = document.createElement("div");
    wrap.className = "home-view";

    const searchWrap = document.createElement("div");
    searchWrap.className = "home-search-wrap";
    const homeSearch = document.createElement("input");
    homeSearch.type = "text";
    homeSearch.className = "home-search";
    homeSearch.placeholder = "Buscar prato, país ou ingrediente...";
    searchWrap.appendChild(homeSearch);
    wrap.appendChild(searchWrap);
    homeSearchInput = homeSearch;
    wireSearchInput(homeSearch);

    const totalRecipes = Object.values(window.RECIPES).reduce((sum, list) => sum + list.length, 0);
    const totalMade = Storage.getAllMade().length;
    const prog = document.createElement("div");
    prog.className = "home-progress";
    prog.textContent = totalMade + " de " + totalRecipes + " receitas já feitas 🎉";
    wrap.appendChild(prog);

    const groups = {};
    window.CATEGORIES.forEach((c) => {
      if (!groups[c.group]) groups[c.group] = [];
      groups[c.group].push(c);
    });

    Object.keys(groups).forEach((groupName) => {
      const st = document.createElement("div");
      st.className = "subgroup-title";
      st.textContent = groupName;
      wrap.appendChild(st);

      const grid = document.createElement("div");
      grid.className = "category-grid";
      groups[groupName].forEach((cat) => {
        const recipes = window.RECIPES[cat.id] || [];
        const card = document.createElement("button");
        card.className = "category-card";
        card.innerHTML =
          '<span class="category-card__icon">' + (cat.icon || "🍽") + "</span>" +
          '<span class="category-card__title">' + cat.label + "</span>" +
          '<span class="category-card__count">' + recipes.length + " receitas</span>";
        card.addEventListener("click", () => Router.toCategoria(cat.id));
        grid.appendChild(card);
      });
      wrap.appendChild(grid);
    });

    content.appendChild(wrap);
  }

  // ---------- Categoria ----------
  function showCategoria(catId) {
    const cat = window.CATEGORIES.find((c) => c.id === catId) || firstReady;
    activeCat = cat.id;
    searchInput.value = "";
    renderSidebar();
    renderCategory(cat);
  }

  function renderCategory(cat) {
    header.innerHTML =
      "<h2>" + cat.label + "</h2>" + (cat.desc ? '<div class="desc">' + cat.desc + "</div>" : "");
    content.innerHTML = "";

    const recipes = window.RECIPES[cat.id] || [];

    if (!recipes.length) {
      content.innerHTML =
        '<div class="empty-state">Essa categoria ainda não tem receitas completas — em breve. 🍳</div>';
      progressEl.textContent = "";
      return;
    }

    let lastSubgroup = null;
    recipes.forEach((recipe) => {
      if (recipe.subgroup && recipe.subgroup !== lastSubgroup) {
        const st = document.createElement("div");
        st.className = "subgroup-title";
        st.textContent = recipe.subgroup;
        content.appendChild(st);
        lastSubgroup = recipe.subgroup;
      }
      content.appendChild(renderRecipeCard(cat.id, recipe));
    });

    updateProgress(cat, recipes);
  }

  function updateProgress(cat, recipes) {
    const doneCount = Storage.countMade(cat.id, recipes);
    progressEl.textContent = doneCount + " de " + recipes.length + " já feitas nessa categoria ✓";
  }

  // ---------- Busca global ----------
  function renderSearchResults(query) {
    header.innerHTML =
      "<h2>Busca: “" + query + "”</h2>" +
      '<div class="desc">Procurando em nome, categoria, origem, ingredientes, dificuldade e descrição.</div>';
    content.innerHTML = "";
    progressEl.textContent = "";

    const results = Search.searchRecipes(query);

    if (!results.length) {
      content.innerHTML = '<div class="empty-state">Nenhum prato encontrado para "' + query + '".</div>';
      return;
    }

    results.forEach((res) => {
      content.appendChild(renderRecipeCard(res.catId, res.recipe, { catLabel: res.catLabel }));
    });
  }

  // ---------- Card de receita (usado na lista de categoria e na busca) ----------
  function renderRecipeCard(catId, recipe, opts) {
    opts = opts || {};
    const card = document.createElement("div");
    card.className = "recipe-card";
    card.dataset.recipeName = recipe.name;

    const isMade = Storage.isMade(catId, recipe.name);
    if (isMade) card.classList.add("made-card");

    const cardHeader = document.createElement("div");
    cardHeader.className = "recipe-header";

    const thumb = document.createElement("div");
    thumb.className = "recipe-thumb placeholder";
    thumb.textContent = "🍽";
    loadRecipeImage(imageQuery(recipe), thumb);

    const toggle = document.createElement("button");
    toggle.className = "made-toggle" + (isMade ? " made" : "");
    toggle.title = "Marcar como já feito";
    toggle.textContent = "✓";
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const nowMade = Storage.toggleMade(catId, recipe.name);
      toggle.classList.toggle("made", nowMade);
      card.classList.toggle("made-card", nowMade);
      if (activeCat) {
        const cat = window.CATEGORIES.find((c) => c.id === activeCat);
        updateProgress(cat, window.RECIPES[activeCat]);
      }
    });

    const favToggle = document.createElement("button");
    const isFav = Storage.isFavorite(catId, recipe.name);
    favToggle.className = "favorite-toggle" + (isFav ? " favorite" : "");
    favToggle.title = "Marcar como favorito";
    favToggle.textContent = "★";
    favToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const nowFav = Storage.toggleFavorite(catId, recipe.name);
      favToggle.classList.toggle("favorite", nowFav);
    });

    const title = document.createElement("div");
    title.className = "recipe-title";
    title.innerHTML =
      "<h3>" + recipe.name + "</h3>" +
      (opts.catLabel ? '<div class="cat-chip">' + opts.catLabel + "</div>" : "") +
      (recipe.origin ? '<div class="origin">' + recipe.origin + "</div>" : "") +
      (recipe.desc ? '<div class="desc-line">' + recipe.desc + "</div>" : "");

    const meta = document.createElement("div");
    meta.className = "recipe-meta";
    let metaHtml = "";
    if (recipe.time && recipe.time.total) metaHtml += "<span>⏱ " + recipe.time.total + "</span>";
    if (recipe.yield) metaHtml += "<span>🍽 " + recipe.yield + "</span>";
    if (recipe.difficulty) metaHtml += "<span>📊 " + recipe.difficulty + "</span>";
    meta.innerHTML = metaHtml;

    const chevron = document.createElement("div");
    chevron.className = "chevron";
    chevron.textContent = "▶";

    cardHeader.appendChild(toggle);
    cardHeader.appendChild(favToggle);
    cardHeader.appendChild(thumb);
    cardHeader.appendChild(title);
    cardHeader.appendChild(meta);
    cardHeader.appendChild(chevron);

    cardHeader.addEventListener("click", () => {
      Router.toReceita(catId, recipe.name);
    });

    card.appendChild(cardHeader);
    return card;
  }

  // ---------- Página própria da receita ----------
  function findRecipe(catId, name) {
    const recipes = window.RECIPES[catId] || [];
    return recipes.find((r) => r.name === name);
  }

  function renderReceita(catId, name) {
    const cat = window.CATEGORIES.find((c) => c.id === catId);
    const recipe = cat && findRecipe(catId, name);
    if (!recipe) {
      renderHome();
      return;
    }

    activeCat = catId;
    searchInput.value = "";
    renderSidebar();

    header.innerHTML = "";
    content.innerHTML = "";
    progressEl.textContent = "";

    const page = document.createElement("div");
    page.className = "recipe-page";

    const back = document.createElement("button");
    back.className = "back-button";
    back.textContent = "← Voltar para " + cat.label;
    back.addEventListener("click", () => Router.toCategoria(catId));
    page.appendChild(back);

    const hero = document.createElement("div");
    hero.className = "recipe-hero placeholder";
    hero.textContent = "🍽";
    loadRecipeImage(imageQuery(recipe), hero);
    page.appendChild(hero);

    const titleBlock = document.createElement("div");
    titleBlock.className = "recipe-page-title";
    titleBlock.innerHTML =
      "<h2>" + recipe.name + "</h2>" +
      (recipe.origin ? '<div class="origin">' + recipe.origin + "</div>" : "") +
      (recipe.desc ? '<p class="page-desc">' + recipe.desc + "</p>" : "");
    page.appendChild(titleBlock);

    const metaRow = document.createElement("div");
    metaRow.className = "recipe-page-meta";
    let metaHtml = "";
    if (recipe.time && recipe.time.total) metaHtml += "<span>⏱ Total: " + recipe.time.total + "</span>";
    if (recipe.time && recipe.time.prep) metaHtml += "<span>🔪 Preparo: " + recipe.time.prep + "</span>";
    if (recipe.time && recipe.time.cook) metaHtml += "<span>🔥 Cozimento: " + recipe.time.cook + "</span>";
    if (recipe.yield) metaHtml += "<span>🍽 " + recipe.yield + "</span>";
    if (recipe.difficulty) metaHtml += "<span>📊 " + recipe.difficulty + "</span>";
    metaRow.innerHTML = metaHtml;
    page.appendChild(metaRow);

    const actions = document.createElement("div");
    actions.className = "recipe-page-actions";

    const isMade = Storage.isMade(catId, recipe.name);
    const madeBtn = document.createElement("button");
    madeBtn.className = "action-btn" + (isMade ? " active" : "");
    madeBtn.textContent = isMade ? "✓ Já fiz" : "Marcar como feita";
    madeBtn.addEventListener("click", () => {
      const now = Storage.toggleMade(catId, recipe.name);
      madeBtn.classList.toggle("active", now);
      madeBtn.textContent = now ? "✓ Já fiz" : "Marcar como feita";
    });

    const isFav = Storage.isFavorite(catId, recipe.name);
    const favBtn = document.createElement("button");
    favBtn.className = "action-btn" + (isFav ? " active" : "");
    favBtn.textContent = isFav ? "★ Favorito" : "☆ Favoritar";
    favBtn.addEventListener("click", () => {
      const now = Storage.toggleFavorite(catId, recipe.name);
      favBtn.classList.toggle("active", now);
      favBtn.textContent = now ? "★ Favorito" : "☆ Favoritar";
    });

    actions.appendChild(madeBtn);
    actions.appendChild(favBtn);
    page.appendChild(actions);

    const ingSection = document.createElement("div");
    ingSection.className = "recipe-page-section";
    const checked = Storage.getCheckedIngredients(catId, recipe.name);
    const ingItems = (recipe.ingredients || [])
      .map((ing, i) => {
        const isChecked = checked.indexOf(i) !== -1;
        return (
          '<li><label><input type="checkbox" data-idx="' +
          i +
          '"' +
          (isChecked ? " checked" : "") +
          '><span class="' +
          (isChecked ? "struck" : "") +
          '">' +
          ing +
          "</span></label></li>"
        );
      })
      .join("");
    ingSection.innerHTML = "<h4>Ingredientes</h4><ul class=\"ingredients-list checklist\">" + ingItems + "</ul>";
    page.appendChild(ingSection);
    ingSection.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.addEventListener("change", () => {
        const idx = parseInt(cb.dataset.idx, 10);
        Storage.toggleIngredient(catId, recipe.name, idx);
        cb.nextElementSibling.classList.toggle("struck", cb.checked);
      });
    });

    const stepsSection = document.createElement("div");
    stepsSection.className = "recipe-page-section";
    const stepsHtml = (recipe.steps || []).map((s) => "<li>" + s + "</li>").join("");
    stepsSection.innerHTML = "<h4>Modo de preparo</h4><ol class=\"steps-list\">" + stepsHtml + "</ol>";
    page.appendChild(stepsSection);

    if (recipe.tips && recipe.tips.length) {
      const tipsBox = document.createElement("div");
      tipsBox.className = "tips-box";
      tipsBox.innerHTML = "<h4>Dicas</h4><ul>" + recipe.tips.map((t) => "<li>" + t + "</li>").join("") + "</ul>";
      page.appendChild(tipsBox);
    }

    if (recipe.usedFor) {
      const uf = document.createElement("div");
      uf.className = "used-for";
      uf.innerHTML = "<strong>Serve para / usar em:</strong> " + recipe.usedFor;
      page.appendChild(uf);
    }

    content.appendChild(page);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  // ---------- Fotos (Wikipedia, com cache local) ----------
  function imageQuery(recipe) {
    return recipe.name.replace(/\s*\([^)]*\)/g, "").trim();
  }

  // Descrições da Wikipedia que indicam que a página NÃO é sobre comida
  // (evita fotos erradas quando o nome do prato coincide com cidade, pessoa, filme etc.)
  const NOT_FOOD_PATTERN =
    /(comuna|munic[ií]pio|cidade|vila|freguesia|distrito|prov[ií]ncia|departamento francês|commune|village|municipality|district|county|province|rio\b|river|montanha|mountain|banda musical|álbum|album|filme|film|canção|song|s[ée]rie de televis[ãa]o|tv series|futebolista|footballer|jogador de|ator\b|atriz\b|actor|actress|pol[ií]tico|politician|escritor|writer|cantor|singer|pintor|painter)/i;

  function isFoodDescription(data) {
    if (!data) return false;
    const text = ((data.description || "") + " " + (data.extract || "").slice(0, 150)).toLowerCase();
    return !NOT_FOOD_PATTERN.test(text);
  }

  async function fetchWikiThumb(query, lang) {
    try {
      const res = await fetch(
        "https://" + lang + ".wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(query),
        { headers: { Accept: "application/json" } }
      );
      if (!res.ok) return null;
      const data = await res.json();
      if (data && data.thumbnail && data.thumbnail.source && isFoodDescription(data)) {
        return data.thumbnail.source;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  async function opensearchTitle(query, lang, bias) {
    try {
      const q = bias ? query + " " + bias : query;
      const res = await fetch(
        "https://" +
          lang +
          ".wikipedia.org/w/api.php?action=opensearch&format=json&origin=*&limit=1&namespace=0&search=" +
          encodeURIComponent(q)
      );
      if (!res.ok) return null;
      const data = await res.json();
      return (data && data[1] && data[1][0]) || null;
    } catch (e) {
      return null;
    }
  }

  async function findWikiImage(query) {
    let url = await fetchWikiThumb(query, "pt");
    if (url) return url;
    url = await fetchWikiThumb(query, "en");
    if (url) return url;
    const ptTitle = await opensearchTitle(query, "pt", "prato culinária");
    if (ptTitle) {
      url = await fetchWikiThumb(ptTitle, "pt");
      if (url) return url;
    }
    const enTitle = await opensearchTitle(query, "en", "dish food");
    if (enTitle) {
      url = await fetchWikiThumb(enTitle, "en");
      if (url) return url;
    }
    return null;
  }

  function applyImage(el, url) {
    if (url) {
      el.classList.remove("placeholder");
      el.innerHTML = "";
      const img = document.createElement("img");
      img.src = url;
      img.alt = "";
      img.loading = "lazy";
      img.onerror = () => {
        el.classList.add("placeholder");
        el.innerHTML = "🍽";
      };
      el.appendChild(img);
    } else {
      el.classList.add("placeholder");
      el.innerHTML = "🍽";
    }
  }

  async function loadRecipeImage(query, el) {
    const cacheKey = "imgcache-v1:" + query.toLowerCase();
    let cached = null;
    try {
      cached = localStorage.getItem(cacheKey);
    } catch (e) {}
    if (cached) {
      applyImage(el, cached === "__none__" ? null : cached);
      return;
    }
    const url = await findWikiImage(query);
    try {
      localStorage.setItem(cacheKey, url || "__none__");
    } catch (e) {}
    applyImage(el, url);
  }

  // ---------- Roteamento ----------
  function handleRoute(route) {
    if (route.name === "busca" && route.query) {
      activeCat = null;
      searchInput.value = route.query;
      renderSidebar();
      renderSearchResults(route.query);
    } else if (route.name === "categoria") {
      showCategoria(route.catId);
    } else if (route.name === "receita") {
      renderReceita(route.catId, route.recipeName);
    } else {
      renderHome();
    }
  }

  Router.onChange(handleRoute);

  // ---------- Inicialização ----------
  handleRoute(Router.current());
})();
