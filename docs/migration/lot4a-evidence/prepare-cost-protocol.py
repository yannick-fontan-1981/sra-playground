#!/usr/bin/env python3
"""Declare one exact-source 4A cost window, without running measurements."""
from datetime import datetime, timezone
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[3]
BASE = Path(__file__).resolve().parent
OUT = BASE / 'performance'
HISTORICAL = ROOT / 'docs/migration/lot3h-evidence/performance'

def read(path): return json.loads(path.read_text())
def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def relative(path): return path.relative_to(ROOT).as_posix()
def fingerprint(path): return {'path': relative(path), 'bytes': path.stat().st_size, 'sha256': digest(path)}
def write(path, value):
    with path.open('x') as stream: stream.write(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
def inventory(root):
    files = dict(sorted((p.relative_to(root).as_posix(), digest(p))
        for folder in ['src/logos-engine', 'src/runtime'] for p in (root / folder).rglob('*')
        if p.is_file() and p.suffix in ('.ts', '.json', '.drm')))
    return {'fileCount': len(files), 'digest': hashlib.sha256(json.dumps(files, separators=(',', ':')).encode()).hexdigest(), 'files': files}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline-directory', type=Path, default=BASE / 'baseline')
    parser.add_argument('--candidate-directory', type=Path, default=BASE / 'final')
    parser.add_argument('--output-directory', type=Path, default=OUT)
    args = parser.parse_args()
    baseline_directory = args.baseline_directory.resolve()
    candidate_directory = args.candidate_directory.resolve()
    output_directory = args.output_directory.resolve()
    for directory in [baseline_directory, candidate_directory, output_directory]:
        directory.relative_to(ROOT)
    return prepare(baseline_directory, candidate_directory, output_directory)

def prepare(baseline_directory, candidate_directory, OUT):
    OUT.mkdir(parents=True, exist_ok=True)
    assert not (OUT / 'window.json').exists() and not (OUT / 'declaration.json').exists(), 'Preserve earlier windows and declarations'
    baseline = read(baseline_directory / 'source-manifest.json')
    provenance = read(baseline_directory / 'provenance.json')
    checkout = Path(provenance['checkout'])
    assert baseline == inventory(checkout)
    assert subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=checkout, text=True).strip() == provenance['commit']
    candidate = read(candidate_directory / 'source-manifest.json')
    archive = read(candidate_directory / 'source-archive.json')
    assert candidate == inventory(ROOT) and archive['nativeSourceManifestDigest'] == candidate['digest']
    assert candidate['digest'] != baseline['digest']
    for name, expected in archive['files'].items(): assert digest(ROOT / name) == expected, name
    version = re.search(r"NATIVE_V6_IMPLEMENTATION = 'logos-engine.typescript.v6.native-migration/([^']+)'", (ROOT / 'src/logos-engine/v6-native-runtime.ts').read_text()).group(1)
    previous = read(HISTORICAL / 'declaration.json')
    tools = previous['officialTools'] + [previous['globalDecisionTool'], previous['globalCalculationTool']]
    for record in tools: assert fingerprint(ROOT / record['path']) == record
    for name in ['cases.json', 'comparison-policy.json']:
        if not (OUT / name).exists(): shutil.copyfile(HISTORICAL / name, OUT / name)
        assert (OUT / name).read_bytes() == (HISTORICAL / name).read_bytes()
    for case in read(OUT / 'cases.json')['cases']:
        for root in [ROOT, checkout]: assert digest(root / case['trace']) == case['traceSha256']
    declared = datetime.now(timezone.utc).isoformat()
    policy = read(HISTORICAL / 'global-budget-policy.json')
    policy.update(declaredAt=declared,
        authorization={**policy['authorization'], 'source': 'Explicit user authorization retained for lot4A in the attached mission'},
        diagnosticPhasePolicy=relative(OUT / 'comparison-policy.json'),
        baseline={k: provenance[k] for k in ['nativeVersion', 'siteVersion', 'commit']},
        candidate={'nativeVersion': version, 'nativeDigest': candidate['digest'], 'nativeFiles': candidate['fileCount']},
        qualification='Fresh complete-session measurements for each game separately; all phases, tails, sessions and unfavorable results remain. Functional validation and machine isolation are separate evidence.')
    policy['baseline'].update(nativeDigest=baseline['digest'], nativeFiles=baseline['fileCount'])
    write(OUT / 'global-budget-policy.json', policy)
    text = f'''# Lot 4A : protocole de coût global

Déclaré le {declared}, avant toute mesure. A : Site {provenance['siteVersion']}, native {provenance['nativeVersion']}, commit `{provenance['commit']}`, digest `{baseline['digest']}`. B : native {version}, digest `{candidate['digest']}`. Les inventaires gelés contiennent {baseline['fileCount']} et {candidate['fileCount']} fichiers natifs.

A s'exécute dans `{checkout}`; B dans `{ROOT}`. Les anciennes durées ne fournissent aucun échantillon. Les cas, retours publics, outil de mesure et comparateurs sont conservés octet pour octet depuis le protocole précédent.

## Mesure et règle fixées avant exécution

Ordre A1/B1/B2/A2; STCK puis SMLP dans chaque série. Quatre sessions froides par jeu et série, soit huit par jeu et version, **32 sessions / 400 actions mesurées**. Huit chauffes séparées de trois actions, soit 24 actions, sont exclues conformément au protocole existant. Aucune session mesurée ni valeur extrême n'est exclue. Les deux cohortes seront terminées quel que soit le premier verdict. Tout incident restera conservé.

Le moteur calcule la commande avant de recevoir son retour public enregistré. Il n'est préinitialisé avec aucun trajet ni état appris. Les cas mesurent la boucle commune; ils ne démontrent pas la résolution live de ces jeux ni une contribution propre de Feedback.

Pour chaque jeu, réunir les huit sessions A et les huit sessions B, puis calculer `médiane(B)/médiane(A)-1`. L'augmentation doit être **strictement inférieure à 10 % pour chaque jeu**. Aucune compensation entre jeux ou somme de phases imbriquées. Les hausses par phase restent des diagnostics visibles lorsque ce critère global passe.

Mesures conservées : nouvelle décision, service/requête/garde de continuation, acquisition et persistance, persistance seule, restauration, Pause et mémoire. Le p95 empirique utilise `ceil(0.95*n)` uniquement avec au moins vingt échantillons; aucun p95 de session n'est annoncé sur huit sessions. Les mesures imbriquées ne s'additionnent pas et les observations d'une session sont corrélées.

## Intégrité et fenêtre exclusive

Les tests, builds, campagnes et contrôles navigateur doivent être terminés et le preview arrêté avant la fenêtre. Les agents du lot4A passent en lecture seule. Le verrou partagé `/workspace/shared/sra-coordination/performance.lock` est tenu pour les quatre séries; l'acquittement des autres fils et toute limite d'isolation sont consignés dans `readiness.json`. Le verrou coopératif seul ne prouve pas cet acquittement.

Les sources, outils, cas et politiques sont immuables pendant les mesures. Le wrapper contrôle leurs empreintes avant chaque série et après la dernière. Toute nouvelle correction exige un nouveau gel et une nouvelle fenêtre; les résultats antérieurs restent conservés.

Politique globale SHA-256 : `{digest(OUT / 'global-budget-policy.json')}`.
Vérificateur global SHA-256 : `{tools[5]['sha256']}`.
Calculateur global conservé SHA-256 : `{tools[6]['sha256']}`.

Cette fenêtre exclut le rendu navigateur, le moteur du jeu et le réseau. Les tests et campagnes établissent leurs portées séparément. Elle ne prouve pas une stabilité sur plusieurs heures.
'''
    with (OUT / 'protocol.md').open('x') as stream: stream.write(text)
    declaration = {**previous,
        'recordedAt': declared, 'finalizedAt': datetime.now(timezone.utc).isoformat(),
        'protocol': fingerprint(OUT / 'protocol.md'), 'cases': fingerprint(OUT / 'cases.json'),
        'diagnosticComparisonPolicy': fingerprint(OUT / 'comparison-policy.json'),
        'globalBudgetPolicy': fingerprint(OUT / 'global-budget-policy.json'),
        'baselineManifest': fingerprint(baseline_directory / 'source-manifest.json'),
        'candidateManifest': fingerprint(candidate_directory / 'source-manifest.json'),
        'candidateArchiveManifest': fingerprint(candidate_directory / 'source-archive.json'),
        'nativeDigests': {'baseline': baseline['digest'], 'candidate': candidate['digest']},
        'qualification': 'Lot4A declaration before its complete new window. Unchanged measured work and tools; no historical duration reused. Isolation and functional readiness require their own actual receipts.'}
    write(OUT / 'declaration.json', declaration)
    result = subprocess.run(['python', '-B', 'scripts/review-native-global-cost-window.py', '--check-protocol', relative(OUT / 'declaration.json')], cwd=ROOT, capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr
    (OUT / 'protocol-check.json').write_text(result.stdout)
    print(result.stdout.strip())

if __name__ == '__main__': main()
