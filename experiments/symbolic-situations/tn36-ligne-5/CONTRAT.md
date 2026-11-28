# TN36 · présélection indépendante de la ligne 5

Gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. Le candidat annoncé est `0da75640d974e9fbe3b44b78b07649344169c470`. Critères [29241d51](https://github.com/yannick-fontan-1981/sra-playground/blob/29241d51/docs/architecture/sic-tn36-ligne-5.md). Chaque départ recharge N1 avec les options du catalogue, six niveaux cibles, 600 gestes par niveau et un plafond de 16 gestes, sans curiosité ciblée. Vérifier que le moteur comparé est celui annoncé.

| Étape | Preuve à relever |
|---|---|
| N1/T1 | Le ticket `code_program / learned_code_program` et l’action pointée peuvent relever de l’exploration. Identifier les mots visibles, le point, la démonstration proposée, le nombre d’opérateurs observés avant le ticket et toute prédiction native. |
| Retour de T1 | Mesurer l’ordre des transitions en suivant les changements des panneaux accessibles dans les sept images. Distinguer le vecteur de démonstration de la position du corps dans le monde principal, avant et après ce ticket. Relier les opérateurs retenus à la référence d’après et aux instructions concernées. |
| N1/T8 | Relever la différence entre le code initial et le code modifié. Vérifier l’usage d’un opérateur acquis et l’effet de l’exécution sur le monde principal. Identifier précisément ce qui est réutilisé ou remplaçable si le choix est exposé. |
| N2 | Poursuivre le vrai parcours. Identifier une démonstration propre à ce niveau et un ticket qui en consomme la preuve. Vérifier les références et le retour. Une action ou un type de plan identique ne suffit pas pour rattacher les deux niveaux à la même acquisition. |

À premier ticket identique, servir seulement l’image finale au retour de T1, puis relever le mode et la proposition de T2. Conserver le monde physique et l’observation servie séparément. Vérifier qu’un reçu attribuant les étapes ordonnées du retour complet à l’image finale seule est rejeté.

Réserve opérateur, fichier privé dont l’empreinte SHA-256 est `81cc562f35adf869ca9aa070dea9c678fb633e3748de806a0926cb0ed88c2c14`. Dans un autre départ neuf, garder la première et la dernière image et le nombre total d’images. Transposer une paire d’images intermédiaires différentes. Trier les paires par leurs indices croissants puis choisir `octet 0 modulo nombre de paires`. Examiner si le couple choisi modifie l’ordre des transitions effectivement exploitées. Si l’ordre des preuves reste exploitable, décrire les preuves conservées. S’il change, relever les opérateurs encore justifiés et ce que propose T2. Classer l’entrée comme observation construite. La sélection privée reste chez l’opérateur.

Rapporter les gestes exécutés, les tickets exploratoires, les preuves d’apprentissage, les exécutions qui s’en servent et le temps jusqu’au verdict. Les reprises de l’opérateur figurent à part.
