# KLOT, ligne 82 — rattacher le rôle au corps qui a bougé

## Première divergence préenregistrée

Le [lot nominal](sic-klot-ligne-82.md) à `a0df8a9b` utilise le
moteur du gel `d0e7527c`. Il reste le parent du correctif. Le clic
crée une hypothèse de sélection. La sonde rattache ensuite une
translation observée à un corps.

Deux départs auxiliaires jouent le vrai KLOT et fournissent leurs
retours à un ticket de la session nominale. Au T7, le ticket
ACTION1 vise la pièce 6, alors que le retour auxiliaire déplace
seulement 11. Au T9, le ticket ACTION1 vise la pièce 12, alors
que la sélection auxiliaire de 6 en (20,23) la déplace seule.
Les deux sessions nominales conservent leur état jusqu'à la
libération du ticket. [Reçu opérateur](https://github.com/yannick-fontan-1981/sra-playground/blob/575d1cbeed67911d0c3280d11ccd96983e26daed/experiments/symbolic-situations/klot-ligne-82/BILAN.md)

Dans les deux cas, le retour du gel est `matched:false`, scelle
le plan, laisse zéro modèle et arrête la reprise sur
`rigid_control_or_collision_model_refuted`. L'écart visé est
uniquement le rôle du reçu acquis. La pièce encore sélectionnée
ne doit plus recevoir `observed_exclusive_receiver` quand sa
pose n'a pas changé. L'hypothèse de sélection, le changement
de poses, les références, les modèles réfutés et l'arrêt sont
conservés.

Les trois retours nominaux sur 11, 6 et 12 doivent rester
identiques. Un déplacement exclusif de deux cases du corps
sélectionné demeure observable même si cette distance réfute
les modèles unitaires. La vérification sépare la mesure de la
population réelle du rôle attribué et de la validation de la
loi de commande.
