# Lot 10B : protocole de coût de native 0.62.0

Déclaration finalisée le **2026-11-11T12:36:53.648813-03:00**, après vérification des gels et avant toute fenêtre officielle de ce lot. La préparation n'exécute aucune mesure. Le [reçu de préparation](preparation.json) et la [déclaration](declaration.json) lient les identités réellement vérifiées. La readiness et l'isolation de la machine sont établies séparément par le responsable de livraison.

## Sources comparées

| Rôle | Identité | Digest natif |
| --- | --- | --- |
| A : référence publiée à remesurer | Site **98**, native **0.61.0**, commit `653e40a4f45df8ec8c6bda005004c7cdb8df074a`, 306 fichiers | `f8d5097ab63a1c7464479afc5772724ee26578916a4f22a643a5f08f65c27279` |
| B : candidat gelé | Native **0.62.0**, 310 fichiers, archive de 768 fichiers | `74143a7a8f7e1d434a9284b34665f30f9c2b0d8d68191d9405b3af7d39815d12` |

A utilise `/workspace/sites/sra-lot10b-baseline061-20261111/.sites-checkout` ; B utilise `/workspace/sites/sra-lot10b-recovery-20261111/.sites-checkout`. L'[inventaire A](../baseline-061/source-manifest.json), l'[inventaire B](../integrated-final-02/source-manifest.json) et l'[archive B](../integrated-final-02/source-archive.json) sont vérifiés sur leurs octets. Le commit d'ascendance de l'archive B est `4e7e4742b997128346e84f62b7a4fb8b5d4e47c5` ; le HEAD local relevé est `9ef8eec3d899bfb12b9f0b5cbc42e83b6820b991`. Lorsque des sources natives ne sont pas encore commitées, le digest et l'archive identifient le candidat : ce HEAD ne devient pas artificiellement le commit de ces modifications. Le numéro de Site A est fourni par le responsable ; ce helper ne consulte pas l'hébergement.

Les [cas](cases.json) et la [politique diagnostique de phases](comparison-policy.json) sont copiés **octet pour octet** depuis `lot3h-evidence/performance`. Empreintes : `487e4cf2be5415855af688c6b03be90ffc8b57c29ae0abfe7bef4b340af15a6d` et `5ca681d721d510892cd957d2bde0074e5ea3410b02cfccd7ab43139c99a7af68`. Leur texte historique conserve sa provenance ; les identités de cette fenêtre sont celles de la présente déclaration. Les anciens temps ne sont pas réutilisés.

| Jeu | Actions par session mesurée | Actions de chauffe | Trace publique | SHA-256 |
| --- | ---: | ---: | --- | --- |
| STCK | 10 | 3 | `docs/migration/native-campaigns-v39/stck-public-trace.json.gz` | `4610327ca5c6b67e3a42983cc55b40eab3d5aa858a185d8e81f753ba2bcb7e6b` |
| SMLP | 15 | 3 | `docs/migration/native-campaigns-v57/final/smlp-public-trace.json.gz` | `325ff611d1f80d0c07ce2c4ee8af707297a918d505db607c35cf411db9753de9` |

Le moteur recalcule chaque commande avant de recevoir son retour enregistré. Aucun état appris ni trajet ne préinitialise la décision. Ces parcours mesurent le chemin commun ; ils n'établissent pas la contribution propre de la famille WindowQuestion et ne fournissent pas une mesure du moteur de jeu, du réseau de production ou du rendu navigateur.

## Effectifs et ordre fixés

| Ordre | Série | Version | Sessions mesurées par jeu |
| --- | --- | --- | ---: |
| 1 | A1, cohorte 1 | Référence 0.61.0 | 4 |
| 2 | B1, cohorte 1 | Candidat 0.62.0 | 4 |
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
| Politique globale | `5e4d353034b587ecc95f790772a57e2d811ad5cf1f79fad64d018c0f73435812` |
| `review-native-global-cost-window.py` | `9ab2ecd9d6ddf234e96332421a6e55937a766495c1a20dd223f4441d6b516940` |
| `review-native-global-cost-budget.py` | `b4312bcdae058ba58c16b4e5e24cb53626496b38f8a154834e0452a43e97d341` |

Le runner vérifie les inventaires, les traces, les déclarations source et les outils avant chaque série et à la fin. Le registre de sessions est comparé avec multiplicité préservée ; l'ordre A1/B1/B2/A2 est contrôlé séparément. Les sorties existantes ne sont pas écrasées.

**Conditions à établir par le responsable avant lancement :** finir les tests, exports, builds, campagnes, rejeux, profils, archives et contrôles navigateur ; arrêter le preview ; vérifier l'absence de campagne concurrente des autres fils ; lier les preuves et les réserves réelles au gel final dans `readiness.json`. Ces conditions ne sont pas déclarées satisfaites par le présent helper. Durant les quatre séries, seules les lectures légères et la documentation sont compatibles avec la fenêtre isolée ; les sources, tests, outils, cas et politiques restent immuables.

Les preuves de composant, de boucle commune, de contribution effective, de restauration et d'intégrité restent distinctes du verdict de coût. Un blocage de jeu ou une réserve de parité doit demeurer explicite dans la readiness. Aucun succès, délai de Pause, état de publication ou résultat de campagne n'est anticipé ici.

## Commandes à exécuter par le responsable

Après readiness et isolation constatées, lancer le runner conservé :

```bash
flock -x /workspace/shared/sra-coordination/performance.lock python -B scripts/run-native-cost-window.py /workspace/sites/sra-lot10b-baseline061-20261111/.sites-checkout docs/migration/lot10b-evidence/recovery-20261111/performance-integrated-01 docs/migration/lot10b-evidence/recovery-20261111/baseline-061/source-manifest.json docs/migration/lot10b-evidence/recovery-20261111/integrated-final-02/source-manifest.json
```

Après les quatre séries, produire les deux comparaisons de paires à partir des
quatre rapports bruts conservés par le runner. Le comparateur de paires reste
inchangé et conserve tous ses diagnostics de phase :

```bash
node scripts/compare-native-loop-costs.mjs docs/migration/lot10b-evidence/recovery-20261111/performance-integrated-01/comparison-policy.json docs/migration/lot10b-evidence/recovery-20261111/performance-integrated-01/cohort1/baseline.json docs/migration/lot10b-evidence/recovery-20261111/performance-integrated-01/cohort1/after.json docs/migration/lot10b-evidence/recovery-20261111/performance-integrated-01/cohort1/comparison.json
node scripts/compare-native-loop-costs.mjs docs/migration/lot10b-evidence/recovery-20261111/performance-integrated-01/comparison-policy.json docs/migration/lot10b-evidence/recovery-20261111/performance-integrated-01/cohort2/baseline.json docs/migration/lot10b-evidence/recovery-20261111/performance-integrated-01/cohort2/after.json docs/migration/lot10b-evidence/recovery-20261111/performance-integrated-01/cohort2/comparison.json
```

Exécuter ensuite l'agrégateur historique inchangé sur les rapports bruts et les
deux comparaisons de paires. Conserver son véritable journal, ses entrées,
son code de sortie et l'absence éventuelle de sortie dans `aggregation-failure.json`
et `aggregation-failure.log`. Le reçu doit décrire l'exécution réelle, sans
fabriquer un refus ou traiter le contrôle strict comme réussi :

```bash
node scripts/compare-native-cost-cohorts.mjs docs/migration/lot10b-evidence/recovery-20261111/performance-integrated-01/comparison-policy.json docs/migration/lot10b-evidence/recovery-20261111/performance-integrated-01/cohort1/baseline.json docs/migration/lot10b-evidence/recovery-20261111/performance-integrated-01/cohort1/after.json docs/migration/lot10b-evidence/recovery-20261111/performance-integrated-01/cohort1/comparison.json docs/migration/lot10b-evidence/recovery-20261111/performance-integrated-01/cohort2/baseline.json docs/migration/lot10b-evidence/recovery-20261111/performance-integrated-01/cohort2/after.json docs/migration/lot10b-evidence/recovery-20261111/performance-integrated-01/cohort2/comparison.json docs/migration/lot10b-evidence/recovery-20261111/performance-integrated-01/combined-comparison.json
```

Le contrat complémentaire requiert le refus strict précis de métadonnées de
travail. Si l'agrégateur réussit, échoue pour un autre motif, ou produit une sortie,
ce chemin complémentaire bloque ; le responsable doit examiner le résultat.
Après conservation du refus attendu, les deux analyseurs indépendants produisent
l'agrégat qualifié et sa revue :

```bash
node docs/migration/lot10b-evidence/consolidate-owner-costs.mjs /workspace/sites/sra-lot10b-baseline061-20261111/.sites-checkout docs/migration/lot10b-evidence/recovery-20261111/performance-integrated-01/owner-growth-contract.json docs/migration/lot10b-evidence/recovery-20261111/performance-integrated-01/owner-growth-comparison.json
python -B docs/migration/lot10b-evidence/review-owner-costs.py /workspace/sites/sra-lot10b-baseline061-20261111/.sites-checkout docs/migration/lot10b-evidence/recovery-20261111/performance-integrated-01/owner-growth-contract.json docs/migration/lot10b-evidence/recovery-20261111/performance-integrated-01/owner-growth-comparison.json docs/migration/lot10b-evidence/recovery-20261111/performance-integrated-01/owner-growth-review.json
```

Le rapport final conserve le refus historique, tous les temps bruts, les
diagnostics de phase, la décision globale et les réserves. Une revue arithmétique
réussie n'est pas une acceptation de coût si son verdict global est faux.

## Consolidation complémentaire déclarée avant mesure : propriétaire ajouté

Cette fenêtre ajoute le propriétaire `public_window_question` et son programme
`v6.window_question.choose`. L'identité intégrale des compteurs de graphe entre
les deux versions n'est donc pas une prémisse de cette analyse complémentaire.
Le contrôle historique reste exécuté et son refus, son journal complet et ses
entrées sont conservés séparément. Il n'est jamais reclassé comme réussi.

Le contrat fermé `docs/migration/lot10b-evidence/recovery-20261111/performance-integrated-01/owner-growth-contract.json` sera finalisé après la
présente déclaration et avant le préflight, la readiness et toute mesure. Il lie
les sources et l'inventaire réel des propriétaires et programmes. Ses seules
différences structurelles admissibles sont `observations[*].nodeCount`,
`inspection[*].graphNodes`, `final.nodeCount` et `final.graphRevision`.
Les valeurs attendues proviennent de captures fonctionnelles sans mesure de
coût, réalisées sur les deux gels avant cette fenêtre : STCK et SMLP, chacun
en forme chauffe puis session complète. La fixture fermée lie leurs graphes,
leurs trois inspections terminales pour les sessions complètes, l'attribution
des nouveaux nœuds WindowQuestion et les sources correspondantes. Elle distingue
les nœuds installés des faits acquis par `recordSource`, utilisé par les chemins
actif et passif. Elle lie `window_question_event:<revision>`, `window_question_state`,
les six champs source `epoch`, `edits`, `portable`, `launches`, `attempts`, `last`,
et le prédicat source `edits || portable || attempts`. Les seuls paquets animés
ou le dernier reçu ne déclenchent pas cette publication. À une frontière mesurable,
le transfert de méthodes conserve les lancements observés et l'autorité
`method_only_not_current_permit`, puis réinitialise les champs du nouvel epoch.
Un premier cadre non mesurable conserve le retour source nul ; aucune attribution
d'effet mécanique ni remise à zéro supplémentaire n'est inventée. L'origine de chaque fragment commun
et l'ordre des deltas communs doivent rester exacts ; aucun assouplissement de
création anticipée par le nouveau propriétaire n'est présumé. Aucune formule
constante de croissance du graphe n'est supposée.

Chaque session future est vérifiée contre les valeurs publiques exactes de sa
forme pré-déclarée ; les compteurs de coût ne prétendent pas exposer ses feuilles
privées. Chaque valeur A/B et chaque différence sont conservées, chauffes
comprises. Tout écart à cette fixture ou à un autre champ de travail bloque la
consolidation. Les signatures complètes restent identiques à l'intérieur de
chaque version. La fixture, son attribution et les deux outils sont figés avant
le préflight et toute mesure ; aucun rapport de coût futur ne sert à les définir.

| Outil complémentaire | SHA-256 pré-déclaré |
| --- | --- |
| `docs/migration/lot10b-evidence/consolidate-owner-costs.mjs` | `bb954e5fac683e27c4176fa693b69861340136da9f77c4e477c2291722ff0c71` |
| `docs/migration/lot10b-evidence/review-owner-costs.py` | `e879fb58868fa753936ae1cdf8eb8801f66371e660404253439560d5af25558c` |

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

## Outils de préparation et de qualification figés avant capture

| Outil | SHA-256 |
| --- | --- |
| `docs/migration/lot10b-evidence/prepare-cost-protocol.py` | `4cd4f53e68b65ba61982010f4d148acf238f70560afa3a8aae3f6bef5ea69c1f` |
| `docs/migration/lot10b-evidence/prepare-owner-cost-contract.py` | `2b20558afbefc9082b5968fc2f6ab5cb523527c9f9cf4f9558d4c4bce1a5c7e1` |
| `docs/migration/lot10b-evidence/check-cost-static-inputs.py` | `e49e114e05eaef3d2e50bd6dc455ae4db58e0250d2e2b15273d5d7687d4c2568` |
| `docs/migration/lot10b-evidence/record-owner-source-inventory.mjs` | `3769e1e3ce2dd9238d6d621bdbe04cd0dd95b9de90b1f4d9fbdc6edc77954613` |
| `docs/migration/lot10b-evidence/capture-cost-owner-graphs.mjs` | `d0a6d94571ebdbc62c9caef22aef76ecdcd25a6a08054305a728dc9e2996baa4` |
| `docs/migration/lot10b-evidence/qualify-cost-owner-graphs.mjs` | `9b6d83c8c1c392f3c3a9f2d901e41b87891f8becc4f7e0614aaae04539cd8703` |
