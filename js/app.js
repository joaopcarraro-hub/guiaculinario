(function () {
  const header = document.getElementById("category-header");
  const content = document.getElementById("recipes-content");
  const progressEl = document.getElementById("progress");

  const firstCollection = window.COLLECTIONS[0];
  let activeCat = null; // id da coleção atual; null quando estamos na home, busca global ou telas de lista
  // Modal de filtros aberto (Bloco 3) — o overlay vive em document.body, fora de #recipes-content,
  // então uma navegação (ex.: botão/gesto voltar do celular) enquanto o modal está aberto não o
  // remove sozinha. handleRoute() força o fechamento no início de toda troca de rota.
  let closeActiveFilterModal = null;

  // Fix conhecido do iOS Safari (apple-design skill, item de feedback de pressão): :active só é
  // honrado em tap se existir 1 listener de touch em algum ancestral, mesmo vazio — sem isso, o
  // :active do CSS (.primary-cta, .recipe-card etc.) nunca dispara em toque real, só com mouse.
  // Registrado 1x, globalmente, no carregamento do app.
  document.addEventListener("touchstart", function () {}, { passive: true });

  // ---------- Ícones outline (Bloco 2 — barra inferior + tiles novos da home) ----------
  // Único monocromático: stroke=currentColor, cor real vem do CSS (--color-accent /
  // --color-text-disabled / --color-text-primary), nunca fixa no path.
  const ICON_SVG_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  const ICONS = {
    home: '<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.5-4.5"/>',
    bookmark: '<path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1Z"/>',
    cart: '<path d="M4 6h2l2 11h10l2-8H7"/><circle cx="9.5" cy="20" r="1.3"/><circle cx="16.5" cy="20" r="1.3"/>',
    bowl: '<path d="M4 12a8 8 0 0 0 16 0"/><path d="M4 12h16"/><path d="M8 8c1 1 1 2 0 3"/><path d="M12 7c1 1 1 2 0 3"/><path d="M16 8c1 1 1 2 0 3"/>',
    flame: '<path d="M12 3c2 3 4 5 4 8a4 4 0 1 1-8 0c0-1 .3-2 1-3 .2 1.5 1 2 1.8 2A2 2 0 0 0 13 8c0-2-2-3-1-5Z"/>',
    globe: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16"/><path d="M12 4c2.5 2.5 2.5 13 0 16"/><path d="M12 4c-2.5 2.5-2.5 13 0 16"/>',
    cupcake: '<path d="M7 11h10l-1.2 7.5A2 2 0 0 1 13.8 20h-3.6a2 2 0 0 1-2-1.5L7 11Z"/><path d="M6 11a6 4 0 0 1 12 0Z"/><path d="M12 3v2.2"/>',
    dots: '<circle cx="6" cy="6" r="1.6"/><circle cx="12" cy="6" r="1.6"/><circle cx="18" cy="6" r="1.6"/><circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/>',
    filter: '<path d="M4 5h16l-6.5 7.5V19l-3 1.6v-8.1Z"/>',
    chevronDown: '<path d="M6 9l6 6 6-6"/>',
    chevronLeft: '<path d="M15 6l-6 6 6 6"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5v4.5l3 2"/>',
    gauge: '<path d="M6 18v-4"/><path d="M12 18V9"/><path d="M18 18V6"/>',
    arrowUpRight: '<path d="M8 16 16 8"/><path d="M9 8h7v7"/>',
    close: '<path d="M6 6l12 12"/><path d="M18 6 6 18"/>',
    photoOff: '<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M5 16l4.5-4 3.5 3 2.5-2 3.5 3.5"/>',
  };
  function iconSvg(key, className) {
    return '<svg class="' + className + '" ' + ICON_SVG_ATTRS + ">" + ICONS[key] + "</svg>";
  }

  // ---------- Controles flutuantes de topo (item 1 do roadmap) ----------
  // Compartilhados por toda tela com página-mãe (receita, coleção, grupo/hub) e pelo "Sair" do
  // modo cozinhar — ver .chrome-float/.back-float/.exit-cook-float no CSS. Centraliza a
  // construção do elemento aqui pra nunca duplicar classe/ícone/estrutura entre os call sites.
  function createBackFloat(destLabel, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chrome-float back-float";
    btn.setAttribute("aria-label", "Voltar para " + destLabel);
    btn.innerHTML = iconSvg("chevronLeft", "back-float__icon");
    btn.addEventListener("click", onClick);
    return btn;
  }

  // Modo cozinhar nunca tem "voltar" (regra fixa da skill product-navigation-ux) — isto NÃO é
  // um createBackFloat com destino "Sair"; é um controle diferente, mesma linguagem visual.
  function createExitCookFloat(onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chrome-float exit-cook-float";
    btn.setAttribute("aria-label", "Sair do modo cozinhar");
    btn.innerHTML = iconSvg("close", "exit-cook-float__icon") + "<span>Sair</span>";
    btn.addEventListener("click", onClick);
    return btn;
  }

  // Fase 0a (auditoria de acessibilidade 2026-07-25): torna um elemento não-nativo (div/span
  // com só um listener de "click") operável por teclado — Tab alcança, Enter/Espaço ativa.
  // Enter/Espaço só disparam el.click() (nunca duplicam a lógica do listener original) — o
  // mesmo listener de click já registrado cuida do resto. Usado em elementos cuja ação NÃO é
  // redundante com nenhum filho nativo interativo (card de receita/categoria/preparo, linha da
  // lista de compras, dígito do timer) — ver critério e casos excluídos no relatório da Fase 0a.
  function makeKeyboardClickable(el) {
    el.setAttribute("role", "button");
    el.tabIndex = 0;
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        el.click();
      }
    });
  }

  // Item 2 (2026-07-28): botão de limpar (glifo X) interno em toda barra de busca do app — só aparece com texto
  // digitado, limpa e refoca o campo, alvo >=44px (mesma fórmula de hit-area de
  // .preparo-card__delete), aria-label "Limpar busca", reaproveita iconSvg("close") já existente
  // (Fase 0c). 1 implementação, 2 usos (home-search do hub, tagsearch-input da busca global) —
  // inventário desta rodada confirmou que só essas 2 barras de busca existem de fato no app; o
  // "modal de países" citado no pedido original não existe como algo à parte (Países é só mais
  // um hub renderGrupo, reaproveita a MESMA barra). wrap precisa de position:relative (CSS) pra
  // ancorar o botão. onClear: chamado DEPOIS do valor já zerado — cada caller reage do seu jeito
  // (dispatchEvent("input") reaproveita o listener de busca que já existe em cada tela, nunca
  // duplica a lógica de re-render aqui).
  function attachSearchClear(input, wrap, onClear) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "search-clear-btn";
    btn.setAttribute("aria-label", "Limpar busca");
    btn.innerHTML = iconSvg("close", "search-clear-btn__icon");
    wrap.appendChild(btn);
    function sync() {
      btn.classList.toggle("is-visible", !!input.value);
    }
    btn.addEventListener("click", () => {
      input.value = "";
      sync();
      input.focus();
      onClear();
    });
    input.addEventListener("input", sync);
    sync();
  }

  // Trilho deslizante genérico N-segmentos (ajuste visual do item 1b, 2026-07-28 rodada 2) —
  // generaliza o toggle Qualquer um/Todos estes de Ingrediente (2 paradas) e o antigo segmentado
  // de 3 pílulas soltas de Papel da proteína (saturava junto dos chips de proteína, achado do
  // dono ao ver ao vivo) num componente ÚNICO: mesma mola (260ms cubic-bezier, CSS
  // .segmented-toggle__thumb), mesmo mecanismo de posição via custom properties CSS
  // (--seg-count/--seg-index, setadas aqui) — nunca um modificador de classe por quantidade de
  // paradas, então generaliza pra qualquer N sem precisar recalcular posição/largura em JS além
  // do índice inteiro. options: [{ value, label }]. selectedIndex: paragrafo já selecionado no
  // momento da criação deste HTML.
  function segmentedToggleHtml(ariaLabel, options, selectedIndex) {
    return (
      '<div class="segmented-toggle" role="radiogroup" aria-label="' +
      ariaLabel +
      '" style="--seg-count:' +
      options.length +
      ";--seg-index:" +
      selectedIndex +
      '">' +
      '<span class="segmented-toggle__thumb" aria-hidden="true"></span>' +
      options
        .map(function (o, i) {
          const selected = i === selectedIndex;
          return (
            '<button type="button" class="segmented-toggle__option' +
            (selected ? " is-active" : "") +
            '" role="radio" aria-checked="' +
            (selected ? "true" : "false") +
            '" data-value="' +
            o.value +
            '">' +
            o.label +
            "</button>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  // Fiação compartilhada do trilho: clique OU seta ←→ (padrão de teclado de radiogroup nativo —
  // mover foco já move a seleção) chamam onSelect(index) IMEDIATO (troca classe/aria/custom-
  // property na hora, sem esperar a mola) e só depois que a mola realmente termina
  // (transitionend, com timeout de segurança de 400ms pro caso de prefers-reduced-motion não
  // disparar o evento) chamam onSettled() — nunca destrói o próprio nó no meio da transição,
  // senão a mola nunca desliza visualmente (mesmo cuidado que o toggle de Ingrediente original
  // já tinha, agora compartilhado pelos 2 usos).
  function wireSegmentedToggle(containerEl, onSelect, onSettled) {
    function optionButtons() {
      return Array.from(containerEl.querySelectorAll(".segmented-toggle__option"));
    }
    function selectIndex(index) {
      const buttons = optionButtons();
      if (buttons[index].classList.contains("is-active")) return;
      containerEl.style.setProperty("--seg-index", index);
      buttons.forEach(function (b, i) {
        b.classList.toggle("is-active", i === index);
        b.setAttribute("aria-checked", i === index ? "true" : "false");
      });
      onSelect(index);
      const thumb = containerEl.querySelector(".segmented-toggle__thumb");
      let settled = false;
      function settle() {
        if (settled) return;
        settled = true;
        thumb.removeEventListener("transitionend", settle);
        onSettled();
      }
      thumb.addEventListener("transitionend", settle);
      setTimeout(settle, 400);
    }
    optionButtons().forEach(function (btn, index) {
      btn.addEventListener("click", function () {
        selectIndex(index);
      });
    });
    containerEl.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const buttons = optionButtons();
      const current = buttons.findIndex(function (b) {
        return b.classList.contains("is-active");
      });
      const delta = e.key === "ArrowRight" ? 1 : -1;
      const next = (current + delta + buttons.length) % buttons.length;
      selectIndex(next);
      buttons[next].focus();
    });
  }

  // Correção de semântica (2026-07-29): "Papel da proteína" deixa de valer só em coleção de
  // proteína — vale em QUALQUER contexto (busca global, coleção não-proteica) sempre que houver
  // >=1 proteína selecionada. S (conjunto ativo de protein:X): o que está EXPLICITAMENTE
  // selecionado na própria faceta Proteína tem prioridade; sem nada selecionado, cai pro
  // implícito da coleção (collection.primaryFilterTags) SE for uma coleção de proteína de
  // verdade — colecão de proteína "sem tocar em nada" continua funcionando exatamente como
  // antes desta rodada (é o caso particular S = primaryFilterTags, ver TagModel.
  // splitByProteinRole em tagmodel.js). collection pode ser null (busca global não tem coleção
  // nenhuma, S depende só do explícito). facetState: tanto o rascunho (draftFacetState, dentro
  // do modal) quanto o aplicado — mesma função serve os 2 usos.
  function activeProteinTagIds(facetState, collection) {
    const explicit = (facetState && facetState.protein) || [];
    if (explicit.length) return explicit;
    return collection && collection.collectionType === "protein" ? collection.primaryFilterTags : [];
  }

  // Dívida #2 (2026-07-30): única fonte da regra anti-fantasma — substitui 3 cópias de
  // validação no init (renderGrupo/renderCategory/renderBusca), reusada também nos 2 handlers
  // de × que re-validam antes de persistir.
  function validProteinRole(candidate, facetState, collection) {
    if (candidate !== "focus" && candidate !== "secondary") return null;
    return activeProteinTagIds(facetState, collection).length > 0 ? candidate : null;
  }

  // 3b-UI (2026-07-30): vista padrão de coleção (proteína/país) — só mostra o que responde à
  // identidade da coleção (nature:prato ∧ tag literal de identidade); participação (contains:X)
  // e preparo/técnica ficam atrás de ação explícita (papel=Secundário, ou a seção fixa "Preparos
  // e técnicas" em renderCategory, que é a única consumidora — helper local a ela, ver lá).
  // Fora de coleção de proteína/país (collection null ou outro collectionType — hub, busca
  // global, Fundamentos etc.), a checagem devolve false e ninguém filtra nada.
  function isIdentityCollection(collection) {
    return !!collection && (collection.collectionType === "protein" || collection.collectionType === "country");
  }

  // Ícone de coração pro favoritar (docs/DESIGN-TOKENS.md) — usado tanto no botão da tela de
  // receita quanto no card. Não usa o sistema ICON_SVG_ATTRS/ICONS acima porque precisa de 2
  // estados de PREENCHIMENTO (contorno vazio parado, sólido quando favoritado), não só troca
  // de cor — a classe .recipe-heart-icon/.is-favorite no CSS controla isso (fill: none parado,
  // fill: var(--color-accent) quando o ancestral tem .is-favorite).
  const HEART_ICON_SVG =
    '<svg class="recipe-heart-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z"/></svg>';

  // Ícone autoral da aba "Preparos" (panela de cabo único) — arquivo próprio em icons/preparos.svg,
  // sem exigência de atribuição. Não usa o sistema ICON_SVG_ATTRS/ICONS acima (todos stroke-based,
  // viewBox 24x24): este é um ícone de traço preenchido (fill), formato diferente, então vem como
  // markup completo próprio. Embutido como string — mesmo padrão anti-race-condition do
  // EQUIPMENT_SVG_MARKUP — nunca via fetch()/<img src>, pra currentColor herdar a cor do estado da
  // aba (--color-text-disabled parado, --color-accent ativo) sem depender de round-trip nenhum.
  const PREPAROS_ICON_SVG =
    '<svg class="bottom-nav__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none" aria-hidden="true"><path d="M 0 314 L 0 324 L 1 325 L 1 331 L 2 332 L 2 336 L 3 337 L 3 340 L 4 341 L 4 343 L 5 344 L 5 346 L 7 349 L 7 351 L 8 352 L 8 353 L 10 355 L 10 356 L 11 357 L 12 360 L 14 362 L 14 363 L 17 366 L 17 367 L 29 379 L 30 379 L 34 383 L 35 383 L 37 385 L 38 385 L 43 389 L 44 389 L 49 392 L 51 392 L 52 393 L 299 393 L 300 392 L 301 392 L 302 391 L 303 391 L 304 390 L 307 389 L 309 387 L 312 386 L 314 384 L 315 384 L 318 381 L 319 381 L 327 373 L 328 373 L 329 372 L 329 371 L 334 366 L 334 365 L 337 362 L 338 359 L 340 357 L 340 356 L 341 355 L 341 354 L 344 349 L 344 347 L 346 344 L 346 342 L 347 341 L 347 338 L 349 335 L 503 335 L 504 334 L 506 334 L 510 330 L 510 328 L 511 327 L 511 323 L 510 322 L 509 319 L 504 316 L 351 316 L 350 315 L 350 313 L 349 312 L 348 309 L 343 306 L 8 306 L 7 307 L 5 307 L 1 311 L 1 313 Z M 20 326 L 21 325 L 329 325 L 330 326 L 330 329 L 329 330 L 329 333 L 328 334 L 328 337 L 327 338 L 327 339 L 324 344 L 324 346 L 322 348 L 322 349 L 320 351 L 320 352 L 317 355 L 317 356 L 309 364 L 308 364 L 304 368 L 303 368 L 301 370 L 300 370 L 299 371 L 296 372 L 294 374 L 57 374 L 56 373 L 55 373 L 54 372 L 51 371 L 46 367 L 45 367 L 39 361 L 38 361 L 37 360 L 37 359 L 31 353 L 31 352 L 27 347 L 27 346 L 25 343 L 25 341 L 22 336 L 22 333 L 21 332 L 21 329 L 20 328 Z M 251 118 L 244 118 L 243 119 L 242 119 L 238 123 L 238 127 L 237 128 L 237 133 L 236 134 L 236 135 L 234 137 L 234 138 L 223 149 L 223 150 L 219 155 L 219 156 L 216 161 L 216 163 L 215 164 L 215 167 L 214 168 L 214 180 L 215 181 L 215 184 L 216 185 L 216 187 L 217 188 L 217 189 L 218 190 L 219 193 L 221 195 L 221 196 L 224 199 L 224 200 L 234 210 L 234 211 L 236 213 L 236 214 L 237 215 L 237 226 L 236 227 L 236 229 L 233 232 L 233 233 L 222 244 L 222 245 L 218 250 L 218 251 L 217 252 L 217 254 L 215 257 L 215 261 L 214 262 L 214 269 L 215 270 L 215 272 L 217 274 L 217 275 L 218 275 L 221 277 L 227 277 L 232 273 L 232 272 L 233 271 L 233 266 L 234 265 L 234 262 L 235 261 L 235 259 L 240 254 L 240 253 L 249 244 L 249 243 L 252 240 L 252 239 L 254 236 L 254 234 L 255 233 L 255 231 L 256 230 L 256 226 L 257 225 L 257 217 L 256 216 L 256 211 L 255 210 L 255 208 L 254 207 L 254 206 L 253 205 L 252 202 L 250 200 L 250 199 L 247 196 L 247 195 L 237 185 L 237 184 L 235 182 L 235 181 L 234 180 L 234 176 L 233 175 L 233 173 L 234 172 L 234 168 L 235 167 L 236 164 L 247 153 L 247 152 L 250 149 L 250 148 L 252 146 L 252 145 L 255 140 L 255 138 L 256 137 L 256 132 L 257 131 L 257 126 L 256 125 L 256 123 L 255 122 L 255 121 L 254 120 L 253 120 Z M 191 118 L 183 118 L 181 120 L 180 120 L 180 121 L 178 123 L 178 126 L 177 127 L 177 132 L 176 133 L 175 136 L 173 138 L 173 139 L 163 149 L 163 150 L 160 153 L 160 154 L 158 156 L 158 157 L 156 160 L 156 162 L 155 163 L 155 166 L 154 167 L 154 181 L 155 182 L 155 185 L 156 186 L 156 188 L 157 189 L 158 192 L 160 194 L 160 195 L 163 198 L 163 199 L 173 209 L 173 210 L 175 212 L 175 213 L 177 216 L 177 226 L 176 227 L 175 230 L 161 245 L 161 246 L 159 248 L 159 249 L 156 254 L 156 256 L 155 257 L 155 260 L 154 261 L 154 271 L 156 273 L 156 274 L 157 275 L 158 275 L 160 277 L 166 277 L 171 274 L 171 273 L 173 270 L 173 264 L 174 263 L 174 261 L 175 260 L 175 259 L 177 257 L 177 256 L 188 245 L 188 244 L 191 241 L 191 240 L 192 239 L 192 238 L 195 233 L 195 230 L 196 229 L 196 213 L 195 212 L 195 209 L 194 208 L 194 206 L 193 205 L 192 202 L 189 199 L 189 198 L 185 194 L 185 193 L 176 184 L 176 183 L 174 180 L 174 178 L 173 177 L 173 171 L 174 170 L 174 168 L 175 167 L 175 165 L 184 156 L 184 155 L 189 150 L 189 149 L 192 146 L 192 145 L 194 142 L 194 140 L 195 139 L 195 137 L 196 136 L 196 129 L 197 128 L 197 127 L 196 126 L 196 123 Z M 130 118 L 123 118 L 122 119 L 121 119 L 119 121 L 119 122 L 117 125 L 117 131 L 116 132 L 116 134 L 115 135 L 115 136 L 111 140 L 111 141 L 101 151 L 101 152 L 99 154 L 99 155 L 97 157 L 97 158 L 96 159 L 96 161 L 95 162 L 95 165 L 94 166 L 94 173 L 93 174 L 94 175 L 94 182 L 95 183 L 95 186 L 96 187 L 96 188 L 97 189 L 97 190 L 98 191 L 99 194 L 102 197 L 102 198 L 112 208 L 112 209 L 115 212 L 115 213 L 116 214 L 116 216 L 117 217 L 117 224 L 116 225 L 116 227 L 115 228 L 114 231 L 103 242 L 103 243 L 100 246 L 100 247 L 98 249 L 98 250 L 96 253 L 96 255 L 95 256 L 95 258 L 94 259 L 94 271 L 95 272 L 95 273 L 98 276 L 99 276 L 100 277 L 106 277 L 107 276 L 108 276 L 112 272 L 112 269 L 113 268 L 113 263 L 114 262 L 114 260 L 116 258 L 116 257 L 127 246 L 127 245 L 130 242 L 130 241 L 132 239 L 132 238 L 134 235 L 134 233 L 135 232 L 135 229 L 136 228 L 136 214 L 135 213 L 135 210 L 134 209 L 134 207 L 133 206 L 133 205 L 132 204 L 131 201 L 128 198 L 128 197 L 117 186 L 117 185 L 115 183 L 115 182 L 113 179 L 113 169 L 114 168 L 115 165 L 117 163 L 117 162 L 128 151 L 128 150 L 131 147 L 131 146 L 134 141 L 134 139 L 135 138 L 135 135 L 136 134 L 136 124 L 135 123 L 135 122 L 132 119 L 131 119 Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"/></svg>';

  // ---------- Barra de navegação inferior (fixa, 5 abas) ----------
  const BOTTOM_NAV_TABS = [
    { id: "home", label: "Home", icon: "home", go: () => Router.toHome() },
    { id: "pesquisar", label: "Pesquisar", icon: "search", go: () => Router.toBusca([], []) },
    { id: "minhas-receitas", label: "Minhas Receitas", icon: "bookmark", go: () => Router.toMinhasReceitas() },
    { id: "preparos", label: "Preparos", iconHtml: PREPAROS_ICON_SVG, go: () => Router.toPreparos() },
    { id: "lista-compras", label: "Lista de Compras", icon: "cart", go: () => Router.toListaCompras() },
  ];
  const bottomNavEl = document.getElementById("bottom-nav");
  function renderBottomNav() {
    if (!bottomNavEl) return;
    bottomNavEl.innerHTML = BOTTOM_NAV_TABS.map(
      (tab) =>
        '<button type="button" class="bottom-nav__tab" data-route="' +
        tab.id +
        '" aria-label="' +
        tab.label +
        '">' +
        (tab.iconHtml || iconSvg(tab.icon, "bottom-nav__icon")) +
        '<span class="bottom-nav__label">' + tab.label + "</span></button>"
    ).join("");
    Array.prototype.forEach.call(bottomNavEl.querySelectorAll(".bottom-nav__tab"), (btn, i) => {
      btn.addEventListener("click", () => BOTTOM_NAV_TABS[i].go());
    });
  }
  // route.name -> id da aba correspondente (rotas sem aba própria, ex. categoria/receita, não ativam nenhuma).
  const ROUTE_TO_BOTTOM_NAV_TAB = {
    home: "home",
    busca: "pesquisar",
    "minhas-receitas": "minhas-receitas",
    preparos: "preparos",
    "lista-compras": "lista-compras",
  };
  function updateBottomNav(route) {
    if (!bottomNavEl) return;
    const activeTab = ROUTE_TO_BOTTOM_NAV_TAB[route.name] || null;
    Array.prototype.forEach.call(bottomNavEl.querySelectorAll(".bottom-nav__tab"), (btn) => {
      btn.classList.toggle("is-active", btn.dataset.route === activeTab);
    });
  }

  // ---------- Busca facetada: parser de query (tags vivas + texto residual) ----------
  // Reescrito em 2026-07-24: o texto digitado agora PRODUZ resultado direto (2 blocos, ver
  // renderBusca) — antes só alimentava sugestão, nunca filtrava a lista sozinho. A decomposição
  // da query em tags/texto mora em js/search.js (Search.parseQuery/searchByQuery); esta tela só
  // consome o resultado e desenha os chips (removível pra cada tag AUTO-inferida, "+" pra cada
  // chip OPCIONAL de termo ambíguo — ver renderBusca).

  // ---------- Chips de tags clicáveis (cards e página da receita) ----------
  // time:/difficulty: ficam de fora — já aparecem como texto simples no meta row, mostrar de novo seria redundante.
  const TAG_CHIP_PRIORITY = ["country:", "dish_type:", "protein:", "course:", "ingredient:"];
  function priorityTagIds(tags, maxCount) {
    const ordered = [];
    TAG_CHIP_PRIORITY.forEach((prefix) => {
      tags.forEach((t) => {
        if (t.indexOf(prefix) === 0 && ordered.indexOf(t) === -1) ordered.push(t);
      });
    });
    return ordered.slice(0, maxCount);
  }

  function buildTagChipsEl(tagIds, className) {
    const wrap = document.createElement("div");
    wrap.className = className;
    tagIds.forEach((tagId) => {
      const tag = TagModel.getTagById(tagId);
      if (!tag) return;
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "tag-chip-link";
      chip.textContent = tag.label;
      chip.addEventListener("click", (e) => {
        e.stopPropagation();
        Router.toBusca([tagId]);
      });
      wrap.appendChild(chip);
    });
    return wrap;
  }

  // ---------- Regra da 1 tag do card (redesenho do card de receita) ----------
  // Funções puras (sem closure sobre DOM/TagModel) de propósito — scripts/verify-card-contract-
  // 2026-07-25.js extrai e executa as duas isoladamente pra simular o cenário de 2+ filtros de
  // país sem precisar de navegador. Prioridade: tipo-de-prato > proteína, NUNCA país — exceto
  // quando o filtro ativo da tela tem 2+ country: distintos, aí o país da própria receita
  // SUBSTITUI a tag (nunca soma, disciplina de 1 chip só).
  function hasMultiCountryFilter(tagIds) {
    return new Set((tagIds || []).filter((id) => id.indexOf("country:") === 0)).size >= 2;
  }
  function singleCardTagId(item, opts) {
    const tags = item.tags || [];
    if (opts && opts.countryOverride) {
      const countryId = tags.find((t) => t.indexOf("country:") === 0);
      if (countryId) return countryId;
    }
    const dishType = tags.find((t) => t.indexOf("dish_type:") === 0);
    if (dishType) return dishType;
    return tags.find((t) => t.indexOf("protein:") === 0) || null;
  }

  // ---------- Grupos macro (home -> página de grupo -> coleção -> receita) ----------
  // icon/desc removidos (item 6 do roadmap-mestre): título do hub deixou de levar emoji e a
  // descrição textual morreu de vez (decisão antiga do roadmap) — ver renderGrupo/.grupo-sheet.
  const GRUPOS = [
    { id: "fundamentos", label: "Mais Categorias", collectionGroup: "Fundamentos" },
    { id: "proteinas", label: "Proteínas", collectionGroup: "Proteínas" },
    { id: "cozinhas", label: "Países", collectionGroup: "Países" },
    { id: "tempo", label: "Por tempo", collectionGroup: "Por tempo" },
    { id: "dificuldade", label: "Por dificuldade", collectionGroup: "Por dificuldade" },
  ];

  // Banner do hub (item 6 do roadmap-mestre, imagem gerada por scripts/gerar-categorias.js) — só
  // os 3 hubs alcançáveis por link real da Home têm banner (fundamentos/proteinas/cozinhas).
  // tempo/dificuldade são rotas órfãs (nenhum link no app, só URL direta) e continuam sem banner,
  // tratamento tipográfico simples de sempre — ver renderGrupo.
  // cozinhas usa imagens/categorias/paises.webp (imagem-conceito de 5 pratos, commit 282417e) —
  // MESMO asset no banner deste hub e no tile "Países" da Home (HOME_MAIN_TILES), exatamente como
  // os outros 2 hubs fazem com o seu. Isto encerra a linhagem "mosaico/mural de bandeiras"
  // (rodadas 2-4), que só existia porque a foto de temperos antes usada aqui perdia identidade:
  // o mural morreu junto com ela, e a BANDEIRA agora só vive na faceta País do modal de Filtros
  // (.filter-tile--photo). O tile de país DENTRO deste hub também deixou de ser bandeira e passou
  // a mostrar a foto da receita-assinatura — ver countrySignatureRecipe/renderCollectionCard.
  const GRUPO_BANNER_IMAGE = {
    fundamentos: "imagens/categorias/hub-fundamentos.webp",
    proteinas: "imagens/categorias/hub-proteinas.webp",
    cozinhas: "imagens/categorias/paises.webp",
  };

  // Hash atual em formato "path" (sem "#" nem "/" inicial) — mesmo formato que Router.navigate
  // espera e que Router.parseHash usa internamente ("raw"). Usado tanto pra guardar a rota de
  // origem completa ao abrir uma receita (Router.toReceita/toCozinhar, "Voltar" reconstrói via
  // Router.navigate(fromHash) direto) quanto como chave do mapa de scroll por rota (ver
  // scrollPositionsByHash perto de handleRoute).
  function currentHashPath() {
    return location.hash.replace(/^#\/?/, "");
  }

  // Mapa catId -> grupo, derivado de window.COLLECTIONS (fonte atual, a mesma usada pelo botão
  // voltar via "collection.group === grupo.collectionGroup") — NUNCA de window.CATEGORIES,
  // cujo campo .group ficou desatualizado (ex: ainda marca "arrozes" como Proteínas e mantém
  // "Brasil" como grupo próprio, quando collections.js já moveu isso pra Fundamentos/Cozinhas
  // do Mundo). Só as coleções de "paridade de categoria" (id === id da categoria) entram aqui;
  // coleções sintéticas cruzadas (col-ovo, col-vegetariana, col-rapidas etc.) não representam
  // o "lar" de nenhuma receita, então ficam de fora de propósito.
  let catIdToGroupCache = null;
  function getCatIdToGroup() {
    if (catIdToGroupCache) return catIdToGroupCache;
    const map = {};
    window.COLLECTIONS.forEach((c) => {
      if (window.CATEGORIES.some((cat) => cat.id === c.id)) map[c.id] = c.group;
    });
    // brasileiros/brasil-regional foram fundidos na coleção "brasil" (sem coleção própria mais)
    const brasilCollection = window.COLLECTIONS.find((c) => c.id === "brasil");
    if (brasilCollection) {
      map["brasileiros"] = brasilCollection.group;
      map["brasil-regional"] = brasilCollection.group;
    }
    // contemporaneos/tecnicas-contemporaneas-2 foram fundidos na coleção "tecnicas"
    const tecnicasCollection = window.COLLECTIONS.find((c) => c.id === "tecnicas");
    if (tecnicasCollection) {
      map["contemporaneos"] = tecnicasCollection.group;
      map["tecnicas-contemporaneas-2"] = tecnicasCollection.group;
    }
    // risotos/arrozes foram fundidos na coleção "risotos-arroz"
    const risotosArrozCollection = window.COLLECTIONS.find((c) => c.id === "risotos-arroz");
    if (risotosArrozCollection) {
      map["risotos"] = risotosArrozCollection.group;
      map["arrozes"] = risotosArrozCollection.group;
    }
    // entradas-frias/entradas-quentes foram fundidas na coleção "entradas"
    const entradasCollection = window.COLLECTIONS.find((c) => c.id === "entradas");
    if (entradasCollection) {
      map["entradas-frias"] = entradasCollection.group;
      map["entradas-quentes"] = entradasCollection.group;
    }
    // ovos-basicos/ovos-classicos não têm mais coleção própria em Fundamentos — já satisfazem
    // protein:ovo e vivem em "Ovos" (col-ovo, Proteínas); sem este fallback a busca do hub
    // escoparia essas receitas como Fundamentos (por catId) enquanto a navegação já as trata
    // como Proteínas (por tag), os dois mecanismos discordando.
    const ovoCollection = window.COLLECTIONS.find((c) => c.id === "col-ovo");
    if (ovoCollection) {
      map["ovos-basicos"] = ovoCollection.group;
      map["ovos-classicos"] = ovoCollection.group;
    }
    catIdToGroupCache = map;
    return map;
  }

  // Acervo de imagem de categoria (item 6 do roadmap-mestre, scripts/gerar-categorias.js) — 16
  // ids (8 Fundamentos + 8 Proteínas), paridade 1:1 confirmada por investigação contra
  // window.COLLECTIONS (ver relatório da tarefa: zero tile órfão nesses 2 grupos). País NÃO usa
  // este acervo: usa a foto da receita-assinatura (imagens/receitas/, resolvida por
  // countrySignatureRecipe + loadRecipeImage) — ver collectionTileImageSrc logo abaixo. O acervo
  // de categoria tem ainda paises.webp, mas só como imagem-conceito de HUB (banner + tile da
  // Home, GRUPO_BANNER_IMAGE/HOME_MAIN_TILES), nunca como tile de coleção. Por tempo/Por
  // dificuldade (7 coleções, rotas órfãs sem link nenhum no app) não têm imagem — fallback
  // tipográfico limpo (faixa + nome, sem buraco).
  const CATEGORY_TILE_IMAGE_IDS = new Set([
    "molhos", "sopas", "entradas", "massas", "risotos-arroz", "padaria", "sobremesas-classicas", "tecnicas",
    "aves", "carnes-bovinas", "suinos", "peixes", "frutos-do-mar", "col-ovo", "cordeiro", "col-vegetariana",
  ]);

  // Caminho da imagem de um tile de coleção de CATEGORIA (imagens/categorias/<id>.webp).
  // País NÃO passa por aqui: desde o rumo novo de Países (26/07/2026) o tile de país não é mais
  // bandeira e sim a FOTO da receita-assinatura, resolvida em runtime pela mesma cascata das
  // outras superfícies de receita (loadRecipeImage: foto própria -> Wikipedia -> placeholder) —
  // ver countrySignatureRecipe abaixo e renderCollectionCard. Bandeira sobreviveu só na faceta
  // País do modal de Filtros (renderCountryTileSectionBody/.filter-tile--photo), que continua
  // lendo o iso2 de window.COUNTRIES. null = sem imagem mapeada, tile cai no fallback tipográfico.
  function collectionTileImageSrc(collection) {
    if (collection.collectionType === "country") return null;
    return CATEGORY_TILE_IMAGE_IDS.has(collection.id) ? "imagens/categorias/" + collection.id + ".webp" : null;
  }

  // Receita-assinatura de um país — o prato que o tile do hub Países mostra. window.COUNTRIES
  // (js/countries.js) é MAPA CURADO, não derivado: "qual prato lê aquele país de relance" é
  // julgamento humano, e a §4 do CONTRATO-IMAGENS-REDESIGN.md registra Países como a ÚNICA
  // exceção documentada à regra "nenhuma receita representa categoria" (que segue valendo pras
  // demais categorias, todas com imagem-conceito própria).
  //
  // ATENÇÃO — RESOLVE POR NOME CONTRA O ACERVO INTEIRO (TagModel.getAllRecipesFlat), NUNCA contra
  // RECIPES[catId]: 5 dos 20 apontam pra receita que mora FORA da categoria do próprio país —
  // brasil->brasileiros, franca->padaria, italia->massas, espanha->frutos-do-mar,
  // hungria->carnes-bovinas. Quem buscar dentro da categoria do país deixa esses 5 com tile sem
  // foto e SEM UM ERRO NO CONSOLE, que é a classe de falha cara deste projeto (mesma lição do
  // slugFoto/gerar-imagens.js). scripts/verify-categoria-tiles-2026-07-26.js §7 falha se
  // qualquer um dos 20 não resolver, resolver ambíguo ou não tiver .webp em disco.
  function countrySignatureRecipe(collectionId) {
    const country = window.COUNTRIES[collectionId];
    if (!country || !country.signatureRecipe) return null;
    const item = TagModel.getAllRecipesFlat().find((i) => i.recipe.name === country.signatureRecipe);
    return item ? item.recipe : null;
  }

  // Card compartilhado por TODOS os hubs (Fundamentos/Proteínas/Países/Tempo/
  // Dificuldade) via renderGrupo — sem split "X de foco · Y no total" (resíduo do antigo
  // sistema de Foco/Também leva, redundante com o dropdown "Papel da proteína" já disponível
  // um clique depois, dentro da própria categoria) e sem "X/Y feitas" (Bloco 2, item 1+5).
  // Regra-mãe (item 6 do roadmap-mestre): texto nunca senta em imagem — a foto cobre
  // .category-card__media (object-fit: cover) e o nome/contagem ficam numa faixa sólida
  // (.category-card__band) por baixo, nunca sobre o pixel da foto. Emoji de ícone morreu (era
  // collection.icon) — sem imagem mapeada, __media fica vazio (cor de fundo neutra via CSS, sem
  // ícone nenhum: "faixa + nome, sem buraco"). Tile de país (collectionType "country") ganha
  // .category-card--country: mídia 4:3 (proporção de FOTO DE PRATO, a mesma do tile grande da
  // Home — não os 3:2 de bandeira nem o 1:1 de categoria) com a foto da receita-assinatura
  // NÍTIDA, sem blur nem véu. Blur/véu eram muleta de bandeira (achado do dono na rodada 2:
  // bandeira nítida quebrava a identidade do tile); foto de prato é o conteúdo certo, não
  // precisa ser disfarçada. A faixa sólida com nome + contagem é idêntica à de categoria — a
  // regra-mãe (texto nunca senta em imagem) vale aqui igual.
  // A foto entra em runtime (loadRecipeImage, async) em vez de <img src> direto no innerHTML:
  // é a MESMA cascata foto própria -> Wikipedia -> placeholder das outras superfícies de
  // receita, então um país cuja receita-assinatura ainda não tem .webp cai no mesmo placeholder
  // conhecido em vez de num <img> quebrado.
  function renderCollectionCard(collection) {
    const { allRecipes } = TagModel.getRecipesByCollection(collection.id);
    const isCountry = collection.collectionType === "country";
    const imgSrc = collectionTileImageSrc(collection);
    const card = document.createElement("button");
    card.className = "category-card" + (isCountry ? " category-card--country" : "");
    card.innerHTML =
      '<span class="category-card__media">' +
      (imgSrc ? '<img class="category-card__img" src="' + imgSrc + '" alt="" loading="lazy">' : "") +
      "</span>" +
      '<span class="category-card__band">' +
      '<span class="category-card__title">' + collection.label + "</span>" +
      '<span class="category-card__count">' + allRecipes.length + " receitas</span>" +
      "</span>";
    if (isCountry) {
      const signature = countrySignatureRecipe(collection.id);
      if (signature) loadRecipeImage(signature, card.querySelector(".category-card__media"));
    }
    card.addEventListener("click", () => Router.toCategoria(collection.id));
    return card;
  }

  // Busca contextual: tiles reagem só ao texto (rótulo da coleção/sinônimos das tags que ela
  // filtra) — nunca busca receitas diretamente, ver matchesQuery/renderTiles. Guarda o texto
  // digitado na busca inline por grupo (chaveado por grupoId) numa variável de módulo simples —
  // mesmo padrão de minhasReceitasTab (sobrevive só entre re-renders desta tela, não persiste em
  // localStorage/URL). Sem isso, "Voltar" de uma receita aberta pela busca inline reconstrói a
  // página do grupo em branco: o fromHash sozinho garante que o Voltar PARE no grupo certo, mas
  // não repõe o texto nem os resultados, já que a busca inline nunca escreveu na URL (diferente
  // de Coleção/Busca, que guardam o filtro no hash).
  // ---------- Válvula de escape anti-decepção (S2, compartilhado hub/categoria) ----------
  // Puro (sem DOM próprio além do botão que retorna): dado (escopado, global), decide qual dos
  // 4 ramos aplica e monta o elemento correspondente — CTA "Pesquisar em todo o aplicativo?
  // (N)" quando escopado=0 e global>0, link discreto "Buscar no app inteiro" quando
  // escopado>0 e global>escopado, null nos outros 2 ramos (vazio honesto sem CTA; iguais, sem
  // rodapé). onTransfer: callback do clique — cada tela monta sua própria transferToBusca (o
  // texto/tags residuais viajam diferente por tela). Extraído pra impedir cópia divergente
  // entre renderGrupo e renderCategory — a REGRA dos 4 ramos mora só aqui; cada tela ainda
  // decide onde/como encaixar o elemento retornado no seu próprio container.
  function buildEscapeValveActionEl(scopedTotal, globalTotal, onTransfer) {
    if (scopedTotal === 0) {
      if (globalTotal === 0) return null;
      const cta = document.createElement("button");
      cta.type = "button";
      cta.className = "primary-cta";
      cta.textContent = "Pesquisar em todo o aplicativo? (" + globalTotal + " receita" + (globalTotal === 1 ? "" : "s") + ")";
      cta.addEventListener("click", onTransfer);
      return cta;
    }
    if (globalTotal > scopedTotal) {
      const link = document.createElement("button");
      link.type = "button";
      link.className = "text-link";
      link.innerHTML = "<span>Buscar no app inteiro</span>" + iconSvg("arrowUpRight", "text-link__icon");
      link.addEventListener("click", onTransfer);
      return link;
    }
    return null;
  }

  const grupoSearchQuery = {};

  // S1/S4 (filtros no hub, 2026-07-29): estado facetado do hub — MESMO mecanismo de persistência
  // que grupoSearchQuery já usa pro texto (variável de módulo, chaveada por grupoId, restaurada
  // no load — nunca hash: router.js fica fora do escopo desta tarefa, R2/S4 pedem "o mesmo
  // mecanismo que hoje restaura o texto", não um novo formato de URL). facetState real (tags +
  // modo do Ingrediente + Papel da proteína) vive nas variáveis locais de renderGrupo
  // (selectedFacetTags/ingredientMode/proteinRole, mesma tríade de renderCategory/renderBusca);
  // este objeto só guarda a FOTO pra sobreviver ao "Voltar" de uma receita, gravada via
  // persistFacetState() a cada mudança confirmada (chip commitado, chip removido, modal Aplicar).
  const grupoFacetState = {};

  function renderGrupo(grupoId) {
    const grupo = GRUPOS.find((g) => g.id === grupoId);
    if (!grupo) {
      renderHome();
      return;
    }
    activeCat = null;
    refreshActiveCounts = null;

    header.innerHTML = "";
    content.innerHTML = "";
    progressEl.textContent = "";

    const wrap = document.createElement("div");
    const bannerImg = GRUPO_BANNER_IMAGE[grupoId] || null;
    const hasBanner = !!bannerImg;
    wrap.className = "grupo-view" + (hasBanner ? " has-banner" : "");

    // Home é o único pai real: proteinas/cozinhas vêm de tile da Home, fundamentos vem do link
    // "Mais categorias" da Home, tempo/dificuldade não têm link nenhum hoje (só URL direta) —
    // nenhum grupo tem mais de 1 entry point, então não há ambiguidade aqui (ver relatório).
    wrap.appendChild(createBackFloat("Home", () => Router.toHome()));

    // Banner do hub (item 6 do roadmap-mestre): imagem borrada em faixa no topo, só nos 3 hubs
    // com banner (fundamentos/proteinas/cozinhas, todos os 3 com foto própria desde que o mural
    // de bandeiras morreu) — tempo/dificuldade ficam com o título simples de sempre, sem banner.
    // .grupo-sheet é a FOLHA que sobrepõe a base do banner (mesma gramática de .recipe-page
    // sobre .recipe-hero, CONTRATO-IMAGENS-REDESIGN.md §8.1): o título (serif) e a busca do hub
    // vivem SEMPRE na folha, nunca sobre o blur. Descrição textual do hub morreu (decisão antiga
    // do roadmap) — grupo.desc não existe mais.
    let sheetParent = wrap;
    if (hasBanner) {
      const banner = document.createElement("div");
      banner.className = "grupo-banner";
      banner.innerHTML = '<img class="grupo-banner__img" src="' + bannerImg + '" alt="" loading="lazy">';
      wrap.appendChild(banner);

      const sheet = document.createElement("div");
      sheet.className = "grupo-sheet";
      wrap.appendChild(sheet);
      sheetParent = sheet;
    }

    const titleEl = document.createElement("h2");
    titleEl.textContent = grupo.label;
    sheetParent.appendChild(titleEl);

    // fromHash: hash INTEIRO do grupo no momento deste render — mesmo padrão de Coleção/Busca/
    // Minhas Receitas (currentHashPath), pra "Voltar" de uma receita achada pela busca inline
    // parar aqui, e pro mapa de scroll por rota (scrollPositionsByHash) restaurar a posição.
    const fromHash = currentHashPath();

    const searchWrap = document.createElement("div");
    searchWrap.className = "home-search-wrap";
    const search = document.createElement("input");
    search.type = "text";
    search.className = "home-search";
    search.placeholder = "Buscar em " + grupo.label.toLowerCase() + "...";
    search.value = grupoSearchQuery[grupoId] || "";
    searchWrap.appendChild(search);
    attachSearchClear(search, searchWrap, () => search.dispatchEvent(new Event("input")));
    sheetParent.appendChild(searchWrap);

    // S1/S2 (filtros no hub): botão "Filtros" (componente genérico reaproveitado, ver
    // renderFacetModal) + linha de chips ativos (commitados, com ×) — mesma posição relativa
    // que a barra de busca de Coleção/Busca já usam (perto do input, antes da listagem).
    const facetBarEl = document.createElement("div");
    facetBarEl.className = "filter-trigger-wrap";
    sheetParent.appendChild(facetBarEl);

    const activeChipsWrap = document.createElement("div");
    activeChipsWrap.className = "tagsearch-chips";
    sheetParent.appendChild(activeChipsWrap);

    const categoriesLabel = document.createElement("div");
    categoriesLabel.className = "subgroup-title";
    sheetParent.appendChild(categoriesLabel);

    const grid = document.createElement("div");
    grid.className = "category-grid";
    sheetParent.appendChild(grid);

    // S3 (motor unificado do hub, filtros): chips de tag sugeridos pelo parser — mesmo visual de
    // sugestão já usado no preview da busca global (renderPopularTags/renderPreviewChips). Tocar
    // um chip aqui COMMITA no facetState local (ver commitChip) — nunca mais navega.
    const chipsWrap = document.createElement("div");
    chipsWrap.className = "tagsearch-suggestions";
    sheetParent.appendChild(chipsWrap);

    const recipeResultsEl = document.createElement("div");
    recipeResultsEl.className = "grupo-recipe-results";
    sheetParent.appendChild(recipeResultsEl);

    // hideFromGrupoGrid (Bloco 2): massas/sobremesas-classicas saem do grid de Fundamentos —
    // ficam só acessíveis via tile grande da home — sem afetar .group (busca escopada intacta).
    const collections = window.COLLECTIONS.filter((c) => c.group === grupo.collectionGroup && !c.hideFromGrupoGrid);

    // Receitas cuja CATEGORIA (catId) pertence a este grupo — não um filtro por tag/coleção
    // (isso deixava vazar receita de fora: ex. um bolo de chocolate com ovo na massa tem
    // ingredient:ovo e "vazava" pra dentro da coleção Ovos via relatedFilterTags, mesmo sendo
    // uma receita de Sobremesas). Categoria é a fonte de verdade de escopo aqui.
    const catIdToGroup = getCatIdToGroup();
    const groupRecipes = TagModel.getAllRecipesFlat().filter((item) => catIdToGroup[item.catId] === grupo.collectionGroup);
    // S6.1 (correção de spec pós-auditoria 2026-07-29): escopo da BARRA passa a ser tudo que o
    // hub ALCANÇA — união, deduplicada por id, de (a) receitas por categoria acima e (b) receitas
    // que cada tile de coleção deste grupo abriria de verdade. (b) reusa
    // TagModel.getRecipesByCollection — a MESMA função que renderCategory chama no clique real do
    // tile — nunca uma cópia, pra escopo da barra e tile nunca divergirem por construção. Sem
    // isso, "frutos" no hub Proteínas achava só 8 das 30 receitas de protein:frutos-do-mar (23
    // arquivadas em categoria de País), mas o tile "Frutos do Mar" abre as 30 (+13 relacionadas
    // via contains:frutos-do-mar) na MESMA tela — inconsistência entre tocar o tile e digitar na
    // barra. `collections` (acima) já são as coleções deste grupo COM tile nesta tela —
    // hideFromGrupoGrid fica de fora por não ter tile aqui pra abrir (escolha de implementação,
    // não muda o tamanho do escopo em nenhum dos 5 hubs, testado). Calculado 1x por render do
    // grupo, nunca por tecla — mesmo padrão de groupRecipes.
    const groupScopeIds = new Set(groupRecipes.map((item) => item.id));
    collections.forEach((c) => {
      TagModel.getRecipesByCollection(c.id).allRecipes.forEach((item) => groupScopeIds.add(item.id));
    });
    const groupRecipeIds = Array.from(groupScopeIds);

    // S1/S5 (filtros no hub): universo de ITENS (não só ids) pro modal de facetas e pro
    // baseTagIds do motor — resolvido a partir do MESMO groupRecipeIds acima (nunca uma segunda
    // fonte de escopo: groupUniverse.length === groupRecipeIds.length sempre, por construção),
    // então nunca diverge do escopo já auditado pela seção 10 da suíte (guarda anti-réplica).
    const groupItemById = {};
    groupRecipes.forEach((item) => {
      groupItemById[item.id] = item;
    });
    collections.forEach((c) => {
      TagModel.getRecipesByCollection(c.id).allRecipes.forEach((item) => {
        groupItemById[item.id] = item;
      });
    });
    const groupUniverse = groupRecipeIds.map((id) => groupItemById[id]);

    // Facetas do hub (S1): um estado só, duas portas de entrada (chip digitado commitado E
    // faceta escolhida no modal alimentam o MESMO selectedFacetTags) — mesma tríade de variáveis
    // de renderCategory/renderBusca (selectedFacetTags/ingredientMode/proteinRole), restaurada
    // pelo MESMO mecanismo que já restaura o texto (grupoFacetState, módulo, chaveado por
    // grupoId — ver comentário ao lado de grupoSearchQuery). Papel da proteína: SEM coleção
    // própria aqui (hub não é 1 Collection só) — collection: null em todo lugar abaixo, mesmo
    // caminho genérico que renderBusca já prova funcionar sem fork (activeProteinTagIds/
    // splitByProteinRole INTOCADOS, só mais um consumidor).
    const savedFacetState = grupoFacetState[grupoId] || null;
    let selectedFacetTags = (savedFacetState && savedFacetState.tags) || [];
    let ingredientMode = (savedFacetState && savedFacetState.ingredientMode) || "or";
    let proteinRole = validProteinRole(savedFacetState && savedFacetState.proteinRole, readFacetStateFromTags(selectedFacetTags, GENERIC_FACET_DEFS), null);
    function persistFacetState() {
      grupoFacetState[grupoId] = { tags: selectedFacetTags.slice(), ingredientMode: ingredientMode, proteinRole: proteinRole };
    }

    // S4 (motor unificado, normalização única): DerivationDict.norm em vez de normText próprio
    // (removido) — mesma normalização usada pelo motor global inteiro (data/derivation-dict.js:14).
    function matchesQuery(collection, q) {
      if (!q) return true;
      const nq = window.DerivationDict.norm(q);
      if (window.DerivationDict.norm(collection.label).indexOf(nq) !== -1) return true;
      return (collection.primaryFilterTags || []).some((tagId) => {
        const tag = TagModel.getTagById(tagId);
        if (!tag) return false;
        if (window.DerivationDict.norm(tag.label).indexOf(nq) !== -1) return true;
        return (tag.synonyms || []).some((syn) => window.DerivationDict.norm(syn).indexOf(nq) !== -1);
      });
    }

    // S3: tiles reagem SÓ ao texto do input (rótulo) — nunca ao facetState, mesmo comportamento
    // de sempre, intocado por esta rodada.
    function renderTiles(query) {
      grid.innerHTML = "";
      const filtered = collections.filter((c) => matchesQuery(c, query));
      categoriesLabel.textContent = filtered.length ? "Categorias" : "";
      filtered.forEach((collection) => grid.appendChild(renderCollectionCard(collection)));
      return filtered.length;
    }

    // Universo pro modal de facetas (S1/S5): SEMPRE groupUniverse (nunca a base inteira) —
    // restrito pelas tags já commitadas (facetState), mesma regra AND-entre-facetas/OR-dentro-da-
    // faceta de TagModel.matchesGroupedTags que qualquer outra tela usa, nunca reimplementada.
    function facetUniverse(tagIds, mode) {
      return tagIds.length ? groupUniverse.filter((item) => TagModel.matchesGroupedTags(item.tags, tagIds, mode)) : groupUniverse;
    }

    // S2: monta o MESMO componente genérico (renderFacetModal) que Coleção/Busca já usam sobre
    // este hub — universo = escopo-união do grupo (groupUniverse), collection: null (like
    // renderBusca). Nenhuma linha de renderFacetModal/openModal tocada.
    function renderFacets() {
      const facetState = readFacetStateFromTags(selectedFacetTags, GENERIC_FACET_DEFS);
      renderFacetModal(facetBarEl, GENERIC_FACET_DEFS, {
        facetState: facetState,
        collection: null,
        getUniverse: (role, draftFacetState) => {
          if (role === "focus" || role === "secondary") {
            const S = activeProteinTagIds(draftFacetState, null);
            const split = TagModel.splitByProteinRole(groupUniverse, S);
            return role === "focus" ? split.primary : split.secondary;
          }
          return groupUniverse;
        },
        proteinRole: {
          value: proteinRole,
          setValue: (v) => {
            proteinRole = v;
          },
          computeCounts: (draftFacetState, draftIngredientMode) => {
            const S = activeProteinTagIds(draftFacetState, null);
            if (!S.length) return { focus: 0, secondary: 0 };
            const matchesGeneric = (item) => TagModel.matchesGroupedTags(item.tags, facetStateToTagIds(draftFacetState, GENERIC_FACET_DEFS), draftIngredientMode);
            const split = TagModel.splitByProteinRole(groupUniverse.filter(matchesGeneric), S);
            return { focus: split.primary.length, secondary: split.secondary.length };
          },
        },
        ingredientMode: {
          value: ingredientMode,
          setValue: (v) => {
            ingredientMode = v;
          },
        },
        countForDraft: (draftFacetState, draftRole, draftIngredientMode) => {
          const draftTags = facetStateToTagIds(draftFacetState, GENERIC_FACET_DEFS);
          const universe = facetUniverse(draftTags, draftIngredientMode);
          if (draftRole === "focus" || draftRole === "secondary") {
            const S = activeProteinTagIds(draftFacetState, null);
            const split = TagModel.splitByProteinRole(universe, S);
            return draftRole === "focus" ? split.primary.length : split.secondary.length;
          }
          return universe.length;
        },
        onApply: () => {
          selectedFacetTags = facetStateToTagIds(facetState, GENERIC_FACET_DEFS);
          persistFacetState();
          renderActiveChips();
          renderFacets();
          // Reaproveita o listener de input já existente (mesmo truque de attachSearchClear
          // acima) em vez de chamar runSearch direto — 1 único ponto de integração pro motor.
          search.dispatchEvent(new Event("input"));
        },
      });
    }

    // S3: linha de chips ATIVOS (commitados) com × — remover o último volta ao só-texto (o
    // próprio esvaziamento de selectedFacetTags já faz isso, nenhum caso especial). Mesmo padrão
    // visual de renderBusca (tag-chip/tag-chip--selected), reaproveitado sem CSS novo.
    function renderActiveChips() {
      if (!selectedFacetTags.length) {
        activeChipsWrap.innerHTML = "";
        return;
      }
      activeChipsWrap.innerHTML = selectedFacetTags
        .map((id) => {
          const tag = TagModel.getTagById(id);
          return (
            '<button type="button" class="tag-chip tag-chip--selected" data-tag="' +
            id +
            '">' +
            (tag ? tag.label : id) +
            ' <span aria-hidden="true">×</span></button>'
          );
        })
        .join("");
      activeChipsWrap.querySelectorAll(".tag-chip").forEach((btn) => {
        btn.addEventListener("click", () => {
          selectedFacetTags = selectedFacetTags.filter((t) => t !== btn.dataset.tag);
          // Dívida #2: papel nunca sobrevive sem proteína ativa — mesma regra do init, agora
          // em todo caminho de mutação.
          proteinRole = validProteinRole(proteinRole, readFacetStateFromTags(selectedFacetTags, GENERIC_FACET_DEFS), null);
          persistFacetState();
          renderActiveChips();
          renderFacets();
          search.dispatchEvent(new Event("input"));
        });
      });
    }

    // S3: chip sugerido pelo parser — tocar COMMITA a tag no facetState local (nunca mais
    // Router.toBusca, comportamento antigo morre aqui) e remove do texto digitado só as palavras
    // que geraram esse chip (seg.tokens, mesmo campo que renderBusca já usa pra isso) — o resto
    // do texto permanece, e as sugestões são recomputadas em cima do residual (runSearch de
    // novo), mesmo padrão de renderBusca/commitParsed.
    function commitChip(tagId, parsed) {
      const seg = parsed.segments.find(
        (s) => (s.classification === "auto" && s.autoTagId === tagId) || (s.classification === "optional" && s.chipTagIds.indexOf(tagId) !== -1)
      );
      const removeTokens = seg ? seg.tokens : [];
      if (selectedFacetTags.indexOf(tagId) === -1) selectedFacetTags = selectedFacetTags.concat([tagId]);
      const remaining = search.value
        .trim()
        .split(/\s+/)
        .filter((w) => w && removeTokens.indexOf(w) === -1);
      search.value = remaining.join(" ");
      persistFacetState();
      renderActiveChips();
      renderFacets();
      // Reaproveita o listener de input já existente (grava grupoSearchQuery + roda runSearch
      // debounced) — mesmo padrão de attachSearchClear, nenhum 2º ponto de integração com o motor.
      search.dispatchEvent(new Event("input"));
    }

    function renderChips(parsed) {
      chipsWrap.innerHTML = "";
      const chipIds = [];
      parsed.segments.forEach((seg) => {
        if (seg.classification === "auto" && chipIds.indexOf(seg.autoTagId) === -1) chipIds.push(seg.autoTagId);
        if (seg.classification === "optional") {
          seg.chipTagIds.forEach((id) => {
            if (chipIds.indexOf(id) === -1) chipIds.push(id);
          });
        }
      });
      if (!chipIds.length) return 0;
      const html = chipIds
        .map((id) => {
          const tag = TagModel.getTagById(id);
          return tag ? '<button type="button" class="tag-suggestion" data-tag="' + id + '">' + tag.label + "</button>" : "";
        })
        .join("");
      chipsWrap.innerHTML = '<div class="tagsearch-taglist">' + html + "</div>";
      chipsWrap.querySelectorAll("[data-tag]").forEach((btn) => {
        btn.addEventListener("click", () => commitChip(btn.dataset.tag, parsed));
      });
      return chipIds.length;
    }

    function renderBlocks(out) {
      recipeResultsEl.innerHTML = "";
      let total = 0;
      function section(title, items) {
        if (!items.length) return;
        total += items.length;
        const label = document.createElement("div");
        label.className = "subgroup-title";
        label.textContent = title + " em " + grupo.label + " (" + items.length + ")";
        recipeResultsEl.appendChild(label);
        items.forEach((r) => {
          recipeResultsEl.appendChild(renderRecipeCard(r.item, { fromHash: fromHash }));
        });
      }
      section("Com esses filtros", out.block1);
      section("Mais resultados por texto", out.block2);
      return total;
    }

    // S6 (válvula de escape anti-decepção, R3): transfere texto residual + tags commitadas pra
    // busca global — MESMO Router.toBusca/tags=/text= de sempre (nenhuma extensão de hash
    // precisou ser feita: text= já existia). Papel da proteína NÃO transfere (role omitido) —
    // é um recorte de exibição do próprio hub, não faz sentido fora dele; as tags protein:* em
    // si (explícitas na faceta Proteína) transferem normalmente, junto de qualquer outra tag.
    function transferToBusca(query, baseTagIds) {
      const parsed = Search.parseQuery(query, baseTagIds);
      const transferTags = baseTagIds.concat(parsed.autoTagIds);
      Router.toBusca(transferTags, parsed.residualTokens || [], ingredientMode, null);
    }

    // S6: 4 ramos, calculados a cada tick a partir do MESMO texto+tags, só variando o escopo
    // (scopeIds omitido = global) — nenhum caminho de matching novo, só mais 1 chamada de
    // searchByQuery por tick (medido: ver relatório da tarefa).
    function renderEscapeValve(query, baseTagIds, scopedTotal, globalTotal) {
      const label = query ? ' para "' + query + '"' : " com esses filtros";
      if (scopedTotal === 0) {
        recipeResultsEl.innerHTML = '<div class="empty-state">Nenhuma receita encontrada em ' + grupo.label + label + ".</div>";
      }
      // S2: regra dos 4 ramos compartilhada com renderCategory (buildEscapeValveActionEl) —
      // nenhuma cópia divergente da decisão, só o container/empty-state ficam locais ao hub.
      const actionEl = buildEscapeValveActionEl(scopedTotal, globalTotal, () => transferToBusca(query, baseTagIds));
      if (actionEl) recipeResultsEl.appendChild(actionEl);
    }

    // S1/S6: motor único (Search.parseQuery/searchByQuery, baseTagIds = facetState) — texto
    // residual E facetas commitadas alimentam a MESMA chamada (mecanismo do bloco 1, já
    // existente). Roda mesmo com texto vazio, desde que haja faceta ativa (R2: hub ganha filtro
    // como categoria já tem, inclusive sem digitar nada).
    function runSearch(query) {
      const tilesCount = renderTiles(query);
      const facetState = readFacetStateFromTags(selectedFacetTags, GENERIC_FACET_DEFS);
      const baseTagIds = facetStateToTagIds(facetState, GENERIC_FACET_DEFS);
      chipsWrap.innerHTML = "";
      recipeResultsEl.innerHTML = "";
      let chipsCount = 0;
      if (!query && !baseTagIds.length) {
        return;
      }
      const parsed = Search.parseQuery(query, baseTagIds);
      if (query) chipsCount = renderChips(parsed);
      let out;
      let globalOut;
      if (query) {
        out = Search.searchByQuery(query, { parsed: parsed, baseTagIds: baseTagIds, ingredientMode: ingredientMode, scopeIds: groupRecipeIds });
        // S6: +1 chamada de motor por tick, MESMO texto+tags, escopo null (global) — ver
        // relatório pro custo medido.
        globalOut = Search.searchByQuery(query, { parsed: parsed, baseTagIds: baseTagIds, ingredientMode: ingredientMode });
      } else {
        // Sem texto, só facetas (R2: hub ganha filtro como categoria já tem, mesmo sem digitar
        // nada) — os blocos 1/2 do motor existem só pra pontuar resíduo TEXTUAL (fieldScore),
        // que não existe aqui; MESMO primitivo de match (TagModel.matchesGroupedTags — o que
        // block1/2/computeFacetOptions/applyFacets já usam em qualquer tela), sem o wrapper de
        // pontuação textual que não tem o que fazer sem texto nenhum.
        out = { block1: facetUniverse(baseTagIds, ingredientMode).map((item) => ({ item: item })), block2: [] };
        globalOut = {
          block1: TagModel.getAllRecipesFlat()
            .filter((item) => TagModel.matchesGroupedTags(item.tags, baseTagIds, ingredientMode))
            .map((item) => ({ item: item })),
          block2: [],
        };
      }
      // Dívida #2 (S3, Bug A): hub prometia papel no modal/contagem mas nunca recortava os
      // resultados — único ponto que faltava aplicar o mesmo mecanismo que renderCategory/
      // renderBusca já usam (TagModel.splitByProteinRole). globalOut/globalTotal ficam SEM
      // papel (transferência pra busca global já vai com role=null, pino busca-unificada).
      if (proteinRole === "focus" || proteinRole === "secondary") {
        const S = activeProteinTagIds(facetState, null);
        const sliceByRole = (entries) => {
          const split = TagModel.splitByProteinRole(entries.map((e) => e.item), S);
          const keep = new Set((proteinRole === "focus" ? split.primary : split.secondary).map((i) => i.id));
          return entries.filter((e) => keep.has(e.item.id));
        };
        out.block1 = sliceByRole(out.block1);
        out.block2 = sliceByRole(out.block2);
      }
      const scopedTotal = out.block1.length + out.block2.length;
      renderBlocks(out);
      const globalTotal = globalOut.block1.length + globalOut.block2.length;
      renderEscapeValve(query, baseTagIds, scopedTotal, globalTotal);
      if (tilesCount === 0 && chipsCount === 0 && scopedTotal === 0 && globalTotal === 0) {
        recipeResultsEl.innerHTML =
          '<div class="empty-state">Nenhuma receita encontrada em ' + grupo.label + (query ? ' para "' + query + '"' : " com esses filtros") + ".<br>Tente outro termo.</div>";
      }
    }

    let searchDebounce = null;
    search.addEventListener("input", () => {
      const q = search.value.trim();
      grupoSearchQuery[grupoId] = q;
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => runSearch(q), 220);
    });
    // Restaura a busca ao voltar de uma receita (mesmo texto de grupoSearchQuery usado acima pra
    // preencher o input) — carga inicial roda sem debounce (nada foi digitado agora).
    renderActiveChips();
    renderFacets();
    runSearch(search.value);

    content.appendChild(wrap);
  }

  // ---------- Home ----------
  // Tiles grandes da home (Bloco 2, Fase 2.2) — cada um leva direto pra sua categoria/hub já
  // existente. Busca livre e atalhos de favoritos/histórico saem daqui e migram pra
  // dentro de "Minhas Receitas" num bloco futuro (conteúdo ainda não implementado).
  // img: item 6 do roadmap-mestre — substitui o ícone outline (bowl/flame/globe/cupcake) por
  // foto de categoria/hub (mesmo acervo de renderCollectionCard); 2 apontam pra categoria
  // (massas/sobremesas-classicas), 2 pro banner do próprio hub (proteinas/cozinhas).
  // cozinhas usa paises.webp — MESMO asset do banner do hub Países (GRUPO_BANNER_IMAGE acima),
  // como proteinas já fazia com o seu; as 4 entradas voltam a ser homogêneas (todas com img,
  // nenhum caminho especial). label "Navegar por Países" -> "Países" (rodada 3): o label longo
  // quebrava em 2 linhas e deixava esse tile mais alto que os outros 3 na mesma fileira do grid
  // — "Países" cabe em 1 linha, igual aos outros, e já é o mesmo label usado no título do
  // próprio hub (GRUPOS acima).
  const HOME_MAIN_TILES = [
    { id: "massas", label: "Massas", img: "imagens/categorias/massas.webp", go: () => Router.toCategoria("massas") },
    { id: "proteinas", label: "Proteínas", img: "imagens/categorias/hub-proteinas.webp", go: () => Router.toGrupo("proteinas") },
    { id: "cozinhas", label: "Países", img: "imagens/categorias/paises.webp", go: () => Router.toGrupo("cozinhas") },
    { id: "sobremesas", label: "Sobremesas", img: "imagens/categorias/sobremesas-classicas.webp", go: () => Router.toCategoria("sobremesas-classicas") },
  ];

  // Carrossel "Vistas recentemente" (item 4 do roadmap-mestre, CHECKLIST-GERAL.md — dado já
  // rastreado por Storage.recordRecipeView/getRecentlyViewed desde antes desta tarefa, só
  // faltava a UI). Só lê o que storage.js já resolve (mais recente primeiro, deduplicado, cap
  // 10) e resolve cada recipeId pelo MESMO TagModel.findRecipeById que renderReceita usa — sem
  // reimplementar ordem/dedup/cap aqui. Devolve null (nenhum elemento, nem título nem trilho)
  // quando não há histórico, pra renderHome simplesmente não anexar nada — ver critério "seção
  // ausente com histórico vazio" no relatório da tarefa.
  function buildRecentlyViewedSection() {
    const recentItems = Storage.getRecentlyViewed()
      .map((entry) => {
        const item = TagModel.findRecipeById(entry.recipeId);
        return item ? { id: item.id, recipe: item.recipe } : null;
      })
      .filter(Boolean);
    if (!recentItems.length) return null;

    const section = document.createElement("div");
    section.className = "recent-views";

    const title = document.createElement("h2");
    title.className = "recent-views__title";
    title.textContent = "Vistas recentemente";
    section.appendChild(title);

    const rail = document.createElement("div");
    rail.className = "recent-views__rail";
    recentItems.forEach((item) => {
      const card = document.createElement("div");
      card.className = "recent-card";
      card.setAttribute("aria-label", "Ver receita de " + item.recipe.name);
      makeKeyboardClickable(card);
      card.addEventListener("click", () => {
        // "home" é fromHash literal e PÚBLICO (contrato documentado em
        // product-navigation-ux/SKILL.md), nunca currentHashPath() — na Home, currentHashPath()
        // devolve "" (falsy), o que faria Router.toReceita NEM anexar "?from=" e o back-float
        // cair na categoria da receita em vez de voltar pra Home.
        Router.toReceita(item.id, "home");
      });

      const thumb = document.createElement("div");
      thumb.className = "recent-card__thumb placeholder";
      thumb.innerHTML = iconSvg("photoOff", "photo-placeholder__icon");
      if (item.recipe.image) {
        applyImage(thumb, item.recipe.image);
      } else {
        loadRecipeImage(item.recipe, thumb);
      }

      const name = document.createElement("div");
      name.className = "recent-card__name";
      name.textContent = item.recipe.name;

      card.appendChild(thumb);
      card.appendChild(name);
      rail.appendChild(card);
    });
    section.appendChild(rail);

    return section;
  }

  function renderHome() {
    activeCat = null;
    refreshActiveCounts = null;

    header.innerHTML = "";
    content.innerHTML = "";
    progressEl.textContent = "";

    const wrap = document.createElement("div");
    wrap.className = "home-view";

    const moreCategorias = document.createElement("button");
    moreCategorias.type = "button";
    moreCategorias.className = "home-more-categories";
    moreCategorias.innerHTML = iconSvg("dots", "home-more-categories__icon") + "<span>Mais categorias</span>";
    moreCategorias.addEventListener("click", () => Router.toGrupo("fundamentos"));

    const tilesGrid = document.createElement("div");
    tilesGrid.className = "home-tiles";
    HOME_MAIN_TILES.forEach((tile) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "home-tile";
      card.innerHTML =
        '<span class="home-tile__media">' +
        '<img class="home-tile__img" src="' + tile.img + '" alt="" loading="lazy">' +
        "</span>" +
        '<span class="home-tile__band"><span class="home-tile__label">' + tile.label + "</span></span>";
      card.addEventListener("click", tile.go);
      tilesGrid.appendChild(card);
    });
    // Ordem invertida: tiles primeiro, "Mais categorias" depois (era o contrário) — só
    // reordenação de appendChild, nenhum comportamento muda.
    wrap.appendChild(tilesGrid);
    wrap.appendChild(moreCategorias);

    // Carrossel de recentes DEPOIS do bloco de categorias (julgamento visual do dono,
    // 2026-07-26 — subiu antes disso, mudou pra cá na mesma tarefa). Ordem final da home:
    // tiles -> Mais categorias -> Vistas recentemente.
    const recentSection = buildRecentlyViewedSection();
    if (recentSection) wrap.appendChild(recentSection);

    content.appendChild(wrap);
  }

  // ---------- Facetas — compartilhadas por renderCategory e renderBusca ----------
  // Cada seção lista só os valores presentes no universo ATUAL já filtrado pelas OUTRAS
  // facetas ativas (não pela própria, senão nunca mostraria alternativa à opção já escolhida),
  // com contagem. Nada vem pré-selecionado (default = Todos/Ver tudo).
  // País/Complexidade/Tempo/Equipamento são multi-seleção com combineMode "or" — valores da
  // MESMA faceta se somam (união); entre facetas diferentes continua AND (matchesGroupedTags
  // já faz isso sozinho pra qualquer prefixo que não seja ingredient:/seasoning:, sem precisar
  // de nenhuma lógica nova aqui). Ingrediente é multi-seleção com combineMode "toggle" — o
  // usuário escolhe "Qualquer um destes" (or, default) ou "Todos estes" (and) direto num
  // segmented control dentro da própria seção, só visível com 2+ selecionados (ver
  // renderIngredientTileSectionBody/ingredientMode). def.combineMode aqui é só rótulo — a
  // combinação real vem do estado ingredientMode (opts.ingredientMode em renderFacetModal),
  // não deste campo.
  // layout: "tiles" (Equipamento) — a ÚNICA faceta que ainda usa grade de ícone+label+contagem;
  // reservado pra facetas com ícone de verdade (SVG real) plugado via tileIcon. País usa
  // "photo-tiles" (foto cobrindo o bloco + faixa, ver mais abaixo). Ingrediente usa
  // "ingredient-tiles" (grade densa própria + chips removíveis, ver renderIngredientTileSectionBody).
  // Toda faceta multi/combineMode "or" SEM layout plugado (Complexidade/Tempo/Tipo de
  // prato/Proteína/Refeição) cai no renderChipSectionBody genérico — grade de CHIPS (pill,
  // wrap), substituindo tanto a antiga lista de checkbox quanto o antigo tile-sem-ícone (Fase
  // F1a, 2026-07-27: investigação achou que Proteína/Refeição já viviam num "tile" só de nome —
  // tileIcon sempre devolvia "", sem imagem/ícone de verdade — então não eram classe 1 (tile
  // funcionando) de fato; harmonizados pra chip junto de Complexidade/Tempo/Tipo de prato, que
  // já eram classe 2 real, lista de checkbox nativa). tileIcon: função tagId -> HTML do ícone,
  // só plugada onde o ícone existe de verdade (Equipamento).
  const GENERIC_FACET_DEFS = [
    { key: "country", label: "País", prefix: "country:", multi: true, combineMode: "or", layout: "photo-tiles" },
    { key: "difficulty", label: "Complexidade", prefix: "difficulty:", multi: true, combineMode: "or" },
    { key: "time", label: "Tempo", prefix: "time:", multi: true, combineMode: "or" },
    { key: "equipment", label: "Equipamento", prefix: "equipment:", multi: true, combineMode: "or", layout: "tiles", tileIcon: equipmentTileIconHtml },
    // "Proteína" (protein:) — NÃO confundir com "Papel da proteína" (renderProteinRoleSection,
    // seleção única Principal/Secundário/Ver tudo, só em coleções de proteína). Esta é NOVA:
    // pergunta QUAL proteína (Frango, Boi, Peixe...), disponível em QUALQUER coleção/busca, OR
    // puro entre valores — mesma família de País/Equipamento. 10 valores na taxonomia (tags.js),
    // 7-8 com cobertura de imagem em imagens/categorias/ (frango não tem imagem própria — só
    // aves.webp, já reivindicado por protein:ave; leguminosa/laticinio sem nenhuma candidata) —
    // abaixo do limiar pra virar photo-tile como País; chip de texto nesta rodada (Fase F1a),
    // photo-tile fica pro mini-lote de imagem futuro (ver relatório da tarefa).
    { key: "protein", label: "Proteína", prefix: "protein:", multi: true, combineMode: "or" },
    // Fase B: "Refeição" (course:, 5 valores) e "Tipo de prato" (dish_type:, 12 valores) —
    // mesma família (OR puro, sem fallback, sem ícone). "Restrições" (diet:) NÃO entra:
    // cobertura de 24,9% (99/398) e um único valor (diet:vegetariana) — abaixo do limiar
    // combinado com o usuário, fica pro backlog de expansão de dados.
    { key: "course", label: "Refeição", prefix: "course:", multi: true, combineMode: "or" },
    { key: "dishType", label: "Tipo de prato", prefix: "dish_type:", multi: true, combineMode: "or" },
    // layout: "ingredient-tiles" — piloto próprio (não reaproveita renderTileSectionBody): grade
    // MAIS DENSA que País/Equipamento (mais colunas, tiles menores) pra caber ~30-40 valores em
    // 360-430px, e SÓ substitui o <select> de "+ adicionar" — os chips removíveis dos já
    // selecionados continuam exatamente iguais. combineMode "toggle" (segmented control
    // Qualquer um/Todos estes) continua sendo a única lógica diferente de todas as outras
    // facetas.
    { key: "ingredient", label: "Ingrediente", prefix: "ingredient:", multi: true, combineMode: "toggle", layout: "ingredient-tiles" },
  ];

  // Tile de País (item 6 do roadmap-mestre) — bandeira imagens/bandeiras/<iso2>.webp cobrindo o
  // bloco + faixa sólida com o nome por baixo (mesma regra-mãe do tile de categoria: texto nunca
  // senta em imagem). countryTileIconHtml e o emoji de bandeira morreram — window.COUNTRIES
  // (js/countries.js) continua a fonte única do iso2, só o consumo mudou de emoji pra arquivo.
  // Layout próprio ("photo-tiles"), não reaproveita renderTileSectionBody: a estrutura muda de
  // verdade (mídia+faixa, não ícone empilhado com label/contagem). Implementação vive dentro de
  // openModal() — ver renderTileSectionBody logo abaixo — porque precisa de draftFacetState/
  // renderBody, que só existem naquele escopo (achado ao vivo: ReferenceError na 1ª rodada por
  // ter ficado aqui fora, escopo de módulo).

  // Ícones reais pro piloto de tiles de Equipamento — substituem os emoji provisórios. Arquivos
  // originais ficam em icons/equipment/ (fonte/atribuição), mas o SVG é EMBUTIDO aqui como
  // string, não carregado via fetch() — um fetch é assíncrono, e um usuário abrindo o app e
  // indo direto no filtro (ou qualquer reload+abertura imediata) podia abrir o modal ANTES do
  // fetch terminar, renderizando o tile sem ícone até uma re-renderização tardia (bug real,
  // confirmado por screenshot: só os 3 PNG apareciam, os 4 SVG ficavam em branco). Embutir a
  // string elimina a corrida por completo — mesmo padrão dos outros ícones outline do app
  // (ICONS/ICON_SVG_ATTRS no topo do arquivo), sempre disponível de graça, sem round-trip.
  // fill="#000000" já foi trocado por fill="currentColor" nesses textos (e nos arquivos-fonte)
  // pra recolorir via CSS conforme o estado do tile. Os 3 últimos (air-fryer, panela-de-
  // pressao, churrasqueira) eram PNG (Icons8, filter:invert(1) como aproximação — não
  // recoloriam no estado selecionado) e viraram SVG real autoral nesta rodada: agora os 9
  // valores de Equipamento recolorem igual (--color-text-disabled parado, --color-accent
  // selecionado), sem exceção.
  const EQUIPMENT_SVG_MARKUP = {
    "equipment:forno":
      '<svg fill="currentColor" height="800px" width="800px" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 508 508" xml:space="preserve"><g><g><path d="M493.9,13.3h-49.5C444,5.9,437.9,0,430.4,0H292.6c-7.5,0-13.6,5.9-14,13.3h-49.1C229.1,5.9,223,0,215.4,0H77.7 c-7.5,0-13.6,5.9-14,13.3H14.1C6.3,13.3,0,19.7,0,27.5v466.4c0,7.8,6.3,14.1,14.1,14.1h479.8c7.8,0,14.1-6.3,14.1-14.1V27.5 C508,19.7,501.7,13.3,493.9,13.3z M28.2,41.6h451.6v90.3H28.2V41.6z M479.8,479.8H28.2V160.1h451.6V479.8z"/></g></g><g><g><path d="M427.8,196.6H80.2c-7.8,0-14.1,6.3-14.1,14.1V439c0,7.8,6.3,14.1,14.1,14.1h347.5c7.8,0,14.1-6.3,14.1-14.1V210.7 C441.9,203,435.6,196.6,427.8,196.6z M94.3,424.9v-200h319.3v200H94.3z"/></g></g><g><g><path d="M107.5,72.8H96.6c-7.8,0-14.1,6.3-14.1,14.1c0,7.8,6.4,14.1,14.1,14.1h10.9c7.8,0,14.1-6.3,14.1-14.1 C121.6,79.1,115.3,72.8,107.5,72.8z"/></g></g><g><g><path d="M208.8,72.8h-10.9c-7.8,0-14.1,6.3-14.1,14.1c0,7.8,6.3,14.1,14.1,14.1h10.9c7.8,0,14.1-6.3,14.1-14.1 C222.9,79.1,216.6,72.8,208.8,72.8z"/></g></g><g><g><path d="M310.1,72.8h-10.9c-7.8,0-14.1,6.3-14.1,14.1c0,7.8,6.3,14.1,14.1,14.1h10.9c7.8,0,14.1-6.3,14.1-14.1 C324.2,79.1,317.9,72.8,310.1,72.8z"/></g></g><g><g><path d="M411.3,72.8h-10.9c-7.8,0-14.1,6.3-14.1,14.1c0,7.8,6.3,14.1,14.1,14.1h10.9c7.8,0,14.1-6.3,14.1-14.1 C425.4,79.1,419.1,72.8,411.3,72.8z"/></g></g><g><g><path d="M295.1,246.6h-82.2c-7.8,0-14.1,6.3-14.1,14.1c0,7.8,6.3,14.1,14.1,14.1h82.2c7.8,0,14.1-6.3,14.1-14.1 C309.2,252.9,302.9,246.6,295.1,246.6z"/></g></g></svg>',
    "equipment:liquidificador":
      '<svg fill="currentColor" width="800px" height="800px" viewBox="-18.49 0 122.88 122.88" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="enable-background:new 0 0 85.89 122.88" xml:space="preserve"><g><path d="M10.36,23.42h53.68c0.07,0,0.15,0,0.24,0.01c0.68,0.06,1.31,0.36,1.78,0.82c0.5,0.49,0.82,1.16,0.82,1.91 c0,0.07,0,0.15-0.01,0.22l0,0.04L66.38,32h17.96c0.86,0,1.55,0.69,1.55,1.55c0,0.06,0,0.13-0.01,0.19 c-0.44,11-2.54,19.75-6.38,26.12c-3.82,6.35-9.31,10.35-16.55,11.9l-1.4,16.28c-0.06,0.73-0.38,1.4-0.86,1.88 c-0.04,0.04-0.08,0.08-0.13,0.11c-0.49,0.44-1.12,0.7-1.83,0.7H15.02c-0.77,0-1.45-0.31-1.96-0.82l0,0 c-0.49-0.49-0.8-1.16-0.86-1.9L7.54,26.37c-0.01-0.08-0.01-0.15-0.01-0.2c0-0.75,0.32-1.42,0.82-1.92c0.47-0.46,1.11-0.77,1.8-0.82 C10.24,23.43,10.31,23.42,10.36,23.42L10.36,23.42z M13.69,103l0.12-5.43c0.01-0.85,0.7-1.52,1.55-1.52v-0.01h44.09 c0.86,0,1.55,0.69,1.55,1.55v5.43l13.1,17.38c0.52,0.68,0.38,1.65-0.3,2.17c-0.28,0.21-0.61,0.31-0.93,0.31v0H1.55 c-0.86,0-1.55-0.69-1.55-1.55c0-0.41,0.16-0.79,0.43-1.07L13.69,103L13.69,103z M37.21,101.83c3.14,0,5.69,2.55,5.69,5.69 c0,3.14-2.55,5.69-5.69,5.69c-3.14,0-5.69-2.55-5.69-5.69C31.52,104.38,34.07,101.83,37.21,101.83L37.21,101.83z M16.88,99.14 l-0.11,4.42h0c0,0.32-0.11,0.64-0.32,0.92L4.69,119.78h65.06l-11.49-15.25c-0.23-0.27-0.36-0.62-0.36-1v-4.39H16.88L16.88,99.14z M6.72,11.4h26.99c-1.71-1.1-2.85-2.41-2.85-5.21c0-2.8,2.77-6.19,6.19-6.19c3.42,0,6.19,3.39,6.19,6.19c0,2.8-1.14,4.11-2.85,5.21 h27.3c0.47,0,0.86,0.39,0.86,0.86v6.08c0,0.47-0.39,0.86-0.86,0.86H6.72c-0.47,0-0.86-0.39-0.86-0.86v-6.08 C5.86,11.79,6.25,11.4,6.72,11.4L6.72,11.4z M66.12,36.09l-2.88,31.44c15.25-3.88,18.53-17.24,19.31-31.44H66.12L66.12,36.09z M31.81,65.77c-0.86,0-1.55-0.69-1.55-1.55c0-0.86,0.69-1.55,1.55-1.55h11.31c0.86,0,1.55,0.69,1.55,1.55 c0,0.86-0.69,1.55-1.55,1.55H31.81L31.81,65.77z M31.81,38c-0.86,0-1.55-0.69-1.55-1.55c0-0.86,0.69-1.55,1.55-1.55h11.31 c0.86,0,1.55,0.69,1.55,1.55c0,0.86-0.69,1.55-1.55,1.55H31.81L31.81,38z M31.81,51.88c-0.86,0-1.55-0.69-1.55-1.55 c0-0.86,0.69-1.55,1.55-1.55h11.31c0.86,0,1.55,0.69,1.55,1.55c0,0.86-0.69,1.55-1.55,1.55H31.81L31.81,51.88z M31.81,79.65 c-0.86,0-1.55-0.69-1.55-1.55c0-0.86,0.69-1.55,1.55-1.55h11.31c0.86,0,1.55,0.69,1.55,1.55c0,0.86-0.69,1.55-1.55,1.55H31.81 L31.81,79.65z M63.74,26.78H10.66l4.61,60.24h43.2L63.74,26.78L63.74,26.78z M10.63,26.39l0,0.02l0,0L10.63,26.39L10.63,26.39z"/></g></svg>',
    "equipment:batedeira":
      '<svg fill="currentColor" height="800px" width="800px" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" xml:space="preserve"><g><g><g><path d="M490.667,170.667c11.782,0,21.333-9.551,21.333-21.333v-128C512,9.551,502.449,0,490.667,0H21.333 C9.551,0,0,9.551,0,21.333v469.333C0,502.449,9.551,512,21.333,512h469.333c11.782,0,21.333-9.551,21.333-21.333v-85.333 c0-11.782-9.551-21.333-21.333-21.333H415.39c20.274-22.648,32.61-52.55,32.61-85.333c0-11.782-9.551-21.333-21.333-21.333 h-2.132c-8.475-41.82-41.382-74.726-83.201-83.201v-23.465H490.667z M469.333,469.333H42.667V42.667h426.667V128H106.667 c-11.782,0-21.333,9.551-21.333,21.333v256c0,11.782,9.551,21.333,21.333,21.333h362.667V469.333z M298.667,277.333h-39.02 c6.42-18.199,20.821-32.6,39.02-39.02V277.333z M237.356,320h165.287c-9.476,36.8-42.89,64-82.644,64 C280.247,384,246.832,356.8,237.356,320z M380.353,277.333h-39.02v-39.02C359.533,244.733,373.933,259.134,380.353,277.333z M298.667,194.132c-41.82,8.475-74.726,41.382-83.201,83.201h-2.132c-11.782,0-21.333,9.551-21.333,21.333 c0,32.783,12.336,62.686,32.61,85.333H128V170.667h170.667V194.132z"/><path d="M149.333,106.667c11.776,0,21.333-9.557,21.333-21.333S161.109,64,149.333,64S128,73.557,128,85.333 S137.557,106.667,149.333,106.667z"/><path d="M234.667,106.667c11.776,0,21.333-9.557,21.333-21.333S246.443,64,234.667,64s-21.333,9.557-21.333,21.333 S222.891,106.667,234.667,106.667z"/></g></g></g></svg>',
    "equipment:microondas":
      '<svg fill="currentColor" width="800px" height="800px" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><path d="M3 8C1.355469 8 0 9.355469 0 11L0 39C0 40.644531 1.355469 42 3 42L5 42L5 43C5 44.09375 5.90625 45 7 45L10 45C11.09375 45 12 44.09375 12 43L12 42L38 42L38 43C38 44.09375 38.90625 45 40 45L43 45C44.09375 45 45 44.09375 45 43L45 42L47 42C48.644531 42 50 40.644531 50 39L50 11C50 9.355469 48.644531 8 47 8 Z M 3 10L47 10C47.5625 10 48 10.4375 48 11L48 39C48 39.5625 47.5625 40 47 40L39.1875 40C39.054688 39.972656 38.914063 39.972656 38.78125 40L6.1875 40C6.054688 39.972656 5.914063 39.972656 5.78125 40L3 40C2.4375 40 2 39.5625 2 39L2 11C2 10.4375 2.4375 10 3 10 Z M 5 13L5 37L40 37L40 13 Z M 7 15L38 15L38 35L7 35 Z M 44 16C42.894531 16 42 16.894531 42 18C42 19.105469 42.894531 20 44 20C45.105469 20 46 19.105469 46 18C46 16.894531 45.105469 16 44 16 Z M 34.15625 19.9375C33.957031 19.933594 33.761719 19.988281 33.59375 20.09375C33.59375 20.09375 28.964844 22 26.125 22C24.707031 22 23.75 21.59375 22.59375 21.09375C21.4375 20.59375 20.066406 20 18.21875 20C14.523438 20 10.5625 22.09375 10.5625 22.09375C10.0625 22.335938 9.851563 22.9375 10.09375 23.4375C10.335938 23.9375 10.9375 24.148438 11.4375 23.90625C11.4375 23.90625 15.332031 22 18.21875 22C19.664063 22 20.628906 22.40625 21.78125 22.90625C22.933594 23.40625 24.296875 24 26.125 24C29.785156 24 34.40625 21.90625 34.40625 21.90625C34.894531 21.78125 35.214844 21.3125 35.148438 20.8125C35.085938 20.3125 34.660156 19.9375 34.15625 19.9375 Z M 44 23C42.894531 23 42 23.894531 42 25C42 26.105469 42.894531 27 44 27C45.105469 27 46 26.105469 46 25C46 23.894531 45.105469 23 44 23 Z M 34.15625 25.9375C33.957031 25.933594 33.761719 25.988281 33.59375 26.09375C33.59375 26.09375 28.964844 28 26.125 28C24.707031 28 23.75 27.59375 22.59375 27.09375C21.4375 26.59375 20.066406 26 18.21875 26C14.523438 26 10.5625 28.09375 10.5625 28.09375C10.0625 28.335938 9.851563 28.9375 10.09375 29.4375C10.335938 29.9375 10.9375 30.148438 11.4375 29.90625C11.4375 29.90625 15.332031 28 18.21875 28C19.664063 28 20.628906 28.40625 21.78125 28.90625C22.933594 29.40625 24.296875 30 26.125 30C29.785156 30 34.40625 27.90625 34.40625 27.90625C34.894531 27.78125 35.214844 27.3125 35.148438 26.8125C35.085938 26.3125 34.660156 25.9375 34.15625 25.9375 Z M 44 30C42.894531 30 42 30.894531 42 32C42 33.105469 42.894531 34 44 34C45.105469 34 46 33.105469 46 32C46 30.894531 45.105469 30 44 30 Z M 7 42L10 42L10 43L7 43 Z M 40 42L43 42L43 43L40 43Z"/></svg>',
    // Autoral (confirmado com o usuário) — sem fonte externa a creditar em buildIconCreditsEl().
    // fill="currentColor" já vinha assim no arquivo original, sem edição.
    "equipment:processador":
      '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" fill="none"><title>Ícone vetorial</title><path d="M 173 0 L 173 15 L 174 16 L 189 16 L 190 17 L 190 82 L 187 84 L 180 84 L 179 85 L 172 85 L 171 86 L 167 86 L 166 87 L 162 87 L 161 88 L 157 88 L 156 89 L 153 89 L 152 90 L 150 90 L 149 91 L 146 91 L 145 92 L 143 92 L 142 93 L 140 93 L 139 94 L 137 94 L 136 95 L 134 95 L 131 97 L 129 97 L 126 99 L 124 99 L 123 100 L 122 100 L 121 101 L 118 102 L 115 105 L 114 105 L 108 111 L 108 112 L 105 115 L 105 116 L 102 121 L 102 123 L 101 124 L 101 126 L 100 127 L 100 131 L 99 132 L 99 296 L 98 297 L 98 299 L 97 300 L 97 302 L 96 303 L 96 305 L 95 306 L 95 308 L 94 309 L 94 311 L 93 312 L 93 314 L 92 315 L 92 318 L 91 319 L 91 321 L 90 322 L 90 325 L 89 326 L 89 329 L 88 330 L 88 334 L 87 335 L 87 339 L 86 340 L 86 345 L 85 346 L 85 352 L 84 353 L 84 361 L 83 362 L 83 486 L 98 486 L 99 487 L 99 511 L 148 511 L 148 487 L 149 486 L 362 486 L 363 487 L 363 511 L 412 511 L 412 487 L 413 486 L 428 486 L 428 362 L 427 361 L 427 353 L 426 352 L 426 346 L 425 345 L 425 340 L 424 339 L 424 335 L 423 334 L 423 330 L 422 329 L 422 326 L 421 325 L 421 322 L 420 321 L 420 319 L 419 318 L 419 315 L 418 314 L 418 312 L 417 311 L 417 309 L 416 308 L 416 306 L 415 305 L 415 303 L 414 302 L 414 300 L 413 299 L 413 297 L 412 296 L 412 132 L 411 131 L 411 127 L 410 126 L 410 124 L 409 123 L 409 121 L 408 120 L 408 119 L 407 118 L 406 115 L 403 112 L 403 111 L 397 105 L 396 105 L 393 102 L 392 102 L 387 99 L 385 99 L 384 98 L 383 98 L 382 97 L 380 97 L 377 95 L 375 95 L 374 94 L 372 94 L 371 93 L 369 93 L 368 92 L 366 92 L 365 91 L 362 91 L 361 90 L 359 90 L 358 89 L 355 89 L 354 88 L 350 88 L 349 87 L 345 87 L 344 86 L 340 86 L 339 85 L 332 85 L 331 84 L 324 84 L 321 82 L 321 17 L 322 16 L 337 16 L 338 15 L 338 0 Z M 379 487 L 380 486 L 395 486 L 396 487 L 396 494 L 395 495 L 380 495 L 379 494 Z M 115 487 L 116 486 L 131 486 L 132 487 L 132 494 L 131 495 L 116 495 L 115 494 Z M 111 307 L 113 305 L 398 305 L 400 307 L 400 309 L 401 310 L 401 312 L 402 313 L 402 315 L 403 316 L 403 319 L 404 320 L 404 322 L 405 323 L 405 325 L 406 326 L 406 330 L 407 331 L 407 334 L 408 335 L 408 339 L 409 340 L 409 343 L 410 344 L 410 351 L 411 352 L 411 358 L 412 359 L 412 373 L 413 374 L 413 437 L 412 438 L 322 438 L 322 453 L 412 453 L 413 454 L 413 470 L 412 471 L 99 471 L 98 470 L 98 454 L 99 453 L 189 453 L 189 438 L 99 438 L 98 437 L 98 374 L 99 373 L 99 359 L 100 358 L 100 352 L 101 351 L 101 344 L 102 343 L 102 340 L 103 339 L 103 335 L 104 334 L 104 331 L 105 330 L 105 326 L 106 325 L 106 323 L 107 322 L 107 320 L 108 319 L 108 316 L 109 315 L 109 313 L 110 312 L 110 310 L 111 309 Z M 249 322 L 248 323 L 242 323 L 241 324 L 238 324 L 237 325 L 235 325 L 234 326 L 232 326 L 231 327 L 230 327 L 229 328 L 228 328 L 227 329 L 226 329 L 225 330 L 222 331 L 220 333 L 219 333 L 217 335 L 216 335 L 207 343 L 207 344 L 203 348 L 203 349 L 200 352 L 200 353 L 199 354 L 199 355 L 198 356 L 198 357 L 197 358 L 197 359 L 194 364 L 194 366 L 193 367 L 193 369 L 192 370 L 192 373 L 191 374 L 191 379 L 190 380 L 190 395 L 191 396 L 191 401 L 192 402 L 192 405 L 193 406 L 193 408 L 194 409 L 194 411 L 195 412 L 195 414 L 196 415 L 196 416 L 197 417 L 198 420 L 200 422 L 200 423 L 202 425 L 202 426 L 205 429 L 205 430 L 213 438 L 214 438 L 217 441 L 218 441 L 223 445 L 224 445 L 229 448 L 231 448 L 234 450 L 236 450 L 237 451 L 240 451 L 241 452 L 246 452 L 247 453 L 264 453 L 265 452 L 270 452 L 271 451 L 274 451 L 275 450 L 277 450 L 280 448 L 282 448 L 283 447 L 284 447 L 285 446 L 288 445 L 290 443 L 291 443 L 293 441 L 294 441 L 297 438 L 298 438 L 306 430 L 306 429 L 309 426 L 309 425 L 313 420 L 313 419 L 316 414 L 316 412 L 317 411 L 317 409 L 318 408 L 318 406 L 319 405 L 319 402 L 320 401 L 320 396 L 321 395 L 321 380 L 320 379 L 320 374 L 319 373 L 319 370 L 318 369 L 318 367 L 317 366 L 317 364 L 316 363 L 316 362 L 315 361 L 315 360 L 314 359 L 314 358 L 313 357 L 313 356 L 312 355 L 311 352 L 308 349 L 308 348 L 304 344 L 304 343 L 300 339 L 299 339 L 295 335 L 294 335 L 289 331 L 288 331 L 287 330 L 286 330 L 285 329 L 284 329 L 279 326 L 277 326 L 276 325 L 274 325 L 273 324 L 270 324 L 269 323 L 263 323 L 262 322 Z M 268 339 L 269 340 L 272 340 L 273 341 L 274 341 L 275 342 L 276 342 L 277 343 L 278 343 L 279 344 L 282 345 L 285 348 L 286 348 L 295 357 L 295 358 L 298 361 L 298 362 L 299 363 L 299 364 L 300 365 L 300 366 L 303 371 L 303 374 L 304 375 L 304 377 L 305 378 L 305 386 L 306 387 L 306 388 L 305 389 L 305 397 L 304 398 L 304 400 L 303 401 L 303 404 L 300 409 L 300 411 L 299 412 L 299 413 L 296 416 L 296 417 L 285 428 L 284 428 L 279 432 L 278 432 L 277 433 L 275 433 L 272 435 L 270 435 L 269 436 L 266 436 L 265 437 L 264 437 L 263 436 L 263 340 L 264 339 Z M 243 339 L 247 339 L 248 340 L 248 436 L 247 437 L 246 437 L 245 436 L 242 436 L 241 435 L 239 435 L 236 433 L 234 433 L 233 432 L 232 432 L 230 430 L 229 430 L 227 428 L 226 428 L 215 417 L 215 416 L 211 411 L 211 409 L 208 404 L 208 401 L 207 400 L 207 398 L 206 397 L 206 378 L 207 377 L 207 375 L 208 374 L 208 371 L 209 370 L 209 369 L 210 368 L 210 367 L 211 366 L 211 365 L 212 364 L 213 361 L 216 358 L 216 357 L 225 348 L 226 348 L 231 344 L 232 344 L 237 341 L 239 341 L 240 340 L 242 340 Z M 230 141 L 232 139 L 279 139 L 281 141 L 281 181 L 280 182 L 231 182 L 230 181 Z M 115 140 L 116 139 L 213 139 L 215 141 L 215 197 L 296 197 L 296 141 L 298 139 L 395 139 L 396 140 L 396 288 L 395 289 L 116 289 L 115 288 Z M 306 256 L 306 272 L 370 272 L 371 271 L 371 256 Z M 223 256 L 223 272 L 288 272 L 288 256 Z M 140 256 L 140 271 L 141 272 L 205 272 L 205 256 Z M 264 231 L 264 247 L 329 247 L 329 231 Z M 182 231 L 182 247 L 247 247 L 247 231 Z M 296 99 L 297 98 L 313 98 L 314 99 L 327 99 L 328 100 L 334 100 L 335 101 L 340 101 L 341 102 L 345 102 L 346 103 L 349 103 L 350 104 L 353 104 L 354 105 L 357 105 L 358 106 L 361 106 L 362 107 L 364 107 L 365 108 L 367 108 L 370 110 L 372 110 L 373 111 L 375 111 L 378 113 L 380 113 L 381 114 L 384 115 L 386 117 L 387 117 L 391 121 L 391 122 L 392 123 L 391 124 L 297 124 L 296 123 Z M 230 99 L 231 98 L 280 98 L 281 99 L 281 123 L 280 124 L 231 124 L 230 123 Z M 215 99 L 215 123 L 214 124 L 120 124 L 119 123 L 120 122 L 120 121 L 124 117 L 125 117 L 127 115 L 128 115 L 131 113 L 133 113 L 136 111 L 138 111 L 139 110 L 141 110 L 144 108 L 146 108 L 147 107 L 149 107 L 150 106 L 153 106 L 154 105 L 157 105 L 158 104 L 161 104 L 162 103 L 165 103 L 166 102 L 170 102 L 171 101 L 176 101 L 177 100 L 183 100 L 184 99 L 197 99 L 198 98 L 214 98 Z M 205 17 L 206 16 L 305 16 L 306 17 L 306 81 L 304 83 L 207 83 L 205 81 Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"/></svg>',
    "equipment:sous-vide":
      '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" fill="none"><title>Ícone vetorial</title><path d="M 216 1 L 215 2 L 213 2 L 212 3 L 210 3 L 209 4 L 208 4 L 206 6 L 203 7 L 193 17 L 193 18 L 191 20 L 191 21 L 189 24 L 189 26 L 187 29 L 187 33 L 186 34 L 186 93 L 187 94 L 187 97 L 188 98 L 188 100 L 189 101 L 189 102 L 190 103 L 190 104 L 191 105 L 192 108 L 195 111 L 195 112 L 200 117 L 201 117 L 202 118 L 202 220 L 201 221 L 177 221 L 176 222 L 170 222 L 169 223 L 166 223 L 163 225 L 161 225 L 160 226 L 159 226 L 158 227 L 157 227 L 156 228 L 153 229 L 150 232 L 149 232 L 141 240 L 141 241 L 138 244 L 138 245 L 137 246 L 137 247 L 136 248 L 136 249 L 133 254 L 133 256 L 132 257 L 132 260 L 131 261 L 131 267 L 130 268 L 130 452 L 159 452 L 159 325 L 160 324 L 214 324 L 215 325 L 215 463 L 216 464 L 216 471 L 217 472 L 217 475 L 218 476 L 218 479 L 220 482 L 220 484 L 221 485 L 221 486 L 223 488 L 223 489 L 224 490 L 224 491 L 226 493 L 226 494 L 230 498 L 230 499 L 235 504 L 236 504 L 241 509 L 242 509 L 244 511 L 323 511 L 325 509 L 326 509 L 330 505 L 331 505 L 337 499 L 337 498 L 340 495 L 340 494 L 344 489 L 344 488 L 346 485 L 346 483 L 348 480 L 348 478 L 349 477 L 349 474 L 350 473 L 350 469 L 351 468 L 351 325 L 352 324 L 364 324 L 364 119 L 373 110 L 373 109 L 375 107 L 375 106 L 378 101 L 378 99 L 379 98 L 379 96 L 380 95 L 380 90 L 381 89 L 381 37 L 380 36 L 380 32 L 379 31 L 379 28 L 378 27 L 378 25 L 377 24 L 376 21 L 374 19 L 374 18 L 372 16 L 372 15 L 366 9 L 365 9 L 362 6 L 361 6 L 360 5 L 359 5 L 354 2 L 351 2 L 350 1 L 346 1 L 345 0 L 221 0 L 220 1 Z M 246 324 L 321 324 L 322 325 L 322 465 L 321 466 L 321 469 L 320 470 L 320 472 L 319 473 L 319 474 L 317 476 L 317 477 L 312 482 L 254 482 L 251 479 L 251 478 L 248 475 L 248 474 L 247 473 L 247 471 L 246 470 L 246 468 L 245 467 L 245 463 L 244 462 L 244 326 Z M 231 252 L 233 250 L 334 250 L 335 251 L 335 294 L 334 295 L 232 295 L 231 294 Z M 167 255 L 168 255 L 170 253 L 171 253 L 174 251 L 177 251 L 178 250 L 201 250 L 202 251 L 202 294 L 201 295 L 160 295 L 159 294 L 159 269 L 160 268 L 160 265 L 161 264 L 162 261 L 164 259 L 164 258 Z M 231 128 L 233 126 L 334 126 L 335 127 L 335 220 L 334 221 L 299 221 L 298 220 L 298 160 L 269 160 L 269 220 L 268 221 L 232 221 L 231 220 Z M 215 37 L 216 36 L 216 35 L 220 31 L 221 31 L 224 29 L 343 29 L 349 33 L 349 34 L 351 36 L 351 38 L 352 39 L 352 87 L 351 88 L 351 90 L 350 91 L 350 92 L 346 96 L 345 96 L 344 97 L 223 97 L 222 96 L 221 96 L 216 91 L 216 90 L 215 89 Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"/></svg>',
    "equipment:churrasqueira":
      '<svg xmlns="http://www.w3.org/2000/svg"     width="512" height="512" viewBox="0 0 512 512"     fill="none">  <title>Ícone vetorial</title>  <path d="M 362 132 L 361 133 L 358 134 L 357 135 L 357 136 L 355 138 L 355 139 L 352 144 L 352 149 L 351 150 L 351 151 L 352 152 L 352 157 L 353 158 L 353 160 L 354 161 L 354 162 L 356 164 L 356 165 L 359 168 L 359 169 L 361 172 L 361 176 L 360 177 L 360 178 L 358 180 L 358 181 L 356 184 L 356 186 L 357 187 L 357 189 L 360 192 L 366 192 L 368 190 L 369 190 L 369 189 L 372 186 L 372 185 L 373 184 L 373 182 L 374 181 L 374 179 L 375 178 L 375 170 L 374 169 L 374 166 L 373 165 L 373 164 L 372 163 L 371 160 L 367 156 L 367 155 L 366 154 L 366 152 L 365 151 L 366 150 L 366 147 L 370 142 L 370 137 L 369 136 L 369 135 L 367 133 L 366 133 L 365 132 Z M 325 132 L 320 135 L 320 136 L 318 138 L 318 139 L 316 142 L 316 144 L 315 145 L 315 157 L 316 158 L 316 160 L 318 162 L 319 165 L 322 168 L 322 169 L 324 171 L 324 176 L 323 177 L 322 180 L 320 182 L 320 184 L 319 185 L 319 186 L 320 187 L 320 189 L 322 191 L 323 191 L 324 192 L 329 192 L 332 190 L 332 189 L 335 186 L 335 185 L 337 182 L 337 179 L 338 178 L 338 169 L 337 168 L 337 166 L 336 165 L 336 164 L 335 163 L 334 160 L 330 156 L 330 155 L 329 154 L 329 147 L 333 142 L 333 136 L 330 133 L 329 133 L 328 132 Z M 288 132 L 287 133 L 284 134 L 284 135 L 281 138 L 281 139 L 279 142 L 279 144 L 278 145 L 278 156 L 279 157 L 279 159 L 280 160 L 280 161 L 281 162 L 282 165 L 286 169 L 286 170 L 287 171 L 287 176 L 286 177 L 285 180 L 283 182 L 283 184 L 282 185 L 282 186 L 283 187 L 283 189 L 285 191 L 286 191 L 287 192 L 292 192 L 293 191 L 294 191 L 296 189 L 296 188 L 298 186 L 298 185 L 300 182 L 300 180 L 301 179 L 301 169 L 300 168 L 300 166 L 299 165 L 299 164 L 298 163 L 297 160 L 294 157 L 294 156 L 292 154 L 292 147 L 296 142 L 296 136 L 293 133 L 292 133 L 291 132 Z M 157 28 L 155 30 L 154 30 L 122 62 L 122 63 L 120 65 L 120 66 L 119 67 L 119 69 L 118 70 L 118 76 L 119 77 L 119 79 L 120 80 L 121 83 L 129 91 L 129 92 L 112 109 L 112 110 L 110 112 L 110 113 L 107 116 L 106 119 L 104 121 L 104 122 L 103 123 L 103 124 L 102 125 L 102 126 L 101 127 L 101 128 L 98 133 L 98 135 L 97 136 L 97 138 L 96 139 L 96 141 L 95 142 L 95 145 L 94 146 L 94 149 L 93 150 L 93 155 L 92 156 L 92 166 L 91 167 L 91 169 L 92 170 L 92 183 L 93 184 L 93 188 L 94 189 L 94 193 L 95 194 L 95 196 L 96 197 L 96 199 L 97 200 L 97 202 L 98 203 L 98 205 L 99 206 L 99 207 L 100 208 L 100 210 L 101 211 L 102 214 L 104 216 L 105 219 L 107 221 L 107 222 L 109 224 L 109 225 L 111 227 L 111 228 L 116 233 L 116 234 L 117 235 L 116 236 L 116 238 L 115 239 L 115 242 L 114 243 L 114 251 L 115 252 L 115 255 L 116 256 L 117 259 L 119 261 L 119 262 L 124 267 L 125 267 L 126 268 L 127 268 L 132 271 L 132 274 L 131 275 L 101 275 L 100 276 L 97 276 L 96 277 L 93 278 L 87 284 L 87 285 L 84 290 L 84 301 L 85 302 L 85 304 L 86 305 L 86 306 L 89 309 L 89 310 L 90 311 L 91 311 L 93 313 L 94 313 L 97 315 L 99 315 L 100 316 L 145 316 L 147 318 L 147 319 L 149 321 L 149 322 L 151 324 L 151 325 L 155 329 L 155 330 L 164 339 L 165 339 L 170 344 L 171 344 L 176 348 L 179 349 L 181 351 L 182 351 L 183 352 L 184 352 L 189 355 L 191 355 L 194 357 L 196 357 L 197 358 L 199 358 L 202 360 L 202 361 L 201 362 L 201 364 L 200 365 L 200 368 L 199 369 L 199 372 L 198 373 L 198 376 L 197 377 L 197 380 L 196 381 L 196 384 L 195 385 L 195 388 L 194 389 L 194 392 L 193 393 L 193 395 L 192 396 L 192 399 L 191 400 L 191 403 L 190 404 L 190 407 L 189 408 L 189 411 L 188 412 L 188 415 L 187 416 L 187 419 L 186 420 L 186 423 L 185 424 L 185 426 L 184 427 L 184 430 L 183 431 L 183 434 L 182 435 L 182 438 L 181 439 L 181 442 L 180 443 L 180 446 L 179 447 L 179 453 L 181 455 L 181 456 L 182 456 L 183 457 L 188 457 L 189 456 L 190 456 L 192 454 L 192 452 L 193 451 L 193 449 L 194 448 L 194 445 L 195 444 L 195 441 L 196 440 L 196 437 L 197 436 L 197 433 L 198 432 L 198 429 L 199 428 L 199 425 L 200 424 L 200 422 L 201 421 L 201 418 L 202 417 L 202 414 L 203 413 L 203 410 L 204 409 L 204 406 L 205 405 L 205 402 L 206 401 L 206 398 L 207 397 L 207 394 L 208 393 L 208 391 L 209 390 L 209 387 L 210 386 L 210 383 L 211 382 L 211 379 L 212 378 L 212 375 L 213 374 L 213 371 L 214 370 L 214 367 L 215 366 L 215 364 L 217 362 L 222 362 L 223 363 L 232 363 L 233 364 L 233 366 L 232 367 L 232 370 L 231 371 L 231 373 L 230 374 L 230 377 L 229 378 L 229 381 L 228 382 L 228 385 L 227 386 L 227 389 L 226 390 L 226 393 L 225 394 L 225 397 L 224 398 L 224 401 L 223 402 L 223 404 L 222 405 L 222 408 L 221 409 L 221 412 L 220 413 L 220 416 L 219 417 L 219 420 L 218 421 L 218 424 L 217 425 L 217 428 L 216 429 L 216 432 L 215 433 L 215 435 L 214 436 L 214 439 L 213 440 L 213 443 L 212 444 L 212 447 L 211 448 L 211 451 L 210 452 L 210 455 L 209 456 L 209 459 L 208 460 L 208 463 L 207 464 L 207 466 L 206 467 L 206 470 L 205 471 L 205 474 L 204 475 L 204 478 L 203 479 L 203 482 L 202 483 L 202 486 L 201 487 L 201 490 L 200 491 L 200 492 L 196 496 L 195 496 L 194 497 L 190 497 L 189 496 L 188 496 L 184 492 L 184 490 L 183 489 L 184 488 L 184 484 L 185 483 L 185 480 L 186 479 L 186 476 L 187 475 L 187 472 L 186 471 L 186 469 L 184 467 L 183 467 L 182 466 L 178 466 L 177 467 L 176 467 L 174 469 L 174 470 L 173 471 L 173 473 L 172 474 L 172 477 L 171 478 L 171 481 L 170 482 L 170 486 L 169 487 L 169 488 L 170 489 L 170 495 L 171 496 L 171 497 L 172 498 L 173 501 L 179 507 L 180 507 L 182 509 L 184 509 L 185 510 L 188 510 L 189 511 L 196 511 L 197 510 L 200 510 L 201 509 L 204 508 L 207 505 L 208 505 L 209 504 L 209 503 L 211 501 L 211 500 L 213 498 L 213 496 L 214 495 L 214 493 L 215 492 L 215 489 L 216 488 L 216 485 L 217 484 L 217 481 L 218 480 L 218 477 L 219 476 L 219 473 L 220 472 L 220 469 L 221 468 L 221 465 L 222 464 L 222 462 L 223 461 L 223 458 L 224 457 L 224 454 L 226 451 L 333 451 L 335 453 L 335 456 L 336 457 L 336 460 L 337 461 L 337 466 L 336 467 L 336 469 L 335 470 L 335 472 L 334 473 L 334 485 L 335 486 L 335 489 L 336 490 L 336 492 L 338 494 L 339 497 L 342 500 L 342 501 L 344 503 L 345 503 L 348 506 L 349 506 L 354 509 L 356 509 L 357 510 L 360 510 L 361 511 L 370 511 L 371 510 L 374 510 L 375 509 L 377 509 L 378 508 L 379 508 L 380 507 L 383 506 L 386 503 L 387 503 L 389 501 L 389 500 L 392 497 L 393 494 L 395 492 L 395 490 L 396 489 L 396 486 L 397 485 L 397 473 L 396 472 L 396 470 L 395 469 L 395 467 L 394 466 L 393 463 L 391 461 L 391 460 L 385 454 L 384 454 L 381 451 L 381 450 L 380 449 L 380 446 L 379 445 L 379 442 L 378 441 L 378 438 L 377 437 L 377 434 L 376 433 L 376 430 L 375 429 L 375 426 L 374 425 L 374 423 L 373 422 L 373 419 L 372 418 L 372 415 L 371 414 L 371 411 L 370 410 L 370 407 L 369 406 L 369 403 L 368 402 L 368 399 L 367 398 L 367 396 L 366 395 L 366 392 L 365 391 L 365 388 L 364 387 L 364 384 L 363 383 L 363 380 L 362 379 L 362 376 L 361 375 L 361 372 L 360 371 L 360 369 L 359 368 L 359 365 L 358 364 L 358 361 L 357 360 L 360 358 L 362 358 L 363 357 L 365 357 L 366 356 L 368 356 L 369 355 L 370 355 L 371 354 L 372 354 L 373 353 L 374 353 L 375 352 L 376 352 L 377 351 L 380 350 L 382 348 L 383 348 L 385 346 L 386 346 L 388 344 L 389 344 L 393 340 L 394 340 L 405 329 L 405 328 L 411 321 L 411 320 L 413 318 L 414 315 L 416 313 L 416 312 L 417 311 L 417 309 L 418 308 L 418 307 L 421 302 L 421 300 L 422 299 L 422 297 L 423 296 L 423 294 L 424 293 L 424 291 L 425 290 L 425 285 L 426 284 L 426 280 L 427 279 L 427 251 L 426 250 L 426 248 L 424 246 L 424 245 L 419 241 L 417 241 L 416 240 L 403 240 L 401 238 L 401 219 L 400 218 L 400 217 L 399 216 L 398 213 L 396 211 L 395 211 L 393 209 L 392 209 L 391 208 L 389 208 L 388 207 L 373 207 L 372 208 L 370 208 L 367 211 L 367 217 L 368 218 L 368 219 L 369 219 L 371 221 L 385 221 L 387 223 L 387 238 L 384 240 L 245 240 L 242 237 L 242 223 L 244 221 L 341 221 L 345 217 L 345 212 L 344 211 L 344 210 L 342 208 L 340 208 L 339 207 L 242 207 L 241 208 L 239 208 L 238 209 L 235 210 L 231 214 L 231 215 L 229 218 L 229 221 L 228 222 L 228 239 L 227 240 L 164 240 L 162 238 L 162 237 L 161 236 L 161 234 L 339 56 L 339 55 L 340 54 L 340 52 L 341 51 L 341 43 L 340 42 L 339 39 L 337 37 L 337 36 L 328 27 L 327 27 L 321 21 L 320 21 L 313 15 L 312 15 L 311 14 L 310 14 L 308 12 L 307 12 L 306 11 L 305 11 L 300 8 L 298 8 L 295 6 L 293 6 L 292 5 L 290 5 L 289 4 L 287 4 L 286 3 L 283 3 L 282 2 L 278 2 L 277 1 L 271 1 L 270 0 L 251 0 L 250 1 L 244 1 L 243 2 L 239 2 L 238 3 L 235 3 L 234 4 L 232 4 L 231 5 L 229 5 L 228 6 L 226 6 L 221 9 L 219 9 L 218 10 L 215 11 L 213 13 L 210 14 L 208 16 L 207 16 L 205 18 L 204 18 L 201 21 L 200 21 L 184 37 L 182 37 L 175 30 L 174 30 L 169 27 L 160 27 L 159 28 Z M 361 462 L 370 462 L 371 463 L 373 463 L 375 465 L 376 465 L 380 469 L 380 470 L 382 472 L 382 474 L 383 475 L 383 483 L 382 484 L 382 486 L 381 487 L 381 488 L 377 493 L 376 493 L 374 495 L 373 495 L 372 496 L 370 496 L 369 497 L 362 497 L 361 496 L 359 496 L 358 495 L 357 495 L 352 491 L 352 490 L 350 488 L 350 487 L 349 486 L 349 484 L 348 483 L 348 475 L 349 474 L 349 472 L 351 470 L 351 469 L 355 465 L 356 465 L 358 463 L 360 463 Z M 229 434 L 230 433 L 230 431 L 231 430 L 231 427 L 232 426 L 232 423 L 233 422 L 233 420 L 234 419 L 325 419 L 327 422 L 327 425 L 328 426 L 328 429 L 329 430 L 329 433 L 330 434 L 330 436 L 329 437 L 230 437 L 229 436 Z M 237 404 L 238 403 L 238 400 L 239 399 L 239 396 L 240 395 L 240 392 L 241 391 L 241 388 L 242 387 L 242 384 L 243 383 L 243 380 L 244 379 L 244 376 L 245 375 L 245 373 L 246 372 L 246 369 L 247 368 L 247 365 L 249 363 L 311 363 L 312 364 L 312 367 L 313 368 L 313 371 L 314 372 L 314 375 L 315 376 L 315 379 L 316 380 L 316 382 L 317 383 L 317 386 L 318 387 L 318 390 L 319 391 L 319 394 L 320 395 L 320 398 L 321 399 L 321 402 L 322 403 L 322 404 L 321 405 L 238 405 Z M 327 363 L 336 363 L 337 362 L 343 362 L 344 363 L 344 366 L 345 367 L 345 369 L 346 370 L 346 373 L 347 374 L 347 377 L 348 378 L 348 381 L 349 382 L 349 385 L 350 386 L 350 389 L 351 390 L 351 393 L 352 394 L 352 397 L 353 398 L 353 400 L 354 401 L 354 404 L 355 405 L 355 408 L 356 409 L 356 412 L 357 413 L 357 416 L 358 417 L 358 420 L 359 421 L 359 424 L 360 425 L 360 427 L 361 428 L 361 431 L 362 432 L 362 435 L 363 436 L 363 439 L 364 440 L 364 443 L 365 444 L 365 447 L 364 448 L 359 448 L 358 449 L 355 449 L 350 452 L 348 450 L 348 447 L 347 446 L 347 443 L 346 442 L 346 439 L 345 438 L 345 435 L 344 434 L 344 432 L 343 431 L 343 428 L 342 427 L 342 424 L 341 423 L 341 420 L 340 419 L 340 416 L 339 415 L 339 412 L 338 411 L 338 408 L 337 407 L 337 405 L 336 404 L 336 401 L 335 400 L 335 397 L 334 396 L 334 393 L 333 392 L 333 389 L 332 388 L 332 385 L 331 384 L 331 381 L 330 380 L 330 378 L 329 377 L 329 374 L 328 373 L 328 370 L 327 369 L 327 366 L 326 365 L 326 364 Z M 163 317 L 164 316 L 395 316 L 396 317 L 393 320 L 393 321 L 386 328 L 385 328 L 380 333 L 379 333 L 374 337 L 371 338 L 369 340 L 368 340 L 367 341 L 365 341 L 360 344 L 358 344 L 357 345 L 354 345 L 353 346 L 351 346 L 350 347 L 346 347 L 345 348 L 338 348 L 337 349 L 222 349 L 221 348 L 214 348 L 213 347 L 209 347 L 208 346 L 206 346 L 205 345 L 202 345 L 201 344 L 199 344 L 198 343 L 197 343 L 196 342 L 195 342 L 194 341 L 193 341 L 192 340 L 191 340 L 190 339 L 189 339 L 188 338 L 185 337 L 183 335 L 182 335 L 179 332 L 178 332 L 173 327 L 172 327 L 167 322 L 167 321 Z M 98 293 L 101 290 L 102 290 L 103 289 L 134 289 L 135 290 L 135 292 L 136 293 L 136 295 L 137 296 L 137 299 L 138 300 L 138 301 L 137 302 L 102 302 L 98 298 Z M 146 271 L 148 269 L 150 269 L 151 268 L 152 268 L 156 264 L 157 264 L 157 263 L 160 260 L 160 259 L 163 254 L 412 254 L 413 255 L 413 278 L 412 279 L 412 283 L 411 284 L 411 287 L 410 288 L 410 291 L 409 292 L 409 294 L 407 297 L 407 299 L 405 302 L 154 302 L 153 301 L 153 299 L 150 294 L 150 291 L 149 290 L 149 288 L 148 287 L 148 283 L 147 282 L 147 277 L 146 276 Z M 135 236 L 142 236 L 143 237 L 144 237 L 148 241 L 148 242 L 149 243 L 149 245 L 150 246 L 150 247 L 149 248 L 149 251 L 144 256 L 143 256 L 142 257 L 135 257 L 130 253 L 130 252 L 128 249 L 128 244 L 129 243 L 130 240 Z M 166 41 L 172 47 L 172 49 L 140 81 L 139 81 L 132 74 L 132 73 L 164 41 Z M 327 47 L 327 48 L 151 224 L 148 224 L 145 222 L 133 222 L 132 223 L 130 223 L 129 224 L 127 224 L 122 219 L 122 218 L 120 216 L 120 215 L 116 210 L 116 209 L 115 208 L 115 207 L 114 206 L 114 205 L 111 200 L 111 198 L 110 197 L 110 195 L 109 194 L 109 192 L 108 191 L 108 188 L 107 187 L 107 183 L 106 182 L 106 170 L 105 169 L 105 167 L 106 166 L 106 157 L 107 156 L 107 152 L 108 151 L 108 148 L 109 147 L 109 144 L 111 141 L 111 139 L 113 136 L 113 134 L 114 133 L 115 130 L 117 128 L 118 125 L 121 122 L 121 121 L 123 119 L 123 118 L 209 32 L 210 32 L 213 29 L 214 29 L 219 25 L 220 25 L 221 24 L 222 24 L 223 23 L 224 23 L 229 20 L 231 20 L 232 19 L 234 19 L 237 17 L 240 17 L 241 16 L 244 16 L 245 15 L 251 15 L 252 14 L 269 14 L 270 15 L 276 15 L 277 16 L 280 16 L 281 17 L 284 17 L 285 18 L 287 18 L 290 20 L 292 20 L 293 21 L 294 21 L 295 22 L 296 22 L 297 23 L 298 23 L 299 24 L 302 25 L 304 27 L 305 27 L 307 29 L 308 29 L 311 32 L 312 32 Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"/></svg>',
    "equipment:air-fryer":
      '<svg xmlns="http://www.w3.org/2000/svg"     width="512" height="512" viewBox="0 0 512 512"     fill="none">  <title>Ícone vetorial</title>  <path d="M 128 46 L 126 48 L 125 48 L 122 51 L 121 51 L 110 62 L 110 63 L 108 65 L 108 66 L 107 67 L 107 68 L 105 70 L 105 71 L 103 74 L 103 76 L 101 79 L 101 81 L 100 82 L 100 84 L 99 85 L 99 87 L 98 88 L 98 90 L 97 91 L 97 93 L 96 94 L 96 96 L 95 97 L 95 99 L 94 100 L 94 102 L 93 103 L 93 105 L 92 106 L 92 109 L 91 110 L 91 112 L 90 113 L 90 115 L 89 116 L 89 118 L 88 119 L 88 122 L 87 123 L 87 125 L 86 126 L 86 128 L 85 129 L 85 132 L 84 133 L 84 135 L 83 136 L 83 139 L 82 140 L 82 142 L 81 143 L 81 146 L 80 147 L 80 150 L 79 151 L 79 154 L 78 155 L 78 158 L 77 159 L 77 162 L 76 163 L 76 166 L 75 167 L 75 170 L 74 171 L 74 174 L 73 175 L 73 178 L 72 179 L 72 182 L 71 183 L 71 187 L 70 188 L 70 192 L 69 193 L 69 196 L 68 197 L 68 202 L 67 203 L 67 207 L 66 208 L 66 212 L 65 213 L 65 218 L 64 219 L 64 224 L 63 225 L 63 230 L 62 231 L 62 237 L 61 238 L 61 245 L 60 246 L 60 253 L 59 254 L 59 264 L 58 265 L 58 278 L 57 279 L 57 322 L 58 323 L 58 336 L 59 337 L 59 346 L 60 347 L 60 353 L 61 354 L 61 359 L 62 360 L 62 365 L 63 366 L 63 370 L 64 371 L 64 375 L 65 376 L 65 379 L 66 380 L 66 383 L 67 384 L 67 387 L 68 388 L 68 390 L 69 391 L 69 394 L 70 395 L 70 397 L 71 398 L 71 400 L 72 401 L 72 403 L 73 404 L 73 406 L 74 407 L 74 409 L 75 410 L 75 412 L 77 415 L 77 417 L 78 418 L 78 419 L 79 420 L 79 422 L 81 425 L 81 427 L 82 428 L 82 429 L 85 434 L 85 436 L 86 437 L 86 438 L 87 439 L 87 440 L 88 441 L 88 442 L 89 443 L 90 446 L 92 448 L 92 449 L 94 451 L 94 452 L 97 455 L 97 456 L 103 462 L 104 462 L 107 465 L 108 465 L 113 469 L 114 469 L 119 472 L 121 472 L 124 474 L 127 474 L 128 475 L 131 475 L 132 476 L 137 476 L 138 477 L 374 477 L 375 476 L 380 476 L 381 475 L 385 475 L 386 474 L 388 474 L 389 473 L 391 473 L 392 472 L 393 472 L 394 471 L 395 471 L 396 470 L 397 470 L 398 469 L 401 468 L 403 466 L 404 466 L 408 462 L 409 462 L 415 456 L 415 455 L 419 451 L 419 450 L 421 448 L 421 447 L 422 446 L 422 445 L 423 444 L 423 443 L 424 442 L 424 441 L 425 440 L 425 439 L 428 434 L 428 432 L 429 431 L 429 430 L 431 427 L 431 425 L 434 420 L 434 418 L 435 417 L 435 415 L 437 412 L 437 410 L 438 409 L 438 407 L 439 406 L 439 404 L 440 403 L 440 401 L 441 400 L 441 398 L 442 397 L 442 395 L 443 394 L 443 392 L 444 391 L 444 388 L 445 387 L 445 384 L 446 383 L 446 380 L 447 379 L 447 376 L 448 375 L 448 371 L 449 370 L 449 366 L 450 365 L 450 361 L 451 360 L 451 355 L 452 354 L 452 347 L 453 346 L 453 338 L 454 337 L 454 325 L 455 324 L 455 278 L 454 277 L 454 264 L 453 263 L 453 254 L 452 253 L 452 245 L 451 244 L 451 238 L 450 237 L 450 231 L 449 230 L 449 224 L 448 223 L 448 218 L 447 217 L 447 213 L 446 212 L 446 207 L 445 206 L 445 202 L 444 201 L 444 197 L 443 196 L 443 192 L 442 191 L 442 188 L 441 187 L 441 183 L 440 182 L 440 179 L 439 178 L 439 174 L 438 173 L 438 170 L 437 169 L 437 166 L 436 165 L 436 162 L 435 161 L 435 158 L 434 157 L 434 154 L 433 153 L 433 151 L 432 150 L 432 147 L 431 146 L 431 143 L 430 142 L 430 140 L 429 139 L 429 136 L 428 135 L 428 133 L 427 132 L 427 129 L 426 128 L 426 126 L 425 125 L 425 122 L 424 121 L 424 119 L 423 118 L 423 116 L 422 115 L 422 112 L 421 111 L 421 109 L 420 108 L 420 106 L 419 105 L 419 103 L 418 102 L 418 100 L 417 99 L 417 97 L 416 96 L 416 94 L 415 93 L 415 91 L 414 90 L 414 88 L 413 87 L 413 85 L 412 84 L 412 82 L 411 81 L 411 79 L 410 78 L 410 76 L 409 75 L 409 74 L 408 73 L 408 72 L 407 71 L 406 68 L 404 66 L 404 65 L 402 63 L 402 62 L 390 50 L 389 50 L 384 46 L 383 46 L 378 43 L 376 43 L 373 41 L 371 41 L 370 40 L 367 40 L 366 39 L 361 39 L 360 38 L 152 38 L 151 39 L 146 39 L 145 40 L 143 40 L 142 41 L 139 41 L 136 43 L 134 43 L 133 44 L 132 44 L 131 45 Z M 98 434 L 99 433 L 413 433 L 414 434 L 414 435 L 413 436 L 412 439 L 408 444 L 408 445 L 398 455 L 397 455 L 392 459 L 391 459 L 390 460 L 388 460 L 385 462 L 383 462 L 382 463 L 379 463 L 378 464 L 372 464 L 371 465 L 141 465 L 140 464 L 134 464 L 133 463 L 130 463 L 129 462 L 127 462 L 126 461 L 125 461 L 124 460 L 123 460 L 122 459 L 121 459 L 120 458 L 117 457 L 114 454 L 113 454 L 104 445 L 104 444 L 102 442 L 102 441 L 101 440 L 101 439 Z M 79 206 L 80 205 L 214 205 L 215 206 L 215 359 L 216 360 L 216 365 L 217 366 L 217 368 L 218 369 L 218 371 L 219 372 L 219 373 L 220 374 L 221 377 L 223 379 L 223 380 L 232 389 L 233 389 L 235 391 L 236 391 L 241 394 L 243 394 L 244 395 L 247 395 L 248 396 L 264 396 L 265 395 L 268 395 L 269 394 L 271 394 L 272 393 L 273 393 L 274 392 L 277 391 L 279 389 L 280 389 L 283 386 L 284 386 L 285 385 L 285 384 L 290 379 L 290 378 L 291 377 L 291 376 L 292 375 L 292 374 L 295 369 L 295 366 L 296 365 L 296 361 L 297 360 L 297 206 L 298 205 L 432 205 L 433 206 L 433 209 L 434 210 L 434 215 L 435 216 L 435 220 L 436 221 L 436 226 L 437 227 L 437 233 L 438 234 L 438 240 L 439 241 L 439 247 L 440 248 L 440 256 L 441 257 L 441 266 L 442 267 L 442 281 L 443 282 L 443 320 L 442 321 L 442 334 L 441 335 L 441 344 L 440 345 L 440 351 L 439 352 L 439 357 L 438 358 L 438 363 L 437 364 L 437 368 L 436 369 L 436 372 L 435 373 L 435 377 L 434 378 L 434 381 L 433 382 L 433 384 L 432 385 L 432 388 L 431 389 L 431 391 L 430 392 L 430 394 L 429 395 L 429 398 L 428 399 L 428 401 L 426 404 L 426 406 L 425 407 L 425 409 L 423 412 L 423 414 L 421 417 L 421 419 L 419 421 L 93 421 L 91 419 L 91 417 L 90 416 L 90 415 L 89 414 L 89 412 L 87 409 L 87 407 L 86 406 L 86 404 L 85 403 L 85 401 L 84 400 L 84 398 L 83 397 L 83 395 L 82 394 L 82 392 L 81 391 L 81 389 L 80 388 L 80 385 L 79 384 L 79 381 L 78 380 L 78 377 L 77 376 L 77 373 L 76 372 L 76 369 L 75 368 L 75 364 L 74 363 L 74 358 L 73 357 L 73 351 L 72 350 L 72 344 L 71 343 L 71 334 L 70 333 L 70 319 L 69 318 L 69 284 L 70 283 L 70 268 L 71 267 L 71 258 L 72 257 L 72 249 L 73 248 L 73 241 L 74 240 L 74 234 L 75 233 L 75 228 L 76 227 L 76 222 L 77 221 L 77 216 L 78 215 L 78 211 L 79 210 Z M 255 86 L 256 86 L 257 87 L 266 87 L 267 88 L 270 88 L 271 89 L 273 89 L 276 91 L 278 91 L 279 92 L 280 92 L 282 94 L 285 95 L 289 99 L 290 99 L 296 105 L 296 106 L 299 109 L 300 112 L 302 114 L 302 115 L 304 118 L 304 120 L 305 121 L 305 123 L 306 124 L 306 127 L 307 128 L 307 133 L 308 134 L 308 142 L 307 143 L 307 149 L 306 150 L 306 153 L 304 156 L 304 158 L 303 159 L 303 160 L 302 161 L 301 164 L 297 169 L 297 170 L 288 179 L 287 179 L 287 180 L 285 183 L 285 357 L 284 358 L 284 363 L 283 364 L 283 366 L 282 367 L 281 370 L 279 372 L 279 373 L 273 379 L 272 379 L 270 381 L 269 381 L 268 382 L 266 382 L 265 383 L 263 383 L 262 384 L 250 384 L 249 383 L 247 383 L 244 381 L 242 381 L 239 378 L 238 378 L 233 373 L 233 372 L 231 370 L 231 369 L 229 366 L 229 364 L 228 363 L 228 357 L 227 356 L 227 183 L 226 182 L 225 179 L 224 178 L 223 178 L 216 171 L 216 170 L 213 167 L 213 166 L 211 164 L 211 163 L 208 158 L 208 156 L 207 155 L 207 153 L 206 152 L 206 149 L 205 148 L 205 142 L 204 141 L 204 135 L 205 134 L 205 128 L 206 127 L 206 124 L 207 123 L 207 121 L 209 118 L 209 116 L 210 115 L 210 114 L 212 112 L 213 109 L 217 105 L 217 104 L 222 99 L 223 99 L 226 96 L 227 96 L 229 94 L 230 94 L 232 92 L 233 92 L 234 91 L 236 91 L 239 89 L 241 89 L 242 88 L 245 88 L 246 87 L 254 87 Z M 252 100 L 251 101 L 247 101 L 246 102 L 243 102 L 242 103 L 241 103 L 240 104 L 239 104 L 238 105 L 235 106 L 232 109 L 231 109 L 227 113 L 227 114 L 224 117 L 224 118 L 223 119 L 223 120 L 220 125 L 220 127 L 219 128 L 219 131 L 218 132 L 218 144 L 219 145 L 219 149 L 221 152 L 221 154 L 222 155 L 223 158 L 225 160 L 225 161 L 233 169 L 234 169 L 236 171 L 237 171 L 242 174 L 244 174 L 245 175 L 247 175 L 248 176 L 264 176 L 265 175 L 267 175 L 268 174 L 270 174 L 271 173 L 272 173 L 273 172 L 274 172 L 275 171 L 278 170 L 287 161 L 287 160 L 289 158 L 289 157 L 292 152 L 292 150 L 293 149 L 293 146 L 294 145 L 294 132 L 293 131 L 293 128 L 292 127 L 292 125 L 291 124 L 291 122 L 290 121 L 290 120 L 288 118 L 288 117 L 286 115 L 286 114 L 281 109 L 280 109 L 277 106 L 276 106 L 275 105 L 274 105 L 269 102 L 266 102 L 265 101 L 261 101 L 260 100 Z M 263 113 L 264 114 L 266 114 L 267 115 L 268 115 L 270 117 L 271 117 L 278 124 L 278 125 L 281 130 L 281 133 L 282 134 L 282 143 L 281 144 L 281 146 L 280 147 L 280 149 L 279 150 L 279 151 L 277 153 L 277 154 L 272 159 L 271 159 L 269 161 L 268 161 L 265 163 L 263 163 L 262 162 L 262 114 Z M 249 113 L 250 114 L 250 162 L 249 163 L 247 163 L 246 162 L 243 161 L 240 158 L 239 158 L 236 155 L 236 154 L 232 149 L 232 147 L 231 146 L 231 143 L 230 142 L 230 134 L 231 133 L 231 131 L 232 130 L 232 128 L 233 127 L 233 126 L 235 124 L 235 123 L 241 117 L 242 117 L 244 115 L 245 115 L 246 114 L 248 114 Z M 82 191 L 83 190 L 83 186 L 84 185 L 84 182 L 85 181 L 85 178 L 86 177 L 86 174 L 87 173 L 87 169 L 88 168 L 88 165 L 89 164 L 89 161 L 90 160 L 90 158 L 91 157 L 91 154 L 92 153 L 92 150 L 93 149 L 93 146 L 94 145 L 94 143 L 95 142 L 95 139 L 96 138 L 96 136 L 97 135 L 97 132 L 98 131 L 98 129 L 99 128 L 99 125 L 100 124 L 100 122 L 101 121 L 101 119 L 102 118 L 102 115 L 103 114 L 103 112 L 104 111 L 104 109 L 105 108 L 105 106 L 106 105 L 106 103 L 107 102 L 107 100 L 108 99 L 108 97 L 109 96 L 109 94 L 110 93 L 110 91 L 111 90 L 111 88 L 112 87 L 112 85 L 113 84 L 113 82 L 114 81 L 114 80 L 115 79 L 115 78 L 116 77 L 117 74 L 119 72 L 119 71 L 122 68 L 122 67 L 126 63 L 127 63 L 131 59 L 132 59 L 134 57 L 135 57 L 136 56 L 137 56 L 142 53 L 144 53 L 145 52 L 148 52 L 149 51 L 154 51 L 155 50 L 358 50 L 359 51 L 364 51 L 365 52 L 367 52 L 368 53 L 370 53 L 371 54 L 372 54 L 373 55 L 374 55 L 375 56 L 376 56 L 377 57 L 380 58 L 384 62 L 385 62 L 390 67 L 390 68 L 394 72 L 394 73 L 395 74 L 395 75 L 396 76 L 396 77 L 399 82 L 399 84 L 400 85 L 400 87 L 401 88 L 401 90 L 403 93 L 403 95 L 404 96 L 404 98 L 405 99 L 405 102 L 406 103 L 406 105 L 407 106 L 407 108 L 408 109 L 408 111 L 409 112 L 409 114 L 410 115 L 410 117 L 411 118 L 411 121 L 412 122 L 412 124 L 413 125 L 413 127 L 414 128 L 414 131 L 415 132 L 415 134 L 416 135 L 416 138 L 417 139 L 417 141 L 418 142 L 418 145 L 419 146 L 419 149 L 420 150 L 420 152 L 421 153 L 421 156 L 422 157 L 422 160 L 423 161 L 423 164 L 424 165 L 424 168 L 425 169 L 425 172 L 426 173 L 426 176 L 427 177 L 427 181 L 428 182 L 428 185 L 429 186 L 429 189 L 430 190 L 430 192 L 429 193 L 298 193 L 297 192 L 297 187 L 298 186 L 299 186 L 304 181 L 304 180 L 308 176 L 308 175 L 310 173 L 311 170 L 313 168 L 313 167 L 314 166 L 314 164 L 316 161 L 316 159 L 317 158 L 317 156 L 318 155 L 318 152 L 319 151 L 319 146 L 320 145 L 320 132 L 319 131 L 319 125 L 318 124 L 318 121 L 317 120 L 317 118 L 316 117 L 316 115 L 315 114 L 315 113 L 314 112 L 314 111 L 313 110 L 313 109 L 312 108 L 311 105 L 309 103 L 309 102 L 307 100 L 307 99 L 295 87 L 294 87 L 289 83 L 288 83 L 287 82 L 286 82 L 281 79 L 279 79 L 276 77 L 273 77 L 272 76 L 269 76 L 268 75 L 261 75 L 260 74 L 252 74 L 251 75 L 244 75 L 243 76 L 240 76 L 239 77 L 237 77 L 236 78 L 234 78 L 233 79 L 231 79 L 230 80 L 229 80 L 228 81 L 227 81 L 226 82 L 223 83 L 221 85 L 220 85 L 217 88 L 216 88 L 205 99 L 205 100 L 201 105 L 201 106 L 200 107 L 200 108 L 197 113 L 197 115 L 195 118 L 195 121 L 194 122 L 194 125 L 193 126 L 193 131 L 192 132 L 192 144 L 193 145 L 193 151 L 194 152 L 194 155 L 195 156 L 195 158 L 196 159 L 196 161 L 197 162 L 197 163 L 198 164 L 198 165 L 199 166 L 199 167 L 200 168 L 200 169 L 201 170 L 202 173 L 205 176 L 205 177 L 209 181 L 209 182 L 212 185 L 213 185 L 215 187 L 215 192 L 214 193 L 83 193 L 82 192 Z M 339 145 L 338 146 L 336 146 L 335 147 L 332 148 L 326 154 L 326 155 L 324 158 L 324 162 L 323 163 L 323 166 L 324 167 L 324 170 L 325 171 L 325 173 L 327 175 L 327 176 L 331 180 L 332 180 L 334 182 L 336 182 L 337 183 L 341 183 L 342 184 L 343 184 L 344 183 L 348 183 L 349 182 L 351 182 L 352 181 L 353 181 L 359 175 L 359 174 L 361 171 L 361 168 L 362 167 L 362 162 L 361 161 L 361 158 L 360 157 L 359 154 L 357 152 L 357 151 L 356 150 L 355 150 L 353 148 L 352 148 L 349 146 L 347 146 L 346 145 Z M 339 158 L 341 158 L 342 157 L 343 157 L 344 158 L 346 158 L 349 161 L 349 163 L 350 164 L 350 165 L 347 170 L 346 170 L 345 171 L 340 171 L 336 167 L 336 162 L 337 161 L 337 160 Z M 166 145 L 165 146 L 163 146 L 162 147 L 159 148 L 157 150 L 156 150 L 156 151 L 153 154 L 153 155 L 151 158 L 151 161 L 150 162 L 150 166 L 151 167 L 151 171 L 152 172 L 153 175 L 158 180 L 159 180 L 161 182 L 163 182 L 164 183 L 168 183 L 169 184 L 170 184 L 171 183 L 175 183 L 176 182 L 178 182 L 179 181 L 180 181 L 186 175 L 186 174 L 188 171 L 188 168 L 189 167 L 189 162 L 188 161 L 188 158 L 187 157 L 186 154 L 180 148 L 179 148 L 176 146 L 174 146 L 173 145 Z M 166 158 L 168 158 L 169 157 L 170 157 L 171 158 L 173 158 L 176 161 L 176 167 L 172 171 L 167 171 L 163 167 L 163 161 Z M 338 86 L 337 87 L 335 87 L 334 88 L 333 88 L 331 90 L 330 90 L 327 93 L 327 94 L 324 99 L 324 102 L 323 103 L 323 107 L 324 108 L 324 111 L 325 112 L 326 115 L 330 120 L 331 120 L 333 122 L 334 122 L 335 123 L 337 123 L 338 124 L 347 124 L 348 123 L 350 123 L 351 122 L 354 121 L 358 117 L 358 116 L 360 114 L 360 112 L 361 111 L 361 109 L 362 108 L 362 102 L 361 101 L 361 98 L 360 97 L 360 96 L 358 94 L 358 93 L 354 89 L 353 89 L 350 87 L 348 87 L 347 86 Z M 341 98 L 345 98 L 349 102 L 349 103 L 350 104 L 350 105 L 349 106 L 349 108 L 346 111 L 345 111 L 344 112 L 341 112 L 340 111 L 339 111 L 336 108 L 336 102 L 339 99 L 340 99 Z M 165 86 L 164 87 L 162 87 L 161 88 L 158 89 L 154 93 L 154 94 L 152 96 L 152 98 L 151 99 L 151 102 L 150 103 L 150 107 L 151 108 L 151 111 L 152 112 L 152 113 L 153 114 L 154 117 L 157 120 L 158 120 L 160 122 L 161 122 L 162 123 L 164 123 L 165 124 L 174 124 L 175 123 L 177 123 L 178 122 L 179 122 L 181 120 L 182 120 L 185 117 L 185 116 L 188 111 L 188 108 L 189 107 L 189 103 L 188 102 L 188 99 L 187 98 L 187 96 L 185 94 L 185 93 L 182 90 L 181 90 L 179 88 L 178 88 L 177 87 L 175 87 L 174 86 Z M 167 98 L 172 98 L 176 102 L 176 104 L 177 105 L 176 106 L 176 108 L 173 111 L 172 111 L 171 112 L 168 112 L 167 111 L 166 111 L 163 108 L 163 102 Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"/></svg>',
    "equipment:panela-de-pressao":
      '<svg xmlns="http://www.w3.org/2000/svg"     width="512" height="512" viewBox="0 0 512 512"     fill="none">  <title>Ícone vetorial</title>  <path d="M 199 27 L 198 28 L 197 28 L 195 30 L 194 30 L 192 32 L 191 32 L 187 36 L 187 37 L 185 39 L 185 40 L 183 42 L 183 43 L 181 46 L 181 48 L 180 49 L 180 53 L 179 54 L 179 62 L 180 63 L 180 67 L 181 68 L 181 70 L 182 71 L 182 73 L 183 74 L 183 75 L 185 77 L 185 78 L 193 86 L 194 86 L 196 88 L 197 88 L 200 90 L 202 90 L 203 91 L 205 91 L 206 92 L 217 92 L 219 94 L 219 115 L 217 117 L 162 117 L 161 118 L 160 118 L 158 120 L 158 121 L 157 122 L 157 126 L 158 127 L 158 128 L 160 130 L 161 130 L 162 131 L 357 131 L 358 132 L 366 132 L 367 133 L 372 133 L 373 134 L 378 134 L 379 135 L 382 135 L 383 136 L 387 136 L 388 137 L 391 137 L 392 138 L 394 138 L 395 139 L 398 139 L 399 140 L 401 140 L 402 141 L 404 141 L 407 143 L 409 143 L 410 144 L 412 144 L 415 146 L 417 146 L 418 147 L 419 147 L 420 148 L 421 148 L 426 151 L 428 151 L 430 153 L 431 153 L 432 154 L 431 155 L 80 155 L 79 154 L 80 153 L 81 153 L 82 152 L 83 152 L 84 151 L 85 151 L 86 150 L 87 150 L 88 149 L 89 149 L 94 146 L 96 146 L 99 144 L 101 144 L 102 143 L 104 143 L 107 141 L 110 141 L 113 139 L 116 139 L 117 138 L 119 138 L 120 137 L 123 137 L 124 136 L 128 136 L 129 135 L 133 135 L 134 134 L 137 134 L 141 130 L 141 124 L 138 121 L 137 121 L 136 120 L 132 120 L 131 121 L 127 121 L 126 122 L 123 122 L 122 123 L 119 123 L 118 124 L 115 124 L 114 125 L 111 125 L 110 126 L 108 126 L 107 127 L 105 127 L 104 128 L 102 128 L 101 129 L 99 129 L 98 130 L 96 130 L 93 132 L 91 132 L 86 135 L 84 135 L 83 136 L 82 136 L 81 137 L 80 137 L 79 138 L 78 138 L 77 139 L 76 139 L 75 140 L 74 140 L 73 141 L 72 141 L 71 142 L 68 143 L 66 145 L 63 146 L 61 148 L 58 149 L 56 151 L 53 152 L 51 154 L 50 154 L 49 155 L 45 155 L 44 156 L 42 156 L 41 157 L 40 157 L 38 159 L 37 159 L 31 165 L 31 166 L 28 171 L 28 173 L 27 174 L 27 184 L 28 185 L 28 187 L 29 188 L 29 189 L 30 190 L 31 193 L 37 199 L 38 199 L 40 201 L 42 201 L 43 202 L 45 202 L 46 203 L 53 203 L 54 204 L 54 231 L 53 232 L 34 232 L 33 233 L 26 233 L 25 234 L 23 234 L 22 235 L 20 235 L 19 236 L 18 236 L 16 238 L 15 238 L 13 240 L 12 240 L 8 244 L 8 245 L 5 248 L 5 249 L 2 254 L 2 256 L 1 257 L 1 260 L 0 261 L 0 272 L 1 273 L 1 276 L 2 277 L 2 279 L 3 280 L 3 281 L 4 282 L 5 285 L 8 288 L 8 289 L 15 295 L 16 295 L 17 296 L 18 296 L 23 299 L 26 299 L 27 300 L 53 300 L 54 301 L 54 416 L 55 417 L 55 423 L 56 424 L 56 427 L 57 428 L 57 431 L 58 432 L 58 434 L 60 437 L 60 439 L 61 440 L 61 441 L 62 442 L 62 443 L 63 444 L 64 447 L 66 449 L 67 452 L 70 455 L 70 456 L 75 461 L 75 462 L 78 465 L 79 465 L 85 471 L 86 471 L 88 473 L 89 473 L 91 475 L 94 476 L 96 478 L 97 478 L 98 479 L 100 479 L 105 482 L 107 482 L 108 483 L 110 483 L 111 484 L 114 484 L 115 485 L 119 485 L 120 486 L 128 486 L 129 487 L 379 487 L 380 486 L 383 485 L 383 484 L 385 482 L 385 478 L 384 477 L 384 476 L 381 473 L 130 473 L 129 472 L 121 472 L 120 471 L 117 471 L 116 470 L 114 470 L 113 469 L 111 469 L 110 468 L 108 468 L 107 467 L 106 467 L 105 466 L 104 466 L 103 465 L 100 464 L 98 462 L 97 462 L 94 459 L 93 459 L 81 447 L 81 446 L 77 441 L 77 440 L 76 439 L 76 438 L 75 437 L 75 436 L 72 431 L 72 429 L 71 428 L 71 426 L 70 425 L 70 422 L 69 421 L 69 416 L 68 415 L 68 301 L 69 300 L 114 300 L 115 299 L 118 299 L 119 298 L 120 298 L 121 297 L 122 297 L 123 296 L 126 295 L 135 286 L 135 285 L 136 284 L 136 283 L 139 278 L 139 276 L 140 275 L 140 271 L 141 270 L 141 263 L 140 262 L 140 258 L 139 257 L 139 255 L 138 254 L 138 253 L 137 252 L 137 250 L 135 248 L 135 247 L 131 243 L 131 242 L 130 242 L 126 238 L 125 238 L 124 237 L 123 237 L 118 234 L 115 234 L 114 233 L 108 233 L 107 232 L 69 232 L 68 231 L 68 204 L 69 203 L 442 203 L 443 204 L 443 415 L 442 416 L 442 421 L 441 422 L 441 425 L 440 426 L 440 428 L 439 429 L 439 431 L 438 432 L 438 433 L 437 434 L 437 435 L 436 436 L 436 437 L 435 438 L 434 441 L 432 443 L 432 444 L 430 446 L 430 447 L 417 460 L 416 460 L 411 464 L 410 464 L 409 465 L 408 465 L 407 466 L 404 467 L 401 470 L 401 471 L 400 472 L 400 475 L 401 476 L 401 477 L 404 480 L 410 480 L 411 479 L 413 479 L 414 478 L 415 478 L 417 476 L 420 475 L 425 471 L 426 471 L 432 465 L 433 465 L 435 463 L 435 462 L 441 456 L 441 455 L 443 453 L 443 452 L 447 447 L 447 446 L 448 445 L 448 444 L 451 439 L 451 437 L 452 436 L 452 434 L 454 431 L 454 428 L 455 427 L 455 423 L 456 422 L 456 417 L 457 416 L 457 301 L 458 300 L 484 300 L 485 299 L 488 299 L 489 298 L 490 298 L 491 297 L 492 297 L 493 296 L 496 295 L 499 292 L 500 292 L 506 285 L 506 284 L 509 279 L 509 277 L 510 276 L 510 273 L 511 272 L 511 261 L 510 260 L 510 257 L 509 256 L 509 254 L 508 253 L 508 252 L 507 251 L 506 248 L 503 245 L 503 244 L 499 240 L 498 240 L 493 236 L 492 236 L 491 235 L 489 235 L 488 234 L 486 234 L 485 233 L 478 233 L 477 232 L 458 232 L 457 231 L 457 204 L 458 203 L 465 203 L 466 202 L 468 202 L 469 201 L 471 201 L 473 199 L 474 199 L 480 193 L 480 192 L 483 187 L 483 184 L 484 183 L 484 174 L 483 173 L 483 171 L 482 170 L 482 169 L 481 168 L 480 165 L 474 159 L 473 159 L 471 157 L 470 157 L 469 156 L 467 156 L 466 155 L 462 155 L 461 154 L 460 154 L 458 152 L 457 152 L 455 150 L 454 150 L 453 149 L 450 148 L 448 146 L 445 145 L 443 143 L 442 143 L 441 142 L 440 142 L 439 141 L 438 141 L 437 140 L 436 140 L 435 139 L 434 139 L 433 138 L 432 138 L 427 135 L 425 135 L 420 132 L 418 132 L 415 130 L 413 130 L 412 129 L 410 129 L 409 128 L 407 128 L 406 127 L 404 127 L 403 126 L 401 126 L 400 125 L 397 125 L 396 124 L 393 124 L 392 123 L 389 123 L 388 122 L 385 122 L 384 121 L 380 121 L 379 120 L 374 120 L 373 119 L 368 119 L 367 118 L 358 118 L 357 117 L 282 117 L 280 115 L 280 94 L 282 92 L 293 92 L 294 91 L 296 91 L 297 90 L 299 90 L 300 89 L 301 89 L 302 88 L 305 87 L 314 78 L 314 77 L 316 75 L 316 74 L 317 73 L 317 71 L 318 70 L 318 68 L 319 67 L 319 64 L 320 63 L 320 54 L 319 53 L 319 49 L 318 48 L 318 46 L 317 45 L 317 44 L 316 43 L 315 40 L 312 37 L 312 36 L 308 32 L 307 32 L 304 29 L 303 29 L 300 27 L 298 27 L 297 26 L 295 26 L 294 25 L 289 25 L 288 24 L 211 24 L 210 25 L 205 25 L 204 26 L 202 26 L 201 27 Z M 457 247 L 458 246 L 477 246 L 478 247 L 483 247 L 484 248 L 487 249 L 489 251 L 490 251 L 492 253 L 492 254 L 495 257 L 495 258 L 496 259 L 496 262 L 497 263 L 497 270 L 496 271 L 496 273 L 495 274 L 494 277 L 487 284 L 486 284 L 485 285 L 483 285 L 482 286 L 458 286 L 457 285 Z M 14 263 L 15 262 L 15 259 L 16 258 L 16 257 L 19 254 L 19 253 L 20 252 L 21 252 L 24 249 L 25 249 L 28 247 L 33 247 L 34 246 L 107 246 L 108 247 L 112 247 L 113 248 L 115 248 L 116 249 L 117 249 L 124 256 L 124 257 L 126 260 L 126 263 L 127 264 L 127 269 L 126 270 L 126 273 L 125 274 L 124 277 L 118 283 L 117 283 L 115 285 L 113 285 L 112 286 L 29 286 L 28 285 L 26 285 L 25 284 L 24 284 L 17 277 L 17 276 L 15 273 L 15 271 L 14 270 Z M 41 176 L 42 175 L 42 174 L 46 170 L 47 170 L 48 169 L 463 169 L 464 170 L 465 170 L 469 174 L 469 175 L 470 176 L 470 181 L 469 182 L 469 184 L 465 188 L 464 188 L 463 189 L 48 189 L 47 188 L 46 188 L 42 184 L 42 182 L 41 181 Z M 233 93 L 234 92 L 265 92 L 266 93 L 266 116 L 265 117 L 234 117 L 233 116 Z M 193 55 L 194 54 L 194 52 L 195 51 L 196 48 L 203 41 L 204 41 L 207 39 L 210 39 L 211 38 L 288 38 L 289 39 L 292 39 L 293 40 L 296 41 L 301 45 L 301 46 L 303 48 L 303 49 L 305 52 L 305 54 L 306 55 L 306 62 L 305 63 L 305 65 L 304 66 L 303 69 L 297 75 L 296 75 L 294 77 L 292 77 L 291 78 L 208 78 L 207 77 L 205 77 L 203 75 L 202 75 L 196 69 L 196 68 L 194 65 L 194 62 L 193 61 Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"/></svg>',
  };
  // Todos os 9 valores de Equipamento agora são SVG embutido (nenhum PNG restante — os 3
  // últimos, air-fryer/panela-de-pressao/churrasqueira, eram Icons8 com filter:invert(1) como
  // aproximação; substituídos por SVG real autoral, mesmo padrão dos outros 6). O fallback ""
  // abaixo fica só como rede de segurança pra um futuro valor de equipamento sem ícone ainda
  // mapeado.
  function equipmentTileIconHtml(tagId) {
    if (EQUIPMENT_SVG_MARKUP[tagId]) {
      return '<span class="filter-tile__icon filter-tile__icon--svg" aria-hidden="true">' + EQUIPMENT_SVG_MARKUP[tagId] + "</span>";
    }
    return ""; // sem ícone disponível — sem espaço reservado
  }

  // S5 (motor unificado, consolidação): matchesTagId/matchesGroupedTags deixaram de ter cópia
  // local aqui — eram idênticas byte a byte a TagModel.matchesTagId/TagModel.matchesGroupedTags
  // (js/tagmodel.js:433-457), com risco de deriva silenciosa entre as 2 cópias (o comentário
  // original de tagmodel.js já admitia isso). Todos os call sites abaixo passaram a chamar
  // TagModel.matchesTagId/TagModel.matchesGroupedTags diretamente. Faceta Proteína: "protein:X"
  // significa "essa proteína está presente" (protagonista OU não) — casa também se a receita só
  // tiver "contains:X" (ver TagModel.matchesTagId). Não confundir com "Papel da proteína"
  // (splitByProteinRole/activeProteinTagIds, focus/secondary) — mecanismo separado, não tocado aqui.

  // Lê o estado dos dropdowns a partir de um array plano de tag ids (selectedFacetTags ou
  // tagIds) — facetas multi viram array, as demais pegam o primeiro tag do seu prefixo.
  function readFacetStateFromTags(tagIds, defs) {
    const state = {};
    defs.forEach((def) => {
      if (def.multi) {
        state[def.key] = tagIds.filter((t) => t.indexOf(def.prefix) === 0);
      } else {
        state[def.key] = tagIds.find((t) => t.indexOf(def.prefix) === 0) || null;
      }
    });
    return state;
  }

  // Caminho inverso — usado pra reconstruir o array plano depois que o usuário troca uma faceta.
  function facetStateToTagIds(facetState, defs) {
    const out = [];
    defs.forEach((def) => {
      if (def.multi) out.push.apply(out, facetState[def.key] || []);
      else if (facetState[def.key]) out.push(facetState[def.key]);
    });
    return out;
  }

  function facetOptionsFromPrefix(items, prefix) {
    const counts = {};
    items.forEach((item) => {
      // Dedupe por item: uma receita com protein:X E contains:X (redundante, não deveria
      // acontecer mas não é garantido pelo schema) só conta 1x pro mesmo valor de X.
      const countedForThisItem = new Set();
      item.tags.forEach((tagId) => {
        let countTagId = null;
        if (tagId.indexOf(prefix) === 0) {
          countTagId = tagId;
        } else if (prefix === "protein:" && tagId.indexOf("contains:") === 0) {
          // Mesma regra de matchesTagId, do lado da contagem: contains:X conta como protein:X
          // pra faceta Proteína, DESDE QUE protein:X exista de verdade na taxonomia (senão
          // ignora — nem todo contains: tem um valor de proteína correspondente).
          const candidate = "protein:" + tagId.slice("contains:".length);
          if (TagModel.getTagById(candidate)) countTagId = candidate;
        }
        if (!countTagId || countedForThisItem.has(countTagId)) return;
        const tag = TagModel.getTagById(countTagId);
        // alho/cebola (lowPriority): fora do dropdown em destaque, continuam buscáveis por texto.
        if (!tag || tag.lowPriority) return;
        countedForThisItem.add(countTagId);
        counts[countTagId] = (counts[countTagId] || 0) + 1;
      });
    });
    return Object.keys(counts)
      .map((tagId) => ({ tagId: tagId, tag: TagModel.getTagById(tagId), count: counts[tagId] }))
      .sort((a, b) => b.count - a.count);
  }

  function facetOptionsFromStatic(items, staticOptions) {
    return staticOptions
      .map((opt) => {
        const count = items.filter((item) => item.tags.indexOf(opt.tagId) !== -1).length;
        return { tagId: opt.tagId, tag: { label: opt.label }, count: count };
      })
      .filter((o) => o.count > 0);
  }

  // Calcula as opções (com contagem) de UMA faceta, restringindo o universo pelas OUTRAS
  // facetas já selecionadas (cross-facet AND) — extraído da antiga renderFacetBar sem mudar a
  // lógica, só pra ser reaproveitado pelo acordeão do modal (Bloco 3). ingredientMode: quando
  // as OUTRAS facetas incluem 2+ ingredientes (ex.: calculando contagem de País com Ingrediente
  // já selecionado), precisa saber se esses ingredientes combinam em "and" ou "or" entre si —
  // sem isso, a contagem mostrada ficaria sempre no modo AND, ignorando o toggle "Qualquer um
  // destes"/"Todos estes" (ver renderIngredientTileSectionBody).
  function computeFacetOptions(universeItems, facetState, defs, def, ingredientMode) {
    const otherTagIds = [];
    defs.forEach((d) => {
      if (d.key === def.key) return;
      if (d.multi) otherTagIds.push.apply(otherTagIds, facetState[d.key] || []);
      else if (facetState[d.key]) otherTagIds.push(facetState[d.key]);
    });
    const restricted = universeItems.filter((item) => TagModel.matchesGroupedTags(item.tags, otherTagIds, ingredientMode));
    return def.prefix ? facetOptionsFromPrefix(restricted, def.prefix) : facetOptionsFromStatic(restricted, def.staticOptions);
  }

  // ---------- Modal de filtros em acordeão (Bloco 3 — design tokens v3) ----------
  // Substitui a antiga barra de dropdowns sempre-visível por um botão "Filtros" (com badge) que
  // abre um modal cheio de tela. A CARDINALIDADE e a LÓGICA de cada faceta não mudam — só onde
  // moram na tela: matchesGroupedTags, facetOptionsFromPrefix/Static, readFacetStateFromTags,
  // facetStateToTagIds continuam intocadas, só reaproveitadas.
  // Mudanças dentro do modal ficam em RASCUNHO (draftFacetState/draftProteinRole) — só se
  // aplicam de fato ao clicar "Ver resultados"; "Cancelar" descarta o rascunho sem tocar no
  // estado real. "Limpar filtros" zera só o RASCUNHO (todas as seções voltam a "Todos"/nenhuma
  // selecionada, rodapé recalcula pra contagem sem filtro) e MANTÉM o modal aberto — não
  // aplica nem fecha sozinho, o usuário ainda confirma em "Ver resultados" ou desiste em
  // "Cancelar".
  //
  // triggerWrapEl: onde o botão "Filtros" + badge é renderizado (era o antigo facetBarEl).
  // defs: GENERIC_FACET_DEFS.
  // opts:
  //   facetState: estado ATUAL aplicado (só é mutado quando o rascunho é confirmado).
  //   getUniverse(draftProteinRoleValue): universo de receitas pra calcular opções/contagens —
  //     cada caller já tem essa conta pronta, só reaproveita (não recalcula nada novo).
  //   proteinRole: null OU { value, setValue(v), computeCounts(draftFacetState,
  //     draftIngredientMode) -> {focus, secondary} } — só passado por renderCategory em
  //     coleções de proteína.
  //   ingredientMode: { value: "and"|"or", setValue(v) } — modo de combinação da faceta
  //     Ingrediente (toggle Qualquer um/Todos estes, só aparece com 2+ selecionados, ver
  //     renderIngredientTileSectionBody). "or" é o default. Sempre passado (todo caller tem
  //     a faceta Ingrediente em GENERIC_FACET_DEFS).
  //   countForDraft(draftFacetState, draftProteinRoleValue, draftIngredientMode): quantas
  //     receitas o resultado teria se esse rascunho fosse aplicado agora (mesma conta de
  //     currentItems()/facetUniverse()).
  //   onApply(): chamado DEPOIS que facetState/proteinRole/ingredientMode já foram escritos
  //     com o rascunho — é o mesmo corpo que cada dropdown antigo já disparava no onChange, só
  //     que uma vez só.
  function renderFacetModal(triggerWrapEl, defs, opts) {
    const activeCount =
      defs.reduce((n, d) => n + (d.multi ? (opts.facetState[d.key] || []).length : opts.facetState[d.key] ? 1 : 0), 0) +
      (opts.proteinRole && opts.proteinRole.value ? 1 : 0);

    triggerWrapEl.innerHTML =
      '<button type="button" class="filter-trigger">' +
      iconSvg("filter", "filter-trigger__icon") +
      "<span>Filtros</span>" +
      (activeCount ? '<span class="filter-trigger__badge">' + activeCount + "</span>" : "") +
      "</button>";
    triggerWrapEl.querySelector(".filter-trigger").addEventListener("click", openModal);

    function openModal() {
      // Rascunho: cópia independente do estado aplicado — Cancelar descarta sem tocar no real.
      const draftFacetState = {};
      defs.forEach((d) => {
        draftFacetState[d.key] = d.multi ? (opts.facetState[d.key] || []).slice() : opts.facetState[d.key];
      });
      let draftProteinRole = opts.proteinRole ? opts.proteinRole.value : null;
      // "or" é o default (Qualquer um destes) — sem opts.ingredientMode (facetas sem essa
      // faceta, ex. proteína não tem Ingrediente aqui) o valor nunca é lido de verdade.
      let draftIngredientMode = opts.ingredientMode ? opts.ingredientMode.value || "or" : "or";
      let openSectionKey = null;

      const overlay = document.createElement("div");
      overlay.className = "filter-modal-overlay";
      overlay.innerHTML =
        '<div class="filter-modal" role="dialog" aria-modal="true" aria-label="Filtros">' +
        '<div class="filter-modal__header">' +
        '<button type="button" class="filter-modal__cancel">Cancelar</button>' +
        "<h3>Filtros</h3>" +
        '<span class="filter-modal__header-spacer" aria-hidden="true"></span>' +
        "</div>" +
        '<div class="filter-modal__body"></div>' +
        '<div class="filter-modal__footer"><div class="filter-modal__clear-row"></div><button type="button" class="filter-modal__apply"></button></div>' +
        "</div>";
      document.body.appendChild(overlay);
      document.body.classList.add("filter-modal-open");

      const clearRowEl = overlay.querySelector(".filter-modal__clear-row");
      const bodyEl = overlay.querySelector(".filter-modal__body");
      const applyBtn = overlay.querySelector(".filter-modal__apply");

      function closeModal() {
        // Saída simétrica à entrada (apple-design skill) — antes era overlay.remove() direto
        // (sem animação nenhuma); agora espelha a animação de entrada (220ms) via
        // .filter-modal--closing (CSS) e só remove o overlay depois dela terminar.
        // pointerEvents:none bloqueia cliques repetidos (Cancelar 2x, backdrop) durante a saída.
        overlay.style.pointerEvents = "none";
        overlay.querySelector(".filter-modal").classList.add("filter-modal--closing");
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.setTimeout(() => {
          overlay.remove();
          document.body.classList.remove("filter-modal-open");
          if (closeActiveFilterModal === closeModal) closeActiveFilterModal = null;
        }, reducedMotion ? 200 : 220);
      }
      closeActiveFilterModal = closeModal;
      overlay.querySelector(".filter-modal__cancel").addEventListener("click", closeModal);
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeModal();
      });

      function draftIsActive() {
        return defs.some((d) => (d.multi ? (draftFacetState[d.key] || []).length : draftFacetState[d.key])) || !!draftProteinRole;
      }

      // Limpar filtros só zera o RASCUNHO e mantém o modal aberto (todas as seções colapsadas)
      // — o usuário ainda precisa confirmar em "Ver resultados" ou desistir em "Cancelar",
      // igual a qualquer outra mudança de faceta. Não aplica nada sozinho.
      function renderClearRow() {
        if (!draftIsActive()) {
          clearRowEl.innerHTML = "";
          return;
        }
        clearRowEl.innerHTML = '<button type="button" class="btn-clear-filters">Limpar filtros</button>';
        clearRowEl.querySelector(".btn-clear-filters").addEventListener("click", () => {
          defs.forEach((d) => {
            draftFacetState[d.key] = d.multi ? [] : null;
          });
          draftProteinRole = null;
          draftIngredientMode = "or";
          openSectionKey = null;
          renderBody();
        });
      }

      function renderFooter() {
        const n = opts.countForDraft(draftFacetState, draftProteinRole, draftIngredientMode);
        applyBtn.textContent = "Ver resultados (" + n + ")";
      }
      applyBtn.addEventListener("click", () => {
        defs.forEach((d) => {
          opts.facetState[d.key] = draftFacetState[d.key];
        });
        if (opts.proteinRole) opts.proteinRole.setValue(draftProteinRole);
        if (opts.ingredientMode) opts.ingredientMode.setValue(draftIngredientMode);
        closeModal();
        opts.onApply();
      });

      function toggleSection(key) {
        openSectionKey = openSectionKey === key ? null : key;
        renderBody();
      }

      function sectionSummary(def) {
        if (def.multi) {
          const n = (draftFacetState[def.key] || []).length;
          return n ? n + " selecionado" + (n === 1 ? "" : "s") : "";
        }
        if (!draftFacetState[def.key]) return "";
        const tag = TagModel.getTagById(draftFacetState[def.key]);
        return tag ? tag.label : "";
      }

      function renderSingleSectionBody(sectionBody, def, options) {
        const currentVal = draftFacetState[def.key] || "";
        let html =
          '<label class="filter-option"><input type="radio" name="filter-' +
          def.key +
          '"' +
          (!currentVal ? " checked" : "") +
          "><span>" +
          (def.allLabel || "Todos") +
          "</span></label>";
        options.forEach((o) => {
          html +=
            '<label class="filter-option"><input type="radio" name="filter-' +
            def.key +
            '" value="' +
            o.tagId +
            '"' +
            (o.tagId === currentVal ? " checked" : "") +
            "><span>" +
            o.tag.label +
            " (" +
            o.count +
            ")</span></label>";
        });
        sectionBody.innerHTML = html;
        sectionBody.querySelectorAll('input[type="radio"]').forEach((input) => {
          input.addEventListener("change", () => {
            draftFacetState[def.key] = input.value || null;
            renderBody();
          });
        });
      }

      function renderMultiSectionBody(sectionBody, def, options) {
        const selectedIds = draftFacetState[def.key] || [];
        const addableOptions = options.filter((o) => selectedIds.indexOf(o.tagId) === -1);
        const chipsHtml = selectedIds
          .map((tagId) => {
            const tag = TagModel.getTagById(tagId);
            return (
              '<button type="button" class="tag-chip tag-chip--selected" data-remove="' +
              tagId +
              '">' +
              (tag ? tag.label : tagId) +
              ' <span aria-hidden="true">×</span></button>'
            );
          })
          .join("");
        sectionBody.innerHTML =
          (chipsHtml ? '<div class="facet-multi-chips">' + chipsHtml + "</div>" : "") +
          (addableOptions.length
            ? '<select><option value="">+ Adicionar ' +
              def.label.toLowerCase() +
              "</option>" +
              addableOptions.map((o) => '<option value="' + o.tagId + '">' + o.tag.label + " (" + o.count + ")</option>").join("") +
              "</select>"
            : "");
        sectionBody.querySelectorAll("[data-remove]").forEach((btn) => {
          btn.addEventListener("click", () => {
            draftFacetState[def.key] = selectedIds.filter((id) => id !== btn.dataset.remove);
            renderBody();
          });
        });
        const select = sectionBody.querySelector("select");
        if (select) {
          select.addEventListener("change", () => {
            if (!select.value) return;
            draftFacetState[def.key] = selectedIds.concat([select.value]);
            renderBody();
          });
        }
      }

      // Piloto de redesenho visual — só Ingrediente (def.layout === "ingredient-tiles").
      // Chips removíveis dos selecionados continuam IDÊNTICOS a renderMultiSectionBody; só o
      // <select> de "+ adicionar" vira uma grade de tiles mais densa (mais colunas, tiles
      // menores que País/Equipamento — classe filter-tile-grid--dense/filter-tile--dense) pra
      // caber ~30-40 valores confortavelmente em 360-430px. Clicar num tile addable adiciona à
      // seleção (equivalente a escolher no <select> antigo); não existe estado "is-selected"
      // aqui, porque um valor selecionado sai da grade e vira chip — nunca aparece nos dois
      // lugares ao mesmo tempo.
      // Toggle Qualquer um/Todos estes: trilho único com trava deslizante (não 2 botões
      // separados) — ANTES dos chips selecionados, logo abaixo do cabeçalho do acordeão. Só
      // existe (nem desabilitado, REMOVIDO do DOM) com 2+ ingredientes selecionados, já que com
      // 0/1 não há o que combinar. Desde a rodada de 2026-07-28 usa o componente compartilhado
      // segmentedToggleHtml/wireSegmentedToggle (mesmo trilho do sub-controle de Papel da
      // proteína, N=2 aqui) — a trava cobre 1/N da largura do trilho e desliza via
      // transform:translateX (custom properties CSS --seg-count/--seg-index, não mais uma
      // classe modificadora booleana). Substitui a antiga rede de segurança reativa (botão só
      // aparecia depois de um AND zerar) — agora a escolha é proativa e sempre visível quando
      // faz sentido, então esse fallback foi removido de renderList/renderResults.
      function renderIngredientTileSectionBody(sectionBody, def, options) {
        const selectedIds = draftFacetState[def.key] || [];
        const addableOptions = options.filter((o) => selectedIds.indexOf(o.tagId) === -1);
        // Trilho deslizante (rodada 2026-07-28) — mesmo componente compartilhado do sub-controle
        // de Papel da proteína (N=3), aqui com N=2. "or" é o default (Qualquer um destes).
        const modeOptions = [
          { value: "or", label: "Qualquer um destes" },
          { value: "and", label: "Todos estes" },
        ];
        const modeToggleHtml = selectedIds.length >= 2 ? segmentedToggleHtml("Como combinar os ingredientes selecionados", modeOptions, draftIngredientMode === "and" ? 1 : 0) : "";
        const chipsHtml = selectedIds
          .map((tagId) => {
            const tag = TagModel.getTagById(tagId);
            return (
              '<button type="button" class="tag-chip tag-chip--selected" data-remove="' +
              tagId +
              '">' +
              (tag ? tag.label : tagId) +
              ' <span aria-hidden="true">×</span></button>'
            );
          })
          .join("");
        sectionBody.innerHTML =
          modeToggleHtml +
          (chipsHtml ? '<div class="facet-multi-chips">' + chipsHtml + "</div>" : "") +
          (addableOptions.length
            ? '<div class="filter-tile-grid filter-tile-grid--dense">' +
              addableOptions
                .map(
                  (o) =>
                    '<button type="button" class="filter-tile filter-tile--dense" data-value="' +
                    o.tagId +
                    '">' +
                    '<span class="filter-tile__label">' +
                    o.tag.label +
                    '</span><span class="filter-tile__count">' +
                    o.count +
                    "</span></button>"
                )
                .join("") +
              "</div>"
            : "");
        sectionBody.querySelectorAll("[data-remove]").forEach((btn) => {
          btn.addEventListener("click", () => {
            draftFacetState[def.key] = selectedIds.filter((id) => id !== btn.dataset.remove);
            renderBody();
          });
        });
        const modeToggleEl = sectionBody.querySelector(".segmented-toggle");
        if (modeToggleEl) {
          // wireSegmentedToggle cuida do resto (mesmo cuidado de sempre: só troca classe/aria na
          // hora, adia o renderBody() completo pra depois que a mola realmente terminar —
          // renderBody() destruiria e recriaria o nó no meio da transição, sem o MESMO elemento
          // antes/depois a transition CSS não tem o que animar).
          wireSegmentedToggle(
            modeToggleEl,
            (index) => {
              draftIngredientMode = modeOptions[index].value;
              renderFooter();
            },
            () => renderBody()
          );
        }
        sectionBody.querySelectorAll(".filter-tile--dense").forEach((btn) => {
          btn.addEventListener("click", () => {
            draftFacetState[def.key] = selectedIds.concat([btn.dataset.value]);
            renderBody();
          });
        });
      }

      // Complexidade/Tempo/Tipo de prato/Proteína/Refeição (combineMode "or", sem layout
      // plugado): grade de CHIPS — pill com borda --color-border quando livre, preenchida
      // --color-accent-deep/texto --color-text-primary quando marcada (par já calibrado a
      // 4,52:1 na Fase 0a, reaproveitado sem recalcular). Fase F1a (2026-07-27): substitui
      // tanto a antiga lista de checkbox (Complexidade/Tempo/Tipo de prato) quanto o antigo
      // tile-sem-ícone (Proteína/Refeição — ver comentário de GENERIC_FACET_DEFS sobre por que
      // essas duas não eram classe 1 de verdade). Valores da MESMA faceta se somam em união —
      // nunca zera ao adicionar mais um, então não precisa de nenhum fallback (diferente de
      // Ingrediente). SEM item "Todos": nenhum chip marcado = nenhum filtro ativo, mesma
      // convenção que os tiles de País/Equipamento/Ingrediente já usavam — harmoniza as duas
      // famílias em vez de manter uma regra "Todos" só pras facetas ex-checkbox. A contagem de
      // cada opção reaproveita computeFacetOptions/facetOptionsFromPrefix sem mudança nenhuma.
      // <button type="button"> nativo (não <div>/<label>) — foco e Enter/Espaço funcionam sem
      // handler de teclado próprio, mesmo princípio de todo controle tocável deste app.
      // role="checkbox" + aria-checked preservam a semântica de multi-seleção que os antigos
      // checkboxes nativos davam de graça ao leitor de tela.
      // Papel da proteína (Fase F1a: segmentado de 3 pílulas) — item 1b desta rodada
      // (2026-07-28): a seção própria morreu, vira sub-controle no TOPO do corpo de Proteína,
      // mesmo padrão do toggle Qualquer um/Todos estes de Ingrediente (sub-controle acima do
      // conteúdo principal da seção) — só que com rótulo visível próprio
      // (.filter-subcontrol-label "Papel da proteína"), que aquele toggle não tem. Só existe
      // quando opts.proteinRole existe (mesmo gate de sempre: collection.collectionType ===
      // "protein" && baseRelated.length > 0, calculado em renderCategory como isProteinRole, não
      // tocado por esta rodada — só a apresentação mudou). Mecanismo/contagens
      // (getRecipesByCollection/matchesAnyTag em tagmodel.js, opts.proteinRole.computeCounts)
      // continuam intocados.
      function renderChipSectionBody(sectionBody, def, options) {
        const selectedIds = draftFacetState[def.key] || [];
        const isProteinFacet = def.key === "protein" && opts.proteinRole;
        let roleHtml = "";
        // roleOptions também é lido pela fiação mais abaixo (wireSegmentedToggle) — precisa
        // ficar no escopo da função, não só dentro do "if" de construção do HTML.
        let roleOptions = null;
        if (isProteinFacet) {
          // Correção de semântica (2026-07-29): visibilidade DINÂMICA, RE-AVALIADA a cada
          // render (não fixada 1x na abertura do modal, como antes) — activeProteinTagIds dá
          // prioridade ao que está explicitamente selecionado (draftFacetState.protein, este
          // mesmo selectedIds) e só cai pro implícito de opts.collection (null em busca) se
          // nada foi selecionado.
          const roleActive = activeProteinTagIds(draftFacetState, opts.collection).length > 0;
          const counts = opts.proteinRole.computeCounts(draftFacetState, draftIngredientMode);
          roleOptions = [
            { value: "", label: "Ver tudo" },
            { value: "focus", label: "Principal (" + counts.focus + ")" },
            { value: "secondary", label: "Secundário (" + counts.secondary + ")" },
          ];
          const selectedIndex = draftProteinRole === "focus" ? 1 : draftProteinRole === "secondary" ? 2 : 0;
          // .protein-role-wrap SEMPRE presente no DOM quando a faceta é Proteína — .is-visible
          // (CSS) controla aparecer/sumir com transição curta (max-height/opacity/visibility,
          // tokens de motion já existentes) em vez de um hard show/hide via inclusão
          // condicional no innerHTML (que não deixaria nada pra animar).
          roleHtml =
            '<div class="protein-role-wrap' +
            (roleActive ? " is-visible" : "") +
            '"' +
            (roleActive ? "" : ' aria-hidden="true"') +
            ">" +
            '<div class="filter-subcontrol-label">Papel da proteína</div>' +
            segmentedToggleHtml("Papel da proteína", roleOptions, selectedIndex) +
            "</div>";
        }
        sectionBody.innerHTML =
          roleHtml +
          '<div class="filter-chip-row" role="group" aria-label="' +
          def.label +
          '">' +
          options
            .map((o) => {
              const selected = selectedIds.indexOf(o.tagId) !== -1;
              return (
                '<button type="button" class="filter-chip' +
                (selected ? " is-selected" : "") +
                '" role="checkbox" aria-checked="' +
                (selected ? "true" : "false") +
                '" data-value="' +
                o.tagId +
                '">' +
                o.tag.label +
                " (" +
                o.count +
                ")</button>"
              );
            })
            .join("") +
          "</div>";
        sectionBody.querySelectorAll(".filter-chip-row .filter-chip").forEach((btn) => {
          btn.addEventListener("click", () => {
            const val = btn.dataset.value;
            const current = draftFacetState[def.key] || [];
            draftFacetState[def.key] = current.indexOf(val) !== -1 ? current.filter((id) => id !== val) : current.concat([val]);
            // Reset (item 2 da correção de semântica, 2026-07-29): se esta faceta é Proteína e,
            // depois da mudança, não sobrou NENHUMA proteína ativa (nem explícita nem implícita
            // da coleção), o papel nunca fica "fantasma" sem proteína nenhuma — zera pra Tanto
            // faz. Só dispara de verdade fora de coleção de proteína (dentro dela sempre sobra
            // o implícito, ver activeProteinTagIds).
            if (def.key === "protein" && activeProteinTagIds(draftFacetState, opts.collection).length === 0) {
              draftProteinRole = null;
            }
            renderBody();
          });
        });
        if (isProteinFacet) {
          const roleToggleEl = sectionBody.querySelector(".segmented-toggle");
          wireSegmentedToggle(
            roleToggleEl,
            (index) => {
              draftProteinRole = roleOptions[index].value || null;
              renderFooter();
            },
            () => renderBody()
          );
        }
      }

      // Tile de País (item 6 do roadmap-mestre) — bandeira imagens/bandeiras/<iso2>.webp
      // cobrindo o bloco + faixa sólida com o nome por baixo (mesma regra-mãe do tile de
      // categoria: texto nunca senta em imagem). countryTileIconHtml e o emoji de bandeira
      // morreram — window.COUNTRIES (js/countries.js) continua a fonte única do iso2, só o
      // consumo mudou de emoji pra arquivo. Layout próprio ("photo-tiles"), não reaproveita
      // renderTileSectionBody logo abaixo (ícone+label+contagem empilhados, ainda usado por
      // Equipamento): a estrutura muda de verdade. Precisa viver AQUI DENTRO de openModal()
      // (não no escopo de módulo, onde countryTileIconHtml vivia) porque usa
      // draftFacetState/renderBody, que só existem neste closure.
      function renderCountryTileSectionBody(sectionBody, def, options) {
        const selectedIds = draftFacetState[def.key] || [];
        sectionBody.innerHTML =
          '<div class="filter-tile-grid">' +
          options
            .map((o) => {
              const country = window.COUNTRIES[o.tagId.replace("country:", "")];
              const flagSrc = country ? "imagens/bandeiras/" + country.iso2 + ".webp" : null;
              return (
                '<button type="button" class="filter-tile filter-tile--photo' +
                (selectedIds.indexOf(o.tagId) !== -1 ? " is-selected" : "") +
                '" data-value="' +
                o.tagId +
                '">' +
                '<span class="filter-tile__media">' +
                (flagSrc ? '<img class="filter-tile__img" src="' + flagSrc + '" alt="" loading="lazy">' : "") +
                "</span>" +
                '<span class="filter-tile__band">' +
                '<span class="filter-tile__label">' +
                o.tag.label +
                '</span><span class="filter-tile__count">' +
                o.count +
                "</span></span></button>"
              );
            })
            .join("") +
          "</div>";
        sectionBody.querySelectorAll(".filter-tile").forEach((btn) => {
          btn.addEventListener("click", () => {
            const val = btn.dataset.value;
            const current = draftFacetState[def.key] || [];
            draftFacetState[def.key] = current.indexOf(val) !== -1 ? current.filter((id) => id !== val) : current.concat([val]);
            renderBody();
          });
        });
      }

      // Piloto de redesenho visual (Equipamento, def.layout === "tiles") — grade de
      // tiles com ícone/label/contagem em vez de checkbox em lista. Mesma lógica de estado de
      // qualquer faceta combineMode "or": sem item "Todos" (nenhum tile marcado = nenhum
      // filtro ativo, igual a "Todos" marcado na versão em lista); marcar/desmarcar um tile
      // só alterna draftFacetState[def.key], reaproveitando computeFacetOptions pra contagem —
      // não recalcula nada que já não existisse. O ícone em si vem de def.tileIcon(tagId),
      // plugável por faceta (SVG real em Equipamento). País usa layout "photo-tiles" (ver
      // renderCountryTileSectionBody acima), não este.
      function renderTileSectionBody(sectionBody, def, options) {
        const selectedIds = draftFacetState[def.key] || [];
        sectionBody.innerHTML =
          '<div class="filter-tile-grid">' +
          options
            .map(
              (o) =>
                '<button type="button" class="filter-tile' +
                (selectedIds.indexOf(o.tagId) !== -1 ? " is-selected" : "") +
                '" data-value="' +
                o.tagId +
                '">' +
                def.tileIcon(o.tagId) +
                '<span class="filter-tile__label">' +
                o.tag.label +
                '</span><span class="filter-tile__count">' +
                o.count +
                "</span></button>"
            )
            .join("") +
          "</div>";
        sectionBody.querySelectorAll(".filter-tile").forEach((btn) => {
          btn.addEventListener("click", () => {
            const val = btn.dataset.value;
            const current = draftFacetState[def.key] || [];
            draftFacetState[def.key] = current.indexOf(val) !== -1 ? current.filter((id) => id !== val) : current.concat([val]);
            renderBody();
          });
        });
      }

      function renderGenericSection(def) {
        // getUniverse recebe draftFacetState (2026-07-29) — precisa saber QUAIS proteínas estão
        // ativas no rascunho pra calcular o universo certo quando draftProteinRole != null (a
        // faceta Proteína pode ter mudado sem a coleção ter uma proteína implícita fixa, ver
        // activeProteinTagIds).
        const options = computeFacetOptions(opts.getUniverse(draftProteinRole, draftFacetState), draftFacetState, defs, def, draftIngredientMode);
        const section = document.createElement("div");
        section.className = "filter-section" + (openSectionKey === def.key ? " is-open" : "");
        const summary = sectionSummary(def);
        section.innerHTML =
          '<button type="button" class="filter-section__header">' +
          '<span class="filter-section__label">' +
          def.label +
          '<span class="filter-section__count">(' +
          options.length +
          ")</span></span>" +
          (summary ? '<span class="filter-section__summary">' + summary + "</span>" : "") +
          iconSvg("chevronDown", "filter-section__chevron") +
          "</button>" +
          '<div class="filter-section__body"></div>';
        section.querySelector(".filter-section__header").addEventListener("click", () => toggleSection(def.key));
        const sectionBody = section.querySelector(".filter-section__body");
        if (def.layout === "photo-tiles") renderCountryTileSectionBody(sectionBody, def, options);
        else if (def.multi && def.combineMode === "or" && def.layout === "tiles") renderTileSectionBody(sectionBody, def, options);
        else if (def.layout === "ingredient-tiles") renderIngredientTileSectionBody(sectionBody, def, options);
        else if (def.multi && def.combineMode === "or") renderChipSectionBody(sectionBody, def, options);
        else if (def.multi) renderMultiSectionBody(sectionBody, def, options);
        else renderSingleSectionBody(sectionBody, def, options);
        return section;
      }

      function renderBody() {
        bodyEl.innerHTML = "";
        defs.forEach((def) => bodyEl.appendChild(renderGenericSection(def)));
        renderClearRow();
        renderFooter();
      }

      renderBody();
    }
  }

  // ---------- Categoria (coleção) ----------
  let refreshActiveCounts = null; // atualiza contadores/toolbar sem re-renderizar os cards (chamado ao marcar feito/favorito)

  // S3 (Dívida #1, busca+persistência em categoria, 2026-07-29): MESMO padrão de grupoFacetState
  // (renderGrupo) — objeto de módulo, chaveado por collection.id, foto de {tags, ingredientMode,
  // proteinRole, texto da busca}, gravada em todo commit e lida no topo de renderCategory. Tags/
  // role/imode também continuam na URL (Router.replaceCategoriaFacets, intocado — mantém
  // bookmark/link direto), mas texto NUNCA foi pra URL (mesma regra do hub) — só este objeto
  // sobrevive ao "Voltar" de uma receita e a qualquer re-entrada na mesma categoria na sessão.
  const categoryFacetState = {};

  function showCategoria(collectionId, initialFacetTags, initialRole, initialIngredientMode) {
    const collection = window.COLLECTIONS.find((c) => c.id === collectionId) || firstCollection;
    activeCat = collection.id;
    renderCategory(collection, initialFacetTags || [], initialRole || null, initialIngredientMode || "or");
  }

  function renderCategory(collection, initialFacetTags, initialRole, initialIngredientMode) {
    refreshActiveCounts = null;
    header.innerHTML =
      "<h2>" +
      collection.label +
      "</h2>" +
      (collection.desc ? '<div class="desc">' + collection.desc + "</div>" : "");
    const grupo = GRUPOS.find((g) => g.collectionGroup === collection.group);
    // Único entry point real de qualquer coleção, confirmado por grep: renderCollectionCard (só
    // chamado de dentro da grade do grupo dono) OU, pras 2 exceções hideFromGrupoGrid (massas,
    // sobremesas-classicas), o tile da própria Home — nunca os dois pra mesma coleção, então o
    // destino abaixo nunca é ambíguo (mesma lógica de antes, só trocou de elemento).
    header.insertBefore(
      createBackFloat(collection.hideFromGrupoGrid || !grupo ? "Home" : grupo.label, () => {
        // hideFromGrupoGrid (Bloco 2, item 2): a coleção não aparece mais na grade do grupo, então
        // "voltar pro grupo" seria um beco sem saída visual — volta pra Home (única entrada real).
        if (collection.hideFromGrupoGrid) Router.toHome();
        else if (grupo) Router.toGrupo(grupo.id);
        else Router.toHome();
      }),
      header.firstChild
    );
    content.innerHTML = "";
    progressEl.textContent = "";

    const { primaryRecipes: basePrimary, relatedRecipes: baseRelated, allRecipes: baseAll, preparos: basePreparos, padrao: basePadrao } = TagModel.getRecipesByCollection(collection.id);

    if (!baseAll.length) {
      content.innerHTML = '<div class="empty-state">Essa coleção ainda não tem receitas — em breve.</div>';
      return;
    }
    const baseAllIds = baseAll.map((item) => item.id);

    // savedState (categoryFacetState[collection.id]): quando existe, é a FOTO mais recente e tem
    // prioridade sobre os params vindos da URL — mesma regra do hub (grupoFacetState). Só fica
    // null na 1ª visita da sessão (link direto/bookmark), quando os params da URL valem.
    const savedState = categoryFacetState[collection.id] || null;

    // Facetas extras selecionadas dentro da coleção (refino in-context, nunca navega pra
    // #/busca) — persistidas na própria URL via Router.replaceCategoriaFacets E em
    // categoryFacetState (ver savedState acima).
    let selectedFacetTags = (savedState ? savedState.tags : initialFacetTags || []).slice();
    let primaryRecipes = basePrimary;
    let relatedRecipes = baseRelated;
    let allRecipes = baseAll;
    // S1: ids retornados por Search.searchByQuery quando há texto de busca ativo — null quando
    // não há (caminho atual, matchesGroupedTags direto via applyFacets, intocado).
    let searchResultIds = null;
    // Como 2+ ingredientes combinam entre si (toggle Qualquer um/Todos estes, ver
    // renderIngredientTileSectionBody) — persistido junto com selectedFacetTags (URL +
    // categoryFacetState). "or" é o default. Substitui a antiga rede de segurança
    // reativa (ingredientOrFallback): antes só virava "or" depois de um AND zerar, sem opção
    // proativa nem persistência — agora é uma escolha explícita, sempre visível com 2+
    // ingredientes selecionados, válida antes mesmo de dar zero resultado.
    let ingredientMode = (savedState ? savedState.ingredientMode : initialIngredientMode) || "or";
    // S1/S3: texto da barra de busca — restaurado de categoryFacetState (nunca existiu na URL,
    // mesma regra de grupoSearchQuery no hub).
    let searchQuery = (savedState && savedState.text) || "";

    function applyFacets() {
      const matchesFacets = (item) => TagModel.matchesGroupedTags(item.tags, selectedFacetTags, ingredientMode);
      primaryRecipes = selectedFacetTags.length ? basePrimary.filter(matchesFacets) : basePrimary;
      relatedRecipes = selectedFacetTags.length ? baseRelated.filter(matchesFacets) : baseRelated;
      allRecipes = selectedFacetTags.length ? baseAll.filter(matchesFacets) : baseAll;
      // S1: texto residual recorta POR CIMA do caminho de tags acima (que não muda) — só entra
      // em jogo quando há busca de texto ativa (searchResultIds não-null); sem busca, os 3
      // arrays acima são o resultado final, exatamente como antes desta tarefa.
      if (searchResultIds) {
        primaryRecipes = primaryRecipes.filter((item) => searchResultIds.has(item.id));
        relatedRecipes = relatedRecipes.filter((item) => searchResultIds.has(item.id));
        allRecipes = allRecipes.filter((item) => searchResultIds.has(item.id));
      }
    }
    applyFacets();

    // Papel da proteína (Principal/Secundário/Ver tudo) substitui as antigas abas "Foco da
    // receita/Todas". Correção de semântica (2026-07-29): deixou de valer só pra coleções de
    // proteína — vale sempre que houver >=1 proteína ATIVA (explícita ou implícita da coleção,
    // ver activeProteinTagIds). Validado aqui no load inicial também (não só reativamente): um
    // link/bookmark com "?role=focus" mas sem NENHUM contexto de proteína ativo nunca aplica —
    // nunca um papel "fantasma" sem proteína, mesma regra que vale pra interação do usuário.
    let proteinRole = validProteinRole(savedState ? savedState.proteinRole : initialRole, readFacetStateFromTags(selectedFacetTags, GENERIC_FACET_DEFS), collection);

    function syncUrl() {
      Router.replaceCategoriaFacets(collection.id, selectedFacetTags, proteinRole, ingredientMode);
    }

    // S3: grava a FOTO de {tags, ingredientMode, proteinRole, texto} em categoryFacetState —
    // chamada em todo ponto de mutação (commit de chip, × de chip, Aplicar do modal, digitação).
    // Escopo desta dívida é só estado de busca/filtro — scroll não entra (scrollPositionsByHash
    // em app.js é um mecanismo separado, intocado).
    function persistState() {
      categoryFacetState[collection.id] = {
        tags: selectedFacetTags.slice(),
        ingredientMode: ingredientMode,
        proteinRole: proteinRole,
        text: search.value,
      };
    }

    let sortKey = TagModel.getCollectionSort(collection.id) || "relevance";

    // S1 (busca de categoria): input no topo da tela, mesmo componente visual do hub
    // (.home-search-wrap/.home-search) — escopo = baseAll (a coleção inteira), nunca navega.
    const searchWrap = document.createElement("div");
    searchWrap.className = "home-search-wrap";
    const search = document.createElement("input");
    search.type = "text";
    search.className = "home-search";
    search.placeholder = "Buscar em " + collection.label.toLowerCase() + "...";
    search.value = searchQuery;
    searchWrap.appendChild(search);
    attachSearchClear(search, searchWrap, () => search.dispatchEvent(new Event("input")));
    content.appendChild(searchWrap);

    const toolbar = document.createElement("div");
    toolbar.className = "collection-toolbar";

    const countEl = document.createElement("div");
    countEl.className = "collection-count";
    toolbar.appendChild(countEl);

    const sortWrap = document.createElement("label");
    sortWrap.className = "sort-control";
    sortWrap.innerHTML =
      "<span>Ordenar por</span><select>" +
      TagModel.SORT_OPTIONS.map((o) => '<option value="' + o.key + '">' + o.label + "</option>").join("") +
      "</select>";
    toolbar.appendChild(sortWrap);
    const sortSelect = sortWrap.querySelector("select");
    sortSelect.value = sortKey;
    content.appendChild(toolbar);

    const facetBarEl = document.createElement("div");
    facetBarEl.className = "filter-trigger-wrap";
    content.appendChild(facetBarEl);

    // S1: chips ATIVOS (commitados, com ×) + chips SUGERIDOS pelo parser — mesmos componentes
    // visuais do hub (.tagsearch-chips/.tagsearch-suggestions), sem CSS novo.
    const activeChipsWrap = document.createElement("div");
    activeChipsWrap.className = "tagsearch-chips";
    content.appendChild(activeChipsWrap);

    const chipsWrap = document.createElement("div");
    chipsWrap.className = "tagsearch-suggestions";
    content.appendChild(chipsWrap);

    const listEl = document.createElement("div");
    content.appendChild(listEl);

    // S2: válvula de escape anti-decepção — container próprio, depois da lista; o empty-state
    // "Nenhuma receita..." continua vindo de renderList() (intocado), este elemento só soma o
    // CTA/link por cima quando aplicável (nenhum bloco paralelo de resultados).
    const escapeValveEl = document.createElement("div");
    content.appendChild(escapeValveEl);

    // S2/S3 (3b-UI): seção "Preparos e técnicas", no fim da tela — só em coleção de
    // proteína/país, só quando não-vazia (Cordeiro, Itália etc. não têm preparo algum
    // alcançável, a seção some inteira). Fixa: usa basePreparos (universo BASE da coleção, TagModel.
    // getRecipesByCollection) — NÃO reage a facetas/busca/papel, mesmo padrão "não reage ao
    // filtro de papel" que S2 pede; reusa .subgroup-title (mesmo rótulo de seção já usado em
    // renderGrupo) e renderRecipeCard sem CSS novo.
    if (isIdentityCollection(collection) && basePreparos.length) {
      const preparosTitle = document.createElement("div");
      preparosTitle.className = "subgroup-title";
      preparosTitle.textContent = "Preparos e técnicas";
      content.appendChild(preparosTitle);
      const preparosListEl = document.createElement("div");
      content.appendChild(preparosListEl);
      const preparosFromHash = currentHashPath();
      basePreparos.forEach((item) => preparosListEl.appendChild(renderRecipeCard(item, { fromHash: preparosFromHash })));
    }

    // 3b-UI (2026-07-30): seção fixa "Pratos com estas técnicas" — espelho exato da seção acima,
    // pro sentido inverso: a coleção tecnicas separa os 3 pratos (nature:prato) da lista principal
    // de preparos/técnicas (ver ramo ADITIVO de applyRoleAndNature) e mostra-os fixos aqui. Fixa:
    // usa basePadrao (partição canônica, TagModel.getRecipesByCollection) — NÃO reage a
    // facetas/busca/papel, mesmo padrão da seção irmã; reusa .subgroup-title e renderRecipeCard
    // sem CSS novo.
    if (collection.collectionType === "technique" && basePadrao.length) {
      const pratosTitle = document.createElement("div");
      pratosTitle.className = "subgroup-title";
      pratosTitle.textContent = "Pratos com estas técnicas";
      content.appendChild(pratosTitle);
      const pratosListEl = document.createElement("div");
      content.appendChild(pratosListEl);
      const pratosFromHash = currentHashPath();
      basePadrao.forEach((item) => pratosListEl.appendChild(renderRecipeCard(item, { fromHash: pratosFromHash })));
    }

    // 3b-UI (2026-07-30): um único ponto que aplica papel (focus/secondary, ação explícita do
    // usuário — sempre exclui preparo/técnica) OU a vista padrão (nature:prato ∧ identidade,
    // quando não há papel selecionado) — reusado por currentItems()/getUniverse()/
    // computeCounts()/countForDraft() abaixo, nunca reimplementado por call site.
    // TagModel.splitByProteinRole continua sendo o único mecanismo que decide protagonista/
    // coadjuvante (intocado); este helper só filtra o resultado por nature quando a coleção é
    // de identidade (proteína/país) — local a renderCategory, não vaza pra renderGrupo/renderBusca.
    function applyRoleAndNature(items, role, S, identityCollection) {
      if (role === "focus" || role === "secondary") {
        const split = TagModel.splitByProteinRole(items, S);
        const roleItems = role === "focus" ? split.primary : split.secondary;
        return isIdentityCollection(identityCollection) ? roleItems.filter((item) => item.recipe.nature === "prato") : roleItems;
      }
      // 3b-UI (2026-07-30): ramo ADITIVO — coleção technique (tecnicas) esconde os pratos
      // (nature:prato) da lista principal quando não há papel de proteína ativo; eles ficam só na
      // seção fixa "Pratos com estas técnicas" (ver abaixo). Não é identity (proteína/país) — por
      // isso checado ANTES do early-return genérico de isIdentityCollection.
      if (identityCollection && identityCollection.collectionType === "technique") {
        return items.filter((item) => item.recipe.nature !== "prato");
      }
      if (!isIdentityCollection(identityCollection)) return items;
      const identityItems = S.length ? TagModel.splitByProteinRole(items, S).primary : items;
      return identityItems.filter((item) => item.recipe.nature === "prato");
    }

    function currentItems() {
      // Correção de semântica (2026-07-29): Principal/Secundário não são mais fixos por
      // coleção (basePrimary/baseRelated) — dependem de S = activeProteinTagIds (explícito da
      // faceta Proteína, ou o implícito da própria coleção quando nada foi selecionado).
      // Universo: allRecipes (já filtrado pelas OUTRAS facetas + a própria Proteína, se
      // selecionada) — sempre soma exatamente allRecipes.length entre os 2 grupos, nunca
      // sobra nem falta receita (S sempre é o que já filtrou allRecipes pra começo de conversa).
      const facetState = readFacetStateFromTags(selectedFacetTags, GENERIC_FACET_DEFS);
      const S = activeProteinTagIds(facetState, collection);
      if (proteinRole === "focus" || proteinRole === "secondary") {
        // Papel é ação explícita — S1: preparo/técnica NUNCA aparece aqui, mesmo com busca ativa.
        return applyRoleAndNature(allRecipes, proteinRole, S, collection);
      }
      // S5: busca continua alcançando tudo — a vista padrão (nature:prato ∧ identidade) só
      // recorta quando NÃO há busca de texto em curso; com busca ativa, mostra o resultado
      // normal (facetas+texto já aplicados em allRecipes via applyFacets), sem a restrição de
      // identidade — senão buscar "carbonara" dentro de Suínos não acharia Carbonara.
      if (searchResultIds) return allRecipes;
      return applyRoleAndNature(allRecipes, proteinRole, S, collection);
    }

    function renderToolbarState() {
      countEl.innerHTML = "<strong>" + currentItems().length + " receita" + (currentItems().length === 1 ? "" : "s") + "</strong>";
      const doneCount = Storage.countMade(currentItems().map((i) => i.id));
      progressEl.textContent = doneCount + " de " + currentItems().length + " já feitas";
    }

    // Botão "Filtros" (com badge) + modal em acordeão (Bloco 3) — substitui a antiga barra de
    // dropdowns sempre-visível E o antigo "Limpar filtros" separado (agora vive dentro do
    // modal). A lógica de cada faceta é a mesma de sempre (matchesGroupedTags/facetStateToTagIds/
    // etc.) — só o CONTÊINER mudou.
    function renderFacets() {
      const facetState = readFacetStateFromTags(selectedFacetTags, GENERIC_FACET_DEFS);
      renderFacetModal(facetBarEl, GENERIC_FACET_DEFS, {
        facetState: facetState,
        collection: collection,
        // Correção de semântica (2026-07-29): universo de OUTRAS facetas (ex.: quantas
        // receitas com Forno existem "dado que já escolhi Principal") depende de S = proteínas
        // ATIVAS no rascunho (draftFacetState), não mais de basePrimary/baseRelated fixos.
        // 3b-UI: reusa applyRoleAndNature — com "Ver tudo" (role vazio) numa coleção de
        // identidade, o universo pro resto do modal já é o padrão (nature:prato ∧ identidade),
        // senão as contagens de outras facetas ("Forno (N)") não bateriam com o que a lista
        // padrão realmente mostra.
        getUniverse: (role, draftFacetState) => {
          const S = activeProteinTagIds(draftFacetState, collection);
          return applyRoleAndNature(baseAll, role, S, collection);
        },
        proteinRole: {
          value: proteinRole,
          setValue: (v) => {
            proteinRole = v;
          },
          computeCounts: (draftFacetState, draftIngredientMode) => {
            const S = activeProteinTagIds(draftFacetState, collection);
            if (!S.length) return { focus: 0, secondary: 0 };
            const matchesGeneric = (item) => TagModel.matchesGroupedTags(item.tags, facetStateToTagIds(draftFacetState, GENERIC_FACET_DEFS), draftIngredientMode);
            const matched = baseAll.filter(matchesGeneric);
            // S1: papel filtra PRATOS — preparo/técnica nunca soma nas pílulas Principal/Secundário.
            return { focus: applyRoleAndNature(matched, "focus", S, collection).length, secondary: applyRoleAndNature(matched, "secondary", S, collection).length };
          },
        },
        ingredientMode: {
          value: ingredientMode,
          setValue: (v) => {
            ingredientMode = v;
          },
        },
        countForDraft: (draftFacetState, draftRole, draftIngredientMode) => {
          const draftTags = facetStateToTagIds(draftFacetState, GENERIC_FACET_DEFS);
          const matches = (item) => TagModel.matchesGroupedTags(item.tags, draftTags, draftIngredientMode);
          const universe = draftTags.length ? baseAll.filter(matches) : baseAll;
          const S = activeProteinTagIds(draftFacetState, collection);
          return applyRoleAndNature(universe, draftRole, S, collection).length;
        },
        onApply: () => {
          selectedFacetTags = facetStateToTagIds(facetState, GENERIC_FACET_DEFS);
          syncUrl();
          persistState();
          renderFacets();
          renderActiveChips();
          // S1: reusa o MESMO runSearch (texto+tags juntos) — sem isso, mudar facetas pelo modal
          // enquanto há busca de texto ativa deixaria searchResultIds desatualizado.
          runSearch(search.value.trim());
        },
      });
    }

    function renderList() {
      listEl.innerHTML = "";
      const items = currentItems();

      // Sem rede de segurança reativa — o toggle Qualquer um/Todos estes (sempre visível com
      // 2+ ingredientes, ver renderIngredientTileSectionBody) já resolve o caso de AND zerado
      // de forma proativa, direto no modal. Zero resultado aqui é só o empty-state normal.
      if (!items.length) {
        listEl.innerHTML = '<div class="empty-state">Nenhuma receita com esses filtros.<br>Remova um filtro pra ampliar os resultados.</div>';
        return;
      }

      const sortedItems = TagModel.sortRecipeItems(items, sortKey, collection);

      // "Papel da proteína" (dropdown) já é a única fonte pra distinguir Principal/Secundário —
      // não duplicar essa distinção aqui com cabeçalhos automáticos. sortKey "relevance" já
      // ordena principal-primeiro via getCollectionRelevanceScore, então "Ver tudo" (default)
      // renderiza uma lista só, na ordem certa, sem seção "Foco da receita"/"Também leva".
      // fromHash: hash INTEIRO da coleção no momento deste render (inclui tags/role/imode já
      // aplicados) — não só collection.id como antes. renderList() só roda de novo depois de
      // syncUrl() (ver onApply em renderFacets), então location.hash aqui sempre reflete o
      // filtro atual de verdade no momento em que o card é criado.
      const fromHash = currentHashPath();
      // Com 2+ country: distintos em selectedFacetTags, o chip do card vira o país da receita
      // (regra do redesenho do card, CHECKLIST-GERAL.md item 2). Calculado 1x por render da
      // lista, não por card — depende só do filtro ativo, não de cada receita.
      const countryOverride = hasMultiCountryFilter(selectedFacetTags);
      sortedItems.forEach((item) => listEl.appendChild(renderRecipeCard(item, { fromHash: fromHash, countryOverride: countryOverride })));
    }

    sortSelect.addEventListener("change", () => {
      sortKey = sortSelect.value;
      TagModel.setCollectionSort(collection.id, sortKey);
      renderList();
    });

    // S1: chip sugerido pelo parser — tocar COMMITA a tag no MESMO selectedFacetTags que o modal
    // já usa (uma lógica, duas portas — padrão idêntico ao renderGrupo) e remove do texto
    // digitado só as palavras que geraram esse chip; o resto do texto permanece.
    function commitChip(tagId, parsed) {
      const seg = parsed.segments.find(
        (s) => (s.classification === "auto" && s.autoTagId === tagId) || (s.classification === "optional" && s.chipTagIds.indexOf(tagId) !== -1)
      );
      const removeTokens = seg ? seg.tokens : [];
      if (selectedFacetTags.indexOf(tagId) === -1) selectedFacetTags = selectedFacetTags.concat([tagId]);
      const remaining = search.value
        .trim()
        .split(/\s+/)
        .filter((w) => w && removeTokens.indexOf(w) === -1);
      search.value = remaining.join(" ");
      syncUrl();
      persistState();
      renderActiveChips();
      renderFacets();
      // Reaproveita o listener de input já existente (mesmo padrão de renderGrupo) — 1 único
      // ponto de integração com o motor; a rota NUNCA muda (fica em #/categoria/:id).
      search.dispatchEvent(new Event("input"));
    }

    function renderChips(parsed) {
      chipsWrap.innerHTML = "";
      const chipIds = [];
      parsed.segments.forEach((seg) => {
        if (seg.classification === "auto" && chipIds.indexOf(seg.autoTagId) === -1) chipIds.push(seg.autoTagId);
        if (seg.classification === "optional") {
          seg.chipTagIds.forEach((id) => {
            if (chipIds.indexOf(id) === -1) chipIds.push(id);
          });
        }
      });
      if (!chipIds.length) return 0;
      const html = chipIds
        .map((id) => {
          const tag = TagModel.getTagById(id);
          return tag ? '<button type="button" class="tag-suggestion" data-tag="' + id + '">' + tag.label + "</button>" : "";
        })
        .join("");
      chipsWrap.innerHTML = '<div class="tagsearch-taglist">' + html + "</div>";
      chipsWrap.querySelectorAll("[data-tag]").forEach((btn) => {
        btn.addEventListener("click", () => commitChip(btn.dataset.tag, parsed));
      });
      return chipIds.length;
    }

    // S1/S3: linha de chips ATIVOS (commitados) com × — remover o último volta ao só-texto (o
    // próprio esvaziamento de selectedFacetTags já faz isso, nenhum caso especial). Mesmo padrão
    // visual/comportamental de renderGrupo, reaproveitado sem CSS novo.
    function renderActiveChips() {
      if (!selectedFacetTags.length) {
        activeChipsWrap.innerHTML = "";
        return;
      }
      activeChipsWrap.innerHTML = selectedFacetTags
        .map((id) => {
          const tag = TagModel.getTagById(id);
          return (
            '<button type="button" class="tag-chip tag-chip--selected" data-tag="' +
            id +
            '">' +
            (tag ? tag.label : id) +
            ' <span aria-hidden="true">×</span></button>'
          );
        })
        .join("");
      activeChipsWrap.querySelectorAll(".tag-chip").forEach((btn) => {
        btn.addEventListener("click", () => {
          selectedFacetTags = selectedFacetTags.filter((t) => t !== btn.dataset.tag);
          // Dívida #2: papel nunca sobrevive sem proteína ativa — mesma regra do init, agora
          // em todo caminho de mutação.
          proteinRole = validProteinRole(proteinRole, readFacetStateFromTags(selectedFacetTags, GENERIC_FACET_DEFS), collection);
          syncUrl();
          persistState();
          renderActiveChips();
          renderFacets();
          search.dispatchEvent(new Event("input"));
        });
      });
    }

    // S2 (válvula de escape anti-decepção, mesmos 4 ramos do hub): transfere texto residual +
    // tags commitadas pra busca global — MESMO Router.toBusca/tags=/text= de sempre. Papel da
    // proteína NÃO transfere (role omitido) — recorte de exibição da própria categoria, mesma
    // regra do hub.
    function transferToBusca(query, baseTagIds) {
      const parsed = Search.parseQuery(query, baseTagIds);
      const transferTags = baseTagIds.concat(parsed.autoTagIds);
      Router.toBusca(transferTags, parsed.residualTokens || [], ingredientMode, null);
    }

    // S2: os mesmos 4 ramos do hub, com contagem real (global = escopo null, mesmo texto+tags) —
    // regra compartilhada via buildEscapeValveActionEl (mesma função que renderGrupo usa),
    // nenhuma cópia divergente da decisão.
    function renderEscapeValve(query, baseTagIds, scopedTotal, globalTotal) {
      escapeValveEl.innerHTML = "";
      const actionEl = buildEscapeValveActionEl(scopedTotal, globalTotal, () => transferToBusca(query, baseTagIds));
      if (actionEl) escapeValveEl.appendChild(actionEl);
    }

    // S1/S2: motor único (Search.parseQuery/searchByQuery, baseTagIds = selectedFacetTags,
    // escopo = baseAllIds) — mesmo pipeline do hub. Sem texto: caminho atual (matchesGroupedTags
    // direto via applyFacets), que já existe e não muda; a válvula ainda soma contagem real por
    // cima (mesma faceta, escopo null vs baseAllIds) sem alterar o resultado da lista.
    function runSearch(query) {
      const baseTagIds = selectedFacetTags;
      chipsWrap.innerHTML = "";
      if (!query && !baseTagIds.length) {
        searchResultIds = null;
        applyFacets();
        renderToolbarState();
        renderList();
        escapeValveEl.innerHTML = "";
        return;
      }
      let scopedTotal;
      let globalTotal;
      if (query) {
        const parsed = Search.parseQuery(query, baseTagIds);
        renderChips(parsed);
        const out = Search.searchByQuery(query, { parsed: parsed, baseTagIds: baseTagIds, ingredientMode: ingredientMode, scopeIds: baseAllIds });
        const globalOut = Search.searchByQuery(query, { parsed: parsed, baseTagIds: baseTagIds, ingredientMode: ingredientMode });
        searchResultIds = new Set(out.block1.concat(out.block2).map((r) => r.item.id));
        scopedTotal = out.block1.length + out.block2.length;
        globalTotal = globalOut.block1.length + globalOut.block2.length;
      } else {
        searchResultIds = null;
        scopedTotal = baseAll.filter((item) => TagModel.matchesGroupedTags(item.tags, baseTagIds, ingredientMode)).length;
        globalTotal = TagModel.getAllRecipesFlat().filter((item) => TagModel.matchesGroupedTags(item.tags, baseTagIds, ingredientMode)).length;
      }
      applyFacets();
      renderToolbarState();
      renderList();
      renderEscapeValve(query, baseTagIds, scopedTotal, globalTotal);
    }

    let searchDebounce = null;
    search.addEventListener("input", () => {
      const q = search.value.trim();
      persistState();
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => runSearch(q), 220);
    });

    refreshActiveCounts = renderToolbarState;

    renderActiveChips();
    renderFacets();
    runSearch(search.value.trim());
  }

  // ---------- Busca facetada por tags ----------
  const POPULAR_TAG_GROUPS = [
    { label: "Proteínas", ids: ["protein:frango", "protein:boi", "protein:suino", "protein:peixe", "protein:frutos-do-mar", "protein:ovo", "diet:vegetariana"] },
    { label: "Tipos de prato", ids: ["dish_type:massa", "dish_type:sopa", "dish_type:sobremesa", "dish_type:arroz", "dish_type:pao"] },
    { label: "Cozinhas", ids: ["country:italia", "country:brasil", "country:japao", "country:mexico", "country:franca"] },
    { label: "Tempo e dificuldade", ids: ["time:ate-30-min", "difficulty:facil"] },
  ];

  function renderBusca(tagIds, textFilters, initialIngredientMode, initialQuery, initialRole) {
    textFilters = textFilters || [];
    let ingredientMode = initialIngredientMode || "or";
    // Papel da proteína (correção de semântica, 2026-07-29) — antes inexistente em busca
    // (proteinRole: null fixo). Validado contra o estado inicial de verdade (não só o valor cru
    // da URL): sem NENHUMA proteína ativa (busca não tem coleção, então só conta o explícito da
    // faceta Proteína em tagIds), nunca aplica um papel "fantasma" — mesma regra de renderCategory.
    let proteinRole = validProteinRole(initialRole, readFacetStateFromTags(tagIds, GENERIC_FACET_DEFS), null);
    activeCat = null;
    refreshActiveCounts = null;
    // Sem cabeçalho: Pesquisar é uma aba de nível superior da barra inferior, igual
    // Preparos/Lista de Compras/Minhas Receitas (nenhuma delas tem botão voltar) — só a barra
    // de busca fica visível, sem título "Buscar por tags" nem botão voltar.
    header.innerHTML = "";
    content.innerHTML = "";
    progressEl.textContent = "";

    const wrap = document.createElement("div");
    wrap.className = "tagsearch";

    const inputWrap = document.createElement("div");
    inputWrap.className = "tagsearch-input-wrap";
    const input = document.createElement("input");
    input.type = "text";
    input.className = "tagsearch-input";
    input.placeholder = "Busque por nome do prato, ingrediente, país, tempo...";
    input.value = initialQuery || "";
    inputWrap.appendChild(input);
    attachSearchClear(input, inputWrap, () => input.dispatchEvent(new Event("input")));
    wrap.appendChild(inputWrap);

    // Preview ao vivo do parser (chips AUTO removíveis + chips OPCIONAIS de termo ambíguo) —
    // reaproveita o visual de sugestão existente (.tagsearch-suggestions/.tag-suggestion).
    const previewEl = document.createElement("div");
    previewEl.className = "tagsearch-suggestions";
    wrap.appendChild(previewEl);

    const chipsEl = document.createElement("div");
    chipsEl.className = "tagsearch-chips";
    wrap.appendChild(chipsEl);

    const textChipsEl = document.createElement("div");
    textChipsEl.className = "tagsearch-chips";
    wrap.appendChild(textChipsEl);

    const facetBarEl = document.createElement("div");
    facetBarEl.className = "filter-trigger-wrap";
    wrap.appendChild(facetBarEl);

    const countRow = document.createElement("div");
    countRow.className = "tagsearch-count-row";
    const countEl = document.createElement("div");
    countEl.className = "tagsearch-count";
    countRow.appendChild(countEl);
    const sortWrap = document.createElement("label");
    sortWrap.className = "sort-control";
    sortWrap.innerHTML =
      "<span>Ordenar por</span><select>" +
      TagModel.SORT_OPTIONS.map((o) => '<option value="' + o.key + '">' + o.label + "</option>").join("") +
      "</select>";
    countRow.appendChild(sortWrap);
    const sortSelect = sortWrap.querySelector("select");
    let sortKey = "recipe-az";
    sortSelect.value = sortKey;
    wrap.appendChild(countRow);

    content.appendChild(wrap);

    const resultsEl = document.createElement("div");
    resultsEl.className = "tagsearch-results";
    content.appendChild(resultsEl);

    function goTo(newTagIds, newTextFilters) {
      const dedupedTags = newTagIds.filter((id, i) => newTagIds.indexOf(id) === i);
      const dedupedText = (newTextFilters || textFilters).filter((t, i) => (newTextFilters || textFilters).indexOf(t) === i);
      // proteinRole (lido fresco, não um parâmetro) — por ora que goTo roda (onApply do modal já
      // chamou setValue antes), reflete o valor final, já resetado pra null se a última proteína
      // ativa tiver sido desselecionada (ver wireSegmentedToggle/reset no chip de Proteína).
      Router.toBusca(dedupedTags, dedupedText, ingredientMode, proteinRole);
    }
    function goToTags(newTagIds) {
      goTo(newTagIds, textFilters);
    }

    function renderChips() {
      if (!tagIds.length) {
        chipsEl.innerHTML = "";
        return;
      }
      chipsEl.innerHTML = tagIds
        .map((id) => {
          const tag = TagModel.getTagById(id);
          return (
            '<button type="button" class="tag-chip tag-chip--selected" data-tag="' +
            id +
            '">' +
            (tag ? tag.label : id) +
            ' <span aria-hidden="true">×</span></button>'
          );
        })
        .join("");
      chipsEl.querySelectorAll(".tag-chip").forEach((btn) => {
        btn.addEventListener("click", () => goToTags(tagIds.filter((t) => t !== btn.dataset.tag)));
      });
    }

    function renderTextChips() {
      if (!textFilters.length) {
        textChipsEl.innerHTML = "";
        return;
      }
      textChipsEl.innerHTML = textFilters
        .map(
          (text) =>
            '<button type="button" class="tag-chip tag-chip--selected tag-chip--text" data-text="' +
            encodeURIComponent(text) +
            '">Contém "' +
            text +
            '" <span aria-hidden="true">×</span></button>'
        )
        .join("");
      textChipsEl.querySelectorAll(".tag-chip").forEach((btn) => {
        const text = decodeURIComponent(btn.dataset.text);
        btn.addEventListener("click", () => goTo(tagIds, textFilters.filter((t) => t !== text)));
      });
    }

    // tags controladas pelos dropdowns genéricos (país/complexidade/tempo/ingrediente) —
    // qualquer OUTRA tag em tagIds (de um chip manual/busca por texto) fica de fora e é
    // preservada ao trocar uma faceta.
    function nonFacetTagIds() {
      return tagIds.filter((id) => !GENERIC_FACET_DEFS.some((def) => id.indexOf(def.prefix) === 0));
    }

    function facetUniverse(base, mode) {
      let items = base.length ? TagModel.getAllRecipesFlat().filter((item) => TagModel.matchesGroupedTags(item.tags, base, mode)) : TagModel.getAllRecipesFlat();
      // Palavra inteira, multi-campo (nome/categoria/ingrediente/dificuldade) — mesma mecânica
      // do resíduo textual do preview (Search.matchesTextFilter), pra texto já materializado
      // não se comportar diferente de texto ainda sendo digitado. Antes era substring só em
      // ingredientes; mudou na leva do parser de busca (2026-07-24).
      if (textFilters.length) {
        items = items.filter((item) => textFilters.every((t) => Search.matchesTextFilter(item, t)));
      }
      return items;
    }

    function renderFacets() {
      const facetState = readFacetStateFromTags(tagIds, GENERIC_FACET_DEFS);
      const base = nonFacetTagIds();
      renderFacetModal(facetBarEl, GENERIC_FACET_DEFS, {
        facetState: facetState,
        // busca não tem coleção nenhuma (null) — S de Papel da proteína depende só do
        // explícito, nunca de um implícito (correção de semântica, 2026-07-29).
        collection: null,
        getUniverse: (role, draftFacetState) => {
          const universe = facetUniverse(base, ingredientMode);
          if (role === "focus" || role === "secondary") {
            const S = activeProteinTagIds(draftFacetState, null);
            const split = TagModel.splitByProteinRole(universe, S);
            return role === "focus" ? split.primary : split.secondary;
          }
          return universe;
        },
        proteinRole: {
          value: proteinRole,
          setValue: (v) => {
            proteinRole = v;
          },
          computeCounts: (draftFacetState, draftIngredientMode) => {
            const S = activeProteinTagIds(draftFacetState, null);
            if (!S.length) return { focus: 0, secondary: 0 };
            const draftTags = base.concat(facetStateToTagIds(draftFacetState, GENERIC_FACET_DEFS));
            const universe = facetUniverse(draftTags, draftIngredientMode);
            const split = TagModel.splitByProteinRole(universe, S);
            return { focus: split.primary.length, secondary: split.secondary.length };
          },
        },
        ingredientMode: {
          value: ingredientMode,
          setValue: (v) => {
            ingredientMode = v;
          },
        },
        countForDraft: (draftFacetState, draftRole, draftIngredientMode) => {
          const universe = facetUniverse(base.concat(facetStateToTagIds(draftFacetState, GENERIC_FACET_DEFS)), draftIngredientMode);
          if (draftRole === "focus" || draftRole === "secondary") {
            const S = activeProteinTagIds(draftFacetState, null);
            const split = TagModel.splitByProteinRole(universe, S);
            return draftRole === "focus" ? split.primary.length : split.secondary.length;
          }
          return universe.length;
        },
        onApply: () => {
          goToTags(base.concat(facetStateToTagIds(facetState, GENERIC_FACET_DEFS)));
        },
      });
    }

    function renderPopularTags() {
      const html = POPULAR_TAG_GROUPS.map((group) => {
        const chips = group.ids
          .map((id) => {
            const tag = TagModel.getTagById(id);
            return tag ? '<button type="button" class="tag-suggestion" data-tag="' + id + '">' + tag.label + "</button>" : "";
          })
          .join("");
        return '<div class="tagsearch-group-label">' + group.label + '</div><div class="tagsearch-taglist">' + chips + "</div>";
      }).join("");
      const popularWrap = document.createElement("div");
      popularWrap.className = "tagsearch-popular";
      popularWrap.innerHTML = html;
      resultsEl.appendChild(popularWrap);
      popularWrap.querySelectorAll(".tag-suggestion").forEach((btn) => {
        btn.addEventListener("click", () => goToTags([btn.dataset.tag]));
      });
    }

    function renderResults() {
      resultsEl.innerHTML = "";
      if (!tagIds.length && !textFilters.length) {
        countEl.textContent = "";
        resultsEl.innerHTML = '<div class="empty-state">Escolha uma tag abaixo (ou digite acima) pra começar a buscar.</div>';
        renderPopularTags();
        return;
      }
      // Sem rede de segurança reativa — o toggle Qualquer um/Todos estes (sempre visível com
      // 2+ ingredientes, ver renderIngredientTileSectionBody) já resolve o caso de AND zerado
      // de forma proativa, direto no modal. Zero resultado aqui é só o empty-state normal.
      let items = facetUniverse(tagIds, ingredientMode);
      // Papel da proteína (correção de semântica, 2026-07-29) — items já vem filtrado pelas tags
      // selecionadas (Proteína incluída, via matchesGroupedTags/matchesTagId); aqui só CLASSIFICA
      // em Principal/Secundário quando um papel está ativo. S sempre = o que já filtrou items,
      // então split.primary + split.secondary === items.length, nada sobra.
      if (proteinRole === "focus" || proteinRole === "secondary") {
        const facetStateNow = readFacetStateFromTags(tagIds, GENERIC_FACET_DEFS);
        const split = TagModel.splitByProteinRole(items, activeProteinTagIds(facetStateNow, null));
        items = proteinRole === "focus" ? split.primary : split.secondary;
      }
      if (!items.length) {
        countEl.textContent = "";
        resultsEl.innerHTML =
          '<div class="empty-state">Nenhuma receita encontrada com esses filtros.<br>Remova um filtro pra ampliar os resultados.</div>';
        return;
      }
      countEl.textContent = items.length + (items.length === 1 ? " receita encontrada" : " receitas encontradas");
      const sortedItems = TagModel.sortRecipeItems(items, sortKey, null);
      // fromHash: hash INTEIRO da busca no momento deste render (tags/text/imode já aplicados)
      // — mesmo raciocínio de renderCategory. Perder uma busca digitada ao voltar é mais caro
      // de reconstruir que perder um filtro de coleção, então preservar aqui importa tanto
      // quanto lá.
      const fromHash = currentHashPath();
      const countryOverride = hasMultiCountryFilter(tagIds);
      sortedItems.forEach((item) => {
        resultsEl.appendChild(renderRecipeCard(item, { fromHash: fromHash, countryOverride: countryOverride }));
      });
    }

    sortSelect.addEventListener("change", () => {
      sortKey = sortSelect.value;
      renderResults();
    });

    // ---------- preview: texto digitado, ainda não commitado ----------
    // Tocar QUALQUER chip do preview (auto × ou opcional +) É o commit — não existe um estado
    // intermediário de "excluí mas continuo digitando" (decisão deliberada, ver Passo 1 da
    // investigação: menos estado novo, e quem quer refinar mais já tem o modal de facetas).
    function commitParsed(parsed, overrideAutoTagIds, overrideResidual) {
      const newTagIds = tagIds.concat(overrideAutoTagIds !== undefined ? overrideAutoTagIds : parsed.autoTagIds);
      const newTextFilters = textFilters.concat(overrideResidual !== undefined ? overrideResidual : parsed.residualTokens);
      input.value = "";
      previewEl.innerHTML = "";
      goTo(newTagIds, newTextFilters);
    }

    function renderPreviewChips(parsed) {
      let html = "";
      parsed.segments.forEach((seg) => {
        if (seg.classification === "auto") {
          const tag = TagModel.getTagById(seg.autoTagId);
          html +=
            '<button type="button" class="tag-chip tag-chip--selected" data-tag="' +
            seg.autoTagId +
            '">' +
            (tag ? tag.label : seg.autoTagId) +
            ' <span aria-hidden="true">×</span></button>';
        } else if (seg.classification === "optional") {
          seg.chipTagIds.forEach((tagId) => {
            const tag = TagModel.getTagById(tagId);
            html +=
              '<button type="button" class="tag-suggestion" data-tag="' +
              tagId +
              '" data-optional="1">' +
              (tag ? tag.label : tagId) +
              " +</button>";
          });
        }
      });
      if (!html) {
        previewEl.innerHTML = "";
        return;
      }
      previewEl.innerHTML = '<div class="tagsearch-group-label">Interpretação da busca</div><div class="tagsearch-taglist">' + html + "</div>";
      previewEl.querySelectorAll("[data-tag]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const tagId = btn.dataset.tag;
          if (btn.dataset.optional) {
            const seg = parsed.segments.find((s) => s.classification === "optional" && s.chipTagIds.indexOf(tagId) !== -1);
            commitParsed(
              parsed,
              parsed.autoTagIds.concat([tagId]),
              parsed.residualTokens.filter((t) => !(seg && seg.tokens.indexOf(t) !== -1))
            );
          } else {
            const seg = parsed.segments.find((s) => s.classification === "auto" && s.autoTagId === tagId);
            commitParsed(
              parsed,
              parsed.autoTagIds.filter((id) => id !== tagId),
              parsed.residualTokens.concat(seg ? seg.tokens : [])
            );
          }
        });
      });
    }

    function renderPreviewSection(title, items, fromHash) {
      if (!items.length) return;
      const countryOverride = hasMultiCountryFilter(tagIds);
      const label = document.createElement("div");
      label.className = "tagsearch-group-label";
      label.textContent = title + " (" + items.length + ")";
      resultsEl.appendChild(label);
      items.forEach((r) => {
        resultsEl.appendChild(renderRecipeCard(r.item, { fromHash: fromHash, countryOverride: countryOverride }));
      });
    }

    // Degradação graciosa em 3 camadas: bloco 2 (rede ampla) é a rede primária, nunca
    // suprimido; fallback parcial (ranqueado por termos casados) só quando os 2 blocos zeram e
    // há 2+ termos; mensagem honesta no zero absoluto, sem inventar resultado.
    function renderPreviewResults(query) {
      const parsed = Search.parseQuery(query, tagIds);
      renderPreviewChips(parsed);
      const out = Search.searchByQuery(query, {
        parsed: parsed,
        baseTagIds: tagIds,
        baseTextFilters: textFilters,
        ingredientMode: ingredientMode,
        excludeTagIds: tagIds,
      });
      resultsEl.innerHTML = "";
      countEl.textContent = "";
      const fromHash = currentHashPath();
      renderPreviewSection("Com esses filtros", out.block1, fromHash);
      renderPreviewSection("Mais resultados por texto", out.block2, fromHash);
      if (!out.block1.length && !out.block2.length) {
        if (out.partial.length) {
          const countryOverride = hasMultiCountryFilter(tagIds);
          const label = document.createElement("div");
          label.className = "tagsearch-group-label";
          label.textContent = "Nenhuma receita bate com todos os termos — resultados parciais";
          resultsEl.appendChild(label);
          out.partial.forEach((r) => {
            resultsEl.appendChild(renderRecipeCard(r.item, { fromHash: fromHash, countryOverride: countryOverride }));
          });
        } else {
          resultsEl.innerHTML = '<div class="empty-state">Nenhuma receita encontrada para "' + query + '".<br>Tente outro termo ou escolha uma tag abaixo.</div>';
          renderPopularTags();
        }
      }
    }

    let previewDebounce = null;
    function schedulePreview(query) {
      const q = (query || "").trim();
      // Router.replaceBusca: preview vive só na URL (q=), sem empilhar histórico — Enter/chip
      // é que materializa de verdade em tags=/text= (goTo -> Router.toBusca, dropa q). role
      // passado aqui só pra não SUMIR da URL enquanto o usuário digita (nenhuma lógica nova).
      Router.replaceBusca(tagIds, textFilters, ingredientMode, q, proteinRole);
      if (!q) {
        previewEl.innerHTML = "";
        renderResults();
        return;
      }
      renderPreviewResults(q);
    }

    input.addEventListener("input", () => {
      clearTimeout(previewDebounce);
      previewDebounce = setTimeout(() => schedulePreview(input.value), 220);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      clearTimeout(previewDebounce);
      const q = input.value.trim();
      if (!q) return;
      commitParsed(Search.parseQuery(q, tagIds));
    });

    renderChips();
    renderTextChips();
    renderFacets();
    if (initialQuery && initialQuery.trim()) {
      renderPreviewResults(initialQuery.trim());
    } else {
      renderResults();
    }
  }

  // ---------- Telas-placeholder da barra inferior (Minhas Receitas / Preparos / Lista de Compras) ----------
  // Só navegação + visual por ora — conteúdo real chega em blocos futuros (ver Bloco 2, Fase 2.1).
  function renderPlaceholder(title, desc, extraEl) {
    activeCat = null;
    refreshActiveCounts = null;
    header.innerHTML = "<h2>" + title + "</h2>";
    content.innerHTML = "";
    progressEl.textContent = "";
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = desc;
    content.appendChild(empty);
    if (extraEl) content.appendChild(extraEl);
  }

  // ---------- Aba "Preparos": lista real de sessões em andamento (Fase 2) ----------
  // Só "em-andamento" (getActivePreparoSessions já filtra) — "concluido" nunca aparece aqui.
  // Tocar no card retoma (#/cozinhar/:id, mesma sessão); o botão de remover apaga a sessão do
  // localStorage por completo (Storage.deletePreparoSession), não só esconde da lista.
  function renderPreparosList() {
    activeCat = null;
    refreshActiveCounts = null;
    // Sem cabeçalho: o nome da aba já aparece na barra inferior, repetir como título seria
    // redundante (mesmo padrão já aplicado em Pesquisar).
    header.innerHTML = "";
    content.innerHTML = "";
    progressEl.textContent = "";

    const sessions = Storage.getActivePreparoSessions();
    if (!sessions.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Nenhum preparo em andamento. Comece pela tela de uma receita.";
      content.appendChild(empty);
      return;
    }

    const list = document.createElement("div");
    list.className = "preparo-list";

    sessions
      .slice()
      .sort((a, b) => b.startedAt - a.startedAt)
      .forEach((session) => {
        const recipeItem = TagModel.findRecipeById(session.recipeId);
        if (!recipeItem) return; // defensivo: receita não existe mais (renomeada/removida)
        const recipe = recipeItem.recipe;
        const totalSteps = recipe.steps ? recipe.steps.length : 0;

        const card = document.createElement("div");
        card.className = "preparo-card";

        const thumb = document.createElement("div");
        thumb.className = "preparo-card__thumb placeholder";
        thumb.innerHTML = iconSvg("photoOff", "photo-placeholder__icon");
        if (recipe.image) applyImage(thumb, recipe.image);
        else loadRecipeImage(recipe, thumb);
        card.appendChild(thumb);

        // Tempo restante é uma FOTO no momento de renderizar a lista, não fica contando ao
        // vivo aqui (evita mais um setInterval de fundo pra gerenciar — o timer de verdade só
        // roda dentro do próprio modo de preparo).
        let timerHtml = "";
        const timerState = session.stepTimers && session.stepTimers[session.currentStep];
        if (timerState && timerState.running && timerState.endsAt) {
          const secs = Math.max(0, Math.round((timerState.endsAt - Date.now()) / 1000));
          const mm = String(Math.floor(secs / 60)).padStart(2, "0");
          const ss = String(secs % 60).padStart(2, "0");
          timerHtml = '<span class="preparo-card__timer">' + mm + ":" + ss + "</span>";
        }

        const info = document.createElement("div");
        info.className = "preparo-card__info";
        info.innerHTML =
          "<strong>" + recipe.name + "</strong>" +
          '<span class="preparo-card__step">Passo ' + (session.currentStep + 1) + " de " + totalSteps + "</span>" +
          timerHtml;
        card.appendChild(info);

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "preparo-card__delete";
        deleteBtn.setAttribute("aria-label", "Remover preparo de " + recipe.name);
        deleteBtn.innerHTML = iconSvg("close", "preparo-card__delete-icon");
        deleteBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          Storage.deletePreparoSession(session.recipeId);
          renderPreparosList();
        });
        card.appendChild(deleteBtn);

        card.addEventListener("click", () => Router.toCozinhar(session.recipeId, "preparos"));
        card.setAttribute("aria-label", "Continuar preparo de " + recipe.name);
        makeKeyboardClickable(card);
        list.appendChild(card);
      });

    content.appendChild(list);
  }

  // ---------- Tela "Lista de Compras" (aba da barra inferior) ----------
  // Fase 1: só a visão "por receita" (uma receita de cada vez, sequencial) — a visão "geral"
  // (soma agrupada entre receitas, todas as famílias de unidade resolvidas) fica pra Fase 2.
  // O toggle no topo já existe visualmente mas "Geral" fica desabilitado por ora.
  // Família decide SE dá pra somar direto entre unidades diferentes (peso/volume, via fator
  // fixo pra uma unidade-base) ou só dentro do MESMO par item+unidade exato (contagem — nunca
  // soma "dente" com "folha", nem tenta converter peso<->volume: densidade não é confiável,
  // decisão já tomada na investigação anterior). Tabela de equivalência de volume é convenção
  // culinária fixa (colher-sopa/colher-cha/xícara em ml), não depende do ingrediente.
  const UNIT_FAMILY = {
    grama: "peso",
    quilograma: "peso",
    mililitro: "volume",
    litro: "volume",
    "colher-sopa": "volume",
    "colher-cha": "volume",
    xicara: "volume",
    // "colher" nua (1 ocorrência no acervo — Apple Pie "1 colher de leite") = colher de sopa,
    // convenção culinária BR. Tratada como volume só na camada da lista de compras pra nunca
    // exibir "1 colher de leite" na Geral (o dado da receita fica intocado — bug de dado é Fase 4).
    colher: "volume",
  };
  const UNIT_TO_BASE_FACTOR = {
    grama: 1,
    quilograma: 1000,
    mililitro: 1,
    litro: 1000,
    "colher-sopa": 15,
    "colher-cha": 5,
    xicara: 240,
    colher: 15,
  };
  function normalizeGroupKey(s) {
    return String(s || "").trim().toLowerCase();
  }

  // Percorre TODAS as entries selecionadas de TODAS as receitas da lista, agrupando por
  // (NÚCLEO DE COMPRA do item — ShoppingDict.purchaseCore, a normalização própria da lista de
  // compras — + família de unidade — peso/volume — ou núcleo+unidade exata quando não há
  // família) e somando qty (já escalado pelo portionMultiplier de CADA receita) dentro do mesmo
  // grupo. O texto da receita serve pra COZINHAR ("leite morno"); o núcleo serve pra COMPRAR
  // ("leite integral") — por isso o rótulo exibido do grupo é o núcleo canônico, nunca o
  // primeiro texto encontrado. lo/hi são sempre acumulados separadamente (item exato:
  // lo=hi=valor; qtyRange: lo/hi reais) — isso cobre soma de faixa (item 4) sem tratamento
  // especial. Cada grupo guarda os pares {item, unit} ORIGINAIS que contribuíram, pra
  // sincronizar o checkbox "comprado" com o MESMO boughtKeys da visão Por receita (nunca um
  // estado próprio da visão Geral). Items isReference ("1 receita de hollandaise") NÃO são
  // compra — saem da soma e vão pra lista separada `preparos` (seção própria no fim da Geral).
  function buildShoppingListGroups() {
    const groups = {};
    const preparos = {};
    const pantry = {};
    const aGosto = {};
    // Sub-produto derivado ("não compra quebrado", 2026-07-24): núcleo tipo gema/clara/raspas
    // de limão nunca vira grupo próprio — acumula aqui, convertido pro equivalente do
    // item-base (ShoppingDict.subproductOf), e funde no grupo do item-base no pós-passe
    // depois do loop principal. subprodutos[base][subCore] = quantidade equivalente
    // acumulada; subprodutosMeta[base] = pairs/recipeNames de TODAS as linhas daquele base
    // (inclusive as sem quantidade — nunca perde a receita da lista, só não soma número).
    const subprodutos = {};
    const subprodutosMeta = {};
    Storage.getShoppingListRecipes().forEach((entry) => {
      const recipeItem = TagModel.findRecipeById(entry.recipeId);
      if (!recipeItem) return;
      const recipe = recipeItem.recipe;
      const structured = recipe.ingredientsStructured || [];
      (entry.selectedEntries || []).forEach((entryIndex) => {
        const structEntry = structured[entryIndex];
        if (!structEntry) return;
        structEntry.items.forEach((it) => {
          if (it.isReference) {
            const refKey = normalizeGroupKey(it.item);
            if (!preparos[refKey]) preparos[refKey] = { label: it.item, recipeNames: {} };
            preparos[refKey].recipeNames[recipe.name] = true;
            return;
          }
          const family = it.unit ? UNIT_FAMILY[it.unit] : null;
          const core = ShoppingDict.purchaseCore(it.item);
          // Sub-produto derivado: nunca vira item próprio, sempre funde no item-base — checa
          // ANTES da despensa/a-gosto/acúmulo normal porque é uma classificação por
          // IDENTIDADE do núcleo, não pela forma da quantidade.
          const subOf = ShoppingDict.subproductOf(core);
          if (subOf) {
            let amount = null;
            if (it.qty !== null && it.qty !== undefined) amount = it.qty;
            else if (it.qtyRange) amount = it.qtyRange[1]; // limite superior — assimetria de risco
            let baseEquivalent = 0;
            if (amount !== null && !subOf.noQuantity) {
              if (family === "volume" && subOf.perMl && it.unit) {
                baseEquivalent = amount * UNIT_TO_BASE_FACTOR[it.unit] * subOf.perMl;
              } else {
                baseEquivalent = amount * (subOf.perCount !== undefined ? subOf.perCount : 1);
              }
              baseEquivalent *= entry.portionMultiplier;
            }
            if (!subprodutos[subOf.base]) subprodutos[subOf.base] = {};
            subprodutos[subOf.base][core] = (subprodutos[subOf.base][core] || 0) + baseEquivalent;
            if (!subprodutosMeta[subOf.base]) subprodutosMeta[subOf.base] = { pairs: {}, recipeNames: {} };
            subprodutosMeta[subOf.base].pairs[normalizeGroupKey(it.item) + "|" + (it.unit || "")] = { item: it.item, unit: it.unit || null };
            subprodutosMeta[subOf.base].recipeNames[recipe.name] = true;
            return;
          }
          // Despensa (Fase 2): item cuja quantidade típica é irrelevante frente ao pacote
          // doméstico sai da soma e vai pra seção própria — COM ou SEM número (o que decide
          // é o TIPO de item, não ter quantidade). Conjunto estrito em ShoppingDict.PANTRY_SET.
          if (ShoppingDict.isPantry(core)) {
            if (!pantry[core]) pantry[core] = { label: core, pairs: {}, recipeNames: {} };
            pantry[core].pairs[normalizeGroupKey(it.item) + "|" + (it.unit || "")] = { item: it.item, unit: it.unit || null };
            pantry[core].recipeNames[recipe.name] = true;
            return;
          }
          // "A gosto" (sem qty nem faixa) fora da despensa: não vira grupo próprio — se
          // existir linha quantificada do mesmo núcleo, encosta nela como "+ a gosto em N
          // receitas" (fim da dupla linha mapeada na investigação); senão, vira o grupo
          // "usado em" de sempre. Resolvido num pós-passe, depois de todos os grupos existirem.
          // Erva fresca em COLHERADA entra no mesmo caminho (decisão 2026-07-23): venda é por
          // maço, nem colher nem grama comparam com isso — a colherada vale como "sem
          // quantidade útil"; talos/ramos/folhas da mesma erva seguem contando normal.
          const herbSpoon =
            (it.unit === "colher-sopa" || it.unit === "colher-cha" || it.unit === "xicara") &&
            ShoppingDict.isSpoonNoQuantity(core);
          if (herbSpoon || ((it.qty === null || it.qty === undefined) && !it.qtyRange)) {
            if (!aGosto[core]) aGosto[core] = { pairs: {}, recipeNames: {} };
            aGosto[core].pairs[normalizeGroupKey(it.item) + "|" + (it.unit || "")] = { item: it.item, unit: it.unit || null };
            aGosto[core].recipeNames[recipe.name] = true;
            return;
          }
          // Fase 3B: sólido vendido por PESO mas medido em colher/xícara converte pra grama
          // JÁ NO ACÚMULO e entra no grupo de PESO do mesmo núcleo — o rótulo da embalagem é
          // em g ("12 g de cominho" compara com o vidro de 50 g; "2 colheres" não compara com
          // rótulo nenhum). Líquido não tem entrada na tabela e segue no fluxo de volume
          // (ml/L é a unidade de venda dele). Fora isso, peso e volume seguem NUNCA se
          // misturando (item 3) — a família entra na chave.
          const spoonGram = family === "volume" ? ShoppingDict.spoonToGram(core, it.unit) : null;
          const effFamily = spoonGram ? "peso" : family;
          const groupKey = core + "|" + (effFamily ? "FAM:" + effFamily : "UNIT:" + (it.unit || ""));
          if (!groups[groupKey]) {
            groups[groupKey] = { itemLabel: core, family: effFamily, literalUnit: it.unit || null, lo: 0, hi: 0, hasQuantity: false, pairs: {}, recipeNames: {}, unitsSeen: {} };
          }
          const g = groups[groupKey];
          g.pairs[normalizeGroupKey(it.item) + "|" + (it.unit || "")] = { item: it.item, unit: it.unit || null };
          g.recipeNames[recipe.name] = true;
          // Quais unidades ORIGINAIS alimentaram o grupo — decide a unidade de EXIBIÇÃO do
          // total da família volume (Fase 3A): ml de verdade força ml/L; só colheradas exibe
          // em colher/xícara de novo (ninguém lê "15 ml de sementes de cominho").
          if (it.unit) g.unitsSeen[it.unit] = true;

          const factor = spoonGram ? spoonGram : effFamily ? UNIT_TO_BASE_FACTOR[it.unit] : 1;
          if (it.qty !== null && it.qty !== undefined) {
            const v = it.qty * entry.portionMultiplier * factor;
            g.lo += v;
            g.hi += v;
            g.hasQuantity = true;
          } else if (it.qtyRange) {
            g.lo += it.qtyRange[0] * entry.portionMultiplier * factor;
            g.hi += it.qtyRange[1] * entry.portionMultiplier * factor;
            g.hasQuantity = true;
          }
        });
      });
    });

    // Pós-passe dos "a gosto": encosta na linha quantificada do MESMO núcleo (a com mais
    // receitas; desempate determinístico pela ordem das chaves) — os pares entram juntos pra
    // manter o checkbox sincronizado nas 2 visões. Núcleo só com "a gosto" vira grupo normal
    // sem quantidade (exibição "usado em", como sempre).
    Object.keys(aGosto).forEach((core) => {
      const candidates = Object.keys(groups).filter((k) => groups[k].itemLabel === core && groups[k].hasQuantity).sort();
      let targetKey = null;
      candidates.forEach((k) => {
        if (!targetKey || Object.keys(groups[k].recipeNames).length > Object.keys(groups[targetKey].recipeNames).length) targetKey = k;
      });
      if (targetKey) {
        const g = groups[targetKey];
        Object.assign(g.pairs, aGosto[core].pairs);
        g.aGostoCount = Object.keys(aGosto[core].recipeNames).length;
        Object.keys(aGosto[core].recipeNames).forEach((n) => { g.recipeNames[n] = true; });
      } else {
        groups[core + "|UNIT:"] = { itemLabel: core, family: null, literalUnit: null, lo: 0, hi: 0, hasQuantity: false, pairs: aGosto[core].pairs, recipeNames: aGosto[core].recipeNames, unitsSeen: {} };
      }
    });

    // Pós-passe do sub-produto derivado: MÁXIMO entre os sub-produtos do MESMO item-base
    // (nunca soma — a mesma fruta rende raspas E suco ao mesmo tempo; dentro do MESMO
    // sub-produto as linhas já somaram normal, lá em cima, pelo próprio core). Soma por cima
    // do que o item-base já tinha de uso DIRETO (ex.: "3 ovos" puro, sem ser gema/clara de
    // ninguém) — mesmo grupo "base|UNIT:" onde o uso direto sem unidade já cai. Arredonda pra
    // cima (assimetria de risco). maxEquivalent 0 (a-gosto, ou sub-produto sem rendimento
    // conhecido tipo casca de parmesão) nunca inventa quantidade — só funde a receita.
    Object.keys(subprodutos).forEach((base) => {
      const maxEquivalent = Math.max(0, ...Object.values(subprodutos[base]));
      const targetKey = base + "|UNIT:";
      if (!groups[targetKey]) {
        groups[targetKey] = { itemLabel: base, family: null, literalUnit: null, lo: 0, hi: 0, hasQuantity: false, pairs: {}, recipeNames: {}, unitsSeen: {} };
      }
      const g = groups[targetKey];
      if (maxEquivalent > 0) {
        const rounded = Math.ceil(maxEquivalent - 1e-9);
        g.lo += rounded;
        g.hi += rounded;
        g.hasQuantity = true;
      }
      Object.assign(g.pairs, subprodutosMeta[base].pairs);
      Object.keys(subprodutosMeta[base].recipeNames).forEach((n) => { g.recipeNames[n] = true; });
    });

    const groupList = Object.keys(groups)
      .map((key) => {
        const g = groups[key];
        const pairs = Object.values(g.pairs);
        const recipeNames = Object.keys(g.recipeNames);
        let displayText;
        if (!g.hasQuantity) {
          // Item 5: sem quantidade nenhuma (a gosto) — só nome + de quais receitas vem, sem
          // número (nunca inventa quantidade).
          displayText = g.itemLabel.charAt(0).toUpperCase() + g.itemLabel.slice(1) + " — usado em: " + recipeNames.join(", ");
        } else if (g.family === "peso" && ShoppingDict.packageFor(g.itemLabel)) {
          // Vendido em embalagem de tamanho padrão universal (PACKAGE_SIZE): o peso somado
          // vira contagem de embalagens, arredondando pra CIMA (meia lata não se compra) —
          // "2 latas de 400 g de tomate pelado" compara direto com a prateleira; "800 g" não.
          const pack = ShoppingDict.packageFor(g.itemLabel);
          const nLo = Math.max(1, Math.ceil(g.lo / pack.grams));
          const nHi = Math.max(1, Math.ceil(g.hi / pack.grams));
          displayText =
            (nLo === nHi ? String(nHi) : nLo + "-" + nHi) +
            " " +
            (nHi === 1 ? pack.label : pack.labelPlural) +
            " de " + pack.grams + " g de " + g.itemLabel;
          if (g.aGostoCount) {
            displayText += " + a gosto em " + g.aGostoCount + (g.aGostoCount === 1 ? " receita" : " receitas");
          }
        } else {
          // Formata de volta pra unidade mais legível do total (nunca "3000 ml" — "3 litros").
          let displayUnit = g.literalUnit;
          let lo = g.lo;
          let hi = g.hi;
          if (g.family === "peso") {
            if (hi >= 1000) {
              displayUnit = "quilograma";
              lo /= 1000;
              hi /= 1000;
            } else {
              displayUnit = "grama";
            }
          } else if (g.family === "volume") {
            // Fase 3B: sólido tabelado já virou grama no acúmulo e erva em colherada virou
            // ocorrência sem quantidade — o que chega aqui é LÍQUIDO, cuja unidade de venda
            // é ml/L (limiar de sempre pra litros). Colher/xícara nunca é unidade final.
            if (hi >= 1000) {
              displayUnit = "litro";
              lo /= 1000;
              hi /= 1000;
            } else {
              displayUnit = "mililitro";
            }
          }
          // Flexão de plural SÓ aqui (visão Geral, núcleo canônico) e SÓ pra grupo de
          // contagem sem unidade — "4 cebolas", não "4 cebola". Com unidade o item é
          // invariável e quem flexiona é a unidade, já feito no UNIT_DISPLAY ("4 dentes de
          // alho", "100 g de cebola"). Faixa flexiona pelo limite superior ("1-2 cebolas").
          // Total exatamente 1 (ou fração) fica no singular; núcleo fora de PLURALS
          // (massa/invariável) nunca flexiona. A tela de receita segue usando o texto
          // original de ingredientsStructured — nada muda lá.
          // Contagem (family null: sem unidade OU unidade discreta tipo dente/folha/fatia)
          // NUNCA mostra fração na lista de compras — não se compra meio abacate. Arredonda
          // pra CIMA (precisa cobrir a receita). Peso/volume não passam por aqui (já formatam
          // em g/ml inteiro; kg/L com 1 decimal é venda, não fração). A tela de receita segue
          // com a fração de sempre ("1/2 abacate") via o formatStructuredItem do stepper.
          if (g.family !== "peso" && g.family !== "volume") {
            lo = Math.ceil(lo - 1e-9);
            hi = Math.ceil(hi - 1e-9);
          }
          let displayLabel = g.itemLabel;
          if (!displayUnit && hi > 1) displayLabel = ShoppingDict.pluralFor(g.itemLabel) || g.itemLabel;
          // Reaproveita formatStructuredItem (mesma função do multiplicador de porções) — um
          // item sintético com o total já somado, ratio 1 (não escala de novo, só formata).
          const synthItem = { qty: lo === hi ? lo : null, qtyRange: lo === hi ? null : [lo, hi], unit: displayUnit, item: displayLabel, prep: null, alt: null, optional: false };
          displayText = formatStructuredItem(synthItem, 1);
          if (g.aGostoCount) {
            displayText += " + a gosto em " + g.aGostoCount + (g.aGostoCount === 1 ? " receita" : " receitas");
          }
        }
        return { key, displayText, pairs, hasQuantity: g.hasQuantity, itemLabel: g.itemLabel };
      })
      // Agrupamento por corredor de mercado (2026-07-24): mesma seção fica contígua na ordem
      // de SECTION_ORDER (Despensa não entra aqui — já sai antes, em isPantry); dentro da
      // mesma seção, alfabética de sempre como desempate. Sem cabeçalho visível — só reordena.
      .sort((a, b) => {
        const sectionDiff =
          ShoppingDict.SECTION_ORDER.indexOf(ShoppingDict.sectionFor(a.itemLabel)) -
          ShoppingDict.SECTION_ORDER.indexOf(ShoppingDict.sectionFor(b.itemLabel));
        return sectionDiff || a.itemLabel.localeCompare(b.itemLabel, "pt-BR");
      });

    const preparoList = Object.keys(preparos)
      .map((k) => ({ label: preparos[k].label, recipeNames: Object.keys(preparos[k].recipeNames) }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

    const pantryList = Object.keys(pantry)
      .map((core) => ({ label: pantry[core].label, count: Object.keys(pantry[core].recipeNames).length, pairs: Object.values(pantry[core].pairs) }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

    return { groups: groupList, pantry: pantryList, preparos: preparoList };
  }

  let listaComprasView = "geral";
  // Colapso por receita na visão Por receita — estado só de UI (não persiste), não afeta as
  // outras receitas. Chave ausente/false = expandida (comportamento de sempre).
  let collapsedShoppingRecipes = {};

  function renderListaCompras() {
    activeCat = null;
    refreshActiveCounts = null;
    // Sem cabeçalho: o nome da aba já aparece na barra inferior (mesmo padrão de Pesquisar/Preparos).
    header.innerHTML = "";
    content.innerHTML = "";
    progressEl.textContent = "";

    const toggleEl = document.createElement("div");
    toggleEl.className = "shopping-list__tabs";
    toggleEl.innerHTML =
      '<button type="button" class="shopping-list__tab' +
      (listaComprasView === "porReceita" ? " is-active" : "") +
      '">Por receita</button>' +
      '<button type="button" class="shopping-list__tab' +
      (listaComprasView === "geral" ? " is-active" : "") +
      '">Geral</button>';
    const tabButtons = toggleEl.querySelectorAll(".shopping-list__tab");
    tabButtons[0].addEventListener("click", () => {
      if (listaComprasView === "porReceita") return;
      listaComprasView = "porReceita";
      renderListaCompras();
    });
    tabButtons[1].addEventListener("click", () => {
      if (listaComprasView === "geral") return;
      listaComprasView = "geral";
      renderListaCompras();
    });
    content.appendChild(toggleEl);

    const recipeEntries = Storage.getShoppingListRecipes();

    if (!recipeEntries.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Sua lista de compras está vazia. Adicione receitas pela tela de cada receita.";
      content.appendChild(empty);
      return;
    }

    // Só aparece com MAIS de 10 receitas na lista (contagem total, igual nas 2 visões — Por
    // receita/Geral leem o mesmo recipeEntries) — com poucas receitas, excluir 1 a 1 (botão
    // "x" por receita) já resolve, "Limpar lista inteira" só faz sentido valer a pena a partir
    // de uma lista grande. Ausência real do elemento (não opacidade/disabled).
    if (recipeEntries.length > 10) {
      const clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.className = "shopping-list__clear";
      clearBtn.textContent = "Limpar lista";
      clearBtn.addEventListener("click", () => {
        Storage.clearShoppingList();
        renderListaCompras();
      });
      content.appendChild(clearBtn);
    }

    if (listaComprasView === "geral") {
      renderShoppingListGeral();
    } else {
      renderShoppingListPorReceita(recipeEntries);
    }
  }

  // "Comprado" é uma chave COMPARTILHADA entre receitas (item normalizado + unit) — marcar
  // aqui precisa refletir em qualquer outra seção que tenha o mesmo ingrediente, por isso o
  // re-render é da tela inteira, não só da linha clicada (mesmo princípio simples já usado
  // em renderMinhasReceitas ao trocar de aba).
  function renderShoppingListPorReceita(recipeEntries) {
    recipeEntries.forEach((entry) => {
      const recipeItem = TagModel.findRecipeById(entry.recipeId);
      if (!recipeItem) return; // defensivo: receita não existe mais (renomeada/removida)
      const recipe = recipeItem.recipe;
      const structured = recipe.ingredientsStructured || [];
      // Colapso é só desta receita (collapsedShoppingRecipes por recipeId) — nunca afeta as
      // outras seções da lista. Reaproveita literalmente o acordeão do modal de filtro
      // (.filter-section/.filter-section__header/__label/__chevron/__body, .is-open) — mesmo
      // mecanismo já usado pros ingredientes da tela de receita, nenhuma classe nova de acordeão.
      const isOpen = !collapsedShoppingRecipes[entry.recipeId];

      const section = document.createElement("div");
      section.className = "shopping-list__recipe filter-section" + (isOpen ? " is-open" : "");

      const row = document.createElement("div");
      row.className = "shopping-list__recipe-row";
      // Colapsar/expandir é a ação mais usada da linha (nome-link e "x" são situacionais) —
      // por isso a área de toque dominante é a LINHA INTEIRA (row), não só o ícone pequeno do
      // chevron: qualquer clique que não caia especificamente no nome-link nem no "x" (ambos
      // com stopPropagation, área pequena e precisa de propósito) borbulha até aqui e
      // colapsa/expande. O botão do chevron continua existindo só pelo afordance visual/
      // foco de teclado (Enter/Space nele também borbulha até aqui) — não tem listener
      // próprio, pra nunca disparar 2x (1x nele + 1x na linha) no mesmo clique.
      row.addEventListener("click", () => {
        collapsedShoppingRecipes[entry.recipeId] = isOpen;
        renderListaCompras();
      });

      // Nome da receita É o link pra tela dela (.text-link, mesmo padrão do cook-title) —
      // área de toque PEQUENA e precisa de propósito (só a extensão visual do texto+ícone,
      // sem hit-padding extra) — ação situacional, stopPropagation pra nunca também colapsar.
      const nameLink = document.createElement("button");
      nameLink.type = "button";
      nameLink.className = "text-link shopping-list__recipe-name-link";
      nameLink.setAttribute("aria-label", "Ver receita de " + recipe.name);
      nameLink.innerHTML = "<span>" + recipe.name + "</span>" + iconSvg("arrowUpRight", "text-link__icon");
      nameLink.addEventListener("click", (e) => {
        e.stopPropagation();
        Router.toReceita(entry.recipeId, "lista-compras");
      });
      row.appendChild(nameLink);

      const chevronBtn = document.createElement("button");
      chevronBtn.type = "button";
      chevronBtn.className = "shopping-list__recipe-chevron";
      chevronBtn.setAttribute("aria-label", (isOpen ? "Recolher" : "Expandir") + " ingredientes de " + recipe.name);
      chevronBtn.innerHTML = iconSvg("chevronDown", "filter-section__chevron");
      // Sem listener próprio: um clique nele borbulha até o listener da ROW (acima) e colapsa
      // do mesmo jeito — ter os 2 disparava a ação 2x (abre e fecha de novo no mesmo clique).
      row.appendChild(chevronBtn);

      // "x" discreto pra excluir só ESSA receita da lista — mesmo visual do "x" de remover
      // preparo (.preparo-card__delete), nenhuma classe nova. Área de toque PEQUENA e precisa
      // de propósito (ação situacional) — stopPropagation pra nunca também colapsar a linha.
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "preparo-card__delete";
      deleteBtn.setAttribute("aria-label", "Remover " + recipe.name + " da lista de compras");
      deleteBtn.innerHTML = iconSvg("close", "preparo-card__delete-icon");
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        Storage.removeRecipeFromShoppingList(entry.recipeId);
        renderListaCompras();
      });
      row.appendChild(deleteBtn);

      section.appendChild(row);

      const ul = document.createElement("ul");
      ul.className = "filter-section__body ingredients-list checklist";

      (entry.selectedEntries || []).forEach((entryIndex) => {
        const structEntry = structured[entryIndex];
        if (!structEntry) return; // defensivo: índice não existe mais (dado da receita mudou)
        structEntry.items.forEach((it) => {
          const text = formatStructuredItem(it, entry.portionMultiplier);
          const bought = Storage.isShoppingItemBought(it.item, it.unit);
          const li = document.createElement("li");
          li.className = "shopping-list__item";
          // Sem botão de "ir pra receita" por item (removido — era redundante com o nome da
          // receita no cabeçalho da seção, .text-link, que já é o único link de navegação
          // desta tela desde que o cabeçalho ganhou nome+ícone clicável).
          li.innerHTML =
            '<label><input type="checkbox"' +
            (bought ? " checked" : "") +
            '><span class="' +
            (bought ? "struck" : "") +
            '">' +
            text +
            "</span></label>";
          li.querySelector('input[type="checkbox"]').addEventListener("change", () => {
            Storage.toggleShoppingItemBought(it.item, it.unit);
            renderListaCompras();
          });
          ul.appendChild(li);
        });
      });

      section.appendChild(ul);
      content.appendChild(section);
    });
  }

  // Visão Geral (Fase 2): 1 linha por grupo (buildShoppingListGroups), checkbox reflete/altera
  // TODOS os pares item+unit originais daquele grupo de uma vez — "comprado" fica marcado só
  // quando TODOS os pares originais já estão marcados; clicar alterna todos juntos. Nunca guarda
  // estado próprio: sempre lê/escreve via Storage.isShoppingItemBought/toggleShoppingItemBought,
  // o MESMO boughtKeys da visão Por receita.
  function renderShoppingListGeral() {
    const built = buildShoppingListGroups();
    const ul = document.createElement("ul");
    ul.className = "ingredients-list checklist";
    built.groups.forEach((g) => {
      const bought = g.pairs.every((p) => Storage.isShoppingItemBought(p.item, p.unit));
      const li = document.createElement("li");
      li.innerHTML =
        '<label><input type="checkbox"' +
        (bought ? " checked" : "") +
        '><span class="' +
        (bought ? "struck" : "") +
        '">' +
        g.displayText +
        "</span></label>";
      li.querySelector('input[type="checkbox"]').addEventListener("change", () => {
        const target = !bought;
        g.pairs.forEach((p) => {
          if (Storage.isShoppingItemBought(p.item, p.unit) !== target) Storage.toggleShoppingItemBought(p.item, p.unit);
        });
        renderListaCompras();
      });
      ul.appendChild(li);
    });
    content.appendChild(ul);

    // Despensa (Fase 2): itens do PANTRY_SET fora da soma — só nome + em quantas receitas
    // aparece, SEM número de quantidade. O CABEÇALHO é o que sinaliza a intenção (sem ele,
    // linha sem quantidade parece dado faltando). Checkbox igual ao da lista principal:
    // mesmo boughtKeys, via os pares {item, unit} originais.
    if (built.pantry.length) {
      const pantryTitle = document.createElement("div");
      pantryTitle.className = "shopping-list__pantry-title";
      pantryTitle.textContent = "Despensa — confira se já tem";
      content.appendChild(pantryTitle);

      const pantryUl = document.createElement("ul");
      pantryUl.className = "ingredients-list checklist";
      built.pantry.forEach((p) => {
        const bought = p.pairs.every((pr) => Storage.isShoppingItemBought(pr.item, pr.unit));
        const label = p.label.charAt(0).toUpperCase() + p.label.slice(1);
        const li = document.createElement("li");
        li.innerHTML =
          '<label><input type="checkbox"' +
          (bought ? " checked" : "") +
          '><span class="' +
          (bought ? "struck" : "") +
          '">' +
          label +
          '<span class="shopping-list__pantry-count"> — ' +
          p.count + (p.count === 1 ? " receita" : " receitas") +
          "</span></span></label>";
        li.querySelector('input[type="checkbox"]').addEventListener("change", () => {
          const target = !bought;
          p.pairs.forEach((pr) => {
            if (Storage.isShoppingItemBought(pr.item, pr.unit) !== target) Storage.toggleShoppingItemBought(pr.item, pr.unit);
          });
          renderListaCompras();
        });
        pantryUl.appendChild(li);
      });
      content.appendChild(pantryUl);
    }

    // Items isReference não são compra ("1 receita de hollandaise" não vai pro carrinho),
    // mas são informação útil de planejamento — seção própria no FIM da lista, sem checkbox
    // (não participam de boughtKeys), listando de quais receitas cada preparo vem.
    if (built.preparos.length) {
      const title = document.createElement("div");
      title.className = "shopping-list__preparos-title";
      title.textContent = "Preparos que você precisa fazer antes";
      content.appendChild(title);

      const pul = document.createElement("ul");
      pul.className = "ingredients-list shopping-list__preparos";
      built.preparos.forEach((p) => {
        const li = document.createElement("li");
        li.innerHTML =
          "<span>" + p.label.charAt(0).toUpperCase() + p.label.slice(1) + "</span>" +
          '<span class="shopping-list__preparos-recipes"> — ' + p.recipeNames.join(", ") + "</span>";
        pul.appendChild(li);
      });
      content.appendChild(pul);
    }
  }

// ---------- Tela "Minhas Receitas" (aba da barra inferior) ----------
  // Substitui o antigo placeholder + as antigas rotas standalone #/favoritos e #/historico
  // (removidas — nenhum link visível apontava pra elas, e depois desta tela existir elas
  // seriam um caminho redundante mostrando os mesmos dados de novo). Guarda a aba ativa numa
  // variável de módulo simples (sobrevive só entre re-renders desta tela, não persiste em
  // localStorage) pra alternar sem navegação de rota nenhuma.
  let minhasReceitasTab = "favoritas";
  const MINHAS_RECEITAS_TABS = [
    { id: "favoritas", label: "Favoritas", getIds: () => Storage.getAllFavorites(), empty: "Você ainda não marcou nenhum prato como favorito." },
    { id: "feitas", label: "Já Feitas", getIds: () => Storage.getAllMade(), empty: "Você ainda não marcou nenhum prato como feito." },
  ];

  function renderMinhasReceitas() {
    activeCat = null;
    refreshActiveCounts = null;
    // Sem cabeçalho: o nome da aba já aparece na barra inferior (mesmo padrão de Pesquisar/Preparos).
    header.innerHTML = "";
    content.innerHTML = "";
    progressEl.textContent = "";

    const tabsEl = document.createElement("div");
    tabsEl.className = "minhas-receitas__tabs";
    MINHAS_RECEITAS_TABS.forEach((tab) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "minhas-receitas__tab" + (tab.id === minhasReceitasTab ? " is-active" : "");
      btn.textContent = tab.label;
      btn.addEventListener("click", () => {
        if (minhasReceitasTab === tab.id) return;
        minhasReceitasTab = tab.id;
        renderMinhasReceitas();
      });
      tabsEl.appendChild(btn);
    });
    content.appendChild(tabsEl);

    const cfg = MINHAS_RECEITAS_TABS.find((t) => t.id === minhasReceitasTab);
    const ids = cfg.getIds();
    const items = ids.map((id) => TagModel.findRecipeById(id)).filter(Boolean);

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = cfg.empty;
      content.appendChild(empty);
    } else {
      // fromHash aqui é só "minhas-receitas" (rota sem query) — a aba ativa (minhasReceitasTab)
      // já é estado de módulo, sobrevive sozinha a sair/voltar sem precisar ir pra URL; só
      // precisamos que "Voltar" pare AQUI em vez de cair na categoria própria da receita.
      const fromHash = currentHashPath();
      items.forEach((item) => {
        content.appendChild(renderRecipeCard(item, { fromHash: fromHash }));
      });
    }
  }

  // ---------- Card de receita (usado na lista de categoria e na busca) ----------
  // Redesenho do card (docs/DESIGN-TOKENS.md): os 3 ícones de ação viraram 2 (já feito/
  // favoritar — "quero fazer" foi removido do app inteiro) e a barra de CTA "Ver receita"
  // saiu — o card inteiro é a área de toque (addEventListener de click no elemento raiz).
  // O coração de favoritar (canto direito do header, onde antes tinha um chevron — removido,
  // o coração já sinaliza interatividade daquela área sozinho) TEM que parar a propagação do
  // clique (stopPropagation), senão favoritar dispararia também a navegação pra receita. As
  // outras 2 ações (já feito/favoritar) continuam só na tela de receita própria
  // (renderReceita, .recipe-page-actions), sem mudança de comportamento lá além do ícone.
  function renderRecipeCard(item, opts) {
    opts = opts || {};
    const recipe = item.recipe;
    const card = document.createElement("div");
    card.className = "recipe-card";
    card.dataset.recipeName = recipe.name;

    card.addEventListener("click", () => {
      Router.toReceita(item.id, opts.fromHash);
    });
    card.setAttribute("aria-label", "Ver receita de " + recipe.name);
    makeKeyboardClickable(card);

    // ---------- foto 16:9, sangrando até as bordas do card (cantos superiores herdam
    // border-radius via overflow:hidden em .recipe-card — a foto em si não tem raio próprio) ----------
    const photo = document.createElement("div");
    photo.className = "recipe-card__photo placeholder";
    photo.innerHTML = iconSvg("photoOff", "photo-placeholder__icon");
    if (recipe.image) {
      applyImage(photo, recipe.image);
    } else {
      loadRecipeImage(recipe, photo);
    }
    card.appendChild(photo);

    // Coração: círculo flutuante sobre a foto (canto superior direito), mesma linguagem visual
    // do .chrome-float. NUNCA filho de `photo`: loadRecipeImage/applyImage fazem innerHTML=""
    // nesse elemento quando a foto resolve (mesmo o caminho "local" é assíncrono), o que
    // apagaria o botão se ele morasse dentro — por isso é irmão de `photo`, direto em `card`
    // (que é position:relative), e se sobrepõe por posicionamento, não por ordem no DOM.
    const isFav = Storage.isFavorite(item.id);
    const heartBtn = document.createElement("button");
    heartBtn.type = "button";
    heartBtn.className = "recipe-card__heart" + (isFav ? " is-favorite" : "");
    heartBtn.setAttribute("aria-label", isFav ? "Remover dos favoritos" : "Favoritar");
    heartBtn.innerHTML = HEART_ICON_SVG;
    heartBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const now = Storage.toggleFavorite(item.id);
      heartBtn.classList.toggle("is-favorite", now);
      heartBtn.setAttribute("aria-label", now ? "Remover dos favoritos" : "Favoritar");
    });
    card.appendChild(heartBtn);

    // ---------- faixa de conteúdo: nome + 1 chip (recipe-card__row) + descrição opcional
    // em 1 linha abaixo (ajuste de julgamento visual, 2026-07-25). País/meta/chip de
    // categoria continuam mortos em TODOS os contextos — só a descrição voltou, ver
    // docs/DESIGN-TOKENS.md e mobile-recipe-ui/SKILL.md ----------
    const body = document.createElement("div");
    body.className = "recipe-card__body";

    const row = document.createElement("div");
    row.className = "recipe-card__row";

    const name = document.createElement("h3");
    name.className = "recipe-card__name";
    name.textContent = recipe.name;
    row.appendChild(name);

    const cardTagId = singleCardTagId(item, opts);
    if (cardTagId) {
      row.appendChild(buildTagChipsEl([cardTagId], "recipe-card__tag"));
    }
    body.appendChild(row);

    if (recipe.desc) {
      const desc = document.createElement("div");
      desc.className = "recipe-card__desc";
      desc.textContent = recipe.desc;
      body.appendChild(desc);
    }

    card.appendChild(body);

    return card;
  }

  // ---------- Multiplicador de porções (usa ingredientsStructured pra escalar quantidade) ----------
  // Mesmos ids canônicos de unidade que o parser usou pra gerar ingredientsStructured (Fase 2b) —
  // grama/quilograma/mililitro/litro viram abreviação sem plural (g, kg, ml, L); o resto é
  // substantivo contável com singular/plural, que escolhemos conforme a quantidade escalada.
  const UNIT_DISPLAY = {
    grama: { abbr: "g" },
    quilograma: { abbr: "kg" },
    mililitro: { abbr: "ml" },
    litro: { abbr: "L" },
    "colher-sopa": { singular: "colher (sopa)", plural: "colheres (sopa)" },
    "colher-cha": { singular: "colher (chá)", plural: "colheres (chá)" },
    xicara: { singular: "xícara", plural: "xícaras" },
    dente: { singular: "dente", plural: "dentes" },
    pitada: { singular: "pitada", plural: "pitadas" },
    fio: { singular: "fio", plural: "fios" },
    fatia: { singular: "fatia", plural: "fatias" },
    folha: { singular: "folha", plural: "folhas" },
    ramo: { singular: "ramo", plural: "ramos" },
    talo: { singular: "talo", plural: "talos" },
    posta: { singular: "posta", plural: "postas" },
    file: { singular: "filé", plural: "filés" },
    disco: { singular: "disco", plural: "discos" },
    pedaco: { singular: "pedaço", plural: "pedaços" },
    lata: { singular: "lata", plural: "latas" },
    pacote: { singular: "pacote", plural: "pacotes" },
    gomo: { singular: "gomo", plural: "gomos" },
    copo: { singular: "copo", plural: "copos" },
    punhado: { singular: "punhado", plural: "punhados" },
    fava: { singular: "fava", plural: "favas" },
  };

  // Arredondamento depende da NATUREZA da unidade — objeto físico marcado em fração (xícara,
  // colher-sopa, colher-cha) aceita as 5 frações de cozinha de sempre; grama/mililitro (base de
  // peso/volume) e quilograma/litro (múltiplo) nunca mostram fração (ninguém mede "1/3 de
  // grama" ou "1,5 1/2 kg" — só faz sentido pra utensílio marcado); contagem (dente, folha,
  // objeto sem unidade tipo "2 cebolas", etc.) só aceita a metade (1/2 dente faz sentido, 1/3 ou
  // 1/4 de dente não — ninguém fala assim), o resto vira inteiro mais próximo.
  const COMMON_FRACTIONS = [
    [0.25, "1/4"],
    [1 / 3, "1/3"],
    [0.5, "1/2"],
    [2 / 3, "2/3"],
    [0.75, "3/4"],
  ];
  const HALF_ONLY_FRACTIONS = [[0.5, "1/2"]];
  const FRACTION_UNITS = ["xicara", "colher-sopa", "colher-cha"];
  const FRACTION_EPS = 0.04;
  function formatQty(value, unit) {
    // grama/mililitro: unidade-base de peso/volume — inteiro, sem fração, sem decimal.
    if (unit === "grama" || unit === "mililitro") {
      return String(Math.max(0, Math.round(value)));
    }
    // quilograma/litro: múltiplo — 1 casa decimal com vírgula (convenção já usada no texto
    // original, ex. "1,5 kg"), nunca fração.
    if (unit === "quilograma" || unit === "litro") {
      return String(Math.round(value * 10) / 10).replace(".", ",");
    }

    const intPart = Math.floor(value + 1e-9);
    const frac = value - intPart;
    if (frac < FRACTION_EPS || frac > 1 - FRACTION_EPS) {
      return String(Math.max(0, Math.round(value)));
    }
    const isFractionUnit = FRACTION_UNITS.indexOf(unit) !== -1;
    const fractions = isFractionUnit ? COMMON_FRACTIONS : HALF_ONLY_FRACTIONS;
    for (const [target, label] of fractions) {
      if (Math.abs(frac - target) < FRACTION_EPS) {
        return (intPart > 0 ? intPart + " " : "") + label;
      }
    }
    if (isFractionUnit) {
      // Nenhuma mudança de comportamento aqui — mesmo fallback decimal de sempre.
      return String(Math.round(value * 10) / 10).replace(".", ",");
    }
    // Contagem: não bateu em 1/2 nem tá perto de inteiro — nunca mostra 1/3/1/4/2/3/3/4 nem
    // decimal cru pra objeto discreto, arredonda pro inteiro mais próximo.
    return String(Math.max(0, Math.round(value)));
  }

  // Só escala qty/qtyRange (os únicos campos verdadeiramente numéricos do schema). prep/alt/group
  // ficam como texto puro original, sem tentar escalar números que porventura apareçam dentro
  // deles (ex.: "cerca de 4 cm de espessura" no prep) — são texto livre, não campo estruturado,
  // e escalar um número solto dentro de texto livre arriscaria acertar a coisa errada.
  function scaleQtyField(it, ratio) {
    if (it.qty !== null && it.qty !== undefined) {
      const scaled = it.qty * ratio;
      return { qtyText: formatQty(scaled, it.unit), refQty: scaled, isRange: false };
    }
    if (it.qtyRange) {
      const lo = it.qtyRange[0] * ratio;
      const hi = it.qtyRange[1] * ratio;
      return { qtyText: formatQty(lo, it.unit) + "-" + formatQty(hi, it.unit), refQty: hi, isRange: true };
    }
    return { qtyText: "", refQty: null, isRange: false }; // sem qty (a gosto, referência, etc.) — nunca inventa número
  }

  function formatStructuredItem(it, ratio) {
    const { qtyText, refQty, isRange } = scaleQtyField(it, ratio);
    let unitText = "";
    if (it.unit) {
      const u = UNIT_DISPLAY[it.unit];
      if (u && u.abbr) unitText = u.abbr;
      else if (u) unitText = isRange || refQty === null || Math.round(refQty) !== 1 ? u.plural : u.singular;
      else unitText = it.unit;
    }
    let head;
    if (qtyText) {
      head = [qtyText, unitText].filter(Boolean).join(" ") + (unitText ? " de " : " ") + it.item;
    } else {
      head = it.item.charAt(0).toUpperCase() + it.item.slice(1);
    }
    let extra = "";
    if (it.prep) extra += ", " + it.prep;
    if (it.alt) extra += " (ou " + it.alt + ")";
    if (it.optional) extra += " (opcional)";
    return head + extra;
  }

  function formatStructuredEntry(entry, ratio) {
    const itemsText = entry.items.map((it) => formatStructuredItem(it, ratio)).join("; ");
    return entry.group ? "Para " + entry.group + ": " + itemsText : itemsText;
  }

  // Extrai o número-base de porções do texto livre de recipe.yield (ex.: "4 porções" -> 4,
  // "4-6 porções" -> 4 com sufixo " porções", "1 pão grande" -> 1 com sufixo " pão grande"). Só
  // habilita o multiplicador quando o texto COMEÇA com um número — formas como "≈ 500 ml",
  // "Para 1 prato", "Conforme a peça" ficam de fora (o número não está numa posição segura pra
  // extrair sem ambiguidade); nesses casos o yield aparece como sempre, sem controle interativo,
  // em vez de arriscar uma base errada.
  function parseYieldBase(yieldText) {
    if (!yieldText) return null;
    const m = String(yieldText).trim().match(/^(\d+)(?:\s*[-–]\s*\d+)?\s*(.*)$/);
    if (!m) return null;
    const base = parseInt(m[1], 10);
    if (!base || base <= 0) return null;
    return { base, suffix: m[2] };
  }

  // ---------- Página própria da receita ----------
  function renderReceita(id, fromHash) {
    const item = TagModel.findRecipeById(id);
    if (!item) {
      renderHome();
      return;
    }
    // Rastreamento de "últimas receitas visitadas" (só infraestrutura por ora, sem UI de
    // carrossel ainda — ver Storage.getRecentlyViewed em storage.js). Grava só quando a receita
    // é encontrada de verdade (depois do guard acima), nunca por um id inválido/removido.
    Storage.recordRecipeView(id);
    const recipe = item.recipe;
    const catId = item.catId;
    const cat = window.CATEGORIES.find((c) => c.id === catId);
    // Rótulo do botão ("Voltar para X"): deriva de ONDE o fromHash aponta — só pra EXIBIÇÃO. A
    // navegação de volta (abaixo, no addEventListener) usa fromHash inteiro direto, nunca
    // reconstrói a rota a partir de um id sozinho — é isso que preserva tags/role/imode (coleção)
    // ou tags/text/imode (busca), e que faz "Minhas Receitas" voltar pra lá em vez de cair na
    // categoria própria da receita (a aba ativa lá é estado de módulo, sobrevive sozinha).
    const fromCollectionId = fromHash && fromHash.indexOf("categoria/") === 0 ? fromHash.slice("categoria/".length).split("?")[0] : null;
    const backCollection = fromCollectionId && window.COLLECTIONS.find((c) => c.id === fromCollectionId);
    const fromBusca = !!fromHash && fromHash.indexOf("busca") === 0;
    const fromMinhasReceitas = !!fromHash && fromHash.indexOf("minhas-receitas") === 0;
    // "home" é fromHash PÚBLICO e documentado (contrato do carrossel "Vistas recentemente" da
    // Home, ver buildRecentlyViewedSection acima e product-navigation-ux/SKILL.md). Checagem
    // EXPLÍCITA, não só pra navegação (parseHash já trata à parte) — sem isto o RÓTULO abaixo
    // cairia no "cat ? cat.label : catId", mostrando a categoria da receita como se fosse a
    // origem, mesmo o clique realmente voltando pra Home.
    const fromHome = fromHash === "home";
    const fromListaCompras = !!fromHash && fromHash.indexOf("lista-compras") === 0;
    const fromPreparos = !!fromHash && fromHash.indexOf("preparos") === 0;

    activeCat = catId;
    refreshActiveCounts = null;

    header.innerHTML = "";
    content.innerHTML = "";
    progressEl.textContent = "";

    const page = document.createElement("div");
    page.className = "recipe-page";

    // Flutuante (acompanha o scroll, ver .back-float no CSS) — substitui o antigo back-button
    // fixo no topo do fluxo. Rótulo vira aria-label (o botão não tem mais texto visível, só o
    // ícone chevron-esquerda), preservando o mesmo contexto que o texto antigo dava.
    const backDestLabel = backCollection ? backCollection.label : fromBusca ? "Pesquisar" : fromMinhasReceitas ? "Minhas Receitas" : fromHome ? "Início" : fromListaCompras ? "Lista de Compras" : fromPreparos ? "Preparos" : cat ? cat.label : catId;
    page.appendChild(
      createBackFloat(backDestLabel, () => {
        // Volta pro hash de origem EXATO (mesmas tags/role/imode na coleção, tags/text/imode na
        // busca, ou só a rota certa pra Minhas Receitas) quando disponível — só cai no
        // Router.toCategoria "seco" (sem filtro) quando a receita foi aberta sem NENHUM contexto
        // de origem (ex. link direto/bookmark sem fromHash).
        if (fromHash) Router.navigate(fromHash);
        else Router.toCategoria(backCollection ? backCollection.id : catId);
      })
    );

    const hero = document.createElement("div");
    hero.className = "recipe-hero placeholder";
    hero.innerHTML = iconSvg("photoOff", "photo-placeholder__icon");
    if (recipe.image) {
      applyImage(hero, recipe.image);
    } else {
      loadRecipeImage(recipe, hero);
    }
    page.appendChild(hero);

    // Coração sobre a foto (item 1 de "Deixar pro Fable, depois") — substitui Favoritar da
    // linha de botões (docs/DESIGN-TOKENS.md). Elemento IRMÃO de hero, NUNCA filho: hero pode
    // ter innerHTML substituído de forma ASSÍNCRONA por applyImage()/loadRecipeImage() assim
    // que a foto resolve — um coração aninhado dentro do hero seria apagado nesse momento.
    // .recipe-hero__heart (CSS) cuida da camada/posição fixa; aqui só ícone + estado + clique,
    // mesmo padrão de renderFavBtn de antes, sem a troca de estrutura (agora é sempre só ícone).
    const isFav = Storage.isFavorite(item.id);
    const heart = document.createElement("button");
    heart.type = "button";
    function renderHeart(fav) {
      heart.className = "recipe-hero__heart" + (fav ? " is-favorite" : "");
      heart.innerHTML = HEART_ICON_SVG;
      heart.setAttribute("aria-label", fav ? "Favoritado" : "Favoritar");
    }
    renderHeart(isFav);
    heart.addEventListener("click", () => {
      const now = Storage.toggleFavorite(item.id);
      renderHeart(now);
    });
    page.appendChild(heart);

    const titleBlock = document.createElement("div");
    titleBlock.className = "recipe-page-title";
    titleBlock.innerHTML =
      "<h2>" + recipe.name + "</h2>" +
      (recipe.origin ? '<div class="origin">' + recipe.origin + "</div>" : "") +
      (recipe.desc ? '<p class="page-desc">' + recipe.desc + "</p>" : "");
    page.appendChild(titleBlock);

    // Tags (spec funil 3c) — DEPOIS do título/descrição, ANTES dos metadados (era o inverso).
    // País SAI da fileira aqui (rodada 3, revisão do dono) — decisão REVERSÍVEL, só nesta
    // tela: a linha de origem (recipe.origin, já mostrada em titleBlock acima) já dá essa
    // informação, chip duplicaria a mesma redundância eliminada no card. TAG_CHIP_PRIORITY/
    // priorityTagIds continuam intocados — busca e filtros em outras telas seguem vendo
    // country: normalmente, o filtro é só no INPUT desta função.
    const nonCountryTags = (item.tags || []).filter((t) => t.indexOf("country:") !== 0);
    const pageTagIds = priorityTagIds(nonCountryTags, 8);
    if (pageTagIds.length) {
      page.appendChild(buildTagChipsEl(pageTagIds, "recipe-page-tags"));
    }

    // Metadados em BLOCOS ROTULADOS (spec funil 3d, docs/DESIGN-TOKENS.md) — Total/Preparo/
    // Cozimento/Dificuldade, cada um só quando o dado existe. Porções SAIU daqui — foi pro
    // cabeçalho de Ingredientes, mais abaixo (decisão antiga, perto da lista que ela afeta).
    const metaRow = document.createElement("div");
    metaRow.className = "recipe-page-meta";
    function metaBlock(label, value) {
      const block = document.createElement("div");
      block.className = "recipe-meta-block";
      block.innerHTML =
        '<span class="recipe-meta-block__label">' + label + "</span>" +
        '<span class="recipe-meta-block__value">' + value + "</span>";
      return block;
    }
    if (recipe.time && recipe.time.total) metaRow.appendChild(metaBlock("Total", recipe.time.total));
    if (recipe.time && recipe.time.prep) metaRow.appendChild(metaBlock("Preparo", recipe.time.prep));
    if (recipe.time && recipe.time.cook) metaRow.appendChild(metaBlock("Cozimento", recipe.time.cook));
    if (recipe.difficulty) metaRow.appendChild(metaBlock("Dificuldade", recipe.difficulty));
    if (metaRow.children.length) page.appendChild(metaRow);

    // CTA primário (spec funil 3e) — ANTES dos 2 secundários agora (era o inverso).
    if (recipe.steps && recipe.steps.length) {
      const cookBtn = document.createElement("button");
      cookBtn.className = "primary-cta";
      cookBtn.textContent = "Começar preparo";
      // Captura o multiplicador ATUAL do stepper (currentRatio(), definido mais abaixo perto de
      // Ingredientes — function declaration é hoisted, e o clique só executa depois do render
      // inteiro terminar, então a ordem textual aqui não importa) e leva pro modo de preparo via
      // URL — só é usado se for criar uma sessão nova (Fase 2); retomar uma sessão em andamento
      // ignora isso e usa o portionMultiplier já salvo nela.
      cookBtn.addEventListener("click", () => Router.toCozinhar(item.id, fromHash, currentRatio()));
      page.appendChild(cookBtn);
    }

    // Secundários lado a lado (spec funil 3f) — Favoritar SAIU (virou o coração sobre a foto,
    // acima). Só 2 agora: Já fiz + Adicionar à lista de compras.
    const actions = document.createElement("div");
    actions.className = "recipe-page-actions";

    const isMade = Storage.isMade(item.id);
    const madeBtn = document.createElement("button");
    madeBtn.className = "action-btn" + (isMade ? " active" : "");
    madeBtn.textContent = isMade ? "Já fiz" : "Marcar como feita";
    madeBtn.addEventListener("click", () => {
      const now = Storage.toggleMade(item.id);
      madeBtn.classList.toggle("active", now);
      madeBtn.textContent = now ? "Já fiz" : "Marcar como feita";
    });
    actions.appendChild(madeBtn);

    // Adicionar à lista de compras: toggle de verdade — adiciona TODAS as entries de
    // ingredientsStructured de uma vez (sem UI de selecionar item por item), capturando o
    // portionMultiplier ATUAL do stepper (currentRatio(), mesmo padrão do cookBtn acima).
    // Clicar de novo com a receita já na lista REMOVE (Storage.removeRecipeFromShoppingList) —
    // desfaz a ação, volta pro estado "Adicionar". Mesmo caminho de remoção do "x" na visão Por
    // receita da própria Lista de Compras.
    const shoppingBtn = document.createElement("button");
    shoppingBtn.type = "button";
    function renderShoppingBtn(inList) {
      shoppingBtn.className = "action-btn" + (inList ? " active" : "");
      shoppingBtn.textContent = inList ? "Na lista de compras" : "Adicionar à lista de compras";
    }
    renderShoppingBtn(Storage.isRecipeInShoppingList(item.id));
    shoppingBtn.addEventListener("click", () => {
      if (Storage.isRecipeInShoppingList(item.id)) {
        Storage.removeRecipeFromShoppingList(item.id);
        renderShoppingBtn(false);
        return;
      }
      const entries = recipe.ingredientsStructured || [];
      const entryIndexes = entries.map((_, i) => i);
      Storage.addRecipeToShoppingList(item.id, currentRatio(), entryIndexes);
      renderShoppingBtn(true);
    });
    actions.appendChild(shoppingBtn);

    page.appendChild(actions);

    // Multiplicador de porções (usa ingredientsStructured) — REALOCADO (spec funil 3g) pro
    // cabeçalho de Ingredientes, perto da lista que ele afeta (decisão antiga). Só entra quando
    // o yield COMEÇA com um número seguro de extrair (parseYieldBase) — senão mostra o texto de
    // sempre, sem controle, pra não arriscar uma base errada. Mesmo mecanismo de antes, só
    // mudou de LOCAL (ia direto em .recipe-page-meta).
    const yieldInfo = parseYieldBase(recipe.yield);
    let stepperInput = null;
    function currentRatio() {
      if (!yieldInfo) return 1;
      const v = parseInt(stepperInput.value, 10);
      return (v && v > 0 ? v : yieldInfo.base) / yieldInfo.base;
    }

    // Ingredientes vem minimizado por padrão (docs/DESIGN-TOKENS.md) — reaproveita o mesmo
    // mecanismo de acordeão do modal de filtro (.filter-section/.is-open, .filter-section__body
    // escondido/mostrado via display:none/flex, .filter-section__chevron gira 180deg), em vez
    // de criar um padrão novo. Diferença desta rodada: o CABEÇALHO deixou de ser um único botão
    // grande (.ingredients-toggle) — agora é uma linha (.ingredients-header) com o título, as
    // porções (stepper OU texto de yield não-numérico) e um chevron DISCRETO
    // (.ingredients-collapse-btn) que é o único gatilho de colapso. Precisa ser assim porque o
    // stepper mora no mesmo cabeçalho e seus próprios cliques (+/-, digitar) não podem
    // borbulhar pro toggle do acordeão.
    const ingSection = document.createElement("div");
    ingSection.className = "recipe-page-section filter-section is-open";
    const ingredientsList = recipe.ingredients || [];
    // ingredientsStructured (Fase 2b) tem 1 entrada por linha de ingredients, mesma ordem — usado
    // pra escalar a exibição quando o multiplicador de porções muda. Se a receita não tiver o
    // campo (não deveria acontecer, as 398 já foram cobertas), cai pro raw sem escalar, sem quebrar.
    const structuredList = recipe.ingredientsStructured || null;

    // Lista SÓ LEITURA a partir daqui (Fase 1 da Lista de Compras) — o check de "comprado"
    // saiu inteiramente pra Lista de Compras (Storage.toggleIngredient/checkedIngredients
    // foram removidos de storage.js). Sem <input type="checkbox">, sem classe "checklist"
    // (volta a usar o marcador de bullet padrão de .ingredients-list, não o checkbox).
    function ingredientItemsHtml(ratio) {
      return ingredientsList
        .map((ing, i) => {
          const entry = structuredList && structuredList[i];
          const text = entry ? formatStructuredEntry(entry, ratio) : ing;
          return "<li>" + text + "</li>";
        })
        .join("");
    }

    function refreshIngredients() {
      const ul = ingSection.querySelector(".ingredients-list");
      if (!ul) return; // stepper pode disparar antes do acordeão existir, nunca acontece na prática mas evita erro
      ul.innerHTML = ingredientItemsHtml(currentRatio());
    }

    const ingHeader = document.createElement("div");
    ingHeader.className = "ingredients-header";
    // Leva final de sobras (2026-07-26): contador saiu daqui — "(N)" ao lado de "Ingredientes"
    // desalinhava o header expandido com a linha de porções+chevron (achado do dono). A
    // contagem sobrevive só no aria-label do estado colapsado, abaixo ("Ver ingredientes (N)").
    ingHeader.innerHTML = '<h4>Ingredientes</h4><div class="ingredients-header__controls"></div>';
    const ingControls = ingHeader.querySelector(".ingredients-header__controls");

    if (yieldInfo) {
      const stepperWrap = document.createElement("div");
      stepperWrap.className = "portion-stepper";
      stepperWrap.innerHTML =
        '<button type="button" class="portion-stepper__btn" data-dir="-1" aria-label="Diminuir porções">−</button>' +
        '<input type="number" class="portion-stepper__input" min="1" max="999" step="1" inputmode="numeric" ' +
        'aria-label="Número de porções" value="' +
        yieldInfo.base +
        '">' +
        '<button type="button" class="portion-stepper__btn" data-dir="1" aria-label="Aumentar porções">+</button>' +
        (yieldInfo.suffix ? '<span class="portion-stepper__suffix">' + yieldInfo.suffix + "</span>" : "");
      ingControls.appendChild(stepperWrap);
      stepperInput = stepperWrap.querySelector(".portion-stepper__input");
      stepperWrap.querySelectorAll(".portion-stepper__btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const dir = parseInt(btn.dataset.dir, 10);
          const v = Math.max(1, (parseInt(stepperInput.value, 10) || yieldInfo.base) + dir);
          stepperInput.value = v;
          refreshIngredients();
        });
      });
      stepperInput.addEventListener("input", () => {
        if (stepperInput.value !== "") refreshIngredients();
      });
      stepperInput.addEventListener("change", () => {
        let v = parseInt(stepperInput.value, 10);
        if (!v || v < 1) v = 1;
        if (v > 999) v = 999;
        stepperInput.value = v;
        refreshIngredients();
      });
    } else if (recipe.yield) {
      const yieldSpan = document.createElement("span");
      yieldSpan.className = "ingredients-yield-text";
      yieldSpan.textContent = recipe.yield;
      ingControls.appendChild(yieldSpan);
    }

    const collapseBtn = document.createElement("button");
    collapseBtn.type = "button";
    collapseBtn.className = "ingredients-collapse-btn";
    collapseBtn.setAttribute("aria-label", "Ocultar ingredientes");
    collapseBtn.innerHTML = iconSvg("chevronDown", "filter-section__chevron");
    collapseBtn.addEventListener("click", () => {
      const isOpen = ingSection.classList.toggle("is-open");
      collapseBtn.setAttribute("aria-label", isOpen ? "Ocultar ingredientes" : "Ver ingredientes (" + ingredientsList.length + ")");
    });
    ingControls.appendChild(collapseBtn);
    ingSection.appendChild(ingHeader);

    const ingBody = document.createElement("div");
    ingBody.className = "filter-section__body";
    ingBody.innerHTML = '<ul class="ingredients-list">' + ingredientItemsHtml(1) + "</ul>";
    ingSection.appendChild(ingBody);
    page.appendChild(ingSection);

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
    // Scroll (restaurar/topo) fica só em handleRoute agora — reaproveita o mapa por hash em vez
    // de sempre voltar pro topo aqui (ver comentário na declaração de scrollPositionsByHash).
  }

  // ---------- Modo cozinhar ----------
  function playBeep() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      [0, 0.35].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.001, ctx.currentTime + delay);
        gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + delay + 0.02);
        gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + delay + 0.3);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.3);
      });
    } catch (e) {}
  }

  // Roleta do timer (Fase B): 3 colunas independentes — Horas (0-4), Minutos (0-59), Segundos
  // (0-59, mesma granularidade de Minutos — era de 5 em 5 pra rolar mais rápido, mas isso
  // deixou de ser necessário depois que dá pra tocar no mostrador digital acima da roleta e
  // digitar o valor direto, ver enableDisplayTapToEdit abaixo). Substitui a roleta única da
  // Fase A (0-90 min corridos).
  const TIMER_WHEEL_HOURS = [0, 1, 2, 3, 4];
  const TIMER_WHEEL_MINUTES = (function () {
    const values = [];
    for (let m = 0; m <= 59; m++) values.push(m);
    return values;
  })();
  const TIMER_WHEEL_SECONDS = (function () {
    const values = [];
    for (let s = 0; s <= 59; s++) values.push(s);
    return values;
  })();
  function pad2(n) {
    return String(n).padStart(2, "0");
  }
  function formatBigTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return pad2(h) + ":" + pad2(m) + ":" + pad2(s);
  }
  // Igual formatBigTime, mas em partes — usado só no PARADO (renderTimerStopped), onde cada
  // parte (h/m/s) é um <span> tocável que vira campo editável (enableDisplayTapToEdit). O
  // RODANDO/PAUSADO continua com formatBigTime (texto plano, sem edição).
  function formatBigTimeParts(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return { h: pad2(h), m: pad2(m), s: pad2(s) };
  }

  function renderCookMode(id, fromHash, portionMultiplier) {
    const item = TagModel.findRecipeById(id);
    const recipe = item && item.recipe;
    if (!recipe || !recipe.steps || !recipe.steps.length) {
      Router.toReceita(id, fromHash);
      return;
    }
    const catId = item.catId;

    activeCat = catId;
    refreshActiveCounts = null;

    header.innerHTML = "";
    content.innerHTML = "";
    progressEl.textContent = "";

    const totalSteps = recipe.steps.length;
    const yieldInfo = parseYieldBase(recipe.yield);

    // Retoma sessão em andamento pra essa receita (passo atual + timer de cada passo) ou
    // começa uma nova — modo de preparo agora sobrevive a sair/voltar e a recarregar a
    // página (Storage, chave gusta-preparos-v1, ver storage.js). Uma sessão "concluida"
    // (já finalizada antes) NÃO é retomada — cozinhar de novo começa do passo 1. portionMultiplier
    // (capturado do stepper da tela de receita, ver cookBtn em renderReceita) só é usado ao
    // CRIAR sessão nova — retomar ignora o parâmetro e usa o que já estava salvo.
    const existingSession = Storage.getPreparoSession(id);
    const initialSession =
      existingSession && existingSession.status === "em-andamento"
        ? existingSession
        : Storage.startPreparoSession(id, portionMultiplier || 1);

    let stepIndex = Math.min(Math.max(initialSession.currentStep || 0, 0), totalSteps - 1);
    let timerInterval = null;

    const page = document.createElement("div");
    page.className = "cook-page";

    // Modo cozinhar continua SEM botão de voltar (regra fixa da skill product-navigation-ux) —
    // isto é "Sair", não "Voltar": vira pílula flutuante (mesma linguagem visual do back-float,
    // ver .chrome-float no CSS) em vez do antigo back-button textual, devolvendo o peso visual
    // que o glifo de fechar removido na Fase 0c dava (emoji nunca é ícone, nem em comentário).
    const exitBtn = createExitCookFloat(() => {
      // Bug do "timer fantasma" (corrigido aqui): antes, sair sem finalizar não limpava o
      // interval do timer — ele continuava rodando escondido (atualizando um timerBox já
      // desconectado do DOM) até a página recarregar de verdade. Passo atual e timer já ficam
      // persistidos a cada transição (troca de passo, iniciar/pausar/zerar) — não em cada
      // tick — então não há nada novo pra salvar aqui, só garantir que o interval pare.
      clearInterval(timerInterval);
      Router.toReceita(id, fromHash);
    });
    page.appendChild(exitBtn);

    const titleEl = document.createElement("div");
    titleEl.className = "cook-title";
    // Nome da receita É o link (.text-link — ícone arrowUpRight colado no texto, sem botão
    // circular separado, sem esticar full-width). Limpa o timerInterval igual o exitBtn faz
    // (mesmo bug do "timer fantasma" que motivou o clearInterval ali — sem isso, navegar
    // daqui deixaria o interval rodando escondido).
    const titleLink = document.createElement("button");
    titleLink.type = "button";
    titleLink.className = "text-link cook-title__link";
    titleLink.setAttribute("aria-label", "Ver receita de " + recipe.name);
    titleLink.innerHTML = "<span>" + recipe.name + "</span>" + iconSvg("arrowUpRight", "text-link__icon");
    titleLink.addEventListener("click", () => {
      clearInterval(timerInterval);
      Router.toReceita(id, fromHash);
    });
    titleEl.appendChild(titleLink);
    page.appendChild(titleEl);

    const progressWrap = document.createElement("div");
    progressWrap.className = "cook-progress";
    page.appendChild(progressWrap);

    const stepLabel = document.createElement("div");
    stepLabel.className = "cook-step-label";
    page.appendChild(stepLabel);

    const stepText = document.createElement("div");
    stepText.className = "cook-step-text";
    page.appendChild(stepText);

    // Quantidade por passo (Fase 2, usa stepIngredients — Fase 2a) — só aparece nos ~8% dos
    // passos que têm o campo preenchido (ver renderStep). Vazio/oculto no resto.
    const stepIngredientsEl = document.createElement("div");
    stepIngredientsEl.className = "cook-step-ingredients";
    page.appendChild(stepIngredientsEl);

    const navRow = document.createElement("div");
    navRow.className = "cook-nav";
    const prevBtn = document.createElement("button");
    prevBtn.className = "cook-nav-btn";
    prevBtn.textContent = "← Anterior";
    const nextBtn = document.createElement("button");
    nextBtn.className = "cook-nav-btn primary";
    navRow.appendChild(prevBtn);
    navRow.appendChild(nextBtn);
    page.appendChild(navRow);

    const timerBox = document.createElement("div");
    timerBox.className = "cook-timer";
    page.appendChild(timerBox);

    content.appendChild(page);

    // Timer por passo (não mais por sessão inteira): cada stepIndex tem seu próprio estado
    // {endsAt, remainingSeconds, running}, lido/gravado via Storage a cada transição (nunca a
    // cada tick de segundo). endsAt é horário absoluto — trocar de passo só troca QUAL timer
    // está na tela; um timer "rodando" que fica pra trás continua contando de verdade (é só
    // Date.now() vs endsAt), e ao voltar pro passo dele o restante é recalculado certo, mesmo
    // que a aba tenha sido fechada e reaberta no meio do caminho.
    // "started" (novo campo, aditivo — sessões antigas sem ele caem em "false", que é o
    // fallback seguro: mostra a roleta, igual sempre mostrou) distingue PARADO (nunca
    // iniciado desde o último Zerar/Cancelar — roleta visível) de PAUSADO (iniciado, contando
    // pausada agora — roleta continua escondida, só o texto do toggle muda pra "Continuar").
    // running sozinho não bastava pra isso: hoje "não rodando" cobria os 2 casos ao mesmo tempo.
    function getStepTimerState() {
      const s = Storage.getPreparoSession(id);
      const t = s && s.stepTimers && s.stepTimers[stepIndex];
      if (!t) return { endsAt: null, remainingSeconds: 0, running: false, started: false };
      // Migração leve: sessões de antes deste campo existir não tinham "started" — se já
      // estava rodando, é óbvio que tinha sido iniciada; senão cai no default seguro (mostra a
      // roleta, igual sempre mostrou).
      return t.started === undefined ? Object.assign({}, t, { started: !!t.running }) : t;
    }
    function currentRemainingSeconds() {
      const t = getStepTimerState();
      if (t.running && t.endsAt) return Math.max(0, Math.round((t.endsAt - Date.now()) / 1000));
      return t.remainingSeconds || 0;
    }
    function persistStepTimer(partial) {
      const merged = Object.assign({}, getStepTimerState(), partial);
      Storage.savePreparoStepTimer(id, stepIndex, merged);
    }
    function startTicking() {
      clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        if (currentRemainingSeconds() <= 0) {
          clearInterval(timerInterval);
          timerInterval = null;
          persistStepTimer({ endsAt: null, remainingSeconds: 0, running: false });
          playBeep();
        }
        updateTimerDisplay(); // só mostrador+botão — nunca redesenha as colunas (ver comentário abaixo)
      }, 1000);
    }

    // Só atualiza o mostrador digital e o texto Iniciar/Pausar — chamado a cada tick do
    // setInterval. NUNCA reconstrói as colunas (isso só acontece em renderTimer, em transições
    // discretas: trocar de passo, iniciar/pausar/zerar), senão o scroll "pularia" de volta pro
    // centro a cada segundo enquanto o timer conta — as colunas ficam congeladas no valor
    // escolhido durante a contagem, igual um timer de relógio nativo.
    function toggleLabelFor(state) {
      if (state.running) return "Pausar";
      return state.started ? "Continuar" : "Iniciar";
    }
    function updateTimerDisplay() {
      const displayEl = timerBox.querySelector(".cook-timer-display");
      if (displayEl) {
        // PARADO usa 3 <span data-unit> tocáveis (ver renderTimerStopped/enableDisplayTapToEdit)
        // — atualiza só o texto de cada um (nunca destrói os spans, senão perderia o listener de
        // clique). RODANDO/PAUSADO não tem esses spans -> cai no textContent plano de sempre.
        const parts = displayEl.querySelectorAll(".cook-timer-display__part");
        if (parts.length === 3) {
          // Se alguma part tem um <input> de edição aberto (enableDisplayTapToEdit), pula ela —
          // textContent destruiria o input em digitação; as outras 2 seguem atualizando normal.
          const p = formatBigTimeParts(currentRemainingSeconds());
          const vals = [p.h, p.m, p.s];
          for (let i = 0; i < 3; i++) {
            if (!parts[i].querySelector("input")) parts[i].textContent = vals[i];
          }
        } else {
          displayEl.textContent = formatBigTime(currentRemainingSeconds());
        }
      }
      const toggleBtn = timerBox.querySelector(".timer-toggle");
      if (toggleBtn) toggleBtn.textContent = toggleLabelFor(getStepTimerState());
    }

    // Acha o item de UMA coluna cujo centro REAL (getBoundingClientRect, não um número mágico
    // duplicado do CSS) está mais perto do centro vertical do wrapper — o item que o scroll-snap
    // encaixou no momento. Genérico: mesma função serve pras 3 colunas (Horas/Minutos/Segundos).
    function findCenteredWheelItem(wheelEl) {
      const wrapRect = wheelEl.getBoundingClientRect();
      const centerY = wrapRect.top + wrapRect.height / 2;
      let best = null;
      let bestDist = Infinity;
      wheelEl.querySelectorAll(".cook-timer-wheel__item").forEach((el) => {
        const r = el.getBoundingClientRect();
        const dist = Math.abs(r.top + r.height / 2 - centerY);
        if (dist < bestDist) {
          bestDist = dist;
          best = el;
        }
      });
      return best;
    }

    function markSelectedWheelItem(wheelEl, value) {
      wheelEl.querySelectorAll(".cook-timer-wheel__item").forEach((el) => {
        el.classList.toggle("is-selected", parseInt(el.dataset.value, 10) === value);
      });
    }

    // Posiciona UMA coluna no valor mais próximo do atual e marca selecionado — reaproveitado
    // pelas 3 colunas. Um valor salvo que não bate exato (ex.: sessão antiga da Fase A) só
    // encosta no mais próximo, sem sobrescrever nada até o usuário mexer de novo. animate=true
    // (usado só pela confirmação de digitação, ver enableDisplayTapToEdit) grava o alvo em
    // wheelEl.dataset.progTarget ANTES de disparar o scrollTo suave — bindColumnScroll usa esse
    // marcador pra saber que o settle em andamento é PROGRAMÁTICO (não dedo do usuário) e não
    // deve ler/commitar a roleta enquanto a animação não alcançou o alvo (ver bindColumnScroll).
    // O valor em si já foi commitado antes disso (onCommitValue, ver enableDisplayTapToEdit) —
    // esta função é só o visual da roleta acompanhando.
    function positionWheelColumn(wheelEl, values, currentValue, animate) {
      const nearest = values.reduce((a, b) => (Math.abs(b - currentValue) < Math.abs(a - currentValue) ? b : a));
      const targetItem = wheelEl.querySelector('.cook-timer-wheel__item[data-value="' + nearest + '"]');
      if (targetItem) {
        const targetTop = targetItem.offsetTop - (wheelEl.clientHeight - targetItem.offsetHeight) / 2;
        if (animate) {
          wheelEl.dataset.progTarget = String(targetTop);
          wheelEl.scrollTo({ top: targetTop, behavior: "smooth" });
        } else {
          wheelEl.scrollTop = targetTop;
        }
        markSelectedWheelItem(wheelEl, nearest);
      }
      return nearest;
    }

    // Campo de edição por toque (novo): tocar numa das 3 partes do MOSTRADOR DIGITAL acima da
    // roleta (.cook-timer-display__part, h/min/s — não a roleta em si) troca aquele número por
    // um <input inputmode="numeric"> ali mesmo, no lugar do texto — teclado numérico no
    // celular, nunca QWERTY completo. Confirma com Enter/blur, cancela com Esc (descarta, volta
    // ao valor anterior). Valor válido -> atualiza o texto na hora, chama onCommitValue(parsed)
    // (o chamador atribui a variável da coluna e persiste via commitCombined — o valor digitado
    // É a fonte de verdade no ato, nunca refém do settle do scroll) e só DEPOIS chama
    // positionWheelColumn(..., animate=true), que passa a ser puramente visual: a roleta rola
    // suave até a posição nova, mas o settle que a animação dispara (bindColumnScroll) é
    // idempotente — o valor já está persistido. min/max vêm do próprio array de valores
    // (contíguo desde que Segundos passou a ser 0-59 também).
    function enableDisplayTapToEdit(spanEl, wheelEl, values, getCurrentValue, onCommitValue) {
      const min = values[0];
      const max = values[values.length - 1];

      spanEl.setAttribute("aria-label", "Editar valor");
      makeKeyboardClickable(spanEl);
      spanEl.addEventListener("click", () => {
        if (spanEl.querySelector("input")) return; // já editando, ignora novo toque
        const previousText = spanEl.textContent;
        const previousValue = getCurrentValue();
        const input = document.createElement("input");
        input.type = "text";
        input.inputMode = "numeric";
        input.pattern = "[0-9]*";
        input.maxLength = 2;
        input.className = "cook-timer-display__edit-input";
        input.value = pad2(previousValue);
        spanEl.textContent = "";
        spanEl.appendChild(input);
        input.focus();
        input.select();

        let settled = false;
        function commit(cancel) {
          if (settled) return;
          settled = true;
          const parsed = parseInt(input.value, 10);
          if (!cancel && Number.isInteger(parsed) && parsed >= min && parsed <= max) {
            spanEl.textContent = pad2(parsed);
            onCommitValue(parsed);
            positionWheelColumn(wheelEl, values, parsed, true);
          } else {
            // Esc ou valor inválido (fora do intervalo, vazio, não-numérico): descarta, volta
            // ao texto de antes — nada muda na roleta nem no estado persistido.
            spanEl.textContent = previousText;
          }
        }
        input.addEventListener("blur", () => commit(false));
        input.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") input.blur();
          else if (ev.key === "Escape") commit(true);
        });
      });
    }

    // Fase C: PARADO mostra a roleta (3 colunas, agora compacta — 3 linhas visíveis em vez de
    // 5); RODANDO e PAUSADO escondem a roleta (só o mostrador digital fica, mais o toggle e um
    // botão novo, Cancelar) — a roleta some/aparece reaproveitando a MESMA animação de saída/
    // entrada do modal de filtro (filter-modal-in/out, CSS), nenhum keyframe novo. Sincroniza
    // com o MESMO estado de sempre (persistStepTimer/endsAt/started) — a UI só decide o que
    // mostrar a partir do estado, nunca fonte de verdade nova.
    function renderTimer() {
      const state = getStepTimerState();
      if (!state.started) renderTimerStopped(currentRemainingSeconds());
      else renderTimerActive(state);
    }

    // RODANDO ou PAUSADO — roleta já escondida (foi embora na transição pra "rodando", ver
    // renderTimerStopped). "Cancelar" é o único jeito de trazê-la de volta nesses 2 estados.
    function renderTimerActive(state) {
      timerBox.innerHTML =
        '<div class="cook-timer-display">' +
        formatBigTime(currentRemainingSeconds()) +
        "</div>" +
        '<div class="cook-timer-controls">' +
        '<button type="button" class="timer-toggle">' +
        toggleLabelFor(state) +
        "</button>" +
        '<button type="button" class="timer-cancel">Cancelar</button>' +
        "</div>";

      timerBox.querySelector(".timer-toggle").addEventListener("click", () => {
        if (getStepTimerState().running) {
          // Pausar: roleta já está escondida, nada pra animar aqui — só troca estado/texto.
          clearInterval(timerInterval);
          timerInterval = null;
          persistStepTimer({ endsAt: null, remainingSeconds: currentRemainingSeconds(), running: false });
          renderTimer();
          return;
        }
        // Continuar (retomar de pausado): roleta segue escondida, só a contagem retoma.
        const secs = currentRemainingSeconds();
        if (secs <= 0) return;
        persistStepTimer({ endsAt: Date.now() + secs * 1000, remainingSeconds: secs, running: true });
        startTicking();
        renderTimer();
      });

      timerBox.querySelector(".timer-cancel").addEventListener("click", () => {
        // Cancelar: para por completo E traz a roleta de volta com o valor que estava faltando
        // no instante do cancelamento. Precisa recalcular via currentRemainingSeconds() (não só
        // reaproveitar o remainingSeconds já salvo) porque, se cancelar durante a contagem
        // (running:true) sem antes pausar, o remainingSeconds salvo é o de antes de "Continuar" —
        // desatualizado. "Zerar" já existe pra zerar, depois que ela reaparecer. started:false é
        // o que faz renderTimer() cair no ramo "parado" de novo.
        const secs = currentRemainingSeconds();
        clearInterval(timerInterval);
        timerInterval = null;
        persistStepTimer({ endsAt: null, remainingSeconds: secs, running: false, started: false });
        renderTimer(); // roleta é um elemento NOVO no DOM -> animation:filter-modal-in toca sozinha
      });
    }

    // PARADO — roleta visível (3 colunas: Horas/Minutos/Segundos), MESMO mecanismo de
    // scroll-snap nativo de sempre, só triplicado (ver findCenteredWheelItem/
    // markSelectedWheelItem/positionWheelColumn acima, genéricas e reaproveitadas). Uma ÚNICA
    // faixa de destaque atravessa as 3 (.cook-timer-wheel-frame, CSS), não 3 molduras
    // separadas. Sincroniza com o MESMO estado — as 3 colunas só editam, juntas, o mesmo valor
    // único em segundos (h×3600 + min×60 + s).
    function renderTimerStopped(seconds) {
      let hVal = Math.min(4, Math.floor(seconds / 3600));
      let mVal = Math.floor((seconds % 3600) / 60);
      let sVal = seconds % 60;

      function buildColumn(values, unitLabel) {
        return (
          '<div class="cook-timer-wheel" role="listbox" aria-label="' +
          unitLabel +
          '">' +
          values.map((v) => '<div class="cook-timer-wheel__item" data-value="' + v + '">' + pad2(v) + "</div>").join("") +
          "</div>"
        );
      }

      const initialParts = formatBigTimeParts(seconds);
      timerBox.innerHTML =
        '<div class="cook-timer-display">' +
        '<span class="cook-timer-display__part" data-unit="h">' + initialParts.h + "</span>:" +
        '<span class="cook-timer-display__part" data-unit="m">' + initialParts.m + "</span>:" +
        '<span class="cook-timer-display__part" data-unit="s">' + initialParts.s + "</span>" +
        "</div>" +
        '<div class="cook-timer-wheel-wrap">' +
        '<div class="cook-timer-wheel-frame" aria-hidden="true"></div>' +
        '<div class="cook-timer-wheel-columns">' +
        buildColumn(TIMER_WHEEL_HOURS, "Horas") +
        buildColumn(TIMER_WHEEL_MINUTES, "Minutos") +
        buildColumn(TIMER_WHEEL_SECONDS, "Segundos") +
        "</div>" +
        "</div>" +
        '<div class="cook-timer-wheel-labels"><span>h</span><span>min</span><span>s</span></div>' +
        '<div class="cook-timer-controls">' +
        '<button type="button" class="timer-toggle">Iniciar</button>' +
        '<button type="button" class="timer-reset">Zerar</button>' +
        "</div>";

      const columns = timerBox.querySelectorAll(".cook-timer-wheel");
      const hoursWheel = columns[0];
      const minutesWheel = columns[1];
      const secondsWheel = columns[2];

      hVal = positionWheelColumn(hoursWheel, TIMER_WHEEL_HOURS, hVal);
      mVal = positionWheelColumn(minutesWheel, TIMER_WHEEL_MINUTES, mVal);
      sVal = positionWheelColumn(secondsWheel, TIMER_WHEEL_SECONDS, sVal);

      // Toda vez que QUALQUER coluna encaixa um valor novo, recombina as 3 (hVal/mVal/sVal
      // vivem na closure, atualizadas pelo settle de cada coluna) e persiste o total único —
      // nenhuma coluna decide sozinha.
      function commitCombined() {
        clearInterval(timerInterval);
        timerInterval = null;
        const total = hVal * 3600 + mVal * 60 + sVal;
        persistStepTimer({ endsAt: null, remainingSeconds: total, running: false });
        updateTimerDisplay();
      }
      // "settle" = a roleta parou de rolar (scroll-snap encaixou um item, dedo do usuário OU
      // scrollTo suave de positionWheelColumn(..., animate=true) terminou). Se wheelEl tem
      // dataset.progTarget (uma animação PROGRAMÁTICA está em curso — ver positionWheelColumn),
      // o settle só pode ler/commitar a roleta quando o scroll de fato ALCANÇOU esse alvo;
      // enquanto não alcançar, re-arma o mesmo timeout e retorna, nunca lê um valor
      // intermediário (era exatamente isso que revertia a digitação — settle disparando antes
      // de a animação chegar ao fim). Interação manual (pointerdown/touchstart/wheel) limpa
      // progTarget na hora, então o dedo do usuário sempre retoma o controle, nunca fica preso
      // num re-arme eterno.
      function bindColumnScroll(wheelEl, onSettle) {
        let scrollSettleTimeout = null;
        function settle() {
          if (wheelEl.dataset.progTarget !== undefined) {
            if (Math.abs(wheelEl.scrollTop - parseFloat(wheelEl.dataset.progTarget)) > 2) {
              scrollSettleTimeout = setTimeout(settle, 150);
              return;
            }
            delete wheelEl.dataset.progTarget;
          }
          const centered = findCenteredWheelItem(wheelEl);
          if (!centered) return;
          const newValue = parseInt(centered.dataset.value, 10);
          markSelectedWheelItem(wheelEl, newValue);
          onSettle(newValue);
          commitCombined();
        }
        wheelEl.addEventListener("scroll", () => {
          clearTimeout(scrollSettleTimeout);
          scrollSettleTimeout = setTimeout(settle, 150);
        });
        ["pointerdown", "touchstart", "wheel"].forEach((evt) => {
          wheelEl.addEventListener(
            evt,
            () => {
              delete wheelEl.dataset.progTarget;
            },
            { passive: true }
          );
        });
      }
      bindColumnScroll(hoursWheel, (v) => (hVal = v));
      bindColumnScroll(minutesWheel, (v) => (mVal = v));
      bindColumnScroll(secondsWheel, (v) => (sVal = v));

      // Tocar na parte correspondente do mostrador digital acima (h/min/s) edita por
      // digitação — segunda forma de definir valor, não substitui o arrasto manual na roleta
      // (ver comentário em enableDisplayTapToEdit).
      const displayEl = timerBox.querySelector(".cook-timer-display");
      enableDisplayTapToEdit(displayEl.querySelector('[data-unit="h"]'), hoursWheel, TIMER_WHEEL_HOURS, () => hVal, (v) => { hVal = v; commitCombined(); });
      enableDisplayTapToEdit(displayEl.querySelector('[data-unit="m"]'), minutesWheel, TIMER_WHEEL_MINUTES, () => mVal, (v) => { mVal = v; commitCombined(); });
      enableDisplayTapToEdit(displayEl.querySelector('[data-unit="s"]'), secondsWheel, TIMER_WHEEL_SECONDS, () => sVal, (v) => { sVal = v; commitCombined(); });

      timerBox.querySelector(".timer-toggle").addEventListener("click", () => {
        // Iniciar (parado -> rodando): persiste JÁ (endsAt correto, sem atraso de animação) —
        // só a TROCA VISUAL espera a roleta terminar de sumir, reaproveitando a mesma animação
        // de saída do modal de filtro (filter-modal-out, CSS) em vez de recriar algo novo. Sem
        // isso a roleta nunca teria tempo de animar (renderTimer troca tudo na hora).
        const secs = currentRemainingSeconds();
        if (secs <= 0) return;
        persistStepTimer({ endsAt: Date.now() + secs * 1000, remainingSeconds: secs, running: true, started: true });
        startTicking();
        const wheelWrap = timerBox.querySelector(".cook-timer-wheel-wrap");
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        wheelWrap.classList.add("cook-timer-wheel-wrap--hiding");
        setTimeout(renderTimer, reducedMotion ? 200 : 220);
      });
      timerBox.querySelector(".timer-reset").addEventListener("click", () => {
        clearInterval(timerInterval);
        timerInterval = null;
        persistStepTimer({ endsAt: null, remainingSeconds: 0, running: false, started: false });
        renderTimer();
      });
    }

    // Quantidade por passo (stepIngredients, Fase 2a) — reaproveita formatStructuredItem
    // (mesma formatação/arredondamento de fração já usado no multiplicador de porções da tela
    // de receita, nenhuma lógica nova). Ratio = fraction do passo x portionMultiplier da sessão
    // / porção base da receita — igual ao currentRatio() de renderReceita, só que lido da
    // sessão salva em vez do stepper (o modo de preparo não tem stepper próprio).
    function renderStepIngredients() {
      const usage = recipe.stepIngredients && recipe.stepIngredients[stepIndex];
      if (!usage || !usage.length || !recipe.ingredientsStructured) {
        stepIngredientsEl.innerHTML = "";
        stepIngredientsEl.style.display = "none";
        return;
      }
      const session = Storage.getPreparoSession(id);
      const portionRatio = yieldInfo && session && session.portionMultiplier ? session.portionMultiplier : 1;
      const lines = usage
        .map(({ entryIndex, itemIndex, fraction }) => {
          const entry = recipe.ingredientsStructured[entryIndex];
          const it = entry && entry.items && entry.items[itemIndex];
          if (!it) return null;
          return formatStructuredItem(it, portionRatio * fraction);
        })
        .filter(Boolean);
      if (!lines.length) {
        stepIngredientsEl.innerHTML = "";
        stepIngredientsEl.style.display = "none";
        return;
      }
      stepIngredientsEl.style.display = "";
      stepIngredientsEl.innerHTML =
        '<div class="cook-step-ingredients__label">Quanto entra aqui</div><ul>' +
        lines.map((l) => "<li>" + l + "</li>").join("") +
        "</ul>";
    }

    function renderStep() {
      stepLabel.textContent = "Passo " + (stepIndex + 1) + " de " + totalSteps;
      stepText.textContent = recipe.steps[stepIndex];
      renderStepIngredients();
      progressWrap.innerHTML = recipe.steps
        .map(function (_, i) {
          return '<span class="cook-dot' + (i === stepIndex ? " active" : i < stepIndex ? " done" : "") + '"></span>';
        })
        .join("");
      prevBtn.disabled = stepIndex === 0;
      nextBtn.textContent = stepIndex === totalSteps - 1 ? "Finalizar" : "Próximo →";

      // Troca de passo troca qual timer aparece na tela (ver comentário acima da função
      // getStepTimerState) — reinicia o ticker só se o timer DESSE passo estiver rodando.
      clearInterval(timerInterval);
      timerInterval = null;
      renderTimer();
      if (getStepTimerState().running) startTicking();
    }
    renderStep();

    prevBtn.addEventListener("click", () => {
      if (stepIndex > 0) {
        stepIndex--;
        Storage.savePreparoStep(id, stepIndex);
        renderStep();
        window.scrollTo({ top: 0, behavior: "instant" });
      }
    });
    nextBtn.addEventListener("click", () => {
      if (stepIndex < totalSteps - 1) {
        stepIndex++;
        Storage.savePreparoStep(id, stepIndex);
        renderStep();
        window.scrollTo({ top: 0, behavior: "instant" });
      } else {
        if (!Storage.isMade(id)) Storage.toggleMade(id);
        clearInterval(timerInterval);
        Storage.finishPreparoSession(id);
        Router.toReceita(id, fromHash);
      }
    });

    // Scroll (restaurar/topo) fica só em handleRoute agora — reaproveita o mapa por hash em vez
    // de sempre voltar pro topo aqui (ver comentário na declaração de scrollPositionsByHash).
  }

  // ---------- Fotos ----------
  // Ordem de resolução, por receita:
  //   1. imagens/receitas/<slug>.webp   -> foto própria, gerada por scripts/gerar-imagens.js
  //   2. Wikipedia em runtime (cache no localStorage)  -> o que existia antes deste commit
  //   3. placeholder (ícone dedicado, sem foto)
  //
  // A foto própria vence sempre. E o resultado do teste dela NÃO vai pro localStorage: enquanto
  // o lote de 398 não termina, a mesma receita pode não ter webp agora e ter daqui a dez minutos.
  // Um "__none__" persistido sobreviveria à geração e esconderia a foto nova PRA SEMPRE, num
  // aparelho que ninguém lembraria de limpar. Por isso o teste local mora só em memória, que
  // morre no reload — e é barato, porque o próprio HTTP cache do browser faz o resto.
  function imageQuery(recipe) {
    return recipe.name.replace(/\s*\([^)]*\)/g, "").trim();
  }

  // ESTA É A MESMA slug() DE scripts/gerar-imagens.js. As duas têm que andar juntas: se uma
  // mudar sozinha, o app passa a procurar um arquivo que o gerador nunca escreveu, TODA foto
  // própria some de uma vez e o app cai pra Wikipedia sem um único erro no console — a pior
  // classe de falha, cara e silenciosa. Mudou aqui, muda lá, no MESMO commit.
  function slugFoto(nome) {
    return String(nome)
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  const fotoLocalCache = new Map();

  // Resolve pra URL se o arquivo existe, pra null se não existe. Testa carregando de verdade,
  // não com fetch/HEAD, porque isso funciona igual em file:// e em servidor — e porque o byte
  // baixado aqui é o mesmo que o <img> final vai reaproveitar do cache do browser.
  function fotoLocal(recipe) {
    const url = "imagens/receitas/" + slugFoto(recipe.name) + ".webp";
    if (fotoLocalCache.has(url)) return fotoLocalCache.get(url);
    const p = new Promise((resolve) => {
      const probe = new Image();
      probe.onload = () => resolve(url);
      probe.onerror = () => resolve(null);
      probe.src = url;
    });
    fotoLocalCache.set(url, p);
    return p;
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
        el.innerHTML = iconSvg("photoOff", "photo-placeholder__icon");
      };
      el.appendChild(img);
    } else {
      el.classList.add("placeholder");
      el.innerHTML = iconSvg("photoOff", "photo-placeholder__icon");
    }
  }

  // Recebe a RECEITA, não mais a string de busca: o caminho local sai de recipe.name cru
  // (é o que o gerador slugou), e a busca da Wikipedia sai do nome sem parênteses — os dois
  // são diferentes em 24 das 398 ("Dumplings (Jiaozi)"), então um só não serve pros dois.
  async function loadRecipeImage(recipe, el) {
    const local = await fotoLocal(recipe);
    if (local) {
      applyImage(el, local);
      return;
    }

    const query = imageQuery(recipe);
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
  // Scroll por rota (investigação prévia -> agora implementada): chave é o hash COMPLETO
  // (path+query, via currentHashPath — cobre tags/role/imode da própria URL). Guarda
  // window.scrollY da rota que está SAINDO logo antes de renderizar a rota nova; restaura ao
  // voltar pra uma chave já vista nesta sessão (ex.: "Voltar" da receita agora reconstrói o
  // hash de origem EXATO, ver Router.toReceita/renderReceita — é isso que faz esse caminho
  // comum bater igual e o restore funcionar). Chave nunca vista (tela nova) cai no scrollTo(0)
  // de sempre. Clamp contra o scrollHeight REAL no momento de restaurar evita rolar pra uma
  // posição que não existe mais, se o conteúdo encolheu entre a saída e a volta (ex. filtro
  // mais restritivo aplicado por outro caminho). replaceCategoriaFacets (refino in-context) usa
  // history.replaceState direto, sem hashchange — nunca acessa handleRoute, então trocar filtro
  // sozinho nunca aciona nem lê este mapa.
  const scrollPositionsByHash = {};
  let previousHashPath = null;

  function handleRoute(route) {
    const newHashPath = currentHashPath();
    if (previousHashPath !== null) {
      scrollPositionsByHash[previousHashPath] = window.scrollY;
    }
    // Modal de filtros aberto sobrevive fora de #recipes-content (ver comentário na declaração
    // de closeActiveFilterModal) — fecha à força antes de renderizar a rota nova, senão fica
    // preso na tela por cima do conteúdo trocado (ex.: botão/gesto voltar do celular).
    if (closeActiveFilterModal) closeActiveFilterModal();
    if (route.name === "busca") {
      renderBusca(route.tags || [], route.textFilters || [], route.ingredientMode || "or", route.query || "", route.role || null);
    } else if (route.name === "grupo") {
      renderGrupo(route.grupoId);
    } else if (route.name === "categoria") {
      showCategoria(route.catId, route.tags || [], route.role || null, route.ingredientMode || "or");
    } else if (route.name === "receita") {
      renderReceita(route.id, route.fromHash);
    } else if (route.name === "cozinhar") {
      renderCookMode(route.id, route.fromHash, route.portion);
    } else if (route.name === "minhas-receitas") {
      renderMinhasReceitas();
    } else if (route.name === "preparos") {
      renderPreparosList();
    } else if (route.name === "lista-compras") {
      renderListaCompras();
    } else {
      renderHome();
    }
    updateBottomNav(route);
    if (Object.prototype.hasOwnProperty.call(scrollPositionsByHash, newHashPath)) {
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      window.scrollTo({ top: Math.min(scrollPositionsByHash[newHashPath], maxScroll), behavior: "instant" });
    } else {
      // Chave nunca vista nesta sessão — "página nova", sempre volta pro topo (mesmo
      // comportamento de sempre pra qualquer rota visitada pela 1ª vez).
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    previousHashPath = newHashPath;
  }

  Router.onChange(handleRoute);
  // Mantém previousHashPath em dia quando a URL muda por replace() (refino de filtro
  // in-context, Router.replaceCategoriaFacets) — sem isso, sair da tela logo depois de mudar um
  // filtro salvaria o scroll na chave de ANTES do filtro (stale), nunca batendo com o hash que
  // "Voltar" reconstrói depois. Só atualiza a referência — nunca re-renderiza nem mexe no
  // scroll aqui (isso continua só em handleRoute, via hashchange de verdade).
  Router.onReplace(function (path) {
    previousHashPath = path;
  });

  // ---------- Inicialização ----------
  renderBottomNav();
  handleRoute(Router.current());

  // Toast simples de "nova versão disponível" — o sw.js já chama self.skipWaiting() sozinho no
  // install (nunca fica parado em "waiting"), então isso NÃO ativa nada manualmente, só avisa
  // que um novo Service Worker acabou de assumir o controle (oncontrollerchange) e a aba
  // aberta continua rodando o JS antigo até recarregar.
  function showUpdateToast() {
    if (document.querySelector(".update-toast")) return; // já mostrando, não duplica
    const toast = document.createElement("div");
    toast.className = "update-toast";
    toast.innerHTML =
      "<span>Nova versão disponível.</span>" + '<button type="button" class="update-toast__btn">Atualizar</button>';
    document.body.appendChild(toast);
    toast.querySelector(".update-toast__btn").addEventListener("click", () => location.reload());
  }

  // ---------- PWA: service worker (uso offline) ----------
  if ("serviceWorker" in navigator) {
    // Capturado AGORA (síncrono, no momento em que este script roda) — não depois do
    // register()/load, e não contando eventos. Se já existia um controller, esta aba já era
    // controlada por um SW anterior; qualquer controllerchange DEPOIS disso é uma atualização
    // de verdade. Se não existia (primeira instalação), o primeiro controllerchange é só o SW
    // novo assumindo pela primeira vez — nunca deve mostrar o toast.
    const hadControllerBefore = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadControllerBefore) return;
      showUpdateToast();
    });
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("sw.js")
        .then((registration) => {
          // Sem isso, o app só confiava no timing padrão do navegador (checagem em navegação
          // real) — insuficiente pra um PWA "standalone", onde reabrir pelo ícone geralmente
          // NÃO conta como navegação nova. Forçar update() ao voltar de segundo plano cobre
          // exatamente esse caso.
          document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") registration.update();
          });
        })
        .catch(() => {});
    });
  }
})();
