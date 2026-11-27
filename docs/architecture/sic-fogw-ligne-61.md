# FOGW · préparer un récepteur pour obtenir le contact attendu

## Contrat de la ligne 61 avant qualification

Le lot part du gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. Le témoin est `public_occurrence_recall / observed_composition_services / reception_service`, FOGW L1 T1 `ACTION1`. La première décision est une sonde de contrôle, `control_probe`. Les seize occurrences du catalogue sont les seize premiers tickets de ce parcours. Le lancement historique utilise le pack natif par défaut, L1, graine 0, plafond 16 pour la session et 600 par niveau. L’historique et le gel démarrent à 19 h 47 min 48 s UTC−3 le 27 novembre 2026. Premier rejeu terminé sur le gel à 19 h 48 min 17 s (28,74 s), sur `8ce7ee35` à 19 h 48 min 26 s (38,31 s). [Catalogue](sic-v8-strategies-observees.md?plain=1#L87) · [Matrice](sic-v8-composition-des-98-strategies.md?plain=1#L101)

| Situation à éprouver | Comportement attendu |
|---|---|
| Préfixe de seize commandes | Distinguer la sonde du déplacement d’accès, l’arrivée sur le support du maintien en place, puis la mesure autorisant une attente répétée. Rattacher chaque fait au bon sujet, à son observation et à la commande. |
| Observation prolongée | La stationnarité ne suffit pas à établir la capture. Chercher un changement public propre à la demande et le passage de niveau, puis la première décision du niveau suivant. Tenir le prolongement hors du dénominateur initial. |
| Offre ancienne ou mauvais récepteur | L’offre doit être refusée sur une référence périmée ou si le support lié change. Pour une attente de plusieurs pas, préserver la tolérance aux objets momentanément masqués et aux changements d’apparence du porteur, tout en éprouvant le cas d’une demande visiblement différente. |
| Second contexte | Éprouver la décision d’attendre avec un vrai second contexte de jeu ou une situation publique contrôlée. Changer uniquement la preuve qui justifie la préparation et constater quelle offre est encore consommable. |

La carte vectorielle de `createSicReceptionAccess` relève du mode SIC exclusif. Son emploi dans ce parcours doit être établi par la chaîne native avant de lui attribuer un résultat.

### Premier écart préenregistré, hors du parcours historique

Après le retour de T17, la variante remplace la croix demandée dans l’afficheur par un L de trois pixels et rend visible un seul L correspondant en (28,26). Le support reste (50,26), son dessin et le porteur sont inchangés. L’offre préparée à la révision 17 cible la croix `8081538d…`. La scène actuelle distingue le L `0c273d66…`. Sur le gel, le service conserve la projection de position vraie, maintient le préfixe de huit actions et libère `…:native:18`, `ACTION4`, indice 1, pour la croix. L’arrêt de la commande n’est plus une preuve d’attente pour cet ancien sujet.

**Extraction à parité.** Rendre appelable l’offre d’observation du récepteur déjà placé. Garder le choix de commande sortante, l’essai unitaire ou répété, le budget, le traitement d’une absence d’offre et les refus actuels. Les témoins historiques et cette continuation construite doivent être identiques au gel sur ce premier SHA.

**Correctif distinct.** Le retour T17 doit conserver le verdict physique sur la position et fermer la continuation de l’ancienne demande. À la prochaine sélection, seul un plan lié à la révision 18 et à la demande actuelle peut être autorisé. L’ancienne autorisation de huit attentes ne vaut plus pour le L. Une première mesure unitaire reste possible à la même position et peut garder la commande `ACTION4`. La disparition temporaire du mobile avec demande retenue, son mouvement sur le plateau et la recoloration ordinaire du porteur ne suffisent pas à révoquer la préparation.

## Deux réceptions dans le service natif

`V6AgentService` consomme le plan de `SharedSeriesConstraint`. Ce dernier interroge `proposeReceptionService`, délègue ses gardes à `receptionServiceBefore/After` et l’acquisition à `ReceptionServiceMemory.record`. `measureReceptionService` rapproche la silhouette affichée d’un corps visible et identifie le support concave. `receptionServiceCarriers` retrouve le porteur. Le sujet de l’attente associe la demande et le support. La position courante du mobile peut varier. Le porteur peut changer de couleur en se plaçant. Cette entrée n’appelle pas `createSicReceptionAccess` ni l’utilitaire axial du candidat `a5a90c33`. [Aiguillage et acquisitions](../../src/logos-engine/v6-shared-series.ts) · [Mesure et chemin](../../src/logos-engine/v6-reception-service-observation.ts) · [Plan, gardes et mémoire](../../src/logos-engine/v6-reception-service-access.ts)

| Preuve publique et décision | L1 | L2, prolongement du même départ |
|---|---|---|
| Rechercher la commande | T1, porteur (30,42), support (50,26). `ACTION1` n’a pas de projection établie. T3 et T4 établissent les déplacements horizontaux opposés. | T19, nouvel epoch, porteur (46,42), `ACTION1`. Le compteur d’attente repart à zéro et la permission de L1 a expiré. |
| Préparer le récepteur | T5–T9, accès horizontal. T10 mesure le pas vertical. T11–T15, le plan d’accès atteint (50,26), retour conforme. | T27, le récepteur atteint le support. |
| Mesurer le maintien | T16, `ACTION4` vers l’extérieur, un seul pas. Le changement de couleur du porteur est admis. Le retour mesure (0,0) et sa position (50,26), dépense une attente et rattache la mesure aux deux observations. | T28, même commande et même mesure, première dépense du nouvel epoch. |
| Attendre puis observer le contact | T17, huit pas admissibles, premier ticket. T18, deuxième ticket. | T29, huit pas admissibles. T32, quatrième ticket. |
| Clore et reprendre | À T18, l’afficheur public de la croix passe de quatre pixels 3 et cinq pixels 5 à quatre pixels 14 et cinq pixels 0 dans la deuxième image. Passage en L2, puis sonde T19. | Même marque de capture à T32 et passage en L3. La fixture finit sur l’observation d’entrée de L3. |

Le témoin de capture provient de l’animation de l’environnement. `FogHiddenMotionEngine._transition` ajoute l’objet demandé à `caught` lorsque le porteur et cet objet occupent la baie requise. `_render_frame` change alors les couleurs de sa silhouette dans l’afficheur. Aux deux frontières, le service rend `matched=null`. Un retour de maintien `matched=true` suffit seulement à autoriser une attente au support. [Moteur du jeu, membre custom_games/engines/fog_hidden_motion.py](../../public/python/custom-games.zip) · [Assertions de contact et de reprise](../../tests/sic-reception-fogw-line61.test.ts)

## Frontière de l’offre

Le gel choisit déjà une commande mesurée qui sortirait de la grille depuis le support. Il essaie une fois puis peut attendre en série après un retour immobile. L’extraction rend cette proposition substituable via `ReceptionServiceMemory.offerStationaryObservation` avec la position du porteur, le support, les cellules accessibles, les mouvements connus et les confirmations stationnaires. Elle rend une commande et un indicateur de confirmation, ou aucune offre. L’appelant garde la recherche du chemin, le budget cumulatif, le nombre de tickets, les refus et l’acquisition. Dans le vrai service, fournir une offre de remesure unitaire sur les mêmes entrées de T17 produit une nouvelle sélection à T18. La caractérisation du gel est `9303451a` (arbre `src` identique au gel).
