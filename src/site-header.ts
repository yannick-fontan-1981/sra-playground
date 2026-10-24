const sourceUrl = 'https://github.com/yannick-fontan-1981/sra-playground';

/** SRA is the project identity; ARC-AGI-3 is its interactive research setting. */
export function renderSiteHeader(active: 'playground' | 'gallery' | 'arc-agi-3' | 'architecture' | 'videos'): string {
  return `
    <header class="site-header wrap">
      <a class="brand" href="/" aria-label="SRA Playground — Symbolic Reasoning Agent home">
        <svg class="brand-symbol" viewBox="0 0 36 36" aria-hidden="true">
          <path d="M0 0h10v10H0zm13 0h10v10H13zM0 13h10v10H0zm0 13h10v10H0zm13 0h10v10H13z" fill="currentColor"/>
          <path d="M26 0h10v10H26zm0 13h10v10H26z" class="brand-blue"/>
          <path d="M13 13h10v10H13zm13 13h10v10H26z" class="brand-yellow"/>
        </svg>
        <span class="brand-type"><span class="brand-title">SRA Playground</span><span class="brand-project">SYMBOLIC REASONING AGENT</span></span>
        <span class="brand-context">ARC AGI <span>3</span></span>
      </a>
      <nav aria-label="Main navigation">
        <a${active === 'playground' ? ' class="nav-active" aria-current="page"' : ''} href="${active === 'playground' ? '#playground' : '/'}">Playground</a>
        <a${active === 'gallery' ? ' class="nav-active" aria-current="page"' : ''} href="/gallery.html">Gallery</a>
        <a${active === 'arc-agi-3' ? ' class="nav-active" aria-current="page"' : ''} href="/arc-agi-3.html" aria-label="What is ARC-AGI-3?">ARC-AGI-3</a>
        <a${active === 'architecture' ? ' class="nav-active" aria-current="page"' : ''} href="/architecture.html">Architecture</a>
        <a${active === 'videos' ? ' class="nav-active" aria-current="page"' : ''} href="/videos.html">Videos</a>
        <a class="source-link" href="${sourceUrl}" target="_blank" rel="noopener noreferrer" aria-label="SRA Playground source code on GitHub"><span>GitHub</span><svg class="icon small-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg></a>
      </nav>
    </header>
  `;
}
