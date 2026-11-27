const slideDuration = 15_000;

export function bindDesignPremiseCarousel(carousel: HTMLElement): void {
  const track = carousel.querySelector<HTMLElement>('#design-premise-slides')!;
  const slides = Array.from(track.children) as HTMLElement[];
  const selectors = Array.from(carousel.querySelectorAll<HTMLButtonElement>('[data-premise-select]'));
  const rotation = carousel.querySelector<HTMLButtonElement>('#design-premise-rotation')!;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let activeSlide = 0;
  let rotationEnabled = !reducedMotion.matches;
  let rotationTimer: number | undefined;
  let pointerInside = carousel.matches(':hover');

  function showSlide(index: number): void {
    activeSlide = index;
    track.style.transform = `translateX(${-100 * activeSlide}%)`;
    slides.forEach((slide, slideIndex) => { slide.inert = slideIndex !== activeSlide; });
    selectors.forEach((button, slideIndex) => {
      button.setAttribute('aria-pressed', String(slideIndex === activeSlide));
    });
  }

  function scheduleRotation(): void {
    window.clearTimeout(rotationTimer);
    if (!rotationEnabled || pointerInside || document.hidden) return;
    rotationTimer = window.setTimeout(() => {
      showSlide((activeSlide + 1) % slides.length);
      scheduleRotation();
    }, slideDuration);
  }

  function setRotation(enabled: boolean): void {
    rotationEnabled = enabled;
    rotation.textContent = enabled ? 'Pause rotation' : 'Play rotation';
    track.setAttribute('aria-live', enabled ? 'off' : 'polite');
    scheduleRotation();
  }

  rotation.addEventListener('click', () => setRotation(!rotationEnabled));
  selectors.forEach((button, index) => {
    button.addEventListener('click', () => {
      setRotation(false);
      showSlide(index);
    });
  });
  carousel.addEventListener('pointerenter', () => {
    pointerInside = true;
    scheduleRotation();
  });
  carousel.addEventListener('pointerleave', () => {
    pointerInside = false;
    scheduleRotation();
  });
  carousel.addEventListener('focusin', (event) => {
    if (event.target !== rotation) setRotation(false);
  });
  reducedMotion.addEventListener('change', ({ matches }) => {
    if (matches) setRotation(false);
  });
  document.addEventListener('visibilitychange', scheduleRotation);
  setRotation(rotationEnabled);
}
