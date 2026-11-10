# Plan de mise à jour finale de la roadmap — lots 4A, 4B et 4C

**Statut : préparation documentaire, non appliquée.** Ce fichier prépare uniquement des remplacements dans `docs/migration/v6-delivery-roadmap.md`. Il ne modifie ni cette roadmap, ni le rapport 4B, ni le moteur. Le gel final 4B attend la publication effective de **5A / native 0.53**, son intégration et les validations du candidat réuni. **4C reste non implémenté.**

Les passages factuels ci-dessous sont utilisables avec leur qualification de développement. Les passages contenant `{{…}}` sont des gabarits : les valeurs doivent venir des reçus finaux réellement produits. Ils ne doivent pas être publiés comme résultats tant que ces champs restent inconnus.

## 1. Sources relues et identité de cette préparation

La roadmap a reçu pendant cette préparation le bloc `LOT5A_CURRENT_START`, qui décrit 5A comme **prêt à publier**, avec publication encore à effectuer. Les numéros de ligne ont donc changé. Les **titres et phrases d'ancrage**, et non les seuls numéros de ligne, servent de repères pour le futur patch.

| Document relu | SHA-256 du contenu observé |
| --- | --- |
| [Roadmap actuelle](../../v6-delivery-roadmap.md) | `b6483f4de831244e4ed971dad01fb2cc8d494b67114978fad1eb879219745344` |
| [Rapport 4B intermédiaire](../../lot4b-relative-arrangements.md) | `d029e50c1ed7145504f842869660a305ee2413520d81c6ba499debb3369d4239` |
| [Revue documentaire précédente](final-report-review.json) | `54bb46ee47bf0571fe1e08b86acf84f5081187c5ce53e5f70a376bcde47ffc56` |
| [Reçu des 120 tests de priorité](../development/priority-regression-01/validation/delta-tests-run.json) | `cacaab202fbcf1b5682314aa593ec2d3a17d28265d5b24d0044f24f89541dbd3` |

La revue précédente proposait de préciser le passage « avant de le consulter ». **Le rapport 4B courant a déjà reçu cette correction** : la barrière précède la proposition et l'admission, tandis que la continuation acquise peut auparavant lire son témoin conservé et sa corroboration Kernel. Il ne faut pas réintroduire l'ancienne formulation.

Aucun test, build, moteur, oracle, jeu ou rejeu n'a été exécuté pour préparer ce plan. Les reçus ont été lus comme documents.

## 2. Faits utilisables dès maintenant, avec leur portée

| Fait établi | Identité et preuve | Qualification à conserver |
| --- | --- | --- |
| **81 tests différentiels** | [Reçu référence](../development/relative-reference-test-01.json), [journal](../development/relative-reference-test-01.log), [fixture transportée](../../../../tests/fixtures/v6-relative-arrangements-reference.json.gz.parts.json) | Contrats de composant issus des originaux inchangés ; aucune validation finale du candidat fusionné n'en découle. |
| **12 cas du caller commun** | [8 cas initiaux](../development/integration-attempt1.json), [2 cas de préférence de service](../development/integration-attempt2.json), [2 cas de continuation acquise](../development/integration-attempt3.json) | Les sessions isolant l'entrée et les fournisseurs synthétiques de priorité sont déclarés. Ces trois ciblages ne constituent pas une nouvelle exécution unique de toute la suite finale. |
| **120/120 tests de priorité, quatre fichiers** | [Sélection préalable](../development/priority-regression-01/selection.json), [reçu](../development/priority-regression-01/validation/delta-tests-run.json) | Gel intermédiaire `31850e3a309e51da61980025d333d4936e8ddbba44ed262ebe0330d944e589fe`, après intégration de 7A publié et avant intégration finale de 5A. Sources et tests inchangés pendant l'exécution ; zéro échec, annulation, test ignoré ou TODO. |
| **TRIA : trois niveaux, 17 actions, 17 préfixes** | [Campagne de développement](../development/tria-live-01/tria-campaign.json.gz.parts.json), [résolution du cas](../tria-case-resolution.json) | Une session froide continue, progression naturelle, toutes les actions sélectionnées par RelativeArrangements. Gel de développement `852d5ff7cdaa15534d22fcd610043cd348bb8aa241e290ae67d75adcaeaf8f9f`. |
| **68/68 appels de famille, zéro différence** | [Comparaison Python froide](../development/tria-live-01/tria-relative-arrangement-source-parity-02.json.gz), [résumé lisible](../development/tria-live-01/tria-relative-arrangement-source-parity-02.log) | 17 propositions, 17 gardes avant, 17 gardes après, 17 acquisitions sélectionnées ; 34 gardes, 17 états de préfixe, 17 restaurations, 18 observations publiques et 16 choix suivants. Ce n'est pas la parité de l'appelant Python entier. |
| **51 ablations conservées** | Même comparaison froide | Deux interventions changent l'action **au même appel 44** ; quatre changent seulement d'autres données de proposition et 45 ne changent pas la proposition. Une décision distincte, pas deux décisions indépendantes. |
| **Référence Site 81 bornée à huit actions, zéro niveau** | [Campagne de référence](../development/tria-baseline-site81/tria-campaign.json.gz.parts.json), [résolution](../tria-case-resolution.json) | Borne annoncée atteinte ; aucun verdict d'impossibilité générale. |
| **374,140910 secondes cumulées TRIA** | [Résolution initiale](../tria-case-resolution.json) | Deux tentatives et deux comparaisons conservées ; résolution initiale inchangée. Un éventuel intervalle QA ultérieur s'ajoute par reçu séparé, sans remise à zéro et dans le plafond de 2 400 secondes. |
| **56/76 puis 57/76, compteurs intermédiaires** | [Rapport 4B](../../lot4b-relative-arrangements.md), [audit courant](../../v6-entry-point-progress.json) | 56/76 concerne le premier développement ; 57/76 concerne le candidat 4B ayant intégré 7A. Le compteur final doit être lu dans le nouvel audit après 5A. |

Les quatre fichiers des 120 tests sont `v6-acquired-continuation-priority.test.ts`, `v6-learned-preparation-priority.test.ts`, `v6-material-recovery-priority.test.ts` et `v6-outline-arbitration.test.ts`. Le rapport identifie l'actualisation d'une liste exhaustive d'enregistrement devenue périmée ; les assertions de comportement restent conservées.

**Ne pas additionner 81, 12 et 120 pour annoncer un gate final de 213 tests.** Ce sont des preuves distinctes, exécutées à des moments et sur des périmètres identifiés. Le nombre final viendra de son propre reçu.

Le nombre **57/76** apparaît aussi dans le jalon 5A préparé sur une autre composition de capacités. Un même numérateur ne prouve pas l'identité des entrées raccordées. Le rapprochement final doit vérifier les noms, les propriétaires et les positions de routage.

## 3. Carte des remplacements à appliquer

| Section du fichier cible | Ancrage précis | Modification prévue |
| --- | --- | --- |
| En tête, après le titre général | Bloc courant `LOT5A_CURRENT_START` | Conserver intégralement le jalon 5A et ses preuves. Après publication réelle de 4B seulement, insérer un nouveau jalon 4B au-dessus ; nommer 5A comme prédécesseur effectivement publié et intégré. |
| Fin du jalon historique Feedback 0.51 | « La prochaine réalisation de ce fil, à la demande de continuer, est 4B… » | Remplacer cette projection devenue périmée par une phrase explicitement historique et un renvoi à l'état courant du lot 4. Garder les chiffres et réserves de 4A. |
| `Priorités, dépendances et statuts` | Ligne commençant par `| 4 | Exemples, correspondances et retours discriminants |` | Remplacer le statut « 4B puis 4C restent à réaliser » par le statut réel. Après livraison 4B, il restera une entrée du lot 4 : `facet_example`. |
| Même section, sous le tableau | « Depuis 3F… » puis « … noms restent ouverts… » | Ajouter `relative_arrangement` à la liste des raccordements seulement avec son audit final. Reprendre le total et la ventilation par lot depuis le registre final, sans les déduire d'un ancien compteur. |
| Fin du bilan du lot 3 | « Feedback 4A est maintenant intégré dans 0.51 ; le prochain transfert de ce fil est relative_arrangement… » | Conserver le bilan du lot 3 ; remplacer seulement la phrase de suite du lot 4 par un renvoi actuel. |
| `Lot 4 : exemples et retours discriminants` | Paragraphe `**État intégré :**` | Remplacer la demande de commencer 4B par la séparation 4A livré / développement 4B vérifié / livraison finale attendue, puis par le verdict final quand attesté. |
| Même section | Lignes du tableau `**4A**`, `**4B**`, `**4C**` | Garder l'histoire 4A ; renseigner le transfert 4B et sa portée ; préciser que le workflow 4C compilé n'est pas encore raccordé. |
| Même section, après les paragraphes de preuve 4A | Avant `**Suite de ce fil :**` | Ajouter le paragraphe de preuve 4B proposé ci-dessous, avec liens distincts de développement et de livraison. |
| Même section | « Suite de ce fil : 4B… lorsque la poursuite sera demandée » | Remplacer par la clôture intégrée en cours puis 4C, ou par 4C seul après livraison attestée. |
| `Journal et prochain lot` | Après les jalons publiés déjà présents et avant la ligne `Lots 4 à 10` | Ajouter une ligne 4B, sans réécrire celles de 4A, 7A ou 5A. |
| Même section, synthèse finale | « Les lots… », « L'audit courant… », « Le fil du lot 4 conserve 4B… » | Ajouter 4B à la liste des lots livrés seulement après publication ; actualiser les compteurs depuis les audits finaux ; nommer 4C comme suite et ajouter TRIA avec son cumul réel. |

Les passages historiques de 4A conservent **Site 80 puis Site 81, native 0.51, MIND trois niveaux/31 actions/20 préfixes, 51/51 appels de famille, trois changements et cinq inchangés sur huit ablations, 886,070349 secondes cumulées**. Leur réserve navigateur et l'échec strict de coût qualifié séparément ne sont pas effacés par 4B.

## 4. Passages factuels prêts à reprendre avant les résultats finaux

Les liens dans les blocs Markdown suivants sont rédigés **pour le fichier cible** `docs/migration/v6-delivery-roadmap.md`.

### 4.1 État du lot 4

Remplacement du paragraphe `**État intégré :**`, tant que 4B n'est pas livré :

```markdown
**État du lot :** 4A est livré dans Site 80, puis clôturé documentairement dans Site 81, sur native 0.51. Son transfert, sa contribution MIND et son coût qualifié restent conservés. **4B, `relative_arrangement`, a maintenant ses preuves de développement et une contribution TRIA observée.** Le gel final attend la publication effective de 5A / native 0.53, son intégration et les validations du candidat réuni ; aucun coût final ni déploiement 4B n'est encore revendiqué. **4C, `facet_example`, reste non implémenté.**
```

### 4.2 Ligne de statut général du lot 4

Version utilisable avant clôture :

```markdown
| 4 | Exemples, correspondances et retours discriminants | 2 dans le dernier gel de référence ; audit final attendu | Observations, callbacks SRC, gardes et mémoire propre | **4A livré : Site 80 puis Site 81, native 0.51. 4B : transfert et contribution de développement vérifiés ; livraison intégrée après 5A en attente.** 4C reste non implémenté. |
```

Le compteur « 2 » désigne ici les entrées qui ne sont pas encore livrées dans le dernier jalon de référence. Il ne contredit pas le raccordement présent dans le checkout de développement. Après livraison, utiliser la ligne finale de la section 5 et le registre effectivement livré.

### 4.3 Tableau détaillé 4A / 4B / 4C

Dans la ligne 4A existante, conserver toute la colonne « État et preuve ». Remplacer uniquement la dernière cellule par :

```markdown
Périmètre historique livré. Conserver l'échec strict de comparabilité, sa qualification distincte, les résultats d'ablation et la réserve navigateur ; rattacher sa non-régression au gel final 4B lorsqu'elle est effectivement vérifiée.
```

Ligne 4B intermédiaire :

```markdown
| **4B** | `relative_arrangement` / `v6.relative_arrangements.choose` | **Transfert et contribution de développement vérifiés ; livraison intégrée en attente.** Propriétaire unique, acquisition réservée à la proposition sélectionnée, observation initiale liée, état conservé et restauration. TRIA : trois niveaux, 17 actions et 17 préfixes ; comparaison froide de la famille sur 68 appels publics. | Intégrer la publication effective 5A, geler le candidat, achever validation, régressions, parité familiale publique, QA et coût final, puis publier. Conserver le refus local d'une interface reconnue sans offre ; aucun passif RelativeArrangements n'est ajouté. |
```

Ligne 4C, également applicable après livraison 4B :

```markdown
| **4C** | `facet_example` / `v6.facet_examples.choose` | **Non implémenté dans 4B.** Le workflow est déjà compilé, mais son fournisseur natif et ses callbacks ne sont pas raccordés. L'entrée est la première de `program_construction`, dans le groupe `surface`. | Transférer les producteurs de mesure et d'expérience, l'acquisition sélectionnée, la méthode conditionnelle et sa restauration. Conserver correspondance visible, déplacement de face, extension de côtés, méthode portable et méthode composée locale, ainsi que réfutations, absence d'effet, modifications hors région et refus officiel malgré un rendu conforme. La configuration originale active les branches composées ; une éventuelle livraison simple seule devra être explicitement partielle. |
```

Cette formulation ne transforme pas la présence de l'IR en preuve de consommation. Les callbacks compilés sont `facet.measure` puis `facet.bind` ; le futur travail porte aussi sur les gardes, `facet_example_event`, `facet_example_state` et les consommateurs de méthode. Aucune implémentation 4C n'est incluse dans ce plan.

### 4.4 Paragraphe de preuves 4B à ajouter

```markdown
Le [rapport 4B](lot4b-relative-arrangements.md) et sa [filiation](lot4b-relative-arrangements-lineage.md) distinguent les preuves de développement de la livraison finale. Les **81 tests différentiels de référence** et **12 cas du caller commun** vérifient propositions, gardes, acquisitions sélectionnées, états et décisions après restauration. Après intégration de 7A publié, les **120/120 tests de priorité hérités dans quatre fichiers** passent sur le gel intermédiaire `31850e3a…`, sources et tests inchangés. Ces ciblages ne constituent pas le gate final du candidat après 5A.

La [campagne TRIA de développement](lot4b-evidence/development/tria-live-01/tria-campaign.json.gz.parts.json), sur le gel `852d5ff7…`, réussit **trois niveaux en 17 actions et 17 préfixes**, dans une session froide continue. La référence publiée Site 81 s'arrête à la borne annoncée de huit actions, sans niveau terminé ; cela n'établit pas une impossibilité générale. La [comparaison froide de la famille Python](lot4b-evidence/development/tria-live-01/tria-relative-arrangement-source-parity-02.json.gz) concorde sur **68/68 appels**, dont **34 gardes**, avec **17 états de préfixe et 17 restaurations**, sans amorcer l'oracle depuis les états natifs. Les 1 786 fichiers originaux restent inchangés.

Les **51 ablations** sont conservées : **deux interventions changent l'action au même appel 44**, quatre changent seulement d'autres données de proposition et 45 la laissent inchangée. Il s'agit d'une décision distincte sensible à `models` et à `selection_ref`. **`failed` est vide aux 17 choix live** ; son influence est couverte par les cas synthétiques. L'acquisition Relative reste sélectionnée seulement ; le passif de Feedback demeure propre à Feedback. Les preuves synthétiques de routage et cette parité de famille ne prouvent pas la parité de l'appelant Python entier.

La [résolution initiale TRIA](lot4b-evidence/tria-case-resolution.json) conserve **374,140910 secondes cumulées**, sans remise à zéro. Un rejeu enregistré de livraison reste distinct d'une nouvelle réussite live. Toute QA finale ouvrant une nouvelle période conserve la résolution initiale et ajoute son intervalle complet par reçu séparé, dans le plafond cumulatif de 2 400 secondes.
```

Ajouter ensuite la phrase de résultats intégrés de la section 5 uniquement après production des preuves finales. Garder le paragraphe ci-dessus comme historique de développement : ne pas remplacer son digest par le gel final.

### 4.5 Portée de la barrière locale

Texte court à employer si le détail de routage est repris dans la roadmap :

```markdown
Une interface non reconnue laisse les replis suivants disponibles. Une interface Relative reconnue sans expérience admissible clôt le reste de `window_constraints`, symétrie comprise, puis les autres groupes continuent. Les deux parcours natifs de préférence vérifient cette barrière avant la proposition et l'admission d'un fournisseur tardif. La continuation acquise peut auparavant consulter son témoin conservé et sa corroboration Kernel ; cette lecture ne donne aucune autorité à une offre bloquée.
```

## 5. Blocs finaux à compléter après preuves et publication

**Ne pas appliquer ces gabarits avec des champs inconnus.** Une qualification structurelle ou une revue arithmétique complète ne suffit pas, à elle seule, à annoncer un budget accepté. Le verdict doit satisfaire la règle globale par jeu et la publication doit être attestée.

### 5.1 Nouveau jalon de tête

À insérer au-dessus du jalon 5A, après publication 4B :

```markdown
## Jalon publié : RelativeArrangements {{VERSION_NATIVE_4B}}

Le lot **4B** est livré dans **Site {{SITE_4B}}**, commit `{{COMMIT_PUBLICATION_4B}}`. Il intègre la publication effective **5A / native 0.53 / Site {{SITE_5A}}**, commit `{{COMMIT_PUBLICATION_5A}}`, ainsi que les prédécesseurs publiés attestés par le [reçu de réconciliation]({{LIEN_RECONCILIATION}}). Son gel `{{DIGEST_GEL_4B}}` contient **{{FICHIERS_NATIFS}} fichiers natifs** et une archive de **{{MEMBRES_ARCHIVE}} fichiers**.

La [validation finale]({{LIEN_TESTS_FINAUX}}) passe **{{TESTS_PASSANTS}}/{{TESTS_TOTAL}} tests dans {{FICHIERS_TESTS}} fichiers**, avec {{CONTROLES_PROJET}} contrôles du projet et [intégrité]({{LIEN_INTEGRITE}}) vérifiées. Les [régressions]({{LIEN_REGRESSIONS}}) conservent {{CAS_REGRESSION}} cas et {{COMPARAISONS_REGRESSION}} comparaisons, sur {{ACTIONS_REGRESSION}} actions et {{PREFIXES_REGRESSION}} préfixes. Tout rejeu LKEY partiel reste séparé des totaux stricts, avec son arrêt historique au troisième niveau conservé.

La contribution live TRIA de développement reste trois niveaux en 17 actions. Sur le code livré, le [rejeu public final]({{LIEN_TRIA_FINAL}}) et la [comparaison familiale froide]({{LIEN_PARITE_FINALE}}) établissent {{RESULTATS_TRIA_ET_PARITE_FINAUX}}. Ils ne sont pas présentés comme une nouvelle campagne live. Le [reçu navigateur]({{LIEN_NAVIGATEUR}}) atteste {{RESULTAT_OU_RESERVE_NAVIGATEUR}}. L'horloge conserve 374,140910 secondes pour la résolution initiale et {{INTERVALLE_QA_OU_ABSENCE}} ; son cumul final attesté est {{CUMUL_TRIA_FINAL}} secondes, sans remise à zéro.

Le [coût final]({{LIEN_COUT_FINAL}}) est {{VERDICT_COUT_GLOBAL}} sur les deux jeux : **STCK {{DELTA_STCK}} %**, **SMLP {{DELTA_SMLP}} %**, selon la médiane groupée de session complète strictement sous +10 % pour chaque jeu. Les résultats de phases, cohortes et percentiles restent conservés : {{RESERVES_COUT}}. Tout refus strict et toute qualification structurelle applicable sont identifiés séparément, avec leur protocole préalable et leurs limites. Le [reçu de publication]({{LIEN_PUBLICATION}}) lie le déploiement à ces entrées vérifiées.

**4C, `facet_example`, reste non implémenté et constitue le prochain transfert de ce fil.** La parité de l'appelant Python entier et la migration globale restent ouvertes.
```

Aucun numéro de Site ou de version 4B n'est préattribué dans ce plan.

### 5.2 Ligne finale du tableau des priorités

```markdown
| 4 | Exemples, correspondances et retours discriminants | 1 | Observations, callbacks SRC, gardes et mémoire propre | **4A livré dans Site 80 puis Site 81 ; 4B livré dans Site {{SITE_4B}}, native {{VERSION_NATIVE_4B}}, dans son périmètre attesté.** Les preuves de contribution TRIA, la validation intégrée et le verdict de coût {{VERDICT_COUT_GLOBAL}} sont liés au gel final. **4C, `facet_example`, reste non implémenté.** |
```

Le passage à une entrée restante est conditionné à la présence de `relative_arrangement` dans le registre effectivement livré. Le total global et sa ventilation sont repris séparément depuis ce registre.

### 5.3 Ligne finale 4B dans le tableau détaillé

```markdown
| **4B** | `relative_arrangement` / `v6.relative_arrangements.choose` | **Livré dans Site {{SITE_4B}}, native {{VERSION_NATIVE_4B}}, dans le périmètre du [rapport](lot4b-relative-arrangements.md).** Acquisition sélectionnée seulement, état propre conservé, reprise et arrêt local source vérifiés. Contribution live de développement : TRIA trois niveaux/17 actions ; parité de famille 68/68 appels, deux ablations d'action sur une seule décision distincte. Validation et rejeu du gel livré : {{RESUME_PREUVES_INTEGREES}}. | Périmètre 4B livré avec {{RESERVES_FINALES_4B}}. Conserver tous les refus, limites et horloges ; poursuivre le transfert de `facet_example` en 4C. |
```

### 5.4 Journal et synthèse de fin

Ligne à ajouter après les jalons réellement publiés qui précèdent 4B :

```markdown
| Lot 4B / RelativeArrangements | **Livré dans Site {{SITE_4B}}, moteur {{VERSION_NATIVE_4B}} ; {{VERDICT_COUT_GLOBAL}}** | Développement : 81 tests différentiels, 12 cas du caller commun, puis 120 tests de priorité sur quatre fichiers ; TRIA trois niveaux/17 actions/17 préfixes, 68 appels de famille exacts et deux interventions d'action sur une seule décision. Gel final `{{DIGEST_GEL_4B}}` : {{RESUME_VALIDATION_FINALE}}, {{RESUME_PARITE_FINALE}}, {{RESUME_REGRESSIONS_FINALES}}. Cumul TRIA {{CUMUL_TRIA_FINAL}} s ; {{RESULTAT_OU_RESERVE_NAVIGATEUR}}. Coût STCK {{DELTA_STCK}} % / SMLP {{DELTA_SMLP}} %, diagnostics et réserves conservés. |
```

Dans la synthèse courante, remplacer le segment relatif au lot 4 par :

```markdown
Le lot 4 conserve 4A et livre maintenant 4B dans leurs périmètres attestés. **La suite de ce fil est 4C, `facet_example`, encore non implémenté.** TRIA conserve sa réussite live de développement de trois niveaux et sa résolution initiale à 374,140910 secondes ; {{PHRASE_CUMUL_QA_FINAL}}. Les rejeux publics finaux vérifient le code livré sans transformer les échecs de qualification antérieurs en réussites. Les réserves des autres lots et leurs horloges restent inchangées.
```

Ajouter 4B à la liste des lots « livrés ou clôturés » seulement après son reçu de publication. Actualiser l'implémentation, les compteurs d'entrées, les catégories de migration et les portes globales à partir des audits du même gel. Ne pas recopier les chiffres historiques 4A, 7A ou 5A comme chiffres du candidat 4B.

### 5.5 Anciennes annonces de suite à rendre historiques

À la fin du jalon Feedback 0.51, remplacer uniquement les phrases de suite devenues périmées :

```markdown
À la livraison de 4A, la suite annoncée de ce fil était 4B, `relative_arrangement`, puis 4C, `facet_example`. Leur état courant figure dans la section « Lot 4 : exemples et retours discriminants ». Les chiffres et les réserves ci-dessus restent ceux de la livraison 4A. Les publications ultérieures conservent cette identité historique.
```

À la fin du bilan du lot 3, remplacer seulement l'annonce « le prochain transfert… relative_arrangement… » :

```markdown
Feedback 4A est livré dans native 0.51 ; le suivi de RelativeArrangements 4B et la suite FacetExamples 4C sont décrits dans la section du lot 4. Ces travaux ne modifient ni les verdicts historiques du lot 3 ni ses réserves.
```

## 6. Champs finaux à remplir et source obligatoire

| Champ ou groupe de champs | Source à consulter après publication/intégration | État dans ce plan |
| --- | --- | --- |
| Site, commit et reçu de publication 5A | Publication effective native 0.53, puis vérification du checkout intégré | **En attente.** « Prêt à publier » et la réconciliation des prédécesseurs 82/83 ne prouvent pas que 5A est déjà publié. |
| Réconciliation du candidat 4B | Reçu reliant les publications réellement intégrées à l'archive finale | **À produire sur les entrées réelles.** |
| Version native, digest, fichiers et archive 4B | `source-manifest.json`, `source-archive.json`, parties de l'archive du gel final | **Non attribués.** Ne pas anticiper 0.54 ou un numéro de Site. |
| Gate final : tests, fichiers, cinq contrôles | Reçus finaux `delta-tests-run.json` et `checks-run.json` | **En attente.** Les 81/12/120 de développement ne les remplissent pas. |
| Registre, catégories de migration et portes globales | Audits réellement générés sur le même gel | **En attente.** Vérifier les noms d'entrées, pas seulement le total. |
| Régressions strictes | Résumé final et reçus liés | **En attente.** Conserver leurs vrais dénominateurs et ne pas y inclure LKEY partiel. |
| LKEY partiel final | Nouveau contrat épinglant le gel final et qualification distincte | **En attente.** Les tentatives 01, 02 et 03 restent en échec ; le diagnostic 03 ne constitue pas une qualification passante. |
| Rejeu TRIA final et parité familiale froide | Rapport du code livré, journal public, reçu du comparateur Python | **En attente.** Conserver les résultats de développement avec leur propre digest. |
| Navigateur et continuation éventuelle de l'horloge | Reçu navigateur réel et continuation QA séparée si applicable | **En attente.** Une réserve d'infrastructure reste non passante ; le cumul initial n'est pas écrasé. |
| Protocole et comparabilité structurelle | Déclaration préalable, captures fonctionnelles, attribution et readiness du candidat exact | **En attente.** Pas de résultat hérité de la fenêtre 5A ou 4A. |
| Coût final par jeu | Fenêtre fraîche A1/B1/B2/A2, agrégat, revue indépendante et rapport | **En attente.** Deux médianes complètes strictement sous +10 %, avec diagnostics défavorables conservés. |
| Intégrité et transport | Reçus de source, tests, build, preuves et reconstruction des parties | **En attente sur le gel final.** |
| Publication 4B | Reçu de publication et vérification des entrées réellement livrées | **En attente.** La préparation ou le commit local n'est pas un déploiement. |

## 7. Réserves qui doivent rester dans la version finale

- La contribution TRIA live appartient au gel de développement ; le rejeu du gel final reste un rejeu enregistré.
- La parité de **68 appels** est celle de RelativeArrangements sur le public, avec gardes et états ; elle ne ferme pas la parité du caller Python complet.
- Les **deux interventions** d'ablation portent sur **une seule décision, l'appel 44**. Les quatre changements de métadonnées et les 45 propositions inchangées restent comptés ; `failed` est vide dans le trajet live.
- L'acquisition Relative est sélectionnée seulement. Feedback garde son propre contrat sélectionné/passif ; aucun doublon ni attribution étrangère n'est admis.
- Le refus reconnu sans offre ferme le groupe fenêtre, pas toute la stratégie. Les lectures de témoins conservés ne valent pas admission.
- La référence TRIA à huit actions ne démontre pas l'impossibilité du jeu pour Site 81.
- La résolution initiale de **374,140910 secondes** demeure intacte ; toute période QA facturée est ajoutée explicitement, sans remise à zéro et sans dépasser 2 400 secondes.
- LKEY conserve deux niveaux et son arrêt au troisième. Ses trois qualifications de développement échouées restent telles quelles, même si le diagnostic des données de la tentative 03 concorde.
- Les refus stricts de coût, leur éventuelle qualification distincte, les phases défavorables, cohortes et p95 restent visibles. Aucun temps de référence 5A n'est recyclé comme nouvelle mesure 4B.
- 4C reste non implémenté ; son workflow compilé ne remplace ni callbacks, ni acquisition, ni garde, ni restauration, ni contribution observée.
- Les réserves CWSE, SK48, FramedWindow, LKEY, WEAV et de migration globale ne sont pas effacées par une livraison 4B.

## 8. Ordre d'application documentaire

1. Attester la publication 5A et les autres prédécesseurs effectivement retenus ; intégrer leurs octets réels.
2. Geler 4B et produire ses preuves finales ; garder tous les échecs et les nouvelles qualifications distinctes.
3. Compléter d'abord le rapport 4B avec les reçus réels, puis reprendre ses verdicts dans les blocs finaux ci-dessus.
4. Mettre à jour le jalon courant, le tableau de priorités, la section du lot 4 et le journal dans le même changement documentaire.
5. Réconcilier les compteurs globaux avec les audits du gel livré ; conserver les valeurs historiques dans leurs jalons.
6. Après le reçu de publication 4B seulement, employer « livré » et annoncer 4C comme prochain transfert de ce fil.

**Aucun remplacement de la roadmap principale n'a été appliqué par cette préparation.**

