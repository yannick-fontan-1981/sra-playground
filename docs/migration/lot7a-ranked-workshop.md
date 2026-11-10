# Lot 7A : atelier à rangs, résultats et état de livraison

## État au 10 novembre 2026

**Le composant `observed_ranked_workshop` est porté, raccordé au runtime commun et vérifié sur ses contrats. Sa contribution est observée sur les deux premiers niveaux de LKEY. Le troisième niveau reste ouvert.**

Le candidat intégré **0.52.0** réunit le port Workshop et les commits effectivement publiés de 3I puis 4A. **Les validations fonctionnelles et l'intégrité de ce gel passent.** Le verdict de coût et la publication propre de 7A sont consignés séparément dans la section de livraison ; les résultats de jeu ne les anticipent pas. La [relecture fonctionnelle indépendante](lot7a-evidence/integrated-final/functional-findings.md) détaille les preuves et leurs limites.

| Identité | Valeur vérifiée |
| --- | --- |
| Référence Python V6 | `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e` |
| Base initiale du port | `8fa6b261b8b23ac8d232e60c9c179e2f3407d82f`, Site 78, native 0.49.0 |
| Commit du portage et du raccordement | `7c4c34797bf0bc374b448c985d0dee2fadfb81ca` |
| Prédécesseur publié intégré | Site 81, native 0.51.0, commit `4dafc40c53ed4406ee7cd148e3e6995a2eb4185e` |
| Commit de fusion du prédécesseur publié | `1ceea98d31e659dfed618d121ee4410c88fda378` |
| Candidat natif | `logos-engine.typescript.v6.native-migration/0.52.0` |
| Digest des 279 fichiers natifs du candidat | `f5f4a67d68f867d3a37ef66fd7c07b9e75b9d201daceb732038f8fa71caa59eb` |
| Propriétaire | `public_ranked_workshop` |
| Entrée déclarée | `factored_material_return / observed_ranked_workshop` |
| Workflow exécuté | `v6.ranked_workshop.choose` |

L'[inventaire gelé](lot7a-evidence/integrated-final/source-manifest.json), l'[archive de 290 fichiers](lot7a-evidence/integrated-final/source-archive.json) et la [filiation détaillée](lot7a-ranked-workshop-lineage.md) définissent les octets vérifiés et les primitives V5 réellement consommées. Le [rattachement au prédécesseur publié](lot7a-evidence/coordination/published-base-binding.json) vérifie après fusion l'identité des 279 fichiers natifs, des 290 entrées archivées, des 638 entrées de source et de tests et des 344 entrées de compilation. Les preuves exécutées sur ces mêmes octets restent applicables ; ce reçu ne prétend pas les avoir rejouées après la fusion documentaire.

## Comportement ajouté à Logos Engine

L'atelier mesure les profils ordonnés visibles, les marqueurs, les coupes de référence et leurs relations courantes. Il peut ensuite formuler une question de préparation, d'accès, d'échange, de transformation ou de réception. Son activation repose sur un contraste de mode réellement acquis, ou sur une méthode transportable soumise à une nouvelle vérification.

Le workflow appelle effectivement **`workshop.measure`**, puis **`workshop.select`**. Le choix respecte le DRM original : priorité des familles de propositions, coût conditionnel des préparations, regroupement des propositions équivalentes et abstention en présence d'alternatives distinctes. La proposition conserve sa composition **OP18**, ses inconnues et ses falsificateurs.

Avant exécution, la garde vérifie l'observation, l'époque, la progression officielle, l'image, l'action disponible et la projection mesurée. Après l'action, elle scelle le préfixe avec un résultat encore inconnu. Seul le retour observé peut acquérir un contraste, un effet de commande, une méthode ou une réfutation. Un ajustement de profil reste une hypothèse locale ; un reçu ne devient pas une preuve d'occupation persistante.

Le propriétaire enregistre ses actions sélectionnées. Il reçoit aussi les retours des autres familles, dans le passage passif prévu par l'appelant source. Le passage passif exclut explicitement le propriétaire déjà enregistré activement. Le constructeur du runtime vérifie en outre que le propriétaire d'acquisition est l'instance enregistrée, et refuse un second objet portant seulement le même identifiant.

## Fidélité aux sources et boucle commune

L'[exporteur indépendant](../../scripts/export-v6-ranked-workshop-reference.py) exécute les originaux Python, SRC et DRM et vérifie les **1 786 fichiers** du manifeste avant et après génération. Il désactive les écritures de bytecode et détourne sa lecture vers un répertoire temporaire vide. La [fixture conservée](../../tests/fixtures/v6-ranked-workshop-reference.json.gz) contient les empreintes des sources et les fonctions réellement exécutées.

Le corpus de comparaison comprend **40 cas de propriétaire, 41 cas de géométrie, 50 cas de méthodes et préparation, 21 cas de sélection**, puis trois contrôles complémentaires de provenance et d'enchaînement, soit **155 contrôles**. Il compare les propositions complètes, leurs reçus SRC, leurs refus et les huit champs d'état source. Les exceptions conservées vérifient le refus ; leurs classes Python et TypeScript ne sont pas présentées comme identiques. Les [tests de référence](../../tests/v6-ranked-workshop-reference.test.ts) distinguent notamment la préparation inconnue, l'utilisation conditionnelle d'un support observé, les ambiguïtés, les réfutations et les bornes de coût.

Les [quatre contrats du Kernel](../../tests/v6-ranked-workshop-kernel.test.ts) utilisent la fabrique de production et son ordre stratégique. Ils établissent le propriétaire unique, l'acquisition passive à froid, l'appel effectif des callbacks, la sélection WHY/ACT, l'enregistrement unique du retour, la restauration du propriétaire depuis le graphe autoritaire et la revalidation dans une nouvelle portée. Les modifications d'image de ces contrats sont **synthétiques et déclarées** ; elles ne comptent pas comme des niveaux de jeu.

La [validation intégrée](lot7a-evidence/integrated-final/validation/delta-tests-run.json) passe **3 745/3 745 tests dans 97 fichiers**, avec les sources et les tests inchangés. Le périmètre est l'union déclarée des contrats 7A et 4A, sans retrait des tests précédents. Les [cinq contrôles de projet](lot7a-evidence/integrated-final/project-checks-retry/validation/checks-run.json) passent : TypeScript, registre, audit de migration, différences et compilation. Le [contrôle d'intégrité](lot7a-evidence/integrated-final/delivery-integrity.json) confirme les inventaires, les sources originales, l'archive et les reçus fonctionnels de ce gel.

Les incidents antérieurs restent consultables. Le [premier contrôle isolé](lot7a-evidence/final/validation/delta-tests-run.json) conservait **2 960/2 961 tests réussis dans 78 fichiers** ; son attente d'adjacence Inventory a été [corrigée selon l'ordre DRM](lot7a-evidence/diagnostic/inventory-order-expectation-correction.json), puis vérifiée dans le passage intégré. L'[alias Workshop du test de registre](lot7a-evidence/diagnostic/radial-alias-correction.json) est également couvert. La première tentative de compilation intégrée a échoué avant exécution sur l'ancien chemin du helper Sites 1.1.5 ; la [reprise avec 1.1.6](lot7a-evidence/integrated-final/build-helper-path-resolution.json) conserve le reçu initial et [réutilise le reçu de tests à l'identique](lot7a-evidence/integrated-final/project-checks-retry/test-receipt-reuse.json).

Les [sept régressions intégrées enregistrées](lot7a-evidence/integrated-final/regressions/regression-summary.json) passent **119/119 contrôles**, sur **292 actions, 210 préfixes et 21 frontières naturelles**. CATR, RSWP, FOGW, VOIS, MIND et WEAV utilisent les rapports réels de native 0.51, dont les octets sont rattachés au commit 4A publié. CONN utilise le rapport publié 3I/native 0.50, puisqu'aucun rapport CONN n'a été produit par 4A. Ces rejeux ne constituent ni de nouvelles parties ni des succès propres à l'atelier. La couverture de ces contrats ne signifie pas que tout l'appelant Python est transféré.

## Contribution sur des retours réels de LKEY

La [campagne intégrée conservée](lot7a-evidence/integrated-final/lkey-campaign.json.gz) part du niveau 1 avec le runtime commun froid 0.52. Elle comporte **25 actions et 25 préfixes** : 4 actions de `public_framed_transfer`, 6 du frontier, 14 de l'atelier et 1 d'`animated_contact`. Deux niveaux officiels sont terminés. Le [reçu d'exécution](lot7a-evidence/integrated-final/execution-lkey.json) conserve le statut d'échec de la cible de trois niveaux et l'identité inchangée des sources.

Le premier contraste de mode pertinent provient d'un **retour passif d'`ACTION5`, de la révision 10 à la révision 11**. L'atelier acquiert le contraste `[0,1]`, puis produit les décisions des révisions 11 à 24. Il ne reçoit aucun état appris pour amorcer cette activation.

Le [rejeu Python indépendant intégré](lot7a-evidence/integrated-final/diagnostic/integrated-public-parity.json) reprend les **49 appels capturés**, dans leur ordre, avec un seul `RankedWorkshop()` original initialement vide. Les états natifs avant et après chaque appel sont uniquement des cibles de comparaison. **Les 49 appels concordent : 147 comparaisons exactes d'état avant, de résultat et d'état après.** La comparaison utilise le JSON canonique pour ne pas confondre un booléen avec un nombre.

Les 25 retours sont enregistrés une fois chacun : **14 acquisitions actives, 11 passives, 25 transitions distinctes et aucun doublon**. Les appels de proposition comprennent les abstentions, qui ne sont pas écartées du reçu.

### Connaissances qui ont effectivement changé une décision

Les [ablations intégrées conservées](lot7a-evidence/integrated-final/diagnostic/contribution.json.gz) retirent séparément une couche de connaissance avant chaque proposition sélectionnée. Elles repartent des états produits par le rejeu Python original et gardent la situation publique fixe. Elles établissent une contribution à la décision de composant, sans prétendre simuler une partie entière dans un monde contrefactuel.

| Couche retirée | Résultat sur les 14 propositions sélectionnées |
| --- | --- |
| Toutes les couches apprises | Les 14 propositions disparaissent |
| Preuves de mode courantes | 9 propositions disparaissent, 4 changent de décision, 1 reste identique |
| Méthodes de mode transportables | 1 proposition disparaît, 13 restent identiques |
| Effets de commande observés | 1 proposition disparaît, 13 restent identiques |
| Observations d'opérateurs | Les 14 restent identiques |
| Réfutations de méthodes | Les 14 restent identiques |
| Rejets de contexte | Les 14 restent identiques |
| Historique d'événements | Les 14 restent identiques |

Au **niveau 2, révision 17**, la méthode de mode conservée permet la question de revalidation `ACTION5`. Sans cette méthode, le propriétaire s'abstient. À la **révision 18**, les effets de commande déjà acquis permettent de sélectionner l'unique question de transformation `ACTION3` ; sans eux, cette proposition disparaît.

Le retour de cette transformation change le profil `[1,2,4]` en `[4,2,1]`. L'atelier conserve une hypothèse de renversement des rangs, avec `global_domain_known: false` et les preuves de conservation exigées par la source. **Ce parcours ne montre pas encore cette observation d'opérateur influençant une décision ultérieure** : son ablation laisse les 14 décisions sélectionnées inchangées. Cette réserve reste distincte de l'acquisition réelle de la paire.

## Résultat officiel et réserve sur le troisième niveau

| Étape | Actions cumulées | Niveaux officiellement terminés | Résultat |
| --- | ---: | ---: | --- |
| Passage naturel du niveau 1 au niveau 2 | 16 | 1 | Atelier sélectionné |
| Passage naturel du niveau 2 au niveau 3 | 24 | 2 | Atelier sélectionné |
| Arrêt du parcours | 25 | 2 | `frontier_unknown`, sélection précédente `animated_contact` |

Le diagnostic sur le dernier retour public, **époque 3, révision 26**, trouve une projection admissible et une méthode transportable. L'original Python proposerait **`ACTION5 / revalidate_mode`** avec sa mémoire obtenue par rejeu. Pourtant, aucun appel natif à `proposeSource` de l'atelier n'est capturé à l'époque 3. Le blocage se situe avant sa consultation dans l'appelant commun, après une sélection antérieure d'`animated_contact`.

Ce constat ne justifie ni un changement de priorité propre à LKEY, ni un contournement des gardes. La résolution des trois premiers niveaux et la fermeture de ce cas de coordination restent ouvertes.

### Vérification dans le navigateur final

Le [reçu navigateur intégré 0.52.0](lot7a-evidence/integrated-final/browser/browser-qa.json) confirme, sans état appris injecté, les mêmes passages à **16 puis 24 actions**, et le même arrêt à **25 actions, deux niveaux terminés**. Les commandes **Pause** et **One action** ont été observées respectivement à une puis deux actions. Le temps actif affiché en fin de parcours est **33,2 s** ; ce nombre n'est pas le résultat du protocole de coût. Les [états d'interface](lot7a-evidence/integrated-final/browser/observed-states.json) et la [capture finale](lot7a-evidence/integrated-final/browser/final.png) sont conservés.

La Pause fonctionne dans cette vérification, mais sa latence n'a pas été mesurée. Les projecteurs possèdent des domaines finis ; aucune borne de préemption à l'intérieur d'une mesure synchrone n'est revendiquée.

La [campagne initiale isolée](lot7a-evidence/attempt1/execution-lkey.json) et le [navigateur isolé](lot7a-evidence/final/browser/browser-qa.json) restent disponibles avec leurs propres digests et résultats. Ils ne sont pas réattribués à 0.52 : le candidat intégré possède une nouvelle campagne réelle, un nouveau rejeu source et son propre reçu navigateur sur le digest `f5f4a67d…`.

Le [compteur cumulé figé du cas intégré](lot7a-evidence/integrated-final/lkey-case-checkpoint.json) conserve les tentatives antérieures. Après cette vérification, il est suspendu à **1 341,623 s**, soit **22 min 22 s**, avec **1 058,377 s** restantes sur les 40 minutes. Toute reprise de LKEY doit continuer le [compteur du dossier](lot7a-evidence/lkey-case-checkpoint.json).

## Conservation et restauration

La mémoire native contient les huit champs source, avec une séparation entre connaissances et cache recalculable. Un changement d'époque retire les preuves de mode et les rejets locaux. Il conserve les méthodes, effets et réfutations avec leur portée. Les méthodes historiques doivent être revalidées ; une réfutation locale n'efface pas leur provenance.

Les bornes source sont préservées : 64 effets d'entrée, huit contrastes par méthode, 32 observations d'opérateurs et 32 événements dans l'état exporté. La source ne fixe pas de plafond global supplémentaire pour les méthodes ou les réfutations. Le portage ne leur attribue pas un oubli silencieux.

La restauration effective native vide le cache de projection et les données transitoires de sélection. Cette adaptation au navigateur est explicitée dans la filiation. Les gardes remesurent les dépendances courantes. La projection de raisonnement `observed_ranked_workshop_state` demeure distincte du propriétaire autoritaire `family_state:public_ranked_workshop`.

## Coût, intégration et publication

Le [protocole isolé déclaré](lot7a-evidence/performance/protocol.md), de native 0.49.0 vers le candidat de développement 0.50.0, est **conservé sans aucune mesure** et [supplanté avant exécution](lot7a-evidence/performance/superseded-before-measurement.json). Le [protocole intégré](lot7a-evidence/performance-integrated/protocol.md) et sa [déclaration](lot7a-evidence/performance-integrated/declaration.json) lient désormais **Site 81 / native 0.51** remesuré au candidat gelé **0.52**. Ils fixent **STCK et SMLP, 32 sessions et 400 actions mesurées**, huit chauffes séparées représentant 24 actions exclues, et l'ordre **A1/B1/B2/A2** avant mesure.

Le critère autorisé demeure : **pour chaque jeu séparément, la médiane de durée complète de session doit rester strictement inférieure à +10 %**. Les dépassements de phase restent publiés même lorsque le critère global permet de les accepter. Les phases imbriquées ne sont pas additionnées.

La [readiness](lot7a-evidence/performance-integrated/readiness.json), précédée des [65 contrôles statiques réussis](lot7a-evidence/performance-integrated/static-preflight.json), lie les preuves terminées, le compteur LKEY et l'isolation coordonnée. Elle autorise la mesure ; elle n'en annonce pas le résultat.

### Qualification structurelle fixée avant les mesures

L'ajout de Workshop installe son propriétaire, son activation et son programme. Il acquiert aussi des faits aux frontières officielles, y compris lorsque le jeu de référence ne le sélectionne pas. Le [contrat v2](lot7a-evidence/performance-integrated/owner-growth-contract.json) ne suppose donc pas une croissance constante de trois nœuds. Il lie une [fixture fonctionnelle](lot7a-evidence/performance-integrated/owner-structural-fixture.json) observée avant la fenêtre sur les deux gels : chauffe et session complète pour STCK, puis chauffe et session complète pour SMLP. Les sessions complètes comprennent trois inspections terminales réelles.

La [qualification des graphes](lot7a-evidence/performance-integrated/owner-structural-attribution-02.json) passe **64 contrôles**, avec **55 deltas ou écritures de graphe attribués** et les quatre formes publiques figées. Chaque rapport de coût doit correspondre exactement aux valeurs de sa forme pré-déclarée. Seuls `observations[*].nodeCount`, `inspection[*].graphNodes`, `final.nodeCount` et `final.graphRevision` peuvent différer entre les versions selon cette fixture ; les autres champs restent stricts. Les captures fonctionnelles permettent l'attribution des nœuds, tandis que les compteurs des sessions mesurées ne prétendent pas exposer leurs feuilles privées.

Un [incident de comparaison](lot7a-evidence/diagnostic/owner-structural-command-projection-incident.json) est conservé : la commande native sans champ `data` était comparée directement à sa projection publique `data: {}`. La [correction avant mesure](lot7a-evidence/diagnostic/owner-structural-command-projection-resolution.json) applique exactement la frontière de conversion du service, conserve les deux commandes brutes et rejette les clés inconnues. Ni la source native ni les captures n'ont été modifiées ou régénérées pour cette correction.

Le contrôle historique d'identité intégrale du travail doit conserver son propre résultat. La consolidation complémentaire et sa revue indépendante utilisent des schémas distincts ; elles ne reclassent pas un refus historique comme une réussite. Aucun temps n'est corrigé pour les nœuds supplémentaires, et aucune session mesurée ou valeur défavorable n'est exclue.

<!-- LOT7A_COST_FINAL_START -->

**Le coût global 7A est accepté sur 2/2 jeux sous la règle structurelle déclarée avant mesure**, selon la [revue indépendante](lot7a-evidence/performance-integrated/owner-growth-review.json), **3 866/3 866 contrôles**. La [fenêtre exclusive](lot7a-evidence/performance-integrated/window.json) conserve **A1/B1/B2/A2, 32 sessions et 400 actions**, référence fraîche Site 81/native 0.51 contre native 0.52 :

| Jeu | Médiane complète 0.51 | Médiane complète 0.52 | Variation |
| --- | ---: | ---: | ---: |
| STCK | 9 821,3656235 ms | 9 865,8814085 ms | **+0,453255 %** |
| SMLP | 16 545,1855975 ms | 16 310,572066 ms | **−1,418017 %** |

Les huit sessions par jeu/version sont toutes retenues. Chaque médiane groupée reste **strictement sous +10 %**, sans compensation entre jeux, somme de phases, moyenne de ratios ou exclusion de valeur mesurée. Seules les huit chauffes annoncées, 24 actions, sont exclues. Les phases groupées passent **16/16** ; les cohortes conservent **15/16 puis 16/16**, avec **restauration SMLP +12,133996 %** dans la première. Les p95 groupés augmentent de **+10,534805 % pour la nouvelle décision STCK** et **+50,326822 % pour la restauration SMLP**. Toutes les phases, dispersions, inspections, mesures Pause et mémoire figurent dans le [rapport complet](lot7a-evidence/performance-integrated/results.md).

**L’agrégateur historique strict demeure en échec**, avec son [reçu réel](lot7a-evidence/performance-integrated/aggregation-failure.json). Les **432 différences de signature** correspondent aux quatre chemins structurels et aux formes fonctionnelles fixées avant mesure ; tous les autres champs restent exacts. Les captures fonctionnelles n'exposent pas rétroactivement les feuilles privées des sessions mesurées. Une [correction E/S séparée, après mesure](lot7a-evidence/performance-integrated/diagnostic/owner-cost-io-correction-v1.json), traite uniquement cinq chemins de référence déjà fingerprintés ; l’échec initial et les outils gelés sont conservés. Les outils exécutés sont identifiés séparément, sans changement des règles, calculs, captures, données, seuils ni populations. Cette acceptation qualifiée conserve la réserve LKEY et ne vaut pas parité complète de l’appelant.

L’[intégrité des entrées de publication](lot7a-evidence/integrated-final/publication-inputs.json) confirme les **279 fichiers natifs, 290 membres d’archive, 638 entrées source/tests et 344 entrées du build**, sans nouvelle exécution ni modification du worker déjà compilé.

<!-- LOT7A_COST_FINAL_END -->

### Intégration et inventaire

Le [déploiement réussi du prédécesseur 4A](lot7a-evidence/coordination/published-4a-site81.json), **Site 81 / native 0.51**, est vérifié. Le commit `4dafc40c53ed4406ee7cd148e3e6995a2eb4185e` est un ancêtre du candidat via la fusion `1ceea98d31e659dfed618d121ee4410c88fda378`. Le [reçu de rattachement](lot7a-evidence/coordination/published-base-binding.json) confirme l'identité des sources, des tests, des entrées de compilation et des références 4A utilisées par les rejeux. L'ordre déclaré des familles et leurs propriétaires d'acquisition distincts sont préservés.

L'inventaire intégré donne **56 entrées raccordées sur 76**, soit **20 restantes** : goal 10/12, window 20/21, surface 8/10, material 18/33. L'audit conserve **172 modules vérifiés au niveau composant, 143 partiellement transférés et 1 054 en attente**, sur **1 369 modules Python et 417 fichiers de données** ; aucun module n'est déclaré intégralement vérifié. Ces compteurs mesurent le transfert et les raccordements, pas des pourcentages de résolution. [Registre](lot7a-evidence/integrated-final/project-checks-retry/validation/entry-audit-output.log.gz), [audit de migration](lot7a-evidence/integrated-final/project-checks-retry/validation/migration-audit-output.log.gz).

<!-- LOT7A_PUBLICATION_FINAL_START -->

**La première publication 7A est confirmée dans Site 82**, moteur **0.52.0**, commit **`0ca36b0a6a358e1e89420753bbcec4a33f028e0a`**, déploiement **`succeeded`** et accès privé conservé. Le [reçu Sites](lot7a-evidence/integrated-final/publication-site82.json) lie le commit, la version et l'archive déclarée par le serveur. Le [transport des sources](lot7a-evidence/integrated-final/publication-source-transport.json) conserve tous les commits et l'arbre final exact ; les cinq pushes normaux n'ont produit aucun déploiement intermédiaire. Les 75 fichiers du build ont un contenu identique dans les cinq archives locales, dont les identités de conteneur restent distinctes. Une clôture documentaire ultérieure garde ce même moteur.

<!-- LOT7A_PUBLICATION_FINAL_END -->

## Travail encore nécessaire

Conserver la réserve LKEY L3 et son compteur cumulé ; une reprise doit examiner la coordination commune qui empêche actuellement la consultation de l'atelier. L'acquisition d'une observation d'opérateur reste distincte de la preuve qu'elle influence une décision ultérieure. La parité de tout l'appelant demeure un chantier séparé des contrats de cette famille.

Le lot **7B, transactions symboliques**, demeure distinct. Son propriétaire, son marqueur `symbol_transaction_plan`, ses deux chemins de projection et son acquisition sélectionnée doivent être portés selon leurs propres contrats. La présence de l'atelier ne les considère pas livrés.
