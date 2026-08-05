// scripts/lib-cache-name.js
//
// Fonte única do CACHE_NAME vigente pras suítes de scripts/. Antes, ~10 suítes hardcodavam o
// literal (ex. "cardapio-v58") e todo bump de sw.js exigia editar cada uma em cadeia — imposto
// recorrente sem valor protetivo (o literal nunca protegia nada além da própria sincronia com
// sw.js). Higiene 2026-08-05: ler o valor vigente direto do sw.js, sempre.
//
// Falha ALTO (throw) se o padrão não bater — nunca um default silencioso. Uma suíte que não
// consegue achar CACHE_NAME em sw.js está com o arquivo fora do formato esperado, e isso é bug
// digno de parar a suíte, não de seguir adiante fingindo um valor.

const fs = require("fs");
const path = require("path");

const CACHE_NAME_PATTERN = /const CACHE_NAME = "(cardapio-v\d+)";/;

function extractCacheName(swJsContent) {
  const match = CACHE_NAME_PATTERN.exec(swJsContent);
  if (!match) {
    throw new Error(
      'lib-cache-name: CACHE_NAME não encontrado em sw.js no formato esperado ' +
        '(const CACHE_NAME = "cardapio-vNN";). Suíte não pode prosseguir sem fonte única — ' +
        "verifique se sw.js foi editado fora do padrão."
    );
  }
  return match[1];
}

function getCacheName(root) {
  const swJsPath = path.join(root, "sw.js");
  const content = fs.readFileSync(swJsPath, "utf8");
  return extractCacheName(content);
}

module.exports = { getCacheName, extractCacheName, CACHE_NAME_PATTERN };
