# SS01 — first game of Custom 4

Source: standalone laboratory v0.5.0. The production router uses the v5 engine and levels; no solver or reference route is exposed to the agent. The 100 existing games retain the Python bridge. Only SS01 lazy-loads the native TypeScript backend.

## UI
Custom 4 starts with SS01, eight levels. Two Merchants/two goals in L1 and L8, 3x3 cells, grey square crate previews and 210ms teleport animations are unchanged. Manual C/button selection routes to the same ACTION6 as clicking. Undo, reset, restart, direct level links and the gallery use the shared session.

## Release gate
Tests and build must pass on this integration branch before merging. No Site publication is performed by this workflow. Publication of the existing SRA Playground Site and GitHub/Site SHA verification remain required. No SRA solving score or global performance claim is made.

V5 core SHA-256: 26493d49ddf65b20ffc5f3bc469c087e5dcfbbfbc54b8989cbc95d4a61577624
