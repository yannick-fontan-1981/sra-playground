#!/usr/bin/env python3
"""Select a next transfer candidate from already retained initial public pixels.

No game host, agent proposer, acquisition routine or solver is run. The only
source calls are geometric measurements and paired-motif measurement. The
nested admission filter is transcribed from its pinned policy/source and its
results are checked against the retained v49 read-only measurement.
"""
from __future__ import annotations

import gzip
import hashlib
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
LAYA = SOURCE / 'agents/yf_arc3_v6/laya_proto'
CORPUS = ROOT / 'tests/fixtures/v6-linked-packet-initial-public.json.gz'
AUDIT = ROOT / 'docs/migration/v6-entry-point-progress.json'
DESTINATION = ROOT / 'docs/migration/native-campaigns-v50'


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def verify_source():
    entries = json.loads((SOURCE.parent / 'manifest.json').read_text())['files']
    for relative, entry in entries.items():
        assert digest((SOURCE / relative).read_bytes()) == entry['sha256'], relative
    return {relative: entry['sha256'] for relative, entry in sorted(entries.items())}


def plain(value):
    if isinstance(value, dict):
        return {str(key): plain(child) for key, child in value.items()}
    if isinstance(value, (list, tuple)):
        return [plain(child) for child in value]
    if isinstance(value, (set, frozenset)):
        return [plain(child) for child in sorted(value)]
    return value


def descriptor(pattern):
    return {'frame_ref': pattern['id'], 'bbox': pattern['bbox'],
            'point': pattern['center'], 'core_area': pattern['foreground_area'],
            'core_scale': pattern['scale'], 'core_palette': pattern['color']}


def compact_measurement(rows, patterns, config):
    """Read-only predicate of NestedControlAccess.nested_question, without a plan."""
    assert config['selection_order'] == 'unique_minimum_measured_enclosure_area'
    candidates = []
    for pattern in patterns:
        left, top, right, bottom = pattern['bbox']
        width, height = right - left + 1, bottom - top + 1
        if width != height or width > min(len(rows), len(rows[0])) * config['maximum_extent_fraction']:
            continue
        if len(pattern['mask']) != 1 or pattern['foreground_area'] < config['minimum_core_area']:
            continue
        if pattern['foreground_area'] != pattern['scale'] ** 2:
            continue
        x, y = pattern['center']
        if rows[y][x] != pattern['color']:
            continue
        candidates.append(descriptor(pattern))
    if not candidates:
        return None, candidates
    area = lambda item: (item['bbox'][2] - item['bbox'][0] + 1) ** 2
    minimum = min(map(area, candidates))
    smallest = [item for item in candidates if area(item) == minimum]
    return (smallest[0] if len(smallest) == 1 else None), candidates


def same_extent_contrasts(patterns, selected):
    """Current geometry only; the source asks this after acquired field changes."""
    if selected is None:
        return []
    left, top, right, bottom = selected['bbox']
    extent = [right - left + 1, bottom - top + 1]
    return [descriptor(pattern) for pattern in patterns
            if [pattern['bbox'][2] - pattern['bbox'][0] + 1,
                pattern['bbox'][3] - pattern['bbox'][1] + 1] == extent
            and pattern['bbox'] != selected['bbox'] and len(pattern['mask']) > 1]


def main():
    verified = verify_source()
    sys.path[:0] = [str(SOURCE), str(LAYA)]
    from geometric_observer import components, framed_patterns
    from field_service_access import paired_controls

    corpus_raw = CORPUS.read_bytes()
    corpus = json.loads(gzip.decompress(corpus_raw))
    assert corpus['sourceCommit'] == COMMIT and corpus['actions'] == corpus['levelJumps'] == 0
    assert len(corpus['games']) == 100
    strategy_path = SOURCE / 'agents/yf_arc3_v6/morphology_policy/strategy.drm'
    strategy = json.loads(strategy_path.read_text())
    config = strategy['declarations'][0]['configuration']['window_constraints']['field_service_composition']
    audit = json.loads(AUDIT.read_text())
    audit_entry = next(entry for group in audit['groups'] if group['id'] == 'window_constraints'
                       for entry in group['entries'] if entry['question'] == 'field_service_composition')
    assert audit_entry['status'] == 'pending' and audit_entry['family'] is None
    previous_path = ROOT / 'docs/migration/native-campaigns-v49/candidate-selection.json'
    previous = {item['game']: item for item in json.loads(previous_path.read_text())['results']}
    results = []
    for view in corpus['games']:
        rows, observation = view['packet']['frame_rows'], view['observation']
        assert len(rows) > 0 and len(rows[0]) > 0 and all(len(row) == len(rows[0]) for row in rows)
        raster_digest = digest(json.dumps(rows, separators=(',', ':')).encode())
        assert observation['frame_hash'] == view['packet']['frame_hash'] == raster_digest[:16]
        assert observation['levels_completed'] == 0 and view['packet']['step_index'] == 0
        parts = components(rows)
        patterns = framed_patterns(rows, parts)
        selected, candidates = compact_measurement(rows, patterns, config['nested_control_question'])
        mirrored = paired_controls(rows)
        contrasts = same_extent_contrasts(patterns, selected)
        prior = previous[view['game']]['nestedControlPlan']
        assert plain(selected) == (prior['selected'] if prior else None), view['game']
        assert plain(mirrored) == previous[view['game']]['pairedControls'], view['game']
        results.append({'game': view['game'], 'observation_ref': observation['observation_ref'],
                        'frame_digest': raster_digest, 'initial_compact_motif': plain(selected),
                        'compact_candidates': plain(candidates), 'paired_motifs': plain(mirrored),
                        'same_extent_distinct_enclosures': plain(contrasts),
                        'eligible_initial_conjunction': selected is not None and bool(mirrored) and len(contrasts) == 1,
                        'acquired_field_context': False, 'acquired_service_context': False})
    chosen = [item for item in results if item['eligible_initial_conjunction']]
    assert len(chosen) == 1, 'Selection is inconclusive; do not choose a game by name or difficulty.'
    counts = {'initial_compact_motif': sum(item['initial_compact_motif'] is not None for item in results),
              'paired_motifs': sum(bool(item['paired_motifs']) for item in results),
              'compact_motif_and_pairs': sum(item['initial_compact_motif'] is not None and bool(item['paired_motifs']) for item in results),
              'compact_pairs_and_unique_contrast': len(chosen)}
    imported_sources = {}
    for module in list(sys.modules.values()):
        name = getattr(module, '__file__', None)
        if not name:
            continue
        path = Path(name).resolve()
        if path.is_relative_to(SOURCE) and path.is_file():
            relative = str(path.relative_to(SOURCE))
            imported_sources[relative] = digest(path.read_bytes())
            assert imported_sources[relative] == verified[relative], relative
    assert verify_source() == verified
    result = {'schema': 'logos-engine.v50.readonly-candidate-selection.v1',
              'sourceCommit': COMMIT, 'sourceFilesVerifiedBeforeAndAfter': len(verified),
              'generator': str(Path(__file__).relative_to(ROOT)), 'generatorSha256': digest(Path(__file__).read_bytes()),
              'corpus': {'path': str(CORPUS.relative_to(ROOT)), 'sha256': digest(corpus_raw),
                         'views': len(results), 'recordedActions': corpus['actions'], 'recordedLevelJumps': corpus['levelJumps']},
              'executionScope': {'gameHostsLoaded': 0, 'gameExecutions': 0, 'agentProposals': 0,
                                 'acquisitionCalls': 0, 'dispatchedActions': 0, 'privateStatesRead': 0,
                                 'scope': 'Retained initial public rows, pure source geometric measurements and the pinned policy admission predicate only.'},
              'sourceFunctionsCalled': ['geometric_observer.components', 'geometric_observer.framed_patterns', 'field_service_access.paired_controls'],
              'transcribedPredicates': ['NestedControlAccess.nested_question: initial compact-motif filter only',
                                       'EnvelopeFillAccess.propose: same-extent contrast geometry only; no acquired context assumed'],
              'sourceHashes': dict(sorted(imported_sources.items())), 'strategySha256': digest(strategy_path.read_bytes()),
              'policy': config, 'entryAudit': {'path': str(AUDIT.relative_to(ROOT)), 'sha256': digest(AUDIT.read_bytes()),
                                            'implementation': audit['implementation'], 'entry': audit_entry},
              'priorReadonlyAgreement': {'path': str(previous_path.relative_to(ROOT)), 'sha256': digest(previous_path.read_bytes()),
                                        'views': len(results), 'fields': ['nestedControlPlan.selected', 'pairedControls'], 'exact': True},
              'counts': counts, 'results': results,
              'selection': {'entry': 'field_service_composition', 'evaluationGame': chosen[0]['game'],
                            'criterion': 'Unique retained initial view combining a unique smallest compact enclosure, paired reflected motifs, and exactly one same-extent distinct enclosure.',
                            'currentPairedMotifs': len(chosen[0]['paired_motifs']),
                            'status': 'candidate_only_no_executed_action_or_level_completion',
                            'nextTarget': 'Transfer the generic acquired field/service chain, then evaluate one cold continuous campaign targeting the first three levels.',
                            'requiredAcquisitions': ['persistent public fields and repeatable pixel extent changes',
                                                     'actual prior-state restoration by a distinct current control',
                                                     'novel replacement and spatial control association after restoration',
                                                     'actual isolation and service responses before model retention',
                                                     'official boundary witness and current geometric rebinding for cross-epoch reuse']}}
    DESTINATION.mkdir(parents=True, exist_ok=True)
    (DESTINATION / 'candidate-selection.json').write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
    game = chosen[0]['game']
    nested_names = ', '.join(item['game'] for item in results if item['initial_compact_motif'] is not None)
    both_names = ' et '.join(item['game'] for item in results if item['initial_compact_motif'] is not None and item['paired_motifs'])
    note = f'''# v50 · Prochaine capacité candidate : composition de services entre champs

## Sélection sur les seules vues publiques conservées

Cette sélection relit les **{len(results)} écrans initiaux publics** du
[corpus v47](../../../tests/fixtures/v6-linked-packet-initial-public.json.gz),
dont le SHA-256 est `{digest(corpus_raw)}`. Elle ne charge aucun hôte de jeu,
n'exécute aucune action, aucun proposer d'agent et aucune acquisition simulée.
Les métadonnées du corpus déclarent zéro action et zéro saut de niveau.

Les **{len(verified)} fichiers** du source épinglé au commit `{COMMIT}` sont
vérifiés avant et après les mesures. Les seuls appels source sont
`geometric_observer.components`, `geometric_observer.framed_patterns` et
`field_service_access.paired_controls`. Le filtre initial de motif compact
et le filtre géométrique de contraste reprennent les critères de la politique
source ; ils produisent des mesures, sans proposition exécutable.

Les résultats des motifs sélectionnés et des paires concordent exactement
avec les 100 mesures readonly déjà conservées en v49. Le
[script reproductible](../../../scripts/select-v50-next-candidate.py) et les
[mesures complètes](candidate-selection.json) conservent les empreintes,
les critères, les références d'observation et toutes les alternatives.
L'[audit des entrées](../v6-entry-point-progress.json) confirme que
`field_service_composition` est encore `pending`.

| Critère visuel courant | Vues admises |
| --- | ---: |
| Unique plus petit motif compact dans une enceinte carrée fermée | {counts['initial_compact_motif']} |
| Au moins une paire de motifs réfléchis de même apparence | {counts['paired_motifs']} |
| Coexistence de ces deux mesures | {counts['compact_motif_and_pairs']} : {both_names} |
| Ces deux mesures et une unique enceinte distincte de même dimension | {counts['compact_pairs_and_unique_contrast']} : **{game}** |

Les vues admettant le motif compact sont {nested_names}. Sur {game},
l'observateur mesure **{len(chosen[0]['paired_motifs'])} paires de motifs**.
La conjonction de mesures justifie ce candidat pour le transfert de la chaîne
source. Elle ne prouve ni qu'un motif est une commande, ni qu'un champ
représente une ressource, ni qu'une action conduira à un progrès officiel.

## Capacité retenue : `field_service_composition`, évaluée sur {game}

Le nom du jeu sert uniquement à identifier l'évaluation. La sélection vient
des mesures courantes et la future logique devra conserver les conditions
génériques suivantes :

1. Mesurer un motif compact et acquérir son retour réel. Séparer les changements
   locaux et distants, sans lui attribuer un rôle physique au départ.
2. Acquérir des champs persistants à partir des différences effectivement
   observées, puis comparer leurs étendues en pixels après une répétition.
3. Tester une enceinte courante distincte et constater réellement une
   restauration avant d'examiner une composition de service.
4. Relier le remplacement observé, un champ corrélé et une paire mesurée ;
   tester l'isolation et le service, en conservant les inconnus et les refus.
5. Après une frontière officielle, rattacher les rôles retenus à la géométrie
   actuelle et revalider leurs effets avant une réutilisation entre époques.

Le périmètre propre attendu comprend `nested_control_access.py`,
`envelope_fill_observation.py`, `envelope_fill_access.py`,
`field_service_access.py`, `service_transfer_access.py` et
`common_field_service.py`, avec leurs dépendances réellement appelées.
Leur mémoire hérite de la couche Radial déjà transférée : son ordre,
son digest et ses gardes devront être respectés. Les événements
`nested_control_response`, `envelope_fill_context`, `field_service_context`
et `field_service_transfer` devront provenir des retours réellement acquis.

La mesure initiale ne remplace pas les préconditions source de restauration,
de changement de contenu et de confirmation officielle. Une enceinte
apparemment pleine conserve un statut d'hypothèse ; les volumes, capacités,
seuils, durées et lois de passage restent inconnus tant qu'ils ne sont pas
étayés. Aucun contexte appris n'est créé par cette sélection.

**Prochain objectif : transférer cette capacité générique, puis évaluer une
session froide continue de {game} visant au moins ses trois premiers niveaux.**
Cette note ne revendique aucune action exécutée, aucun niveau terminé et
aucune victoire de {game}.
'''
    (DESTINATION / 'candidate-selection.md').write_text(note)
    print(json.dumps({'output': str(DESTINATION.relative_to(ROOT)), 'counts': counts,
                      'selectedEntry': result['selection']['entry'], 'candidate': game,
                      'executedActions': 0, 'sourceFilesVerified': len(verified)}))


if __name__ == '__main__':
    main()
