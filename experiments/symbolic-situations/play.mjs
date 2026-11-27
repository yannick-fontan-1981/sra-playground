import { play } from './play-session.mjs';
import { parseCard } from './cards.mjs';
import { completions, initialState, step } from './enumerate.mjs';

await play({ parseCard, completions, initialState, step });
