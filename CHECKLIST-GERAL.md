# CHECKLIST-GERAL.md — Gusta (roadmap-mestre do projeto)

Roadmap-mestre / fonte de verdade viva. Ler primeiro. O log granular do workstream de
busca+taxonomia (Fases 0–3) vive em `CHECKLIST-REDESIGN.md`; aqui fica só o resumo do que
ficou pronto + tudo que falta. Atualizar a cada rodada relevante — reescrever por completo
quando acumular contradição entre seções, não só remendar.

App: guia gastronômico "Gusta" — "Da dúvida ao prato pronto". PWA vanilla JS (sem build, sem
framework, sem dependência externa por decisão de projeto). 398 receitas em `data/*.js`.
Deployado em `joaopcarraro-hub.github.io/guiaculinario`. Vai a público em breve.

Critério de qualidade: "bonito, moderno, intuitivo, completo" — lançamento público, sem prazo
apertado mas sem nada solto.

Regra de modelo: Fable 5 (~5x o custo do Sonnet por token) só pra investigação ambígua e
design pesado (julgamento real). Assim que a decisão fica bem especificada — mesmo que
complexa — volta pro Sonnet 5 Extra. Avisar o João quando puder trocar de volta. Uma tarefa
por vez no Code; prova funcional (suíte/tela) garante integridade depois de merge paralelo —
git não pega conflito semântico. Antes de "pode dar push": sempre `git log --oneline` +
`git status` brutos. Suíte escrita numa tarefa vira arquivo versionado em `scripts/`. Toda
mudança de arquitetura vira regra formal (CLAUDE.md / skill) no mesmo commit.

## ✅ FEITO

### Fundação

Navegação, modal de filtro, reskin escuro, dados estruturados (`ingredientsStructured`,
multiplicador de porções, `stepIngredients`), 5 telas da barra inferior com conteúdo real
(Home, Pesquisar, Minhas Receitas, Preparos, Lista de Compras), Service Worker network-first,
PWA com nome/ícone Gusta reais. Rename "Cozinhas do Mundo" → "Países". Toggle de Ingrediente
(Qualquer um / Todos estes, com animação de mola). Voltar preservando filtro+scroll (Dívida
#1, a mais antiga — resolvida e estendida a coleção/Busca/Minhas Receitas). Infraestrutura de
"últimas receitas visitadas" (só o rastreamento de dado, sem UI).

### Busca — BLOCO COMPLETO (4 commits, no ar em `main`) — detalhe granular em `CHECKLIST-REDESIGN.md`

- `83922b6` fix(busca): filtra tag morta na sugestão por contagem viva (helper `isLiveTag`
  reusado da proteção que o Enter já fazia) + revive `difficulty:dificil` (mapeando "alta",
  enche a coleção Avançadas que estava vazia) + `cuisine:eua`/`country:eua` (matcher "EUA" em
  `ORIGIN_COUNTRY_MATCHERS`).
- `c9e3610` feat(taxonomia): 19 tags derivadas novas (4 filter: macarrao/laranja/maca/rabanete;
  15 lowPriority só-busca). macarrão vira subtipo, não sinônimo de massa (removido dos
  sinônimos de `dish_type:massa`) — Lasanha/Ravioli são massa e não são macarrão. Sinônimos
  suínos (bacon/pancetta/guanciale/presunto/linguiça/toucinho) migrados pra fora de
  `protein:`/`contains:suino`. vitela→boi, cheiro-verde→salsinha,
  caiena/gochugaru/aji amarillo→pimenta-chili. Falso-amigo açafrão-da-terra (=cúrcuma).
- `3679c3b` feat(busca): parser decompõe a query em tags vivas + texto residual. Predicado de
  colapso testável (EQ = igualdade de frase; CONTAINS = palavra inteira; auto-chip só quando
  EQ≠vazio e o conjunto de tags resolve num único id — senão chips opcionais + texto). 21
  termos ambíguos travados por teste-guarda contra drift de taxonomia. 2 blocos de resultado:
  B1 (tags-AND + resíduo, escopo estrito sem descrição) + B2 ("mais por texto", 6 campos,
  NUNCA suprimido — cobre buraco de taxonomia). Motor unificado sobre `getAllRecipesFlat`
  (`buildIndex` do search.js aposentado); word-boundary + plural s? (fim do substring puro);
  `STOPWORDS_PT` e `MEASUREMENT_MASKS` viram exports do derivation-dict (máscara "colher de
  sopa"). Digitar = preview via `Router.replace(q=)`; Enter/chip materializa em
  `tags=`/`text=`; grupo "Receitas" (navegação direta) removido — receitas viram resultado na
  lista.
- `f2bb4d1` correção do teste 10 da suíte do parser (mede o campo ingrediente direto).

Prova: "macarrão com carne" → Ragu alla Bolognese/Hot Pot/Japchae/Sukiyaki/Shabu-Shabu, Lasanha
AUSENTE. "cremoso" (sem tag) → resultado via B2, nunca tela vazia. Suíte versionada
`scripts/verify-search-parser-2026-07-24.js` (41 asserções). Skill `cooking-taxonomy-architect`
documenta o predicado, os 2 blocos e a remoção do grupo Receitas.

### Lista de Compras — normalização semântica completa

Fase 1 (`data/shopping-dict.js`, pipeline de 3 camadas, regra de fusão, plurais curados,
`isReference` → seção "Preparos que você precisa fazer antes", migração `boughtKeys` v1→v2).
Pluralização por dicionário curado. Auditoria de cobertura (178 clusters, ~467 textos
fundindo). Fase 2 Despensa (`PANTRY_SET` sai da soma → seção "Despensa — confira se já tem").
Fase 3A+3B (unidade de VENDA na visão Geral: sólido→grama, líquido→ml/L, unidade→contagem
arredondada pra cima, tomate pelado→lata; fração eliminada da visão Geral). Visão padrão
trocada pra "Geral". Suíte versionada (330 testes).

Fase 4 — agrupamento por corredor de mercado (2026-07-24): visão Geral ordena por seção física
de loja em vez de alfabética pura, SEM cabeçalho visível (decisão do dono — só reordena, título
oculto). 10 seções na ordem Hortifruti, Padaria, Açougue e Peixaria, Frios e Laticínios,
Mercearia e Secos, Doces e Sobremesas, Temperos e Condimentos, Produtos Asiáticos e Orientais,
Congelados, Bebidas — as 2 últimas são seções novas, criadas depois de medir massa crítica real
contra os 647 canônicos do acervo (34 e 54 itens, maior que várias das 8 originais). Item sem
seção mapeada cai em "outros" no fim, nunca some nem quebra o sort. Mecânica: `SECTION_MAP` +
`sectionFor` em `data/shopping-dict.js` (mesmo padrão do `PANTRY_SET`), sort trocado em
`buildShoppingListGroups` (`js/app.js`) — Despensa e Preparos, e a visão "Por receita", ficam
bit a bit intactos (confirmado via `git show HEAD:` comparando as funções inteiras). Dos 33
canônicos ambíguos entre 2 seções, resolvidos pela regra "a seção é onde o comprador acha o
item NAQUELA forma" com evidência real do texto de ingrediente (não achismo) — os residuais
foram decisão explícita do dono. Suíte versionada
`scripts/verify-shopping-sections-2026-07-24.js`. Verificado ao vivo no navegador (10 receitas
reais cobrindo as 10 seções, ordem conferida ponta a ponta).

Fase 5 — sub-produto derivado, "não compra quebrado" (2026-07-24): núcleo que não se compra
sozinho (gema/clara, raspas/suco/casca de limão/limão-siciliano/laranja, casca de parmesão)
nunca vira item próprio na visão Geral — sempre funde no item-base. Regra: base_direto +
MÁXIMO(sub-produtos entre si) — nunca soma, porque a mesma fruta rende raspas E suco ao mesmo
tempo, e todo ovo rende exatamente 1 gema E 1 clara. Ex. real: 2 ovos + 1 gema + 6 claras = 8
ovos (2 + máximo(1,6)), não 9. Tabela de rendimento pra cítricos marcada como estimativa,
sempre pelo valor MENOR do intervalo típico e arredondada pra cima (assimetria de risco).
Achado durante a investigação: 27 linhas reais de "suco de N limões" (quantidade escrita no
texto do ingrediente, não no campo qty) escapavam do canônico "suco de limão" — corrigido no
mesmo commit, incluindo o canônico novo "suco de laranja" que não existia. Cortes de ave/boi/
suíno (peito de frango, coxa, etc.) confirmados como NÃO sub-produto — são cortes vendidos
avulsos no Brasil, ninguém compra o animal inteiro pra ter o corte. Mecânica: `SUBPRODUCT_OF`
em `data/shopping-dict.js` (mesmo padrão do `PANTRY_SET`), bucket + pós-passe de máximo em
`buildShoppingListGroups` (`js/app.js`). Suíte versionada
`scripts/verify-subprodutos-2026-07-24.js`, sem nenhuma dependência de git (só valores
literais). Verificado ao vivo no navegador (4 cenários: ovo, cítricos, negativo de corte de
ave, `casca de parmesão` sem quantidade).

### Nomes de receita em português

398 receitas classificadas (136 já PT, 234 nome próprio mantido, 28 candidatos investigados).
25 aprovados e aplicados em `recipe.name` (3 dos 28 mantidos no original por serem nome fixo
internacional: Beef Brisket, Lobster Roll, Mac and Cheese). Critério e lista de exceções
documentados na skill `recipe-data-quality`. Slug muda pros 25 (`id = slugify(recipe.name)`) —
migração seletiva em `RENAME_SLUG_MAP` (js/storage.js), aplicada em 2 pontos (favoritas/feitas
via `migrateOldId`, últimas visitadas via `loadRecent`) + alias no Router pra
`#/receita/:slug-antigo` e `#/cozinhar/:slug-antigo` resolverem pro slug novo. Zero colisão de
slug (398 + entre os 25), zero mudança de tag (confirmado via `git show HEAD:` comparando
antes/depois). Suíte versionada `scripts/verify-recipe-name-pt-2026-07-24.js`.

2ª rodada (2026-07-24): a 1ª tinha tratado nome composto como bloco atômico e errado casos como
Ragù alla Bolognese e Fiskesuppe — re-investigação decompondo token a token, regra final única
(mantém só se já conhecido no BR por esse nome ou for nome próprio/técnica fixa; senão traduz
mantendo o núcleo de identidade e traduzindo só a parte descritiva), mais 70 renomes aprovados,
6 deles os mesmos risotos da 1ª rodada renomeados de novo. `RENAME_SLUG_MAP` expandido pra 95
entradas com migração ENCADEADA (slug original pré-1ª-rodada E slug intermediário da 1ª rodada
resolvendo direto pro slug final — lookup não encadeia sozinho). Regra final substitui a da 1ª
rodada na skill `recipe-data-quality`, com 3 tratamentos especiais documentados (Risoto alla
Milanese por colisão de sentido com "empanado", Franskbrød por confusão cultural, Æbleskiver
por nome desconectado do conteúdo). Zero colisão de nome/slug e zero mudança de tag
reconfirmados contra as 398 reais. Suíte estendida com teste negativo de migração encadeada.

### Timer

Roleta de 3 colunas (h/min/s) com máquina de estado; segundos 0–59; toque no mostrador abre
teclado numérico.

### Polimento + `.text-link`

Ícones da nav alinhados, títulos redundantes removidos, tokens
`--color-error`/`--color-success` declarados, `theme-color` do PWA, auditoria de tokens (0 bug
real). `.text-link` fechado (`--color-accent-text` 4,61:1, peso regular, ícone colado,
hierarquia de área de toque confirmada por `elementFromPoint`).

## 🔄 AGUARDANDO TESTE DO USUÁRIO (não do Code)

- Teclado empurrando a barra inferior no Opera Mobile: correção aplicada
  (`interactive-widget=resizes-visual` na meta viewport, inerte no Chrome). Ninguém testou em
  Opera real. Testar no celular quando o commit estiver no ar. Plano B: Visual Viewport API.

## 🔵 FAZER AGORA — funcionalidade, experiência, arquitetura de dado

1. ~~Busca~~ — ✅ FEITO (ver bloco acima).
2. ~~Tag órfã "Frito"/"Assado" sem resultado~~ — ✅ FEITO (filtro de tag morta, Pacote 1).
   Confirmar na tela quando o deploy subir.
3. ~~Quantidade "não compra quebrado"~~ — ✅ FEITO (ver bloco "Lista de Compras" acima, Fase 5).
4. ~~Nomes de receita em português~~ — ✅ FEITO (ver bloco abaixo).
5. ~~Busca inline da página de grupo sem `fromHash`~~ — ✅ FEITO (2026-07-25). 4º caminho do
   "Voltar preservando contexto" (`renderGrupo`) fechado, mesmo padrão exato dos outros 3
   (Coleção/Busca/Minhas Receitas): `fromHash = currentHashPath()` passado pro card de
   resultado. Diferença: a busca inline nunca escreveu o texto digitado na URL (diferente dos
   outros 3), então só o fromHash não bastava — resolvido com variável de módulo
   `grupoSearchQuery` (mesmo padrão de `minhasReceitasTab`, já usado em Minhas Receitas pro
   mesmo tipo de problema) que persiste o texto e restaura no próximo render. Suíte versionada
   `scripts/verify-grupo-search-fromhash-2026-07-25.js`. Verificado ao vivo no navegador: busca
   "frango" em Proteínas, abre Paella (`from=grupo%2Fproteinas`), Voltar restaura busca e
   resultados byte a byte; os outros 3 caminhos confirmados intactos (teste negativo).
6. ~~Agrupamento por corredor na lista de compras~~ — ✅ FEITO (ver bloco "Lista de Compras"
   acima, Fase 4).

⚠️ **DECISÃO PENDENTE DO JOÃO** — tela "Pesquisar" própria: hoje a aba só redireciona pra
busca. A tela própria (picked-for-you, atalhos, grid de categorias) é bem mais visual/layout
que os outros itens deste bloco. Fica aqui (funcional, agora) ou vai pra remodelagem visual
(depois)? Destrava o sequenciamento do resto.

## 🎨 DEIXAR PRO FABLE, DEPOIS — remodelagem visual (só quando o João abrir essa frente)

1. Redesenho completo da página de receita — funil de informação (tags menores após a
   descrição; tempo/complexidade/porções em segmentos rotulados; os 3 botões de ação
   redistribuídos, Favoritar sai da linha; porções perto dos ingredientes; "ocultar
   ingredientes" vira seta discreta). Efeito de scroll: foto de topo maximizada e FIXA, o
   conteúdo desliza por cima (CSS `position: fixed` + fluxo normal, sem lib/parallax JS).
2. Redesenho do card de receita — foto maior (~60%, centralizada), REMOVE
   tempo/complexidade/porções e país do card. País só reaparece se o usuário estiver filtrando
   por 2+ países. Tag do card só macro-relevante (proteína/tipo de prato, nunca país).
   Padronizar a divergência card normal vs card em Minhas Receitas.
3. Botão de voltar flutuante — troca o contextual-fixo por flutuante que acompanha o scroll.
   Regra na skill `product-navigation-ux`: sempre histórico real, nunca destino hardcoded,
   EXCETO no modo de preparo (só "Sair do modo cozinhar").
4. "Últimas receitas visitadas" — UI do carrossel (dado já rastreado). Carrossel horizontal na
   home, blocos menores que os 4 tiles grandes, ~3 visíveis, últimas 10. Decidir info (nome +
   origem ou nome + foto). "Não pode ficar apertado nem vazio."
5. Bloco de geração de imagem por IA — PAUSADO, o João vai fazer numa conversa separada com a
   namorada (design visual). Skill `ai-image-generator` instalada e testada (Gemini 2.5 Flash
   Image, gratuito). 3 tipos: foto de receita, ícone de ingrediente, foto de categoria/hub
   (tile + banner de fundo desfocado). Diretriz: "espectro com âncoras" (luz/profundidade
   sempre iguais; bancada/louça num leque pequeno curado; comida/ângulo livres) — nunca tingir
   fundo com cor de marca. Bandeira de país (fundo borrado) é CSS, não IA.

## 🧊 POLIMENTO DE BAIXA PRIORIDADE

- Realce azul do toggle "Qualquer um / Todos estes" (NOVO, 2026-07-24) — ao tocar aparece um
  retângulo azul de seleção nativa atrás do knob, quebra a sensação de moderno. Cosmético, 1–3
  linhas de CSS (`-webkit-tap-highlight-color: transparent`, `user-select: none`, outline de
  foco estilizado). Pega carona no próximo toque em CSS.
- Roleta do timer: números vizinhos menores que o selecionado + transição suave ao trocar — só
  se for fácil.

## 🔴 BACKLOG SEM AÇÃO AGORA

- Facetas Ocasião / Restrições — esperando mais dado (`diet:` expandido).
- `stepIngredients` Escopo B (mapear todo passo, não só divisão de ingrediente) — adiado,
  baixo valor marginal (91,8% dos passos sem ambiguidade).
- Texto "(dividida)"/"(dividido)" no ingrediente redundante — pode revisitar agora que a UI de
  quantidade-por-passo existe.

## 📌 DECISÕES PEQUENAS PENDENTES

- Logo dentro do app (não só ícone do PWA) — não precisa por ora.
- `#/grupo/tempo` e `#/grupo/dificuldade` como rotas órfãs — manter ou aposentar.
- Revisão de copy técnico ("Papel da proteína" como nome de faceta).
- 5 receitas com `ingredients: []` vazio — dívida de conteúdo.
- Ícone de ingrediente sem cobertura gratuita — caçar manual ou gerar por IA (resolve dentro
  do bloco de imagem).

## 🧠 APRENDIZADOS-CHAVE (mantêm-se válidos)

- Medir antes de propor. Mudança de dado semântico → investigar a variedade REAL antes de
  desenhar a regra. Nunca assumir formato.
- Dry-run antes de produção. Simular e confirmar antes de tocar dado/código real.
- Relatório com número concreto, nunca resumo. "Passou" não é prova; contagem exata,
  antes/depois, teste negativo explícito. `git log`/`git status` sempre brutos antes do push.
- Achou um bug de um tipo, procura a MESMA causa em outro lugar.
- Teste negativo importa mais que positivo. Confirmar que o que NÃO deveria mudar não mudou.
- Desconfiar do próprio método de teste antes de reportar (já pegou eval com listener
  duplicado, árvore de acessibilidade errada, teste medindo o campo errado — o "sopa
  200→23").
- Subtipo ≠ sinônimo (macarrão vs. massa) — granularidade de dado > esperteza de parser.
- Termo ambíguo não colapsa em tag específica (carne ≠ boi automático) — interpretação de
  busca visível e reversível (chips removíveis).
- Falso-amigo é recorrente: mel/cogumelo, dourado/dourar, pimenta genérica,
  açafrão-da-terra/açafrão, alho/alho-poró, café/café-da-manhã, leite/leite-de-coco. Sempre
  mascarar o termo, não descartar a linha inteira.
- Lista de compras: unidade exibida = unidade de VENDA. Assimetria de risco — comprar a mais é
  barato, a menos impede a receita → arredonda pra cima na dúvida.
- João reverte decisão vendo na prática — normal, é o processo. Propor de forma reversível
  quando a decisão for genuinamente visual/ambígua.

## 📎 ARQUIVOS DE REFERÊNCIA

- Este `CHECKLIST-GERAL.md` — roadmap-mestre, ler primeiro.
- `CHECKLIST-REDESIGN.md` — log granular do workstream de busca+taxonomia (Fases 0–3).
- `DESIGN-TOKENS.md`, `docs/prompt-categorizar-receita.md`.
- `.claude/skills/`: `mobile-recipe-ui`, `product-navigation-ux`, `cooking-taxonomy-architect`
  — atualizadas pelo Code a cada rodada relevante.
- Suítes versionadas em `scripts/`: `verify-search-parser-2026-07-24.js`,
  `verify-taxonomy-2026-07-24.js`, `derive-tags-dry-run.js`, `derive-equipment-dry-run.js`,
  `test-shopping-dict.js`.
