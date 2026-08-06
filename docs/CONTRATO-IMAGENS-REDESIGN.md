# Contrato de imagens — o que o redesign precisa saber

Documento de handoff entre a frente de **geração de fotos** e a frente de **redesign completo do app**.
Escrito em 25/07/2026. Se você está mexendo em qualquer tela que mostra foto de receita, leia isto
antes — tem quatro decisões aqui que custaram uma rodada de geração ou dinheiro para descobrir, e
reabrir qualquer uma delas sem ler o porquê é retrabalho garantido.

Arquivos irmãos: `docs/COMO-RODAR-IMAGENS.md` (como operar o gerador), `scripts/gerar-imagens.js`
(o gerador), `scripts/test-foto-local.js` (a suíte que protege o contrato).

---

## 1. O que existe em disco

```
imagens/master/<slug>.jpg     1200x896, ~800 KB   full-res, FORA do git (.gitignore)
imagens/receitas/<slug>.webp  1184x888,  66-136 KB  É ISTO que o app serve
```

- **Proporção 4:3** (1,333). Fixa. É o `aspectRatio` mandado para a API.
- **Formato servido: WebP**, qualidade 82.
- **Peso real medido:** 66 KB (Torta de Maçã) a 136 KB (Paella). Média ~110 KB.
- O `master` é o que não se pode perder: `node scripts/gerar-imagens.js --exportar` regera **todos**
  os webp a partir dele a custo zero de API. Se o redesign quiser outro tamanho ou outra qualidade
  de webp, muda-se `SAIDA_W`/`SAIDA_H`/`WEBP_Q` no gerador e roda `--exportar`. **Não custa nada e
  não chama a API.** Isso é importante: o tamanho do arquivo servido é uma variável livre do design.

### Cobertura — COMPLETA desde 25/07/2026

**398 de 398 receitas têm foto própria.** Lote entregue e pushado (commits `f907016` e `d763831`).
Nenhuma receita do acervo cai mais no fallback da Wikipédia.

| | |
|---|---|
| Peso versionado | 44,4 MB |
| Média por foto | 114,2 KB |
| Menor / maior | 59 KB (Ovo Cozido) / 183 KB (Anticuchos) |
| Masters fora do git | 306 MB |
| Chamadas de API | 403 |
| Custo total | US$ 27,00 ≈ R$ 137 — **R$ 0,34 por foto** |

O custo do lote em si (382 fotos) foi US$ 25,60 contra US$ 26,20 estimados: erro abaixo de 1%.

**O fallback da Wikipédia continua no código e deve continuar** (§3). Ele não é legado: é o que
cobre receita **nova**, entre o momento em que ela entra em `data/*.js` e o momento em que alguém
roda o gerador. Ver `CLAUDE.md`, seção "Foto de receita".

---

## 2. O contrato do nome de arquivo

O caminho da foto de uma receita é **derivado do nome**, não armazenado em lugar nenhum:

```
imagens/receitas/ + slug(recipe.name) + .webp
```

E `slug()` é:

```js
String(nome)
  .normalize("NFD").replace(/[̀-ͯ]/g, "")   // tira acentos
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
```

Exemplos reais: `Paella` → `paella.webp`, `Dumplings (Jiaozi)` → `dumplings-jiaozi.webp`,
`Torta de Maçã` → `torta-de-maca.webp`.

**Esta função existe DUAS vezes no repositório e as duas têm que ser idênticas:**

| Onde | Nome | Papel |
|---|---|---|
| `scripts/gerar-imagens.js` | `slug()` | decide o nome do arquivo que é **escrito** |
| `js/app.js` | `slugFoto()` | decide o nome do arquivo que é **procurado** |

Se divergirem num único caractere, o app procura um arquivo que nunca existiu, cai no fallback da
Wikipédia e **as 398 fotos somem de uma vez, sem um único erro no console**. É a pior classe de
falha: cara, silenciosa, e só descoberta por alguém abrindo o app e estranhando.

`scripts/test-foto-local.js` existe para impedir isso. Roda com `node scripts/test-foto-local.js`,
custo zero, 17 testes. **Rode antes de commitar qualquer mudança que toque foto.**

> ⚠️ **Não introduza um campo `image:` nas receitas.** Já foi avaliado e descartado: exigiria editar
> os 398 objetos em `data/*.js` para guardar uma informação que já é 100% derivável do nome, e
> criaria um segundo lugar onde o caminho pode ficar errado. O nome do arquivo *é* o índice.

### Bug cosmético conhecido, não corrigido

`Wienerbrød` → `wienerbr-d.webp`, porque `ø` é uma letra própria e não se decompõe em NFD. O slug
continua único e as duas funções concordam, então **não quebra nada**. Não conserte sem rodar a
suíte: mudar a slug renomeia arquivos que já existem em disco.

---

## 3. Como o app resolve a foto — três camadas

Está em `js/app.js`, função `loadRecipeImage(recipe, el)`:

```
1. imagens/receitas/<slug>.webp   -> foto própria. Vence sempre.
2. Wikipedia, fetch em runtime    -> o que existia antes. Cache no localStorage.
3. placeholder 🍽                  -> nada encontrado.
```

Três coisas que o redesign precisa saber sobre isso:

**A assinatura mudou.** `loadRecipeImage` recebe a **receita**, não uma string. O caminho local sai
de `recipe.name` cru; a busca da Wikipédia sai do nome *sem parênteses* (`imageQuery()`). Os dois são
diferentes em 24 das 398 receitas, então uma string só não serve para os dois. Se você criar uma
superfície nova que mostra foto, chame `loadRecipeImage(recipe, elemento)` — não recrie a lógica.

**O teste do arquivo local NÃO vai para o localStorage.** Vive num `Map` em memória que morre no
reload. É de propósito: enquanto as 391 não foram geradas, a mesma receita pode não ter webp agora e
ter daqui a dez minutos. Um `"__none__"` persistido sobreviveria à geração e esconderia a foto nova
para sempre, num aparelho que ninguém lembraria de limpar.

**O fallback é assíncrono e pode demorar.** A Wikipédia leva até 4 requisições por receita
(pt → en → opensearch pt → opensearch en). Enquanto as 391 não tiverem foto, uma lista longa dispara
muito fetch. Se o redesign introduzir listas maiores, considere `IntersectionObserver` para só
resolver a foto do que está na tela. **Não é problema depois que as 398 estiverem geradas** — aí a
camada 1 responde de disco e a 2 nunca é alcançada.

---

## 4. As superfícies que mostram foto

| # | Onde | Seletor CSS | Caixa hoje | `object-position` | Chamada |
|---|---|---|---|---|---|
| 1 | Página de receita (hero) | `.recipe-hero img` | `aspect-ratio: 16/9` | **`center bottom`** | `app.js:2813` |
| 2 | Card de receita em lista | `.recipe-thumb img` | 48×48 (1:1) | default (`center`) | `app.js:2546` |
| 3 | Mini card de histórico/preparo | `.preparo-card__thumb img` | 48×48 (1:1) | default (`center`) | `app.js:1841` |
| 4 | Tile de categoria | `.category-card` | **não usa foto de receita** | — | — |
| 5 | Tile de **país** (hub Países) | `.category-card--country .category-card__media img` | `aspect-ratio: 4/3` | default (`center`) | `renderCollectionCard` |
| 6 | Tile de **coleção abstrata com receita-assinatura** (Por tempo/Por dificuldade, 5 das 7) | `.category-card--signature .category-card__media img` | `aspect-ratio: 4/3` | default (`center`) | `renderCollectionCard` |

As superfícies 1–3, 5 e 6 usam `object-fit: cover`.

### A #4 NÃO consome foto de receita — decisão fechada

Decidido pela frente de design, 25/07/2026: o tile de categoria usa **imagem dedicada por
categoria**, não a foto de uma receita.

| | |
|---|---|
| Proporção | 1:1 |
| Resolução | 600×600 |
| Composição | simples |
| Contraste | médio |
| Requisito funcional | tem que funcionar **borrada, com texto por cima** |

> **A pergunta "qual receita representa cada categoria" está ENCERRADA. Resposta: nenhuma.**
> Não reabra. O tile não puxa de `imagens/receitas/`, não passa por `slug()` e não chama
> `loadRecipeImage()` — é um acervo de imagem separado, com propósito e requisitos próprios.

O layout final do tile é da frente de design (item 6 do roadmap dela). Este documento registra
apenas que a superfície **não é cliente deste pipeline**, para que ninguém tente ligar as duas coisas
mais adiante.

### PAÍSES — a exceção documentada à regra acima (26/07/2026)

A regra "**nenhuma receita representa categoria**" continua valendo para **todas as categorias**.
**Países é a única exceção**, e é exceção **explícita, curada e fechada** — não uma brecha.

O tile de país (superfície #5) deixou de mostrar a bandeira e passou a mostrar a **foto da
receita-assinatura do país**: o prato que um brasileiro reconhece de relance como daquele país.

**Por que Países pode e categoria não.** A pergunta que o §4 encerrou era *derivativa* — "qual
receita **representa** esta categoria?" — e não tem resposta não-arbitrária: qualquer critério
automático ("a mais popular", "a primeira") produz um representante que muda quando o acervo muda,
e um tile cuja identidade oscila sozinha. País é outra pergunta: **"qual prato lê aquele país"**
tem resposta cultural estável e conhecida (Feijoada, Paella, Pad Thai), que não se deriva de dado
nenhum. Por isso o mapa é **curado à mão**, não computado.

| | |
|---|---|
| Fonte | `window.COUNTRIES[<id>].signatureRecipe` em `js/countries.js` — **mapa curado, não derivado** |
| Resolução | `countrySignatureRecipe()` em `app.js`, por **nome exato** |
| Escopo da busca | **`TagModel.getAllRecipesFlat()` — o acervo INTEIRO** |
| Pipeline da foto | o **mesmo** de #1–#3: `loadRecipeImage()` → foto própria → Wikipedia → placeholder |
| Proporção da mídia | **4:3**, igual ao tile grande da Home (composição overhead: corta só as laterais) |
| Blur/véu | **nenhum** — a foto aparece nítida, como a de categoria. Blur/véu eram muleta de bandeira |

> ⚠️ **Resolver contra `RECIPES[catId]` é o erro que este parágrafo existe para impedir.**
> **5 dos 20** apontam para receita que mora **fora** da categoria do próprio país —
> `brasil`→`brasileiros`, `franca`→`padaria`, `italia`→`massas`, `espanha`→`frutos-do-mar`,
> `hungria`→`carnes-bovinas`. Buscar dentro da categoria do país deixa esses 5 com o tile vazio
> **e sem um erro no console** — a classe de falha cara deste projeto (mesma lição do
> `slug()`/`slugFoto()` no §2). `scripts/verify-categoria-tiles-2026-07-26.js` §7 falha a suite
> se qualquer um dos 20 não resolver, resolver ambíguo ou não tiver `.webp` em disco.

**O que isto NÃO autoriza.** Não autoriza derivar representante para nenhuma outra categoria, nem
transformar `signatureRecipe` em campo genérico de coleção. A exceção é de Países e para de pé
por ser curada; o dia em que alguém quiser computá-la, ela vira exatamente o que o §4 proibiu.

**Trocar é barato:** muda-se o nome em `js/countries.js` e pronto — as candidatas-reserva já
avaliadas ficam anotadas linha a linha, para a próxima troca não recomeçar a análise.

### COLEÇÕES ABSTRATAS DE TEMPO/DIFICULDADE — 2ª exceção documentada (31/07/2026)

A regra "nenhuma receita representa categoria" e o limite que a exceção de Países acima declarava
("não autoriza... transformar `signatureRecipe` em campo genérico de coleção") seguem valendo para
**todo o resto do acervo**. As 7 coleções de **Por tempo** e **Por dificuldade** (Rápidas, Até 1
Hora, Mais de 1 Hora, Preparo Longo, Fáceis, Intermediárias, Avançadas) são uma **segunda
exceção**, tão explícita, curada e fechada quanto a primeira — não uma generalização do mecanismo.

**Por que estas 7 podem e o resto não.** São coleções **abstratas** (um corte de tempo/
dificuldade, não uma cozinha nem um ingrediente): não têm, e não podem ter, uma imagem-conceito
própria do jeito que Molhos/Massas/Risotos têm — o que uma foto de "menos de 1 hora" mostraria?
Sem ilustração, essas 7 eram as únicas coleções ainda 100% fallback tipográfico no grid "Todas as
categorias" (item novo da vitrine da Busca, F1b). É o mesmo problema estrutural que justificou a
exceção de Países — pergunta sem resposta derivável automaticamente, com resposta estável só por
curadoria — aplicado a um corte abstrato em vez de geográfico.

**Duas soluções, não uma:**

| Coleção | Solução | Fonte |
|---|---|---|
| Rápidas (`col-rapidas`) | reuso de asset — `imagens/categorias/momento-rapidas.webp` | `collection.tileImage` |
| Preparo Longo (`col-preparo-longo`) | reuso de asset — `imagens/categorias/momento-fim-de-semana.webp` | `collection.tileImage` |
| Até 1 Hora (`col-ate-1h`) | receita-assinatura — Yakitori | `collection.signatureRecipe` |
| Mais de 1 Hora (`col-mais-de-1h`) | receita-assinatura — Cassoulet | `collection.signatureRecipe` |
| Fáceis (`col-faceis`) | receita-assinatura — Guacamole | `collection.signatureRecipe` |
| Intermediárias (`col-intermediarias`) | receita-assinatura — Ossobuco | `collection.signatureRecipe` |
| Avançadas (`col-avancadas`) | receita-assinatura — Pato Laqueado (Pequim) | `collection.signatureRecipe` |

Os dois campos vivem em `js/collections.js`, direto no objeto de cada uma das 7 coleções (nunca um
mapa à parte tipo `window.COUNTRIES` — não há um 2º acervo de dados por trás destas, só o valor
curado no próprio objeto). Rápidas/Preparo Longo **reusam** a MESMA imagem já usada pelo Momento
equivalente da vitrine da Busca (`js/app.js`, seção de Momentos) — mesma identidade visual,
consistência deliberada, zero foto nova, resolvida por `collectionTileImageSrc()` (mesma função do
acervo de categoria, checando `tileImage` antes do mapa derivado). As outras 5 seguem o padrão de
Países ponto a ponto: nome exato curado à mão, resolvido por `collectionSignatureRecipe()` (função
própria, ao lado de `countrySignatureRecipe()` em `js/app.js` — não uma generalização dela, pra não
arriscar o mecanismo de país já testado e ao vivo) contra `TagModel.getAllRecipesFlat()` — o
acervo INTEIRO, nunca `RECIPES[catId]`, pela mesma razão do parágrafo de Países acima — pelo MESMO
pipeline `loadRecipeImage()` (foto própria → Wikipedia → placeholder), NÍTIDA, sem blur/véu
(`.category-card--signature` no CSS, regra própria, mesma receita visual de
`.category-card--country` sem reusar a classe).

**As 4 restrições que curaram as 5 receitas-assinatura** (validadas com execução real contra
`TagModel.getRecipesByCollection`, não por leitura de tag solta — ver
`scripts/verify-categoria-tiles-2026-07-26.js`):
(a) a receita pertence de fato à coleção pelo critério tempo/dificuldade real (membership
executada, não presumida);
(b) nunca uma das 20 receitas-assinatura de país já em uso (checado por nome — as 25, 20 países +
5 novas, são mutuamente exclusivas);
(c) sem gêmea visual de um tile do acervo de categoria GERADO (as 16 imagens de
`scripts/gerar-categorias.js`) — verificado olhando a imagem de verdade, não só a tag: um candidato
inicial para Até 1 Hora (Carré de Cordeiro) foi descartado nesta rodada exatamente por isso, era
visualmente quase idêntico ao tile já existente de `cordeiro.webp` (a mesma peça — carré com crosta
de ervas, fatiado, mesmo ângulo — nos dois);
(d) `nature: "prato"` e foto legível em tamanho de tile.

**O que isto AINDA NÃO autoriza.** A extensão é, de novo, explícita e fechada — cobre estas 7
coleções e mais nenhuma. Não autoriza derivar ou curar representante para nenhuma outra categoria
do acervo (Fundamentos/Proteínas seguem 100% na imagem-conceito dedicada do §4 original), nem
tratar `tileImage`/`signatureRecipe` como campo automático — os dois só existem hoje nos 7 objetos
de `js/collections.js` que os declaram à mão. Trocar qualquer uma das 7 é igualmente barato:
muda-se o valor no objeto da própria coleção.

### FACETA PROTEÍNA (frango) — 3ª exceção documentada (06/08/2026)

Diferente das duas exceções acima (Países, Coleções abstratas), esta NÃO é sobre representar uma
categoria — é sobre um VALOR dentro da faceta Proteína do modal de Filtros (`protein:frango`) que,
ao contrário dos outros 9 valores da taxonomia, não tem foto de categoria própria: a candidata
óbvia (`aves.webp`) já é de `protein:ave`, a tag irmã. Mesmo princípio das duas exceções
anteriores — curadoria humana onde não há resposta derivável — aplicado ao menor escopo possível
(1 valor de 1 faceta, não uma coleção inteira).

| | |
|---|---|
| Fonte | `PROTEIN_SIGNATURE_RECIPE["protein:frango"]` em `js/app.js` — mapa curado, não derivado |
| Resolução | `proteinSignatureRecipe(tagId)` em `app.js`, por **nome exato** |
| Escopo da busca | `TagModel.getAllRecipesFlat()` — o acervo INTEIRO, mesma regra das 2 exceções acima |
| Pipeline da foto | o **mesmo** de sempre: `loadRecipeImage()` → foto própria → Wikipedia → placeholder |
| Escolhida | **Tandoori Chicken** — coxa/sobrecoxa char-grelhadas, forma de coxa inconfundível mesmo em miniatura, prato composto (não ave inteira) |

**As 3 restrições que curaram a escolha** (mesmas da extensão de Coleções abstratas, §4 acima):
(a) nunca uma receita já reivindicada como assinatura de outra coleção — descartadas: Frango Frito
Americano (EUA), Frango Kung Pao (China), Butter Chicken (Índia), Yakitori (Até 1 Hora);
(b) sem gêmea visual do tile de categoria já em uso — descartada Frango Recheado (`data/aves.js`,
"Frango inteiro assado"), a semente inicial: comparação lado a lado confirmou composição quase
idêntica a `aves.webp` (ave INTEIRA assada, tábua de madeira, mesmo enquadramento). Galeto Al Primo
Canto descartada pelo mesmo motivo (ave inteira grelhada, tábua redonda);
(c) `nature: "prato"` e foto legível em tamanho de tile — o que eliminou pratos onde o frango não
é visualmente dominante (curries/sopas com molho cobrindo a carne, biryani com arroz dominante,
pratos empanados que escondem a forma).

**O que isto NÃO autoriza.** Mesmo limite das 2 exceções acima: não autoriza curar representante
pra nenhum outro valor de nenhuma outra faceta — é específica de `protein:frango`, único valor da
taxonomia sem candidata de categoria própria. Trocar é igualmente barato: muda-se o nome em
`PROTEIN_SIGNATURE_RECIPE`.

**Proporção — DIFERENTE das duas exceções acima.** Países e Coleções abstratas usam 4:3 (mesma
proporção do tile grande da Home). A faceta Proteína usa **3:2** — a foto de frango convive na
MESMA grade com as outras 7 fotos de categoria dentro do modal de Filtros, e desde 07/08/2026 essa
grade inteira usa a mesma proporção da faceta País (`.filter-tile--photo`), não a do tile grande da
Home. ⚠️ **Histórico revogado:** entre 06/08/2026 e 07/08/2026 esta faceta usou 1:1 (proporção
nativa do asset de categoria) — o dono viu ao vivo e achou o tile alto demais; corrigido pra 3:2 no
dia seguinte, uniformizando com País. Ver "Proporção por acervo" logo abaixo.

### Proporção por acervo — deliberada, não inconsistência

São três acervos com três proporções, e isso é decisão, não descuido:

| Acervo | Proporção | Por quê |
|---|---|---|
| Receita | **4:3** (1184×888) | hero de página, ver §5 e §6.1 |
| Categoria | **1:1** (600×600) | tile quadrado, spec original do §4 |
| Bandeira | **3:2** (600×400) | 14 das 20 já são 3:2 nativas — corte quadrado era desperdício |

Desde 26/07/2026 o acervo de **bandeira** tem **um único consumidor**: a faceta País do modal de
Filtros (`.filter-tile--photo`). O tile do hub Países migrou para a foto da receita-assinatura
(exceção acima), e o mosaico/mural de bandeiras que ocupava o banner do hub e o tile da Home foi
removido — as 2 superfícies usam `imagens/categorias/paises.webp`, do acervo de categoria.

Desde 06/08/2026 o acervo de **categoria** ganhou um 2º consumidor além de Home/hub: a faceta
Proteína do modal de Filtros (`.filter-tile--protein`), reaproveitando 7 dos 19 arquivos
(aves/carnes-bovinas/suínos/peixes/frutos-do-mar/col-ovo/cordeiro), lado a lado com a foto de
receita-assinatura de `protein:frango` — ver exceção acima. **Proporção de exibição corrigida em
07/08/2026: 3:2, não 1:1.** Registro do dia 1 (revogado): a faceta estreou casando a proporção
NATIVA do asset (1:1, "mídia casa com asset", mesma regra das outras superfícies) — o dono viu ao
vivo e achou o tile "muito grande", quebrando o ritmo contra País/Equipamento na mesma grade;
corrigido no dia seguinte pra 3:2, a MESMA proporção de `.filter-tile--photo` (país) — a grade
inteira do modal fica uniforme, **não é mais uma exceção de proporção mista**. O asset em disco
CONTINUA 1:1 nativo (zero regeração, "reuso total" intacto) — 3:2 é só o corte de EXIBIÇÃO via
`object-fit: cover` (janela visível = 66,7% da altura do quadrado, centralizada), a mesma técnica
de corte que qualquer superfície deste documento já usa quando caixa ≠ proporção do master (§5).
Ver `.filter-tile--protein` no CSS e a nota de DESIGN-TOKENS.md.

A regra que unifica é **"mídia casa com asset"**: a área de mídia do componente adota a proporção do
próprio arquivo, então `cover` vira o corte MÍNIMO que cobre a caixa, em vez de um corte imposto de
fora. Foi isso que dispensou o `scale(1.15)` que o CSS usava para esconder borda de blur.

> **Exceção pontual à regra acima (07/08/2026): `.filter-tile--protein`.** A faceta Proteína do
> modal de Filtros é a ÚNICA superfície do app onde a caixa de mídia NÃO casa a proporção nativa do
> asset (caixa 3:2, asset 1:1) — corte de 33,3% da altura, não o mínimo possível (que seria 0% numa
> caixa 1:1). Justificativa: consistência VISUAL entre facetas do mesmo modal pesou mais que corte
> mínimo por asset, decisão do dono depois de ver a alternativa (1:1, corte 0%) ao vivo e achar o
> tile grande demais. Ver exceção "FACETA PROTEÍNA" acima.

> **Opção registrada, sem prazo:** migrar o acervo de categoria de 1:1 para 3:2, pela mesma lógica de
> corte mínimo, uniformizando com as bandeiras. Custo de regerar as 19 (+1 conceito): **R$ 6,46**.
> Fica para a **fase de Filtros** — o acervo 1:1 atual está commitado e funcional, então não há nada
> quebrado esperando conserto.
>
> **Atualização (07/08/2026, faceta Proteína — F1c):** a fase de Filtros chegou e NÃO exerceu essa
> opção — decisão explícita do dono continua REUSO TOTAL, zero imagem nova/regerada. O acervo de
> categoria em disco segue 1:1; o que mudou foi só a CAIXA de exibição da faceta Proteína (3:2,
> corte em runtime via `object-fit: cover`), não o arquivo. Opção acima continua registrada, sem
> prazo, pra quem quiser regerar de verdade depois.

---

## 5. A matemática do recorte — como prever qualquer caixa

Esta é a seção que evita retrabalho. O master é 4:3. Com `object-fit: cover`, o quanto da foto
sobrevive depende **só** da proporção da caixa. Fórmula, com `R = largura/altura` da caixa:

- **Caixa mais LARGA que 4:3** (`R > 1,333`): a largura inteira aparece, a altura é cortada.
  Fração visível da altura = **4 / (3R)**
- **Caixa mais QUADRADA/ALTA que 4:3** (`R < 1,333`): a altura inteira aparece, as laterais são
  cortadas. Fração visível da largura = **3R / 4**

Valores já calculados nas proporções mais prováveis:

| Proporção da caixa | R | O que sobra da foto | Observação |
|---|---|---|---|
| 4:3 | 1,333 | 100% × 100% | sem corte, a foto inteira |
| 3:2 | 1,500 | 89% da altura | corte suave |
| **16:9** | **1,778** | **75% da altura** | **era o hero (redesign, 1ª rodada — aspect-ratio fixo)** |
| **2:1** | **2,000** | **67% da altura** | **limite LARGO do hero atual (--hero-h, viewport baixo/largo)** |
| 21:9 | 2,333 | 57% da altura | começa a cortar prato |
| 3,27:1 | 3,270 | 41% da altura | **era o hero antigo no desktop. Quebrado.** |
| **1:1** | **1,000** | **75% da largura** | **os thumbs de hoje** |
| **4:5 (vertical)** | **0,800** | **60% da largura** | **limite ALTO do hero atual (--hero-h, viewport alto/estreito) — ver nota abaixo** |

**Onde o prato está na foto:** medido nas 7 fotos geradas, o prato ocupa a faixa vertical
**y ∈ [25%, 80%]** e é centralizado horizontalmente com leve deslocamento à esquerda. É por isso que:

- no hero 16:9 com `object-position: center bottom`, a faixa visível era **y ∈ [25%, 100%]** — pega
  o prato inteiro e joga fora os 25% de cima, que é justamente onde vem lixo (ver §6);
- nos thumbs 1:1, o corte é lateral e a altura inteira aparece — o prato cabe naturalmente, sem
  precisar de `object-position`.

**Hero atual (rodada 2 do redesign, revisão do dono, "foto maximizada"): caixa proporcional ao
viewport, não mais 16:9 fixo.** `height: var(--hero-h)` com `--hero-h: clamp(50vw, 52vh, 125vw)` —
a caixa mira ~52% da altura da tela, mas a proporção resultante (`largura/altura`, sempre
`100vw/altura`) fica travada entre os dois limites já calculados na tabela: **2:1** (quando 52vh
encolhe até o piso, telas baixas/largas) e **4:5** (quando 52vh estica até o teto, telas
altas/estreitas). Isso É a janela segura pra este hero especificamente — mais larga do que a regra
geral abaixo, porque o véu degradê no topo (§6.2) passou a mitigar o risco da ponta 4:5 (a caixa
alta reexpõe o topo do master, onde mora o risco de parede/janela — antes escondido por completo
pelo recorte 16:9 mais raso). object-position:center bottom continua a âncora certa em qualquer
ponto dessa faixa.

> **Regra prática GERAL para o resto do redesign (cards, thumbs, superfícies novas):** qualquer
> caixa entre **1:1 e 2:1** funciona sem ajuste fino. Fora dessa janela, gere o recorte e olhe antes
> de fechar o layout. **Exceção documentada:** o hero da página de receita (acima), que estica até
> 4:5 com o véu de topo como mitigação — não generalize essa exceção pra outras superfícies sem o
> mesmo tipo de mitigação.

### O hero tem uma sutileza a mais

**Atualizado na rodada 2 (revisão do dono, pós-ver-no-ar) — a calibração original abaixo (50% do
hero coberto, y ∈ [25%, 62,5%]) foi substituída.** O conteúdo da página agora desliza por cima de
só os últimos 24px do hero antes de rolar — **quase a caixa inteira fica visível de largada**, não
mais a metade. Como `--hero-h` varia com o viewport, a fração exata também varia (não é mais um
número fixo como 62,5%): fração visível ≈ `(--hero-h - 24px) / --hero-h`, que fica bem perto de
100% pra qualquer altura de hero razoável (ex.: ~94,5% num hero de 438,88px, o caso de referência
390×844). Se o redesign mudar essa sobreposição nos 24px de novo, recalcule.

<details>
<summary>Histórico: calibração original (rodada 1, hero 16:9, 50% coberto)</summary>

O conteúdo da página deslizava por cima da metade de baixo do hero, então antes da rolagem só a
metade SUPERIOR da caixa aparecia. Faixa efetivamente visível de largada: y ∈ [25%, 62,5%] do
master. Válido só enquanto o hero era 16:9 fixo — substituído na rodada 2 (ver acima).

</details>

---

## 6. Decisões que NÃO devem ser reabertas

Cada uma custou uma rodada de geração ou dinheiro.

### 6.1 Caixa do hero SEMPRE proporcional ao viewport, nunca altura fixa em pixel

**Atualizado na rodada 2 do redesign (revisão do dono, "foto maximizada") — o mecanismo mudou de
`aspect-ratio` fixo pra `height: var(--hero-h)` (clamp), mas a REGRA (nunca pixel fixo) é a mesma
desde o início, só reforçada.** Histórico: o hero tinha `height: 220px` (altura fixa fazia o
enquadramento depender da LARGURA da tela, porque mudava a proporção da caixa — medido no master
da Paella, 390px de largura dava y 24,8%→62,4% (prato inteiro, certo), 720px dava y 59,3%→79,6%
(só a borda da panela, errado)). A 1ª rodada do redesign trocou pixel fixo por `aspect-ratio: 16/9`
— resolvia a dependência da largura (a faixa virava 25%→62,5% em qualquer tela), mas a caixa
resultante era pequena demais pra intenção real de foto maximizada.

**Hero atual:** `height: var(--hero-h)`, com `--hero-h: clamp(50vw, 52vh, 125vw)` declarado em
`css/style.css` — mira ~52% da altura da tela, travado numa proporção entre 2:1 e 4:5 (ver §5,
tabela e nota atualizadas). Continua **proporcional ao viewport, nunca pixel fixo** — o mesmo
princípio de sempre, agora reagindo também à ALTURA da tela (52vh), não só à largura. Se o
redesign quiser outra altura de hero de novo, ajuste os 3 valores do clamp (nunca um pixel solto).

### 6.2 `object-position: center bottom` no hero — é isto que esconde o lixo

**O achado mais importante deste documento.** Posicionamento vertical é a instrução que modelo de
imagem menos obedece. Duas rodadas tentaram controlar isso por prompt: a rodada 1 cortou o prato, a
rodada 2 empurrou a panela para o rodapé e encheu 45% do quadro de parede. Saiu do prompt e virou CSS.

E o prompt continua errando: **3 dos 6 masters do teste têm parede ou janela no canto superior.**
Beef Brisket tem uma janela clara em cima à esquerda. Torta de Maçã tem parede *e* a quina da mesa
aparecendo. O negativo do prompt contra parede acerta cerca de **metade** das vezes.

Nenhuma dessas falhas aparece no app, porque o recorte come exatamente os 25% de cima.

> **Isto não é acabamento, é o que está segurando o lote.** Se o redesign mudar o `object-position`
> do hero para `center` ou `top`, parede e janela voltam a aparecer em ~metade das fotos. Se precisar
> ajustar, mexa **para baixo** (`center 70%`, `center 60%`), nunca para cima.

**Aceito pela frente de design, 25/07/2026.** `center bottom` fica classificado como **regra
funcional**, não preferência estética: existe para esconder parede/janela no topo, comprovado em 3 de
6 masters. A partir daqui ele vira **requisito do efeito de foto fixa da página de receita**, e o
tratamento passa a ser conduzido pela frente de design — que assume a regra junto com o efeito.
Esta frente não mexe mais nisso; só registra o porquê, para que o motivo não se perca quando o
efeito for implementado.

### 6.3 O `imageConfig` fica fixo no gerador

`aspectRatio` e `imageSize` vão explícitos na chamada. Sem isso a API devolveu 2528×1696 (3:2,
4,3 MP), que cai numa faixa de preço acima de 1K — de 1,5× a 2,3× mais caro por imagem, ~US$ 60 em
vez de ~US$ 26 no lote inteiro. Não é assunto de design, mas é o motivo de a proporção ser 4:3 e não
negociável sem refazer a conta.

### 6.4 Não usar `cwebp -resize` sem recorte antes

Estica a imagem. O gerador recorta para 4:3 exato **antes** de redimensionar. Se o redesign pedir
outro tamanho de webp, mude as constantes e rode `--exportar` — não improvise um conversor à parte.

---

## 7. O que é livre para mudar

Para não travar o redesign com falso escrúpulo, isto aqui **pode** mexer sem consultar ninguém:

- Tamanho e qualidade do webp servido (`SAIDA_W`, `SAIDA_H`, `WEBP_Q` + `--exportar`, custo zero).
- Proporção de **qualquer** caixa, desde que respeitada a janela 1:1 → 2:1 da §5.
- `border-radius`, sombra, overlay, gradiente, hover, skeleton de carregamento.
- O placeholder 🍽 e o `background` de quando não há foto.
- Adicionar superfícies novas — só chame `loadRecipeImage(recipe, el)`.
- Lazy loading / `IntersectionObserver` (na verdade, recomendado).

---

## 8. Armadilhas que já cobraram

**Service worker.** `sw.js` é cache-first e `css/style.css` e `js/app.js` estão no `APP_SHELL`.
**Toda** mudança neles exige subir `CACHE_NAME` — está em `cardapio-v21` hoje. Sem isso você abre o
app, vê a versão velha e conclui que a mudança não funcionou. Já aconteceu.

**OneDrive + git.** O repo mora dentro do OneDrive, que segura arquivo enquanto sincroniza. O erro
`Unable to create '.git/index.lock'` vai voltar. Solução: `Remove-Item ".git\index.lock" -Force`.
Vale mover o repo para fora do OneDrive quando der.

**Commits de escopo aberto.** Ver `CLAUDE.md`: proibido `git add -A` / `git add .`. Há duas frentes
mexendo nos mesmos arquivos — imagens e redesign. Use pathspec explícito, sempre.

**Conflito previsível entre as duas frentes:** ambas mexem em `css/style.css` e `js/app.js`. As
mudanças de imagem estão concentradas em quatro pontos: `.recipe-hero` e `.recipe-hero img` no CSS, e
o bloco `// ---------- Fotos ----------` mais os 3 call sites no `app.js`. Sincronize antes de mexer
nesses.

### 8.1 Fotos claras × tema escuro

Registrado em 25/07/2026, quando o redesign definiu tema escuro. As 7 fotos geradas são **claras e
quentes por construção** — o prompt pede mesa clara, luz difusa e tons de mel, e a comida é a coisa
mais escura do quadro. Isso é bom para apetite e péssimo para texto branco por cima. Regras:

- **Texto NUNCA senta em imagem — em nenhuma superfície.** Título vai na folha, nome vai na faixa
  sólida (`var(--color-bg)`). Não é caso a caso: é regra-mãe, formalizada na §8.1.1. A paleta clara
  é decisão do prompt (§6.2), não acaso, e por isso o problema não tem solução por ajuste fino.
- **Scrim não existe em nenhuma superfície do app.** Nem no tile, nem no banner de hub, nem no tile
  de país. Se você está calculando opacidade de scrim, está implementando algo que foi descartado —
  leia a §8.1.1 antes de continuar.
- **O estado "sem foto" é decisão da frente de DESIGN.** Hoje é o placeholder 🍽 sobre
  `--color-surface-elevated`, herdado, não desenhado. Esta frente **não** decide como ele fica.

O que esta frente **garante** como contrato: `loadRecipeImage()` sinaliza a ausência de forma
**detectável** — quando não há foto, o elemento recebe a classe `placeholder` e não recebe `<img>`.
A frente de design pode estilizar esse estado como quiser, contando que o sinal existe e é estável.
Enquanto as 391 não forem geradas, esse estado é o da **maioria** das receitas, então não é um caso
de borda: é o caso comum hoje.

### 8.1.1 Resolução — regra-mãe adotada (item 6 do roadmap-mestre, 2026-07-26)

A pendência que a §8.1 registrava — como fazer texto claro ler sobre um acervo claro — foi resolvida
pela frente de design como regra-mãe formal, não caso a caso: **texto nunca senta em imagem.** Já valia pro
card de receita (nome numa faixa sólida sob a foto) e pra página de receita (título na folha
que desliza sobre o hero, nunca sobre o pixel da foto); esta rodada estendeu a mesma gramática
pro tile de categoria/home, pro banner dos 3 hubs e pro tile de país — sempre uma FAIXA/FOLHA
sólida (`var(--color-bg)`) carregando o texto, nunca o texto direto sobre a foto ou sobre o
blur. Ver `docs/DESIGN-TOKENS.md` ("Componentes" → tile de categoria/home + banner de hub + tile
de país) para a spec completa (estrutura, tamanhos, contraste medido).

**Alternativa avaliada e ARQUIVADA (não usada):** um par "blur 6px + véu branco a 25% de
opacidade + texto escuro por cima", medido entre **5,10:1 e 5,65:1** de contraste conforme a
região da foto por trás — passaria AA com folga em qualquer ponto da faixa. Ficou registrada
aqui como alternativa VÁLIDA, não como erro: a regra-mãe (faixa/folha sólida) foi preferida por
CONSISTÊNCIA com o que o app já fazia no card/página de receita (um único vocabulário visual de
"superfície que carrega texto sobre mídia" em vez de dois), não porque o véu branco falhasse
contraste ou tivesse algum problema técnico. Se uma superfície futura precisar de texto
sobreposto direto à foto (sem faixa/folha reservável), este par fica disponível como opção já
medida, sem precisar remedir do zero.

**Medição que REFORÇA a regra-mãe** (frente de imagens, 26/07/2026 — registrada aqui a pedido da
frente de design). O que torna este acervo hostil a texto sobreposto é ele ser claro e quente **por
construção**, não por acaso: o prompt pede superfície clara e tons de mel, e a §6.2 mostra que isso
é decisão travada. Medindo o ponto mais claro da faixa de texto em cada imagem, **texto branco
exigiria de 73% a 79% de scrim preto** para bater 4,5:1 — massas 73,3%, sobremesas 78,3%,
carnes-bovinas 75,4%, técnicas 79,0%. A 79% de preto a foto deixa de existir: os banners ficam
visualmente idênticos entre si e não resta imagem nenhuma para justificar ter gerado uma.

Ou seja, a regra-mãe não é só coerência de vocabulário visual — neste acervo específico, texto
claro sobreposto **não tem faixa de operação viável**. Os números acima existem para que ninguém
proponha "só põe um scrim" mais adiante e gaste uma rodada redescobrindo isso.

Valores finais medidos no acervo completo (19 imagens), caso o par arquivado seja retomado:
blur 6px + véu branco 25% + texto `#1a1a1a` → **pior caso 5,04:1** (`hub-fundamentos`),
**melhor caso 8,43:1** (`risotos-arroz`), todas acima de AA, nenhuma exceção.

Os bullets da §8.1 foram reescritos em 26/07/2026 para refletir esta regra — antes prescreviam
scrim e contradiziam o que está aqui.

---

## 9. Estado — ENTREGUE

> **Lote concluído e pushado em 25/07/2026.** As 398 fotos estão no repositório. Os dois bloqueios
> que existiam (§9.1 e §9.2) foram resolvidos antes do disparo — o histórico deles fica abaixo
> porque explica **por que** o template é como é, e reabrir qualquer um custaria dinheiro de novo.

**Fechado:** contrato de nome, proporção 4:3, resolução, resolução em 3 camadas, as superfícies 1–3,
enquadramento do hero, os 4 arquétipos, suíte de 24 testes, e o gatilho de foto para receita nova
(`CLAUDE.md` → seção "Foto de receita").

**Encerrado, não reabrir:** qual receita representa cada categoria. Resposta: nenhuma — o tile de
categoria usa imagem dedicada e não é cliente deste pipeline (ver §4).

### 9.1 Bloqueio 1 — louças A6 e A7 — ✅ RESOLVIDO

**Como foi resolvido:** a frase de enquadramento dessas duas louças trocou de
`"margin of bare table showing all around it"` para `"fills about two thirds of the width of the
picture, close to the camera"`. Instrução de **tamanho**, não de posição — o teste de 25/07 mostrou
que o modelo obedece tamanho e ignora posição. Regeradas Torta de Maçã e Affogato: a fatia passou a
encher a faixa visível e a tigela deixou de ser cortada na base.

O histórico do problema fica abaixo porque explica a regra, que continua valendo para receita nova.

> **PRÉ-CONDIÇÃO DO LOTE — louças A6 e A7.**
> As duas produzem prato pequeno demais no quadro: A6 (pratinho de sobremesa, 30 receitas) e A7
> (tigelinha de sobremesa, 6 receitas), **36 das 398**.
>
> No teste de 25/07 isso foi classificado como "fraco mas usável". **Essa avaliação caducou.** No
> redesenho a foto passa a ocupar **~60% do card**, e prato pequeno num quadro grande deixa de ser
> imperfeição e vira defeito visível — o card fica majoritariamente mesa vazia.
>
> Portanto: **reteste e reenquadramento de A6/A7 ANTES do disparo do lote.** Não é sugestão nem
> "vale a pena se sobrar tempo": é pré-condição. Disparar as 391 sem isso produz 36 fotos que serão
> refeitas depois, ao dobro do custo (a regeração não reaproveita nada — o gerador só pula o que já
> existe, então seria preciso apagar os masters de A6/A7 primeiro).
>
> Custo do reteste: R$ 0,68. **Não executado nesta sessão, por decisão do dono do projeto.**

As louças A1–A5 cobrem 350 das 397 receitas restantes e foram aprovadas no teste de 25/07. **Mas
aprovar a louça não aprovou o arquétipo** — ver §9.2.

### 9.2 Bloqueio 2 — 63 receitas NÃO são "prato pronto" — ✅ RESOLVIDO

**Como foi resolvido:** criado o eixo **ARQUÉTIPO**, que decide louça *e* mesa de uma vez. Quatro
valores: `prato` (335), `molho` (17), `preparo` (40), `processo` (6). Molho e preparo ganharam
louças novas (A8 molheira, A9 pote+ramequim) e um eixo B paralelo de **bancada de trabalho**, sem
talher de jantar, sem segundo prato, sem taça. As 6 técnicas puras receberam **prompt individual
escrito à mão** — o genérico havia posto "uma colher de chá e grãos caídos" numa costela de 4 kg.

A decisão que estava em aberto (§ abaixo) foi tomada: as 6 técnicas **ganharam foto de processo**,
não ficaram sem foto. Todas aprovadas — nenhuma inventou prato montado.

Duas correções saíram do teste e valem para receita nova: o cenário de bancada `T2` era
`pale grey stone`, que contradizia o `never cool grey` do próprio prompt e saía frio no meio de um
acervo quente — virou `warm cream-toned limestone`; e o negativo `no text` não segurou uma etiqueta
escrita num pote de conserva, então virou negativo **nomeado** (`no labels, no lettering, no printed
or handwritten text on jars, bottles, packaging`).

O diagnóstico do problema fica abaixo porque é o que impede alguém de reintroduzi-lo.

<details>
<summary>Histórico do problema (o que estava errado antes)</summary>

Encontrado em 25/07/2026 a partir de uma pergunta do dono do projeto ("há categorias de técnicas, que
não necessariamente pratos, molhos também — ex. água de tomate"). **Não foi visto no teste das 6
louças**, porque o teste cobriu geometria de louça e não tipo de conteúdo. São dois eixos diferentes
de erro, e só um foi testado.

**O template inteiro assume prato pronto.** O prompt abre com *"just served and about to be eaten,
seen from across a home dining table"*, e o eixo B acrescenta taça de vinho pela metade, garfo sobre
guardanapo amassado e **segundo prato vazio** — cenografia de refeição, aplicada a 100% das receitas.
Para uma Água de Tomate ou um Pó de Azeitona isso não é imperfeição de estilo: afirma visualmente que
a coisa é um jantar, e ela não é.

**Não é um problema, são três, com respostas diferentes:**

| Grupo | Qtd | O que está errado hoje | Direção |
|---|---|---|---|
| **Molhos** (`molhos`) | 17 | todos em A3, tigela funda de jantar | arquétipo **molheira**: saucière, fio caindo, molho sobre algo |
| **Preparações** (`contemporaneos` 27 + 13 de `tecnicas-contemporaneas-2`) | 40 | todos em A2, prato raso de porcelana | arquétipo **mise en place**: pote de vidro, ramequim, colher, bancada de trabalho, sem talher de jantar, sem segundo prato |
| **Técnicas sem forma visual** | 6 | não existe prato nenhum para fotografar | **em aberto — decisão da frente de design**, ver abaixo |

Exemplos concretos, para não virar abstração: Béchamel, Hollandaise, Demi-glace, Beurre Blanc,
Gastrique (molhos); Gel de Ervas, Óleo Aromático, Pó de Azeitona, Duxelles, Confit de Gema, Pickles
Rápidos, Caldos e Fundos, Espuma com Sifão (preparações).

> **O caso mais perigoso são as 6 técnicas puras:** `Sous-vide (Técnica Geral)`,
> `Maturação Seca (Dry Aging)`, `Defumação Caseira`, `Cura de Peixes e Carnes`,
> `Legumes Fermentados`, `Espelho de Molho`.
>
> Para elas o prompt injeta a lista de ingredientes e manda *"show the dish as it really looks when
> cooked, faithful to those ingredients"*. **Não existe prato.** O modelo vai inventar um — e vai
> inventar bem, com aparência fotográfica convincente. **Foto bonita de uma coisa que não
> corresponde a nada é pior que foto ausente**, porque ninguém desconfia dela e ninguém vai conferir
> 398 fotos uma a uma.
>
> **Decisão em aberto, é da frente de design**, e conecta diretamente com a §8.1: ou essas 6 ganham
> um arquétipo de processo (bancada, equipamento, matéria-prima em transformação), ou ficam sem foto
> — e aí o estado "sem foto" precisa estar desenhado, não herdado.

**Custo se disparar como está:** 63 × US$ 0,067 = US$ 4,22 = **R$ 21,44 dos R$ 133**, em fotos que
serão refeitas. E regerar **não reaproveita nada**: o gerador só pula o que já existe, então seria
preciso apagar os masters desses 63 antes de rodar de novo.

**Por que isso piora com o redesign, e não melhora:** com a foto ocupando ~60% do card, um card de
"Sous-vide (Técnica Geral)" exibindo um prato montado falso é pior do que um card sem foto. O mesmo
argumento de §9.1 vale aqui, com o dobro de receitas.

**Caso limítrofe registrado:** `Sanduíche Aberto (a base)` [dinamarca] tem "(a base)" no nome e cai
nos filtros de busca por técnica, mas **é** um prato montado — smørrebrød servido. Não entra nas 63.
Fica anotado para não ser recontado como erro numa próxima varredura.

</details>

**Como conferir numa receita nova:** `node scripts/gerar-imagens.js --receita="Nome"` (custo zero)
imprime o arquétipo escolhido e lista as 63 não-prato agrupadas. Molho ou técnica em categoria nova
vira `prato` **em silêncio** — é por isso que o diagnóstico existe e que `CLAUDE.md` manda ler o dry
run antes de gerar.

### 9.3 Commits desta frente — ✅ NO AR

| Commit | O quê |
|---|---|
| `af186dc` | contrato de integração + 7 webp de validação |
| `f907016` | gatilho de foto para receita nova, arquétipos, abort em teto de gasto, suíte 17→24 |
| `d763831` | as 398 fotos (`imagens/receitas/`, 44 MB) |

Todos verificados por pathspec antes do commit: nenhum arquivo da frente de redesign
(`css/style.css`, `js/app.js`, `sw.js`, `docs/DESIGN-TOKENS.md`) entrou por engano.

**A regra continua valendo para qualquer commit futuro desta frente:** pathspec explícito, nunca
`git add -A`, e conferir `git status` antes — há outra frente ativa nos mesmos arquivos.

### 9.4 O que ficou aberto

**Nada bloqueia mais o pipeline de imagens.** A pendência abaixo é de outra frente:

- **`CACHE_NAME` do `sw.js`.** O commit `54c612b` (redesign) alterou `css/style.css` e `js/app.js`,
  ambos no `APP_SHELL`, sem bumpar a versão — o `CLAUDE.md` exige o bump no mesmo push. Impacto
  reduzido porque o shell virou network-first: quem está online já recebe o arquivo novo. O buraco
  é o **fallback offline**, que fica preso na cópia antiga.
- ~~**Tile de categoria.** Imagem dedicada 1:1 600×600, decidida pela frente de design (§4). Não
  sai deste pipeline e ainda não existe.~~ — **RESOLVIDO (item 6 do roadmap-mestre, 2026-07-26):**
  acervo de 19 imagens gerado (`scripts/gerar-categorias.js`) e consumido pelo tile de
  categoria/home e banner de hub — ver §8.1.1 e `docs/DESIGN-TOKENS.md`.

**Ponto de atenção permanente:** o `object-position: center bottom` do hero (§6.2) já sobreviveu a
três commits de CSS de outras frentes. A suíte `scripts/test-foto-local.js` é o que detecta se ele
cair — rode-a depois de qualquer mudança grande em `css/style.css`.
