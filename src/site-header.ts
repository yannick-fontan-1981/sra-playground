const sourceUrl = 'https://github.com/yannick-fontan-1981/sra-playground';

/** SRA is the project identity; ARC-AGI-3 is its interactive research setting. */
export function renderSiteHeader(active: 'playground' | 'gallery' | 'arc-agi-3' | 'symbolic-reasoning' | 'architecture' | 'videos'): string {
  return `
    <header class="site-header wrap">
      <a class="brand" href="/" aria-label="SRA Playground — Symbolic Reasoning Agent home">
        <svg class="brand-symbol" viewBox="0 0 36 36" shape-rendering="crispEdges" aria-hidden="true">
          <rect x="0" y="0" width="10" height="10" class="brand-green"/>
          <rect x="13" y="0" width="10" height="10" class="brand-green"/>
          <rect x="26" y="0" width="10" height="10" class="brand-green"/>
          <rect x="0" y="13" width="10" height="10" class="brand-green"/>
          <rect x="13" y="13" width="10" height="10" class="brand-yellow"/>
          <rect x="26" y="13" width="10" height="10" class="brand-blue"/>
          <rect x="0" y="26" width="10" height="10" class="brand-blue"/>
          <rect x="13" y="26" width="10" height="10" class="brand-blue"/>
          <rect x="26" y="26" width="10" height="10" class="brand-yellow"/>
        </svg>
        <span class="brand-type"><span class="brand-title">SRA Playground</span><span class="brand-project">SYMBOLIC REASONING AGENT</span></span>
        <span class="brand-context">ARC AGI <span>3</span></span>
      </a>
      <nav aria-label="Main navigation">
        <a${active === 'playground' ? ' class="nav-active" aria-current="page"' : ''} href="${active === 'playground' ? '#playground' : '/'}">Playground</a>
        <a${active === 'gallery' ? ' class="nav-active" aria-current="page"' : ''} href="/gallery.html">75 New Games</a>
        <a${active === 'arc-agi-3' ? ' class="nav-active" aria-current="page"' : ''} href="/arc-agi-3.html" aria-label="What is ARC-AGI-3?">ARC-AGI-3</a>
        <a${active === 'symbolic-reasoning' ? ' class="nav-active" aria-current="page"' : ''} href="/symbolic-reasoning.html">Symbolic Reasoning</a>
        <a${active === 'architecture' ? ' class="nav-active" aria-current="page"' : ''} href="/architecture.html">Architecture</a>
        <a${active === 'videos' ? ' class="nav-active" aria-current="page"' : ''} href="/videos.html">Videos</a>
        <a class="source-link" href="${sourceUrl}" target="_blank" rel="noopener noreferrer" aria-label="SRA Playground source code on GitHub"><span>GitHub</span><svg class="icon small-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg></a>
      </nav>
    </header>
  `;
}
