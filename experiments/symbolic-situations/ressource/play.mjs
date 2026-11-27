import { play } from '../play-session.mjs';
import { parseCard } from './cards.mjs';
import { worlds as completions, initialState, step } from './world.mjs';

await play({ parseCard, completions, initialState, step });
