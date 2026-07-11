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

### Categorias duplicadas

Verificar duplicidade entre:
- Proteínas
- Por proteína

Deve existir apenas um grupo macro: Proteínas.

### Cozinhas

Brasil deve estar dentro de Cozinhas do mundo.

Não deve existir separação redundante entre Brasil e Cozinhas do mundo na home.

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

## Saída esperada

Ao auditar, retornar:
1. Problemas encontrados
2. Arquivos afetados
3. Correção recomendada
4. Prioridade: P0, P1, P2
5. Risco de quebrar comportamento atual
