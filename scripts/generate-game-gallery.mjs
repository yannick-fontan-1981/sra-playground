/** Build the gallery from the catalogue and real, pre-rendered level frames. */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { GAME_CATALOG, SOURCE_COMMIT } from '../src/games/catalog.ts';
import { renderSiteHeader } from '../src/site-header.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(resolve(root, 'content/game-gallery-assets.json'), 'utf8'));
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);
const arrow = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';
const external = '<svg class="icon small-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg>';
const groupDefinitions = [
  { id: 'custom', anchor: 'custom-wave-1', title: 'Custom · Wave 1', shortTitle: 'Wave 1' },
  { id: 'custom_2', anchor: 'custom-wave-2', title: 'Custom · Wave 2', shortTitle: 'Wave 2' },
  { id: 'custom_3', anchor: 'custom-wave-3', title: 'Custom · Wave 3', shortTitle: 'Wave 3' },
  { id: 'official', anchor: 'official-games', title: 'Official ARC-AGI-3 games', shortTitle: 'Official' },
];

if (manifest.tileSize !== 64 || manifest.sourceCommit !== SOURCE_COMMIT) {
  throw new Error('Gallery assets must match the catalogue source and native 64×64 frames.');
}
if (!Array.isArray(manifest.groups) || manifest.groups.length !== 4 || GAME_CATALOG.length !== 100) {
  throw new Error('The gallery requires all four groups and all 100 games.');
}
const codes = new Set();
const groups = [];
for (const definition of groupDefinitions) {
  const asset = manifest.groups.find(group => group.id === definition.id);
  const games = GAME_CATALOG.filter(game => game.group === definition.id)
    .sort((a, b) => a.code.localeCompare(b.code, 'en'));
  if (!asset || games.length !== 25 || asset.rows !== 25 || asset.games?.length !== 25
      || !Number.isInteger(asset.columns) || asset.columns < 1 || asset.columns > 64
      || asset.width !== asset.columns * 64 || asset.height !== asset.rows * 64
      || !/^\/gallery\/[a-z0-9_-]+\.png$/.test(asset.image)
      || !/^[a-f0-9]{64}$/.test(asset.sha256)) {
    throw new Error(`Invalid gallery atlas: ${definition.id}`);
  }
  const bytes = await readFile(resolve(root, 'public', asset.image.slice(1)));
  if (createHash('sha256').update(bytes).digest('hex') !== asset.sha256) {
    throw new Error(`Gallery image integrity mismatch: ${asset.image}`);
  }
  const entries = games.map((game, row) => {
    const entry = asset.games[row];
    if (!/^[A-Z0-9]{4}$/.test(game.code) || codes.has(game.code) || !entry
        || entry.code !== game.code || entry.row !== row
        || !Number.isInteger(game.levels) || game.levels < 1
        || entry.levelCount !== game.levels || entry.levelCount > asset.columns
        || entry.levels?.length !== game.levels) {
      throw new Error(`Invalid gallery game metadata: ${game.code}`);
    }
    for (const [index, level] of entry.levels.entries()) {
      if (level.level !== index + 1 || level.column !== index || !/^[a-f0-9]{64}$/.test(level.frameSha256)) {
        throw new Error(`Invalid gallery level metadata: ${game.code} / ${index + 1}`);
      }
    }
    codes.add(game.code);
    return { ...game, ...entry };
  });
  groups.push({ ...definition, ...asset, entries });
}
if (codes.size !== GAME_CATALOG.length) throw new Error('The gallery has missing or duplicated games.');
const levelCount = groups.reduce((total, group) => total + group.entries.reduce((sum, game) => sum + game.levelCount, 0), 0);
const launchUrl = (code, level = 1) => `/?game=${encodeURIComponent(code)}&level=${level}#playground`;

function card(game, group) {
  const image = `${group.image}?v=${group.sha256.slice(0, 12)}`;
  return `
        <article class="gallery-card" id="game-${game.code}" data-gallery-game="${game.code}" data-level-count="${game.levelCount}">
          <div class="gallery-card-heading"><h3>${game.code}</h3><span>${game.levelCount} levels</span></div>
          <a class="gallery-launch" href="${escape(launchUrl(game.code))}" aria-label="Play ${game.code}, level 1" data-gallery-launch>
            <span class="gallery-frame" style="--atlas-columns:${group.columns};--atlas-rows:${group.rows};--atlas-row:${game.row};--atlas-column:0" data-gallery-frame>
              <img src="${escape(image)}" alt="${game.code}, level 1 preview" width="${group.width}" height="${group.height}" loading="lazy" decoding="async" />
            </span>
            <span class="gallery-play-line"><span data-gallery-play-label>Play level 1</span>${arrow}</span>
          </a>
          <p class="gallery-card-name" title="${escape(game.name)}">${escape(game.name)}</p>
          <div class="gallery-level-control">
            <label for="preview-${game.code}">Level</label>
            <select id="preview-${game.code}" aria-label="Preview level for ${game.code}" data-gallery-level disabled>${Array.from({length: game.levelCount}, (_, index) => `<option value="${index + 1}">Level ${index + 1}</option>`).join('')}</select>
          </div>
        </article>`;
}

const page = `<!doctype html>
<!-- Generated by scripts/generate-game-gallery.mjs from the catalogue and native level previews. -->
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#0e0c0c" />
    <meta name="color-scheme" content="dark" />
    <meta name="description" content="Browse 75 new custom games created or compiled by Yannick Fontan, followed by 25 official ARC-AGI-3 games. Preview a level and click to play it in your browser." />
    <title>75 New Games · SRA Playground</title>
    <link rel="canonical" href="https://sra-playground.yannick-fontan.chatgpt.site/gallery.html" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  </head>
  <body class="gallery-page">
    <a class="skip-link" href="#gallery">Skip to the games</a>
    ${renderSiteHeader('gallery')}
    <main class="gallery-main wrap" id="gallery">
      <header class="gallery-intro">
        <div class="gallery-title-row"><div><p class="eyebrow">ARC AGI 3 / CUSTOM &amp; OFFICIAL</p><h1>75 New Games</h1></div><span class="gallery-total">100 games<span>/</span>${levelCount} levels</span></div>
        <p class="gallery-credit"><strong>75 new custom games</strong><span>created or compiled by <span>Yannick Fontan.</span></span></p>
        <p class="gallery-guide">Choose a level, then click its preview to play. The 25 official games follow the custom collection.</p>
      </header>
      <nav class="gallery-index" aria-label="Game collections">${groups.map(group => `<a href="#${group.anchor}"><span>${escape(group.shortTitle)}</span><span class="gallery-group-count">25</span></a>`).join('')}</nav>
      <p class="sr-only" data-gallery-feedback role="status" aria-live="polite"></p>
      ${groups.map(group => `
      <section class="gallery-section" id="${group.anchor}" aria-labelledby="${group.anchor}-title">
        <header class="gallery-section-heading"><h2 id="${group.anchor}-title">${escape(group.title)}</h2><span>25 games</span></header>
        <div class="gallery-grid">${group.entries.map(game => card(game, group)).join('')}
        </div>
      </section>`).join('')}
    </main>
    <footer class="site-footer wrap"><span><strong>SRA Playground</strong><span class="footer-separator">/</span>Yannick Fontan</span><div><a href="/#playground">Playground ${arrow}</a><a href="https://github.com/yannick-fontan-1981/sra-playground/blob/main/THIRD_PARTY_NOTICES.md" target="_blank" rel="noopener noreferrer">Licenses &amp; notices ${external}</a></div></footer>
    <script type="module" src="/src/gallery.ts"></script>
  </body>
</html>
`;

await writeFile(resolve(root, 'gallery.html'), page);
console.log(`Generated the game gallery: ${codes.size} games, ${levelCount} level previews, four native image atlases.`);
