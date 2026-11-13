# Lot 5B — Matériaux adressés et chemins de clics

## État de livraison

**Le transfert de `observed_addressed_material` est livré dans Site 94 / native 0.58.0, avec validation fonctionnelle, budget global accepté et publication privée confirmée.** Le [reçu terminal](lot5b-evidence/publication/native-publication.json) identifie le commit `fbd968f7c194575777965219f64fa78d3460b08e`, déployé `succeeded` le **11 novembre 2026 à 02:52:58.534517 UTC**, avec audience propriétaire seul, révision **3**, préservée. Cette livraison intègre les prédécesseurs Sites 92/93 après 10A/Sites 90–91. Les **4 900 tests finaux**, les cinq contrôles incluant la compilation, les **dix rejeux et leurs 170/170 comparaisons**, les preuves communes et leur comparaison originale ainsi que le contrôle navigateur sont terminés. La fenêtre officielle accepte **STCK à +3,780905 %** et **SMLP à −1,556219 %** selon le critère global autorisé ; les deux dépassements de phase et le refus du comparateur structurel strict restent conservés.

Le [gel final](lot5b-evidence/integrated-final/source-manifest.json) contient **302 fichiers natifs**, de digest `099444085f0579ce60e226c9dece42110c577538f5f337579305a2e5f65483c4`. Son [archive de sources](lot5b-evidence/integrated-final/source-archive.json) épingle **313 fichiers**. Le [registre du candidat](v6-entry-point-progress.json) compte **62/76 entrées raccordées**, soit **81,6 %**, zéro partielle et 14 ouvertes. Ce compteur décrit le raccordement des entrées ; il ne constitue pas une déclaration de parité globale avec V6.

Le périmètre couvre la chaîne consommée `AddressedMaterial → AddressedField → FieldStock`, avec un propriétaire unique dans le moteur commun. Le [contrat de filiation](lot5b-addressed-material-lineage.md) décrit les conditions source, les refus et les limites du transfert. Le lot 5C, `observed_object_binding`, reste ouvert. Les autres conversations conservent les lots 4, 7 et 10.

## 1. Comportement transféré

Le moteur apprend une hypothèse d’adressage à partir des observations et des commandes effectivement revenues. Il lie chaque clic à un pixel de l’objet actuellement observé, à son époque, à son empreinte et aux preuves de l’hypothèse. Il acquiert une borne de distance acceptée et une borne rejetée ; l’absence d’un effet attendu à l’intérieur d’une portée acquise réfute le modèle.

Après calibration, une proposition peut réunir jusqu’à **16 actions**, sous la limite d’actions restante. Le moteur garde chaque étape avant de l’autoriser. Une réponse inconnue, une frontière officielle, un changement d’état ou une contre-observation ferme le préfixe. Les retours d’un préfixe sont acquis une seule fois lorsqu’il est scellé. Cette continuité est une propriété du chemin produit par la famille ; elle n’autorise pas des clics sans contrôle.

Après une frontière avec augmentation officielle du score, le champ peut conserver un prior conditionnel : action, bornes, formes, offsets et région de but. Le nouvel épisode doit revalider cette hypothèse sur ses observations courantes. Le stock typé reconstruit alors l’échelle des types, les demandes, les corps et les zones. Il peut proposer des déplacements ou des fusions et conserver les origines conjointes d’un produit sans inventer une identité physique de pixels.

Le stock maintient des quantités minimales requises par la demande actuelle. Ces obligations sont collectées avant la sélection commune et s’appliquent à toutes les familles. Une révision doit porter ses preuves de conservation ; un clic proposé par une autre famille ne reçoit pas automatiquement cette autorisation.

## 2. Travail incrémental et frontières

La même instance acquiert les retours sélectionnés et passifs. Chaque enveloppe source, y compris `field_unresolved` avec `events: []`, est enregistrée sous `addressed_material_event:<revision>`. Aucun état source supplémentaire n’est inventé pour remplacer cette acquisition.

Les snapshots immuables du propriétaire sont réutilisés tant que leur révision ne change pas. La restauration native valide le checkpoint avant de modifier le propriétaire. Les bornes de recherche et l’interruption coopérative rendent une absence de résultat explicite ; elles ne fabriquent ni action, ni réfutation. Ces contrats sont des extensions natives déclarées : les classes Python d’origine ne définissent pas d’API `state`/`restore`.

À la frontière, les observations locales, les échantillons et la calibration active sont libérés selon les règles source. Les priors, règles retenues et témoins de réussite restent conditionnels. Les confirmations héritées d’une règle de fusion repartent à zéro dans le nouvel épisode. Cette séparation évite de confondre une preuve ancienne avec une confirmation actuelle. Elle ne constitue pas une purge générale du journal ni une preuve de mémoire constante sur une longue session.

## 3. Contrats et preuves de développement

L’[oracle indépendant](lot5b-evidence/diagnostic/source-oracle-export.json) utilise le Python immuable du commit `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`. Il vérifie les **1 786 fichiers originaux** avant et après son exécution et épingle les quatorze modules réellement importés. Les **14 helpers, 19 chaînes froides et 522 opérations** comparent les retours et l’état source complet. Aucune sortie native n’entre dans le calcul des attentes Python.

Les quatre fichiers de tests 5B passent leurs validations de développement : **35 tests de référence**, **13 tests du stock**, **10 tests des extensions natives** et **4 tests du noyau commun**. La suite intégrée finale est distincte de ces contrôles ciblés. Les erreurs initiales de stimulus, de sérialisation, de compilation et d’instrumentation restent dans les diagnostics.

| Preuve de développement | Résultat effectivement observé | Portée |
| --- | --- | --- |
| [Navigation positive](lot5b-evidence/development/common-positive-02/original-comparison.json) | 169/169 comparaisons originales ; 15 retours, dont cinq propres et dix passifs ; deux clics dans le même préfixe | Boucle native complète sur un tableau public synthétique, avec l’ordre original des familles et les gardes réelles |
| [Navigation sans effet](lot5b-evidence/development/common-negative-01/original-comparison.json) | 164/164 ; 14 retours, dont quatre propres et dix passifs | Le modèle est réfuté et la décision suivante change |
| [Parcours stock complet tenté](lot5b-evidence/development/common-stock-01/partial-original-comparison.json) | 384/384 comparaisons partielles ; une fusion puis un déplacement ; boucle commune **en échec** | La parité des opérations reçues ne transforme pas l’arrêt en parcours terminé |
| [Diagnostic de préservation](lot5b-evidence/development/common-stock-03/original-preservation-diagnostic.json) | Fournisseur original et deux refus originaux identiques aux captures natives | Comparaison des composants de service et de préservation, sans prétendre rejouer tout le routeur original |

### Limite conservée : poursuite du parcours stock

Après la fusion et le déplacement, un fournisseur antérieur de `window_constraints` propose un test de contrôle. La proposition ne déclare pas de révision de l’obligation de quantité minimale. L’original comme le natif rejettent ce clic. Le second choix source retrouve le même candidat, car ce fournisseur s’appuie sur la disponibilité publique de l’action malgré la liste d’inputs filtrée. La boucle s’arrête avec `frontier_preservation_conflict`.

Les trois essais stock échoués restent épinglés et échoués. Le [plan final](lot5b-evidence/coordination/common-proof-plan.json), déclaré après ce diagnostic et avant les exécutions intégrées, ajoute un contrat distinct : contribution stock réellement acquise, puis refus source respecté. Il exige une comparaison originale indépendante du fournisseur et de la préservation. **Ce contrat borné ne revendique ni une traversée complète du tableau stock ni une réussite de jeu.** La chaîne du composant source, séparément, couvre deux fusions et neuf déplacements ; ces onze actions ne sont pas attribuées à la boucle commune.

## 4. Intégration et validation finale

Le [successeur 10A effectivement publié](lot5b-evidence/coordination/published-10a-site91.json) est intégré ; ses **294 fichiers natifs** correspondent à son [inventaire publié](lot5b-evidence/coordination/published-10a-source-verification.json). Le [successeur 4C, Site 92 / native 0.57.0](lot5b-evidence/coordination/published-4c-source-verification.json), est également intégré après comparaison de ses **298 fichiers natifs** avec les objets Git publiés. Les conflits de fusion ont conservé les propriétaires, leurs acquisitions, leurs entrées ordonnées et leurs événements.

La [réconciliation avec la clôture documentaire Site 93](lot5b-evidence/coordination/published-4c-documentation-closure-reconciliation.json) est passée. Elle vérifie que les sources natives, tests, scripts et entrées de build sont inchangés entre les publications 92 et 93. Le gel candidat conserve son digest et sa base d'archive `ee0c2e663a68e7ac7b272625adf929fcac483956` ; la référence de coût déclarée reste **Site 92**.

### Preuves terminées sur le gel final

| Preuve | Résultat effectivement observé | Portée |
| --- | --- | --- |
| [Navigation positive](lot5b-evidence/integrated-final/common-positive/original-comparison.json) | **169/169 contrôles** ; 54 opérations, 15 retours dont cinq propres et dix passifs ; 7/7 étapes | Le journal de la boucle commune est rejoué à froid par le Python original |
| [Navigation sans effet](lot5b-evidence/integrated-final/common-negative/original-comparison.json) | **164/164** ; 52 opérations, 14 retours dont quatre propres et dix passifs | La réfutation attendue du modèle modifie la décision suivante |
| [Contribution stock suivie du refus](lot5b-evidence/integrated-final/common-stock/original-comparison.json) | **199/199** ; 63 opérations, 16 retours dont six propres ; **deux actions stock : une fusion et un déplacement** | Contrat `stock-preservation-refusal` : **8/17 étapes**, puis arrêt de préservation ; parcours complet non revendiqué |
| [Fournisseur et préservation originaux](lot5b-evidence/integrated-final/common-stock/original-preservation-comparison.json) | **835/835** ; même proposition du fournisseur et mêmes deux refus de préservation | Mémoire service reconstruite depuis les 16 retours, avec quatre retours service sélectionnés, douze passifs et quatre événements imbriqués |
| [Navigateur TRIA](lot5b-evidence/integrated-final/browser/browser-qa.json) | **Trois niveaux résolus, 17 actions, 17 plans**, arrivée au niveau 4 ; Pause à deux actions, puis « One action » fait passer le compteur à trois | Régression d'interface sur un jeu déjà utilisé, progression naturelle sans remise à zéro de la mémoire ; aucune contribution propre du matériau adressé ni mesure de latence déduite |

Les trois exports originaux finaux vérifient chacun les **1 786 fichiers immuables avant et après**, sans modification, et commencent avec un propriétaire froid. Les résultats natifs ne servent pas à calculer les attentes originales. Les sept commandes d'export et de revue ont un code retour nul ; leurs journaux complets, transports gzip et reçus d'exécution sont conservés à côté des comparaisons. La revue de préservation vérifie aussi l'inventaire original complet et les entrées exactes de ses deux appels. Les trois anciens essais stock restent échoués ; le nouveau contrat borné ne les requalifie pas.

### Tests finaux et rejeux terminés

Le [plan intégré](lot5b-evidence/coordination/integrated-test-scope-plan.json) déclare une union ordonnée de **125 fichiers de tests**. Le [résultat final](lot5b-evidence/integrated-final/validation/delta-tests-run.json) est **4 900/4 900 tests réussis**, sans échec, annulation, test ignoré ni test en attente. Les [cinq contrôles](lot5b-evidence/integrated-final/validation/checks-run.json) passent également : vérification des types, audit des entrées, audit de migration, contrôle du diff et compilation. Le reçu confirme que les sources natives sont restées inchangées.

Les [dix rejeux publics](lot5b-evidence/integrated-final/regressions/regression-summary.json) passent **170/170 contrôles** sur les [cas déclarés](lot5b-evidence/integrated-final/regression-cases.json) : **357 actions, 275 préfixes, 632 requêtes, 30 frontières naturelles de niveau, 367 paquets publics complets et 1 676 images d'animation**. Le moteur recalcule chaque commande avant de recevoir le retour public archivé. Les comparaisons gardent les commandes, sélections, gardes, frontières et résultats publics de leur contrat historique ; elles ne prétendent pas comparer tous les contenus privés, le graphe complet ou le routeur Python entier. Ces rejeux de traces ne constituent ni de nouvelles réussites en jeu ni une mesure d'accélération.

### Publication 5B — Site 94 confirmé

La [publication réelle Site 94](lot5b-evidence/publication/native-publication.json) confirme native **0.58.0**, le commit `fbd968f7c194575777965219f64fa78d3460b08e` et le statut terminal `succeeded` du **11 novembre 2026 à 02:52:58.534517 UTC**. L'URL existante et l'audience propriétaire seul, révision **3**, sont conservées. Sites 92/93 restent les prédécesseurs 4C ; la référence du coût reste Site 92.

Le [plan de transport](lot5b-evidence/publication/lot5b-source-push-plan.json) conserve **cinq envois sources**. La [vérification finale réussie](lot5b-evidence/publication/final-source-build-verification-02.json) confirme **755 fichiers gelés par checkout**, dans les deux checkouts, et **75 membres applicatifs dans chacune des cinq archives locales**, soit **375 comparaisons exactes** avec le build déjà validé, sans recompilation. Les sources, tests, entrées de build et worker sont inchangés. Le tar conservé par le serveur est identifié par le reçu Sites ; il n'a pas été téléchargé pour une comparaison indépendante de ses membres.

Le [premier contrôle](lot5b-evidence/publication/final-source-build-verification.json) reste **échoué, code 1**, avec son [reçu d'exécution](lot5b-evidence/publication/verifier-attempt01-execution.json) : le journal brut `aggregation-failure.log`, ignoré par Git, manquait dans le checkout de publication. Sa [restauration octet pour octet](lot5b-evidence/publication/ignored-proof-restoration.json) a permis le second contrôle sans modifier aucune source, aucun test, aucun build ni aucune donnée de coût. Ce premier échec et le refus strict de coût restent deux preuves distinctes, toutes deux conservées.

La clôture documentaire de ces reçus conserve le moteur publié. Son éventuelle publication ultérieure sera identifiée séparément à partir de son reçu réel.

## 5. Règle et mesure du coût

La consigne utilisateur est appliquée au **temps de session complet**, séparément sur STCK et SMLP : la médiane groupée du candidat doit rester **strictement en dessous de +10 %** par rapport à la référence publiée remesurée. Un jeu ne compense pas un autre. Les durées de phases imbriquées ne sont pas additionnées.

La [fenêtre officielle](lot5b-evidence/performance-integrated/window.json) s'est déroulée le **11 novembre 2026, de 02:18:39 à 02:27:33 UTC**, dans l'ordre déclaré A1/B1/B2/A2. Les quatre séries et leur intégrité finale passent. Elle conserve **32 sessions mesurées et 400 actions**, avec huit sessions par jeu et version ; **huit chauffes et leurs 24 actions** sont séparées. Aucune session mesurée ni valeur extrême n'est exclue. L'[isolation](lot5b-evidence/performance-integrated/coordinated-isolation-completion.json) confirme le verrou exclusif sur toute la fenêtre et les **12 voies de travail connues au calme** à ses deux bornes.

La [qualification structurelle préalable](lot5b-evidence/performance-integrated/owner-structural-attribution.json) passe **64/64 contrôles** : elle attribue les structures ajoutées à l'installation du propriétaire, à son checkpoint, aux enveloppes source des retours passifs et aux fragments atteignables réellement capturés. Le [précontrôle statique](lot5b-evidence/performance-integrated/static-preflight.json) passe **68/68 contrôles** et confirme les entrées gelées, la référence Site 92 et l'absence de mesure dans ce contrôle. Ces captures fonctionnelles et vérifications ne sont pas des mesures de coût.

### Résultat de coût global accepté, diagnostics conservés

Le [rapport complet](lot5b-evidence/performance-integrated/results.md) conserve les 32 sessions, les phases, la dispersion et les p95. La [revue indépendante](lot5b-evidence/performance-integrated/owner-growth-review.json) passe **11 865/11 865 contrôles** et accepte **2/2 jeux** sous le statut `accepted_under_predeclared_owner_cost_rule`.

| Jeu | Médiane de session Site 92, ms | Médiane du candidat, ms | Variation globale | Décision |
| --- | --- | --- | --- | --- |
| STCK | 10 879,140 | 11 290,470 | **+3,780905 %** | Accepté, strictement sous +10 % |
| SMLP | 17 079,561 | 16 813,765 | **−1,556219 %** | Accepté, strictement sous +10 % |

Le diagnostic agrégé par mesure reste **14/16**, avec deux dépassements conservés : **restauration STCK +13,032972 %** et **garde du préfixe connu SMLP +11,650805 %**, tous deux classés `over_budget_with_noise_unresolved`. Les deux cohortes gardent respectivement **11/16** et **14/16** diagnostics dans le seuil, sans choisir la plus favorable. Les huit sessions de chaque jeu et version sont réunies pour la décision globale ; les ratios des cohortes ne sont pas moyennés. Ces dépassements de phase sont acceptables selon la consigne utilisateur puisque le temps complet de chaque jeu reste sous +10 %.

Le [comparateur historique strict](lot5b-evidence/performance-integrated/aggregation-failure.json) conserve son **échec réel, code retour 1**, sur l'identité des métadonnées de travail. Il n'est pas requalifié en succès. La consolidation distincte applique le [contrat structurel déclaré avant mesure](lot5b-evidence/performance-integrated/owner-growth-contract.json) et vérifie **432 écarts de compteurs structurels** contre leurs formes fonctionnelles attendues. Ce nombre ne désigne pas 432 nouveaux deltas du moteur. Les autres métadonnées restent comparées, les signatures demeurent stables dans chaque version, et aucune durée n'est corrigée pour compenser l'ajout du propriétaire.

Les pointes de latence restent une réserve visible : dans cette fenêtre, le p95 des gardes passe de **0,398 à 9,531 ms sur STCK** et de **0,620 à 10,219 ms sur SMLP**. Le rapport conserve les autres hausses et les valeurs indisponibles ; cette observation ne suffit pas à en attribuer la cause. Le budget accepté sur STCK/SMLP n'établit pas une accélération générale, une contribution propre de cette famille sur ces jeux ou une latence constante au fil de niveaux plus longs.

## 6. WEAV et rapidité perçue

Le budget cumulatif WEAV antérieur reste épuisé : aucune nouvelle exécution réelle et aucune remise à zéro ne sont autorisées par cette livraison. La compatibilité des traces déjà enregistrées peut être vérifiée sans annoncer la résolution du niveau 6.

5A a établi le transport commun des chemins de touches et mixtes ; 5B ajoute une famille capable de produire ses chemins de clics adressés. Cela ne prouve pas encore que WEAV choisit ces chemins, que ses coups forcés sont reconnus plus tôt ou que sa latence reste stable quand les niveaux progressent. Ces résultats doivent être distingués des tests synthétiques et du budget global sur les deux séquences de mesure.

## 7. Feuille de route du lot 5

| Priorité | Travail | Condition de sortie |
| --- | --- | --- |
| Livré | 5B — Site 94 / native 0.58.0 | Publication privée et intégrité sources/build vérifiées ; 4 900 tests, 170 contrôles de rejeu, cinq contrôles incluant la compilation, preuves communes bornées, navigateur et budget global acceptés |
| Prochaine étape | 5C — `observed_object_binding` | Une entrée restante dans le lot 5 : liaison de l'objet courant, conservation et retours de composition, avec restauration et frontières |
| Réserve explicite | Coordination après le préfixe stock | Un parcours commun peut continuer en respectant les obligations ; aucun contournement du refus source |
| Suivi transversal | Temps de décision, persistance, restauration, pointes de latence et données des anciens niveaux | Suivre notamment la restauration STCK et les gardes SMLP ; mesurer des parcours assez longs et attribuer les gains, sans déduire une accélération générale du budget global accepté |
| WEAV | Niveau 6 et croissance de la latence | Budget et campagne distincts établis ; aucune réussite anticipée |

L'[index des preuves](lot5b-evidence/README.md) conserve les diagnostics et les résultats à leur portée réelle. La [feuille de route générale](v6-delivery-roadmap.md) porte la coordination entre les lots ; les éléments encore en attente ci-dessus ne sont pas présentés comme achevés.
