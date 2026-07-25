## Formato de report ao final de uma tarefa

Ao concluir qualquer tarefa que envolva múltiplos itens, verificações ou correções, feche a
resposta com um bloco de código (três crases, texto simples, sem NENHUMA sintaxe markdown
dentro — sem **negrito**, sem [links](url), sem `código inline`, sem headers), contendo SÓ o
resultado final de cada item, numerado, em texto puro (sem narração do processo, sem "agora
vou verificar X" nem raciocínio intermediário). O bloco precisa poder ser selecionado e
copiado como texto plano para outra conversa, sem nenhum símbolo de formatação sobrando.

## Hábitos de verificação
- Ao testar uma correção, sempre inclua pelo menos 1 teste NEGATIVO (confirmar que algo que
  NÃO deveria acontecer, de fato não acontece) — não só o caso positivo.
- Ao reportar resultado de teste, inclua números/exemplos concretos, nunca só "funcionou".
- Se uma mudança afeta o comportamento descrito em algum .claude/skills/*.md, atualize a
  skill no MESMO commit — nunca deixe pra depois.
- Screenshot: máximo 2 tentativas por tarefa. Se falhar nas 2, pare, documente a limitação
  como tal, e prossiga com verificação por DOM/estado real — nunca insista além disso.
- Suíte de teste escrita durante uma tarefa deve ser commitada como arquivo versionado em
  scripts/, nunca rodada só como script avulso — teste que não fica no repositório não
  protege ninguém depois.
- Teste em scripts/ nunca depende de ref MUTÁVEL do git (HEAD) — usa SHA fixo ou, de
  preferência, valores literais. Comparação por SHA fixo QUEBRA se o histórico for reescrito
  (squash/rebase): antes de qualquer reescrita de histórico, converter essas comparações pra
  literais.
- Todo push que altera qualquer arquivo do APP_SHELL (css/style.css, js/app.js, index.html)
  DEVE incluir bump do CACHE_NAME no sw.js, no mesmo push. Checar isso é parte do relatório
  de qualquer fase.

## Foto de receita

O acervo tem foto **própria e gerada**, uma por receita, em `imagens/receitas/<slug>.webp`.
Nunca busque foto na web para uma receita, e nunca acrescente campo de imagem em `data/*.js`:
o caminho é derivado do `name`, e guardá-lo criaria uma segunda fonte da verdade.
Contrato completo em `docs/CONTRATO-IMAGENS-REDESIGN.md`; como operar em `docs/COMO-RODAR-IMAGENS.md`.

- **Receita nova não tem foto até alguém rodar um comando.** Depois de adicionar em `data/*.js`:

  ```
  node scripts/gerar-imagens.js --receita="Nome Exato"          # dry run, custo zero
  node scripts/gerar-imagens.js --gerar --receita="Nome Exato"  # gera, ~R$ 0,34
  ```

- **Ler o dry run antes de gerar não é opcional.** Ele imprime o ARQUÉTIPO e a LOUÇA escolhidos, e
  os dois erram em silêncio. Arquétipo `prato` monta mesa posta com talher e taça — errado para
  molho, preparação ou técnica. Louça sem regra cai no default (tigela funda).
- **Renomear receita órfã a foto.** O nome do arquivo sai do `name`. Renomeou, gere de novo — senão
  o app cai no fallback da Wikipédia sem erro nenhum no console.
- **Não use a skill `ai-image-generator` para foto de receita.** Ela é genérica e não conhece os
  arquétipos, o contrato de slug nem as decisões de enquadramento deste projeto. Para receita, o
  caminho é sempre `scripts/gerar-imagens.js`.
- **Custa dinheiro real.** Toda geração é chamada de API paga. Sem `--gerar` nada é cobrado; o dry
  run é o default de propósito.

## Sessões paralelas e git
- PROIBIDO `git add -A`, `git add .` ou qualquer commit de escopo aberto. Todo commit usa
  pathspec explícito dos arquivos da PRÓPRIA sessão.
- Scripts/sessões automatizadas (ex. pipeline de imagens) commitam somente seus próprios
  caminhos declarados. Antes de commitar, `git status` e conferir que NENHUM arquivo listado
  pertence a outra frente de trabalho em andamento.
- Se outra sessão tem trabalho não commitado nos mesmos arquivos: não commitar — sincronizar
  primeiro. Commit acidental de trabalho alheio: não reverter por conta própria; reportar.
- Mensagem de commit descreve TUDO que o commit contém, não só a intenção da sessão.
