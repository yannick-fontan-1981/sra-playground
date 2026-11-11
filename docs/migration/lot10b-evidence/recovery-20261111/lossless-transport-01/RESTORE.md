# Transport sans perte des preuves 10B

Le reçu `transport-receipt.json` conserve les chemins, tailles et SHA-256 réellement vérifiés. Ce transport a comparé les quatre flux gzip HPDL01 aux octets bruts jusqu'à EOF, vérifié les 24 parts du checkpoint comprimé et les 8 parts des deux archives gelées. Tous les originaux restent présents. Aucune campagne, comparaison fonctionnelle ou nouvelle mesure n'a été exécutée par ce transport.

Les cinq entrées positives ajoutées à `.gitignore` désignent exclusivement les objets ci-dessous, sous `docs/migration/lot10b-evidence/recovery-20261111/`.

| Objet conservé localement | Octets | Représentation restaurable |
| --- | ---: | --- |
| `hpdl-live-01/hpdl-checkpoint.json.gz` | 20 775 890 | 24 parts et `hpdl-checkpoint.json.gz.parts.json` |
| `hpdl-live-01/hpdl-checkpoint.json` | 177 532 943 | Gzip précédent, après restauration éventuelle de ses parts |
| `hpdl-live-01/hpdl-actual-public-journal.jsonl` | 4 075 597 | `hpdl-actual-public-journal.jsonl.gz`, conservé directement |
| `hpdl-freeze-01/source-archive.tar.gz` | 1 926 442 | 3 parts et `source-archive-parts.json` |
| `integrated-final-01/source-archive.tar.gz` | 3 779 332 | 5 parts et `source-archive-parts.json` |

Les 23 journaux bruts présents, dont 3 vides, ont chacun une règle négative exacte pour rester transportables malgré les règles générales sur les logs. Le fichier vide `hpdl-live-01/hpdl-checkpoint-000048.inprogress.json` reste conservé comme artefact incomplet. Ce reçu ne transforme ni cette interruption ni un diagnostic incomplet en résultat final. Les fichiers apparus après la vérification demandent leur propre conservation.

## Recette de restauration

Les commandes ci-dessous sont une recette, pas une nouvelle exécution enregistrée. Les lancer à la racine du checkout, après autorisation de calcul et sous le verrou partagé habituel. Elles vérifient les destinations existantes et refusent leur remplacement. Ne pas supprimer un original avant vérification.

### 1. Reconstituer les fichiers comprimés et les archives

Les helpers existants vérifient l'ordre, les tailles et les empreintes des parts. Le mode `restore` du freezer reconstitue seulement les octets de l'archive : il n'extrait pas le tar et ne recrée aucun gel.

```bash
flock -s /workspace/shared/sra-coordination/performance.lock python3 -B scripts/evidence-byte-parts.py restore docs/migration/lot10b-evidence/recovery-20261111/hpdl-live-01
flock -s /workspace/shared/sra-coordination/performance.lock python3 -B scripts/freeze-v53-native-source.py restore docs/migration/lot10b-evidence/recovery-20261111/hpdl-freeze-01
flock -s /workspace/shared/sra-coordination/performance.lock python3 -B scripts/freeze-v53-native-source.py restore docs/migration/lot10b-evidence/recovery-20261111/integrated-final-01
```

### 2. Restaurer les quatre bruts HPDL01 si nécessaire

Ce bloc lit uniquement le petit reçu de transport comme JSON. Il parcourt les preuves en blocs de 1 MiB, contrôle chaque gzip avant et après, vérifie les tailles et SHA-256 attendus et n'ouvre une destination absente qu'en création exclusive. Un échec interrompt la procédure ; un éventuel fichier partiel est laissé visible et ne doit pas être assimilé à un résultat validé.

```bash
flock -s /workspace/shared/sra-coordination/performance.lock python3 -B - <<'PY'
import gzip
import hashlib
import json
from pathlib import Path

root = Path.cwd().resolve()
receipt = json.loads((root / 'docs/migration/lot10b-evidence/recovery-20261111/lossless-transport-01/transport-receipt.json').read_text())
if receipt['status'] != 'passed' or len(receipt['rawGzipMappings']) != 4:
    raise ValueError('Unverified or incomplete transport receipt')

def path_for(record):
    path = root / record['path']
    path.resolve().relative_to(root)
    if path.is_symlink():
        raise ValueError('Refusing a symbolic-link destination or input')
    return path

def verify(record):
    size = 0
    digest = hashlib.sha256()
    with path_for(record).open('rb') as stream:
        while block := stream.read(1048576):
            size += len(block)
            digest.update(block)
    if size != record['bytes'] or digest.hexdigest() != record['sha256']:
        raise ValueError('Fingerprint mismatch: ' + record['path'])

for mapping in receipt['rawGzipMappings']:
    original, compressed = mapping['original'], mapping['compressed']
    verify(compressed)
    destination = path_for(original)
    if destination.exists():
        verify(original)
        print('Existing original verified:', original['path'])
        continue
    size = 0
    digest = hashlib.sha256()
    with gzip.open(path_for(compressed), 'rb') as source, destination.open('xb') as target:
        while block := source.read(1048576):
            if target.write(block) != len(block):
                raise OSError('Incomplete write')
            size += len(block)
            digest.update(block)
    if size != original['bytes'] or digest.hexdigest() != original['sha256']:
        raise ValueError('Restored-byte mismatch: ' + original['path'])
    verify(compressed)
    verify(original)
    print('Original restored and verified:', original['path'])
PY
```

Cette recette préserve `hpdl-live.log`, `hpdl-actual-public-journal.jsonl`, `hpdl-checkpoints.jsonl` et `hpdl-checkpoint.json` selon les correspondances réellement enregistrées dans `hpdl-live-01/execution-hpdl.json`, puis vérifiées dans le reçu de transport. Elle ne lit pas le contenu JSON du checkpoint et ne réinterprète aucun paquet ou verdict.
