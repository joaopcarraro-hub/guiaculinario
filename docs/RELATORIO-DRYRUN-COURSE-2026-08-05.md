# Relatório dry-run — re-encaixe de `course:` nas 398 receitas (fase ESTEIRA-1)

> **DESFECHO 2026-08-05 (fase ENCAIXE-1) — APLICADO.** O dono aprovou e as 60 tags foram
> escritas em `data/*.js` no mesmo dia: as 20 ALTA de cafe-da-manha (§2) + Croque Monsieur,
> as 17 de sobremesa (§5.2), as 13 de entrada (§5.3) e as 9 de acompanhamento (§5.4).
> Contagens finais medidas: cafe-da-manha 9→30, sobremesa 19→36, entrada 25→38,
> acompanhamento 24→33, principal 84 (inalterado), receitas sem course: 237→194.
> Das 11 DUVIDOSAS de cafe-da-manha (§3), o dono aprovou SOMENTE Croque Monsieur; as outras
> 10 NÃO receberam a tag: Ovo Mollet, Ovo a Baixa Temperatura (63°C), Ovo Confitado,
> Frittata, Tamagoyaki, Ovos en Cocotte à la Forestière, Pastel de Nata, Kaiserschmarrn,
> Æbleskiver e Leitelho Gelado (as 4 últimas seguem com a sobremesa da §5.2, só sem café).
> Suíte que trava o desfecho: `scripts/verify-encaixe-course-2026-08-05.js`. A varredura
> exaustiva das 194 restantes sem course: segue PENDENTE como fase própria (E2, ver §5.1).

> **2026-08-05 — RELATÓRIO PARA APROVAÇÃO, ZERO ESCRITA EM `data/*.js`.** Nenhuma tag foi
> adicionada: este documento é a proposta. Depois do aval do dono, a aplicação vira uma tarefa
> própria (e cada adição passa pelo validador novo, `scripts/validar-lote.js`).
>
> Regra em vigor (decisão do dono, fase ESTEIRA-1): `course:` manual é permitido no campo
> `tags` e é ADITIVO ao automático da categoria — nunca substitui. Critério: o momento em que
> o prato é de fato consumido no Brasil, quando diferente/adicional ao que a categoria já dá.

## 1. Estado atual (medido com o TagModel real, não de cabeça)

Cobertura de `course:` hoje (automático de `CATEGORY_BASE_TAGS` + 2 manuais de
`contemporaneos`), sobre 398 receitas:

| course:               | receitas |
|-----------------------|----------|
| principal             | 84       |
| entrada               | 25       |
| acompanhamento        | 24       |
| sobremesa             | 19       |
| cafe-da-manha         | 9        |
| **NENHUM course:**    | **237**  |

- `course:cafe-da-manha` = exatamente as 9 receitas de `padaria`. O momento "Café da Manhã"
  da Pesquisar não enxerga Shakshuka, Eggs Benedict, Huevos Rancheros etc. (moram em `ovos-*`,
  que deriva `course:principal`).
- As 237 sem course: são as categorias que não injetam course: nenhum — todas as 19 de país
  (dinamarca 44, japao 15, china 9, mexico 9...), `brasileiros` (16), `brasil-regional` (12),
  `contemporaneos` (25, exceto 2 manuais) e `tecnicas-contemporaneas-2` (19).

## 2. Foco principal: `course:cafe-da-manha` — CONFIANÇA ALTA (20)

### ovos-basicos (8)

| receita | julgamento |
|---|---|
| Ovo Cozido (mole, médio e duro) | presença diária no café da manhã brasileiro, do fitness ao pão com ovo |
| Ovo Poché | clássico de café/brunch — base da torrada com ovo poché |
| Ovo Frito Perfeito | pão na chapa com ovo frito é café de padaria brasileira |
| Ovo Mexido Francês (cremoso) | ovo mexido é O café da manhã arquetípico |
| Ovo Mexido Americano | idem, versão diner — consumida no Brasil no mesmo momento |
| Omelete Francesa | omelete de café/brunch, padrão de hotel |
| Ovo Cocotte | clássico de brunch — ramequim assado é serviço de café reforçado |
| Ovo no Ramequim (simples) | versão simples do cocotte, mesmo momento |

### ovos-classicos (6)

| receita | julgamento |
|---|---|
| Eggs Benedict | ícone absoluto de brunch — o prato-símbolo do café da manhã de restaurante |
| Eggs Florentine | variação direta do Benedict, mesmo momento |
| Eggs Royale | idem, com salmão defumado |
| Shakshuka | café da manhã levantino consagrado (o exemplo canônico da lacuna atual) |
| Menemen | café da manhã turco por definição |
| Huevos Rancheros | desayuno mexicano — consumido como café reforçado |

### dinamarca (6)

| receita | julgamento |
|---|---|
| Pão de Centeio | rugbrød é pão de mesa de café dinamarquês; aqui, papel de pão de café |
| Pão Branco Dinamarquês | pão de forma de café da manhã |
| Pãezinhos Redondos | rundstykker — o papel do nosso pão francês no café |
| Pãezinhos | idem, pães pequenos de café |
| Wienerbrød (Massa Folhada Dinamarquesa) | a "danish" é vitrine de café da manhã/padaria |
| Rolinho de Canela | cinnamon roll: café da manhã/lanche de padaria |

## 3. `course:cafe-da-manha` — DUVIDOSA (11, decidir caso a caso)

| receita (categoria) | julgamento |
|---|---|
| Ovo Mollet (ovos-basicos) | técnica-ponte; aparece mais como componente de prato do que na mesa de café |
| Ovo a Baixa Temperatura 63°C (ovos-basicos) | técnica de restaurante, raramente café em casa |
| Ovo Confitado (ovos-basicos) | técnica contemporânea de montagem, não de mesa de café |
| Frittata (ovos-basicos) | no Brasil vive mais como almoço/jantar leve do que café |
| Tamagoyaki (ovos-basicos) | café da manhã no Japão; no Brasil é consumido como comida japonesa (jantar) |
| Ovos en Cocotte à la Forestière (ovos-classicos) | cocotte sofisticado com cogumelos — mais brunch tardio/entrada |
| Croque Monsieur (entradas-quentes) | brunch/café reforçado possível, mas no Brasil é lanche; já tem course:entrada da categoria |
| Pastel de Nata (portugal) | consumido com café, mas o momento dominante aqui é lanche/sobremesa (ver §5.2) |
| Kaiserschmarrn (austria) | panqueca doce que na Áustria fecha refeição; como café é uso de brunch (ver §5.2) |
| Æbleskiver (dinamarca) | doce sazonal de lanche/café da tarde, não de manhã (ver §5.2) |
| Leitelho Gelado (dinamarca) | koldskål é café/lanche de verão dinamarquês; a leitura brasileira é sobremesa (ver §5.2) |

## 4. Candidatas de ovos EXCLUÍDAS de cafe-da-manha, com motivo (5)

| receita | motivo |
|---|---|
| Tortilla Española (ovos-basicos) | tapa/almoço — não é café nem na Espanha nem no Brasil |
| Ovos en Meurette (ovos-classicos) | clássico borgonhês com molho de vinho tinto; almoço/entrada |
| Ovos à Portuguesa (ovos-classicos) | prato de almoço/jantar |
| Ovos com Maionese (ovos-classicos) | entrada fria clássica — candidata a course:entrada (§5.3), não a café |
| Scotch Egg (ovos-classicos) | petisco de pub/piquenique — candidata a course:entrada (§5.3), não a café |

## 5. Outros momentos errados/faltantes achados no caminho (seção separada)

### 5.1 Achado estrutural (o maior)

**237/398 receitas não têm `course:` NENHUM** — nenhuma categoria de país (nem
brasileiros/brasil-regional) injeta course:, então a faceta "Refeição" do modal de filtros e o
momento "Café da Manhã" da Pesquisar simplesmente não enxergam 60% do acervo. O re-encaixe
completo dos países é MAIOR que o julgamento receita-a-receita desta fase e merece rodada
própria (categoria a categoria, mesmo formato deste relatório). Abaixo, só os casos óbvios
achados de passagem — amostra com confiança alta, não varredura exaustiva dos países.

### 5.2 `course:sobremesa` fora de sobremesas-classicas — ALTA (17)

| receita (categoria) | julgamento |
|---|---|
| Strudel de Maçã (austria) | sobremesa vienense por definição |
| Kaiserschmarrn (austria) | servida como sobremesa/doce principal na Áustria |
| Torta de Maçã (eua) | a apple pie é sobremesa-símbolo |
| Zabaglione (italia) | creme de sobremesa clássico |
| Semifreddo (italia) | sobremesa gelada |
| Affogato (italia) | sobremesa de café e gelato |
| Pastel de Nata (portugal) | doce de pastelaria — sobremesa/café |
| Æbleskiver (dinamarca) | bolinhos doces natalinos |
| Risalamande (dinamarca) | sobremesa natalina de arroz doce |
| Bolo dos Sonhos (dinamarca) | drømmekage — bolo de sobremesa/lanche |
| Fatias de Framboesa (dinamarca) | hindbærsnitter — doce de pastelaria |
| Bolo de Camadas (dinamarca) | lagkage — bolo de festa |
| Rødgrød com Creme (dinamarca) | sobremesa nacional dinamarquesa |
| Torta de Limão Dinamarquesa (dinamarca) | torta doce |
| Brunsviger (dinamarca) | bolo doce de açúcar mascavo |
| Bolo Coroa (dinamarca) | bolo doce |
| Leitelho Gelado (dinamarca) | koldskål — leitura brasileira é sobremesa gelada |

### 5.3 `course:entrada` — amostra ALTA (13)

| receita (categoria) | julgamento |
|---|---|
| Guacamole (mexico) | entrada/dip por excelência |
| Salmorejo (espanha) | sopa fria servida como entrada |
| Patatas Bravas (espanha) | tapa — no Brasil, entrada/petisco |
| Tzatziki (grecia) | meze — entrada/dip |
| Dolmades (grecia) | meze — entrada fria |
| Hommus (libano) | mezze — entrada/dip |
| Babaganuche (libano) | mezze — entrada/dip |
| Tabule (libano) | mezze — salada de entrada |
| Fattoush (libano) | mezze — salada de entrada |
| Samosa (india) | salgadinho de entrada/petisco |
| Tiradito (peru) | entrada fria de pescado |
| Ovos com Maionese (ovos-classicos) | entrada fria clássica (aditivo — o principal automático fica) |
| Scotch Egg (ovos-classicos) | petisco/entrada de pub (aditivo — o principal automático fica) |

### 5.4 `course:acompanhamento` — amostra ALTA (9)

| receita (categoria) | julgamento |
|---|---|
| Salada de Batata (alemanha) | kartoffelsalat — acompanhamento clássico |
| Batatas Caramelizadas (dinamarca) | brunede kartofler — acompanhamento de mesa natalina |
| Repolho Roxo (dinamarca) | rødkål — acompanhamento fixo do porco assado |
| Salada de Pepino (dinamarca) | agurkesalat — acompanhamento |
| Beterraba em Conserva (dinamarca) | conserva de mesa — acompanhamento |
| Pepino em Conserva (dinamarca) | idem |
| Cebola em Conserva (dinamarca) | idem |
| Kimchi (coreia) | banchan — o acompanhamento coreano por definição |
| Naan (india) | pão de acompanhamento do curry |

## 6. Números fechados desta proposta

- cafe-da-manha: **20 ALTA + 11 DUVIDOSA** (5 candidatas de ovos excluídas com motivo)
- outros momentos (amostra, não exaustiva): sobremesa **17 ALTA**, entrada **13 ALTA**,
  acompanhamento **9 ALTA**
- pendência estrutural registrada: re-encaixe completo de course: nas categorias de país
  (237 receitas sem course:) como fase própria
