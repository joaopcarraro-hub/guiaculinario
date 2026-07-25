# Como rodar — passo a passo

**Resposta curta pra sua pergunta:** sim, é o mesmo exemplo da Paella — mas você **não precisa colar
prompt nenhum**. Os três prompts manuais (Paella, Tornedor Rossini, Escondidinho) já estão dentro do
script. Você roda um comando e ele monta o prompt, chama a API, salva o master e exporta o webp.

---

## Passo 0 — dois pré-requisitos (uma vez só)

**Node 18 ou mais novo.** O script usa `fetch` nativo, que não existe no Node 16.

```
node -v
```

**cwebp** (converte PNG/JPEG → WebP). É um `.exe` standalone do Google, não precisa instalar nada:

- Baixe em https://developers.google.com/speed/webp/download (pacote `libwebp-...-windows-x64.zip`)
- Descompacte e ponha a pasta `bin\` no PATH
- Confira: `cwebp -version`

Se você pular esse passo, **o script não quebra e não perde dinheiro** — ele salva os masters, avisa
que faltou o cwebp, e depois você roda `--exportar` pra gerar todos os webp de uma vez, custo zero.

> Cuidado com uma armadilha do Windows: `convert` no Windows é o `C:\Windows\System32\convert.exe`,
> utilitário de disco que não tem nada a ver com ImageMagick. O script já sabe disso e se recusa a
> usar esse binário — mas se você for instalar ImageMagick por conta própria, o comando certo no
> Windows 7+ do ImageMagick é `magick`, não `convert`.

## Passo 1 — commitar

O arquivo já está em `scripts/gerar-imagens.js`. Falta ele entrar no git — hoje está solto no working
directory, que é exatamente o cenário da nota no cabeçalho do `test-shopping-dict.js` sobre 781 testes
perdidos por não terem sido commitados.

Abra o terminal **na raiz do repo** e cole:

```
cd "C:\Users\joaop\OneDrive\Documentos\Cardapio Gastronomico"
git add .gitignore scripts/gerar-imagens.js
git commit -m "feat(imagens): script de geracao de foto das receitas (eixo A/B, 7 loucas)"
```

> **Não use `git add -A` aqui.** O working directory tem 22 arquivos modificados de outros trabalhos
> em andamento (`js/app.js`, `js/tagmodel.js`, `css/style.css`, vários `data/*.js`, os
> `scripts/audit-visual-*`). Um `add -A` empacotaria tudo isso no mesmo commit.

O `.gitignore` que entra junto tem duas linhas: ignora `imagens/master/` (são ~900 KB por foto ×398 =
~360 MB de binário, que não têm por que viver no git — o repo mora dentro do OneDrive, então já têm
backup, e o `--exportar` regera os webp a partir deles de graça) e `data/*.js.bak`.

## Passo 2 — dry run (custo ZERO, não precisa nem da chave)

Terminal **na raiz do repo**, não dentro de `scripts/`:

```
cd "C:\Users\joaop\OneDrive\Documentos\Cardapio Gastronomico"
node scripts/gerar-imagens.js
```

Isso não chama a API. Sai assim:

```
modelo: gemini-3.1-flash-image  |  4:3 1K  |  modo: dry  |  receitas: 398

distribuição das combinações (o teste de 'não são 398 fotos iguais'):
  A1 x B1    14
  A1 x B3    11
  ...
combinações distintas em uso: 28 de 30 possíveis

como o eixo A foi decidido:
  por exceção forte:             14
  por catId (confiável):        194
  por palavra no nome:          181
  caiu no default A3 (revisar):   9      <- olhe esse número

exemplo de prompt gerado (primeira receita sem prompt manual):
--- [nome] [categoria] A? x B? ---
[o prompt inteiro, pra você ler]

faltam gerar: 398 de 398
custo estimado (batch, gemini-3.1-flash-image): US$ 13.33
```

**Duas coisas pra conferir aqui, antes de gastar qualquer centavo:** o número de "caiu no default A3"
e o prompt de exemplo, que você lê inteiro pra ver se descreve a foto que você quer.

Aquelas quatro linhas são as quatro peneiras que escolhem a louça, nessa ordem:

1. **exceção forte** — uma lista curtinha que ganha até da categoria, e o critério pra entrar nela é
   estreito: só entra quando a louça da categoria *contradiz fisicamente* o prato. Crème Brûlée está
   em `sobremesas-classicas`, cuja louça é pratinho raso — mas creme não fica em pé em pratinho raso.
   Bourguignon, ossobuco, goulash e jarrete estão em categorias de carne, cuja louça é prato ou tábua —
   mas molho escorre de prato liso e some numa tábua. São só esses dois padrões, 14 receitas.
2. **catId** — a categoria decide. Vale pras 21 categorias que *são* um formato de prato (`sopas`,
   `massas`, `padaria`, `peixes`…). 194 receitas.
3. **palavra no nome/subgrupo** — vale pras outras 21, que são de país. "França" não é uma louça: o
   mesmo `data/franca.js` tem foie gras (pratinho), bœuf bourguignon (tigela funda) e crème brûlée.
   Nessas, o nome e o subgrupo são o único sinal. 181 receitas.
4. **default A3** (tigela funda) — quem não casou com nada. 9 receitas.

Se sobrar alguma sem regra, sai um bloco logo abaixo com os **nomes** de cada uma, agrupados por
categoria e subgrupo:

```
sem regra de geometria: 9 receitas em 4 baldes (catId / subgrupo)
  5  dinamarca / Acompanhamentos
     Batatas Caramelizadas | Molho de Salsinha | Remoulade Dinamarquesa | ...
```

**Cole esse bloco no chat.** As 9 de hoje já foram conferidas uma a uma e estão certas — são molhos,
conservas, repolho roxo, guacamole, picadinho: coisa de tigela mesmo, que é justamente o que o default
A3 dá. Não precisa mexer. O bloco continua existindo pras receitas novas que você adicionar depois.

## Passo 3 — a chave

PowerShell:

```
$env:GEMINI_API_KEY = "sua-chave-aqui"
```

Git Bash / WSL / Mac:

```
export GEMINI_API_KEY=sua-chave-aqui
```

Vale só pra aquela janela de terminal. Fecha, some. É de propósito — a chave nunca entra em arquivo
nem no git.

## Passo 4 — o teste da Paella (2 imagens, ~US$ 0,13)

**Este é o comando que responde a sua pergunta:**

```
node scripts/gerar-imagens.js --teste --receita=paella
```

Gera **duas** imagens da mesma receita:

| Arquivo | O que é |
|---|---|
| `paella-manual.png/jpg` | O prompt que escrevi à mão pra Paella |
| `paella-auto.png/jpg` | O que o template automático produz sozinho pra Paella |

Comparar as duas é o teste que realmente importa: se a automática ficar tão boa quanto a manual, o
template está pronto pras 398. Se a manual for muito melhor, o template ainda tem o que aprender.

Sai assim:

```
  + paella-manual [manual]  master 1420 KB .jpg -> webp 118 KB
  + paella-auto [auto]      master 1380 KB .jpg -> webp 112 KB

gerados 2  |  pulados 0  |  erros 0
custo desta rodada (normal): US$ 0.13
```

Os arquivos ficam em `imagens/master/` (full-res, fora do git) e `imagens/receitas/` (o webp que o app
serve).

Sem o `--receita=paella` o `--teste` roda as três receitas em duas versões = 6 imagens ≈ US$ 0,40.
Também vale, mas faça a Paella primeiro.

Se aparecer uma linha `~ paella-auto: HTTP 503, esperando 8s e tentando de novo`, **não é erro** — é o
script se recuperando sozinho. Ele tenta 4 vezes, esperando 8s, 20s e 45s, em 408/429/500/502/503/504.
Erro de HTTP não devolve imagem, então retentar não custa nada. Erro de conteúdo (a API responde 200 mas
sem imagem, quase sempre filtro de segurança) **não** é retentado, porque é determinístico e insistir só
queimaria tempo.

## Passo 5 — olhar o resultado, nesta ordem

1. **Sobrou parede, janela, cômodo — qualquer coisa que não seja mesa?** Se sim, para tudo e me avisa:
   é a regressão da rodada anterior e não adianta olhar o resto.
2. **A panela está inteira, sem encostar em nenhuma borda?**
3. **O teste da dobra.** Recorte os 50% de cima do webp e veja se tem comida:

   ```
   cwebp -crop 0 0 1184 444 imagens/receitas/paella-manual.webp -o teste-dobra.webp
   ```

   Se aparecer comida, resolvido. Se aparecer mesa vazia, **o ajuste é no CSS, não no prompt** — troque
   `object-position: center bottom` por `center 70%`.

4. Sombra na mesa existe? A cena está clara e **quente** (creme/mel) ou clara e **fria**
   (cinza-azulado)? As coisas do fundo da mesa são reconhecíveis ou viraram borrão?

## Passo 6 — o CSS

Em `css/style.css`:

```css
.recipe-hero img { object-fit: cover; object-position: center bottom; }
```

Ajuste olhando a tela. `bottom` = 100%; se o prato ficar baixo demais, tente `center 70%`, depois
`center 60%`.

## Passo 7 — o lote (só depois que a Paella estiver aprovada)

```
node scripts/gerar-imagens.js --gerar
```

~US$ 13 ≈ R$ 72, uma vez. Pode interromper com Ctrl+C e rodar de novo — **ele nunca regera o que já
existe**, então retomar é de graça. Se quiser rodar por partes, `--receita=` funciona aqui também.

## Passo 8 — apontar as receitas pras fotos novas

Sem este passo nada muda na tela: os `.webp` existem em `imagens/receitas/`, mas as 398 receitas
continuam com o link antigo da Wikipédia. Gerar as fotos e não apontar pra elas é gastar os US$ 13
à toa.

```
node scripts/gerar-imagens.js --aplicar                 # PRÉVIA, não escreve nada
node scripts/gerar-imagens.js --aplicar --confirmar     # escreve
```

Ele edita `data/*.js` cirurgicamente — troca ou insere **um campo** por receita, mantendo comentários,
ordem dos campos e até o estilo de aspas do arquivo. Só aponta pra receita que **já tem webp em
disco**: apontar pra arquivo inexistente seria trocar uma foto feia por um quadrado quebrado.

Três travas, nessa ordem:

1. sem `--confirmar` é só prévia;
2. salva `<arquivo>.bak` ao lado antes de escrever;
3. depois de escrever, **recarrega** os `data/*.js`. Se não parsear, ou se o número de receitas mudar,
   restaura o original na hora e sai com erro.

Se ele imprimir `nenhum campo de imagem encontrado no acervo`, confira qual nome o app realmente lê
(`image`, `img`, `foto`…). Pra forçar outro: `GUSTA_CAMPO_IMAGEM=foto node scripts/gerar-imagens.js --aplicar`.

Depois: `git diff data/`, confira, commite, apague os `.bak`.

---

## Cola dos comandos

| Comando | O que faz | Custo |
|---|---|---|
| `node scripts/gerar-imagens.js` | dry run: prompts, distribuição, estimativa | zero |
| `node scripts/gerar-imagens.js --receita=paella` | dry run de uma receita só | zero |
| `node scripts/gerar-imagens.js --teste --receita=paella` | **o teste da Paella**, manual + auto | ~US$ 0,13 |
| `node scripts/gerar-imagens.js --teste` | as 3 receitas, 2 versões cada | ~US$ 0,40 |
| `node scripts/gerar-imagens.js --gerar` | o lote inteiro que faltar | ~US$ 13 |
| `node scripts/gerar-imagens.js --exportar` | regera os webp a partir dos masters | zero |
| `node scripts/gerar-imagens.js --aplicar` | prévia da alteração em `data/*.js` | zero |
| `node scripts/gerar-imagens.js --aplicar --confirmar` | aponta as receitas pros webp | zero |

## Se der erro

- **`fetch is not defined`** → Node menor que 18.
- **`GEMINI_API_KEY não definida`** → o `$env:` do passo 3 vale só naquela janela de terminal.
- **`sem cwebp/magick`** → passo 0. Os masters foram salvos; `--exportar` depois resolve, sem gastar.
- **`ENOENT ... data`** → você rodou de dentro de `scripts/`. Rode da raiz do repo.
- **429 / 503 / quota** → o script já retenta sozinho 4 vezes. Se ainda assim estourar, espere e rode de
  novo; ele pula o que já existe, então retomar é de graça.
- **`master 2528x1696 não é 4:3 — recortado`** → é aviso, não erro, e é benigno: significa que a API
  devolveu proporção diferente e o script recortou centralizado antes de redimensionar. Se aparecer em
  **toda** imagem, o `imageConfig` não está sendo respeitado e vale me avisar — aí o lote sai mais caro
  do que a estimativa.
