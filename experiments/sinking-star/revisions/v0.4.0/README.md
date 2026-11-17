# SS01 v0.4.0 — changes preserved, not applied to the branch runtime

Date: 2026-11-17. This directory records the six replacement grids and the engine delta from the delivered v3 prototype. The branch's ordinary src directory is still v2: this is NOT a completed runtime integration and MUST NOT be published as v4 without applying the full source delivery.

Full tested delivery: Sinking-Star-Lab-SS01-v4.zip, supplied in the project conversation. It contains all TypeScript sources, 125 tests, the offline HTML demo, provenance, reports, and a full patch against remote base 1f16e7720a1ffbf5179c9ed96ebcbee4d19b7ad5. The full patch was applied to a clean copy of the v2 subtree and all source bytes were compared successfully. This compact GitHub change record does not replace that full archive.

core-v3-to-v4.patch requires the delivered v3 core (Git blob prefix dbcf5ea). Do not apply it directly to v2. It adds square light-gray crate previews and matching animation silhouettes; distinguishes non-reflective solid brown stones from reflective brown crates with black center; and prevents stationary stones being overwritten during reflection.

curated-levels-source.json pins Joric's six source grids and reference routes. SS01 levels 2–7 use guide puzzles 2, 7, 5, 12, 11 and 15 respectively. Preserve v3 levels 1 and 8 unchanged. Map symbols: _ -> water ~; comma -> floor dot; X -> goal g; a -> M; apostrophe -> mirror 2 (SE); backtick -> mirror 3 (SW); slash -> mirror 4 (NW); backslash -> mirror 1 (NE); ~ -> non-reflective stone c; ! -> reflective crate o. Center each map without scaling logical cells. Grid remains 20x20, each cell 3x3 pixels.

Observed validation in the full delivery: 125/125 Node tests (98 historical and 27 added), strict TypeScript build, all 8 witnesses replayed, Chromium campaign to VICTORY, Undo/Reset animation interruption, selection and mobile width. Routes have 9,27,38,85,38,82,49,31 commands. Only L1's witness is claimed shortest. No exhaustive game-rule equivalence or original-screenshot comparison is claimed. Exactly two initial merchants in L8, no duplication.

Sources: https://sinkingstarwalkthrough.com/fr/mirror-isles-solutions/ and https://github.com/joric/ootss/tree/c4d2a30b03a0d43f7d66b40497d1aff90a40383c . The Joric repository's LICENSE is Unlicense. No commercial artwork, music or third-party engine is bundled.

Canonical integration: none. Site publication: none. Existing Site/GitHub synchronization: not inspected. Next: apply the complete source delivery on a work branch, replay tests, then connect SS01 through the native Playground adapter without exposing validation solutions to the SRA.
