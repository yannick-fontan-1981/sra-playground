# Third-party components

The Playground interface and integration code are covered by this repository's
MIT license. Bundled components retain their own licenses and notices.

## Game sources

- The 75 custom engines and their authored level data are copied from Yannick
  Fontan's ARC-AGI-3 repository at commit
  `212d8d426f07eea2b6797c2bb647545767488a96`. The bundle includes source provenance
  and the upstream license. The engine source is not translated or replaced by
  recordings; it executes locally through WebAssembly.
- The 25 official games retain the complete MIT copyright and license headers
  supplied by ARC Prize Foundation in 2026. Their exact version identifiers,
  source URLs, and hashes are recorded in the official bundle manifest.
- ARCEngine 0.9.3 is bundled from commit
  `b495c6acaf253c9681cd7b75c4299d352e9ce6f8` of
  [arcprize/ARCEngine](https://github.com/arcprize/ARCEngine). Its original MIT
  license is included with the bundled package.

## Browser Python runtime

The site self-hosts the unmodified runtime distribution of
[Pyodide 314.0.7](https://github.com/pyodide/pyodide/tree/314.0.7), including
CPython 3.14.2. Pyodide is distributed under the Mozilla Public License 2.0;
a copy is served at `public/licenses/pyodide-MPL-2.0.txt`. The matching source
is available from that pinned upstream repository.

The exact distribution files and integrity hashes are pinned in
`scripts/python-runtime-assets.json`. The build copies/downloads them into the
site's static assets; visitors load the runtime from the same site as the games.

NumPy, Pydantic, pydantic-core, typing-extensions, annotated-types, and
typing-inspection are supplied as unmodified wheels from that Pyodide
distribution. Their copyright and license files remain inside the original
wheel archives. CPython and the runtime's bundled libraries retain their own
original notices.

## Original PIPE reference attribution

PIPE is ported from Yannick Fontan's custom game at
`custom_games/engines/pipes.py` in the repository
https://github.com/yannick-fontan-1981/ARC-AGI-3-Yannick-Fontan,
commit `212d8d426f07eea2b6797c2bb647545767488a96`.

`reference/python/pipes.py` preserves that source for reproducible parity tests.
The upstream repository carries the following license notice, reproduced without
claiming that its named copyright holder authored this particular custom game.

```text
MIT License

Copyright (c) 2025 ARC Prize

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

The new playground code is covered by this repository's MIT `LICENSE`.
Development packages retain their own licenses in the installed packages.

## Yanik_AI videos and thumbnails

The video section presents Yannick Fontan's six public
[Yanik_AI episodes](https://www.youtube.com/@Yanik_AI/videos), verified on
24 October 2026. Original, unchanged episode thumbnails are stored under
`public/videos/`; their source URLs are recorded in `content/videos.json`.
Episode notes are original short summaries of the author's published
descriptions. The full videos remain hosted on YouTube and are embedded only
after the visitor selects Play. The code license does not relicense those videos
or their original media.
