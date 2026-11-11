# Preuves du lot 7B

**Première publication native 7B : Site 88, native 0.55.0, déploiement `succeeded`.**
Le [reçu effectif](publication/native-publication.json) conserve cette publication
privée et les identités du build validé. Les preuves fonctionnelles intégrées
sont terminées après intégration du véritable prédécesseur 4B **Site 87**, commit
`dd355400264b50942486559b8ca56ee6dfc6a3cc`, native **0.54.0**. Le gel contient
**291 fichiers natifs** et une archive de **302 entrées**, digest
`ea25603262a7473e5ab9994d2e2e86dd64a8291dd7c1dc18ede4d1f443cdc53b`.
Le commit conservé avant la fenêtre officielle est `ab0829f`.

<!-- LOT7B_EVIDENCE_RESULTS_START -->
## Preuves intégrées finales disponibles

| Répertoire ou fichier | Résultat et portée |
| --- | --- |
| [`coordination/published-4b-site86.json`](coordination/published-4b-site86.json), [`published-4b-site87.json`](coordination/published-4b-site87.json) et [`published-base-binding.json`](coordination/published-base-binding.json) | Première publication réelle 4B, clôture documentaire et liaison du baseline final |
| [`coordination/integrated-test-scope-plan.json`](coordination/integrated-test-scope-plan.json) | 108 fichiers du reçu passé 4B, dans leur ordre publié, puis quatre contrats Symbols sans doublon : 112 fichiers déclarés |
| [`integrated-final/source-manifest.json`](integrated-final/source-manifest.json), [`source-archive.json`](integrated-final/source-archive.json) et parties | Identité des 291 fichiers natifs et conservation des 302 entrées archivées |
| [`integrated-final/validation/delta-tests-run.json`](integrated-final/validation/delta-tests-run.json) | **4 327/4 327 tests**, ordre exact des 112 fichiers, aucun échec, skip, todo ou annulation ; sources et entrées de tests inchangées |
| [`integrated-final/validation/checks-run.json`](integrated-final/validation/checks-run.json) | **5/5 checks** passés : types, entrées, migration, diff, build ; identité du worker compilé |
| [`integrated-final/regressions/regression-summary.json`](integrated-final/regressions/regression-summary.json) | **8/8 cas, 136/136 contrôles**, 309 actions, 317 paquets, 227 préfixes, 24 frontières |
| [`integrated-final/lkey-partial/qualification.json`](integrated-final/lkey-partial/qualification.json) | **157/157 contrôles**, `partial_trajectory_preserved` ; campagne brute `failed`, 25 actions, 2/3 niveaux, `frontier_unknown` conservé |
| [`integrated-final/execution-craf.json`](integrated-final/execution-craf.json) et rapports CRAF | Campagne froide finale : **3 niveaux, 36 actions Symbols, 36 préfixes**, une session normale |
| [`integrated-final/original/craf-public-parity.json`](integrated-final/original/craf-public-parity.json) | **144/144 appels**, **432/432 comparaisons exactes** ; **36 préfixes et 252/252 contrôles de checkpoints/restaurations**, 72 appels `restoreNative` réellement observés |
| [`integrated-final/original/craf-contribution.json.gz`](integrated-final/original/craf-contribution.json.gz) | Retirer les méthodes supprime 27 propositions ; retirer la liaison courante en supprime 18 ; quatre cas de compteur gardent la même décision avec des preuves différentes |
| [`integrated-final/browser/browser-qa.json`](integrated-final/browser/browser-qa.json) et artefacts | Build final 0.55 observé dans le navigateur : **3 niveaux CRAF, 36 actions**, Pause, incrément d'une action et frontières dans la même session |
| [`integrated-final/craf-case-checkpoint-final.json`](integrated-final/craf-case-checkpoint-final.json) | Copie finale immuable de l'horloge : **1 646,100543 s consommées**, **753,899457 s restantes**, sans remise à zéro |
| [`integrated-final/delivery-integrity.json`](integrated-final/delivery-integrity.json) | Intégrité des inventaires, reçus et transports exacts vérifiée ; aucune nouvelle exécution de jeu n'est déduite de ce reçu |

Les cas stricts sont CATR, RSWP, FOGW, VOIS, CONN, MIND, WEAV et TRIA.
Ils restent des replays de retours publics archivés. Le résultat partiel LKEY
est séparé de ces huit cas et ne devient pas une réussite du troisième niveau.
L'audit final raccorde **59 entrées sur 76**, sans déclarer la migration complète.

Le Python original de CRAF est instancié froid et reconstruit ses propres états
à partir des appels publics effectivement atteints : **aucun état appris natif
n'y est injecté**. Le validateur final exige les checkpoints et les véritables
restaurations observées avec `--require-checkpoints`. Les 72 appels de
restauration sont distincts des 144 appels source. Ces preuves de composant,+d'acquisition et de persistance ne constituent pas la parité stratégique de tout
l'appelant Python.

Le journal navigateur brut conserve ses octets exacts. Le
[`diagnostic/browser-raw-whitespace.json`](diagnostic/browser-raw-whitespace.json)
retient le signalement de quatre espaces finaux dans le snapshot d'accessibilité
après ajout des preuves à l'index. Le contrôle formel du diff avait passé avant
cet ajout ; aucune source native, entrée de test, outil ou entrée de build n'a
changé. Le snapshot lié à la QA n'a pas été réécrit pour supprimer ce diagnostic.
<!-- LOT7B_EVIDENCE_RESULTS_END -->

<!-- LOT7B_EVIDENCE_COST_FINAL_START -->
## Coût terminé : deux jeux acceptés selon la règle pré-déclarée

La [revue indépendante](performance-integrated/owner-growth-review.json) passe
**3 927/3 927 contrôles** et accepte **2/2 jeux** selon la médiane du coût complet,
strictement sous **+10 % par jeu**, sans compensation. Les chiffres affichés sont
ceux du [rapport rendu](performance-integrated/results.md), arrondis uniquement
pour la lecture ; huit sessions sont conservées par jeu et version.

| Jeu | Médiane A, ms | Médiane B, ms | Variation globale | Décision |
| --- | ---: | ---: | ---: | --- |
| STCK | 10 885,500 | 10 643,030 | **−2,227459 %** | Accepté |
| SMLP | 16 007,482 | 16 123,439 | **+0,724394 %** | Accepté |

La [fenêtre A1/B1/B2/A2](performance-integrated/window.json) s'est terminée avec
statut et intégrité finale `passed`, du **10 novembre 2026 à 23:32:46 UTC** au
**23:41:23 UTC**. Les **32 sessions mesurées / 400 actions** sont toutes retenues ;
seules les **8 chauffes / 24 actions** sont exclues. Aucun échantillon mesuré,
valeur extrême ou cohorte défavorable n'a été écarté.

Le [reçu de clôture d'isolation](performance-integrated/coordinated-isolation-completion.json)
est `passed` : les cinq statuts des autres fils sont identiques octet pour octet
avant/après. Le [reçu du verrou](performance-integrated/performance-lock-completion.json)
conserve sa tenue sur toutes les séries et sa libération à **23:41:23 UTC**.

| Preuve préalable | Contenu fixé avant mesure |
| --- | --- |
| [`performance-integrated/protocol.md`](performance-integrated/protocol.md) et [`declaration.json`](performance-integrated/declaration.json) | Baseline réel Site 87/native 0.54, candidat 0.55 gelé, ordre, entrées, outils, répétitions et règles |
| [`performance-integrated/owner-source-inventory.json`](performance-integrated/owner-source-inventory.json) | 51→52 propriétaires, 22→23 programmes installés par les familles ; seuls ajouts : `public_symbol_transaction` et `v6.symbol_transactions.choose` |
| `performance-integrated/owner-graphs-{baseline,candidate}.receipt.json` et rapports associés | Quatre formes fonctionnelles par version, 31 actions ; sources, entrées et générateur inchangés |
| [`performance-integrated/owner-structural-attribution.json`](performance-integrated/owner-structural-attribution.json) et [`owner-structural-fixture.json`](performance-integrated/owner-structural-fixture.json) | **64/64 contrôles**, 58 points, 35 deltas attribués, quatre formes exactes |
| [`performance-integrated/owner-growth-contract.json`](performance-integrated/owner-growth-contract.json) | Contrat préalable liant l'inventaire, les formes structurelles, les sources et les deux outils indépendants |
| [`diagnostic/final-cost-qualification-independent-review.json`](diagnostic/final-cost-qualification-independent-review.json) | **44/44 contrôles** de revue préalable, sans recalcul de temps ni nouvelle capture |

L'[agrégat qualifié](performance-integrated/owner-growth-comparison.json)
conserve **16/16 diagnostics de médiane dans le seuil** ; les
[cohortes 1](performance-integrated/cohort1/comparison.json) et
[2](performance-integrated/cohort2/comparison.json) restent chacune à **15/16**
avec `budget_review_required`. Les dépassements non résolus restent explicites :
STCK `known_prefix_guard` **+13,614846 %** dans la cohorte 1, SMLP `new_decision`
**+15,024264 %** dans la cohorte 2. Les p95 agrégés SMLP conservent
**+16,264866 %** pour `known_prefix_service`, **+12,644657 %** pour
`known_prefix_guard`, **+13,016930 %** pour `acquisition_and_persistence`.
Le rapport complet conserve aussi les autres dispersions et percentiles, sans
déduire de ces seules variations une cause propre à Symbols.

Le [refus réel de l'agrégateur historique strict](performance-integrated/aggregation-failure.json)
reste un échec de métadonnées, avec son journal et ses entrées inchangées.
La consolidation qualifiée est un verdict distinct : **432 écarts structurels**
sont comparés aux formes pré-déclarées, les autres champs et les signatures de
chaque version restant stricts. **Aucun outil, règle ou temps n'a été corrigé
après mesure.** Le [reçu de rendu](performance-integrated/results-render.json)
confirme `inputReceiptsUnchanged: true`.

Les formes STCK/SMLP préalables comptent **zéro record Symbols**. Leurs 35 deltas
sont 27 états Symbols et huit installations, sans fait, événement ou fragment
acquis supplémentaire. Le coût d'une trajectoire Symbols active comme CRAF reste
hors de cette qualification. Aucun écart constant de graphe n'est généralisé à
partir de ces seules captures.
<!-- LOT7B_EVIDENCE_COST_FINAL_END -->

<!-- LOT7B_EVIDENCE_PUBLICATION_FINAL_START -->
## Première publication native 7B : Site 88, terminée

[`publication/native-publication.json`](publication/native-publication.json)
atteste **Site 88 / native 0.55.0**, déploiement
`appgdep_6af3aeff18f08191963da329ba10b5a2` **`succeeded`**, constaté le
**10 novembre 2026 à 23:56:02.578047 UTC** (**20:56:02 UTC−03**).

| Identité ou preuve | Valeur et portée |
| --- | --- |
| Commit publié | `43ee01ba5469fd4fbffe10eb6a786fe99b1c35a7` |
| Arbre publié exact | `63299a0dfe2b0901d80b1e851d4bd0250813605e`, identique à la cible validée |
| Cible conservée comme parent direct | `93ec798a017febbeca8aec3f705bc04d9ebe26c4` |
| [`publication/source-transport.json`](publication/source-transport.json) | Reçu du transport effectif des sources |
| [`publication/source-push-plan.json`](publication/source-push-plan.json) | Plan borné conservant la cible validée et son histoire |
| [`publication/source-archive-equality.json`](publication/source-archive-equality.json) | Égalité des 75 fichiers du build entre les cinq paquets locaux ; worker validé inchangé |
| [`publication/post-publication-input-integrity.json`](publication/post-publication-input-integrity.json) | 894 reçus locaux et huit entrées externes recontrôlés après publication, tous inchangés |
| [`publication/archive-representations.json`](publication/archive-representations.json) | Empreintes des conteneurs locaux et du stockage Sites conservées séparément, sans revendication d'égalité binaire des conteneurs |

L'URL privée habituelle et l'accès **`custom`, révision 3**, restent inchangés :
**un compte autorisé, zéro groupe et zéro visiteur externe**. Les 291 fichiers
natifs, les 302 entrées de l'archive et le digest `ea256…` sont ceux du gel
validé et de la fenêtre de coût terminée.

Ces reçus et les textes mis à jour font l'objet d'une **clôture documentaire
distincte avec exactement le même build**. Son numéro et son commit seront
consignés après son résultat réel ; aucune identité future n'est prédite.
Site 88 est ici la première publication native 7B, avec les limites de preuve
fonctionnelle et de coût déjà exposées.
<!-- LOT7B_EVIDENCE_PUBLICATION_FINAL_END -->

## Historique de développement conservé

Les preuves suivantes précèdent le gel intégré 0.55. Elles partent de 7A/Site 83,
puis conservent les étapes d'intégration des publications 5A/Sites 84 et 85.

| Répertoire ou fichier | Contenu |
| --- | --- |
| `coordination/published-7a-site83.json` | Publication réelle de la base 7A |
| `coordination/published-5a-site84.json` et `published-5a-site85.json` | Publications 5A effectivement vérifiées auprès de Sites |
| `coordination/published-5a-source-verification.json` | Identité native du prédécesseur publié et conservation de la fusion examinée |
| `candidate-selection.json` | 100 observations initiales publiques, source froide, unique candidat CRAF, zéro action |
| `attempt1/source-manifest.json` | Digest du premier gel de développement : 284 fichiers natifs |
| `attempt1/source-archive.json` et parties | Octets des 295 entrées gelées et transport exact |
| `attempt1/execution-craf.json` | Campagne froide réussie : 3 niveaux, 36 actions, sources inchangées |
| `attempt1/craf-campaign.json.gz` | Rapport complet : 36 actions Symbols, états et appels réellement capturés |
| `attempt1/craf-public-trace.json.gz` | Commandes et retours publics complets, sans état privé |
| `attempt1/original/craf-public-parity.json` | 144 appels source et 432 comparaisons exactes, couverture positive non vide |
| `attempt1/original/craf-contribution.json.gz` | Acquisition active unique et ablations depuis les états originaux reconstruits |
| `attempt1/refined-original/` | Rejeu renforcé réussi des mêmes 144 appels, 36 liens ordonnés proposition/gardes/commande/retour et ablations mieux distinguées |
| `craf-case-checkpoint.json` | Suivi cumulatif du cas ; la copie finale immuable est conservée sous `integrated-final/craf-case-checkpoint-final.json` |
| `diagnostic/` | Essais de développement, contrôles ciblés et versions d'analyse conservées |

Le premier rapport ne capture pas encore un bloc `symbolAcquisition` par
préfixe. Ses états `sourceBefore/sourceAfter` et les tests Kernel prouvent leurs
contrats propres ; ils ne sont pas présentés comme une capture native complète
qui n'aurait pas eu lieu. Le helper final ajoute ce bloc de lecture seule, et le
validateur final exige les enveloppes, faits et événements effectivement retenus.
Il observe aussi le véritable appel `restoreNative`, son argument et son état de
sortie, puis lit l'état de l'instance après le préfixe. Les curseurs relient cette
restauration au dernier record, y compris au préfixe terminal. Ce renforcement
a été fixé avant le gel, puis exécuté et vérifié sur les 36 préfixes du candidat
intégré ; il ne transforme pas rétroactivement la capture de développement en
preuve de checkpoint complet.

Le validateur renforcé relie la proposition source entière aux gardes, au retour
et au checkpoint. Il réapplique le domaine de point original ; quatre annotations
nommées de l'appelant restent hors de la comparaison avec la proposition source,
mais doivent rester identiques entre garde, enregistrement et état conservé.
Une réécriture par préservation est refusée explicitement par ce validateur de
composant. Il ne revendique pas la parité de sélection de tout l'appelant Python.

`diagnostic/compare-symbol-transactions-public-parity-initial.py` conserve les
octets exacts du premier analyseur exécuté. Sa classification de quatre ablations
du compteur inclut les références de règles dans la décision ; elle ne démontre
pas quatre commandes physiques différentes. Le rejeu renforcé distingue le
choix, les changements de justification et la disparition d'une proposition,
sans réécrire ce premier résultat. Les quatre cas modifient seulement les preuves
associées à la même décision. Les méthodes restent nécessaires à 27 propositions
et la liaison courante à 18. La première exécution de ce validateur s'est arrêtée
sur une variable locale masquant les options de ligne de commande ; son script,
son exception et le rejeu corrigé sont conservés séparément.
`diagnostic/compare-symbol-transactions-public-parity-refined.py` conserve le
comparateur exact de ce rejeu réussi avant l'ajout du témoin de restauration.

Les échecs de développement restent disponibles. Le raster synthétique initial
est réellement préempté par Recall ; le test positif final de la boucle commune
emploie le raster public CRAF, sans remplacer les familles ni injecter une méthode.
Les logs de génération Interface et du propriétaire conservent les corrections
de construction d'oracle, de types readonly et de détachement local des arguments
SRC immuables. Les résultats de ce jalon sont 124 tests géométriques, 78 tests
d'interface, 73 tests du propriétaire et quatre tests Kernel, tous réussis.

L'audit de développement raccorde **57 entrées sur 76**. L'inventaire des modules
compte **176 composants vérifiés, 144 transferts partiels et 1 049 modules en
attente**, sans module entièrement vérifié. Le premier contrôle a signalé une
fixture historique Feedback non restaurée ; les fixtures Feedback et Outline
ont été reconstituées à partir de leurs parties exactes, puis le nouvel audit
ne contient aucun échec. Les deux résultats et le reçu de restauration sont
conservés. Ces premiers compteurs précèdent l'intégration effective de 5A et 4B.

Après intégration de la publication 5A/Site 84, les audits donnent **58 entrées
sur 76**, **178 composants vérifiés, 146 transferts partiels et 1 045 modules en
attente**, sans module entièrement vérifié et sans échec d'inventaire. Le digest
natif combiné sur 288 fichiers est
`4b2f3c698d73a78c79f2e7ffd9486620b2a391a69e5575d0e3d7c75e3597f7cb`.
Ces audits restent des jalons historiques ; les validations finales après
intégration de 4B sont consignées en tête de cet index.

La fusion préparatoire `2c2da44` reste dans un bundle incrémental de 21 559 octets,
avec ses prérequis et son reçu de vérification. La branche de livraison part du
prédécesseur réellement publié ; elle n'hérite pas de l'ancien objet Git 5A
surdimensionné. Les parties du bundle d'histoire original 5A et leur restaurateur
sont conservés dans les preuves 5A. Restaurer ces objets pour inspection ne
requiert pas de les fusionner dans l'ascendance de livraison.

Les rapports complets et les archives restent distincts des preuves de
publication et des verdicts de coût. Leurs statuts courants figurent dans les
sections balisées ci-dessus ; aucune réussite fonctionnelle n'anticipe leur résultat.
