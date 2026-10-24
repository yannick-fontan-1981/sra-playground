import './styles.css';
import './reading.css';

// Preserve useful links to sections of the earlier single architecture page.
const legacySections: Record<string, string> = {
  intent: '/architecture.html',
  thesis: '/architecture.html',
  cortex: '/architecture.html#the-artificial-cortex-idea',
  abstraction: '/architecture/representations.html#the-abstraction-analogy',
  meaning: '/architecture/representations.html#roles-mechanisms-and-spaces',
  example: '/architecture/reasoning.html#example-returning-from-a-probe',
  'reasoning-loop': '/architecture/reasoning.html#the-behavior-tree-loop',
  system: '/architecture/implementation.html#the-python-v5-source',
  evidence: '/architecture/memory.html#evidence-of-transfer',
  browser: '/architecture/implementation.html#what-runs-in-the-playground',
  'ethical-principles-and-inspectable-reasoning': '/architecture.html#design-rooted-in-human-intelligence',
};
if (window.location.pathname === '/architecture.html') {
  const redirectLegacySection = () => {
    const target = legacySections[window.location.hash.slice(1)];
    if (target) window.location.replace(target);
  };
  redirectLegacySection();
  window.addEventListener('hashchange', redirectLegacySection);
}

for (const container of document.querySelectorAll<HTMLDivElement>('.video-player')) {
  const button = container.querySelector<HTMLButtonElement>('.video-launch');
  button?.addEventListener('click', () => {
    const id = container.dataset.videoId;
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return;
    const frame = document.createElement('iframe');
    frame.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
    frame.title = container.dataset.videoTitle ?? 'SRA video';
    frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    container.replaceChildren(frame);
    frame.focus();
  }, { once:true });
}
