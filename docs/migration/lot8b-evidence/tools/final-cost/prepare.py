#!/usr/bin/env python3
"""Declare one Lot8B cost window from final, actually captured functional forms.

Reads and hashes only. No native import, measurement, readiness or lock claim.
Outputs are new files; existing declarations and measured evidence are refused.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[5]
TOOLS = Path(__file__).resolve().parent
EVIDENCE = ROOT / 'docs/migration/lot8b-evidence'
HISTORICAL = ROOT / 'docs/migration/lot3h-evidence/performance'
BASE_COMMIT = '4ff7bf45286a8a19d34401988adca587253ae41e'
DIGESTS = {'baseline': 'ab674682f3345b09bec94959174fbb5bf0f1bd06154693697e5814987b572316',
           'candidate': 'c234bb404de43b380e5595cee8ad4ddfcae6e02d0fcc40286546fcf6838dd44a'}
VERSIONS = {'baseline': '0.66.0', 'candidate': '0.67.0'}
QUOTE = "si le global reste en dessous de 10% d'augmentation alors une phase qui dépasse 10% peut être accepté."
ORDER = ['A1', 'B1', 'B2', 'A2']
CASE_KEYS = ['id', 'trace', 'traceSha256', 'actions', 'targetLevels', 'warmupActions']
FORM_KEYS = [('STCK', 'warmup'), ('STCK', 'measured'), ('SMLP', 'warmup'), ('SMLP', 'measured')]
OFFICIAL = ['scripts/run-native-cost-window.py', 'scripts/measure-native-loop-costs.mjs',
            'scripts/compare-native-loop-costs.mjs', 'scripts/compare-native-cost-cohorts.mjs',
            'scripts/review-native-cost-consolidation.py', 'scripts/review-native-global-cost-window.py',
            'scripts/review-native-global-cost-budget.py']


def require(ok, message):
    if not ok:
        raise ValueError(message)


def unique(pairs):
    value = {}
    for key, item in pairs:
        require(key not in value, 'Duplicate JSON key: ' + key)
        value[key] = item
    return value


def read(path):
    return json.loads(Path(path).read_bytes(), object_pairs_hook=unique,
                      parse_constant=lambda value: (_ for _ in ()).throw(ValueError('Non-finite JSON: ' + value)))


def sha(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode()


def inventory(root):
    files = dict(sorted((str(p.relative_to(root)), sha(p))
                        for folder in ['src/logos-engine', 'src/runtime']
                        for p in (root / folder).rglob('*')
                        if p.is_file() and p.suffix in ('.ts', '.json', '.drm')))
    return {'fileCount': len(files), 'digest': hashlib.sha256(canonical(files)).hexdigest(), 'files': files}


def git(root, *args):
    return subprocess.check_output(['git', *args], cwd=root, text=True, timeout=30).strip()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['baseline-checkout', 'baseline-manifest', 'candidate-manifest', 'reconciliation',
                 'work-forms', 'graph-review', 'owner-inventory', 'functional-review', 'output-directory']:
        parser.add_argument('--' + name, required=True, type=Path)
    args = parser.parse_args()
    baseline = args.baseline_checkout.resolve(strict=True)
    require(baseline != ROOT, 'Distinct baseline checkout required')
    roots = {'baseline': baseline, 'candidate': ROOT}
    watched = {}

    def resolve(name):
        path = (ROOT / name).absolute()
        require(path.resolve(strict=True) == path and path.is_file(), 'Canonical existing file required: ' + str(path))
        require(path.is_relative_to(ROOT) or path.is_relative_to(baseline), 'Input outside selected checkouts: ' + str(path))
        return path

    def fp(name):
        path = resolve(name)
        label = path.relative_to(ROOT).as_posix() if path.is_relative_to(ROOT) else str(path)
        value = {'path': label, 'bytes': path.stat().st_size, 'sha256': sha(path)}
        require(label not in watched or watched[label] == value, 'Input changed: ' + label)
        watched[label] = value
        return value

    def verify(record):
        require(set(record) == {'path', 'bytes', 'sha256'}, 'Unexpected fingerprint fields')
        require(fp(record['path']) == record, 'Declared bytes changed: ' + record['path'])

    def proof_fingerprints(value):
        if isinstance(value, dict):
            if set(value) == {'path', 'bytes', 'sha256'}:
                verify(value)
            else:
                for item in value.values():
                    proof_fingerprints(item)
        elif isinstance(value, list):
            for item in value:
                proof_fingerprints(item)

    output = (ROOT / args.output_directory).absolute()
    require(output.is_relative_to(EVIDENCE) and output != EVIDENCE and not output.exists(),
            'Use a wholly new named Lot8B performance directory')
    require(not (baseline / output.relative_to(ROOT)).exists(), 'Baseline output directory already exists')
    require(git(baseline, 'rev-parse', 'HEAD') == BASE_COMMIT, 'Baseline is not the actual Site107 source')
    manifests, identities = {}, {}
    for role in roots:
        path = args.baseline_manifest if role == 'baseline' else args.candidate_manifest
        manifests[role] = read(resolve(path))
        require(manifests[role] == inventory(roots[role]), 'Native freeze mismatch: ' + role)
        require(manifests[role]['digest'] == DIGESTS[role], 'Unexpected final native digest: ' + role)
        require(manifests[role]['fileCount'] == (329 if role == 'baseline' else 331), 'Unexpected native file count')
        require(not git(roots[role], 'status', '--porcelain', '--', 'src/logos-engine', 'src/runtime'),
                'Native freeze must already be committed: ' + role)
        text = (roots[role] / 'src/logos-engine/v6-native-runtime.ts').read_text()
        version = re.findall(r"NATIVE_V6_IMPLEMENTATION\s*=\s*['\"]logos-engine\.typescript\.v6\.native-migration/([^'\"]+)['\"]", text)
        require(version == [VERSIONS[role]], 'Native literal mismatch: ' + role)
        identities[role] = {'checkout': str(roots[role]), 'nativeVersion': version[0],
                            'nativeDigest': DIGESTS[role], 'nativeFiles': manifests[role]['fileCount'],
                            'sourceCommit': git(roots[role], 'rev-parse', 'HEAD'), 'manifest': fp(path)}
        for name in manifests[role]['files']:
            fp(roots[role] / name)
    identities['baseline']['siteVersion'] = 107
    identities['candidate']['siteVersion'] = None
    fp(HISTORICAL / 'declaration.json')
    previous = read(HISTORICAL / 'declaration.json')
    official = previous['officialTools'] + [previous['globalDecisionTool'], previous['globalCalculationTool']]
    require([r['path'] for r in official] == OFFICIAL, 'Historical tool set differs')
    for record in official:
        verify(record)
        require(sha(baseline / record['path']) == record['sha256'], 'Baseline official tool changed')
        fp(baseline / record['path'])
    for name, key in [('cases.json', 'cases'), ('comparison-policy.json', 'diagnosticComparisonPolicy')]:
        verify(previous[key])
        require(fp(HISTORICAL / name) == previous[key], 'Historical case/policy changed')
    cases = read(HISTORICAL / 'cases.json')
    require(cases['rounds'] == 4 and [r['id'] for r in cases['cases']] == ['STCK', 'SMLP'], 'Case protocol changed')
    require([r['actions'] for r in cases['cases']] == [10, 15] and all(r['warmupActions'] == 3 for r in cases['cases']), 'Work sizes changed')
    for item in cases['cases']:
        for root in roots.values():
            require(fp(root / item['trace'])['sha256'] == item['traceSha256'], 'Public trace mismatch')
    source = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/'
    for name in ['laya_proto/common_frontier_policy.drm.json', 'morphology_policy/strategy.drm']:
        require(sha(ROOT / (source + name)) == sha(baseline / (source + name)), 'Source declarations differ')
        for root in roots.values():
            fp(root / (source + name))
    forms, graph, owners = [read(resolve(path)) for path in [args.work_forms, args.graph_review, args.owner_inventory]]
    require(forms['schema'] == 'logos-engine.lot8b-delivery-work-forms.v1'
            and graph['schema'] == 'logos-engine.lot8b-delivery-work-graph-review.v1'
            and owners['schema'] == 'logos-engine.lot8b-delivery-owner-cost-source-inventory.v1', 'Unexpected functional schema')
    for artifact in [forms, graph]:
        require(artifact['status'] == 'qualified_functional_work_forms_and_individual_graphs'
                and artifact['preparedOnly'] is True and artifact['officialPerformanceEligible'] is False
                and artifact['strictCommonGraphParity'] is False, 'Functional qualification was relabeled or failed')
    require(all(artifact['nativeDigests'] == DIGESTS for artifact in [forms, graph, owners]), 'Functional proof uses another freeze')
    require(graph['unattributedDifferenceCount'] == 0 and graph['failures'] == []
            and graph['checkedCount'] == len(graph['checks']) == 64 and all(r['passed'] is True for r in graph['checks']),
            'Unresolved or missing functional controls')
    require(forms['review'] == fp(args.graph_review) and graph['ownerInventory'] == fp(args.owner_inventory), 'Functional evidence linkage differs')
    require(hashlib.sha256(canonical(forms['forms'])).hexdigest() == graph['formsSha256'], 'Functional shapes changed')
    require([(f['case'], f['form']) for f in forms['forms']] == FORM_KEYS, 'Four declared forms required')
    functional_cases = read(resolve(forms['cases']['path']))
    projection = lambda value: [{key: row[key] for key in CASE_KEYS} for row in value['cases']]
    require(projection(cases) == projection(functional_cases), 'Functional and measured case semantics differ')
    require([x for x in owners['owners']['candidate'] if x != 'branch_routing'] == owners['owners']['baseline']
            and owners['owners']['candidate'].count('branch_routing') == 1
            and owners['programs']['candidate'] == owners['programs']['baseline'], 'Unexpected owner/program population')
    for role in roots:
        receipt = read(resolve(forms['captures'][role]['receipt']['path']))
        require(receipt['status'] == 'captured_functional_structure' and receipt['role'] == role
                and receipt['nativeDigest'] == DIGESTS[role] and receipt['nativeVersion'] == VERSIONS[role]
                and receipt['nativeSourceUnchanged'] is True and receipt['inputsUnchanged'] is True
                and receipt['generatorUnchanged'] is True and receipt['failures'] == []
                and receipt['nativeInventoryBefore'] == receipt['nativeInventoryAfter'] == manifests[role]
                and receipt['sessionCount'] == 4 and receipt['actions'] == 31, 'Invalid final functional capture: ' + role)
        require(Path(receipt['checkout']).resolve() == roots[role], 'Functional checkout mismatch')
        require(receipt['inputsBefore'] == receipt['inputsAfter'], 'Functional input mutation')
        require([r['shape'] for r in receipt['sessions']] == [f[role] for f in forms['forms']], 'Shapes not actually captured')
        for form in forms['forms']:
            require(form[role]['final']['implementation'] == 'logos-engine.typescript.v6.native-migration/' + VERSIONS[role],
                    'Final implementation was not actually captured')
        proof_fingerprints(receipt)
    for artifact in [forms, graph, owners]:
        proof_fingerprints(artifact)
    # These distinct final review/reconciliation receipts remain readable claims,
    # not an automatic inference from the qualifier's process exit code.
    require(isinstance(read(resolve(args.reconciliation)), dict), 'A real reconciliation receipt is required')
    fp(args.reconciliation)
    review = read(resolve(args.functional_review))
    require(review['schema'] == 'logos-engine.lot8b-final-functional-review.v1' and review['status'] == 'passed'
            and review['nativeDigests'] == DIGESTS and review['workForms'] == fp(args.work_forms)
            and review['graphReview'] == fp(args.graph_review) and review['blockingObjections'] == [],
            'Final independent functional review missing, failed or not bound to these exact proofs')
    fp(args.functional_review)
    for name in ['prepare.py', 'postprocess.py', 'analyze.mjs', 'review.py', 'README.md']:
        fp(TOOLS / name)
    stamp = datetime.now(timezone.utc).isoformat()
    output.mkdir(parents=True)
    for name in ['cases.json', 'comparison-policy.json']:
        (output / name).write_bytes((HISTORICAL / name).read_bytes())
        fp(output / name)
    expected = {'schema': 'logos-engine.lot8b-final-cost-expected-forms.v1', 'recordedAt': stamp,
                'nativeDigests': DIGESTS, 'source': fp(args.work_forms), 'forms': forms['forms'],
                'qualification': 'Exact fresh final-source functional shapes, copied without transformation. Historical forms remain functional-only.'}
    (output / 'expected-forms.json').write_text(json.dumps(expected, indent=2, ensure_ascii=False) + '\n')
    fp(output / 'expected-forms.json')
    relative = output.relative_to(ROOT).as_posix()
    command = ['python', '-B', 'scripts/run-native-cost-window.py', str(baseline), relative,
               identities['baseline']['manifest']['path'], identities['candidate']['manifest']['path']]
    protocol = f'''# Lot 8B : coût prospectif de native 0.67\n\nDéclaré le {stamp}. Référence A : Site107/native0.66, commit {BASE_COMMIT}. Candidat B : native0.67, digest {DIGESTS['candidate']}.\n\nLa fenêtre conserve A1/B1/B2/A2, STCK10 puis SMLP15, quatre sessions froides par jeu et série. Les 32 sessions mesurées (400 actions) et huit chauffes distinctes (24 actions) sont toutes conservées. Seules les chauffes sont exclues des médianes. Huit durées complètes sont groupées par jeu/version. La médiane B doit être strictement inférieure à 1,1 fois A pour chacun des deux jeux, sans compensation ni exclusion. Les phases au-dessus de 10% restent visibles et peuvent être admises si les deux globaux passent.\n\nLes durées proviennent uniquement du runner conservé. session_elapsed mesure le parcours complet du contrôleur jusqu'au dernier retour acquis, pauses/reprises incluses. Le démarrage worker, begin, les inspections terminales et close restent hors de cette durée ; le moteur de jeu, le réseau et le rendu navigateur ne sont pas mesurés. Les phases sont imbriquées et ne s'additionnent pas. Aucun p95 pour huit durées.\n\nLes cas et la politique sont copiés octet pour octet depuis3H ; leurs anciens commentaires ne désignent pas les versions de cette fenêtre. Les cas fonctionnels sont reliés par les six champs exacts déclarés, pas par une fausse égalité de leurs fichiers. Les quatre formes finales sont copiées sans modifier leurs valeurs. Chaque future session et chauffe doit correspondre à sa propre forme. Tous les autres champs de workSignature, phases, pauses et placements doivent rester identiques entre versions et dans chaque version. Seuls observations[*].nodeCount, inspection[*].graphNodes, final.nodeCount et final.graphRevision admettent les valeurs exactes prouvées avant mesure. Aucun autre écart n'est accepté.\n\nLa comparaison stricte historique est réellement exécutée et conservée. Le lecteur complémentaire8B accepte uniquement un refus de métadonnées de travail observé, sans sortie, puis vérifie indépendamment le contrat limité ci-dessus. Il ne transforme pas ce refus en succès. Les deux comparaisons de paires et tous les temps bruts restent conservés ; leur statut de phase ne tranche pas le global. Le calculateur JavaScript réutilise les fonctions historiques inchangées. Le reviewer Python recalcule les effectifs, formes, signatures, phases et seuil strict depuis les rapports bruts.\n\nLa préparation n'établit ni readiness ni isolation. Le contrôleur externe doit acquérir une exclusivité non bloquante, superviser le groupe entier et libérer son propre descripteur sans supprimer le verrou. Le plafond proposé est1800s actives ; les réserves exactes de fermeture et de conservation sont fixées prospectivement par le plan du contrôleur. Aucun prérequis de disponibilité ou de publication des autres lots ne s'applique au travail ordinaire. Les analyses suivent la libération du verrou. Aucun nouveau jeu ni LKEY n'est exécuté.\n\nCommande mesurée, uniquement sous le contrôleur déclaré :\n\n```json\n{json.dumps(command, ensure_ascii=False)}\n```\n'''
    (output / 'protocol.md').write_text(protocol)
    fp(output / 'protocol.md')
    contract = {'schema': 'logos-engine.lot8b-final-cost-contract.v1', 'status': 'declared_before_official_window',
        'recordedAt': stamp, 'performanceDirectory': relative, 'baseline': identities['baseline'], 'candidate': identities['candidate'],
        'nativeDigests': DIGESTS, 'cases': fp(output / 'cases.json'), 'comparisonPolicy': fp(output / 'comparison-policy.json'),
        'expectedForms': fp(output / 'expected-forms.json'), 'protocol': fp(output / 'protocol.md'),
        'functionalForms': fp(args.work_forms), 'graphReview': fp(args.graph_review), 'ownerInventory': fp(args.owner_inventory),
        'functionalReview': fp(args.functional_review), 'reconciliation': fp(args.reconciliation),
        'functionalCaseProjection': {'keys': CASE_KEYS, 'values': projection(cases), 'byteIdentityClaimed': False},
        'historicalTools': official, 'supplementaryTools': {'analyzer': fp(TOOLS / 'analyze.mjs'), 'reviewer': fp(TOOLS / 'review.py')},
        'measurement': {'order': ORDER, 'rounds': 4, 'measuredSessions': 32, 'measuredActions': 400,
            'warmupSessions': 8, 'warmupActions': 24, 'sessionsPerCaseVersion': 8, 'excludedMeasuredSessions': 0,
            'excludedOutliers': 0, 'command': command, 'proposedMaximumActiveSeconds': 1800},
        'globalRule': {'authorization': QUOTE, 'stage': 'session_elapsed', 'relativeIncreaseLimit': 0.1,
            'comparison': 'strictly_less_than', 'allCasesMustPass': True, 'crossCaseCompensation': False,
            'phaseOverrunsMayBeAccepted': True},
        'structuralRule': {'owner': 'branch_routing', 'addedPrograms': [],
            'allowedPaths': ['observations[*].nodeCount', 'inspection[*].graphNodes', 'final.nodeCount', 'final.graphRevision'],
            'mode': 'exact_predeclared_functional_values', 'unattributedDifferencesAllowed': 0},
        'controls': {'noNativeExecution': True, 'readinessEstablished': False, 'isolationEstablished': False,
            'publicationAuthorizedByThisContract': False, 'historicalFunctionalProofsUnchanged': True},
        'inputFingerprints': list(watched.values())}
    for record in contract['inputFingerprints']:
        verify(record)
    with (output / 'contract.json').open('x') as stream:
        json.dump(contract, stream, indent=2, ensure_ascii=False, allow_nan=False)
        stream.write('\n')
    print(json.dumps({'status': contract['status'], 'contract': fp(output / 'contract.json'), 'measurementExecuted': False}))


if __name__ == '__main__':
    main()
