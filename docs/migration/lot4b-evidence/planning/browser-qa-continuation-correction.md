# Correction prospective — continuation de l’horloge QA navigateur TRIA

## Motif et portée

La résolution initiale du cas TRIA est close avec cible atteinte, 17 actions,
trois niveaux et **374.140910 secondes cumulées**. Le précédent code de readiness
exigeait, pour tout reçu navigateur `passed`, que son cumul reste inférieur ou
égal à ce total initial. Une nouvelle QA finale ajoutant sa durée réelle aurait
donc été refusée, même sous le plafond de 2 400 secondes.

La correction conserve la résolution initiale intacte. Elle ajoute l’option
explicite `--browser-qa-continuation PATH`, qui lie un **nouveau reçu séparé** de
QA au cas résolu, au gel final et au reçu navigateur réel. Elle ne suppose ni
succès ni échec de la QA future et n’augmente aucun budget. Aucun résultat de coût,
jeu ou navigateur n’est produit par cette correction textuelle.

## Version antérieure conservée

| Version | Fichier | Octets | SHA-256 |
| --- | --- | ---: | --- |
| Avant correction | `planning/finalize-cost-readiness-before-browser-continuation.py` | 34992 | `ab3e404841ce349001d281873dd8d72fd32ee3b0d4bad33ed65df874d4d4b519` |
| Après correction prospective | `finalize-cost-readiness.py` | 38778 | `579f69f39b1da4dcf13629710faf41f07c90e99fe444a8bef81921599e16ca7b` |

La copie antérieure a été comparée par SHA-256 avec le script encore intact
avant sa modification. Elle est une archive documentaire, pas un outil à
exécuter depuis `planning/`. `planning/cost-tool-review.json` et
`planning/cost-tool-review-text-addendum.json` restent inchangés. La présente
correction nécessite sa propre revue indépendante et son nouvel addendum avant
déclaration du coût. Aucun autre des onze outils coût n’a été modifié pour cette
correction.

## Contrat de continuation

Le reçu de QA est construit à partir du début et de la fin réellement observés
de la phase navigateur finale, avec son journal/artefacts conservés dans le reçu
navigateur. Démarrer la phase avant sa première tentative et conserver le même
début pour ses reprises : ne retenir seulement ni la dernière tentative ni le
seul fragment réussi. L’intervalle est une phase QA continue ; le délai entre la
résolution initiale et le début de cette phase n’est pas chargé.

Le validateur exige :

1. Une résolution initiale toujours `target_three_levels_achieved`, inchangée et
   liée par empreinte exacte. `cumulativeBeforeSeconds` égale exactement son
   `cumulativeChargedSeconds`, sans reset.
2. Les empreintes exactes du manifeste final et du reçu navigateur final, avec
   `browserStatus` identique au statut observé.
3. Un début après la résolution initiale, une fin strictement postérieure au
   début, et les mêmes instants `startedAt`/`finishedAt` dans les deux reçus.
   La fin doit précéder la finalisation de readiness.
4. `elapsedSeconds` égal exactement à l’intervalle réel des horodatages,
   `cumulativeAfterSeconds = cumulativeBeforeSeconds + elapsedSeconds`, et un
   total après QA inférieur ou égal à 2 400 secondes. Le calcul Decimal tient
   compte des microsecondes ; aucune tolérance ou marge de budget n’est ajoutée.
5. `browser.cumulativeGameCaseSeconds` égal à ce total après QA. Le cumul initial
   et le cumul actualisé restent distingués dans la sortie de readiness.

Une QA finale `passed` exige ce reçu. Un reçu `blocked_infrastructure` avec zéro
action peut rester sans continuation, et conserve alors le cumul initial ; si
une continuation est fournie, elle subit tous les contrôles ci-dessus. Cela ne
transforme jamais un blocage en contrôle navigateur passant.

### Template documentaire, volontairement non exécutable

Les `null` doivent être remplacés uniquement par les valeurs observées et leurs
empreintes calculées. Le statut `template_not_executable` doit rester ainsi tant
que la phase n’est pas terminée ; readiness exige ensuite `completed`.

```json
{
  "schema": "logos-engine.relative-arrangement-browser-qa-continuation.v1",
  "status": "template_not_executable",
  "game": "TRIA",
  "scope": "continuous_final_browser_qa_interval",
  "initialCaseStatus": "target_three_levels_achieved",
  "clockReset": false,
  "maximumCumulativeSeconds": 2400,
  "initialResolution": {
    "path": "docs/migration/lot4b-evidence/tria-case-resolution.json",
    "bytes": null,
    "sha256": null
  },
  "sourceManifest": {"path": null, "bytes": null, "sha256": null},
  "browserReceipt": {"path": null, "bytes": null, "sha256": null},
  "browserStatus": null,
  "startedAt": null,
  "finishedAt": null,
  "cumulativeBeforeSeconds": 374.140910,
  "elapsedSeconds": null,
  "cumulativeAfterSeconds": null,
  "qualification": "QA finale distincte du cas initial résolu ; intervalle complet de QA, toutes ses tentatives conservées, aucun reset, attente interlots antérieure exclue."
}
```

Le reçu navigateur doit être terminé et empreinté **avant** celui de continuation.
Il porte son propre intervalle et son cumul après QA ; il ne référence pas en
retour l’empreinte de la continuation, ce qui éviterait une dépendance circulaire.

## Sortie et vérifications différées

`readiness.game.initialResolvedCumulativeSeconds` conserve le total initial ;
`browserQaContinuation` lie le nouveau reçu ; `browserQaElapsedSeconds` retient
la durée QA ; `cumulativeSeconds` et `remainingSeconds` portent le cumul actualisé.
Sans continuation admissible, les champs de continuation restent `null` et le
cumul reste celui du cas initial. Tous les fichiers lus sont revérifiés avant
l’écriture exclusive de readiness.

La préparation a utilisé seulement lecture, copie textuelle, édition et
empreintes légères. Aucun main, import natif/original, syntax-check, test, jeu,
build, replay ou coût n’a été exécuté. Les vérifications exécutables sont
différées au release explicite ; la revue source indépendante doit porter sur
cette modification avant toute déclaration du protocole final.
