#!/usr/bin/env node

/**
 * Validates ES Module syntax across all static JavaScript files.
 * Catches duplicate declarations, syntax errors, and invalid imports before commit/CI.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function getJsFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getJsFiles(full));
    } else if (entry.name.endsWith('.js')) {
      results.push(full);
    }
  }
  return results;
}

const staticDir = path.join(__dirname, '..', 'static');
const jsFiles = getJsFiles(staticDir);

let failures = 0;
for (const file of jsFiles) {
  const content = fs.readFileSync(file, 'utf8');
  try {
    new vm.SourceTextModule(content, { initializeImportMeta: () => {} });
  } catch (err) {
    console.error(`\x1b[31m✖ JS Syntax Error in ${path.relative(process.cwd(), file)}: ${err.message}\x1b[0m`);
    failures++;
  }
}

if (failures > 0) {
  console.error(`\x1b[31m✖ Failed: ${failures} syntax error(s) detected in static JS modules.\x1b[0m\n`);
  process.exit(1);
}

console.log(`\x1b[32m✔ Validated ${jsFiles.length} static ES modules with 0 syntax errors.\x1b[0m`);
