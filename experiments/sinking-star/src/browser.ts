import { SinkingStarSession } from './core.js';
import { SS01_LEVELS } from './levels.js';
const session = new SinkingStarSession(SS01_LEVELS);
const canvas = document.querySelector<HTMLCanvasElement>('#board')!;
const context = canvas.getContext('2d')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const select = document.querySelector<HTMLSelectElement>('#level')!;
for (const [i, level] of SS01_LEVELS.entries()) {
  const option = document.createElement('option');
  option.value = String(i + 1); option.textContent = `${i + 1} — ${level.title}`;
  select.append(option);
}
function paint(): void {
  const observation = session.observe();
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    context.fillStyle = observation.palette[observation.frame[y]![x]!]!;
    context.fillRect(x, y, 1, 1);
  }
  select.value = String(observation.level);
  status.textContent = observation.state === 'WIN' ? 'VICTORY — 3 niveaux pilotes terminés'
    : `Niveau ${observation.level} / ${observation.levelCount} · ${observation.levelsCompleted} terminé(s)`;
  document.querySelector<HTMLButtonElement>('#undo')!.disabled = !observation.canUndo;
}
function act(id: number): void { session.action(id); paint(); }
document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button => {
  button.addEventListener('click', () => act(Number(button.dataset.action)));
});
document.querySelector('#undo')!.addEventListener('click', () => { session.undo(); paint(); });
document.querySelector('#reset')!.addEventListener('click', () => { session.reset(); paint(); });
document.querySelector('#restart')!.addEventListener('click', () => { session.restart(); paint(); });
select.addEventListener('change', () => { session.selectLevel(Number(select.value)); paint(); });
document.addEventListener('keydown', event => {
  if (event.target instanceof HTMLSelectElement || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
  const map: Record<string, number> = { ArrowUp: 1, ArrowDown: 2, ArrowLeft: 3, ArrowRight: 4, ' ': 5 };
  const id = map[event.key];
  if (id) { event.preventDefault(); act(id); }
  else if (event.key.toLowerCase() === 'z') { event.preventDefault(); session.undo(); paint(); }
});
paint();
