# Checkpoint RECR01 conservé sans perte

Le checkpoint brut `recruitment-checkpoint.json` reste présent dans le checkout de travail. Ses **64 375 310 octets** dépassent la borne de transport retenue de 32 MiB par objet ; Git conserve sa représentation exacte `recruitment-checkpoint.json.gz` de **6 867 013 octets**.

Le [reçu de vérification](../recr01-transport-verification/receipt.json) établit, par lecture de flux sans interprétation du contenu, l'égalité de taille et de SHA-256 entre le brut et le gzip décomprimé. L'empreinte du brut est `95d3db9db5010a428a461e1fd164751b424138869162748248d2b94ce8692ebe`. Aucun résultat ni appel de la campagne n'est retiré.

Sur un checkout où seul le gzip est présent, la commande suivante, exécutée depuis la racine du dépôt, restaure exclusivement un fichier absent et vérifie ses octets :

```bash
python - <<'PY'
import gzip, hashlib, json, pathlib, shutil
base = pathlib.Path('docs/migration/lot10c-evidence/development/recr01')
receipt = json.loads((base.parent / 'recr01-transport-verification/receipt.json').read_text())
raw = base / 'recruitment-checkpoint.json'
if raw.exists():
    raise SystemExit('Le fichier brut existe déjà ; aucune modification.')
with gzip.open(base / 'recruitment-checkpoint.json.gz', 'rb') as source, raw.open('xb') as target:
    shutil.copyfileobj(source, target, 1024 * 1024)
digest = hashlib.sha256()
with raw.open('rb') as stream:
    for block in iter(lambda: stream.read(1024 * 1024), b''):
        digest.update(block)
assert raw.stat().st_size == receipt['raw']['bytes']
assert digest.hexdigest() == receipt['raw']['sha256']
print('Checkpoint restauré à l’identique.')
PY
```

Les autres rapports, journaux, empreintes et reçus restent conservés avec leurs noms et leur provenance d'exécution. Cette opération concerne le transport des preuves et ne relance aucune partie.
