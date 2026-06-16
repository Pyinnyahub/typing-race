#!/usr/bin/env node
// Validates the embedded lesson curriculum in index.html.
// Pure Node, zero dependencies. Exits non-zero (with a report) on any problem,
// so CI blocks a broken curriculum from reaching the live site.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML = resolve(__dirname, "..", "index.html");

const LANGS = ["python", "sql", "bash", "typescript", "javascript"];
const LEVELS = ["beginner", "intermediate", "advanced"];
const MIN = { beginner: 12, intermediate: 10, advanced: 8 };
const MAX_LINE = 90;
const MAX_TITLE = 40;

const errors = [];
const err = (m) => errors.push(m);

const html = readFileSync(HTML, "utf8");
const m = html.match(
  /<script type="application\/json" id="curriculumData">([\s\S]*?)<\/script>/
);
if (!m) {
  err('Could not find <script id="curriculumData"> block.');
  finish();
}

let data;
try {
  data = JSON.parse(m[1]);
} catch (e) {
  err("curriculumData is not valid JSON: " + e.message);
  finish();
}

const ENTITY = /&(amp|lt|gt|quot|#39|#x27);/;
let total = 0;

for (const lang of LANGS) {
  if (!data[lang]) { err(`missing language: ${lang}`); continue; }
  for (const level of LEVELS) {
    const arr = data[lang][level];
    if (!Array.isArray(arr)) { err(`${lang}.${level} is not an array`); continue; }
    if (arr.length < MIN[level]) err(`${lang}.${level} has only ${arr.length} lessons (min ${MIN[level]})`);
    const titles = new Set();
    arr.forEach((les, i) => {
      total++;
      const at = `${lang}.${level}[${i}]`;
      for (const f of ["title", "code", "explain"]) {
        if (typeof les[f] !== "string" || les[f].trim() === "") err(`${at} field "${f}" missing or empty`);
      }
      if (typeof les.title === "string") {
        if (les.title.length > MAX_TITLE) err(`${at} title too long (${les.title.length} > ${MAX_TITLE}): ${les.title}`);
        const key = les.title.toLowerCase();
        if (titles.has(key)) err(`${at} duplicate title within level: ${les.title}`);
        titles.add(key);
      }
      if (typeof les.code === "string") {
        const code = les.code;
        if (code.includes("```")) err(`${at} code contains a markdown fence`);
        if (code !== code.trim()) err(`${at} code has leading/trailing whitespace/blank lines`);
        if (ENTITY.test(code)) err(`${at} code contains an unescaped HTML entity (should be a raw character)`);
        code.split("\n").forEach((ln, j) => {
          if (ln.length > MAX_LINE) err(`${at} code line ${j + 1} too long (${ln.length} > ${MAX_LINE})`);
        });
      }
      if (typeof les.explain === "string") {
        if (ENTITY.test(les.explain)) err(`${at} explain contains an unescaped HTML entity`);
        if (les.explain.length > 160) err(`${at} explain too long (${les.explain.length} > 160)`);
      }
    });
  }
}

// the embedded JSON must not contain a raw </script> (would break the inline block)
if (m[1].includes("</script")) err("curriculumData contains a raw </script> sequence (must be escaped as <\\/script)");

finish();

function finish() {
  if (errors.length) {
    console.error(`✗ curriculum validation FAILED (${errors.length} issue${errors.length > 1 ? "s" : ""}):\n`);
    for (const e of errors) console.error("  - " + e);
    process.exit(1);
  }
  console.log(`✓ curriculum OK — ${total} lessons across ${LANGS.length} languages × ${LEVELS.length} levels.`);
}
