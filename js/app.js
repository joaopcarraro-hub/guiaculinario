(function () {
  const sidebar = document.getElementById("category-list");
  const header = document.getElementById("category-header");
  const content = document.getElementById("recipes-content");
  const searchInput = document.getElementById("search");
  const progressEl = document.getElementById("progress");

  const STORAGE_KEY = "cardapio-feitos-v1";
  const madeSet = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));

  function saveMade() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...madeSet]));
  }

  function recipeKey(catId, name) {
    return catId + "::" + name;
  }

  let activeCat = null;

  function renderSidebar(filterText) {
    sidebar.innerHTML = "";
    const groups = {};
    window.CATEGORIES.forEach((c) => {
      if (!groups[c.group]) groups[c.group] = [];
      groups[c.group].push(c);
    });

    const q = (filterText || "").trim().toLowerCase();

    Object.keys(groups).forEach((groupName) => {
      const cats = groups[groupName];
      const groupTitle = document.createElement("div");
      groupTitle.className = "group-title";
      groupTitle.textContent = groupName;
      sidebar.appendChild(groupTitle);

      cats.forEach((cat) => {
        const recipes = window.RECIPES[cat.id] || [];
        let matches = true;
        if (q) {
          matches =
            cat.label.toLowerCase().includes(q) ||
            recipes.some((r) => r.name.toLowerCase().includes(q));
        }
        if (!matches) return;

        const btn = document.createElement("button");
        btn.className = "cat-item" + (cat.ready ? " ready" : "") + (cat.id === activeCat ? " active" : "");
        btn.innerHTML =
          '<span class="dot"></span><span>' +
          cat.label +
          "</span>" +
          (recipes.length ? '<span class="count">' + recipes.length + "</span>" : "");
        btn.addEventListener("click", () => {
          activeCat = cat.id;
          renderSidebar(searchInput.value);
          renderCategory(cat, q);
        });
        sidebar.appendChild(btn);
      });
    });
  }

  function renderCategory(cat, filterText) {
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

    const q = (filterText || "").trim().toLowerCase();
    const filtered = q ? recipes.filter((r) => r.name.toLowerCase().includes(q)) : recipes;

    if (!filtered.length) {
      content.innerHTML = '<div class="empty-state">Nenhuma receita encontrada para "' + filterText + '".</div>';
      return;
    }

    let lastSubgroup = null;
    filtered.forEach((recipe) => {
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
    const doneCount = recipes.filter((r) => madeSet.has(recipeKey(cat.id, r.name))).length;
    progressEl.textContent = doneCount + " de " + recipes.length + " já feitas nessa categoria ✓";
  }

  function renderRecipeCard(catId, recipe) {
    const card = document.createElement("div");
    card.className = "recipe-card";

    const key = recipeKey(catId, recipe.name);
    const isMade = madeSet.has(key);
    if (isMade) card.classList.add("made-card");

    const header = document.createElement("div");
    header.className = "recipe-header";

    const toggle = document.createElement("button");
    toggle.className = "made-toggle" + (isMade ? " made" : "");
    toggle.title = "Marcar como já feito";
    toggle.textContent = "✓";
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      if (madeSet.has(key)) {
        madeSet.delete(key);
        toggle.classList.remove("made");
      } else {
        madeSet.add(key);
        toggle.classList.add("made");
      }
      saveMade();
      const cat = window.CATEGORIES.find((c) => c.id === catId);
      updateProgress(cat, window.RECIPES[catId]);
    });

    const title = document.createElement("div");
    title.className = "recipe-title";
    title.innerHTML =
      "<h3>" + recipe.name + "</h3>" +
      (recipe.origin ? '<div class="origin">' + recipe.origin + "</div>" : "");

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

    header.appendChild(toggle);
    header.appendChild(title);
    header.appendChild(meta);
    header.appendChild(chevron);

    header.addEventListener("click", () => {
      card.classList.toggle("open");
    });

    const body = document.createElement("div");
    body.className = "recipe-body";
    body.innerHTML = renderRecipeBody(recipe);

    card.appendChild(header);
    card.appendChild(body);
    return card;
  }

  function renderRecipeBody(recipe) {
    const ingredientsHtml = (recipe.ingredients || [])
      .map((i) => "<li>" + i + "</li>")
      .join("");
    const stepsHtml = (recipe.steps || []).map((s) => "<li>" + s + "</li>").join("");
    const tipsHtml = (recipe.tips || []).map((t) => "<li>" + t + "</li>").join("");

    let timeLine = "";
    if (recipe.time) {
      const parts = [];
      if (recipe.time.prep) parts.push("Preparo: " + recipe.time.prep);
      if (recipe.time.cook) parts.push("Cozimento: " + recipe.time.cook);
      if (recipe.time.total) parts.push("Total: " + recipe.time.total);
      timeLine = parts.join(" · ");
    }

    return (
      '<div class="recipe-columns">' +
      "<div>" +
      "<h4>Ingredientes</h4>" +
      '<ul class="ingredients-list">' +
      ingredientsHtml +
      "</ul>" +
      (timeLine ? '<div class="used-for"><strong>Tempo:</strong> ' + timeLine + "</div>" : "") +
      "</div>" +
      "<div>" +
      "<h4>Modo de preparo</h4>" +
      '<ol class="steps-list">' +
      stepsHtml +
      "</ol>" +
      (tipsHtml
        ? '<div class="tips-box"><h4>Dicas</h4><ul>' + tipsHtml + "</ul></div>"
        : "") +
      (recipe.usedFor
        ? '<div class="used-for"><strong>Serve para / usar em:</strong> ' + recipe.usedFor + "</div>"
        : "") +
      "</div>" +
      "</div>"
    );
  }

  searchInput.addEventListener("input", () => {
    renderSidebar(searchInput.value);
    if (activeCat) {
      const cat = window.CATEGORIES.find((c) => c.id === activeCat);
      renderCategory(cat, searchInput.value);
    }
  });

  // Inicialização: abre a primeira categoria pronta
  renderSidebar("");
  const firstReady = window.CATEGORIES.find((c) => c.ready) || window.CATEGORIES[0];
  activeCat = firstReady.id;
  renderSidebar("");
  renderCategory(firstReady, "");
})();
