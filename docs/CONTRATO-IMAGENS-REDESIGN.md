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

### Cobertura hoje

**7 de 398 receitas têm foto.** São: Paella, Wiener Schnitzel, Feijoada, Moussaka, Beef Brisket,
Torta de Maçã, Affogato — escolhidas de propósito, uma por tipo de louça, para validar o template.
As outras 391 continuam sem foto própria e caem no fallback da Wikipédia (ver §3).

Gerar as 391 restantes custa US$ 26,20 (R$ 133). Está em espera aguardando o redesign — **de
propósito**, porque nenhuma decisão de layout depende de ter as 398 prontas: o contrato de nome,
proporção e resolução já está fechado e não muda com o volume.

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

As superfícies 1–3 usam `object-fit: cover`.

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
| **16:9** | **1,778** | **75% da altura** | **o hero de hoje** |
| 2:1 | 2,000 | 67% da altura | limite do aceitável |
| 21:9 | 2,333 | 57% da altura | começa a cortar prato |
| 3,27:1 | 3,270 | 41% da altura | **era o hero antigo no desktop. Quebrado.** |
| **1:1** | **1,000** | **75% da largura** | **os thumbs de hoje** |
| 4:5 (vertical) | 0,800 | 60% da largura | prato pode ficar apertado |

**Onde o prato está na foto:** medido nas 7 fotos geradas, o prato ocupa a faixa vertical
**y ∈ [25%, 80%]** e é centralizado horizontalmente com leve deslocamento à esquerda. É por isso que:

- no hero 16:9 com `object-position: center bottom`, a faixa visível é **y ∈ [25%, 100%]** — pega o
  prato inteiro e joga fora os 25% de cima, que é justamente onde vem lixo (ver §6);
- nos thumbs 1:1, o corte é lateral e a altura inteira aparece — o prato cabe naturalmente, sem
  precisar de `object-position`.

> **Regra prática para o redesign:** qualquer caixa entre **1:1 e 2:1** funciona sem ajuste fino.
> Fora dessa janela, gere o recorte e olhe antes de fechar o layout.

### O hero tem uma sutileza a mais

O conteúdo da página desliza por cima da metade de baixo do hero, então **antes da rolagem só a
metade SUPERIOR da caixa aparece**. Faixa efetivamente visível de largada: **y ∈ [25%, 62,5%]** do
master. Se o redesign mudar essa sobreposição, esse número muda junto — recalcule.

---

## 6. Decisões que NÃO devem ser reabertas

Cada uma custou uma rodada de geração ou dinheiro.

### 6.1 `aspect-ratio: 16/9` no hero, nunca altura fixa

O hero tinha `height: 220px`. Altura fixa faz o **enquadramento depender da largura da tela**, porque
muda a proporção da caixa. Medido no master da Paella:

| Largura da tela | Caixa | Faixa visível | Resultado |
|---|---|---|---|
| 390px (celular) | 390×220 = 1,77:1 | y 24,8% → 62,4% | prato inteiro ✔ |
| 720px (desktop) | 720×220 = 3,27:1 | y 59,3% → 79,6% | só a borda de baixo da panela ✘ |

Com `aspect-ratio`, a caixa acompanha a largura e a faixa vira **25% → 62,5% em qualquer tela**,
inclusive 219px de altura num celular de 390px — ou seja, **no celular nada mudou**.
Se o redesign quiser outra altura de hero, use **proporção**, não pixel.

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

- **Nenhum texto sobre foto sem scrim escuro.** Não existe foto neste acervo em que texto claro leia
  direto. Não é caso a caso: é regra, porque a paleta clara é uma decisão do prompt, não acaso.
- **O banner borrado de categoria leva scrim com contraste calculado** — não um `opacity` chutado.
- **O estado "sem foto" é decisão da frente de DESIGN.** Hoje é o placeholder 🍽 sobre
  `--color-surface-elevated`, herdado, não desenhado. Esta frente **não** decide como ele fica.

O que esta frente **garante** como contrato: `loadRecipeImage()` sinaliza a ausência de forma
**detectável** — quando não há foto, o elemento recebe a classe `placeholder` e não recebe `<img>`.
A frente de design pode estilizar esse estado como quiser, contando que o sinal existe e é estável.
Enquanto as 391 não forem geradas, esse estado é o da **maioria** das receitas, então não é um caso
de borda: é o caso comum hoje.

---

## 9. Estado — FRENTE CONGELADA

> **Esta frente está congelada por decisão do dono do projeto, 25/07/2026, até aviso.**
> Não gerar nem regerar imagem, não commitar, não fazer push, não tocar em `css/style.css` nem em
> `js/app.js`. O que segue é registro, não plano de execução.

**Fechado:** contrato de nome, proporção 4:3, resolução, resolução em 3 camadas, as superfícies 1–3,
enquadramento do hero, suíte de 17 testes, service worker v21.

**Encerrado, não reabrir:** qual receita representa cada categoria. Resposta: nenhuma — o tile de
categoria usa imagem dedicada e não é cliente deste pipeline (ver §4).

### 9.1 Bloqueio 1 de 2 — louças A6 e A7

Custo do lote: US$ 26,20 = R$ 133. Não disparar enquanto **os dois** bloqueios (§9.1 e §9.2) não
forem resolvidos.

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

### 9.2 Bloqueio 2 de 2 — 63 receitas NÃO são "prato pronto para comer"

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

### 9.3 Pendência operacional — commit desta frente

Registrado, **não executado**. Quando a frente for retomada, o commit desta frente é exatamente:

```
git add docs/CONTRATO-IMAGENS-REDESIGN.md imagens/
git commit -m "<mensagem descrevendo TUDO que o commit contém>"
```

Três condições, todas obrigatórias:

1. **Pathspec explícito, nada além desses dois caminhos.** Nunca `git add -A` nem `git add .` — há
   outra frente com trabalho não commitado nos mesmos arquivos (ver `CLAUDE.md`).
2. **Só depois de confirmar que nenhuma fase do redesign está ativa nos arquivos compartilhados**
   (`css/style.css`, `js/app.js`). Confirmar antes, não presumir.
3. **`push` só com autorização explícita do dono do projeto.**
