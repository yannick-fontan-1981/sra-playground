# Lot 7B : protocole de coût de native 0.61.0

Déclaration finalisée le **2026-11-11T12:04:22.799564-03:00**, après vérification des gels et avant toute fenêtre officielle de ce lot. La préparation n'exécute aucune mesure. Le [reçu de préparation](preparation.json) et la [déclaration](declaration.json) lient les identités réellement vérifiées. La readiness et l'isolation de la machine sont établies séparément par le responsable de livraison.

## Sources comparées

| Rôle | Identité | Digest natif |
| --- | --- | --- |
| A : référence publiée à remesurer | Site **97**, native **0.60.0**, commit `98336fba4e696a51c90ff7f7b37b8bdf95f34847`, 306 fichiers | `ea2b52283409971cf6ce73b8b7970576651bfb3c78a681fc741a13f432050229` |
| B : candidat gelé | Native **0.61.0**, 306 fichiers, archive de 317 fichiers | `f8d5097ab63a1c7464479afc5772724ee26578916a4f22a643a5f08f65c27279` |

A utilise `/workspace/sites/sra-lot7-baseline6a-recovery-20261111` ; B utilise `/workspace/sites/sra-lot7-followup-recovery-20261111/.sites-checkout`. L'[inventaire A](../../../lot6a-evidence/integrated-final-02/source-manifest.json), l'[inventaire B](../integrated-final/source-manifest.json) et l'[archive B](../integrated-final/source-archive.json) sont vérifiés sur leurs octets. Le commit d'ascendance de l'archive B est `21bf20adae7f80726d9414cb57495c003674fb54` ; le HEAD local relevé est `e6fb44d0930bb9a0afe78bbc80c5f5dde9334dc7`. Lorsque des sources natives ne sont pas encore commitées, le digest et l'archive identifient le candidat : ce HEAD ne devient pas artificiellement le commit de ces modifications. Le numéro de Site A est fourni par le responsable ; ce helper ne consulte pas l'hébergement.

Les [cas](cases.json) et la [politique diagnostique de phases](comparison-policy.json) sont copiés **octet pour octet** depuis `lot3h-evidence/performance`. Empreintes : `487e4cf2be5415855af688c6b03be90ffc8b57c29ae0abfe7bef4b340af15a6d` et `5ca681d721d510892cd957d2bde0074e5ea3410b02cfccd7ab43139c99a7af68`. Leur texte historique conserve sa provenance ; les identités de cette fenêtre sont celles de la présente déclaration. Les anciens temps ne sont pas réutilisés.

| Jeu | Actions par session mesurée | Actions de chauffe | Trace publique | SHA-256 |
| --- | ---: | ---: | --- | --- |
| STCK | 10 | 3 | `docs/migration/native-campaigns-v39/stck-public-trace.json.gz` | `4610327ca5c6b67e3a42983cc55b40eab3d5aa858a185d8e81f753ba2bcb7e6b` |
| SMLP | 15 | 3 | `docs/migration/native-campaigns-v57/final/smlp-public-trace.json.gz` | `325ff611d1f80d0c07ce2c4ee8af707297a918d505db607c35cf411db9753de9` |

Le moteur recalcule chaque commande avant de recevoir son retour enregistré. Aucun état appris ni trajet ne préinitialise la décision. Ces parcours mesurent le chemin commun ; ils n'établissent pas la contribution propre des transactions symboliques et ne fournissent pas une mesure du moteur de jeu, du réseau de production ou du rendu navigateur.

## Effectifs et ordre fixés

| Ordre | Série | Version | Sessions mesurées par jeu |
| --- | --- | --- | ---: |
| 1 | A1, cohorte 1 | Référence 0.60.0 | 4 |
| 2 | B1, cohorte 1 | Candidat 0.61.0 | 4 |
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
| Politique globale | `1b1115a4789e60b481843d57fd0afa240c6c9ae81e4619d04248f025f43e4fb8` |
| `review-native-global-cost-window.py` | `9ab2ecd9d6ddf234e96332421a6e55937a766495c1a20dd223f4441d6b516940` |
| `review-native-global-cost-budget.py` | `b4312bcdae058ba58c16b4e5e24cb53626496b38f8a154834e0452a43e97d341` |

Le runner vérifie les inventaires, les traces, les déclarations source et les outils avant chaque série et à la fin. Le registre de sessions est comparé avec multiplicité préservée ; l'ordre A1/B1/B2/A2 est contrôlé séparément. Les sorties existantes ne sont pas écrasées.

**Conditions à établir par le responsable avant lancement :** finir les tests, exports, builds, campagnes, rejeux, profils, archives et contrôles navigateur ; arrêter le preview ; vérifier l'absence de campagne concurrente des autres fils ; lier les preuves et les réserves réelles au gel final dans `readiness.json`. Ces conditions ne sont pas déclarées satisfaites par le présent helper. Durant les quatre séries, seules les lectures légères et la documentation sont compatibles avec la fenêtre isolée ; les sources, tests, outils, cas et politiques restent immuables.

Les preuves de composant, de boucle commune, de contribution effective, de restauration et d'intégrité restent distinctes du verdict de coût. Un blocage de jeu ou une réserve de parité doit demeurer explicite dans la readiness. Aucun succès, délai de Pause, état de publication ou résultat de campagne n'est anticipé ici.

## Commandes à exécuter par le responsable

Après readiness et isolation constatées, lancer le runner conservé :

```bash
python -B scripts/run-native-cost-window.py /workspace/sites/sra-lot7-baseline6a-recovery-20261111 docs/migration/lot7b-evidence/followup-recovery/performance-clean-repeat docs/migration/lot6a-evidence/integrated-final-02/source-manifest.json docs/migration/lot7b-evidence/followup-recovery/integrated-final/source-manifest.json
```

Après les quatre séries, exécuter les comparateurs historiques sur les deux cohortes puis sur leur agrégat. Conserver leurs statuts diagnostiques, puis produire les revues :

```bash
python -B scripts/review-native-cost-consolidation.py docs/migration/lot7b-evidence/followup-recovery/performance-clean-repeat
python -B scripts/review-native-global-cost-window.py docs/migration/lot7b-evidence/followup-recovery/performance-clean-repeat/combined-comparison.json docs/migration/lot7b-evidence/followup-recovery/performance-clean-repeat/declaration.json docs/migration/lot7b-evidence/followup-recovery/performance-clean-repeat/global-budget-decision.json --lot 7B --native-version 0.61.0
```

Après conservation des reçus de readiness, contrôle statique et transport des journaux, `write-cost-results.py` rend les résultats sans lancer de mesure ni choisir d'échantillon.
