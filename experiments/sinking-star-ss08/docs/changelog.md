# SS08 — historique des modifications

## 0.3.0 — retour du rayon sur le Magicien

- Une visée qui boucle affiche désormais le trajet de téléportation. Au début du niveau 8, le rayon traverse les quatre miroirs dans l’ordre de la direction choisie, puis revient sur le Magicien.
- Le Magicien clignote sur sa case de départ ; la boucle ne le déplace pas et ne déclenche ni circuits ni attaques.
- Répéter la direction rejoue l’animation sans ajouter un état identique à l’historique d’annulation. Annuler interrompt aussi une animation en cours.
- Les refus liés à l’eau conservent leur traitement immédiat de v0.2.1.

## 0.2.1 — retour au comportement précédent dans l’eau

- Retrait du signal cyan/rouge et du message dédié ajoutés en v0.2.0.
- Rétablissement du traitement immédiat des actions et de l’annulation qui précédait cet ajout.
- Ordre des niveaux de v0.2.0 et priorité de dessin du miroir sur les boutons conservés.

## 0.2.0 — retours sur le HTML v1

- Ordre des niveaux : anciens 2, 3, 4, 1, 5, 6, 7, 8. L’atelier pédagogique suit sa salle au niveau 4 ; le lancement et le redémarrage commencent au nouveau niveau 1.
- Sources, identifiants, témoins, preuves et constructeurs renumérotés ensemble. Les huit géométries et leurs actions de résolution sont préservées.
- Priorité de dessin du miroir sur le bouton corrigée : aucun repère de circuit ne remplace sa diagonale blanche ni son dos noir.
- Refus d’une arrivée du Magicien dans l’eau : croix cyan puis deux clignotements rouges sur la case concernée, suivis de l’image normale. Les répétitions relancent l’animation sans accumuler des états identiques dans Annuler.
- Contrôles ciblés sur le miroir posé sur le bouton du niveau 5, un refus d’eau accessible dans le niveau 8, sa répétition et son annulation, puis rejeu de la campagne et de son interface.
