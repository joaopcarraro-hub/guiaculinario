# Prompt para categorizar receitas novas — Cardápio Gastronômico

> Como usar: cole este documento inteiro numa conversa nova com o Claude, junto com a receita
> (nome, ingredientes, modo de preparo — pode ser bruto/informal). Peça pra ele devolver o
> objeto pronto no formato abaixo. Depois é só colar o resultado de volta pra mim, que eu insiro
> no arquivo certo e publico.
>
> Este arquivo é atualizado sempre que a lista de categorias ou de tags mudar — sempre use a
> versão mais recente dele (`docs/prompt-categorizar-receita.md` no repositório).
>
> **Mudança 2026-08-05 (fase ESTEIRA-1):** (1) `ingredientsStructured` virou campo OBRIGATÓRIO
> de receita nova, com `stepIngredients` documentado como opcional — ver a seção
> "ingredientsStructured e stepIngredients"; (2) tag manual de `course:` passou a ser PERMITIDA
> no campo `tags` (era proibida até então) — ver as regras de tags e a taxonomia; (3) regra nova
> de air fryer: modo air fryer legítimo precisa de passo explícito em `steps`.

---

## Sua tarefa

Eu geralmente vou te mandar só o **nome do prato** (às vezes com o país/origem). A partir do nome,
você deve:
1. **Pesquisar a receita de verdade**, priorizando fontes confiáveis (site oficial de instituição
   culinária, livros/chefs reconhecidos, Wikipedia, sites especializados de receita bem
   estabelecidos) — não invente ingredientes/passos, e não misture receitas de pratos diferentes.
2. **NÃO buscar foto.** Esta etapa existia até 25/07/2026 e foi removida — não procure URL de
   imagem, não use Wikipedia/Wikimedia, não preencha campo de foto nenhum. A foto do prato é
   **gerada**, não encontrada: `scripts/gerar-imagens.js` produz uma foto própria, no padrão visual
   do acervo, e o app a resolve sozinho pelo NOME da receita (ver §3 abaixo e
   `docs/CONTRATO-IMAGENS-REDESIGN.md`). URL de terceiro aqui não é só desnecessária: ela é ignorada
   pelo app e dá a falsa impressão de que a receita já tem foto.
3. Devolver um objeto JavaScript pronto, seguindo **exatamente** este formato e ordem de campos:

```js
{
  name: "Nome do Prato",
  subgroup: "Nome do subgrupo dentro da categoria (opcional, veja abaixo)",
  desc: "Uma frase curta e apetitosa descrevendo o prato — não repita o nome.",
  origin: "País ou região de origem (ex.: 'Itália (Roma)', 'Brasil', 'Ásia')",
  // NÃO existe campo de imagem. Havia um `image:` aqui até 25/07/2026 e ele era MORTO:
  // nenhuma das 398 receitas tem esse campo e js/app.js nunca leu esse nome. O caminho da foto
  // é derivado do `name` (ver §3), então guardá-lo seria uma segunda fonte da verdade — e a
  // errada. Não reintroduza.
  time: { prep: "X min", cook: "Y min", total: "Z min" },
  // `total` aceita h/min e também dias/semanas ("2-3 dias", "3-4 semanas") — em faixa vale o
  // MAIOR valor pras tags de tempo. NUNCA texto sem número ("Varia", "Semanas"): não deriva
  // tag de tempo e o validador reprova.
  yield: "N porções",
  difficulty: "Fácil" | "Média" | "Média-alta" | "Difícil",
  tags: ["protein:xxx", "ingredient:yyy"], // course: manual também é permitido — ver regras abaixo
  ingredients: [
    "quantidade + ingrediente",
    "..."
  ],
  ingredientsStructured: [
    // OBRIGATÓRIO desde 2026-08-05 — versão estruturada de `ingredients`, uma entrada por
    // linha, na MESMA ordem e mesma quantidade de entradas. É o que alimenta o multiplicador
    // de porções e a Lista de Compras: receita sem este campo entra capenga no app, sem
    // nenhum erro visível. Estrutura exata e exemplo real na seção
    // "ingredientsStructured e stepIngredients" abaixo.
    {
      raw: "a linha correspondente de `ingredients`, idêntica",
      group: null, // ou o nome do bloco quando a receita agrupa ingredientes (ex.: "recheio (vatapá e caruru)")
      items: [
        {
          qty: 200,          // número; null quando não há quantidade ("a gosto")
          qtyRange: null,    // [min, max] quando a linha traz faixa ("8-10 pequis" -> [8, 10]); senão null
          unit: "grama",     // null quando a unidade é implícita ("2 ovos")
          item: "spaghetti", // o ingrediente em si, sem quantidade nem preparo
          prep: null,        // preparo da linha ("em tiras", "ralado (+ extra para servir)") ou null
          alt: "rigatoni",   // alternativa citada com "ou" na linha; senão null
          optional: false,   // true quando a linha marca "(opcional)"
          isReference: false // true quando o item referencia outra receita do acervo (ex.: "1 receita de Béchamel")
        },
      ],
    },
  ],
  steps: [
    "Passo 1 detalhado.",
    "Passo 2 detalhado.",
    "..."
  ],
  stepIngredients: [ /* OPCIONAL — ver seção abaixo */ ],
  tips: [
    "Dica útil 1.",
    "Dica útil 2."
  ]
}
```

Regras de conteúdo:
- Todos os campos são obrigatórios, exceto `subgroup` e `tips` (que podem ser omitidos se não
  fizerem sentido).
- **Foto: não é campo, é comando.** Depois que a receita estiver em `data/*.js`, rode na raiz do
  repo, com a chave setada:

  ```
  node scripts/gerar-imagens.js --receita="Nome Exato da Receita"          # dry run, custo zero
  node scripts/gerar-imagens.js --gerar --receita="Nome Exato da Receita"  # gera, ~R$ 0,34
  ```

  **Leia o dry run antes de gerar.** Ele imprime o arquétipo e a louça escolhidos. Duas coisas
  para conferir, porque erram em silêncio:

  1. **Arquétipo.** `prato` monta mesa posta com talher e taça — certo para um prato, errado para
     molho, preparação ou técnica. Se a receita nova for molho/preparo/técnica e o dry run disser
     `prato`, a regra precisa de ajuste em `CAT_ARQUETIPO` antes de gerar.
  2. **Louça.** Categoria nova sem regra cai no default (tigela funda). O dry run lista as receitas
     nessa situação num bloco próprio.

  O nome do arquivo sai do `name` da receita, então **renomear uma receita depois de gerar a foto
  deixa o arquivo órfão** — o app volta a não achar foto e cai na Wikipédia, sem erro visível.
  Renomeou, gere de novo.
- `desc` é UMA frase, apetitosa, sem repetir o nome do prato.
- `ingredients` e `steps` devem ser completos, detalhados e fiéis à fonte pesquisada — nada de
  "modo de preparo resumido" nem passos inventados.
- NÃO adicione tags de `country:`, `dish_type:`, `time:` ou `difficulty:` — essas são geradas
  automaticamente pelo site a partir da categoria e dos campos acima. Só adicione `protein:`,
  `contains:`, `ingredient:`, `diet:` e (quando fizer sentido) `course:` — ver taxonomia abaixo.
- `course:` manual é PERMITIDO desde 2026-08-05 (antes era proibido) e é ADITIVO: nunca
  substitui o `course:` automático da categoria — uma receita pode ser `course:principal` (da
  categoria) E `course:cafe-da-manha` (manual) ao mesmo tempo. Critério e valores válidos na
  taxonomia abaixo. Não repita o `course:` que a categoria já gera.
- Air fryer: se a receita tem um modo air fryer legítimo, ele precisa aparecer como PASSO
  explícito em `steps` citando "air fryer" — é esse passo que faz a tag `equipment:air-fryer`
  derivar (`data/derivation-dict.js` deriva equipamento de `steps`; termo direto sempre conta,
  verbos genéricos de assar só contam com yield pequeno). Modo air fryer que só existe em
  `tips` não vira filtro.

## ingredientsStructured e stepIngredients

`ingredientsStructured` é OBRIGATÓRIO (398/398 receitas do acervo têm) — uma entrada por linha
de `ingredients`, na mesma ordem, com `raw` idêntico ao texto da linha. Exemplo real, copiado de
`data/massas.js` (Carbonara, 3 primeiras entradas):

```js
ingredientsStructured: [
  {
    raw: "200 g de spaghetti ou rigatoni",
    group: null,
    items: [
      { qty: 200, qtyRange: null, unit: "grama", item: "spaghetti", prep: null, alt: "rigatoni", optional: false, isReference: false },
    ],
  },
  {
    raw: "120 g de guanciale (ou pancetta), em tiras",
    group: null,
    items: [
      { qty: 120, qtyRange: null, unit: "grama", item: "guanciale", prep: "em tiras", alt: "pancetta", optional: false, isReference: false },
    ],
  },
  {
    raw: "2 ovos inteiros + 2 gemas",
    group: null,
    items: [
      { qty: 2, qtyRange: null, unit: null, item: "ovos inteiros", prep: null, alt: null, optional: false, isReference: false },
      { qty: 2, qtyRange: null, unit: null, item: "gemas", prep: null, alt: null, optional: false, isReference: false },
    ],
  },
],
```

Observações:
- Uma linha com dois ingredientes ("2 ovos inteiros + 2 gemas") vira UMA entrada com DOIS
  `items` — o número de entradas continua igual ao de linhas de `ingredients`.
- `group` nomeia blocos quando a receita separa ingredientes por etapa (ex.: Acarajé usa
  `group: "recheio (vatapá e caruru)"`); receita sem blocos usa `group: null` em tudo.
- `qtyRange` usa array `[min, max]` (ex.: "8-10 pequis" → `qtyRange: [8, 10]`, com `qty: null`).

`stepIngredients` é OPCIONAL — liga passos a ingredientes pro modo cozinhar: um array paralelo a
`steps` (mesmo comprimento), onde cada posição é `null` (passo sem destaque de ingrediente) ou
uma lista de `{ entryIndex, itemIndex, fraction }` apontando pra
`ingredientsStructured[entryIndex].items[itemIndex]` e a fração daquela quantidade usada no
passo (ex. real em `data/massas.js`: `[{ entryIndex: 1, itemIndex: 0, fraction: 0.5 }]` — metade
do guanciale nesse passo). Se não tiver certeza das ligações, omita o campo — errado é pior que
ausente.

## Em qual categoria colocar

Me diga também em qual arquivo/categoria a receita deve entrar, escolhendo desta lista atual
(formato `id — Nome exibido`):

**Fundamentos**
`molhos` — Molhos Clássicos · `sopas` — Sopas · `entradas-frias` — Entradas (fria) ·
`entradas-quentes` — Entradas (quente) · `massas` — Massas · `risotos` — Risotos/Arroz (risoto) ·
`padaria` — Padaria · `sobremesas-classicas` — Sobremesas ·
`contemporaneos` — Técnicas (prato clássico contemporâneo) ·
`tecnicas-contemporaneas-2` — Técnicas (técnica/componente avançado)

`contemporaneos` e `tecnicas-contemporaneas-2` aparecem juntos como uma única coleção "Técnicas"
no site — mas continuam sendo arquivos/catIds separados. Use `contemporaneos` pra um prato
pronto de cozinha contemporânea; `tecnicas-contemporaneas-2` pra uma técnica/componente/base
mais avançada e isolada (ex: esferificação, espuma, sous-vide). Mesma lógica pra `risotos`
(risoto de verdade) vs `arrozes` (outros pratos de arroz) — ambos aparecem juntos como
"Risotos/Arroz" — e pra `entradas-frias` (servida fria) vs `entradas-quentes` (servida quente),
que aparecem juntas como "Entradas".

**Proteínas**
`aves` — Aves · `carnes-bovinas` — Carnes Bovinas · `cordeiro` — Cordeiro · `suinos` — Suínos ·
`peixes` — Peixes · `frutos-do-mar` — Frutos do Mar · `arrozes` — Risotos/Arroz (arroz, não-risoto) ·
`ovos-basicos` — Ovos (técnica básica) · `ovos-classicos` — Ovos (preparação clássica)

`ovos-basicos` e `ovos-classicos` não têm mais coleção própria em Fundamentos — toda receita de
ovo já leva `protein:ovo`, então aparece em "Ovos" (Proteínas) automaticamente. Use
`ovos-basicos` pra técnica/preparo fundamental (poché, mexido, omelete simples);
`ovos-classicos` pra preparação clássica mais elaborada (soufflé, Benedict, quiche).

**Brasil**
`brasileiros` — Brasileiros Obrigatórios · `brasil-regional` — Brasil por Região

**Países**
`franca` `italia` `espanha` `portugal` `japao` `china` `coreia` `tailandia` `india` `mexico`
`peru` `alemanha` `austria` `hungria` `grecia` `marrocos` `libano` `eua` `dinamarca`

Se a receita não se encaixar em nenhuma categoria existente, me avise — pode ser hora de criar
uma nova (isso exige uma etapa extra de código, então sinalize em vez de forçar um encaixe ruim).

## Taxonomia de tags (protein:, contains:, ingredient:, diet: e course:)

**protein:** — a proteína **protagonista** do prato, não qualquer proteína presente. Regra
importante (fonte de um bug já corrigido no site): se a carne/proteína é só um componente
secundário/de sabor — não o que define o prato — ela NÃO entra aqui, entra em `contains:` (abaixo).
Todo prato pode ter zero, uma ou várias tags `protein:`, mas só as que forem realmente centrais:
- `protein:frango` — frango especificamente (galinha, peito, coxa, sobrecoxa)
- `protein:ave` — outra ave que não frango (pato, peru)
- `protein:boi` — carne bovina
- `protein:suino` — porco **quando é o protagonista do prato** (ex.: Tonkatsu, Feijoada, Char Siu,
  Costelinha, Pernil assado) — NÃO use só porque tem bacon/pancetta/guanciale/presunto/linguiça
  como tempero ou componente secundário (isso é `contains:suino`, veja abaixo)
- `protein:cordeiro` — cordeiro/borrego/carneiro
- `protein:peixe` — peixe
- `protein:frutos-do-mar` — camarão, lula, polvo, mexilhão, marisco
- `protein:ovo` — só quando o ovo é o protagonista do prato (omelete, quiche) — NÃO use só porque
  tem ovo na massa/recheio de um bolo/pão
- `protein:leguminosa` / `protein:laticinio` — uso raro, só quando uma leguminosa (feijão, lentilha,
  grão-de-bico) ou um laticínio (queijo, iogurte) é claramente o foco proteico do prato (ex.: um
  prato de lentilhas como principal) — não use em todo prato vegetariano, só quando fizer sentido
  como "proteína protagonista"

Vegetarianos/veganos NÃO usam `protein:`, usam **dieta** (ver abaixo).

**diet:** — dieta/restrição, não é proteína:
- `diet:vegetariana` — sem nenhuma carne, ave, peixe ou fruto do mar (pode ter ovo/laticínio)
- `diet:vegana` — sem nenhum produto animal (nem ovo, nem laticínio, nem mel)

**contains:** — presença secundária de uma proteína que NÃO é o protagonista, mas ainda é útil
pra busca. Existe pra suíno, carne bovina, aves/frango, peixe, frutos do mar, cordeiro e ovo:
`contains:suino` `contains:boi` `contains:ave` `contains:frango` `contains:peixe`
`contains:frutos-do-mar` `contains:cordeiro` `contains:ovo`
- ex.: Carbonara → `contains:ovo` (o ovo é o molho, não o protagonista — o prato é de massa), Beef
  Wellington → `contains:suino` (presunto de Parma envolve o filé, mas o prato é de carne bovina),
  Boeuf Bourguignon → `contains:suino` (bacon é só um dos aromáticos do ensopado de carne bovina).
  Nesses três exemplos NÃO use `protein:suino`/`protein:ovo`.

Teste rápido pra decidir entre `protein:X` e `contains:X`: se você tirasse esse ingrediente da
receita, o prato ainda seria reconhecível com o mesmo nome? Se sim (Carbonara sem ovo ainda é
"uma carbonara", só que pior), é `contains:`. Se não (Tonkatsu sem porco deixa de ser Tonkatsu),
é `protein:`.

**ingredient:** — só quando o ingrediente é decisivo pra identidade do prato (não marque sal, água
ou óleo genéricos, a menos que sejam o protagonista):
`ingredient:ovo` `ingredient:tomate` `ingredient:queijo` `ingredient:arroz` `ingredient:batata`
`ingredient:mandioca` `ingredient:milho` `ingredient:feijao` `ingredient:berinjela`
`ingredient:cogumelo` `ingredient:abobora` `ingredient:pimentao` `ingredient:azeitona`
`ingredient:limao` `ingredient:coco` `ingredient:castanha` `ingredient:chocolate` `ingredient:cafe`
`ingredient:vinho` `ingredient:cerveja` `ingredient:mel` `ingredient:iogurte` `ingredient:espinafre`
`ingredient:ervilha` `ingredient:lentilha` `ingredient:grao-de-bico` `ingredient:amendoim`
`ingredient:molho-de-soja` `ingredient:brocolis`

NÃO marque `seasoning:alho`, `seasoning:cebola`, `seasoning:gengibre` nem `seasoning:curry` —
essas quatro tags existem, mas o site já deriva elas automaticamente a partir do texto de
`ingredients` (procurando "alho"/"cebola"/"gengibre"/"curry" como palavra inteira na lista de
ingredientes). Taguear à mão é redundante e não muda nada.

**course:** — momento da refeição (PERMITIDO como tag manual desde 2026-08-05; antes só a
categoria gerava). A tag manual é sempre ADITIVA à automática da categoria — nunca a substitui.
Critério: o momento em que o prato é **de fato consumido no Brasil**, quando
diferente/adicional ao que a categoria já dá. Valores válidos (os `course:*` de `js/tags.js`):
`course:entrada` `course:principal` `course:sobremesa` `course:acompanhamento`
`course:cafe-da-manha`
- ex.: Shakshuka mora em `ovos-classicos` (que já gera `course:principal` automático), mas é
  café da manhã clássico → adicionar `course:cafe-da-manha` manual. Não repita o `course:` que
  a categoria já gera (redundante, não muda nada).

Não invente tags novas fora dessas listas. Se nenhuma tag decisiva se aplicar, devolva `tags: []`.

## Formato de saída

Para cada receita, devolva:
1. A categoria escolhida (`id`).
2. O objeto JS completo, pronto pra copiar e colar.

Se eu mandar várias receitas de uma vez, devolva uma por uma, agrupadas por categoria.
