# Préfixe connu STCK : décomposition des mesures conservées

**Analyse a posteriori en lecture seule. Ce document ne constitue ni un nouveau test, ni une nouvelle mesure, ni une cause établie.** Il décompose les quatre rapports de la fenêtre officielle 0.38 → 0.42. Aucun moteur, test, profil ou script de mesure n'a été exécuté pour produire cette analyse. Seuls ce document et son [annexe JSON](known-prefix-followup.json) sont créés.

Le [comparateur officiel](../performance/combined-comparison.json) conserve le verdict **14/16**, avec deux dépassements STCK : `known_prefix_service` **+27,720363 %** et `known_prefix_request` **+26,350748 %**. Le seuil reste **+10 %**. Les deux cibles précédentes respectent désormais le seuil : persistance STCK **−8,261037 %**, restauration SMLP **+6,223866 %**. Ce constat ne clôt pas 3B.

## Sélection et calcul

Pour chacun des quatre rapports, on prend uniquement STCK, les essais dont `warmup` est faux et les requêtes `type == "advance" && kind == "action"`, comme dans `scripts/compare-native-loop-costs.mjs`. Il reste **32 requêtes par version**, issues de huit sessions mesurées par version. Chaque session fournit les séquences **5, 6, 7, 8**. Tous les échantillons retenus sont conservés dans l'annexe JSON, avec rapport, session, index de requête et index de garde.

La garde est appariée à sa requête **dans le même rapport et le même essai, par `sequence`**. Il existe exactement une garde instrumentée par requête sélectionnée. Pour chaque requête i :

- `guard_i = somme des known_prefix_guard.elapsedMs de cette requête` ;
- `serviceOutsideGuard_i = nativeServiceMs_i − guard_i` ;
- `transportResidual_i = max(0, wallMs_i − nativeServiceMs_i)`.

On calcule ensuite la médiane des 32 différences de chaque version, en moyennant les valeurs centrales 16 et 17 après tri. **On ne soustrait pas les médianes des phases.** L'appariement porte sur les chronométrages emboîtés d'une même requête, pas sur un plan expérimental A/B apparié. Les médianes des composantes ne sont pas additives.

| Élément | Champ JSON | Référence 0.38, médiane ms | Version 0.42, médiane ms |
|---|---|---:|---:|
| Service complet | nativeServiceMs | 8.844152000 | 11.295783000 |
| Requête complète | wallMs | 10.522126500 | 13.294785500 |
| Garde instrumentée | guardMs | 0.227991500 | 0.243714500 |
| Service hors garde, différence par requête | serviceOutsideGuardMs | 8.600408000 | 11.045734500 |
| Résidu externe, différence par requête | transportResidualMs | 1.771711500 | 1.893720000 |

`nativeServiceMs` encadre `await service.handle(operation)` dans le worker. `wallMs` encadre l'aller-retour de `transport.request`. Le résidu externe inclut la copie des messages, l'ordonnancement et le travail du worker hors service, dont la collecte mémoire ; il ne mesure pas un transport pur. Le service hors garde est un **reste arithmétique**, sans chronométrage autonome.

## Ce que les données établissent

L'augmentation observée se trouve principalement dans le service complet hors de la garde mesurée : sa médiane passe de **8,600408 ms à 11,045735 ms**. Le résidu externe passe de **1,771711 ms à 1,893720 ms**. Les seules phases internes instrumentées présentes à ces séquences sont les gardes ; aucun échantillon de planification, scellement, persistance ou restauration n'y apparaît. Les sources de mesure et d'exécution concordent avec cette sélection.

Les deux cohortes dépassent séparément le seuil pour le service et la requête :

- cohort1 : service +26.748000 %, requête +27.364775 %.
- cohort2 : service +13.141428 %, requête +11.737054 %.

Les variations entre sessions restent importantes ; le comparateur qualifie ces dépassements de `over_budget_with_noise_unresolved`. Leur répétition ne permet pas de les écarter comme simple bruit. Ces résultats ne prouvent pas non plus qu'une modification particulière de 0.42 les a causés. Aucun instant de GC, changement de JIT, cause d'attente ou profil détaillé de ces requêtes n'est établi par ces rapports.

Les 64 requêtes ont les mêmes métadonnées de travail visibles : famille `public_occurrence_recall`, proposition `public_program_composition`, 4 cycles, 250 nœuds, 4 transitions acquises. Les manifestes [base](../base/source-manifest.json) et [final](../final/source-manifest.json) montrent aussi des octets identiques pour les six modules listés dans l'annexe (`v6-agent-service`, `v6-agent-protocol`, `v6-native-observer`, `v6-native-authority`, `v6-reasoning-memory`, `v6-program-composition-access`). Cela ne prouve pas une égalité de tous les volumes de données, historiques d'allocation, états JIT/GC ou conditions d'ordonnancement.

## Prochain diagnostic à déclarer

La prochaine étape concrète est de ventiler le reste du service avant de choisir une correction. Les points ci-dessous sont dans le moteur commun. Ils ne sont pas chronométrés séparément dans les preuves actuelles ; leur présence dans le chemin ne prouve pas qu'ils causent le dépassement.

| Fichier | Fonctions | Travail à distinguer |
|---|---|---|
| `src/runtime/v6-agent-protocol.ts` | `validateV6PublicObservation`, `toV6PublicObservation`, `publicFrame` | Validation and detached copies of the current 64 by 64 frame and animation frames; record frame counts and validation/copy time separately. |
| `src/runtime/v6-agent-service.ts` | `nativeObservation` | Construct native public observation, JSON encoding/TextEncoder and async SHA-256 for the frame; distinguish synchronous preparation from await duration. Related: `src/runtime/v6-agent-protocol.ts::v6FrameHash`. |
| `src/logos-engine/v6-native-runtime.ts` | `advance` | Command comparison, detached observation clone/freeze, measureNativeObservation, family.after, preservation/witness/note work, authorize, and output. Time these separately without adding nested durations together. |
| `src/logos-engine/v6-native-observer.ts` | `measureNativeObservation`, `geometricComponents` | Connected components, async component signatures and entity construction; record public component counts and await duration. |
| `src/logos-engine/v6-native-runtime.ts` | `snapshot`, `output` | Coverage and family/caller revision maps, authority snapshot, trace outer list and dynamic fields; record branch sizes and revision/identity stability. |
| `src/logos-engine/v6-native-authority.ts` | `snapshot` | Measure detached copy of EPISODE composition_target returned by reasoning-memory get; record target size and whether its revision changed. Related: `src/logos-engine/v6-reasoning-memory.ts::get`. |
| `src/runtime/v6-agent-service.ts` | `snapshot`, `accept` | Immutable branch checks and reuse, detached copy of remaining snapshot branches, freeze and command/ticket construction; record payload sizes and cache hits. |
| `scripts/measure-native-loop-costs.mjs` | `nativeWorker parentPort handler`, `transport.request` | Keep complete service duration and worker/controller residual separate. Residual includes message cloning/scheduling and worker bookkeeping outside service.handle; it is not pure wire transport. |

Deux pistes génériques sont à vérifier : certifier en privé la provenance d'une observation déjà validée, détachée et gelée par le service afin d'éviter sa seconde copie dans le runtime ; réutiliser les branches immuables de snapshot dont la révision n'a pas changé. La première doit conserver le traitement défensif des entrées étrangères ; la seconde doit conserver observations courantes, compteurs, tickets, traces et gardes. Aucun choix n'est encore démontré par ces données. La validation des nouvelles frames, l'autorisation de chaque action, les contrats d'acquisition et de checkpoint restent obligatoires ; aucune règle propre à un jeu ou un niveau n'est envisagée.

Ce diagnostic futur doit être distinct et déclaré. Une nouvelle fenêtre officielle conservera ensuite le protocole, le seuil et toutes les sessions mesurées, avec les témoins d'actions, requêtes et états. Le présent document ne modifie aucun résultat officiel.

## Sources et reproduction

Les quatre rapports ci-dessous sont lus sans modification. Leur empreinte est recalculée sur les octets du fichier ; l'annexe conserve également les empreintes du comparateur agrégé, des manifestes et des deux scripts existants.

| Rapport dans `performance/` | Octets | SHA-256 |
|---|---:|---|
| `cohort1/baseline.json` | 425336 | `9123080371c68231c7784a5c16fe5d547b99c5e86078eb52e39d9c35eae98e2c` |
| `cohort1/after.json` | 426008 | `47e3f4f1fb80749dc8529a0075705bf47685a1fbc9341ced522dd4e8ec69f394` |
| `cohort2/baseline.json` | 425448 | `6db7e653a705a8126af5e4e687e6e30cb37051835e1236ed8ae63845ea10065c` |
| `cohort2/after.json` | 426019 | `83d30f4e59b720982cee615d6dd4db3ee8bdb4152fe26bb7646fbafba8f165b3` |

Depuis la racine du dépôt, cette commande ne fait que lire les rapports et imprimer leurs empreintes et les cinq médianes. Elle ne lance aucun test ni moteur et n'écrit aucun fichier.

```sh
python - <<'PY_REPRO'
import hashlib, json, statistics
from pathlib import Path
base = Path('docs/migration/lot3b-state-cost-evidence/performance')
pooled = {'baseline': [], 'after': []}
for cohort in ('cohort1', 'cohort2'):
    for side in pooled:
        path = base / cohort / f'{side}.json'
        raw = path.read_bytes()
        print(path, hashlib.sha256(raw).hexdigest(), len(raw))
        case = next(c for c in json.loads(raw)['cases'] if c['id'] == 'STCK')
        for trial in case['trials']:
            if trial['warmup']:
                continue
            for r in trial['requests']:
                if r['type'] != 'advance' or r['kind'] != 'action':
                    continue
                guards = [s['elapsedMs'] for s in trial['samples']
                          if s.get('sequence') == r['sequence']
                          and s['stage'] == 'known_prefix_guard']
                assert len(guards) == 1
                g = sum(guards)
                pooled[side].append([r['nativeServiceMs'], r['wallMs'], g,
                    r['nativeServiceMs'] - g,
                    max(0, r['wallMs'] - r['nativeServiceMs'])])
labels = ['service', 'request', 'guard', 'service-minus-guard', 'request-minus-service']
for side, rows in pooled.items():
    assert len(rows) == 32
    print(side, len(rows), dict(zip(labels,
          [statistics.median(row[i] for row in rows) for i in range(5)])))
PY_REPRO
```
