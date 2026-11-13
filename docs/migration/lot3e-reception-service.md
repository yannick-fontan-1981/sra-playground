# Lot 3E : ReceptionService, moteur natif 0.46

## Périmètre de livraison

Transfert de `reception_service_plan` dans le propriétaire commun, après la publication privée 73 / moteur 0.45, commit `79e8fb89521b2d0fa8907e79467f24e7cf8a2b4e`. La branche raccorde la mesure de réception, les contrôles observés, les accès gardés, les attentes cumulées et le retour effectif. La façade compte cinq branches sur six ; `reference_population_plan` reste la prochaine branche autonome. Le compteur complet des entrées reste distinct : 50/76, une entrée partielle, 37 workflows compilés.

Les originaux Python sont des références de développement inchangées. Le moteur de production est TypeScript ; aucun état attendu, parcours enregistré, nom de jeu, rôle de couleur ou coordonnée préparée ne décide d’une commande.

## Contrats propres et adaptations du propriétaire commun

La projection originale mesure les pavés de bord, le pas de la grille, les supports concaves répétés, une demande avec un homologue visible et une constellation de coins contrôlable. Le rôle de réception reste une hypothèse. Les contrôles viennent exclusivement des retours réellement acquis. Un chemin peut préparer un accès partiel ; il ne prouve ni route cachée ni réussite officielle.

La branche conserve son propre état, ses événements, les correspondances résiduelles observées et le budget d’attente V5. La sélection et les gardes précèdent RootedLine ; l’acquisition et le digest viennent après RootedLine, une seule fois par retour. La nouvelle couche n’entre dans le digest qu’après son premier événement, pour conserver les états publiés 0.45.

Trois adaptations natives sont nommées et séparées des comparaisons fidèles aux originaux :

1. Exposed et ReceptionService ont des journaux distincts. Le Python réutilise le même attribut `reception_events`, ce qui peut empêcher l’initialisation du nouvel état et mélange les couches de digest. Le propriétaire natif garde un propriétaire par événement, des acquis séparés et une restauration atomique.
2. La remise à jour du niveau devient acquise au premier retour réel du nouveau contexte. Le Python remet seulement une copie de proposition à jour, puis peut réutiliser l’ancien état lors de l’acquisition. Le natif engage cette copie liée au contexte, une fois. Il efface aussi l’ancienne autorisation stationnaire : une attente groupée exige une nouvelle confirmation dans le niveau courant. Les preuves historiques et les événements résiduels restent conservés.
3. Le compteur d’attente reste dans le domaine V5 de 0 à 128. Le budget général de 600 actions par niveau reste indépendant. Le propriétaire commun borne le maximum d’attente à 128 et bloque quand ce compteur est épuisé ; il conserve une question inconnue. Il ne transforme pas une limite de budget en impossibilité physique.

Les gardes de continuation conservent une limite source : après le premier pas, ils vérifient le layout et le porteur, sans sceller séparément chaque changement de silhouette de demande à layout constant. Le premier pas lie toujours l’image complète. Le registre est donc qualifié dans sa portée de niveau ; une autorisation d’attente entièrement propre à chaque demande reste hors de ce transfert.

Les sorties originales correspondantes, y compris les défauts de portée et erreurs de validation, sont conservées dans les fixtures. Leur correction native n’est pas présentée comme une égalité complète avec la chaîne Python. La filiation détaille cette distinction.

## Vérifications et campagne

Le gel natif est `5adf58cb9bd0802dd083812e7591c53cb786410ad23c14a29814d870ef67276c` : **260 fichiers natifs**, archive de **271 fichiers**. Le périmètre formel passe **1 904/1 904 tests dans 56 fichiers**, sans échec, annulation, test ignoré ou TODO. Les cinq contrôles du projet, compilation comprise, passent. Il s’agit des tests du périmètre affecté, pas de toute la suite historique.

Les rejeux stricts CATR/RSWP passent **34/34 contrôles** contre les rapports réellement recalculés par 0.45 : CATR conserve 12 actions, trois niveaux et huit préfixes ; RSWP conserve 19 actions, trois niveaux et onze préfixes. Ce sont des rejeux de retours publics conservés, pas de nouvelles victoires en direct. Les sept checkpoints produits par le checkout publié 0.45 sont restaurés exactement, y compris Exposed, RootedLine et leur état combiné.

La campagne FOGW atteint **trois niveaux en 50 actions et 27 préfixes**, dans une seule session froide, avec arrivée au niveau 4. Les niveaux demandent respectivement **18, 14 et 18 actions**. Le diagnostic 0.45 s’arrête au plafond extérieur de 16 actions, sans niveau résolu. Ce plafond ne constitue pas un verdict d’échec du jeu complet et ne mesure pas un gain de vitesse.

La preuve de contribution reconstruit les 27 plans propres, 50 commandes/acquisitions, 28 restaurations et 51 observations publiques complètes, sans initialiser la décision avec la mémoire du plan capturé. Sur **162 ablations**, 86 changent les connaissances conservées et **41 changent une action ou un refus**. Les contrôles, essais antérieurs et confirmations stationnaires contribuent sur cette trajectoire. Les ablations du compteur d’attente et des réfutations n’y changent pas la décision ; ces résultats négatifs restent publiés. Les tests de contrat couvrent séparément l’épuisement et la contradiction.

La revue indépendante passe **1 112/1 112 contrôles**, avec deux voies distinctes : l’original inchangé correspond sur sept préfixes et quinze retours, puis lève son erreur de validation quand le maximum d’attente reçoit 585 au lieu d’une valeur au plus égale à 128. Cette erreur est conservée. Une seconde voie appelle les mêmes méthodes originales à travers un adaptateur extérieur qui nomme les corrections natives de propriétaire, d’époque et de budget : elle correspond sur 27 préfixes et 50 retours, sans différence. Aucun original n’est modifié et aucune mémoire native de proposition ne sert d’amorce. Ce second résultat ne prétend pas être l’exécution exacte de l’appelant original complet.

Le navigateur confirme une seconde session froide continue : Pause à zéro action, une action isolée, reprise, puis **50 actions, trois niveaux et 27 plans**. Les passages naturels sont observés aux actions 18, 32 et 50, avec arrivée au niveau 4. La [capture](lot3e-evidence/final/browser/fogw-final.png) et le [reçu](lot3e-evidence/final/browser/browser-qa.json) sont conservés.

Le [compteur cumulatif FOGW](lot3e-evidence/final/fogw-resolution.json) est clos à **951,320275 secondes** sur 2 400, en incluant les erreurs de préparation initiales, la référence, la campagne, les comparaisons, les ablations et le navigateur. Aucun nouvel essai ou diagnostic FOGW ne suit cette clôture dans la livraison. Trois niveaux sont validés ; une victoire sur la totalité du jeu n’est pas revendiquée.

Les horloges antérieures ne sont pas reprises dans ce lot : CWSE reste à 2 399,683865 secondes cumulées, sans nouvel essai ; SK48 reste à 667,35444 secondes cumulées, sans nouvel essai.

## Coût officiel et règle autorisée

**Le coût global est accepté sur les deux jeux.** La fenêtre compare le gel 0.46 à la version publiée 0.45 remesurée, dans l’ordre A1/B1/B2/A2. Elle conserve les **32 sessions mesurées et 400 actions**, sans exclusion de session ni de valeur extrême. Les huit chauffes de trois actions sont les seules exclusions, fixées avant mesure.

| Jeu | Médiane de session 0.45, ms | Médiane de session 0.46, ms | Variation globale | Décision |
| --- | ---: | ---: | ---: | --- |
| STCK | 9759,223419 | 10246,422234 | +4,992188 % | Accepté, strictement sous +10 % |
| SMLP | 17294,480258 | 17319,511997 | +0,144738 % | Accepté, strictement sous +10 % |

La médiane est calculée sur les huit durées complètes de chaque jeu/version. Les cohortes ne sont pas moyennées par ratio, les phases imbriquées ne sont pas additionnées et un jeu ne compense pas l’autre. La [décision globale](lot3e-evidence/performance/global-budget-decision.json) est distincte du diagnostic historique, qui conserve **13/16 critères conformes** et son statut `budget_review_required`.

Les trois dépassements agrégés STCK restent explicitement conservés :

| Phase STCK | Hausse de médiane | Traitement |
| --- | ---: | --- |
| Service d’un préfixe connu | **+15,072714 %** | Acceptée sous la règle globale |
| Requête correspondante, transport inclus | **+12,903517 %** | Acceptée sous la règle globale |
| Garde de continuation | **+13,088074 %** | Acceptée sous la règle globale |

La revue arithmétique indépendante passe **231/231 contrôles**. Les diagnostics de cohorte restent **7/16 puis 14/16**. Les quatre comparaisons globales par cohorte restent sous +10 %, mais **STCK en cohorte 2 atteint +9,823661 %**, proche de la limite. L’acquisition/persistance STCK agrégée est également proche de l’ancienne limite de phase, à **+9,979165 %**. Ces observations ne sont pas effacées par l’acceptation agrégée.

Les queues de latence restent dans le [rapport complet](lot3e-evidence/performance/results.md), avec effectifs et dispersions. Le p95 de la garde STCK passe notamment de **0,281756 à 0,431597 ms**, soit **+53,181121 %**. Le coût global accepté ne prouve donc pas que chaque phase ou chaque queue de distribution reste sous +10 %. Avec huit sessions par version et par jeu, aucun p95 de session n’est annoncé. Ces rejeux mesurent la boucle commune, hors moteur du jeu, rendu et réseau ; ils ne mesurent pas la vitesse FOGW en direct ni une stabilité de plusieurs heures.

## Décision et suite

**3E est clôturé dans son périmètre propre annoncé : transfert, contribution, trois niveaux FOGW, régressions, interface et coût global vérifiés.** Les adaptations natives restent nommées, l’exception de l’original reste conservée, et la revalidation séparée de chaque changement de demande demeure un suivi explicite. Cette clôture ne vaut ni transfert complet de l’héritage Python, ni clôture de la migration.

La prochaine priorité autonome est **3F, `reference_population_plan`** : population observée, appariement injectif, contrôle sélectionné et revalidation courante. Les réserves fonctionnelles CWSE et SK48 restent indépendantes, avec leurs horloges cumulatives conservées.

Les [preuves et commandes de reconstruction](lot3e-evidence/README.md), la [filiation](lot3e-reception-service-lineage.md) et la [feuille de route actualisée](v6-delivery-roadmap.md) accompagnent cette décision. L’index final lie les rapports, les sources, les tests, les archives et les pièces de transport sans régénérer les résultats.
