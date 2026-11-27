# G50T · mesurer une commande nécessaire à une préparation de contact

## Contrat de la ligne 18 avant le changement

La branche part de `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. La ligne 18 compte quatorze commandes dans l’inventaire. Son témoin est G50T L1 T3 `ACTION1`, famille `linked_temporal_preparation`, type `linked_contact_experiment`. Le mode du plan est `binding`. L’inventaire historique `8ce7ee35`, le gel et `3c2d6bcf` reproduisent la famille, le tour et la commande en repartant de L1 avec le pack natif par défaut. [Catalogue](sic-v8-strategies-observees.md?plain=1#L44) · [Matrice](sic-v8-composition-des-98-strategies.md?plain=1#L58)

| Situation | Invariant à vérifier |
|---|---|
| T3, puis T4 | Le trajet requiert un déplacement dont la commande manque. Le porteur et le site sont liés. La famille essaie `ACTION1` dans le contexte actuel. Le pas n’a aucune destination prédite. Mesurer la position avant/après, puis vérifier la commande d’essai suivante sur la nouvelle observation. |
| Même besoin de route, preuve de commande changée | Si le premier vecteur du chemin dispose d’une commande mesurée et disponible, ouvrir un accès. Si sa mesure manque, choisir la première commande admissible encore inédite ici. Si aucune ne reste, refuser l’offre. Tenir le trajet, le site et les observations fixes dans le cas construit. |
| Une même `ACTION4` en approche et à l’arrivée | Les pas d’accès antérieurs à l’entrée sur le site peuvent être corrects sans attester d’effet distant. À l’entrée, comparer le support du pair distant. Conserver le compte, les références des pixels changés et l’absence de causalité exclusive. Vérifier la reprise au tour suivant. |
| Second contexte | Réutiliser la scène indépendante de contact déjà caractérisée dans les tests du dépôt, avec ses coordonnées et son pas propres. Vérifier l’alternative essai/accès et un retour où la région distante reste inchangée. |

La frontière envisagée est le choix local entre offre d’essai et offre d’accès pour le premier pas d’un trajet déjà préparé. La géométrie de la famille, la mesure distante, les raisons, les références et la garde restent du ressort de leurs propriétaires. Les campagnes au solveur SIC exclusif et le témoin ZIPP/1 ont leur propre portée.
