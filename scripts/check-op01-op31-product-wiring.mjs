import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

function walk(directory) {
  if (!existsSync(directory)) return [];
  const out = [];
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    const stat = statSync(path);
    if (stat.isDirectory()) out.push(...walk(path));
    else if (path.endsWith('.ts') || path.endsWith('.tsx') || path.endsWith('.js') || path.endsWith('.mjs')) out.push(path);
  }
  return out;
}

export function checkLogosProductWiring(root = process.cwd()) {
  const src = resolve(root, 'src');
  const logos = resolve(src, 'logos-engine');
  const files = walk(src).filter(path => !path.startsWith(logos + sep));
  const matches = [];

  for (const path of files) {
    const source = readFileSync(path, 'utf8');
    const lines = source.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (/from\s+['"][^'"]*logos-engine[^'"]*['"]|import\s*\(\s*['"][^'"]*logos-engine[^'"]*['"]\s*\)/.test(line)) {
        matches.push({
          path: relative(root, path).split(sep).join('/'),
          line: index + 1,
          text: line.trim(),
        });
      }
    });
  }

  return {
    connected: matches.length > 0,
    matches,
    scannedFiles: files.length,
    status: matches.length > 0 ? 'logos-product-wiring-present' : 'logos-library-only-no-product-wiring',
  };
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  console.log(JSON.stringify(checkLogosProductWiring(), null, 2));
}
