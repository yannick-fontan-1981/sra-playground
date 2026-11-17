# SS01 / Mirror Isles — provenance and limits

Production game code SS01, custom_4, slot 1, eight levels. Imported from the user-approved Sinking-Star-Lab-SS01-v5 delivery (v0.5.0). The core.ts content is unchanged: Git blob 7757ac3d2261e7f1ff8c6c5e50fcff1265695ec0, SHA-256 26493d49ddf65b20ffc5f3bc469c087e5dcfbbfbc54b8989cbc95d4a61577624. Level data is unchanged; its type-only import uses `import type` for native Node TypeScript compatibility.

Level 1 is an original introductory synthesis with two Merchants and two destinations. Levels 2–8 are adaptations of public transcriptions of Order of the Sinking Star, not claimed as original puzzles. Maps and reference witnesses came from https://github.com/joric/ootss at c4d2a30b03a0d43f7d66b40497d1aff90a40383c, script blob 3b8768a5152c34e0f572e7e66251dfadb4cb6d1d.

| SS01 | Guide puzzle | Transcription |
| --- | --- | --- |
| 2 | 2 | mirror_2 |
| 3 | 7 | mirror_7 |
| 4 | 5 | mirror_5 |
| 5 | 12 | mirror_19 |
| 6 | 11 | mirror_15 |
| 7 | 15 | mirror_20 |
| 8 | 21 | mirror_pals |

Guide: https://sinkingstarwalkthrough.com/fr/mirror-isles-solutions/ . Joric's software is distributed under the Unlicense; this does not assert any transfer of the original game's separate rights. Original game/design attribution is retained.

The grids are centered without scaling or changing distances. Palette and 3×3 sprites are specific to this adaptation. Level 8 starts with two Merchants; there is no duplication mechanic. Textual-grid fidelity and reference-route replay are tested; comparison against the original screenshots and exhaustive rule equivalence are not claimed. Pushing movable objects can produce dead ends: Undo and Reset remain available.

Reference routes are test-only files. The worker returns only the public pixels, animation frames, actions and progress metadata, never semantic maps or solutions.
