import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const files = ['dist/core.js', 'dist/levels.js', 'dist/browser.js'];
// A deliberately narrow bundler for these three import-free-after-linking modules.
// Tests exercise the ESM modules, and browser checks exercise this exact HTML.
const modules = await Promise.all(files.map(async file => {
  const source = await readFile(new URL(file, root), 'utf8');
  return source.replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
}));
const template = await readFile(new URL('index.html', root), 'utf8');
const script = modules.join('\n').replace(/<\/script/gi, '<\\/script');
await writeFile(new URL('dist/ss01-demo.html', root), template.replace('<!-- BUNDLE -->', `<script type="module">\n${script}\n</script>`));
