# Lot 8B : qualification ciblée du raccordement commun

**Le raccordement de `parallel_branch_routing` au moteur commun est qualifié dans le périmètre déclaré : 524 tests et sous-tests réussis dans 23 modules, typage, deux audits et build passés.** Le candidat atteint **69/76 entrées (90,8 %)**, dont **26/33** entrées matérielles. La [synthèse vérifiable](validation-summary.json) relie les commandes, les inventaires et les sorties conservées.

La publication constatée reste **Site 107 / native 0.66**, source `4ff7bf45286a8a19d34401988adca587253ae41e`, à **68/76 entrées**. Le code du candidat est sauvegardé au commit `2583d81d856c13295040db88f5df8b3a99906bdc`, avec son [reçu de push vérifié](checkpoint-code-push-05.json), sur la branche propre `lot8b-branch-routing-checkpoint-20261112`. Il contient **331 fichiers natifs**, digest `76a403016d2b28287194b7498f10e14727b7e3fb3f214d2f79cb0292390d54bf`. Le littéral de développement `0.66.0` ne suffit pas à identifier ce candidat : ses sources, ses familles et ses extensions diffèrent du publié. Aucune nouvelle version de publication n’est réservée.

## Contrats intégrés et comportement

Le [contrat](../../lot8b-branch-routing.md) et la [filiation](../../lot8b-branch-routing-lineage.md) décrivent le propriétaire unique, placé dans l’ordre source `motif_access → branch_routing → band_transfer`. L’emplacement de sous-question reste nul pour ce propriétaire direct, afin d’éviter un second appel. Une acquisition sélectionnée réussie conserve l’événement source `branches:<revision>` ; aucune acquisition passive BranchRouting n’est ajoutée.

L’adaptateur copie et fige récursivement l’observation, les lignes et les entrées avant toute cession asynchrone. Les gardes utilisent ces données stables. La restauration contrôle les conditions numériques nécessaires d’un raster public de **65 536 pixels au total**, avec des vérifications de quotient avant les multiplications. Les projections historiques partielles et les états sans modèle restent distincts du modèle courant. Cette validation n’authentifie pas la provenance d’un snapshot et ne démontre pas que toute géométrie acceptée peut être produite par l’original.

Une recherche de proposition incomplète bloque les familles suivantes sans conclure à l’impossibilité d’une solution. Si une acquisition sélectionnée lève `BranchRoutingIncomplete`, le moteur conserve la commande et les paquets publics complets avant/après, marque l’acquisition non réalisée et termine. Les retours BranchRouting suivants du même préfixe restent conservés sans appeler `record` par-dessus cette lacune. Une reprise ne réessaie ni l’acquisition ni l’action. Les compteurs communs `acquiredRecords` et `acquiredTransitions` dénombrent les retours réconciliés, y compris ces marqueurs ; ils ne doivent pas être présentés comme un nombre d’événements BranchRouting acquis avec succès.

Les huit tests d’intégration commune couvrent le registre, des chaînes de calibration depuis froid, la restauration commune, la sélection et un préfixe de deux mouvements, les gardes courantes, un effet contraire, l’ablation de l’acquisition, le refus incomplet, l’isolation des entrées et l’arrêt sans relance. Ils utilisent **26 retours publics synthétiques**. Les références d’observation originales sont réattachées aux références réellement produites par le moteur commun. Le point de sélection du cas à trois barres est le centroïde commun `(6,13)`, alors que la liste manuelle du corpus de composant emploie `(7,13)` sur la même barre. La preuve ne revendique donc pas l’identité de toutes les entrées du caller original.

## Contrôles exécutés

Le [plan prospectif](plan.json), sauvegardé avant exécution au commit `b5d34121d6d1e79ae673372b5969d4883dcd9de8`, définit les 23 modules, les commandes et leurs limites de durée. Chaque tentative conserve son inventaire avant/après, son reçu et sa sortie complète compressée.

| Groupe | Résultat | Preuve |
| --- | --- | --- |
| BranchRouting, quatre modules | **281/281** : 249 référence, 17 contrat, 7 frontière publique, 8 intégration commune | [Reçu](branch-01/receipt.json) |
| Runtime commun, quinze modules | **160/160** | [Reçu](runtime-regression-01/receipt.json) |
| Propriétaires voisins, quatre modules | **83/83** | [Reçu](neighbor-regression-01/receipt.json) |
| Typage TypeScript | **Passé** | [Reçu](typecheck-01/receipt.json) |
| Audit des points d’entrée | **69/76**, parité V6 complète fausse | [Reçu](entry-audit-01/receipt.json) |
| Audit de migration, seconde tentative | **Passé**, aucun échec final | [Reçu](migration-audit-02/receipt.json) |
| Build | **Passé**, 74 artefacts avec empreintes | [Reçu](build-01/receipt.json) |

Le total est **524/524**, sans échec, annulation, test ignoré ni TODO. Les 23 modules sont distincts. Les **2 468 chemins distincts capturés** par les sept contrôles correspondent encore à leurs empreintes de clôture ; les sources natives ont le même profil dans tous les contrôles. Les deux archives historiques matérialisées plus tard sont incluses dans les inventaires du second audit de migration et du build.

L’audit final déclare **215 composants vérifiés, 147 transferts partiels, 1 007 modules en attente et zéro module entièrement vérifié**, sur 1 369 modules Python et 417 fichiers de données. Les **six portes de migration complète restent fausses**. La [revue indépendante interne](independent-review.json) porte sur l’intégration du caller et la frontière numérique de restauration ; elle n’est pas un audit externe ni une nouvelle exécution des 23 modules.

Le worker natif produit est `dist/assets/v6-agent-worker-BmtBfUWE.js`, SHA-256 `7fa86f61da1d4b4cc3e666664549eb16d4d4149aab1130f1bb373e7c07834791`. Cette empreinte atteste le build local, pas une publication.

## Échec conservé et références matérialisées

La [première tentative d’audit](migration-audit-01/receipt.json) a échoué sur deux archives anciennes absentes de ce checkout ; Feedback apparaissait deux fois dans les références de preuve. Son [rapport généré](migration-audit-01/generated-coverage.json) et sa sortie restent conservés. Les deux archives ont été recopiées depuis notre propre checkout antérieur, sans décompression ni régénération, après vérification contre le reçu historique passant de 8A. La [preuve de matérialisation](reference-materialization.json) précise les tailles, empreintes et parties Git correspondantes.

Les gzip complets restent ignorés comme prévu par le dépôt. Leurs fichiers `.parts.json`, `.part000` et `.part001` sont déjà suivis dans Git et reproduisent exactement leurs octets. Dans un checkout neuf, la préparation existante peut les matérialiser avant l’audit :

```bash
python scripts/evidence-byte-parts.py restore tests/fixtures
```

Cette commande traite les manifests de tout le répertoire, restaure les originaux manquants et refuse un original divergent. Elle n’a pas été exécutée pendant ce jalon ; les deux seules copies nécessaires et leur vérification opaque sont consignées. Aucun payload de jeu ni oracle n’a été exécuté pour cette réparation. Le passage historique de 5 606 tests atteste la provenance antérieure de ces archives et n’est pas ajouté aux 524 tests frais.

## Limites et prochaine étape

La parité de composant demeure limitée au corpus indépendant annoncé : 37 observations, 20 cas géométriques, 12 scénarios et 83 opérations originales. Ce corpus n’a pas été régénéré. Les 249 comparaisons de référence sont incluses dans les 524 tests ; les populations ne sont pas additionnées une seconde fois. Aucune nouvelle campagne générale, réussite de jeu, mesure officielle ou publication n’est revendiquée. Les plafonds d’énumération ne bornent pas le coût total des géométries, copies, digests et historiques conservés.

La [feuille de route](../../v6-delivery-roadmap.md) poursuit la qualification de livraison : régressions et campagne intégrée pertinentes, formes de travail et graphes réellement exécutés avec attribution de contribution, puis coût contre le prédécesseur effectivement publié et publication avec une version propre. Le coût 8B reste **non mesuré et non accepté**. La médiane des sessions complètes doit augmenter de **moins de +10 % pour STCK et pour SMLP séparément**. Une phase au-dessus de +10 % peut être acceptée si les deux critères globaux passent, sans compensation entre jeux ; tous les échantillons restent conservés.

Développement, tests fonctionnels, commits et push ont lieu sur notre branche et notre checkout, sans verrou global ni attente des autres lots. Les futures mesures officielles et la publication seules conservent une exclusivité courte. Aucun verrou n’a été acquis ou supprimé pour ce jalon. **LKEY demeure définitivement fermé.**
