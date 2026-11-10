# Lot 10A : finaliser le protocole sur les futurs gels réels

Les trois helpers de ce document sont une **préparation de source**. Ils n'ont
pas été exécutés, importés ou vérifiés par un parseur pendant la fenêtre de calme
5A. Aucun baseline final, numéro de Site, version native, digest, résultat de
capture, readiness ou coût 10A n'est annoncé par leur présence.

Après la libération fonctionnelle explicite de 5A, les trois sources Python ont
passé un [contrôle de syntaxe en mémoire](diagnostic/cost-preparation-syntax.json)
sous le verrou partagé non bloquant. Les objets compilés n'ont pas été exécutés
et les modules cibles n'ont pas été importés. Ce contrôle n'exécute aucune des
étapes décrites ci-dessous et ne remplace pas leurs preuves futures.

Ce document complète [README-commands.md](README-commands.md). Pour les nouveaux
helpers, l'ordre est explicite : **gels réels → déclaration → inventaire et
captures → qualification → contrat → préflight statique → readiness → fenêtre**.
La déclaration fige donc les outils et les règles avant les nouvelles captures.
Le helper de contrat vérifie cette antériorité. Les sorties sont créées une seule
fois ; un échec ou une déclaration devenue obsolète reste conservé.

Les sources de ces helpers reprennent les flux de préparation 7A/4B, le contrôle
statique 7A/4B/5A et les schémas déjà consommés par les deux analyseurs 10A. Les
outils historiques sous `scripts/` et les preuves des autres lots restent
inchangés. Il n'y a pas de raccourci fondé sur un ancien nombre de fichiers,
digest, total de tests ou chemin de checkout.

## 1. Fournir les identités après intégration et gel

Le responsable doit d'abord intégrer les prédécesseurs effectivement publiés,
retenir leurs sources dans un checkout distinct, puis figer les sources finales
du candidat. Les deux inventaires natifs doivent être complets, avec `files`,
`fileCount` et `digest`. Le candidat doit également posséder son
`source-archive.json` et l'archive qu'il référence. Les valeurs ci-dessous sont
des paramètres à remplacer, pas des identités de livraison présumées.

```bash
AXIAL_BASELINE_CHECKOUT=/absolute/path/to/frozen-baseline
AXIAL_BASELINE_COMMIT=FULL_40_CHARACTER_PUBLISHED_COMMIT
AXIAL_BASELINE_SITE=PUBLISHED_SITE_NUMBER
AXIAL_BASELINE_VERSION=ACTUAL_BASELINE_NATIVE_VERSION
AXIAL_CANDIDATE_VERSION=ACTUAL_CANDIDATE_NATIVE_VERSION
AXIAL_EVIDENCE=docs/migration/lot10a-evidence
AXIAL_COST=docs/migration/lot10a-evidence/performance-integrated
AXIAL_BASELINE_MANIFEST=docs/migration/lot10a-evidence/integrated-baseline/source-manifest.json
AXIAL_CANDIDATE_SOURCE=docs/migration/lot10a-evidence/integrated-final
AXIAL_CANDIDATE_MANIFEST="$AXIAL_CANDIDATE_SOURCE/source-manifest.json"
```

Exécuter depuis la racine du checkout candidat, uniquement après libération
explicite du calme en cours et accord de coordination pour ce travail. Tous les
chemins de sortie sont sous `lot10a-evidence`. Le chemin générique
`lot10a-evidence/performance` est réservé et refusé ; employer un répertoire
nommé neuf. Le checkout baseline est un argument obligatoire à chaque étape.

## 2. Déclarer le protocole avant les captures

```bash
python -B "$AXIAL_EVIDENCE/prepare-cost-protocol.py" \
  --finalize --owner-cost-qualification \
  --baseline-checkout "$AXIAL_BASELINE_CHECKOUT" \
  --baseline-commit "$AXIAL_BASELINE_COMMIT" \
  --baseline-site-version "$AXIAL_BASELINE_SITE" \
  --baseline-version "$AXIAL_BASELINE_VERSION" \
  --candidate-version "$AXIAL_CANDIDATE_VERSION" \
  --output-directory "$AXIAL_COST" \
  --baseline-manifest "$AXIAL_BASELINE_MANIFEST" \
  --candidate-source-directory "$AXIAL_CANDIDATE_SOURCE"
```

Ce helper vérifie le commit et la propreté native du baseline, les deux versions
natives, les deux inventaires réels, l'ascendance et les entrées de l'archive,
les traces publiques et les sept outils historiques inchangés. Le numéro de
Site est fourni par le responsable ; le helper ne vérifie pas l'hébergement.
Il relève séparément le HEAD et les éventuelles modifications natives du
candidat : un HEAD ne devient pas le commit de sources encore non commitées.

Il copie les octets historiques de `cases.json` et `comparison-policy.json`, puis
crée `preparation.json`, `global-budget-policy.json`, `protocol.md`,
`declaration.json` et `protocol-check.json`. Seul le vérificateur historique de
protocole est invoqué. Son éventuel échec et ses sorties sont conservés. Aucun
test, import du moteur, capture, campagne ou chronométrage n'est lancé.

La déclaration et le protocole surveillé engagent les empreintes des trois
helpers de préparation, des trois outils d'inventaire/capture/qualification et
des deux analyseurs de coût 10A. Le contrat futur est annoncé par son chemin ;
son empreinte n'est pas réintroduite dans la déclaration, ce qui évite un cycle.
Après cette étape, toute correction de ces outils impose une déclaration et des
preuves prospectives distinctes avant les mesures concernées.

## 3. Inventorier et qualifier les graphes avant toute mesure

Ces commandes importent ou exécutent le moteur ; elles demandent leur propre
créneau coordonné. Elles ne doivent pas être exécutées pendant la fenêtre
officielle d'un autre lot.

```bash
node "$AXIAL_EVIDENCE/record-owner-source-inventory.mjs" \
  "$AXIAL_BASELINE_CHECKOUT" "$AXIAL_COST/owner-source-inventory.json"

node "$AXIAL_EVIDENCE/capture-cost-owner-graphs.mjs" \
  baseline "$AXIAL_BASELINE_CHECKOUT" "$AXIAL_COST/cases.json" \
  "$AXIAL_BASELINE_MANIFEST" "$AXIAL_COST/owner-graphs-baseline.json.gz"

node "$AXIAL_EVIDENCE/capture-cost-owner-graphs.mjs" \
  candidate . "$AXIAL_COST/cases.json" \
  "$AXIAL_CANDIDATE_MANIFEST" "$AXIAL_COST/owner-graphs-candidate.json.gz"

node "$AXIAL_EVIDENCE/qualify-cost-owner-graphs.mjs" \
  "$AXIAL_BASELINE_CHECKOUT" \
  "$AXIAL_COST/owner-graphs-baseline.json.gz" "$AXIAL_COST/owner-graphs-baseline.receipt.json" \
  "$AXIAL_COST/owner-graphs-candidate.json.gz" "$AXIAL_COST/owner-graphs-candidate.receipt.json" \
  "$AXIAL_COST/owner-structural-attribution.json" "$AXIAL_COST/owner-structural-fixture.json"
```

Le seul propriétaire ajouté est `public_axial_question` ; le seul programme
ajouté est `v6.axial_question.choose`. Le captureur observe `recordObserved`,
appelé par les chemins actif et passif réels. Les quatre formes sont STCK chauffe,
STCK session, SMLP chauffe, SMLP session : 31 actions par version, avec trois
inspections terminales réelles pour chaque forme de session complète.

L'attribution reste stricte sur l'origine des fragments communs et l'ordre des
deltas communs. Une première création par Axial d'un fragment partagé qui
appartenait auparavant à un autre propriétaire produit un refus conservé. Aucun
supplément 5A ni assouplissement rétrospectif n'est importé dans 10A. Une fixture
absente ou refusée interdit le contrat et la mesure.

## 4. Fermer le contrat, puis vérifier les entrées statiques

```bash
python -B "$AXIAL_EVIDENCE/prepare-owner-cost-contract.py" \
  --finalize \
  --baseline-checkout "$AXIAL_BASELINE_CHECKOUT" \
  --performance-directory "$AXIAL_COST" \
  --owner-inventory "$AXIAL_COST/owner-source-inventory.json" \
  --structural-fixture "$AXIAL_COST/owner-structural-fixture.json"

python -B "$AXIAL_EVIDENCE/check-cost-static-inputs.py" \
  --baseline-checkout "$AXIAL_BASELINE_CHECKOUT" \
  --performance-directory "$AXIAL_COST"
```

Le contrat lie les captures, reçus, formes, attribution, sources du propriétaire,
inventaire réel, déclaration et outils. Il vérifie les fichiers externes contre
le seul checkout baseline déclaré, leurs chemins réels et leurs empreintes.
Les reçus `nativeInventoryBefore`/`nativeInventoryAfter` des captures sont des
inventaires complets ; ils ne sont pas confondus avec les résumés
`{digest, fileCount}` de certains rapports de coût.

Le mode `--verify-only`, utilisé par le préflight, reconstitue ce même contrat
depuis ses entrées inchangées et compare tous ses champs. Il n'écrit rien et ne
rafraîchit pas la date du contrat. Son usage manuel, avant création du préflight,
remplace simplement `--finalize` par `--verify-only` dans la première commande.

Le préflight produit `static-preflight.json`. Il vérifie aussi les octets de
l'archive, refuse les membres dupliqués ou spéciaux, compare les dépendances,
inspecte statiquement l'ordre ABBA du runner conservé, rejoue le contrôle de
protocole et vérifie l'absence de mesures et de readiness préexistantes.
Il n'initialise pas le moteur et ne lance aucun jeu, test, build ou benchmark.
Les contrôles échoués restent visibles ; un statut réussi n'établit ni readiness
fonctionnelle, ni isolement, ni résultat de jeu.

## 5. Readiness et fenêtre officielle séparées

Le responsable doit encore lier les preuves finales de tests, builds, jeu,
restauration, navigateur et intégrité à ces mêmes sources, avec les réserves
réelles. La readiness doit conserver les empreintes de la déclaration, du
contrat, du préflight et des deux analyseurs ; elle doit précéder strictement le
début de la fenêtre. Les helpers n'en fabriquent aucune.

Un nouveau calme explicite de tous les lots concurrents est nécessaire pour
les coûts réels. La simple existence du verrou ou d'un ancien reçu de calme ne
suffit pas. Après cette coordination et readiness complète, le responsable peut
tenir le verrou exclusif pendant le runner inchangé :

```bash
flock -x /workspace/shared/sra-coordination/performance.lock \
  python -B scripts/run-native-cost-window.py "$AXIAL_BASELINE_CHECKOUT" \
  "$AXIAL_COST" "$AXIAL_BASELINE_MANIFEST" "$AXIAL_CANDIDATE_MANIFEST"
```

Les quatre séries A1/B1/B2/A2 conservent **32 sessions mesurées, 400 actions et
les huit sessions par jeu/version**. Seules huit chauffes et 24 actions de
chauffe sont exclues. Le critère est la médiane groupée des durées complètes
`session_elapsed` par jeu : `médiane(B) < 1,1 × médiane(A)`, séparément pour STCK
et SMLP. Aucune compensation entre jeux, somme de phases, moyenne de ratios de
cohorte, correction du temps de propriétaire ou exclusion de valeur extrême
n'est admise. Phases, p95 disponibles, Pause, inspections et mémoire restent
publiés.

## 6. Conserver le vrai refus historique

Après les mesures, le comparateur historique brut reste distinct de l'analyse
qualifiée. La commande exacte figure dans le protocole généré et dans
`README-commands.md`. Son reçu doit provenir de l'exécution réelle. Il conserve :

| Champ | Valeur liée à l'exécution |
| --- | --- |
| `schema` | `logos-engine.retained-tool-failure.v1` |
| `command` | Tableau exact `node`, outil historique, politique, six rapports des cohortes, sortie historique |
| `startedAt`, `finishedAt` | Instants réels avec fuseau, après la fin de `window.json` |
| `exitCode` | Code de sortie réel non nul |
| `inputs` | Empreintes ordonnées : outil, politique, baseline1, after1, comparison1, baseline2, after2, comparison2 |
| `inputsUnchanged` | Comparaison réelle des empreintes avant/après |
| `outputExists` | État réel de `combined-comparison.json`, attendu faux pour ce chemin |
| `log` | Empreinte du journal réel `aggregation-failure.log` |

Les deux analyseurs exigent le motif réel `Within-cohort work metadata changed`.
Un succès strict, une autre erreur, une entrée modifiée ou une sortie historique
créée bloque ce chemin complémentaire ; rien n'est rebaptisé en refus attendu.
La réussite du recalcul indépendant des nombres reste distincte du verdict
d'acceptation global pour les deux jeux.

Les captures fonctionnelles qualifient les formes prévues. Elles ne prouvent pas
rétrospectivement les feuilles privées non enregistrées des sessions mesurées.
Cette limite, le refus strict et les résultats numériques restent visibles dans
le rapport final.
