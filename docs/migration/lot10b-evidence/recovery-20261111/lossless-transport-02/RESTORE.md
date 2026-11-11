# Restore exact retained evidence

The two HPDL02 checkpoint streams retain their actual bytes. The in-progress stream remains incomplete. No campaign or action is regenerated.

From the repository root, first restore the compressed parts:

```bash
python3 -B scripts/evidence-byte-parts.py restore docs/migration/lot10b-evidence/recovery-20261111/hpdl-live-02
python3 -B scripts/evidence-byte-parts.py restore docs/migration/lot10b-evidence/recovery-20261111/integrated-final-02
python3 -B scripts/evidence-byte-parts.py restore docs/migration/lot10b-evidence/recovery-20261111/performance-integrated-01
```

For each mapping in `transport-receipt.json`, decompress `compressed.path` to `original.path` without parsing JSON, then verify the original byte count and SHA-256. Keep any existing original only if its exact fingerprint already matches. The complete checkpoint also appears in the immutable execution receipt.

For the final02 source archive, concatenate its five ordered parts listed in `source-archive-parts.json` and verify `source-archive.json`. The passed `delivery-integrity.json` retains the actual archive and part verification.

All raw files remain available in the working checkout. Exact positive ignore entries cover only verified large byte streams; explicit negative entries retain the actual new raw logs.
