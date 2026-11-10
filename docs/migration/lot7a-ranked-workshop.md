# Lot 7A : atelier à rangs, résultats et état de livraison

## État au 10 novembre 2026

**Le composant `observed_ranked_workshop` est porté, raccordé au runtime commun et vérifié sur ses contrats. Sa contribution est observée sur les deux premiers niveaux de LKEY. Le troisième niveau reste ouvert.**

Ce compte rendu est préparé sur la branche du lot 7. **Le verdict de coût, l'intégration dans la branche commune et la publication restent à compléter par le responsable de livraison.** Le présent document ne les déclare pas accomplis.

| Identité | Valeur vérifiée |
| --- | --- |
| Référence Python V6 | `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e` |
| Base du travail | `8fa6b261b8b23ac8d232e60c9c179e2f3407d82f`, Site 78, native 0.49.0 |
| Commit du portage et du raccordement | `7c4c34797bf0bc374b448c985d0dee2fadfb81ca` |
| Candidat natif | `logos-engine.typescript.v6.native-migration/0.50.0` |
| Digest des 274 fichiers natifs du candidat | `8492388162915bd01be1279d645870d366f0fd306e4f31ea47e8b65aafebac7e` |
| Propriétaire | `public_ranked_workshop` |
| Entrée déclarée | `factored_material_return / observed_ranked_workshop` |
| Workflow exécuté | `v6.ranked_workshop.choose` |

L'[inventaire gelé](lot7a-evidence/final/source-manifest.json), l'[archive du candidat](lot7a-evidence/final/source-archive.json) et la [filiation détaillée](lot7a-ranked-workshop-lineage.md) permettent de distinguer le code livré, les primitives V5 effectivement consommées et les capacités qui restent hors du lot.

## Comportement ajouté à Logos Engine

L'atelier mesure les profils ordonnés visibles, les marqueurs, les coupes de référence et leurs relations courantes. Il peut ensuite formuler une question de préparation, d'accès, d'échange, de transformation ou de réception. Son activation repose sur un contraste de mode réellement acquis, ou sur une méthode transportable soumise à une nouvelle vérification.

Le workflow appelle effectivement **`workshop.measure`**, puis **`workshop.select`**. Le choix respecte le DRM original : priorité des familles de propositions, coût conditionnel des préparations, regroupement des propositions équivalentes et abstention en présence d'alternatives distinctes. La proposition conserve sa composition **OP18**, ses inconnues et ses falsificateurs.

Avant exécution, la garde vérifie l'observation, l'époque, la progression officielle, l'image, l'action disponible et la projection mesurée. Après l'action, elle scelle le préfixe avec un résultat encore inconnu. Seul le retour observé peut acquérir un contraste, un effet de commande, une méthode ou une réfutation. Un ajustement de profil reste une hypothèse locale ; un reçu ne devient pas une preuve d'occupation persistante.

Le propriétaire enregistre ses actions sélectionnées. Il reçoit aussi les retours des autres familles, dans le passage passif prévu par l'appelant source. Le passage passif exclut explicitement le propriétaire déjà enregistré activement. Le constructeur du runtime vérifie en outre que le propriétaire d'acquisition est l'instance enregistrée, et refuse un second objet portant seulement le même identifiant.

## Fidélité aux sources et boucle commune

L'[exporteur indépendant](../../scripts/export-v6-ranked-workshop-reference.py) exécute les originaux Python, SRC et DRM et vérifie les **1 786 fichiers** du manifeste avant et après génération. Il désactive les écritures de bytecode et détourne sa lecture vers un répertoire temporaire vide. La [fixture conservée](../../tests/fixtures/v6-ranked-workshop-reference.json.gz) contient les empreintes des sources et les fonctions réellement exécutées.

Le corpus de comparaison comprend **40 cas de propriétaire, 41 cas de géométrie, 50 cas de méthodes et préparation, 21 cas de sélection**, puis trois contrôles complémentaires de provenance et d'enchaînement, soit **155 contrôles**. Il compare les propositions complètes, leurs reçus SRC, leurs refus et les huit champs d'état source. Les exceptions conservées vérifient le refus ; leurs classes Python et TypeScript ne sont pas présentées comme identiques. Les [tests de référence](../../tests/v6-ranked-workshop-reference.test.ts) distinguent notamment la préparation inconnue, l'utilisation conditionnelle d'un support observé, les ambiguïtés, les réfutations et les bornes de coût.

Les [quatre contrats du Kernel](../../tests/v6-ranked-workshop-kernel.test.ts) utilisent la fabrique de production et son ordre stratégique. Ils établissent le propriétaire unique, l'acquisition passive à froid, l'appel effectif des callbacks, la sélection WHY/ACT, l'enregistrement unique du retour, la restauration du propriétaire depuis le graphe autoritaire et la revalidation dans une nouvelle portée. Les modifications d'image de ces contrats sont **synthétiques et déclarées** ; elles ne comptent pas comme des niveaux de jeu.

Le [premier contrôle élargi](lot7a-evidence/final/validation/delta-tests-run.json) conserve **2 960/2 961 tests réussis dans 78 fichiers**, sans modification native. L'unique échec provient d'une ancienne attente d'adjacence dans le test d'Inventory. La [correction tracée](lot7a-evidence/diagnostic/inventory-order-expectation-correction.json) vérifie désormais l'ordre des entrées connectées contre le DRM original ; elle sera rejouée dans la validation intégrée. Les [quatre régressions enregistrées](lot7a-evidence/final/regressions/regression-summary.json) passent **68/68 contrôles**, sur **159 actions, 88 préfixes et 12 frontières naturelles** CATR/RSWP/FOGW/VOIS. Elles ne constituent ni de nouvelles parties ni des succès propres à l'atelier. La couverture de ces contrats ne signifie pas que tout l'appelant Python est transféré.

## Contribution sur des retours réels de LKEY

La [campagne conservée](lot7a-evidence/attempt1/lkey-campaign.json.gz) part du niveau 1 avec le runtime commun froid. Elle comporte **25 actions et 25 préfixes** : 4 actions de `public_framed_transfer`, 6 du frontier, 14 de l'atelier et 1 d'`animated_contact`. Deux niveaux officiels sont terminés.

Le premier contraste de mode pertinent provient d'un **retour passif d'`ACTION5`, de la révision 10 à la révision 11**. L'atelier acquiert le contraste `[0,1]`, puis produit les décisions des révisions 11 à 24. Il ne reçoit aucun état appris pour amorcer cette activation.

Le [rejeu Python indépendant](lot7a-evidence/diagnostic/attempt1-public-parity.json) reprend les **49 appels capturés**, dans leur ordre, avec un seul `RankedWorkshop()` original initialement vide. Les états natifs avant et après chaque appel sont uniquement des cibles de comparaison. **Les 49 appels concordent : 147 comparaisons exactes d'état avant, de résultat et d'état après.** La comparaison utilise le JSON canonique pour ne pas confondre un booléen avec un nombre.

Les 25 retours sont enregistrés une fois chacun : **14 acquisitions actives, 11 passives, 25 transitions distinctes et aucun doublon**. Les appels de proposition comprennent les abstentions, qui ne sont pas écartées du reçu.

### Connaissances qui ont effectivement changé une décision

Les [ablations conservées](lot7a-evidence/diagnostic/contribution.json.gz) retirent séparément une couche de connaissance avant chaque proposition sélectionnée. Elles repartent des états produits par le rejeu Python original et gardent la situation publique fixe. Elles établissent une contribution à la décision de composant, sans prétendre simuler une partie entière dans un monde contrefactuel.

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

Le [reçu navigateur du candidat 0.50.0](lot7a-evidence/final/browser/browser-qa.json) confirme, sans état appris injecté, les mêmes passages à **16 puis 24 actions**, et le même arrêt à **25 actions, deux niveaux terminés**. Les commandes **Pause** et **One action** ont été observées respectivement à une puis deux actions. Le temps actif affiché en fin de parcours est **28,1 s** ; ce nombre n'est pas le résultat du protocole de coût.

La Pause fonctionne dans cette vérification, mais sa latence n'a pas été mesurée. Les projecteurs possèdent des domaines finis ; aucune borne de préemption à l'intérieur d'une mesure synchrone n'est revendiquée.

L'essai initial portait le digest `2646d38c1cb09dc846fdb1f4811e578b51ba3b2030bf4282457e8b00b68c3d72`. La différence native avec le candidat final est limitée au numéro d'implémentation et au contrôle d'unicité du propriétaire dans le constructeur. Le corps de la famille et son acquisition sont inchangés ; le navigateur final possède son reçu propre sur le digest `84923881…`.

Le [compteur cumulé du cas](lot7a-evidence/lkey-case-checkpoint.json) conserve les tentatives antérieures. Après cette vérification, il est suspendu à **1 120,676 s**, avec **1 279,324 s** restantes sur les 40 minutes. Toute reprise de LKEY doit continuer ce compteur.

## Conservation et restauration

La mémoire native contient les huit champs source, avec une séparation entre connaissances et cache recalculable. Un changement d'époque retire les preuves de mode et les rejets locaux. Il conserve les méthodes, effets et réfutations avec leur portée. Les méthodes historiques doivent être revalidées ; une réfutation locale n'efface pas leur provenance.

Les bornes source sont préservées : 64 effets d'entrée, huit contrastes par méthode, 32 observations d'opérateurs et 32 événements dans l'état exporté. La source ne fixe pas de plafond global supplémentaire pour les méthodes ou les réfutations. Le portage ne leur attribue pas un oubli silencieux.

La restauration effective native vide le cache de projection et les données transitoires de sélection. Cette adaptation au navigateur est explicitée dans la filiation. Les gardes remesurent les dépendances courantes. La projection de raisonnement `observed_ranked_workshop_state` demeure distincte du propriétaire autoritaire `family_state:public_ranked_workshop`.

## Coût, intégration et publication

Le [protocole isolé déclaré](lot7a-evidence/performance/protocol.md), de native 0.49.0 vers le candidat de développement 0.50.0, est **conservé sans aucune mesure** et [supplanté avant exécution](lot7a-evidence/performance/superseded-before-measurement.json). La coordination existante prévoit les publications 3I puis 4A ; 7A intégrera leurs commits effectivement publiés et déclarera le coût du candidat commun dans `performance-integrated`. Le protocole garde **STCK et SMLP**, 32 sessions mesurées au total, les seules chauffes exclues et l'ordre A1/B1/B2/A2 fixé avant mesure.

Le critère autorisé demeure : **pour chaque jeu séparément, la médiane de durée complète de session doit rester strictement inférieure à +10 %**. Les dépassements de phase restent publiés même lorsque le critère global permet de les accepter. Les phases imbriquées ne sont pas additionnées.

**Résultats et verdict du coût : en attente.** Compléter cette section avec les reçus finaux, les médianes par jeu, les diagnostics de phase et les percentiles disponibles. Les temps de campagne et du navigateur ci-dessus ne remplacent pas cette mesure.

**Intégration : en attente de réconciliation et de livraison par le responsable.** Les fichiers communs doivent être relus sur la branche courante pour préserver les lots 3 et 4. L'inventaire de ce commit donne 54 entrées raccordées sur 76, soit 22 restantes ; ce compteur doit être recalculé après réconciliation. Il mesure des raccordements, pas des pourcentages de résolution.

**Publication : en attente.** Renseigner le commit effectivement poussé, la version Sites et le résultat du déploiement. Le commit local et la vérification du preview ne constituent pas une publication.

## Travail encore nécessaire

Terminer les validations finales et le contrôle de coût, puis réconcilier et livrer le candidat par le circuit existant. Conserver la réserve LKEY L3 et son compteur cumulé ; une reprise doit examiner la coordination commune qui empêche actuellement la consultation de l'atelier.

Le lot **7B, transactions symboliques**, demeure distinct. Son propriétaire, son marqueur `symbol_transaction_plan`, ses deux chemins de projection et son acquisition sélectionnée doivent être portés selon leurs propres contrats. La présence de l'atelier ne les considère pas livrés.
