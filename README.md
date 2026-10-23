# SRA Playground

An English-language playground for Yannick Fontan's custom games and the future
browser port of his **Symbolic Reasoning Agent**.

## First playable release

- **Dark appearance by default:** charcoal surfaces, light text and lime accents.
- **100-game catalogue:** all 25 official and 75 custom entries from the pinned
  upstream evaluation suite, with prominent four-character codes and explicit
  browser-port availability.
- **PIPE:** the real Python game ported to TypeScript, with all six levels.
- **Manual play:** mouse, touch and keyboard; campaign and individual practice.
- **SRA Agent:** a clearly marked upcoming mode. The genuine reasoning agent is
  not connected yet; this release does not claim to solve games with SRA.
- **Browser execution:** static HTML/CSS/JavaScript; no game-action backend,
  remote inference, CDN assets or external fonts.
- **Architecture page:** a separate `/architecture.html` page explaining the
  Python SRA components, evidence and action boundaries, the behavior-tree-loop,
  and the browser porting roadmap, with links to the pinned source.

Selecting an unported catalogue entry opens its own information panel. It does
not load PIPE under another name. PIPE is the one playable browser engine in
this version; the catalogue is not a claim that all 100 games have been ported.

### Controls

| Input | Action |
| --- | --- |
| Click or tap a pipe | Select it and rotate it clockwise |
| Arrow keys, with the board focused | Select a neighboring pipe |
| Space / the generic button below the arrows | Primary game action (rotates a pipe in PIPE) |
| R / Restart level | Restart the current level |
| Numbered level buttons | Start a practice round at that level |
| New campaign | Restart from level 1 and clear campaign progress |

Connect every cell to the blue source without leaks or loops. Completing a
campaign level advances automatically. Practice rounds remain separate from
campaign credit. Progress lives in memory and resets when the page reloads.

## Run locally

Use Node.js **22.18 or newer** (Node 24 is used for validation).

```sh
npm ci
npm run dev
```

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

The static build is written to `dist/`. Deploy that directory to a static host.
The `.openai/hosting.json` manifest identifies the existing Sites project; do not
create a second project when updating this site. The repository has no automatic
deployment workflow. Sites deployment history and GitHub commits are separate;
future releases must keep their intended source snapshots aligned.

## Faithful game port

The reference is
[`custom_games/engines/pipes.py`](https://github.com/yannick-fontan-1981/ARC-AGI-3-Yannick-Fontan/blob/212d8d426f07eea2b6797c2bb647545767488a96/custom_games/engines/pipes.py)
at commit `212d8d426f07eea2b6797c2bb647545767488a96`.
The unchanged Python file is kept under `reference/python/`; release provenance
is in `public/provenance.json`.

The parity suite covers **22 tests**, including 11 scenarios, 618 commands,
610 observations, **644 complete 64 × 64 frames**, six independent level wins,
and a full campaign. It compares game state, counters, action boundaries,
animations, transitions and frame hashes against the Python reference. Level
titles and notes are intentionally translated into English.

To regenerate the deterministic fixtures using Python 3:

```sh
python3 scripts/generate-pipe-fixtures.py
npm test
```

The constraint solver in the fixture generator is exclusively a testing tool.
Neither it nor the Python reference nor the fixture data is included in the
browser application. It is not SRA.

## Bringing the genuine SRA to the browser

`src/runtime/contracts.ts` prepares an explicit observation/action protocol for
a future Web Worker. It projects public pixels and progression, excluding hidden
engine state. No worker or TypeScript reasoning implementation is installed yet.

See [the architecture and porting plan](docs/architecture.md) for the staged
Python-to-TypeScript work, parity requirements, session cancellation, resource
budgets and cross-game regression strategy.

The original project is
[ARC-AGI-3-Yannick-Fontan](https://github.com/yannick-fontan-1981/ARC-AGI-3-Yannick-Fontan).
The catalogue contains 100 entries, with one playable game and six levels; the
remaining game ports and genuine SRA integration are future milestones.

## License

MIT, as selected for this repository. See [LICENSE](LICENSE) and
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the preserved upstream notice.

