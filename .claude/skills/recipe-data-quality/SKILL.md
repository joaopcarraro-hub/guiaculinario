---
name: recipe-data-quality
description: Auditar qualidade dos dados de receitas, tags, coleções, dificuldades, tempos, ingredientes, categorias duplicadas e inconsistências de taxonomia.
---

# Recipe Data Quality

Use esta skill para revisar arquivos de dados, tags e coleções do app de receitas.

## Objetivo

Encontrar inconsistências que prejudicam navegação, busca e decisão do usuário.

## Verificações obrigatórias

### Tags de dificuldade

Toda receita deve ter dificuldade derivável.

Se a receita tem campo difficulty, complexity ou similar, gerar uma tag:
- difficulty:facil
- difficulty:media
- difficulty:dificil

Labels de UI:
- Fácil
- Intermediária
- Avançada

### Tags de tempo

Toda receita deve ter tag de tempo derivável:
- time:ate-30-min
- time:ate-1h
- time:mais-de-1h
- time:preparo-longo

### Tags de proteína

protein:* só quando for foco real.

Se for ingrediente secundário, usar:
- contains:*
- ingredient:*

### course:principal

Revisar receitas com course:principal.

Remover de:
- técnicas
- bases
- molhos
- componentes
- preparos isolados

Substituir por:
- format:tecnica
- format:base
- format:componente
- format:molho

Nota (2026-08-05, fase ESTEIRA-1): tag manual de `course:` passou a ser PERMITIDA e é sempre
ADITIVA ao automático da categoria — ver
`.claude/skills/cooking-taxonomy-architect/SKILL.md` e `docs/prompt-categorizar-receita.md`.

### Receita nova / lote novo (fase ESTEIRA-1, 2026-08-05)

- `ingredientsStructured` é OBRIGATÓRIO em receita nova (398/398 do acervo têm; alimenta o
  multiplicador de porções e a Lista de Compras — receita sem ele entra capenga, sem erro
  visível). Mesmo número de entradas (`raw`) que linhas de `ingredients`, na mesma ordem.
  `stepIngredients` é opcional. Formato exato e exemplo real em
  `docs/prompt-categorizar-receita.md`.
- Modo air fryer legítimo exige passo explícito de air fryer em `steps` — é o que faz
  `equipment:air-fryer` derivar (data/derivation-dict.js deriva equipamento de steps).
- Validador de lote: `node scripts/validar-lote.js <arquivo-do-lote>` (sem argumento valida o
  acervo inteiro; `--self-test` roda a fixture negativa embutida). Usa o TagModel REAL via
  sandbox, checa schema, dificuldade/tempo parseáveis, colisão de nome e slug contra o acervo,
  tags manuais válidas, contagem de ingredientsStructured, origin sem país (warning) e foto
  faltando (warning). Erros derrubam (exit != 0); warnings não.

### Categorias duplicadas

Verificar duplicidade entre:
- Proteínas
- Por proteína

Deve existir apenas um grupo macro: Proteínas.

### Cozinhas

Brasil deve estar dentro de Países.

Não deve existir separação redundante entre Brasil e Países na home.

### Tags pesquisáveis

Termos comuns de usuário devem funcionar:
- sanduíche
- brócolis
- alho
- cebola
- ovo
- frango
- porco
- carne
- peixe
- massa

Se não houver tag formal, sugerir criar ou permitir filtro textual combinável.

### Nomes de receita em português (recipe.name)

Investigação em 2 rodadas (2026-07-24, 398 receitas classificadas). A 1ª rodada tratou nomes
compostos como bloco atômico e errou casos como Ragù alla Bolognese e Fiskesuppe (deveriam ter
sido decompostos, não mantidos inteiros). A 2ª rodada decompôs token a token e produziu a regra
final abaixo — 95 renomes aplicados no total entre as duas. Regra pra receita NOVA seguir a
mesma linha final, não a da 1ª rodada.

Regra final: MANTÉM o nome original se e somente se (A) já é conhecido no Brasil por esse nome
exato — uso real, não hipotético (Mac and Cheese, Sushi, Ramen, Pad Thai, Carbonara, Feijoada)
— OU (B) é nome próprio ou nome de técnica fixa: eponímico (Chateaubriand, Pavlova), toponímico
(Beef Wellington, Wiener Schnitzel) ou técnica clássica com nome fixo (Béchamel, Velouté,
Confit, Navarin, Blanquette). Senão, TRADUZ.

Traduzir é decompor o nome token a token: traduz a parte descritiva/genérica, mantém o núcleo
que carrega a identidade do prato — nunca vira tradução literal do bloco inteiro nem preservação
do bloco inteiro. Exemplos-modelo:
- Fiskesuppe → Sopa de Peixe ("fisk" é só ingrediente, sem identidade própria além disso)
- Risotto al Limone → Risoto de Limão ("risotto" vira "risoto" — grafia já dicionarizada — "al
  Limone" é só "com limão")
- Ragù alla Bolognese → Ragù à Bolonhesa ("Ragù" É a identidade/técnica, "alla Bolognese" é só
  modificador geográfico descritivo — mantém o núcleo, traduz o descritor)
- Sole Meunière → Linguado à Meunière Clássica (traduz o peixe, "meunière" é técnica fixa —
  qualificador "Clássica" entrou só por colisão com outra receita de linguado do acervo, não
  por regra geral)

Nunca decidir de cabeça se o caso novo não for claramente análogo a um destes — registrar a
dúvida em vez de aplicar sozinho.

Tratamentos especiais (fogem da regra mecânica, exigem julgamento explícito e documentado):
1. Colisão de sentido em português: tradução literal criaria um significado já estabelecido e
   diferente no idioma. "Risoto alla Milanese" NÃO vira "Risoto à Milanesa" porque "à milanesa"
   já significa empanado no português do Brasil — traduzir induziria o usuário a esperar um
   prato empanado que a receita não é. Mantém o italiano.
2. Confusão cultural/factual: tradução literal afirma algo falso sobre o prato. Franskbrød
   (dinamarquês) NÃO vira "pão francês" — não é receita de pão francês nem remete a ele, é só
   um pão branco de forma dinamarquês; virou "Pão Branco Dinamarquês".
3. Nome desconectado do conteúdo real: Æbleskiver mantém o nome dinamarquês porque a tradução
   literal ("fatias de maçã") não tem relação com o prato real (bolinhos esféricos fritos, sem
   maçã) — traduzir literalmente enganaria mais do que preservar o nome original.

Se a tradução colidir com nome de outra receita já existente no acervo (nome duplicado, não só
slug), adicionar um qualificador que resolva a ambiguidade sem forçar (ex.: Citrontærte → "Torta
de Limão Dinamarquesa", pra não colidir com outra torta de limão do acervo). Confirmar por
script contra o acervo real completo — nunca de cabeça.

Se renomear recipe.name: o `id` é `slugify(recipe.name)` (TagModel) — renomear muda o slug e
afeta 3 sistemas chaveados por ele: Storage favoritas/feitas (`cardapio-state-v2`), últimas
receitas visitadas (`gusta-recentes-v1`), e URLs (#/receita/:id, #/cozinhar/:id, ?from=). Migrar
seletivamente: adicionar o par slug-antigo→slug-novo em `RENAME_SLUG_MAP` (js/storage.js,
compartilhado com o alias do Router) — nunca orfanar sem necessidade, o mecanismo já existe e é
barato de estender.

Migração ENCADEADA: se uma receita já tinha sido renomeada antes (já existe entrada no
RENAME_SLUG_MAP apontando pra ela) e é renomeada DE NOVO, o lookup é single-level — não segue
cadeia sozinho. É preciso (1) atualizar o alvo da entrada já existente pro slug final novo, e
(2) adicionar uma entrada NOVA pro slug intermediário (o que era o alvo antes) também apontando
pro slug final. Sem isso, quem favoritou/visitou entre os dois deploys orfana. Exemplo real
(2026-07-24): "Risotto al Limone" (nome original) → "Risoto al Limone" (1ª rodada) → "Risoto de
Limão" (2ª rodada) — RENAME_SLUG_MAP mapeia TANTO risotto-al-limone QUANTO risoto-al-limone pra
risoto-de-limao.

Confirmar sempre por script, nunca de cabeça: zero colisão de nome E de slug contra o acervo
real completo, os dois níveis do alias do Router resolvendo pro slug final, e que a derivação de
tag não mudou (recipe.name nunca entra em getRecipeTags — só ingredients/origin/steps/time/
difficulty/tags manual).

## Saída esperada

Ao auditar, retornar:
1. Problemas encontrados
2. Arquivos afetados
3. Correção recomendada
4. Prioridade: P0, P1, P2
5. Risco de quebrar comportamento atual
