# RE86 · présélection indépendante de la ligne 7

Gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021`, révision annoncée `8e820aa64f321153bb858040d462d7f766178947`. Réglages du [contrat de référence](https://github.com/yannick-fontan-1981/sra-playground/blob/7b271706/docs/architecture/sic-re86-ligne-7.md). Chaque départ charge le jeu en N1, ouverture catalogue, six niveaux cibles et 600 gestes par niveau. Comparer les 16 premiers gestes au catalogue puis un parcours prolongé qui communique un plafond suffisant pour le premier franchissement et la remise à zéro.

- Au T1, vérifier le ticket `constellation_cover / controlled_constellation_cover`, le sujet piloté et la première commande inconnue. Dater chaque vecteur et vérifier si le curseur, le support sélectionné ou son masque ont bougé. À état visible égal, retirer seulement la première commande du domaine consulté par la famille. Jouer l’autre ticket, comparer la variation et la preuve du prochain choix.
- Isoler la sélection du second support. Vérifier son identité observable, la pose effectivement acquise et sa contribution à l’offre de couverture suivante. Suivre les confirmations des projections avant le score. Compter le changement de niveau puis la remise à zéro séparément.
- Au même premier ticket T1, servir le plateau précédent dans toutes les images, en gardant la séquence et le compte d’images. Vérifier qu’aucun vecteur n’est acquis. Relever l’essai enregistré, la prochaine commande et son besoin. Refuser un reçu attribuant le déplacement à un support qui est resté en place.

## Réserve opérateur

Empreinte du fichier privé `1d4d2f9dbce726dbf9cc6f5d93bc637693304b1498acb394aaacc30d0a3e36fa`.

Après le premier ticket nominal dont le retour sélectionne un second support, rejouer depuis N1 et exécuter ce vrai ticket. Retenir seulement l’une des composantes de pixels modifiés de l’image finale, connectés par arêtes, et reprendre le plateau précédent pour les autres pixels. Choisir l’indice parmi les composantes triées par premier pixel ligne puis colonne, au moyen de l’octet 0 modulo leur nombre. Conserver le compte d’images et le statut officiel. Vérifier si le paquet partiel conserve la preuve de pose ou si la couverture prévue devient inadmissible. Si le retour comporte une seule composante, déclarer un contrôle de conservation et présenter en complément une observation stationnaire au même ticket. Mesurer la première estimation contradictoire ou la décision que la preuve permet encore.

Rapporter dénominateurs, reprises éventuelles et délai du premier essai indépendant au verdict.
