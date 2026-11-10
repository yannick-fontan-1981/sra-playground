# Lot 7A : constats fonctionnels sur le candidat intégré 0.52.0

Lecture indépendante arrêtée au **10 novembre 2026, 20:16 UTC**, après réception des sept régressions terminales. Aucun jeu, runtime ou test supplémentaire n'a été exécuté pour rédiger cette note.

## Conclusion et périmètre

**Le candidat intégré exécute la chaîne Workshop dans le runtime commun et reproduit exactement les appels de composant Python capturés sur LKEY. Deux niveaux officiels sont terminés ; le troisième reste ouvert.** Les propositions sélectionnées dépendent de connaissances acquises à partir de retours réels, dont un contraste obtenu passivement après l'action d'une autre famille. Les contrats contrôlés vérifient en complément le refus après absence d'effet, la restauration depuis le graphe autoritaire et la revalidation d'une méthode dans une nouvelle portée. [Parité intégrée](diagnostic/integrated-public-parity.json), [contribution](diagnostic/contribution.json.gz), [tests intégrés](validation/delta-tests-run.json).

Cette note établit le périmètre fonctionnel du gel. Elle ne prononce aucun verdict de coût, d'intégrité globale de livraison ou de publication. Les traces d'une campagne, les observations du navigateur, les contrats de composant et les contrôles de l'appelant commun sont des preuves distinctes. La parité complète de l'appelant original et la migration de toutes les capacités V5/V6 restent ouvertes.

| Identité | Valeur retenue |
| --- | --- |
| Référence Python V6 | `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e` |
| Implémentation testée | `logos-engine.typescript.v6.native-migration/0.52.0` |
| Digest natif | `f5f4a67d68f867d3a37ef66fd7c07b9e75b9d201daceb732038f8fa71caa59eb` |
| Inventaire gelé | 279 fichiers natifs |
| Archive d'exécution | 290 fichiers ; base Git `b830cbe5c0d4b25790017acd65dc1f8200020306` |
| Entrée / propriétaire | `observed_ranked_workshop` / `public_ranked_workshop` |
| Workflow | `v6.ranked_workshop.choose` |

Le [manifeste natif](source-manifest.json) et l'[archive source](source-archive.json) lient ces identités. La relecture indépendante a recalculé le digest du manifeste et les empreintes de ses 279 fichiers, sans divergence. La [réconciliation préparée de 4A](../coordination/prepared-4a-integration.json) décrit la provenance du code commun ; son rattachement au commit effectivement publié relève du responsable d'intégration.

## Ce qui est vérifié sur le gel

Les **3 745 tests des 97 fichiers passent**, sans échec, annulation, omission ou test différé. Le reçu conserve l'identité des sources et des tests avant et après exécution. Les cinq contrôles de projet — TypeScript, registre, audit de migration, différences et compilation — passent également. [Tests](validation/delta-tests-run.json), [cinq contrôles](project-checks-retry/validation/checks-run.json).

Le premier lancement des contrôles du projet conserve un échec `MODULE_NOT_FOUND` sur l'ancien chemin du helper Sites 1.1.5, avant compilation. Le second utilise le helper installé 1.1.6. Le reçu des tests n'a pas été reconstruit ni réinterprété : sa copie dans le répertoire de reprise est identique octet pour octet. [Incident conservé](build-helper-path-resolution.json), [réutilisation vérifiée](project-checks-retry/test-receipt-reuse.json).

| Niveau de preuve | Résultat effectivement couvert | Limite |
| --- | --- | --- |
| Composant / oracle original | 155 contrôles : 41 géométries, 50 méthodes et préparations, 21 sélections, 40 cas de propriétaire, puis 3 contrôles de provenance et d'enchaînement | Observations et états synthétiques explicitement déclarés ; aucune action de jeu envoyée par l'exporteur |
| Kernel commun | 4 contrats utilisent la fabrique de production, l'ordre stratégique, WHY/ACT et les propriétaires autoritaires | Les contrastes et frontières du scénario contrôlé ne sont pas des niveaux de jeu réussis |
| Campagne réelle LKEY | 25 actions, 25 préfixes, 2 niveaux terminés ; 14 propositions Workshop sélectionnées | La cible des 3 premiers niveaux n'est pas atteinte |
| Rejeu source des appels capturés | 49 appels concordants ; 147 comparaisons exactes des états avant/après et des résultats | Parité du propriétaire sur cette trajectoire, pas de tout l'appelant Python |
| Navigateur intégré | Pause, action unique, reprise et passages naturels de niveau constatés | Aucune mesure de latence maximale de Pause ; le temps actif affiché n'est pas un benchmark |

La [fixture originale](../../../../tests/fixtures/v6-ranked-workshop-reference.json.gz), les [tests de référence](../../../../tests/v6-ranked-workshop-reference.test.ts) et les [tests Kernel](../../../../tests/v6-ranked-workshop-kernel.test.ts) définissent ces domaines. L'exporteur et le rejeu source vérifient les **1 786 fichiers originaux** avant et après leur travail. La fixture a pour SHA-256 `8c1344b16b835e145e9a90edfc3cf18eec022851ae4f6146d5e07ce52ff685d0`.

L'audit intégré compte **56 entrées raccordées sur 76** : goal 10/12, window 20/21, surface 8/10, material 18/33. L'audit de migration conserve 172 modules vérifiés au niveau composant, 143 partiellement transférés et 1 054 en attente, sur 1 369 modules Python ; aucun module n'est déclaré intégralement vérifié. Ces nombres mesurent le transfert et les raccordements, pas un taux de résolution de jeux. [Audit du registre](project-checks-retry/validation/entry-audit-output.log.gz), [audit de migration](project-checks-retry/validation/migration-audit-output.log.gz).

## Chaîne de décision, garde et acquisition

Le propriétaire consomme les géométries et primitives V5 prévues, les mesures courantes de profils, les extensions de méthode et de préparation, puis le programme SRC avec **`workshop.measure` et `workshop.select`**. Les règles DRM conservent leurs priorités, le regroupement des candidats équivalents et l'abstention lorsqu'il reste des alternatives distinctes. La proposition produite dans le contrat Kernel porte effectivement **OP18**, son reçu de workflow et son sous-problème matériel. [Filiation source → TypeScript → consommateur](../../lot7a-ranked-workshop-lineage.md), [propriétaire natif](../../../../src/logos-engine/v6-ranked-workshop.ts), [contrats Kernel](../../../../tests/v6-ranked-workshop-kernel.test.ts).

La garde lie la proposition à l'observation, l'époque, la progression officielle et l'image, contrôle l'action disponible, puis remesure le contexte nécessaire. Une nouvelle observation invalide l'ancienne autorisation même lorsque les pixels sont inchangés dans le contrat contrôlé. L'action scelle un préfixe dont le résultat reste inconnu jusqu'au retour ; le code ne transforme pas une hypothèse de préparation en effet déjà établi. Le marqueur `receipts_are_not_occupancy: true` demeure explicite. [Garde et scellement](../../../../src/logos-engine/v6-ranked-workshop.ts), [preuve de boucle commune](../../../../tests/v6-ranked-workshop-kernel.test.ts).

Sur le parcours intégré LKEY, le premier contraste exploitable est le retour passif d'**`ACTION5`, révision 10 → 11**. Il acquiert le contraste de mode `[0,1]` et une méthode transportable soumise à revalidation. Le runtime sélectionne ensuite les propositions Workshop. Les 25 actions se répartissent entre 4 sélections FramedTransfer, 6 frontier, 14 Workshop et 1 AnimatedContact. [Campagne réelle](lkey-campaign.json.gz), [contraste et attribution](diagnostic/contribution.json.gz).

Les 25 transitions réelles produisent **25 enregistrements distincts : 14 actifs, 11 passifs, aucun doublon**. Le passage passif suit Recall et saute le propriétaire Workshop lorsque son retour a déjà été acquis activement. La conservation de l'état Workshop reste distincte de celle de Feedback. Ces propriétés sont contrôlées à la fois sur la trajectoire réelle et sur la boucle Kernel. [Unicité des retours](diagnostic/contribution.json.gz), [raccordement commun](../../../../src/logos-engine/v6-native-runtime.ts).

## Contribution causale effectivement établie

Le rejeu Python utilise **un seul `RankedWorkshop()` original, initialement vide**. Les états capturés dans le natif servent de cibles de comparaison ; aucun n'est restauré pour amorcer cette trajectoire. Les ablations partent ensuite, séparément, des états produits par ce rejeu original et conservent la situation publique fixe. Elles mesurent la dépendance d'une décision de composant à une couche de connaissance ; elles ne rejouent pas une partie contrefactuelle complète. [Méthode et résultats d'ablation](diagnostic/contribution.json.gz).

| Couche retirée | Effet sur les 14 propositions sélectionnées |
| --- | --- |
| Toutes les couches apprises | 14 propositions supprimées |
| Preuves de mode courantes | 9 supprimées, 4 décisions changées, 1 identique |
| Méthodes de mode | 1 supprimée, 13 identiques |
| Effets de commande | 1 supprimée, 13 identiques |
| Observations d'opérateurs | 14 identiques |
| Réfutations de méthodes | 14 identiques |
| Rejets locaux | 14 identiques |
| Événements | 14 identiques |

À l'époque 2, révision 17, la méthode historique permet **`ACTION5 / revalidate_mode`** ; son retrait supprime la proposition. À la révision 18, les effets de commande acquis permettent **`ACTION3 / probe_transform`** ; leur retrait supprime cette proposition. Ces deux cas montrent des connaissances acquises et transportées influençant une décision suivante. [Ablations exactes](diagnostic/contribution.json.gz).

L'observation d'une transformation de profils et la consommation ultérieure de son modèle sont distinctes. Le parcours conserve la paire `[1,2,4] → [4,2,1]` avec un domaine conditionnel et `global_domain_known: false`. L'ablation des observations d'opérateurs ne change aucune des 14 propositions sélectionnées : **leur influence causale ultérieure n'est pas démontrée par cette campagne**. Les scénarios contrôlés vérifient les contrats de consommation et de réfutation de ces modèles dans leur domaine. [Retours capturés](lkey-campaign.json.gz), [ablation](diagnostic/contribution.json.gz), [tests de référence](../../../../tests/v6-ranked-workshop-reference.test.ts).

## Portée, mémoire et restauration

Les huit champs source conservés sont `epoch`, `mode_evidence`, `rejected`, `events`, `mode_methods`, `input_effects`, `method_refutations` et `operator_observations`. Un changement d'époque vide les preuves de mode et les rejets locaux, tout en conservant les méthodes et les autres connaissances avec leur provenance. Une méthode historique autorise une question de revalidation ; elle ne transporte pas une permission d'action déjà acquise. [État et portée](../../../../src/logos-engine/v6-ranked-workshop.ts).

Les bornes retenues sont celles de la source : 64 effets d'entrée, 8 contrastes par méthode, 32 observations d'opérateurs et 32 événements dans l'état exporté. Aucun plafond global supplémentaire n'est inventé pour les méthodes ou les réfutations. Le format `native.public_ranked_workshop.v1` est validé avant mutation ; le cache de projection et la sélection transitoire sont vidés lors d'une restauration effective. Le nœud `family_state:public_ranked_workshop` reste autoritaire, distinct du fait de raisonnement `observed_ranked_workshop_state`. [Implémentation](../../../../src/logos-engine/v6-ranked-workshop.ts), [adaptation native expliquée](../../lot7a-ranked-workshop-lineage.md).

Les contrats Kernel effacent volontairement l'objet non autoritaire, puis vérifient que le runtime restaure ses connaissances depuis le graphe. Ils couvrent aussi un retour sans effet qui empêche une répétition, une nouvelle portée qui exige une revalidation et une réfutation locale qui conserve la méthode historique tout en empêchant son réemploi dans cette portée. Ces preuves sont contrôlées et synthétiques ; la campagne LKEY apporte séparément les retours physiques et les décisions observées. [Contrats Kernel](../../../../tests/v6-ranked-workshop-kernel.test.ts).

## Résultat LKEY, navigateur et réserve conservée

| État constaté | Actions | Niveaux terminés | Plans / préfixes |
| --- | ---: | ---: | ---: |
| Pause navigateur | 1 | 0 | 1 |
| Action unique terminée | 2 | 0 | 2 |
| Première frontière naturelle | 16 | 1 | 16 |
| Deuxième frontière naturelle | 24 | 2 | 24 |
| Arrêt final | 25 | 2 | 25 |

La campagne et le navigateur aboutissent à **`frontier_unknown` au troisième niveau**, avec `animated_contact` comme dernier propriétaire visible. Les deux frontières précédentes montrent Workshop sélectionné. Le navigateur affiche 33,2 secondes de résolution active en fin de parcours ; cette valeur n'est ni le temps cumulé du dossier ni une mesure de performance officielle. [Reçu navigateur](browser/browser-qa.json), [états observés](browser/observed-states.json), [capture finale](browser/final.png), [exécution réelle](execution-lkey.json).

Le diagnostic hors action, appliqué au dernier paquet réel à l'époque 3 et à la révision 26, trouve une projection admissible et une méthode transportable. Le propriétaire Python proposerait `ACTION5 / revalidate_mode`. **Aucun appel natif `proposeSource` de Workshop n'est capturé dans cette époque** : l'appelant s'arrête avant sa consultation, après la sélection antérieure d'AnimatedContact. Le diagnostic n'a envoyé aucune action supplémentaire et ne prouve pas que cette action aurait terminé le niveau. [Diagnostic du dernier paquet](diagnostic/integrated-public-parity.json).

Le [compteur cumulé figé](lkey-case-checkpoint.json) conserve **1 341,623 secondes consommées** et **1 058,377 secondes restantes** sur 2 400, sans remise à zéro des tentatives antérieures. La cible 3/3 reste non atteinte. Toute reprise de travail sur LKEY doit reprendre ce compteur et préserver l'ordre stratégique générique.

## Régressions enregistrées et statut de cette note

Le [manifeste des sept cas](../recorded-regression-cases-integrated.json) fixe CATR, RSWP, FOGW, VOIS, CONN, MIND et WEAV. Six références proviennent des rapports réels du gel préparé 4A/native 0.51 ; CONN conserve sa référence effectivement publiée 3I/native 0.50, faute de rapport CONN dans 4A. Le [reçu de provenance](../coordination/integrated-regression-provenance.json) précise ce choix et le rattachement de publication encore nécessaire.

Les **sept cas passent, avec 119/119 contrôles**, sur **292 commandes, 210 préfixes et 21 frontières naturelles**. La série conserve 299 paquets publics complets, 1 405 images d'animation et 502 requêtes. Les sources natives et les entrées d'exécution restent inchangées. [Bilan terminal des régressions](regressions/regression-summary.json).

| Cas | Référence native du rapport | Actions | Contrôles |
| --- | --- | ---: | ---: |
| [CATR](regressions/catr-051-comparison.json) | 0.51 | 12 | 17/17 |
| [RSWP](regressions/rswp-051-comparison.json) | 0.51 | 19 | 17/17 |
| [FOGW](regressions/fogw-051-comparison.json) | 0.51 | 50 | 17/17 |
| [VOIS](regressions/vois-051-comparison.json) | 0.51 | 78 | 17/17 |
| [CONN](regressions/conn-050-comparison.json) | 0.50 | 21 | 17/17 |
| [MIND](regressions/mind-051-comparison.json) | 0.51 | 31 | 17/17 |
| [WEAV](regressions/weav-051-comparison.json) | 0.51 | 81 | 17/17 |

Un rejeu enregistré établit que le candidat produit ses commandes avant les retours publics archivés et satisfait les contrôles historiques du cas. Il ne constitue pas une nouvelle campagne réelle, une contribution causale de Workshop ou une mesure de vitesse. Le statut favorable de cette série ne transforme pas la campagne réelle LKEY 2/3 en réussite de sa cible.

Le coût, l'intégrité générale de livraison et la publication doivent être conclus à partir de leurs reçus propres. Les observations fonctionnelles de cette note ne les anticipent pas. Le lot 7B reste distinct et hors de ce périmètre.
