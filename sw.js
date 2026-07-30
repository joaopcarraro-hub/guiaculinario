// sw.js — cache do app inteiro para uso offline.
// Shell/dado (html/css/js/data): network-first — sempre tenta buscar a versão nova primeiro,
// só cai pro cache se estiver offline (ver isIconRequest/fetch handler abaixo). Ícones: ainda
// cache-first, sem mudança. Ao mudar arquivos existentes, suba a versão do CACHE_NAME mesmo
// assim — é o que dispara o activate/limpeza de cache antigo e o skipWaiting de uma vez.
// v21: foto própria da receita (imagens/receitas/*.webp) + object-position/aspect-ratio no hero.
// Mudaram css/style.css e js/app.js, que já estavam no APP_SHELL — sem subir a versão o
// cache-first serviria a versão velha dos dois e a mudança simplesmente não apareceria.
// v22: hotfix — fase 0b (tipografia + espaçamento) mudou css/style.css sem subir a versão.
// Shell/dado é network-first (só os ícones são cache-first, ver isIconRequest abaixo), então
// quem está online já recebe o CSS novo na próxima requisição independente da versão aqui; o
// bump serve pro caso offline — força o SW novo a instalar e o "install" a pré-popular o
// cache com o CSS atual, em vez de deixar o fallback offline preso na cópia antiga até a
// próxima visita online.
// v24: botão de voltar da página de receita virou flutuante (.back-float, acompanha o scroll) —
// mesmo mecanismo de navegação por fromHash, só apresentação. css/style.css e js/app.js mudaram.
// v25: carrossel "Vistas recentemente" na home (item 4 do roadmap-mestre) — UI nova sobre o
// rastreamento que já existia em storage.js. css/style.css e js/app.js mudaram.
// v26: redesenho completo do card de receita (item 2 do roadmap-mestre) — foto 16:9 sangrando +
// coração flutuante + faixa nome/1 chip, substitui header em grid/descrição/meta/cat-chip em
// todos os 6 call sites. css/style.css e js/app.js mudaram.
// v31: leva final de sobras (2026-07-26) — header de ingredientes expandido perdeu o contador
// "(N)" (desalinhava com porções+chevron), contagem sobrevive só no aria-label do colapsado.
// js/app.js mudou.
// v32: fix pontual (2026-07-26) — h4 "Ingredientes" do mesmo header ainda renderizava mais alto
// que porções+chevron; causa raiz era um empate de especificidade CSS resolvido por ordem no
// arquivo, deixando 12px de margin-bottom residual só no h4. css/style.css mudou.
// v33: item final do redesenho visual (2026-07-26) — tile de categoria/home e banner de hub
// (item 6 do roadmap-mestre) trocam ícone/emoji por foto real (acervo de
// scripts/gerar-categorias.js + bandeiras de país), banner borrado nos 3 hubs alcançáveis, e
// extermínio final de emoji funcional em categories.js/collections.js/app.js. Os 4 arquivos
// mudaram e os 4 estão no APP_SHELL abaixo (css/style.css, js/app.js, js/categories.js,
// js/collections.js).
// v34: rumo novo de Países — o tile de país virou foto da receita-assinatura e o mural de
// bandeiras foi extinto (as 2 superfícies de Países usam imagens/categorias/paises.webp).
// Mudaram css/style.css e js/app.js, os dois no APP_SHELL.
// v34 corrige TAMBÉM uma falha antiga que só apareceu agora: js/countries.js NUNCA esteve no
// APP_SHELL, apesar de o index.html carregá-lo e de js/categories.js e js/collections.js
// dependerem de window.COUNTRIES já existir quando rodam. Como shell/dado é network-first, o
// arquivo entrava no cache de carona (o handler faz cache.put de toda resposta 200), então o
// buraco só aparecia em dois casos: primeira visita seguida de offline antes de qualquer
// segunda carga, e evicção do cache. Nos dois, COUNTRIES fica indefinido e o app quebra na
// hora — não degrada. Agora que countries.js carrega também o signatureRecipe dos 20 tiles do
// hub Países, ele deixou de ser dado acessório e virou shell de verdade. Precachear é o certo.
// v36: Fase F1a — redesenho do modal de Filtros (chips de seleção). Complexidade/Tempo/Tipo de
// prato/Proteína/Refeição viram chips; Papel da proteína vira segmentado de 3 pílulas; bug da
// caixinha cinza de contagem do tile de país corrigido; tiles de Equipamento normalizados;
// rodapé com hierarquia única. css/style.css e js/app.js mudaram, os dois no APP_SHELL.
// v37 (2026-07-28): 3 itens. (1) Papel da proteína: investigação de produção não achou defeito
// de código (deploy já batia com HEAD, seção renderizava certo em teste ao vivo fresco) — seção
// própria mesmo assim morre por decisão de design, vira sub-controle dentro do corpo de
// Proteína. (2) Botão de limpar (glifo X) interno nas 2 barras de busca reais do app
// (home-search do hub, tagsearch-input da busca global). (3) js/router.js ganha colapso de
// zigue-zague no histórico (navigate/replace/hashchange) — voltar nativo repetido entre
// receita/preparo não repete mais a tela intermediária. css/style.css, js/app.js e js/router.js
// mudaram, os 3 no APP_SHELL.
// v38 (2026-07-28, mesmo dia, ajuste visual pedido pelo dono após ver v37 ao vivo): as 3
// pílulas soltas do segmentado de Papel da proteína saturavam junto dos chips de proteína logo
// abaixo — viram trilho deslizante (.segmented-toggle), generalizando o MESMO componente do
// toggle Qualquer um/Todos estes de Ingrediente (antes calibrado só pra 2 paradas) pra N
// segmentos via custom properties CSS. Ingrediente também migrou pro componente novo (zero
// divergência futura). Mola (260ms cubic-bezier) e mecanismo de defer-até-transitionend
// preservados byte a byte. css/style.css e js/app.js mudaram, os dois no APP_SHELL.
// v39 (2026-07-29, correção de semântica pedida pelo dono): "Papel da proteína" deixa de valer
// só em coleção de proteína — vale no app inteiro (busca global incluída) sempre que houver
// >=1 proteína ativa (explícita, via chip da faceta Proteína, ou implícita da própria coleção
// de proteína, como já era). TagModel.splitByProteinRole (nova, tagmodel.js) generaliza
// matchesTagId numa distinção Principal (protein:X literal)/Secundário (só contains:X) pra
// QUALQUER conjunto de proteínas selecionado, com OR entre elas. Coleção de proteína continua
// idêntica a antes (confirmado número a número contra os 7 casos reais) — EXCETO Ovos, mudança
// deliberada: Secundário caiu de 104 pra 17 (a regra única não soma mais ingredient:ovo solto,
// um sinal muito mais largo que contains:ovo). Visibilidade do trilho dinâmica (aparece/some
// com transição curta) + reset pra Tanto faz ao ficar sem nenhuma proteína ativa (nunca um
// papel "fantasma"). js/router.js ganha role= na rota de busca (mesmo padrão de categoria).
// css/style.css, js/app.js, js/router.js e js/tagmodel.js mudaram — os 4 no APP_SHELL.
//
// v39 -> v40 (mini-rodada visual de fechamento, 2026-07-29, 2 correções do dono a partir de
// prints — iFood como régua de calha): .category-card__media sai de 1:1 pra 4:3 (grade de Mais
// Categorias + todos os hubs casam a mesma proporção de .home-tile__media; corte central,
// ~25% da altura perdida — confirmado ao vivo tile a tile, nenhum decapita o prato). #main
// (<=700px) tem a calha LATERAL revista de --space-5 (20px) pra --space-4 (16px) — usável em
// 390px vira 358px; TOP do #main preservado em --space-5 de propósito, pra não quebrar o
// cancelamento de padding-top que .grupo-sheet/.recipe-page fazem no próprio margin-top.
//
// Mesma rodada, 2 ajustes adicionais do dono incorporados no mesmo commit via amend (ainda
// local, nunca pushado): (a) rótulo do segmento default de "Papel da proteína" revisto de
// "Tanto faz" pra "Ver tudo" (js/app.js) — confirmado ao vivo em 360px que cabe no 1/3 do
// trilho sem truncar, mecanismo/value ("") intocado; (b) trilho "Vistas recentemente" ganha
// sangramento full-bleed até as 2 bordas da tela (padrão iFood) — width:100vw +
// margin-left:calc(50% - 50vw) no trilho, padding-left/scroll-padding-left:var(--space-4)
// reconstroem o alinhamento do 1º card, último card ganha margin-right:var(--space-4) pro
// respiro no fim do scroll; só o trilho sangra, o título continua na calha normal. Fatia
// visível do 4º card: 33,83px medido ao vivo (era 17,83px sem bleed, mesma rodada).
// css/style.css e js/app.js são os arquivos do APP_SHELL que mudaram nesta rodada.
const CACHE_NAME = "cardapio-v49";

const APP_SHELL = [
  "./",
  "index.html",
  "manifest.json",
  "css/style.css",
  // ANTES de categories.js/collections.js, mesma ordem do index.html: os dois leem
  // window.COUNTRIES no topo do próprio arquivo, não numa função chamada depois.
  "js/countries.js",
  "js/categories.js",
  "js/tags.js",
  "js/collections.js",
  "js/tagmodel.js",
  "js/storage.js",
  "js/search.js",
  "js/router.js",
  "js/app.js",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "data/molhos-classicos.js",
  "data/sopas.js",
  "data/entradas-frias.js",
  "data/entradas-quentes.js",
  "data/massas.js",
  "data/risotos.js",
  "data/ovos-basicos.js",
  "data/ovos-classicos.js",
  "data/padaria.js",
  "data/sobremesas-classicas.js",
  "data/contemporaneos.js",
  "data/tecnicas-contemporaneas-2.js",
  "data/aves.js",
  "data/carnes-bovinas.js",
  "data/cordeiro.js",
  "data/suinos.js",
  "data/peixes.js",
  "data/frutos-do-mar.js",
  "data/arrozes.js",
  "data/brasileiros.js",
  "data/brasil-regional.js",
  "data/franca.js",
  "data/italia.js",
  "data/espanha.js",
  "data/portugal.js",
  "data/japao.js",
  "data/china.js",
  "data/coreia.js",
  "data/tailandia.js",
  "data/india.js",
  "data/mexico.js",
  "data/peru.js",
  "data/alemanha.js",
  "data/austria.js",
  "data/hungria.js",
  "data/grecia.js",
  "data/marrocos.js",
  "data/libano.js",
  "data/eua.js",
  "data/dinamarca.js",
  "data/derivation-dict.js",
  "data/shopping-dict.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Ícones (icon-192/512): cache-first, sem mudança — imagem estática que nunca precisa de rede
// pra ficar "fresca", diferente do shell/dado abaixo.
function isIconRequest(url) {
  return url.pathname.endsWith("icons/icon-192.png") || url.pathname.endsWith("icons/icon-512.png");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // deixa passar chamadas externas (fotos da Wikipedia etc.)

  if (isIconRequest(url)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        });
      })
    );
    return;
  }

  // Shell/dado (index.html, css/style.css, js/*.js, data/*.js): network-first — tenta a rede
  // primeiro, pra nunca "confiar" em código desatualizado enquanto há conexão; só cai pro
  // cache salvo se o fetch falhar de verdade (offline). Resposta nova sempre atualiza o cache
  // e é devolvida direto (sem round-trip duplo esperando o cache também).
  // cache:"no-store" é essencial aqui: sem isso, fetch(req) ainda respeitaria o cache HTTP
  // comum do navegador (Cache-Control/heurística), então um host com cache agressivo faria
  // "network-first" devolver uma resposta requentada mesmo com internet — não seria uma ida
  // de verdade à rede. new Request(req, {cache}) força a checagem: reconstrói a request com
  // o mesmo método/headers, só troca o modo de cache (mode "navigate" vira "same-origin" nessa
  // reconstrução — restrição do próprio construtor Request, sem efeito prático aqui: continua
  // same-origin, é só um pedido de HTML normal).
  const networkReq = new Request(req, { cache: "no-store" });
  event.respondWith(
    fetch(networkReq)
      .then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) => {
          if (cached) return cached;
          if (req.mode === "navigate") return caches.match("index.html");
        })
      )
  );
});
