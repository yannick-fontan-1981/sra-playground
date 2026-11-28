# Verdict SYME · ligne 78

Le catalogue `8ce7ee35` et le gel `d0e7527c` donnent les mêmes familles, commandes et paquets publics sur 16 gestes. Le ticket N1/T1 est `regular_field_correspondence / public_symmetric_field / OP18`, ACTION6 (7,35). Le gel porte déjà l'admission par accord des hypothèses et la vérification des retours.

| Situation | Décision et preuve publique |
|---|---|
| N1/T1, 81 cellules, taille 5×5, pas 6 | Le seul candidat admissible au départ est le miroir qui conserve la ligne, `horizontal` dans le code. Il dispose de 27 paires égales et 9 contrastes. En (5,33), 11 est exceptionnel et le seul miroir (53,33) soutient 9. Le clic (7,35) teste la cellule. L'effet du clic reste inconnu à l'émission. |
| Même géométrie, seul miroir (53,33) de 9 à 8 | La même cellule est liée au même clic proposé. La conséquence attendue par la relation devient 8. Ce contraste s'arrête avant tout geste. |
| Vrai T1 puis T2 | Le retour mesure 9 au point affecté, avec le correspondant (53,33) comme référence. Le service reprend la cellule suivante. Le retour construit avec 0 à la place de 9 préserve le paquet exécuté et fournit une contradiction locale. Le propriétaire désactive sa branche et le service reprend ailleurs. |
| Grille construite 4×4, classe de période [2,2] partagée entre deux 8 et deux 9 | Omettre 8 ou omettre 9 donne deux candidats étayés chacun par deux occurrences, avec des réparations sans cellule commune. Le service observe l'abstention du propriétaire. Une autre famille propose tout de même le clic (13,13). |
| Même grille, une case 8 devient 9 | Trois témoins 9 dans la classe. Une seule répétition reste admissible. Le même clic (13,13) devient un test de correspondance pour 9. Aucun geste n'est joué sur les grilles construites. |
| N1/T5–T9 puis N2/T10–T16 | Le vrai T5 apporte la seconde couleur réparée, 8 après les retours à 9. Le T6 émet la première projection matérielle, sur un préfixe de quatre gestes. T9 reçoit la frontière officielle. En N2, la famille mesure un miroir qui conserve la colonne, `vertical` dans le code. Les vrais T10 et T11 réétalonnent les deux couleurs, puis T12 engage un préfixe prédit de cinq gestes. |

`measuredFields` délimite la grille, `symmetryEvidence` et `periodicHypotheses` produisent les réparations soutenues. `SymmetricField.fit` garde seulement les réparations communes lorsque les candidats divergent. `WindowConstraints.propose` et `before` lient le clic au support et à la projection courante. `SymmetricField.record` conserve les deux couleurs démontrées ou la réfutation, et la fin officielle reste distincte.

Six préfixes et 8 tests passent. Le témoin périodique utilise une paire de grilles construites explicites pour isoler l'ambiguïté. Durée du préenregistrement au reçu 9 min 38 s. Harnais `85194a499e1b81c4c26e418efbd171bf469d00d1`. Reçu local `artifacts/qualification-syme-78/85194a49.json`, SHA-256 `18c30e360e0c7ea13ff0c156a82f9b344f441fec1977d34f38666ec9ebc9aaeb`. [Commande de rejeu](README.md).
