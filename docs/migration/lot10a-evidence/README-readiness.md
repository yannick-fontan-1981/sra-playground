# Lot 10A : readiness avant la fenêtre de coût

`finalize-cost-readiness.py` est un lecteur de preuves achevées. Il ne lance
aucun test, import natif, replay, capture, build, navigateur, jeu ou mesure.
Sa préparation ne constitue pas une readiness. Son usage effectif attend les
sources intégrées gelées, les contrôles terminés et un nouvel acquittement
explicite de calme fourni par le responsable de livraison.

## Entrées et ordre

Après [README-preparation.md](README-preparation.md), les sorties de
`run-release-checks.py`, les régressions de `run-regressions.py`, la livraison
vérifiée par `scripts/verify-native-delivery.py`, la déclaration, les captures
qualifiées, le contrat et le préflight statique doivent déjà exister. Le
vérificateur commun reste inchangé : le finaliseur contrôle son empreinte avant
de charger ses fonctions de lecture pour les tests, le build, les régressions
et l’archive. Il ne relance pas son CLI de restauration, ni le CLI du contrat
qui interdit volontairement une vérification après création du préflight.

Depuis la racine candidate, renseigner les chemins **réels** ; tous les chemins
d’évidence sont relatifs au dépôt, ou absolus dans ce dépôt. La validation doit
être sous le dossier final. Seul le checkout de référence est extérieur : son
chemin CLI doit être absolu, canonique et distinct.

```bash
python -B docs/migration/lot10a-evidence/finalize-cost-readiness.py \
  --baseline-checkout /absolute/path/to/frozen-baseline \
  --final-directory docs/migration/lot10a-evidence/FINAL_DIRECTORY \
  --performance-directory docs/migration/lot10a-evidence/PERFORMANCE_DIRECTORY \
  --validation-directory docs/migration/lot10a-evidence/FINAL_DIRECTORY/validation \
  --regression-cases docs/migration/lot10a-evidence/recorded-regression-cases-site83.json \
  --browser-evidence docs/migration/lot10a-evidence/FINAL_DIRECTORY/browser/browser-qa.json \
  --contribution-reserve docs/migration/lot10a-evidence/diagnostic/pola-case-budget-review.json \
  --isolation-receipt docs/migration/lot10a-evidence/PERFORMANCE_DIRECTORY/coordinated-isolation.json
```

Les totaux proviennent des reçus, du manifeste des cas et des libellés littéraux
du comparateur inchangé. Le périmètre des jeux doit correspondre à celui du
driver 10A ; les deux fichiers de test Axial doivent réellement figurer dans le
TAP passé et dans la commande exécutée. Le nombre de tests, les versions, les
digests et les inventaires ne sont pas fixés dans ce helper. Les cinq gates
sont contrôlées, avec lecture sémantique des deux audits et vérification du
worker compilé. Les graphes restent liés à leur qualification antérieure par
leurs octets, leurs outils et leurs sources ; aucune nouvelle attribution n’est
inventée.

## Navigateur, POLA et calme

Le reçu navigateur suit `logos-engine.browser-qa.v1` avec `recordedAt`,
`nativeVersion`, `nativeDigest`, `status`, `qualification` et une liste non vide
`artifacts` d’empreintes `{path, sha256, bytes}`. Le statut explicite est `passed`,
`blocked` ou `inconclusive`. Pour `passed`, les observations réelles de Pause et
d’une action, leurs compteurs, et `learnedStateInjected: false` sont requis.
Pour `blocked`/`inconclusive`, conserver les erreurs ou traces d’essai ; les
champs de version/digest identifient alors seulement la cible prévue. Le
finaliseur conserve ce statut et n’en fait aucune preuve d’apport Axial.

La réserve POLA fournie doit conserver le succès non établi, la contribution
ouverte/non établie et l’absence de budget restant démontré. Le helper ne crée
aucune horloge, ne transforme pas `null` en zéro et n’accorde aucune action de
jeu. Un nouveau budget démontré nécessiterait une revue distincte de ce contrat.

Le reçu de calme suit `logos-engine.coordinated-cost-isolation.v1` avec le statut
`acknowledged_quiet_before_window`, `otherLaneAcknowledged`,
`ownTrackedComputeEnded` et `previewStopped` à `true`,
`costNodeOptionsOverride: null`, `recordedAt`, une `qualification` non vide et
une liste `evidence` non vide d’empreintes de preuves réellement conservées.
Son horodatage doit être postérieur aux dernières preuves finales, au préflight
et au navigateur. Les éventuels `knownLanes` ne peuvent conserver de commande
active. Si `performanceDirectory`, `nativeDigests` ou l’empreinte `declaration`
sont fournis, ils doivent correspondre exactement. Le responsable établit ce
reçu à partir des acquittements réels ; le finaliseur ne déduit rien d’un verrou
ou de l’absence de processus visibles. Une reprise d’activité après cet
acquittement impose une nouvelle coordination avant ABBA.

## Sorties et limites

Le seul résultat autorisant une mesure est le nouveau `readiness.json`, créé
exclusivement après contrôle des empreintes et de leur chronologie. Il conserve
les réserves fonctionnelles séparément de `pendingRequirements: []`, qui vise
uniquement les préconditions de coût. Il autorise **seulement la mesure de coût**,
sans annoncer son résultat, la réussite POLA, une migration complète ou une
publication. Le verrou exclusif et la coordination de la fenêtre restent à la
charge du lanceur commun.

Une readiness, un créneau, des cohortes, une agrégation ou une supersession déjà
présents dans l’un des deux checkouts provoquent un refus. Aucun reçu n’est
écrasé. Toute erreur après identification d’un dossier de performance sûr est
conservée dans un nouveau `readiness-failure-*.json`, avec la vraie exception et
les entrées déjà lues ; un chemin invalide ou une panne d’écriture reste signalé
sur stderr. Les refus antérieurs restent conservés. Le helper n’effectue aucune
réparation ni création de déclaration et ne peut garantir le maintien du calme
après son exécution.
