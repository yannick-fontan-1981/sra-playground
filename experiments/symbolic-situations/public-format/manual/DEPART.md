Tu joues une partie au tour par tour. À chaque tour, réponds uniquement par une commande de la fiche sur une seule ligne, avec ses identifiants exacts. Attends que je te donne le retour du jeu avant d’envoyer une autre commande. La partie se termine dès que le jeu rend son verdict.

# Situation

**But.** Obtenir une validation en un minimum d’actions. Le plan doit réussir dans chaque monde compatible avec les observations. On compte les actions dans le pire cas.

**Observations**

- Les deux cases X022d46 et Xfc26f3 sont vierges. Les tampons disponibles sont X03a3e1, X82259e, Xa16dcd.
- Le cadran désigne une seule sortie, X4c94cf ou X6e9ba2, qui reste fixe pendant la partie.
- La sortie X4c94cf exige le tampon X03a3e1 sur les deux cases.
- La sortie X6e9ba2 exige le tampon Xa16dcd sur les deux cases.
- La position initiale du cadran est inconnue.

**Actions disponibles**

- `marquer CASE TAMPON` marque une case vierge. Le premier marquage engage ce tampon pour tous les marquages suivants. Une marque est définitive.
- `lire` révèle la sortie désignée, une seule fois par partie, sans changer le cadran ni les marques.
- `valider` termine la partie. La validation réussit si les deux cases portent le tampon exigé par la sortie désignée. Tout autre résultat est un échec.

Joue ton premier coup.
