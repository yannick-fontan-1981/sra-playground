# Release 0.1 validation

Validated on 23 October 2026 with Node 24.19.0, TypeScript 5.9.3 and Vite 8.0.13.

## Automated checks

- Strict TypeScript type checking passes.
- The production build passes and emits static assets only.
- All 22 parity and invariant tests pass: 11 scenarios, 618 commands, 610
  observations and 644 full-frame hashes checked against the pinned Python
  reference, plus six network-analysis cases.
- Both six isolated level wins and an entire six-level campaign are exercised.
- Python references, test witnesses and test fixtures are absent from the
  production asset directory.

## Browser checks

The managed preview was opened in Chrome. The rendered page, keyboard rotation,
arrow-key selection, explicit SRA-pending panel, return to manual mode, practice
level 6, new-campaign reset and R restart were checked through the visible UI.
The SRA panel disables game controls and says that the agent is not connected.

The layout contains responsive rules and touch controls. A separate mobile-device
session and touch hardware were not tested. The canvas is keyboard-operable but
does not provide a complete nonvisual puzzle representation.

![First playable release](sra-playground-first-release-20261023.jpg)

## Scope

This validates the PIPE port and the first website interface. It does not
validate SRA behavior, Python-to-TypeScript reasoning parity, any solve-rate
claim for SRA, persistent progress, submissions, or offline cold loading.
