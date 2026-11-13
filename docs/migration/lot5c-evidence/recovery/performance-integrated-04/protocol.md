# Lot 5C : protocole de coût de native 0.63.0

Déclaration finalisée le **2026-11-11T17:52:06.585050-03:00**, après vérification des gels et avant toute fenêtre officielle de ce lot. La préparation n'exécute aucune mesure. Le [reçu de préparation](preparation.json) et la [déclaration](declaration.json) lient les identités réellement vérifiées. La readiness et l'isolation de la machine sont établies séparément par le responsable de livraison.

## Sources comparées

| Rôle | Identité | Digest natif |
| --- | --- | --- |
| A : référence publiée à remesurer | Site **102**, native **0.62.0**, commit `1019d2eb929d7dc201a5c1f6edce5aa1c5dfa464`, 310 fichiers | `74143a7a8f7e1d434a9284b34665f30f9c2b0d8d68191d9405b3af7d39815d12` |
| B : candidat gelé | Native **0.63.0**, 318 fichiers, archive de 867 fichiers | `a33a5f88f3fe0034930b2056239889bed6fab662424fc84a141a5f9a28db9e57` |

A utilise `/workspace/sites/sra-lot5c-baseline-site102-1019d2e/.sites-checkout` ; B utilise `/workspace/sites/sra-lot5c-recovery-20261111/.sites-checkout`. L'[inventaire A](../../../lot10b-evidence/recovery-20261111/integrated-final-02/source-manifest.json), l'[inventaire B](../integrated-final-01/source-manifest.json) et l'[archive B](../integrated-final-01/source-archive.json) sont vérifiés sur leurs octets. Le commit d'ascendance de l'archive B est `805b30297dc1b715dbfd9f1197a9a8ba7b361b90` ; le HEAD local relevé est `37f3dabeaf8807045effb81cc3437da53f10ee97`. Lorsque des sources natives ne sont pas encore commitées, le digest et l'archive identifient le candidat : ce HEAD ne devient pas artificiellement le commit de ces modifications. Le numéro de Site A est fourni par le responsable ; ce helper ne consulte pas l'hébergement.

Les [cas](cases.json) et la [politique diagnostique de phases](comparison-policy.json) sont copiés **octet pour octet** depuis `lot3h-evidence/performance`. Empreintes : `487e4cf2be5415855af688c6b03be90ffc8b57c29ae0abfe7bef4b340af15a6d` et `5ca681d721d510892cd957d2bde0074e5ea3410b02cfccd7ab43139c99a7af68`. Leur texte historique conserve sa provenance ; les identités de cette fenêtre sont celles de la présente déclaration. Les anciens temps ne sont pas réutilisés.

| Jeu | Actions par session mesurée | Actions de chauffe | Trace publique | SHA-256 |
| --- | ---: | ---: | --- | --- |
| STCK | 10 | 3 | `docs/migration/native-campaigns-v39/stck-public-trace.json.gz` | `4610327ca5c6b67e3a42983cc55b40eab3d5aa858a185d8e81f753ba2bcb7e6b` |
| SMLP | 15 | 3 | `docs/migration/native-campaigns-v57/final/smlp-public-trace.json.gz` | `325ff611d1f80d0c07ce2c4ee8af707297a918d505db607c35cf411db9753de9` |

Le moteur recalcule chaque commande avant de recevoir son retour enregistré. Aucun état appris ni trajet ne préinitialise la décision. Ces parcours mesurent le chemin commun ; ils n'établissent pas la contribution propre de la liaison d’objets et ne fournissent pas une mesure du moteur de jeu, du réseau de production ou du rendu navigateur.

## Effectifs et ordre fixés

| Ordre | Série | Version | Sessions mesurées par jeu |
| --- | --- | --- | ---: |
| 1 | A1, cohorte 1 | Référence 0.62.0 | 4 |
| 2 | B1, cohorte 1 | Candidat 0.63.0 | 4 |
| 3 | B2, cohorte 2 | Même candidat gelé | 4 |
| 4 | A2, cohorte 2 | Même référence publiée | 4 |

Chaque série exécute STCK puis SMLP avec un worker distinct par jeu. La chauffe séparée comprend trois actions ; chaque session mesurée commence avec un runtime neuf et une mémoire froide. Le processus et le JIT sont conservés au sein du cas/série. La cible déclarée de trois niveaux ne transforme pas les dix actions STCK en trois niveaux effectivement terminés.

La fenêtre conserve **32 sessions mesurées et 400 actions**, soit huit sessions par jeu/version. Seules **8 chauffes et leurs 24 actions** sont exclues. Aucune session mesurée, valeur extrême ou cohorte n'est supprimée. Les quatre séries sont conservées indépendamment du verdict intermédiaire. Aucun choix de cohorte favorable, aucune marge de bruit et aucune réécriture d'une fenêtre défavorable ne sont permis. Un incident conserve ses sorties ; une correction de source exige un nouveau gel et une déclaration distincte.

## Critère global et phases

L'autorisation utilisateur retenue est : « si le global reste en dessous de 10% d'augmentation alors une phase qui dépasse 10% peut être accepté. » La [politique globale](global-budget-policy.json) fixe son interprétation avant la mesure.

Pour **chaque jeu séparément**, réunir les huit durées complètes A et les huit durées B de `session_elapsed`, puis calculer `médiane(B) / médiane(A) − 1`. L'acceptation exige une hausse **strictement inférieure à +10 % pour les deux jeux**. Une égalité à +10 % échoue. Un jeu ne compense pas un autre, les ratios de cohorte ne sont pas moyennés et les phases imbriquées ne sont jamais additionnées.

Un dépassement de phase peut être accepté lorsque ce critère global est satisfait. Il reste visible, avec tous les diagnostics de cohorte, effectifs, dispersions et p95 disponibles. Le comparateur historique de phases conserve ses statuts, y compris `budget_review_required`, et ses seize diagnostics. La décision globale est un reçu distinct ; elle ne modifie aucun résultat de phase.

| Mesure | Portée | Rôle |
| --- | --- | --- |
| `session_elapsed` | Session complète de rejeu par le contrôleur | Critère global par jeu |
| `new_decision` | Appel `plan` | Diagnostic |
| `known_prefix_service` | Service `advance` retournant une action du préfixe | Diagnostic |
| `known_prefix_request` | Même requête, transport worker et ordonnancement inclus | Diagnostic |
| `known_prefix_guard` | Appel `authorize` à un index supérieur à zéro | Diagnostic |
| `acquisition_and_persistence` | Appel `seal` | Diagnostic |
| `persistence` | Appel `persistFamilies` | Diagnostic |
| `restoration` | Appel `restoreFamilies` | Diagnostic |

La médiane est centrale, ou la moyenne des deux valeurs centrales. Le p95 utilise le rang empirique `ceil(0.95 × n)` lorsque `n ≥ 20`. Aucun p95 n'est annoncé pour huit durées de session. Les observations d'une même session sont corrélées ; leur dispersion est descriptive et n'ajoute ni intervalle de confiance ni tolérance d'acceptation. L'inspection, la Pause et la mémoire restent consignées séparément.

## Intégrité, outils et conditions de lancement

Les cinq outils historiques de fenêtre, mesure, comparaison et consolidation, ainsi que les deux outils globaux, sont inchangés. Leurs empreintes sont comparées à la déclaration conservée de 3H. Le protocole engage explicitement les empreintes suivantes :

| Entrée | SHA-256 |
| --- | --- |
| Politique globale | `24a2bf59eeaa442e0ce4704d4aeee3f2d09ac564273be9886a37aabe82eef4ba` |
| `review-native-global-cost-window.py` | `9ab2ecd9d6ddf234e96332421a6e55937a766495c1a20dd223f4441d6b516940` |
| `review-native-global-cost-budget.py` | `b4312bcdae058ba58c16b4e5e24cb53626496b38f8a154834e0452a43e97d341` |

Le runner vérifie les inventaires, les traces, les déclarations source et les outils avant chaque série et à la fin. Le registre de sessions est comparé avec multiplicité préservée ; l'ordre A1/B1/B2/A2 est contrôlé séparément. Les sorties existantes ne sont pas écrasées.

**Conditions à établir par le responsable avant lancement :** finir les tests, exports, builds, campagnes, rejeux, profils, archives et contrôles navigateur ; arrêter le preview ; vérifier l'absence de campagne concurrente des autres fils ; lier les preuves et les réserves réelles au gel final dans `readiness.json`. Ces conditions ne sont pas déclarées satisfaites par le présent helper. Durant les quatre séries et jusqu’à la libération explicite après les comparaisons et la revue, tous les traitements et agents des voies actives restent arrêtés, sans commande en attente. Seules les petites métadonnées de coordination explicitement nommées peuvent être consultées ; aucune lecture ou modification de source ou de documentation, recherche récursive, opération Git, empreinte, archive, compilation, test, rejeu, jeu ou navigateur n’est exécutée. Les sources, tests, outils, cas et politiques restent immuables. Chaque voie et ses travailleurs fournissent un accusé frais pour l’identifiant exact de cette fenêtre ; tout écart réel est conservé et signalé.

Les preuves de composant, de boucle commune, de contribution effective, de restauration et d'intégrité restent distinctes du verdict de coût. Un blocage de jeu ou une réserve de parité doit demeurer explicite dans la readiness. Aucun succès, délai de Pause, état de publication ou résultat de campagne n'est anticipé ici.

## Commandes à exécuter par le responsable

Après readiness et isolation constatées, lancer le runner conservé :

```bash
python -B scripts/run-native-cost-window.py /workspace/sites/sra-lot5c-baseline-site102-1019d2e/.sites-checkout docs/migration/lot5c-evidence/recovery/performance-integrated-04 docs/migration/lot10b-evidence/recovery-20261111/integrated-final-02/source-manifest.json docs/migration/lot5c-evidence/recovery/integrated-final-01/source-manifest.json
```

Après les quatre séries, exécuter les comparateurs historiques sur les deux cohortes puis sur leur agrégat. Conserver leurs statuts diagnostiques, puis produire les revues :

```bash
python -B scripts/review-native-cost-consolidation.py docs/migration/lot5c-evidence/recovery/performance-integrated-04
python -B scripts/review-native-global-cost-window.py docs/migration/lot5c-evidence/recovery/performance-integrated-04/combined-comparison.json docs/migration/lot5c-evidence/recovery/performance-integrated-04/declaration.json docs/migration/lot5c-evidence/recovery/performance-integrated-04/global-budget-decision.json --lot 5C --native-version 0.63.0
```

Après conservation des reçus de readiness, contrôle statique et transport des journaux, `write-cost-results.py` rend les résultats sans lancer de mesure ni choisir d'échantillon.

## Consolidation complémentaire déclarée avant mesure : propriétaire ajouté

Pour cette fenêtre avec `ownerCostQualification`, les commandes historiques
présentées plus haut conservent le rôle de diagnostic strict. Si ce comparateur
refuse réellement la structure ajoutée, son reçu et son journal sont conservés,
puis la consolidation et la revue complémentaires suivantes portent la décision :

```sh
node docs/migration/lot5c-evidence/consolidate-owner-costs.mjs docs/migration/lot5c-evidence/recovery/performance-integrated-04/owner-growth-contract.json docs/migration/lot5c-evidence/recovery/performance-integrated-04/owner-growth-comparison.json
python -B docs/migration/lot5c-evidence/review-owner-costs.py docs/migration/lot5c-evidence/recovery/performance-integrated-04/owner-growth-contract.json docs/migration/lot5c-evidence/recovery/performance-integrated-04/owner-growth-comparison.json docs/migration/lot5c-evidence/recovery/performance-integrated-04/owner-growth-review.json
```

Les revues historiques sur `combined-comparison.json` exigent que ce fichier
ait réellement été produit. La branche complémentaire utilise exclusivement
`owner-growth-comparison.json` et `owner-growth-review.json`, y compris pour
le rendu de sa décision globale. Les reçus relient la commande stricte réellement
exécutée, ses entrées, son code de sortie et son journal complet.
Aucun échec ni succès futur n'est fabriqué pour choisir une branche.

Cette fenêtre ajoute le propriétaire `public_observed_binding` et son programme
source `v6.observed_binding.choose`, déjà compilé dans les déclarations originales
mais nouvellement installé par cette famille. L'identité intégrale des compteurs de graphe entre
les deux versions n'est donc pas une prémisse de cette analyse complémentaire.
Le contrôle historique reste exécuté et son refus, son journal complet et ses
entrées sont conservés séparément. Il n'est jamais reclassé comme réussi.

Le contrat fermé `docs/migration/lot5c-evidence/recovery/performance-integrated-04/owner-growth-contract.json` sera finalisé après la
présente déclaration et avant le préflight, la readiness et toute mesure. Il lie
les sources et l'inventaire réel des propriétaires et programmes. Ses seules
différences structurelles admissibles sont `observations[*].nodeCount`,
`inspection[*].graphNodes`, `final.nodeCount` et `final.graphRevision`.
Les valeurs attendues proviennent de captures fonctionnelles sans mesure de
coût, réalisées sur les deux gels avant cette fenêtre : STCK et SMLP, chacun
en forme chauffe puis session complète. La fixture fermée lie leurs graphes,
leurs trois inspections terminales pour les sessions complètes, l'attribution
des nouveaux nœuds de liaison d’objets et les sources correspondantes. Elle distingue
les nœuds installés, les changements d'état de proposition/portée et les faits
acquis sur les retours passifs réels. Le domaine fonctionnel déclaré est
`passive_nonadmitted_source_binding` : aucune admission, aucun noyau ni méthode
acquise, aucune mutation d’attention et aucune acquisition incomplète. Les
retours restent nuls hors frontière ; la frontière conserve exclusivement son
événement source exact. La capture et l’attribution vérifient ces conditions
avant toute mesure. Un retour sélectionné ne doit jamais être acquis à nouveau
en passif. Les compteurs viennent des appels
réellement capturés. Aucune formule constante de
croissance du graphe n'est supposée.

Le reçu de domaine `docs/migration/lot5c-evidence/recovery/coordination/cost-domain-source-review.json` est lié par
SHA-256 `ad027c2327b0b073c75deaa48cd9d27e90e5909066beb78a94973d706565f626`. La liste canonique des onze
sources `docs/migration/lot5c-evidence/recovery/coordination/cost-source-evidence-paths.json` est liée par SHA-256
`4960a996175c03c0ce92365bda7f3dcaf747f1c7fd8467e34a84584816a87b62`. Ces deux empreintes et
l'objet exact du domaine figurent dans le contrat avant la fenêtre. La couverture
relie chaque retour acquis, dans l'ordre, à l'éventuel fait source non nul de sa
frontière ; un passif nul n'autorise aucun fait supplémentaire.

Chaque session future est vérifiée contre les valeurs publiques exactes de sa
forme pré-déclarée ; les compteurs de coût ne prétendent pas exposer ses feuilles
privées. Chaque valeur A/B et chaque différence sont conservées, chauffes
comprises. Tout écart à cette fixture ou à un autre champ de travail bloque la
consolidation. Les signatures complètes restent identiques à l'intérieur de
chaque version. La fixture, son attribution et les deux outils sont figés avant
le préflight et toute mesure ; aucun rapport de coût futur ne sert à les définir.

L'accès aux entrées absolues de l'attribution est déclaré dès ces outils :
chaque entrée doit être exactement fingerprintée dans le reçu de capture
baseline pré-déclaré et se résoudre réellement dans son checkout gelé, lequel
doit être celui de la fenêtre. Les lecteurs généraux restent locaux. Cette
adaptation d'E/S précède la mesure 5C et ne repose sur aucun reçu de correction
post-mesure. Les données brutes ne sont ni normalisées ni réécrites.

| Outil complémentaire | SHA-256 pré-déclaré |
| --- | --- |
| `docs/migration/lot5c-evidence/consolidate-owner-costs.mjs` | `69957840c81d50e3d7b68dedf4293b5aa9c4072f882fe1fc858f5e03815330b7` |
| `docs/migration/lot5c-evidence/review-owner-costs.py` | `452ccf903970230f5855458cd35f2f3f30224307026663ebd865b494986371df` |

Le consolidateur JavaScript et le reviewer Python recalculent indépendamment
les mêmes métriques à partir de toutes les durées brutes. Les 32 sessions,
400 actions, huit chauffes et 24 actions exclues restent inchangées. Aucun temps
n'est corrigé pour le travail supplémentaire du graphe. Le seuil global reste
strictement inférieur à +10 % pour chaque jeu, sans compensation.

Les nouveaux schémas et fichiers séparent l'agrégat complémentaire, sa revue et
sa décision globale du refus historique. Le rendu doit montrer les deux
résultats. Il ne peut déduire une acceptation des seuls rapports de paires.
La readiness lie les empreintes du contrat, du préflight et des deux outils ;
leur identité et leur antériorité sont revérifiées après la fenêtre.
