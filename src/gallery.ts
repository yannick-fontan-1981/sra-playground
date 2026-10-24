import './styles.css';
import './gallery.css';

/** Static native frames only: the game runtime is loaded after following a link. */
const feedback = document.querySelector<HTMLElement>('[data-gallery-feedback]');
const syncPreviews: (() => void)[] = [];

for (const card of document.querySelectorAll<HTMLElement>('[data-gallery-game]')) {
  const code = card.dataset.galleryGame;
  const count = Number(card.dataset.levelCount);
  const select = card.querySelector<HTMLSelectElement>('[data-gallery-level]');
  const launch = card.querySelector<HTMLAnchorElement>('[data-gallery-launch]');
  const frame = card.querySelector<HTMLElement>('[data-gallery-frame]');
  const image = frame?.querySelector<HTMLImageElement>('img');
  const playLabel = card.querySelector<HTMLElement>('[data-gallery-play-label]');
  if (!code || !/^[A-Z0-9]{4}$/.test(code) || !Number.isInteger(count) || count < 1
      || !select || !launch || !frame || !image || !playLabel) continue;

  const sync = (announce = false): void => {
    const requested = Number(select.value);
    const level = Number.isInteger(requested) && requested >= 1 && requested <= count ? requested : 1;
    select.value = String(level);
    frame.style.setProperty('--atlas-column', String(level - 1));
    image.alt = `${code}, level ${level} preview`;
    launch.href = `/?game=${encodeURIComponent(code)}&level=${level}#playground`;
    launch.setAttribute('aria-label', `Play ${code}, level ${level}`);
    playLabel.textContent = `Play level ${level}`;
    if (announce && feedback) feedback.textContent = `${code}, level ${level} preview. Click the preview to play.`;
  };
  sync();
  select.disabled = false;
  select.addEventListener('change', () => sync(true));
  syncPreviews.push(sync);
}

// Browser Back may restore the native dropdown value after module execution.
window.addEventListener('pageshow', () => { for (const sync of syncPreviews) sync(); });
