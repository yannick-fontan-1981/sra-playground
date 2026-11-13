# Lot 10A : revue indépendante du finaliseur de readiness

Date : 2026-11-10 UTC. Revue textuelle de `finalize-cost-readiness.py` et
`README-readiness.md`, pendant la fenêtre officielle 4B annoncée à 22:38:56.
Aucun helper n’a été exécuté, importé ou analysé par un parseur ; aucun test,
build, replay, navigateur, jeu, capture, décompression d’archive ni calcul natif
n’a été lancé pour cette revue. La revue s’est limitée à des lectures de texte
et au relevé d’empreintes des deux nouveaux petits fichiers. Aucun fichier
d’implémentation n’a été modifié ; ce compte rendu est le seul nouveau fichier
de cette revue.

## Verdict et provenance

Aucun blocage concret de compatibilité ou de classement des réserves n’a été
identifié dans les sources examinées. Ce verdict est une revue de code : il
ne constitue ni une exécution réussie du finaliseur, ni une readiness, ni une
qualification des futurs graphes, ni une acceptation du coût.

Checkout examiné :
`/workspace/sites/sra-lot10a-20261110/.sites-checkout`.
HEAD de consignation : `88e0cc6f0bd90f7d70d58187742d9e0b6943edae`.
Les deux nouveaux fichiers étaient **non suivis** à la lecture ; ce HEAD
n’atteste donc pas leurs octets. Empreintes SHA-256 effectivement relevées :

| Fichier sous `docs/migration/lot10a-evidence/` | SHA-256 relu |
| --- | --- |
| `finalize-cost-readiness.py` | `49f2ae8087adef22e5aa591e2fa3fd45ca4e49702db852bb01106b02fffb08fe` |
| `README-readiness.md` | `2c5c0b092bc05aa08712af4151e7d32c9afb35493ce2b6c551f13767f91189e6` |

Recoupements principaux dans ce checkout :

- `scripts/verify-native-delivery.py` : contrats des tests, du build, des
  régressions, de l’archive et du reçu d’intégrité ; son chargement ne lance
  pas son CLI.
- `scripts/compare-v54-regressions.py`,
  `scripts/run-released-public-regressions.py` et
  `scripts/run-released-public-regressions-streamlog.py` : libellés et
  métadonnées du comparateur, horodatages et écriture du reçu d’exécution.
- `docs/migration/lot10a-evidence/run-release-checks.py`,
  `run-regressions.py`, `validation-test-scope.json` et
  `recorded-regression-cases-site83.json` : commandes et périmètres réels.
- Dans le même dossier : `prepare-cost-protocol.py`,
  `prepare-owner-cost-contract.py`, `check-cost-static-inputs.py`,
  `qualify-cost-owner-graphs.mjs`, `consolidate-owner-costs.mjs` et
  `review-owner-costs.py` : chaîne de préparation et consommateurs.
- `scripts/run-native-cost-window.py` : sorties de mesure et responsabilité
  du lanceur commun ; aucune exécution de ce fichier.
- `docs/migration/lot10a-evidence/diagnostic/pola-case-budget-review.json` :
  contrat réel de la réserve historique POLA.

Le schéma d’isolation a également été confronté au reçu existant
`/workspace/sites/sra-lot4a-20261110/.sites-checkout/docs/migration/lot4b-evidence/performance-integrated/coordinated-isolation.json`,
horodaté `2026-11-10T22:38:47.132254+00:00`. Cette lecture sert uniquement à
contrôler la compatibilité du format ; elle n’importe ni l’acquittement ni
l’isolation de 4B dans 10A.

## Contrats recoupés

| Frontière | Constat de lecture |
| --- | --- |
| Vérificateur commun | Le finaliseur exige d’abord un reçu d’intégrité passé, son générateur égal aux octets présents et ses chemins exacts. Il charge ensuite ses fonctions de lecture, sans relancer le CLI de restauration. Les formes de retour réutilisées correspondent au vérificateur existant. |
| Tests et gates | Le périmètre est reconstruit depuis le manifeste et les éventuels extras. Les deux fichiers Axial sont obligatoires dans l’inventaire et la commande effectivement retenue. Les six compteurs TAP sont relus ; aucun total de tests ou numéro de version n’est fixé. Les cinq gates, les deux audits sémantiques et le worker sont contrôlés. |
| Régressions | Le périmètre est dérivé du littéral `EXPECTED_GAMES` du driver 10A ; les libellés sont dérivés du comparateur inchangé. Les sources présentes donnent sept cas et dix-sept comparaisons chacun, sans nouveau jeu ajouté par le finaliseur. Les égalités du reçu d’exécution excluent correctement son propre fingerprint, ajouté seulement après son écriture. |
| Préparation | Déclaration, sources, versions effectives, outils préalablement déclarés, contrat, captures, attribution et préflight sont reliés par leurs empreintes. Les deux commandes de lecteurs réellement enregistrées par le préflight correspondent aux arguments attendus. Le finaliseur ne relance pas `--verify-only` après le préflight. |
| Structure et coût | La chaîne exige une qualification structurelle antérieure et les formes effectivement capturées. Elle ne soustrait aucun coût et ne prédit pas la réussite du comparateur historique. Le contrat conserve ses chemins de refus strict, qui devront provenir de la future exécution réelle. Le contrôle prospectif du protocole reste lié au préflight ; les analyseurs conservent la règle globale des deux jeux, 32 sessions, 400 actions et huit warmups, sans exclusion supplémentaire d’outliers. |
| Consommateurs de readiness | Les deux analyseurs 10A attendent `measurementAuthorized: true`, `pendingRequirements: []`, le digest candidat et les empreintes du contrat, du préflight, de la déclaration et des deux analyseurs dans `inputs`. Le finaliseur fournit ces champs. Les entrées externes sont conservées séparément, sans introduire de chemins absolus dans la liste locale consommée. |
| Chemins et identité | Les chemins locaux sont confinés au checkout candidat, sans traversée ni composant symbolique. L’unique racine externe admise est le baseline CLI absolu, canonique et distinct. Les inventaires natifs complets et versions effectives sont revérifiés ; le baseline doit conserver le commit déclaré et un arbre natif propre. |
| Chronologie et sorties | Déclaration avant captures, attribution avant fixture/contrat, contrat avant préflight, puis preuves finales avant acquittement du calme sont exigés. La présence de readiness, fenêtre, cohortes, agrégations ou supersession dans l’un des deux checkouts est refusée. Écritures exclusives ; chaque erreur conservable produit un nouveau reçu d’échec, sans écraser les refus précédents. |

## Réserves conservées

Le reçu navigateur 10A doit être une nouvelle preuve au format documenté
`logos-engine.browser-qa.v1`, avec `recordedAt`, `nativeVersion`, `nativeDigest`,
un statut explicite et les artefacts conservés. Les formats historiques 4B et
5A ont d’autres noms de champs et ne sont pas directement réutilisables. Cela
constitue une précondition de production du reçu, pas un défaut du lecteur.

`blocked` et `inconclusive` restent leurs statuts réels ; leur liaison native
est explicitement une cible prévue. Le statut `passed` exige les observations
Pause/action et leurs compteurs, sans injection d’état appris. Dans tous les
cas, le résumé ne revendique aucun apport Axial.

Le reçu POLA existant est compatible : contribution ouverte, succès non
établi, temps cumulé et temps restant inconnus. Ces deux valeurs restent
`null` ; le finaliseur interdit nouvelle horloge, budget supposé neuf, emprunt
du temps d’un autre jeu et nouvelle action. La réserve demeure dans
`functionalReservations`, distincte des seules préconditions de mesure.

Le format de calme récent de 4B est compatible sans champ `knownLanes`.
Un reçu 10A réel et postérieur aux preuves finales reste obligatoire.
Le finaliseur ne transforme pas un verrou ou une absence de processus visibles
en acquittement. Une reprise d’activité exige une coordination renouvelée.

## Préconditions restantes, sans qualification anticipée

L’usage effectif doit attendre l’intégration et le gel réels du candidat et de
son baseline, les vérifications fonctionnelles de ces octets, les captures
qualifiées et le préflight de la même paire. Les dépendances constatées par le
préflight doivent rester équivalentes jusqu’à la fenêtre ; les reçus conservés
ne constituent pas une surveillance continue de l’environnement.

Il faudra produire le reçu navigateur honnête et le nouvel acquittement de
calme, puis exécuter le finaliseur dans une plage autorisée. Sa lecture future
recontrôlera notamment les archives et les logs comprimés ; cette revue n’a
pas effectué ces opérations ni vérifié la syntaxe par exécution.

Même un futur `readiness.json` passé n’autorisera que la mesure de coût.
Il ne prouvera ni le maintien ultérieur du calme, ni le verdict des comparateurs,
ni POLA, ni une migration complète et n’autorisera aucune publication.
