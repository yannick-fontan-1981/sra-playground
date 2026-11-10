# Conservation exacte des preuves intégrées 10A

Le transport a été réalisé après la libération explicite du calcul par 7B,
le 10 novembre 2026 à 23:41:51 UTC, sous verrou partagé non bloquant.
Il conserve les sorties existantes du gel natif 0.56.0,
digest `be11e761de3c0f3c7d50d10da47be9e0d7b4fc9c5b7d5002cc9272ffce85645a`.

## Rapports des sept rejeux

Le helper inchangé `scripts/evidence-byte-parts.py` a exécuté `pack` sur ce
répertoire. Son véritable stdout est conservé, sans réécriture, dans
[evidence-byte-transport.json](evidence-byte-transport.json), créé exclusivement.
Les sept rapports gzip représentent **51 197 701 octets**, conservés en
**61 parties de 900 000 octets maximum**. Chaque manifeste `.parts.json`
décrit l'ordre, la taille et l'empreinte SHA-256 des parties et de l'original.
Le helper a vérifié la reconstruction avant d'ajouter les sept exclusions
exactes à `.gitignore`. Tous les originaux restent présents localement.

Depuis la racine du checkout, lorsque le calcul est autorisé par la coordination :

```bash
flock -s -n /workspace/shared/sra-coordination/performance.lock python -B scripts/evidence-byte-parts.py verify docs/migration/lot10a-evidence/integrated-final
```

Pour restaurer les originaux absents depuis leurs parties :

```bash
flock -s -n /workspace/shared/sra-coordination/performance.lock python -B scripts/evidence-byte-parts.py restore docs/migration/lot10a-evidence/integrated-final
```

Le helper crée exclusivement les originaux manquants et vérifie les fichiers
déjà présents ; il refuse les octets incompatibles. Ces commandes ne doivent pas
rediriger leur sortie vers le reçu `evidence-byte-transport.json` déjà conservé.
L'archive de source garde son propre manifeste et son mécanisme de restauration.

## Journal du driver et sept journaux de cas

Le [reçu de transport des journaux](regression-log-transport.json) vérifie les
huit paires raw/gzip à partir de `regression-launch.json` et des sept reçus
`regressions/*-execution.json`. Pour chaque paire, tailles et SHA-256 concordent
avec le reçu initial, et la décompression rend exactement les octets du raw,
y compris les espaces et fins de ligne. Les reçus d'exécution restent inchangés.
Les huit chemins raw ont des exclusions Git exactes ; les gzip restent à conserver.

Le reçu relie aussi les sept identités de rapports produites par le helper aux
empreintes du résumé d'exécution. Il n'altère aucun résultat de comparaison.
Les six journaux de validation conservent leur preuve distincte dans
[validation/log-transport.json](validation/log-transport.json).

Pour vérifier ou restaurer les huit raws de régression depuis leurs gzip,
exécuter ce bloc depuis la racine du checkout, hors fenêtre de coût concurrente.
Il vérifie toutes les entrées avant toute restauration, refuse un fichier existant
différent et crée exclusivement les fichiers manquants.

```bash
flock -s -n /workspace/shared/sra-coordination/performance.lock python -B - <<'PY'
import gzip
import hashlib
import json
from pathlib import Path

root = Path.cwd().resolve()
base = root / 'docs/migration/lot10a-evidence/integrated-final'
receipt = json.loads((base / 'regression-log-transport.json').read_bytes())
if receipt['schema'] != 'logos-engine.lossless-regression-log-transport.v1':
    raise ValueError('Unexpected transport receipt')
if receipt['status'] != 'passed' or len(receipt['checks']) != 8:
    raise ValueError('Incomplete transport receipt')

def confined(name):
    relative = Path(name)
    if relative.is_absolute() or '..' in relative.parts:
        raise ValueError('Unsafe retained path')
    path = root / relative
    path.relative_to(base)
    for part in (path, *path.parents):
        if part.is_symlink():
            raise ValueError('Symlink evidence is not accepted')
        if part == root:
            break
    path.resolve().relative_to(base)
    return path

def check(data, expected):
    if len(data) != expected['bytes']:
        raise ValueError('Byte length differs: ' + expected['path'])
    if hashlib.sha256(data).hexdigest() != expected['sha256']:
        raise ValueError('SHA-256 differs: ' + expected['path'])

for expected in receipt['verificationReceipts']:
    check(confined(expected['path']).read_bytes(), expected)

verified = []
for item in receipt['checks']:
    compressed = confined(item['gzip']['path']).read_bytes()
    check(compressed, item['gzip'])
    raw = gzip.decompress(compressed)
    check(raw, item['raw'])
    target = confined(item['raw']['path'])
    if target.exists() and target.read_bytes() != raw:
        raise ValueError('Existing raw differs; refusing overwrite: ' + str(target))
    verified.append((target, raw, item['raw']))

restored = 0
for target, raw, expected in verified:
    if not target.exists():
        with target.open('xb') as stream:
            stream.write(raw)
        restored += 1
    check(target.read_bytes(), expected)
print(json.dumps({'verifiedPairs': len(verified), 'restoredRawFiles': restored}))
PY
```

## Taille des nouveaux fichiers

Le [contrôle de taille](transport-file-size-check.json) décrit les nouveaux
fichiers non ignorés observés avant sa création et vérifie qu'aucun n'atteint
**33 554 432 octets**. Son propre contenu est également contrôlé avant l'écriture
exclusive. Cette observation reste datée ; de nouveaux ajouts ultérieurs doivent
être contrôlés à leur tour.

Ce transport n'exécute ni rejeu, ni test, ni build, ni jeu, ni génération de
référence. Il ne constitue pas une mesure de coût ni une acceptation de livraison.
Le vérificateur `verify-native-delivery` reste à exécuter après la fusion de la
publication réelle de 7B et le contrôle d'identité des entrées requis.
