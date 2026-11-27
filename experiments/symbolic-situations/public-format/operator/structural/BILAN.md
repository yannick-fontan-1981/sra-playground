# Transfert structurel · première mesure

**0 succès sur 8 départs pour la troisième mécanique, contre 18 sur 18 pour le contrôle des deux familles connues.** Le même consommateur `f296ac1c` a admis tous les départs. Sur la troisième mécanique il a exécuté quatre commandes, demandé zéro lecture et abandonné huit fois. Chaque commande proposée a été acceptée par le jeu.

**Premier manque public sur les quatre départs où la preuve pouvait périmer.** Le consommateur s’arrête avant le premier geste, alors que le relevé courant le justifie. La projection publique de ce geste par le code gelé renvoie `effet conditionnel indéterminé`. Le solveur ne construit donc pas la continuation qui permettrait de redemander la preuve après le changement de contexte. L’essai s’arrête avant toute décision de réutilisation d’une preuve périmée.

Sur les quatre départs où la preuve restait valable, le premier geste est correct. L’arrêt survient à son retour, avec `accusé matériel non reconnu pour la commande demandée`.

Les quatre fiches sont conformes au schéma `sra.public/1` du consommateur. L’énumération indépendante confirme leur solvabilité et la comparaison avec le simulateur couvre les 288 couples état–commande atteignables des huit départs. Le contrôle des anciennes familles a utilisé le même exécutable et le même montage isolé.

Sélection figée à `dae40349`, entrées et évaluateur gelés à `c0c56831`, opérateur `514cf4a8`. Empreinte SHA-256 du reçu de la troisième mécanique : `3eb28cb8cf927c0bfc92ea10266147a8740bb9967a52e3a2a1f23d10b4617f1d`.
